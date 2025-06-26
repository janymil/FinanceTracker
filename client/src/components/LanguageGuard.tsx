import { useEffect } from 'react';
import { useLocation, useParams, Router } from 'wouter';
import { AuthenticatedApp } from '../App';
import i18n from '../i18n/i18n';

const SUPPORTED_LANGS = ['en-us', 'es-pe', 'sk-sk'];

export default function LanguageGuard() {
  const params = useParams();
  const [location] = useLocation();

  const lang = params.lang;

  useEffect(() => {
    if (lang && SUPPORTED_LANGS.includes(lang)) {
      i18n.changeLanguage(lang);
    }
  }, [lang]);

  if (!lang || !SUPPORTED_LANGS.includes(lang)) {
    window.location.href = '/en-us/dashboard';
    return null;
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