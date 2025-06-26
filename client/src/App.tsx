import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { LanguageGuard } from "@/components/LanguageGuard";
import { useState, useEffect } from "react";
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
import RedeemPage from "@/pages/redeem";


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
    <LanguageGuard>
      <Switch>
        {/* Public routes for unauthenticated users */}
        <SignedOut>
          <Switch>
            {/* Default language routes */}
            <Route path="/" component={Landing} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/privacy-policy" component={PrivacyPolicy} />
            <Route path="/terms-of-service" component={TermsOfService} />
            <Route path="/cookie-policy" component={CookiePolicy} />
            <Route path="/contact" component={Contact} />
            <Route path="/help" component={Help} />
            <Route path="/auth" component={AuthPage} />
            
            {/* Language-prefixed public routes */}
            <Route path="/:lang/" component={Landing} />
            <Route path="/:lang/pricing" component={Pricing} />
            <Route path="/:lang/privacy-policy" component={PrivacyPolicy} />
            <Route path="/:lang/terms-of-service" component={TermsOfService} />
            <Route path="/:lang/cookie-policy" component={CookiePolicy} />
            <Route path="/:lang/contact" component={Contact} />
            <Route path="/:lang/help" component={Help} />
            <Route path="/:lang/auth" component={AuthPage} />
            
            <Route path="/mobile-upload/:sessionId" component={MobileUpload} />
            <Route component={NotFoundPage} />
          </Switch>
        </SignedOut>

        {/* Private routes for authenticated users */}
        <SignedIn>
          <Switch>
            {/* Language-prefixed authenticated routes */}
            <Route path="/:lang/dashboard" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/transactions" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/income" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/expenses" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/budget" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/categories" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/goals" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/collaborative-goals" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/collaborative-goals/:id" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/calendar" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/trends" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/reports" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/export" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/subscribe" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/pricing" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/terms-of-service" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/privacy-policy" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/cookie-policy" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/contact" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/help" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/redeem" component={() => <AuthenticatedApp />} />
            <Route path="/:lang/profile" component={() => <AuthenticatedApp />} />
            
            {/* Default authenticated routes */}
            <Route component={() => <AuthenticatedApp />} />
          </Switch>
        </SignedIn>
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
              <Route path="/es-pe/dashboard" component={Dashboard} />
              
              {/* Specific language routes for exact matching */}
              <Route path="/es-pe/transactions" component={TransactionsPage} />
              <Route path="/es-pe/income" component={IncomePage} />
              <Route path="/es-pe/expenses" component={ExpensesPage} />
              <Route path="/es-pe/budget" component={BudgetPage} />
              <Route path="/es-pe/categories" component={CategoriesPage} />
              <Route path="/es-pe/goals" component={GoalsPage} />
              <Route path="/es-pe/collaborative-goals" component={CollaborativeGoalsPage} />
              <Route path="/es-pe/collaborative-goals/:id" component={CollaborativeGoalDetailPage} />
              <Route path="/es-pe/calendar" component={CalendarPage} />
              <Route path="/es-pe/trends" component={TrendsPage} />
              <Route path="/es-pe/reports" component={ReportsPage} />
              <Route path="/es-pe/export" component={ExportPage} />
              <Route path="/es-pe/subscribe" component={SubscribePage} />
              <Route path="/es-pe/pricing" component={Pricing} />
              <Route path="/es-pe/terms-of-service" component={TermsOfService} />
              <Route path="/es-pe/privacy-policy" component={PrivacyPolicy} />
              <Route path="/es-pe/cookie-policy" component={CookiePolicy} />
              <Route path="/es-pe/contact" component={Contact} />
              <Route path="/es-pe/help" component={Help} />
              <Route path="/es-pe/redeem" component={RedeemPage} />
              <Route path="/es-pe/profile" component={ProfilePage} />

              <Route path="/sk-sk/dashboard" component={Dashboard} />
              <Route path="/sk-sk/transactions" component={TransactionsPage} />
              <Route path="/sk-sk/income" component={IncomePage} />
              <Route path="/sk-sk/expenses" component={ExpensesPage} />
              <Route path="/sk-sk/budget" component={BudgetPage} />
              <Route path="/sk-sk/categories" component={CategoriesPage} />
              <Route path="/sk-sk/goals" component={GoalsPage} />
              <Route path="/sk-sk/collaborative-goals" component={CollaborativeGoalsPage} />
              <Route path="/sk-sk/collaborative-goals/:id" component={CollaborativeGoalDetailPage} />
              <Route path="/sk-sk/calendar" component={CalendarPage} />
              <Route path="/sk-sk/trends" component={TrendsPage} />
              <Route path="/sk-sk/reports" component={ReportsPage} />
              <Route path="/sk-sk/export" component={ExportPage} />
              <Route path="/sk-sk/subscribe" component={SubscribePage} />
              <Route path="/sk-sk/pricing" component={Pricing} />
              <Route path="/sk-sk/terms-of-service" component={TermsOfService} />
              <Route path="/sk-sk/privacy-policy" component={PrivacyPolicy} />
              <Route path="/sk-sk/cookie-policy" component={CookiePolicy} />
              <Route path="/sk-sk/contact" component={Contact} />
              <Route path="/sk-sk/help" component={Help} />
              <Route path="/sk-sk/redeem" component={RedeemPage} />
              <Route path="/sk-sk/profile" component={ProfilePage} />

              <Route path="/en-us/dashboard" component={Dashboard} />
              <Route path="/en-us/transactions" component={TransactionsPage} />
              <Route path="/en-us/income" component={IncomePage} />
              <Route path="/en-us/expenses" component={ExpensesPage} />
              <Route path="/en-us/budget" component={BudgetPage} />
              <Route path="/en-us/categories" component={CategoriesPage} />
              <Route path="/en-us/goals" component={GoalsPage} />
              <Route path="/en-us/collaborative-goals" component={CollaborativeGoalsPage} />
              <Route path="/en-us/collaborative-goals/:id" component={CollaborativeGoalDetailPage} />
              <Route path="/en-us/calendar" component={CalendarPage} />
              <Route path="/en-us/trends" component={TrendsPage} />
              <Route path="/en-us/reports" component={ReportsPage} />
              <Route path="/en-us/export" component={ExportPage} />
              <Route path="/en-us/subscribe" component={SubscribePage} />
              <Route path="/en-us/pricing" component={Pricing} />
              <Route path="/en-us/terms-of-service" component={TermsOfService} />
              <Route path="/en-us/privacy-policy" component={PrivacyPolicy} />
              <Route path="/en-us/cookie-policy" component={CookiePolicy} />
              <Route path="/en-us/contact" component={Contact} />
              <Route path="/en-us/help" component={Help} />
              <Route path="/en-us/redeem" component={RedeemPage} />
              <Route path="/en-us/profile" component={ProfilePage} />

              {/* Default language routes */}
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
              <Route path="/redeem" component={RedeemPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/admin-analytics" component={AdminAnalytics} />

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
  // Initialize Google Analytics and check for incognito mode when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
    }

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