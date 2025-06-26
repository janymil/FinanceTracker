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

    // If no language in URL, detect and redirect
    if (!lang || !['en-us', 'es-pe', 'sk-sk'].includes(lang)) {
      detectLanguageAndRedirect();
      return;
    }

    // Change language if needed and mark ready
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang).then(() => {
        setReady(true);
      }).catch(error => {
        console.error('LanguageGuard: Error changing language:', error);
        setReady(true);
      });
    } else {
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