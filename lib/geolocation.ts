/**
 * Geolocation Detection System for Legal Compliance
 * Detects visitor location to show appropriate privacy notices (GDPR for EU, CCPA for CA/US)
 */

export interface LocationInfo {
  country: string;
  countryCode: string;
  region: string;
  regionCode: string;
  isEU: boolean;
  isCalifornia: boolean;
  isUS: boolean;
  requiresGDPR: boolean;
  requiresCCPA: boolean;
}

// EU country codes (post-Brexit)
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// EEA countries (additional to EU)
const EEA_COUNTRIES = ['IS', 'LI', 'NO'];

// GDPR also applies to UK, Switzerland
const GDPR_COUNTRIES = [...EU_COUNTRIES, ...EEA_COUNTRIES, 'GB', 'CH'];

/**
 * Free IP Geolocation using ipapi.co (1000 requests/day free)
 * Fallback to ip-api.com (unlimited non-commercial)
 */
export async function detectUserLocation(): Promise<LocationInfo> {
  try {
    // Try primary service (ipapi.co)
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return parseLocationData(data);
    }

    // Fallback to ip-api.com
    const fallbackResponse = await fetch('http://ip-api.com/json/?fields=status,country,countryCode,region,regionName', {
      method: 'GET',
    });

    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      if (fallbackData.status === 'success') {
        return parseLocationData({
          country_name: fallbackData.country,
          country_code: fallbackData.countryCode,
          region: fallbackData.regionName,
          region_code: fallbackData.region,
        });
      }
    }

    // Default fallback for failed geolocation
    return getDefaultLocation();
  } catch (error) {
    console.warn('Geolocation detection failed:', error);
    return getDefaultLocation();
  }
}

/**
 * Parse location data from API response
 */
function parseLocationData(data: any): LocationInfo {
  const countryCode = (data.country_code || data.countryCode || '').toUpperCase();
  const regionCode = (data.region_code || data.region || '').toUpperCase();
  
  const isEU = EU_COUNTRIES.includes(countryCode);
  const isEEA = EEA_COUNTRIES.includes(countryCode);
  const requiresGDPR = GDPR_COUNTRIES.includes(countryCode);
  const isUS = countryCode === 'US';
  const isCalifornia = isUS && regionCode === 'CA';
  const requiresCCPA = isCalifornia || isUS; // CCPA applies to all US residents accessing CA businesses

  return {
    country: data.country_name || data.country || 'Unknown',
    countryCode,
    region: data.region || data.regionName || '',
    regionCode,
    isEU,
    isCalifornia,
    isUS,
    requiresGDPR,
    requiresCCPA,
  };
}

/**
 * Default location when geolocation fails
 * Shows all compliance notices to be safe
 */
function getDefaultLocation(): LocationInfo {
  return {
    country: 'Unknown',
    countryCode: 'XX',
    region: 'Unknown',
    regionCode: 'XX',
    isEU: false,
    isCalifornia: false,
    isUS: false,
    requiresGDPR: true, // Show GDPR by default when location unknown
    requiresCCPA: true, // Show CCPA by default when location unknown
  };
}

/**
 * Client-side location detection with caching
 * Cache for 24 hours to avoid repeated API calls
 */
export async function getLocationWithCaching(): Promise<LocationInfo> {
  const CACHE_KEY = 'user_location_info';
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  try {
    // Check cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data as LocationInfo;
      }
    }

    // Fetch fresh location data
    const location = await detectUserLocation();

    // Cache the result
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: location,
      timestamp: Date.now(),
    }));

    return location;
  } catch (error) {
    console.warn('Location caching failed:', error);
    return await detectUserLocation();
  }
}

/**
 * Clear location cache (useful for testing)
 */
export function clearLocationCache(): void {
  localStorage.removeItem('user_location_info');
}