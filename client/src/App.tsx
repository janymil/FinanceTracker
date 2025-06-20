import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { useState, useEffect, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut, useClerk, useUser } from "@clerk/clerk-react";
import { initGA } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";

// Core components loaded immediately
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import { Footer } from "@/components/footer";
import { CookieBanner } from "@/components/cookie-banner";
import { FinancialMascot } from "@/components/financial-mascot";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";

// Essential transaction pages - load immediately for core functionality
import TransactionsPage from "@/pages/transactions";
import IncomePage from "@/pages/income";
import ExpensesPage from "@/pages/expenses";
import RedeemPage from "@/pages/redeem";

// Secondary features - lazy loaded
const BudgetPage = lazy(() => import("@/pages/budget"));
const CategoriesPage = lazy(() => import("@/pages/categories"));
const GoalsPage = lazy(() => import("@/pages/goals"));
const CollaborativeGoalsPage = lazy(() => import("@/pages/collaborative-goals"));
const CollaborativeGoalDetailPage = lazy(() => import("./pages/collaborative-goal-detail"));
const ProfilePage = lazy(() => import("./pages/profile"));

// Analytics and reporting - lazy loaded
const TrendsPage = lazy(() => import("@/pages/trends"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const ExportPage = lazy(() => import("@/pages/export"));

// Admin and heavy features - lazy loaded
const AdminAnalytics = lazy(() => import("@/pages/admin-analytics"));
const MobileUpload = lazy(() => import("@/pages/mobile-upload/sessionId"));

// Marketing and legal pages - lazy loaded
const SubscribePage = lazy(() => import("@/pages/subscribe"));
const Pricing = lazy(() => import("@/pages/pricing"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const CookiePolicy = lazy(() => import("@/pages/cookie-policy"));
const Contact = lazy(() => import("@/pages/contact"));
const Help = lazy(() => import("@/pages/help"));
const NotFoundPage = lazy(() => import("./pages/not-found"));


// Optimized loading state
const AppLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-300">Loading FinanzerPro...</p>
    </div>
  </div>
);

// Loading fallback for lazy components
const LazyLoader = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400"></div>
  </div>
);

function Router() {
  // Track page views when routes change
  useAnalytics();
  
  return (
    <>
      {/* Public routes for unauthenticated users */}
      <SignedOut>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          <Route path="/terms-of-service" component={TermsOfService} />
          <Route path="/cookie-policy" component={CookiePolicy} />
          <Route path="/contact" component={Contact} />
          <Route path="/help" component={Help} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/mobile-upload/:sessionId" component={MobileUpload} />
          <Route component={NotFoundPage} />
        </Switch>
      </SignedOut>

      {/* Private routes for authenticated users */}
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
    </>
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
      <Router />
      <SignedOut>
        <Footer />
        <CookieBanner />
      </SignedOut>
    </>
  );
}

function AuthenticatedApp() {
  const { user: clerkUser, isLoaded } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Use Clerk user directly for faster loading in production
  if (!isLoaded || !clerkUser) {
    return <AppLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
              {/* Core pages - loaded immediately */}
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/transactions" component={TransactionsPage} />
              <Route path="/income" component={IncomePage} />
              <Route path="/expenses" component={ExpensesPage} />
              <Route path="/redeem" component={RedeemPage} />
              
              {/* Secondary features - lazy loaded */}
              <Route path="/budget">
                <Suspense fallback={<LazyLoader />}>
                  <BudgetPage />
                </Suspense>
              </Route>
              <Route path="/categories">
                <Suspense fallback={<LazyLoader />}>
                  <CategoriesPage />
                </Suspense>
              </Route>
              <Route path="/goals">
                <Suspense fallback={<LazyLoader />}>
                  <GoalsPage />
                </Suspense>
              </Route>
              <Route path="/collaborative-goals">
                <Suspense fallback={<LazyLoader />}>
                  <CollaborativeGoalsPage />
                </Suspense>
              </Route>
              <Route path="/collaborative-goals/:id">
                <Suspense fallback={<LazyLoader />}>
                  <CollaborativeGoalDetailPage />
                </Suspense>
              </Route>
              <Route path="/profile">
                <Suspense fallback={<LazyLoader />}>
                  <ProfilePage />
                </Suspense>
              </Route>
              
              {/* Analytics and reporting - lazy loaded */}
              <Route path="/calendar">
                <Suspense fallback={<LazyLoader />}>
                  <CalendarPage />
                </Suspense>
              </Route>
              <Route path="/trends">
                <Suspense fallback={<LazyLoader />}>
                  <TrendsPage />
                </Suspense>
              </Route>
              <Route path="/reports">
                <Suspense fallback={<LazyLoader />}>
                  <ReportsPage />
                </Suspense>
              </Route>
              <Route path="/export">
                <Suspense fallback={<LazyLoader />}>
                  <ExportPage />
                </Suspense>
              </Route>
              
              {/* Admin and heavy features - lazy loaded */}
              <Route path="/admin-analytics">
                <Suspense fallback={<LazyLoader />}>
                  <AdminAnalytics />
                </Suspense>
              </Route>
              <Route path="/mobile-upload/:sessionId">
                <Suspense fallback={<LazyLoader />}>
                  <MobileUpload />
                </Suspense>
              </Route>
              
              {/* Marketing and legal pages - lazy loaded */}
              <Route path="/subscribe">
                <Suspense fallback={<LazyLoader />}>
                  <SubscribePage />
                </Suspense>
              </Route>
              <Route path="/pricing">
                <Suspense fallback={<LazyLoader />}>
                  <Pricing />
                </Suspense>
              </Route>
              <Route path="/terms-of-service">
                <Suspense fallback={<LazyLoader />}>
                  <TermsOfService />
                </Suspense>
              </Route>
              <Route path="/privacy-policy">
                <Suspense fallback={<LazyLoader />}>
                  <PrivacyPolicy />
                </Suspense>
              </Route>
              <Route path="/cookie-policy">
                <Suspense fallback={<LazyLoader />}>
                  <CookiePolicy />
                </Suspense>
              </Route>
              <Route path="/contact">
                <Suspense fallback={<LazyLoader />}>
                  <Contact />
                </Suspense>
              </Route>
              <Route path="/help">
                <Suspense fallback={<LazyLoader />}>
                  <Help />
                </Suspense>
              </Route>
              
              {/* Fallback route - lazy loaded */}
              <Route>
                <Suspense fallback={<LazyLoader />}>
                  <NotFoundPage />
                </Suspense>
              </Route>
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
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
    }
  }, []);

  return (
    <>
      <AppContent />
      <Toaster />
    </>
  );
}