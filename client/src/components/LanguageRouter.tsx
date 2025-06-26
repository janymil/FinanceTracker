import { useEffect } from 'react';
import { Router, Route, Switch, useLocation, useParams } from 'wouter';
import { useTranslation } from 'react-i18next';

// Supported languages with their path codes
export const SUPPORTED_LANGUAGES = {
  'en-us': 'en-US',
  'es-pe': 'es-PE',
  'pt-br': 'pt-BR',
  'fr-fr': 'fr-FR',
  'de-de': 'de-DE',
  'zh-cn': 'zh-CN',
  'ja-jp': 'ja-JP'
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

interface LanguageRouterProps {
  children: React.ReactNode;
}

// Extract language from URL path
export function extractLanguageFromPath(path: string): { lang: LanguageCode | null; cleanPath: string } {
  const segments = path.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return { lang: null, cleanPath: '/' };
  }
  
  const potentialLang = segments[0].toLowerCase() as LanguageCode;
  
  if (potentialLang in SUPPORTED_LANGUAGES) {
    const cleanPath = '/' + segments.slice(1).join('/');
    return { lang: potentialLang, cleanPath: cleanPath || '/' };
  }
  
  return { lang: null, cleanPath: path };
}

// Build URL with language prefix
export function buildLanguageUrl(lang: LanguageCode, path: string): string {
  // Remove leading slash and clean the path
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  if (lang === 'en-us') {
    // Default language doesn't need prefix
    return '/' + cleanPath;
  }
  
  return `/${lang}/${cleanPath}`;
}

// Component to handle language routing
export function LanguageRouter({ children }: LanguageRouterProps) {
  const [location, setLocation] = useLocation();
  const { i18n } = useTranslation();
  
  useEffect(() => {
    const { lang, cleanPath } = extractLanguageFromPath(location);
    
    if (lang && lang in SUPPORTED_LANGUAGES) {
      // Valid language in URL - switch to it
      const targetLanguage = SUPPORTED_LANGUAGES[lang as LanguageCode];
      if (i18n.language !== targetLanguage) {
        i18n.changeLanguage(targetLanguage);
      }
    } else {
      // No language in URL or invalid language
      const currentLang = i18n.language;
      const langCode = Object.entries(SUPPORTED_LANGUAGES).find(
        ([_, value]) => value === currentLang
      )?.[0] as LanguageCode;
      
      if (langCode && langCode !== 'en-us') {
        // Redirect to URL with language prefix
        const newUrl = buildLanguageUrl(langCode, location);
        setLocation(newUrl);
        return;
      }
    }
  }, [location, i18n, setLocation]);
  
  return <>{children}</>;
}

// Hook to get current language from URL
export function useLanguageFromUrl(): LanguageCode {
  const [location] = useLocation();
  const { lang } = extractLanguageFromPath(location);
  return lang || 'en-us';
}

// Hook to navigate with language preservation
export function useLanguageNavigate() {
  const [, setLocation] = useLocation();
  const currentLang = useLanguageFromUrl();
  
  return (path: string) => {
    const url = buildLanguageUrl(currentLang, path);
    setLocation(url);
  };
}

// Component for language-aware routes
interface LanguageRouteProps {
  path: string;
  component: React.ComponentType<any>;
}

export function LanguageRoute({ path, component: Component }: LanguageRouteProps) {
  return (
    <>
      {/* Default language route (no prefix) */}
      <Route path={path} component={Component} />
      
      {/* Language-prefixed routes */}
      {Object.keys(SUPPORTED_LANGUAGES).map((langCode) => (
        <Route 
          key={langCode}
          path={`/${langCode}${path}`} 
          component={Component} 
        />
      ))}
    </>
  );
}