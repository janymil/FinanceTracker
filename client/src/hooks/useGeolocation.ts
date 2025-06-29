import { useState, useEffect } from 'react';
import { getLocationWithCaching, LocationInfo } from '../../lib/geolocation';

/**
 * React hook for geolocation-based compliance detection
 * Returns user location info to show appropriate legal notices
 */
export function useGeolocation() {
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLocation() {
      try {
        setLoading(true);
        setError(null);
        
        const locationInfo = await getLocationWithCaching();
        setLocation(locationInfo);
        
        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
          console.log('User location detected:', {
            country: locationInfo.country,
            requiresGDPR: locationInfo.requiresGDPR,
            requiresCCPA: locationInfo.requiresCCPA,
          });
        }
      } catch (err) {
        console.warn('Failed to detect user location:', err);
        setError('Failed to detect location');
        
        // Set safe default that shows all compliance notices
        setLocation({
          country: 'Unknown',
          countryCode: 'XX',
          region: 'Unknown',
          regionCode: 'XX',
          isEU: false,
          isCalifornia: false,
          isUS: false,
          requiresGDPR: true,
          requiresCCPA: true,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchLocation();
  }, []);

  return {
    location,
    loading,
    error,
    // Helper functions
    requiresGDPR: location?.requiresGDPR ?? true,
    requiresCCPA: location?.requiresCCPA ?? true,
    isEU: location?.isEU ?? false,
    isUS: location?.isUS ?? false,
    isCalifornia: location?.isCalifornia ?? false,
  };
}