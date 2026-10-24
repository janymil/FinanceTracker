import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { esES, skSK } from '@clerk/localizations';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Router } from 'wouter';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import App from './App.tsx';
import './index.css';
import { clearStaleSession } from './utils/sessionCleanup';
import { installErrorGuard } from './lib/errorGuard';
import i18n from './i18n/i18n';
// Clear any stale authentication data on app startup
clearStaleSession();

// Error Guard (blueprint 07): aggregates failures into "problems" for the admin panel.
// Installed before the first render, so errors thrown during mount are captured.
// This is the app's only error reporter — there is no Sentry in this project.
installErrorGuard();

// Installable app + offline page (see client/public/sw.js, which caches nothing but the
// offline page). Production only: in development a service worker only gets in the way.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker not registered:', error);
    });
  });
}

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
  
  // Always redirect to dashboard after authentication
  const dashboardUrl = `/${currentLang}/dashboard`;
  console.log('Redirecting authenticated user to dashboard:', dashboardUrl);
  return dashboardUrl;
}

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

// One client for the whole app: components that invalidate caches, and the logout that clears
// them, import this same instance from lib/queryClient.

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
const dashboardRedirectUrl = processClerkRedirect('/dashboard');

// Custom Slovak localization with missing terms
const customSlovak = {
  ...skSK,
  signUp: {
    ...(skSK.signUp || {}),
    legalConsent: {
      ...(skSK.signUp?.legalConsent || {}),
      checkbox: {
        label__onlyPrivacyPolicy: 'Súhlasím so {{ privacyPolicyLink || link("zásadami ochrany osobných údajov") }}',
        label__onlyTermsOfService: 'Súhlasím s {{ termsOfServiceLink || link("obchodnými podmienkami") }}',
        label__termsOfServiceAndPrivacyPolicy: 'Súhlasím s {{ termsOfServiceLink || link("obchodnými podmienkami") }} a {{ privacyPolicyLink || link("zásadami ochrany osobných údajov") }}'
      },
      continue: {
        subtitle: 'Pokračovaním súhlasíte s našimi zásadami.',
        title: 'Zákonné súhlasy'
      }
    }
  }
};

// Dynamic Clerk localization based on saved preference or browser language
const savedLanguage = localStorage.getItem('preferredLanguage') || '';
const browserLanguage = navigator.language || 'en-US';

// Determine localization based on saved preference or browser language
let localization;
if (savedLanguage.startsWith('es') || browserLanguage.startsWith('es')) {
  localization = esES;
} else if (savedLanguage.startsWith('sk') || browserLanguage.startsWith('sk')) {
  localization = customSlovak;
} else {
  localization = undefined; // English default
}

console.log('Clerk localization set based on:', { savedLanguage, browserLanguage, localization: localization?.signIn?.start?.title || 'English' });

const root = createRoot(container);
root.render(
  <I18nextProvider i18n={i18n}>
    <HelmetProvider>
      <ClerkProvider 
        publishableKey={clerkPubKey}
        signInFallbackRedirectUrl={dashboardRedirectUrl}
        signUpFallbackRedirectUrl={dashboardRedirectUrl}
        afterSignInUrl={dashboardRedirectUrl}
        afterSignUpUrl={dashboardRedirectUrl}
        localization={localization}
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