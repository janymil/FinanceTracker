import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { detectLanguageAndRedirect } from '../i18n/languageDetector.ts';

interface LanguageGuardProps {
  children: React.ReactNode;
}

export default function LanguageGuard({ children }: LanguageGuardProps) {
  const [location] = useLocation();
  const { i18n } = useTranslation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const pathParts = location.split('/').filter(Boolean);
    const lang = pathParts[0];

    console.log('LanguageGuard: URL path:', location);
    console.log('LanguageGuard: Detected lang from URL:', lang);
    console.log('LanguageGuard: Current i18n language:', i18n.language);

    // If no language in URL, detect and redirect
    if (!lang || !['en-us', 'es-pe', 'sk-sk'].includes(lang)) {
      console.log('LanguageGuard: No valid language in URL, redirecting...');
      detectLanguageAndRedirect();
      return;
    }

    // Change language if needed and mark ready
    if (i18n.language !== lang) {
      console.log('LanguageGuard: Changing language from', i18n.language, 'to', lang);
      i18n.changeLanguage(lang).then(() => {
        console.log('LanguageGuard: Language changed successfully to', lang);
        console.log('LanguageGuard: i18n language is now:', i18n.language);
        console.log('LanguageGuard: Has resources for', lang, ':', i18n.hasResourceBundle(lang, 'translation'));
        console.log('LanguageGuard: Test translation Dashboard:', i18n.t('Dashboard'));
        console.log('LanguageGuard: Test translation Transactions:', i18n.t('Transactions'));
        
        // Force reload resources if not available
        if (!i18n.hasResourceBundle(lang, 'translation')) {
          console.log('LanguageGuard: Missing resources, reloading...');
          i18n.reloadResources(lang).then(() => {
            console.log('LanguageGuard: Resources reloaded for', lang);
            setReady(true);
          }).catch(error => {
            console.error('LanguageGuard: Error reloading resources:', error);
            setReady(true);
          });
        } else {
          setReady(true);
        }
      }).catch(error => {
        console.error('LanguageGuard: Error changing language:', error);
        setReady(true);
      });
    } else {
      console.log('LanguageGuard: Language already set to', lang);
      console.log('LanguageGuard: Has resources for', lang, ':', i18n.hasResourceBundle(lang, 'translation'));
      setReady(true);
    }
  }, [location, i18n]);

  if (!ready) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;

}

// Helper function for other components
export function getLocalizedPath(path: string): string {
  const currentLang = localStorage.getItem('preferredLanguage') || 'en-us';
  return `/${currentLang}${path.startsWith('/') ? path : `/${path}`}`;
}