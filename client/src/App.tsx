import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { useState, useEffect } from "react";
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

// Other components loaded on demand
import AuthPage from "@/pages/auth-page";
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
import SubscribePage from "@/pages/subscribe";
import Pricing from "@/pages/pricing";
import TermsOfService from "@/pages/terms-of-service";
import PrivacyPolicy from "@/pages/privacy-policy";
import CookiePolicy from "@/pages/cookie-policy";
import Contact from "@/pages/contact";
import Help from "@/pages/help";
import NotFoundPage from "./pages/not-found";
import ProfilePage from "./pages/profile";
import AdminAnalytics from "@/pages/admin-analytics";
import MobileUpload from "@/pages/mobile-upload/sessionId";

// Optimized loading state
const AppLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-300">Loading FinanzerPro...</p>
    </div>
  </div>
);

function Router() {
  // Track page views when routes change
  useAnalytics();
  
  return (
    <Switch>
      {/* Public routes for unauthenticated users */}
      <SignedOut>
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
      </SignedOut>

      {/* Private routes for authenticated users */}
      <SignedIn>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/transactions" component={TransactionsPage} />
        <Route path="/income" component={IncomePage} />
        <Route path="/expenses" component={ExpensesPage} />
        <Route path="/budget" component={BudgetPage} />
        <Route path="/categories" component={CategoriesPage} />
        <Route path="/goals" component={GoalsPage} />
        <Route path="/collaborative-goals" component={CollaborativeGoalsPage} />
        <Route path="/collaborative-goals/:goalId" component={CollaborativeGoalDetailPage} />
        <Route path="/trends" component={TrendsPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/data-management" component={ExportPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/admin-analytics" component={AdminAnalytics} />
        <Route path="/help" component={Help} />
        <Route component={NotFoundPage} />
      </SignedIn>
    </Switch>
  );
}

function AppContent() {
  const clerk = useClerk();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

      {/* Protected routes for authenticated users */}
      <SignedIn>
        <AuthenticatedApp 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
        />
      </SignedIn>
    </>
  );
}

function AuthenticatedApp({ sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed }: {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}) {
  const { user: clerkUser, isLoaded } = useUser();
  
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
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/transactions" component={TransactionsPage} />
              <Route path="/income" component={IncomePage} />
              <Route path="/expenses" component={ExpensesPage} />
              <Route path="/budget" component={BudgetPage} />
              <Route path="/categories" component={CategoriesPage} />
              <Route path="/goals" component={GoalsPage} />
              <Route path="/collaborative-goals" component={CollaborativeGoalsPage} />
              <Route path="/collaborative-goals/:id" component={CollaborativeGoalDetailPage} />
              <Route path="/calendar" component={CalendarPage} />
              <Route path="/trends" component={TrendsPage} />
              <Route path="/reports" component={ReportsPage} />
              <Route path="/export" component={ExportPage} />
              <Route path="/subscribe" component={SubscribePage} />
              <Route path="/pricing" component={Pricing} />
              <Route path="/terms-of-service" component={TermsOfService} />
              <Route path="/privacy-policy" component={PrivacyPolicy} />
              <Route path="/cookie-policy" component={CookiePolicy} />
              <Route path="/contact" component={Contact} />
              <Route path="/help" component={Help} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/admin-analytics" component={AdminAnalytics} />
              <Route component={NotFoundPage} />
            </Switch>
          </div>
        </main>
      </div>
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