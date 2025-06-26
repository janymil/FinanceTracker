import { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';

// Supported languages
const SUPPORTED_LOCALES = ['en-us', 'es-pe', 'sk-sk'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

// Language code mapping for i18next
const LOCALE_MAP: Record<SupportedLocale, string> = {
  'en-us': 'en-US',
  'es-pe': 'es-PE', 
  'sk-sk': 'sk-SK'
};

function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export function LanguageGuard({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const { i18n } = useTranslation();
  
  const lang = params.lang as string;
  
  useEffect(() => {
    if (!lang) {
      // No language in URL, redirect to default
      const currentPath = location.replace(/^\//, '');
      setLocation(`/en-us/${currentPath}`);
      return;
    }
    
    if (!isValidLocale(lang)) {
      // Invalid language, redirect to English
      const pathWithoutLang = location.replace(/^\/[^\/]+/, '');
      setLocation(`/en-us${pathWithoutLang}`);
      return;
    }
    
    // Valid language, update i18next
    const i18nLanguage = LOCALE_MAP[lang];
    if (i18n.language !== i18nLanguage) {
      i18n.changeLanguage(i18nLanguage);
    }
  }, [lang, location, setLocation, i18n]);
  
  // Don't render children until language is validated and set
  if (!lang || !isValidLocale(lang)) {
    return null;
  }
  
  return <>{children}</>;
}

// Utility function to get localized path
export function getLocalizedPath(path: string): string {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language;
  
  // Find the locale code for current language
  const localeCode = Object.entries(LOCALE_MAP).find(
    ([_, i18nLang]) => i18nLang === currentLanguage
  )?.[0] || 'en-us';
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/${localeCode}${cleanPath}`;
}

// Hook for language-aware navigation
export function useLanguageNavigate() {
  const [, setLocation] = useLocation();
  
  return (path: string) => {
    const localizedPath = getLocalizedPath(path);
    setLocation(localizedPath);
  };
}