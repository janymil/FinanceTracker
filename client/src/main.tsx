import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import { esES } from '@clerk/localizations';
import { skSK } from '@clerk/localizations';
import App from './App.tsx';
import './index.css';
import { clearStaleSession } from './utils/sessionCleanup';
import i18n from './i18n/i18n';
// Clear any stale authentication data on app startup
clearStaleSession();

// Simple browser language detection function
function detectLanguageFromBrowser(): string {
  const browserLang = navigator.language || 'en-US';
  const mainLangCode = browserLang.split('-')[0].toLowerCase();
  
  // Map to supported language codes
  if (mainLangCode === 'es') return 'es-pe';
  if (mainLangCode === 'sk') return 'sk-sk';
  return 'en-us';
}

// Get Clerk publishable key
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
console.log('Clerk publishable key loaded:', clerkPubKey?.slice(0, 20) + '...');

// Function to process Clerk redirects with language awareness
function processClerkRedirect(url: string): string {
  console.log('Processing Clerk redirect:', url);
  
  // If URL already has language prefix, return as-is
  if (/^\/[a-z]{2}\//.test(url)) {
    console.log('URL already has language prefix:', url);
    return url;
  }
  
  // Get saved language preference or default to browser language
  const savedLang = localStorage.getItem('preferredLanguage');
  const browserLang = navigator.language.toLowerCase().split('-')[0];
  const supportedLangs = ['en', 'es', 'sk'];
  
  const currentLang = savedLang && supportedLangs.includes(savedLang) ? savedLang : 
    (supportedLangs.includes(browserLang) ? browserLang : 'en');
  
  // For root path or common auth redirects, redirect to dashboard with language
  if (url === '/' || url === '/dashboard' || url === '') {
    const dashboardUrl = `/${currentLang}/dashboard`;
    console.log('Redirecting to language-aware dashboard:', dashboardUrl);
    return dashboardUrl;
  }
  
  // For other paths, add language prefix
  const languageAwareUrl = `/${currentLang}${url.startsWith('/') ? url : '/' + url}`;
  console.log('Adding language prefix:', languageAwareUrl);
  return languageAwareUrl;
}

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,
      gcTime: 0,
    },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

// Get user's language preference for redirect URLs
const getUserLanguage = (): string => {
  const savedLanguage = localStorage.getItem('preferredLanguage');
  const detectedLanguage = detectLanguageFromBrowser();
  const initialLanguage = savedLanguage || detectedLanguage || 'en-us';
  
  // Convert to simplified language code
  if (initialLanguage.startsWith('es')) return 'es';
  if (initialLanguage.startsWith('sk')) return 'sk';
  return 'en';
};

const userLanguage = getUserLanguage();
const dashboardRedirectUrl = `/${userLanguage}/dashboard`;

// Get language-aware URLs for terms and privacy policy
const getLanguageAwareUrls = () => {
  const urlPath = window.location.pathname;
  const urlLang = urlPath.match(/^\/([a-z]{2})\//)?.[1];
  const savedLanguage = localStorage.getItem('preferredLanguage');
  const browserLanguage = detectLanguageFromBrowser();
  
  const currentLang = urlLang || savedLanguage || browserLanguage;
  const lang = currentLang === 'es' || currentLang?.startsWith('es') ? 'es' :
               currentLang === 'sk' || currentLang?.startsWith('sk') ? 'sk' : 'en';
  
  return {
    termsOfServiceUrl: `/${lang}/terms-of-service`,
    privacyPolicyUrl: `/${lang}/privacy-policy`,
  };
};

// Get Clerk localization based on user language
const getClerkLocalization = () => {
  // Get language from URL path first, then localStorage, then browser
  const urlPath = window.location.pathname;
  const urlLang = urlPath.match(/^\/([a-z]{2})\//)?.[1];
  const savedLanguage = localStorage.getItem('preferredLanguage');
  const browserLanguage = detectLanguageFromBrowser();
  
  // Priority: URL > localStorage > browser
  const currentLang = urlLang || savedLanguage || browserLanguage;
  
  console.log('Clerk localization detection:', { urlLang, savedLanguage, browserLanguage, currentLang });
  
  if (currentLang === 'es' || currentLang?.startsWith('es')) {
    console.log('Using Spanish localization for Clerk');
    return esES;
  } 
  // Temporarily disable Slovak localization to test form display
  // else if (currentLang === 'sk' || currentLang?.startsWith('sk')) {
  //   console.log('Using Slovak localization for Clerk');
  //   return skSK;
  // }
  console.log('Using English (default) localization for Clerk');
  return undefined; // English is default
};

const languageAwareUrls = getLanguageAwareUrls();

const root = createRoot(container);
root.render(
  <I18nextProvider i18n={i18n}>
    <HelmetProvider>
      <ClerkProvider 
        publishableKey={clerkPubKey}
        afterSignInUrl={dashboardRedirectUrl}
        afterSignUpUrl={dashboardRedirectUrl}
        localization={getClerkLocalization()}
        appearance={{
          layout: {
            logoImageUrl: '/icon.png',
            showOptionalFields: false,
          }
        }}
      >
        <QueryClientProvider client={queryClient}>
          <Router>
            <App />
          </Router>
        </QueryClientProvider>
      </ClerkProvider>
    </HelmetProvider>
  </I18nextProvider>
);