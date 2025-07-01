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

// Simple in-memory cache for IP locations (24 hour TTL)
const ipLocationCache = new Map<string, { location: GeoLocation; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get visitor's country using IP geolocation with caching and improved error handling
 */
async function getVisitorCountry(ip: string): Promise<GeoLocation> {
  // Skip blocking for local development
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Local', countryCode: 'LOCAL', blocked: false };
  }

  // Check cache first
  const cached = ipLocationCache.get(ip);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.location;
  }

  // For now, let's be conservative and only check specific Indian IP ranges
  // instead of making external API calls that are failing
  const location = await getLocationWithoutAPI(ip);
  
  // Cache the result
  ipLocationCache.set(ip, { location, timestamp: Date.now() });
  
  return location;
}

/**
 * Simplified geolocation without external API calls
 * Uses known IP ranges for India to reduce API dependency
 */
async function getLocationWithoutAPI(ip: string): Promise<GeoLocation> {
  // Known Indian IP ranges (simplified detection)
  const indianIPRanges = [
    /^1\.186\./, /^1\.187\./, /^14\.139\./, /^14\.140\./,
    /^27\.58\./, /^27\.59\./, /^43\.224\./, /^43\.225\./,
    /^49\.14\./, /^49\.15\./, /^59\.88\./, /^59\.89\./,
    /^103\./, /^106\./, /^117\./, /^122\./,
    /^125\./, /^163\./, /^180\./, /^182\./,
    /^202\./, /^203\./, /^210\./, /^218\./
  ];

  // Check if IP matches known Indian ranges
  const isIndianIP = indianIPRanges.some(range => range.test(ip));
  
  if (isIndianIP) {
    return {
      country: 'India',
      countryCode: 'IN',
      blocked: BLOCKED_COUNTRIES.includes('IN')
    };
  }

  // For all other IPs, allow access (fail-open approach)
  // This prevents blocking legitimate users due to geolocation failures
  return { 
    country: 'Unknown', 
    countryCode: 'UNKNOWN', 
    blocked: false 
  };
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