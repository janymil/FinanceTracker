import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";

import { Switch, Route, useLocation, useRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import LanguageGuard from "@/components/LanguageGuard";
import { ErrorBoundary } from "react-error-boundary";
import { ScrollToTop } from "@/components/scroll-to-top";
import { useState, useEffect } from "react";
import React from "react";
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut, useClerk, useUser } from "@clerk/clerk-react";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";
import { detectIncognito, showIncognitoWarning } from "@/utils/incognito-detection";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { ThemeProvider } from "@/context/ThemeContext";

// Core components loaded immediately
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import { Footer } from "@/components/footer";
import { CookieBanner } from "@/components/cookie-banner";
import { FinancialMascot } from "@/components/financial-mascot";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";

// Other components loaded on demand
import AuthPage from "@/pages/auth-page";
import { signInUrl } from "@/lib/authRedirect";
import { useAutoTimeZone } from "@/hooks/useAutoTimeZone";
import { FirstRunWelcome } from "@/components/FirstRunWelcome";
import TransactionsPage from "@/pages/transactions";
import IncomePage from "@/pages/income";
import ExpensesPage from "@/pages/expenses";
import BudgetPage from "@/pages/budget";
import CategoriesPage from "@/pages/categories";
import GoalsPage from "@/pages/goals";
import CollaborativeGoalsPage from "@/pages/collaborative-goals";
import CollaborativeGoalDetailPage from "./pages/collaborative-goal-detail";
import TrendsPage from "@/pages/trends";
import CalendarPage from "@/pages/calendar";
import ReportsPage from "@/pages/reports";
import ExportPage from "@/pages/export";
import CoursesPage from "@/pages/Courses";
import SubscribePage from "@/pages/subscribe";
import Pricing from "@/pages/pricing";
import TermsOfService from "@/pages/terms-of-service";
import PrivacyPolicy from "@/pages/privacy-policy";
import CookiePolicy from "@/pages/cookie-policy";
import Reclamaciones from "@/pages/reclamaciones";
import Contact from "@/pages/contact";
import Help from "@/pages/help";
import NotFoundPage from "./pages/not-found";
import ProfilePage from "./pages/profile";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminWatch from "@/pages/admin-watch";
import MobileUpload from "@/pages/mobile-upload/sessionId";
import RedeemPage from "@/pages/redeem";
import FeaturesPage from "@/pages/features";


// Optimized loading state
const AppLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-300">Loading Kaptia...</p>
    </div>
  </div>
);

