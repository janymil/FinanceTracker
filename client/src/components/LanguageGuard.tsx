import { useEffect, useState } from 'react';
import { useLocation, useParams, Router } from 'wouter';
import { AuthenticatedApp } from '../App';
import i18n from '../i18n/i18n';

const SUPPORTED_LANGS = ['en-us', 'es-pe', 'sk-sk'];

export default function LanguageGuard() {
  const params = useParams();
  const [location] = useLocation();
  const [ready, setReady] = useState(false);

  const lang = params.lang;

  useEffect(() => {
    if (!lang || !SUPPORTED_LANGS.includes(lang)) {
      // Intelligent language detection and redirect
      const detectLanguageAndRedirect = () => {
        // 1. Try saved user preference first
        const savedLang = localStorage.getItem('preferred-language');
        if (savedLang && SUPPORTED_LANGS.includes(savedLang)) {
          window.location.href = `/${savedLang}/dashboard`;
          return;
        }
        
        // 2. Try browser language mapping
        const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
        const langMap: Record<string, string> = {
          'en': 'en-us',
          'en-US': 'en-us',
          'en-GB': 'en-us',
          'es': 'es-pe',
          'es-PE': 'es-pe', 
          'es-ES': 'es-pe',
          'es-MX': 'es-pe',
          'sk': 'sk-sk',
          'sk-SK': 'sk-sk'
        };
        
        // Try direct mapping first, then try language prefix
        const mappedLang = langMap[browserLang] || langMap[browserLang.split('-')[0]] || 'en-us';
        
        // Save the detected language as preference
        localStorage.setItem('preferred-language', mappedLang);
        
        // Redirect to the detected/mapped language
        window.location.href = `/${mappedLang}/dashboard`;
      };
      
      detectLanguageAndRedirect();
      return;
    }

    console.log('LanguageGuard: Changing language to:', lang);
    // Change i18next language and wait for it to complete before rendering
    i18n.changeLanguage(lang).then(() => {
      console.log('LanguageGuard: Language changed successfully to:', i18n.language);
      console.log('LanguageGuard: Test translation Dashboard:', i18n.t('Dashboard'));
      setReady(true);
    }).catch(error => {
      console.error('LanguageGuard: Error changing language:', error);
      setReady(true); // Still render to avoid infinite loading
    });
  }, [lang]);

  if (!lang || !SUPPORTED_LANGS.includes(lang)) {
    return null;
  }

  // Wait for translations to load before rendering
  if (!ready) {
    return <div>Loading translations...</div>;
  }

  // Strip lang prefix from path so inner routes work
  const basePath = `/${lang}`;
  const subPath = location.replace(`${basePath}`, '') || '/dashboard';

  return (
    <Router base={basePath}>
      <AuthenticatedApp />
    </Router>
  );
}

export function getLocalizedPath(path: string): string {
  const currentLanguage = i18n.language;
  const localeCode = currentLanguage || 'en-us';
  return `/${localeCode}${path}`;
}

export function useLanguageNavigate() {
  return (path: string) => {
    const localizedPath = getLocalizedPath(path);
    window.location.href = localizedPath;
  };
}