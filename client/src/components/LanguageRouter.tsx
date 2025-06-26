/**
 * Language-aware routing wrapper for wouter
 * Handles path-based language URLs like /es-pe/dashboard, /en-us/pricing
 */

import { useEffect } from 'react';
import { useLocation, Route, Switch } from 'wouter';
import { useTranslation } from 'react-i18next';
import { 
  getLanguageFromPath, 
  redirectToDefaultLanguage, 
  removeLanguageFromPath,
  SupportedLanguage 
} from '@/utils/languageRouting';

interface LanguageRouterProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that handles language detection and routing
 */
export function LanguageRouter({ children }: LanguageRouterProps) {
  const [location, setLocation] = useLocation();
  const { i18n } = useTranslation();

  useEffect(() => {
    // Check if current path has a language prefix
    const currentLanguage = getLanguageFromPath(location);
    
    if (currentLanguage) {
      // Valid language found - sync with i18next if needed
      if (i18n.language !== currentLanguage) {
        i18n.changeLanguage(currentLanguage);
      }
    } else {
      // No language prefix - redirect to default language
      redirectToDefaultLanguage(location, setLocation, 'en-us');
    }
  }, [location, i18n]);

  return <>{children}</>;
}

/**
 * Language-aware Route component
 * Automatically handles language prefixes in paths
 */
interface LanguageRouteProps {
  path: string;
  component: React.ComponentType<any>;
  [key: string]: any;
}

export function LanguageRoute({ path, component: Component, ...props }: LanguageRouteProps) {
  // Create pattern that matches language prefix + the actual path
  const languagePattern = `/:lang(en-us|es-pe)${path === '/' ? '' : path}`;
  
  return (
    <Route path={languagePattern} {...props}>
      {(params) => {
        // Extract language and pass clean params to component
        const { lang, ...cleanParams } = params || {};
        return <Component {...cleanParams} />;
      }}
    </Route>
  );
}

/**
 * Language-aware Switch component
 */
export function LanguageSwitch({ children }: { children: React.ReactNode }) {
  return <Switch>{children}</Switch>;
}

/**
 * Hook to get current language from URL
 */
export function useCurrentLanguage(): SupportedLanguage {
  const [location] = useLocation();
  return getLanguageFromPath(location) || 'en-us';
}

/**
 * Hook for language-aware navigation
 */
export function useLanguageNavigation() {
  const [location, setLocation] = useLocation();
  const currentLanguage = getLanguageFromPath(location) || 'en-us';
  
  const navigate = (path: string) => {
    const newPath = `/${currentLanguage}${path === '/' ? '' : path}`;
    setLocation(newPath);
  };
  
  const changeLanguage = (newLanguage: SupportedLanguage) => {
    const cleanPath = removeLanguageFromPath(location);
    const newPath = `/${newLanguage}${cleanPath === '/' ? '' : cleanPath}`;
    setLocation(newPath);
  };
  
  return { navigate, changeLanguage, currentLanguage };
}