// Last-resort fallback so a single broken component never blanks the whole app
function AppErrorFallback({ error, resetErrorBoundary }: { error: any; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-md w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center shadow-xl">
        <div className="mx-auto h-12 w-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <span className="text-2xl" role="img" aria-label="Warning">!</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          The page hit an unexpected error. Your data is safe - try again or reload the page.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Reload
          </button>
        </div>
        {import.meta.env.DEV && error ? (
          <pre className="mt-4 max-h-32 overflow-auto text-left text-xs bg-gray-100 dark:bg-gray-900 text-red-600 dark:text-red-400 rounded p-3 whitespace-pre-wrap">
            {String(error?.message || error)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function Router() {
  // Track page views when routes change
  useAnalytics();
  
  return (
    <LanguageGuard>
      <Switch>
        {/* Language-prefixed routes */}
        <Route path="/:lang/dashboard" component={AuthenticatedApp} />
        <Route path="/:lang/transactions" component={AuthenticatedApp} />
        <Route path="/:lang/income" component={AuthenticatedApp} />
        <Route path="/:lang/expenses" component={AuthenticatedApp} />
        <Route path="/:lang/budget" component={AuthenticatedApp} />
        <Route path="/:lang/categories" component={AuthenticatedApp} />
        <Route path="/:lang/goals" component={AuthenticatedApp} />
        <Route path="/:lang/collaborative-goals" component={AuthenticatedApp} />
        <Route path="/:lang/collaborative-goals/:id" component={AuthenticatedApp} />
        <Route path="/:lang/trends" component={AuthenticatedApp} />
        <Route path="/:lang/calendar" component={AuthenticatedApp} />
        <Route path="/:lang/reports" component={AuthenticatedApp} />
        <Route path="/:lang/export" component={AuthenticatedApp} />
        <Route path="/:lang/courses" component={AuthenticatedApp} />
        <Route path="/:lang/profile" component={AuthenticatedApp} />
        <Route path="/:lang/subscribe" component={AuthenticatedApp} />
        <Route path="/:lang/redeem" component={AuthenticatedApp} />
        <Route path="/:lang/admin-analytics" component={AuthenticatedApp} />
        <Route path="/:lang/admin-watch" component={AuthenticatedApp} />
        
        {/* Public pages with language prefix */}
        <Route path="/:lang/features" component={FeaturesPage} />
        <Route path="/:lang/pricing" component={Pricing} />
        <Route path="/:lang/terms" component={TermsOfService} />
        <Route path="/:lang/terms-of-service" component={TermsOfService} />
        <Route path="/:lang/privacy" component={PrivacyPolicy} />
        <Route path="/:lang/privacy-policy" component={PrivacyPolicy} />
        <Route path="/:lang/cookies" component={CookiePolicy} />
        <Route path="/:lang/cookie-policy" component={CookiePolicy} />
        <Route path="/:lang/reclamaciones" component={Reclamaciones} />
        <Route path="/:lang/contact" component={Contact} />
        <Route path="/:lang/help" component={Help} />
        <Route path="/:lang/auth" component={AuthPage} />
        <Route path="/:lang" component={Landing} />
        
        {/* Default route - redirect to user's language */}
        <Route path="/" component={() => { 
          const [, setLocation] = useLocation();
          const { isSignedIn } = useUser();
          
          React.useEffect(() => {
            // Get saved language or use browser language
            const savedLang = localStorage.getItem('preferredLanguage');
            const browserLang = navigator.language.toLowerCase().split('-')[0];
            const supportedLangs = ['en', 'es', 'sk'];
            
            const targetLang = savedLang && supportedLangs.includes(savedLang) 
              ? savedLang 
              : supportedLangs.includes(browserLang) 
                ? browserLang 
                : 'en';
            
            console.log('Root route redirect:', { isSignedIn, targetLang });
            
            // Redirect to appropriate page based on auth status
            if (isSignedIn) {
              console.log('Redirecting signed-in user to dashboard');
              setLocation(`/${targetLang}/dashboard`);
            } else {
              console.log('Redirecting unsigned user to landing');
              setLocation(`/${targetLang}`);
            }
          }, [setLocation, isSignedIn]);
          
          return <AppLoader />; 
        }} />
        
        {/* Mobile upload - special case without language prefix */}
        <Route path="/mobile-upload/:sessionId" component={MobileUpload} />
        
        {/* 404 page */}
        <Route path="*" component={NotFoundPage} />
      </Switch>
    </LanguageGuard>
  );
}

function AppContent() {
  const clerk = useClerk();

  // Initialize session persistence
  useSessionPersistence();

  // Wait for Clerk to be loaded before rendering anything
  if (!clerk.loaded) {
    return <AppLoader />;
  }

  return (
    <>
      <ScrollToTop />
      <ErrorBoundary
        FallbackComponent={AppErrorFallback}
        onError={(error, info) => console.error('Unhandled app error:', error, info)}
      >
        <Router />
      </ErrorBoundary>
      <SignedOut>
        <CookieBanner />
      </SignedOut>
    </>
  );
}

export function AuthenticatedApp() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const [currentPath, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Refresh caches when another tab changes transactions, budgets or goals.
  useRealtimeUpdates();

  // Keep the language prefix when bouncing an anonymous visitor to sign-in
  const currentLang = currentPath.match(/^\/([a-z]{2})(\/|$)/)?.[1] || 'en';

  // The time zone decides where "this month" starts, so a new account gets the device's.
  useAutoTimeZone();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // Come back to the page they asked for once they are signed in.
      setLocation(signInUrl(currentLang, `${window.location.pathname}${window.location.search}`));
    }
  }, [isLoaded, isSignedIn, currentLang, setLocation]);

  // Wait for Clerk to resolve the session before rendering the app shell
  if (!isLoaded || !clerkUser) {
    return <AppLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <FirstRunWelcome />
      <Header 
        onMenuClick={() => setSidebarOpen(true)} 
        sidebarCollapsed={sidebarCollapsed}
      />
      <div className="flex">
        <Sidebar 
          isOpen={sidebarOpen} 
          setIsOpen={setSidebarOpen}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
        />
        <main className={cn(
          "flex-1 transition-all duration-300 pt-16 min-w-0",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}>
          <div className="p-3 sm:p-6 max-w-full overflow-x-hidden">
            <Switch>
              {/* Language-prefixed routes */}
              <Route path="/:lang/dashboard" component={Dashboard} />
              <Route path="/:lang/transactions" component={TransactionsPage} />
              <Route path="/:lang/income" component={IncomePage} />
              <Route path="/:lang/expenses" component={ExpensesPage} />
              <Route path="/:lang/budget" component={BudgetPage} />
              <Route path="/:lang/categories" component={CategoriesPage} />
              <Route path="/:lang/goals" component={GoalsPage} />
              <Route path="/:lang/collaborative-goals" component={CollaborativeGoalsPage} />
              <Route path="/:lang/collaborative-goals/:id" component={CollaborativeGoalDetailPage} />
              <Route path="/:lang/calendar" component={CalendarPage} />
              <Route path="/:lang/trends" component={TrendsPage} />
              <Route path="/:lang/reports" component={ReportsPage} />
              <Route path="/:lang/export" component={ExportPage} />
              <Route path="/:lang/courses" component={CoursesPage} />
              <Route path="/:lang/subscribe" component={SubscribePage} />
              <Route path="/:lang/redeem" component={RedeemPage} />
              <Route path="/:lang/profile" component={ProfilePage} />
              <Route path="/:lang/admin-analytics" component={AdminAnalytics} />
              <Route path="/:lang/admin-watch" component={AdminWatch} />
              
              {/* Public pages with language prefix for authenticated users */}
              <Route path="/:lang/features" component={FeaturesPage} />
              <Route path="/:lang/pricing" component={Pricing} />
              <Route path="/:lang/terms" component={TermsOfService} />
              <Route path="/:lang/terms-of-service" component={TermsOfService} />
              <Route path="/:lang/privacy" component={PrivacyPolicy} />
              <Route path="/:lang/privacy-policy" component={PrivacyPolicy} />
              <Route path="/:lang/cookies" component={CookiePolicy} />
              <Route path="/:lang/cookie-policy" component={CookiePolicy} />
              <Route path="/:lang/reclamaciones" component={Reclamaciones} />
              <Route path="/:lang/contact" component={Contact} />
              <Route path="/:lang/help" component={Help} />
              
              {/* Default route */}
              <Route path="/" component={Dashboard} />

              <Route component={NotFoundPage} />
            </Switch>
          </div>
        </main>
      </div>
      <Footer sidebarCollapsed={sidebarCollapsed} />
      <FinancialMascot />
      <CookieBanner />
    </div>
  );
}

export default function App() {
  // Analytics + incognito check. initGA() is a no-op until the visitor accepts
  // analytics in the cookie banner, so this is safe to run on every load.
  useEffect(() => {
    initGA();

    // Check for incognito mode and show warning if detected
    detectIncognito().then(isIncognito => {
      if (isIncognito) {
        showIncognitoWarning();
      }
    });
  }, []);

  return (
    <ThemeProvider>
      <CurrencyProvider>
        <AppContent />
        <Toaster />
      </CurrencyProvider>
    </ThemeProvider>
  );
}