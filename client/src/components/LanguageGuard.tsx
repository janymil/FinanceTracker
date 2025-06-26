import { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Redirect } from 'wouter';
import i18n from '../i18n/i18n';

const SUPPORTED_LANGUAGES = ['en-us', 'es-pe', 'sk-sk'];

export default function LanguageGuard() {
  const params = useParams();
  const { lang } = params;
  const [location] = useLocation();

  console.log('LanguageGuard - lang:', lang, 'location:', location);

  useEffect(() => {
    if (lang && SUPPORTED_LANGUAGES.includes(lang)) {
      i18n.changeLanguage(lang);
    }
  }, [lang]);

  // Redirect invalid lang to /en-us
  if (!lang || !SUPPORTED_LANGUAGES.includes(lang)) {
    return <Redirect to="/en-us/dashboard" />;
  }

  // Strip the lang and pass the remaining route to AuthenticatedApp
  const strippedPath = location.replace(`/${lang}`, '') || '/dashboard';

  console.log('LanguageGuard - strippedPath:', strippedPath);

  // For now, just return null to prevent errors - we'll need to properly implement AuthenticatedApp with props
  return null;
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