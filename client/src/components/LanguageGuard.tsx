import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { detectLanguageAndRedirect } from '../i18n/languageDetector.ts';

interface LanguageGuardProps {
  children: React.ReactNode;
}

// Helper function to get language-prefixed path without causing page reloads
function getLanguagePrefixedPath(currentPath: string): string | null {
  // Check if URL has old locale-specific format and convert to simplified
  const oldLangMatch = currentPath.match(/^\/([a-z]{2}-[a-z]{2})\//);
  if (oldLangMatch) {
    const oldLang = oldLangMatch[1];
    const langMap: Record<string, string> = {
      'en-us': 'en',
      'es-pe': 'es',
      'sk-sk': 'sk'
    };
    const newLang = langMap[oldLang];
    if (newLang) {
      return currentPath.replace(`/${oldLang}/`, `/${newLang}/`);
    }
  }
  
  // Check if already has simplified language prefix
  const hasLangPrefix = /^\/([a-z]{2})\//.test(currentPath);
  if (hasLangPrefix) {
    return null;
  }
  
  // Detect preferred language (use simplified codes)
  let preferredLang = localStorage.getItem('preferredLanguage');
  
  if (!preferredLang || !['en', 'es', 'sk'].includes(preferredLang)) {
    // Try browser language with dynamic mapping
    const browserLang = navigator.language || 'en-US';
    
    // Extract the main language code (e.g., 'en' from 'en-GB', 'es' from 'es-MX')
    const mainLangCode = browserLang.split('-')[0].toLowerCase();
    
    // Map to our supported simplified codes
    if (mainLangCode === 'en') {
      preferredLang = 'en';
    } else if (mainLangCode === 'es') {
      preferredLang = 'es';
    } else if (mainLangCode === 'sk') {
      preferredLang = 'sk';
    } else {
      preferredLang = 'en'; // Default fallback
    }
    
    localStorage.setItem('preferredLanguage', preferredLang);
  }
  
  // Return the language-prefixed URL
  return `/${preferredLang}${currentPath}`;
}

export default function LanguageGuard({ children }: LanguageGuardProps) {
  const [location, setLocation] = useLocation();
  const { i18n } = useTranslation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const pathParts = location.split('/').filter(Boolean);
    const lang = pathParts[0];

    console.log('LanguageGuard: URL path:', location);
    console.log('LanguageGuard: Detected lang from URL:', lang);
    console.log('LanguageGuard: Current i18n language:', i18n.language);

    // If no language in URL, detect and redirect using client-side navigation
    if (!lang || !['en', 'es', 'sk'].includes(lang)) {
      console.log('LanguageGuard: No valid language in URL, redirecting...');
      const newPath = getLanguagePrefixedPath(location);
      if (newPath && newPath !== location) {
        console.log('LanguageGuard: Client-side redirect to:', newPath);
        setLocation(newPath);
        return;
      }
    }

    // Change language if needed and mark ready
    if (i18n.language !== lang) {
      console.log('LanguageGuard: Changing language from', i18n.language, 'to', lang);
      i18n.changeLanguage(lang).then(() => {
        console.log('LanguageGuard: Language changed successfully to', lang);
        console.log('LanguageGuard: i18n language is now:', i18n.language);
        console.log('LanguageGuard: Has resources for', lang, ':', i18n.hasResourceBundle(lang, 'translation'));
        
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
  const currentLang = localStorage.getItem('preferredLanguage') || 'en';
  return `/${currentLang}${path.startsWith('/') ? path : `/${path}`}`;
}