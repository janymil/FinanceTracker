import { Request, Response, NextFunction } from 'express';

/**
 * Geo-blocking middleware to restrict access from specific countries
 * Uses multiple IP geolocation services for accuracy
 */

interface GeoLocation {
  country: string;
  countryCode: string;
  blocked: boolean;
}

// Countries to block (ISO country codes)
const BLOCKED_COUNTRIES = [
  'IN', // India
  // Add more country codes as needed
  // 'CN', // China
  // 'RU', // Russia
];

/**
 * Get visitor's country using IP geolocation
 */
async function getVisitorCountry(ip: string): Promise<GeoLocation> {
  // Skip blocking for local development
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Local', countryCode: 'LOCAL', blocked: false };
  }

  try {
    // Primary service: ipapi.co (1000 requests/day free)
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await response.json();
    
    if (data.country_code) {
      return {
        country: data.country_name || data.country,
        countryCode: data.country_code,
        blocked: BLOCKED_COUNTRIES.includes(data.country_code)
      };
    }
  } catch (error) {
    console.log('Primary geolocation service failed, trying fallback...');
  }

  try {
    // Fallback service: ip-api.com (unlimited for non-commercial)
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();
    
    if (data.countryCode) {
      return {
        country: data.country,
        countryCode: data.countryCode,
        blocked: BLOCKED_COUNTRIES.includes(data.countryCode)
      };
    }
  } catch (error) {
    console.log('Fallback geolocation service failed');
  }

  // If all services fail, allow access (fail-open approach)
  return { country: 'Unknown', countryCode: 'UNKNOWN', blocked: false };
}

/**
 * Extract real IP address from request
 */
function getRealIP(req: Request): string {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  ) as string;
}

/**
 * Geo-blocking middleware
 */
export async function geoBlockingMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const ip = getRealIP(req);
    const location = await getVisitorCountry(ip);
    
    // Log access attempts (for monitoring)
    console.log(`Access attempt from ${location.country} (${location.countryCode}) - IP: ${ip}`);
    
    if (location.blocked) {
      console.log(`BLOCKED: Access denied for ${location.country} (${location.countryCode})`);
      
      // Return 403 Forbidden with explanation
      return res.status(403).json({
        error: 'Access Denied',
        message: 'This service is not available in your region.',
        country: location.country,
        blocked: true
      });
    }
    
    // Allow access - continue to next middleware
    next();
    
  } catch (error) {
    console.error('Geo-blocking middleware error:', error);
    // On error, allow access (fail-open approach)
    next();
  }
}

/**
 * Optional: Add blocked countries to the list
 */
export function addBlockedCountry(countryCode: string) {
  if (!BLOCKED_COUNTRIES.includes(countryCode)) {
    BLOCKED_COUNTRIES.push(countryCode);
  }
}

/**
 * Optional: Remove countries from blocked list
 */
export function removeBlockedCountry(countryCode: string) {
  const index = BLOCKED_COUNTRIES.indexOf(countryCode);
  if (index > -1) {
    BLOCKED_COUNTRIES.splice(index, 1);
  }
}

/**
 * Get current blocked countries list
 */
export function getBlockedCountries(): string[] {
  return [...BLOCKED_COUNTRIES];
}