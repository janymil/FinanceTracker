import { Request, Response, NextFunction } from 'express';

interface CookieConsent {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  timestamp: string;
}

export function cookieConsentMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get consent from cookie or header
  let consent: CookieConsent | null = null;
  
  // Try to get consent from cookie first
  const consentCookie = req.cookies?.['cookie-consent'];
  if (consentCookie) {
    try {
      // Handle both string and already parsed object
      consent = typeof consentCookie === 'string' ? JSON.parse(consentCookie) : consentCookie;
    } catch (error) {
      console.warn('Invalid cookie consent format:', error);
    }
  }
  
  // If no cookie consent, check for consent in request body/headers
  if (!consent && req.headers['x-cookie-consent']) {
    try {
      consent = JSON.parse(req.headers['x-cookie-consent'] as string);
    } catch (error) {
      console.warn('Invalid header consent format:', error);
    }
  }
  
  // Default to essential only if no consent found
  if (!consent) {
    consent = {
      essential: true,
      functional: false,
      analytics: false,
      timestamp: new Date().toISOString()
    };
  }
  
  // Add consent to request object for use in routes
  (req as any).cookieConsent = consent;
  
  // Override res.cookie to respect consent
  const originalCookie = res.cookie.bind(res);
  res.cookie = function(name: string, value: any, options: any = {}) {
    const cookieType = getCookieType(name);
    
    // Only set cookie if user has consented to this type
    if (shouldSetCookie(cookieType, consent!)) {
      return originalCookie(name, value, options);
    }
    
    // If not consented, just return response (don't set cookie)
    return this;
  };
  
  next();
}

function getCookieType(cookieName: string): 'essential' | 'functional' | 'analytics' {
  // Essential cookies (always required)
  if (cookieName.includes('session') || cookieName.includes('csrf') || cookieName.includes('auth')) {
    return 'essential';
  }
  
  // Functional cookies (enhance user experience)
  if (cookieName.includes('theme') || cookieName.includes('language') || cookieName.includes('preferences')) {
    return 'functional';
  }
  
  // Analytics cookies (tracking and analytics)
  if (cookieName.includes('analytics') || cookieName.includes('tracking') || cookieName.includes('ga_')) {
    return 'analytics';
  }
  
  // Default to functional for unknown cookies
  return 'functional';
}

function shouldSetCookie(type: 'essential' | 'functional' | 'analytics', consent: CookieConsent): boolean {
  switch (type) {
    case 'essential':
      return true; // Always allow essential cookies
    case 'functional':
      return consent.functional;
    case 'analytics':
      return consent.analytics;
    default:
      return false;
  }
}

// Middleware to set cookie consent preferences
export function setCookieConsent(req: Request, res: Response, next: NextFunction) {
  const consent = req.body.consent;
  
  if (consent && typeof consent === 'object') {
    // Set the consent cookie (this is essential, so always allowed)
    res.cookie('cookie-consent', JSON.stringify(consent), {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false, // Allow frontend access
      secure: false, // Set to false for development
      sameSite: 'lax' // More permissive for development
    });
    
    // Update the request object with new consent for immediate use
    (req as any).cookieConsent = consent;
    
    // If user disabled functional cookies, clear existing functional cookies
    if (!consent.functional) {
      clearFunctionalCookies(res);
    }
    
    // If user disabled analytics cookies, clear existing analytics cookies
    if (!consent.analytics) {
      clearAnalyticsCookies(res);
    }
  }
  
  next();
}

function clearFunctionalCookies(res: Response) {
  // Clear known functional cookies
  const functionalCookies = ['theme', 'language', 'preferences', 'dashboard-layout'];
  
  functionalCookies.forEach(cookieName => {
    res.clearCookie(cookieName);
  });
}

function clearAnalyticsCookies(res: Response) {
  // Clear known analytics cookies
  const analyticsCookies = ['analytics', 'tracking', '_ga', '_ga_', '_gid', '_gat'];
  
  analyticsCookies.forEach(cookieName => {
    res.clearCookie(cookieName);
  });
}