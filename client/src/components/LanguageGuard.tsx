import { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Redirect } from 'wouter';
import i18n from '../i18n/i18n';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Switch, Route } from 'wouter';
import Landing from '../pages/landing';
import AuthPage from '../pages/auth-page';
import Pricing from '../pages/pricing';
import PrivacyPolicy from '../pages/privacy-policy';
import TermsOfService from '../pages/terms-of-service';
import CookiePolicy from '../pages/cookie-policy';
import Contact from '../pages/contact';
import Help from '../pages/help';
import NotFoundPage from '../pages/not-found';

// Import AuthenticatedApp directly now that it's exported
import { AuthenticatedApp } from '../App';

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
    window.location.href = "/en-us/dashboard";
    return null;
  }

  // Strip the lang and pass the remaining route to AuthenticatedApp
  const strippedPath = location.replace(`/${lang}`, '') || '/dashboard';

  console.log('LanguageGuard - strippedPath:', strippedPath);

  return (
    <>
      <SignedIn>
        <AuthenticatedApp basePath={`/${lang}`} subPath={strippedPath} />
      </SignedIn>
      <SignedOut>
        <Switch>
          <Route path="/pricing" component={Pricing} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          <Route path="/terms-of-service" component={TermsOfService} />
          <Route path="/cookie-policy" component={CookiePolicy} />
          <Route path="/contact" component={Contact} />
          <Route path="/help" component={Help} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/" component={Landing} />
          <Route component={NotFoundPage} />
        </Switch>
      </SignedOut>
    </>
  );
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