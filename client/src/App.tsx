import { Switch, Route, useLocation, useRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import LanguageGuard from "@/components/LanguageGuard";
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
        <Route path="/:lang/profile" component={AuthenticatedApp} />
        <Route path="/:lang/subscribe" component={AuthenticatedApp} />
        <Route path="/:lang/redeem" component={AuthenticatedApp} />
        <Route path="/:lang/admin/analytics" component={AuthenticatedApp} />
        
        {/* Public pages with language prefix */}
        <Route path="/:lang/pricing" component={Pricing} />
        <Route path="/:lang/terms" component={TermsOfService} />
        <Route path="/:lang/privacy" component={PrivacyPolicy} />
        <Route path="/:lang/cookies" component={CookiePolicy} />
        <Route path="/:lang/contact" component={Contact} />
        <Route path="/:lang/help" component={Help} />
        <Route path="/:lang/auth" component={AuthPage} />
        <Route path="/:lang" component={Landing} />
        
        {/* Default route - redirect to user's language/dashboard */}
        <Route path="/" component={() => { 
          // Detect user's preferred language
          const browserLang = navigator.language.toLowerCase();
          const supportedLangs = ['en-us', 'es-pe', 'sk-sk'];
          
          // Check localStorage for previous language choice
          const savedLang = localStorage.getItem('preferredLanguage');
          
          let targetLang = 'en-us'; // fallback
          
          // Priority: saved language > browser language mapping > fallback
          if (savedLang && supportedLangs.includes(savedLang)) {
            targetLang = savedLang;
          } else if (browserLang.startsWith('es')) {
            targetLang = 'es-pe';
          } else if (browserLang.startsWith('sk')) {
            targetLang = 'sk-sk';
          }
          
          window.location.href = `/${targetLang}/dashboard`; 
          return null; 
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
      <Router />
      <SignedOut>
        <Footer />
        <CookieBanner />
      </SignedOut>
    </>
  );
}

export function AuthenticatedApp() {
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
              <Route path="/:lang/subscribe" component={SubscribePage} />
              <Route path="/pricing" component={Pricing} />
              <Route path="/terms-of-service" component={TermsOfService} />
              <Route path="/privacy-policy" component={PrivacyPolicy} />
              <Route path="/cookie-policy" component={CookiePolicy} />
              <Route path="/contact" component={Contact} />
              <Route path="/help" component={Help} />
              <Route path="/redeem" component={RedeemPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/admin-analytics" component={AdminAnalytics} />
              
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