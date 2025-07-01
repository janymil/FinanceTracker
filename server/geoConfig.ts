/**
 * Geo-blocking Configuration
 * Manage which countries are blocked from accessing the application
 */

export interface BlockedCountryConfig {
  code: string;
  name: string;
  reason?: string;
  blockedAt: Date;
}

// Configuration for blocked countries
export const GEO_BLOCKING_CONFIG = {
  // Enable/disable geo-blocking entirely
  enabled: false, // Temporarily disabled due to API failures
  
  // Blocked countries with reasons
  blockedCountries: [
    {
      code: 'IN',
      name: 'India',
      reason: 'Business policy decision',
      blockedAt: new Date('2025-07-01')
    }
    // Add more countries here as needed:
    // {
    //   code: 'CN',
    //   name: 'China',
    //   reason: 'Regulatory compliance',
    //   blockedAt: new Date('2025-07-01')
    // },
    // {
    //   code: 'RU',
    //   name: 'Russia',
    //   reason: 'Sanctions compliance',
    //   blockedAt: new Date('2025-07-01')
    // }
  ] as BlockedCountryConfig[],
  
  // Custom blocked message per country (optional)
  customMessages: {
    'IN': 'FinanzerPro is currently not available in India. We apologize for any inconvenience.',
    'CN': 'FinanzerPro services are not available in China due to regulatory requirements.',
    'RU': 'Service unavailable in this region due to current restrictions.'
  } as Record<string, string>,
  
  // Fallback behavior when geolocation fails
  failOpen: true, // true = allow access if location can't be determined, false = block
  
  // Rate limiting for geolocation API calls
  maxRequestsPerHour: 1000,
  
  // Cache duration for IP location results (in milliseconds)
  locationCacheDuration: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Get list of blocked country codes
 */
export function getBlockedCountryCodes(): string[] {
  return GEO_BLOCKING_CONFIG.blockedCountries.map(country => country.code);
}

/**
 * Check if a country is blocked
 */
export function isCountryBlocked(countryCode: string): boolean {
  if (!GEO_BLOCKING_CONFIG.enabled) {
    return false;
  }
  return getBlockedCountryCodes().includes(countryCode);
}

/**
 * Get custom message for blocked country
 */
export function getBlockedMessage(countryCode: string): string {
  return GEO_BLOCKING_CONFIG.customMessages[countryCode] || 
         'This service is not available in your region.';
}

/**
 * Add a new country to the blocked list
 */
export function addBlockedCountry(code: string, name: string, reason?: string): void {
  const existing = GEO_BLOCKING_CONFIG.blockedCountries.find(c => c.code === code);
  if (!existing) {
    GEO_BLOCKING_CONFIG.blockedCountries.push({
      code: code.toUpperCase(),
      name,
      reason,
      blockedAt: new Date()
    });
  }
}

/**
 * Remove a country from the blocked list
 */
export function removeBlockedCountry(code: string): boolean {
  const index = GEO_BLOCKING_CONFIG.blockedCountries.findIndex(c => c.code === code);
  if (index > -1) {
    GEO_BLOCKING_CONFIG.blockedCountries.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Get detailed info about all blocked countries
 */
export function getBlockedCountriesInfo(): BlockedCountryConfig[] {
  return [...GEO_BLOCKING_CONFIG.blockedCountries];
}