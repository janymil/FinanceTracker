import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import App from './App.tsx';
import './index.css';
import { clearStaleSession } from './utils/sessionCleanup';
import i18n from './i18n/i18n.js';

// Clear any stale authentication data on app startup
clearStaleSession();

// Get Clerk publishable key
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
console.log('Clerk publishable key loaded:', clerkPubKey?.slice(0, 20) + '...');

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

const root = createRoot(container);
root.render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <HelmetProvider>
        <ClerkProvider publishableKey={clerkPubKey}>
          <QueryClientProvider client={queryClient}>
            <Router>
              <App />
            </Router>
          </QueryClientProvider>
        </ClerkProvider>
      </HelmetProvider>
    </I18nextProvider>
  </StrictMode>
);