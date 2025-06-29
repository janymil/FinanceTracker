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
  // First, always check current browser language
  const browserLang = navigator.language || 'en-US';
  const mainLangCode = browserLang.split('-')[0].toLowerCase();
  
  let browserDetectedLang = 'en'; // Default fallback
  if (mainLangCode === 'en') {
    browserDetectedLang = 'en';
  } else if (mainLangCode === 'es') {
    browserDetectedLang = 'es';
  } else if (mainLangCode === 'sk') {
    browserDetectedLang = 'sk';
  }
  
  // Check if user has a saved language preference
  const savedLang = localStorage.getItem('preferredLanguage');
  const lastDetectedBrowserLang = localStorage.getItem('lastDetectedBrowserLang');
  
  console.log('Browser language detection:', browserLang, '→', browserDetectedLang);
  console.log('Saved language:', savedLang, 'Last detected:', lastDetectedBrowserLang);
  
  // If browser language has changed since last detection, prioritize new browser language
  if (lastDetectedBrowserLang !== browserDetectedLang) {
    console.log('Browser language changed! Updating from', lastDetectedBrowserLang, 'to', browserDetectedLang);
    localStorage.setItem('lastDetectedBrowserLang', browserDetectedLang);
    localStorage.setItem('preferredLanguage', browserDetectedLang);
    return `/${browserDetectedLang}${currentPath}`;
  }
  
  // Use saved preference if available, otherwise use browser detected language
  const preferredLang = (savedLang && ['en', 'es', 'sk'].includes(savedLang)) ? savedLang : browserDetectedLang;
  
  // Update localStorage
  localStorage.setItem('preferredLanguage', preferredLang);
  localStorage.setItem('lastDetectedBrowserLang', browserDetectedLang);
  
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

    // Map URL language codes to i18n language codes
    const langMap: Record<string, string> = {
      'en': 'en-us',
      'es': 'es-pe', 
      'sk': 'sk-sk'
    };
    
    const i18nLang = langMap[lang] || 'en-us';

    // Change language if needed and mark ready
    if (i18n.language !== i18nLang) {
      console.log('LanguageGuard: Changing language from', i18n.language, 'to', i18nLang);
      // Save user's manual language choice
      localStorage.setItem('preferredLanguage', lang);
      i18n.changeLanguage(i18nLang).then(() => {
        console.log('LanguageGuard: Language changed successfully to', i18nLang);
        console.log('LanguageGuard: i18n language is now:', i18n.language);
        console.log('LanguageGuard: Has resources for', i18nLang, ':', i18n.hasResourceBundle(i18nLang, 'translation'));
        
        // Force reload resources if not available
        if (!i18n.hasResourceBundle(i18nLang, 'translation')) {
          console.log('LanguageGuard: Missing resources, reloading...');
          i18n.reloadResources(i18nLang).then(() => {
            console.log('LanguageGuard: Resources reloaded for', i18nLang);
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
      console.log('LanguageGuard: Language already set to', i18nLang);
      console.log('LanguageGuard: Has resources for', i18nLang, ':', i18n.hasResourceBundle(i18nLang, 'translation'));
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