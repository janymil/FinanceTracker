import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { blockedCountries } from '../../shared/schema.ts';
import { eq } from 'drizzle-orm';

interface GeoJSResponse {
  country_code: string;
  country: string;
  city: string;
  timezone: string;
  ip: string;
}

// Cache blocked countries for 5 minutes to avoid frequent DB queries
let blockedCountriesCache: Set<string> | null = null;
let cacheExpiry: number = 0;

async function getBlockedCountries(): Promise<Set<string>> {
  const now = Date.now();
  
  if (blockedCountriesCache && cacheExpiry > now) {
    return blockedCountriesCache;
  }

  try {
    const blocked = await db.select({ countryCode: blockedCountries.countryCode })
      .from(blockedCountries);
    
    blockedCountriesCache = new Set(blocked.map(b => b.countryCode.toUpperCase()));
    cacheExpiry = now + (5 * 60 * 1000); // 5 minutes
  } catch (error) {
    console.error('Error fetching blocked countries:', error);
    // Return empty set if database is not ready
    return new Set();
  }
  
  return blockedCountriesCache || new Set();
}

export function invalidateBlockedCountriesCache() {
  blockedCountriesCache = null;
  cacheExpiry = 0;
}

export async function countryBlockingMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Skip blocking for admin routes
    if (req.path.startsWith('/api/admin-analytics')) {
      return next();
    }

    // Skip for health checks and static assets
    if (req.path === '/health' || req.path.startsWith('/assets')) {
      return next();
    }
    // Get client IP
    const ip = req.headers['x-forwarded-for'] as string || 
               req.headers['x-real-ip'] as string || 
               req.socket.remoteAddress || 
               '';

    // Extract first IP if multiple (proxy chain)
    const clientIP = ip.split(',')[0].trim();

    // Skip for localhost/development
    if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.startsWith('192.168.')) {
      return next();
    }

    // Fetch geolocation data from GeoJS
    const geoResponse = await fetch(`https://get.geojs.io/v1/ip/geo/${clientIP}.json`);
    
    if (!geoResponse.ok) {
      console.error('GeoJS API error:', geoResponse.status);
      // Allow access if geo service fails
      return next();
    }

    const geoData = await geoResponse.json() as GeoJSResponse;
    const countryCode = geoData.country_code?.toUpperCase();

    if (!countryCode) {
      // Allow access if country can't be determined
      return next();
    }

    // Check if country is blocked
    const blockedSet = await getBlockedCountries();
    
    if (blockedSet.has(countryCode)) {
      // Log blocked access attempt
      console.log(`Blocked access from ${countryCode} (${geoData.country}) - IP: ${clientIP}`);
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Access from your country is not available',
        country: geoData.country
      });
    }

    // Add country info to request for analytics
    (req as any).geoInfo = {
      countryCode,
      country: geoData.country,
      city: geoData.city,
      ip: clientIP
    };

    next();
  } catch (error) {
    console.error('Country blocking middleware error:', error);
    // Allow access on error to prevent blocking legitimate users
    next();
  }
}