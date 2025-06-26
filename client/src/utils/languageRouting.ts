/**
 * Language routing utilities for path-based URL structure
 * Handles URL patterns like /es-pe/dashboard, /en-us/pricing, etc.
 */

import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';

// Supported languages with their locale codes
export const SUPPORTED_LANGUAGES = {
  'en-us': 'English (US)',
  'es-pe': 'Español (Perú)',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

/**
 * Extract language from current URL path
 * Examples: /es-pe/dashboard -> 'es-pe', /en-us/pricing -> 'en-us'
 */
export function getLanguageFromPath(path: string): SupportedLanguage | null {
  const segments = path.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (firstSegment && firstSegment in SUPPORTED_LANGUAGES) {
    return firstSegment as SupportedLanguage;
  }
  
  return null;
}

/**
 * Remove language prefix from path
 * Examples: /es-pe/dashboard -> /dashboard, /en-us/pricing -> /pricing
 */
export function removeLanguageFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (firstSegment && firstSegment in SUPPORTED_LANGUAGES) {
    return '/' + segments.slice(1).join('/');
  }
  
  return path;
}

/**
 * Add language prefix to path
 * Examples: (/dashboard, 'es-pe') -> /es-pe/dashboard
 */
export function addLanguageToPath(path: string, language: SupportedLanguage): string {
  // Remove existing language prefix if present
  const cleanPath = removeLanguageFromPath(path);
  
  // Add new language prefix
  return `/${language}${cleanPath === '/' ? '' : cleanPath}`;
}

/**
 * Get current route without language prefix
 */
export function useCleanRoute(): [string, (path: string) => void] {
  const [location, setLocation] = useLocation();
  
  const cleanLocation = removeLanguageFromPath(location);
  
  const setCleanLocation = (path: string) => {
    const currentLanguage = getLanguageFromPath(location) || 'en-us';
    const newPath = addLanguageToPath(path, currentLanguage);
    setLocation(newPath);
  };
  
  return [cleanLocation, setCleanLocation];
}

/**
 * Navigate to a path while preserving current language
 */
export function navigateWithLanguage(path: string, currentPath: string, setLocation: (path: string) => void) {
  const currentLanguage = getLanguageFromPath(currentPath) || 'en-us';
  const newPath = addLanguageToPath(path, currentLanguage);
  setLocation(newPath);
}

/**
 * Change language and redirect to equivalent page
 */
export function changeLanguage(newLanguage: SupportedLanguage, currentPath: string, setLocation: (path: string) => void, i18n: any) {
  const cleanPath = removeLanguageFromPath(currentPath);
  const newPath = addLanguageToPath(cleanPath, newLanguage);
  
  // Update i18next language
  i18n.changeLanguage(newLanguage);
  
  // Navigate to new path
  setLocation(newPath);
}

/**
 * Check if current path has a valid language prefix
 */
export function hasValidLanguagePrefix(path: string): boolean {
  return getLanguageFromPath(path) !== null;
}

/**
 * Redirect to default language if no language prefix exists
 */
export function redirectToDefaultLanguage(path: string, setLocation: (path: string) => void, defaultLanguage: SupportedLanguage = 'en-us') {
  if (!hasValidLanguagePrefix(path)) {
    const newPath = addLanguageToPath(path, defaultLanguage);
    setLocation(newPath);
    return true;
  }
  return false;
}