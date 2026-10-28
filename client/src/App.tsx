import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";

import { Switch, Route, useLocation, useRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import LanguageGuard from "@/components/LanguageGuard";
import { ErrorBoundary } from "react-error-boundary";
import { ScrollToTop } from "@/components/scroll-to-top";
import { BackToTopButton } from "@/components/back-to-top-button";
import { useState, useEffect, lazy, Suspense } from "react";
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
import { MobileBottomNav } from "@/components/MobileBottomNav";

// The two pages that must paint immediately: an anonymous visitor lands here, and every
// signed-in session starts on the dashboard.
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";

import { signInUrl } from "@/lib/authRedirect";
import { useAutoTimeZone } from "@/hooks/useAutoTimeZone";
import { FirstRunWelcome } from "@/components/FirstRunWelcome";

// Everything else is its own chunk, fetched the first time its route is opened. Before
// this every visitor downloaded all 31 pages (admin screens included) in one ~850 kB
// entry before seeing anything, and the chart library was preloaded on the landing page.
// See `Route` below: each of these is rendered inside the Suspense boundaries in `Router`
// and `AuthenticatedApp`, so the header/sidebar stay put while a page chunk arrives.
const AuthPage = lazy(() => import("@/pages/auth-page"));
const TransactionsPage = lazy(() => import("@/pages/transactions"));
const IncomePage = lazy(() => import("@/pages/income"));
const ExpensesPage = lazy(() => import("@/pages/expenses"));
const BudgetPage = lazy(() => import("@/pages/budget"));
const CategoriesPage = lazy(() => import("@/pages/categories"));
const GoalsPage = lazy(() => import("@/pages/goals"));
const CollaborativeGoalsPage = lazy(() => import("@/pages/collaborative-goals"));
const CollaborativeGoalDetailPage = lazy(() => import("./pages/collaborative-goal-detail"));
const TrendsPage = lazy(() => import("@/pages/trends"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const ExportPage = lazy(() => import("@/pages/export"));
const CoursesPage = lazy(() => import("@/pages/Courses"));
const SubscribePage = lazy(() => import("@/pages/subscribe"));
const Pricing = lazy(() => import("@/pages/pricing"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const CookiePolicy = lazy(() => import("@/pages/cookie-policy"));
const Reclamaciones = lazy(() => import("@/pages/reclamaciones"));
const RefundPolicy = lazy(() => import("@/pages/refund-policy"));
const Contact = lazy(() => import("@/pages/contact"));
const Help = lazy(() => import("@/pages/help"));
const NotFoundPage = lazy(() => import("./pages/not-found"));
const ProfilePage = lazy(() => import("./pages/profile"));
const AdminAnalytics = lazy(() => import("@/pages/admin-analytics"));
const AdminWatch = lazy(() => import("@/pages/admin-watch"));
const MobileUpload = lazy(() => import("@/pages/mobile-upload/sessionId"));
const RedeemPage = lazy(() => import("@/pages/redeem"));
const FeaturesPage = lazy(() => import("@/pages/features"));

// Optimized loading state
//
// The crash screen and this loader are the two places that must work when everything else is
// broken, so they do not call `useTranslation`: a failure inside the translation provider would
// leave a blank page with no sentence at all. They read the language from the URL (or the stored
// choice) and use their own three short lines.
const BOOT_COPY = {
  en: {
    loading: 'Loading Kaptia…',
    title: 'Something went wrong',
    body: 'The page hit an unexpected error. Your data is safe — try again or reload the page.',
    retry: 'Try again',
    reload: 'Reload',
  },
  es: {
    loading: 'Cargando Kaptia…',
    title: 'Algo ha salido mal',
    body: 'La página ha encontrado un error inesperado. Tus datos están a salvo: inténtalo de nuevo o recarga la página.',
    retry: 'Reintentar',
    reload: 'Recargar',
  },
  sk: {
    loading: 'Načítava sa Kaptia…',
    title: 'Niečo sa pokazilo',
    body: 'Stránka narazila na neočakávanú chybu. Tvoje údaje sú v bezpečí — skús to znova alebo obnov stránku.',
    retry: 'Skúsiť znova',
    reload: 'Obnoviť',
  },
} as const;

function bootCopy() {
  let language = 'en';
  try {
    language =
      window.location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] ||
      localStorage.getItem('preferredLanguage') ||
      'en';
  } catch {
    /* storage can be blocked; English is the fallback */
  }
  return BOOT_COPY[(language as keyof typeof BOOT_COPY) in BOOT_COPY ? (language as keyof typeof BOOT_COPY) : 'en'];
}

const AppLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-300">{bootCopy().loading}</p>
    </div>
  </div>
);

// Page-level fallback: when a route chunk is still arriving the shell (header, sidebar) is
// already on screen, so only the content area shows a spinner instead of the whole viewport.
const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center" data-testid="page-loader">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
  </div>
);

// Last-resort fallback so a single broken component never blanks the whole app
function AppErrorFallback({ error, resetErrorBoundary }: { error: any; resetErrorBoundary: () => void }) {
  const copy = bootCopy();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-md w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center shadow-xl">
        <div className="mx-auto h-12 w-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <span className="text-2xl" role="img" aria-label="Warning">!</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{copy.title}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          {copy.body}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            {copy.retry}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {copy.reload}
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
      <Suspense fallback={<AppLoader />}>
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

          <Route path="/:lang/refund-policy" component={RefundPolicy} />

          <Route path="/:lang/refunds" component={RefundPolicy} />
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

          {/* Mobile upload — the page a phone opens after scanning the receipt QR code.
              Two shapes on purpose: the QR encodes the language-prefixed one (what the router
              knows how to render), and the unprefixed one stays for codes drawn before that and
              for anything a person types. `LanguageGuard` leaves both alone, see
              `isLanguageFreePath`. */}
          <Route path="/:lang/mobile-upload/:sessionId" component={MobileUpload} />
          <Route path="/mobile-upload/:sessionId" component={MobileUpload} />

          {/* 404 page */}
          <Route path="*" component={NotFoundPage} />
        </Switch>
      </Suspense>
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
      <BackToTopButton />
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
            <Suspense fallback={<PageLoader />}>
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

                <Route path="/:lang/refund-policy" component={RefundPolicy} />

                <Route path="/:lang/refunds" component={RefundPolicy} />
                <Route path="/:lang/contact" component={Contact} />
                <Route path="/:lang/help" component={Help} />

                {/* Default route */}
                <Route path="/" component={Dashboard} />

                <Route component={NotFoundPage} />
              </Switch>
            </Suspense>
          </div>
        </main>
      </div>
      <Footer sidebarCollapsed={sidebarCollapsed} />
      {/* Room for the phone's bottom bar, so the footer is not hidden under it. */}
      <div className="h-[68px] lg:hidden" aria-hidden="true" />
      <MobileBottomNav onMore={() => setSidebarOpen(true)} />
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