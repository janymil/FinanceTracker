import { useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
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
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/:lang/*');
  const { i18n } = useTranslation();
  
  useEffect(() => {
    if (match && params?.lang) {
      const lang = params.lang as string;
      
      if (isValidLocale(lang)) {
        // Valid language - switch to it
        const i18nLanguage = LOCALE_MAP[lang];
        if (i18n.language !== i18nLanguage) {
          i18n.changeLanguage(i18nLanguage);
        }
      } else {
        // Invalid language - redirect to default
        const currentPath = window.location.pathname.replace(`/${lang}`, '');
        setLocation(`/en-us${currentPath}`);
        return;
      }
    }
  }, [match, params, i18n, setLocation]);
  
  // Only render children if we have a valid language match
  if (!match || !params?.lang || !isValidLocale(params.lang)) {
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