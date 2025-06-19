import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

// Check if we're in a domain-restricted environment
const isProduction = window.location.hostname === 'finanzerpro.com';
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('replit.dev');

if (!isProduction && isDevelopment) {
  // For development environments with production keys, render app without Clerk
  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Development Mode</h3>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                Running with production authentication keys. Authentication features are disabled in development.
              </p>
            </div>
            <App />
          </div>
        </div>
      </Router>
    </QueryClientProvider>
  );
} else {
  // Production environment with proper domain
  createRoot(document.getElementById("root")!).render(
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/auth"
    >
      <QueryClientProvider client={queryClient}>
        <Router>
          <App />
        </Router>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
