import { Switch, Route, useLocation, useRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import LanguageGuard from "@/components/LanguageGuard";
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
        {/* Public pages with specific components - order matters for matching */}
        <Route path="/:lang/pricing" component={Pricing} />
        <Route path="/:lang/terms" component={TermsOfService} />
        <Route path="/:lang/terms-of-service" component={TermsOfService} />
        <Route path="/:lang/privacy" component={PrivacyPolicy} />
        <Route path="/:lang/privacy-policy" component={PrivacyPolicy} />
        <Route path="/:lang/cookies" component={CookiePolicy} />
        <Route path="/:lang/cookie-policy" component={CookiePolicy} />
        <Route path="/:lang/contact" component={Contact} />
        <Route path="/:lang/help" component={Help} />
        <Route path="/:lang/auth" component={AuthPage} />
        
        {/* Landing page */}
        <Route path="/:lang" component={Landing} />
        
        {/* DYNAMIC catch-all for ANY authenticated route - no hardcoding needed */}
        <Route path="/:lang/*" component={AuthenticatedApp} />
        
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
            
            // Redirect to appropriate page based on auth status
            if (isSignedIn) {
              setLocation(`/${targetLang}/dashboard`);
            } else {
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
      <Router />
      <SignedOut>
        <CookieBanner />
      </SignedOut>
    </>
  );
}

// Dynamic Page Router - handles all authenticated routes dynamically
function DynamicPageRouter() {
  const [location] = useLocation();
  
  // Extract language and path from URL (e.g., /en/dashboard -> lang='en', path='dashboard')
  const matches = location.match(/^\/([a-z]{2})\/(.*)$/);
  const pagePath = matches ? matches[2] : location.replace(/^\/[a-z]{2}\/?/, '');
  
  // Route mapping for existing pages
  const pageComponents: Record<string, React.ComponentType> = {
    'dashboard': Dashboard,
    'transactions': TransactionsPage,
    'income': IncomePage,
    'expenses': ExpensesPage,
    'budget': BudgetPage,
    'categories': CategoriesPage,
    'goals': GoalsPage,
    'collaborative-goals': CollaborativeGoalsPage,
    'calendar': CalendarPage,
    'trends': TrendsPage,
    'reports': ReportsPage,
    'export': ExportPage,
    'subscribe': SubscribePage,
    'redeem': RedeemPage,
    'profile': ProfilePage,
    'admin-analytics': AdminAnalytics,
    // Public pages accessible from authenticated app
    'pricing': Pricing,
    'terms-of-service': TermsOfService,
    'privacy-policy': PrivacyPolicy,
    'cookie-policy': CookiePolicy,
    'contact': Contact,
    'help': Help,
  };
  
  // Handle collaborative goal detail pages (with ID parameter)
  const collaborativeGoalMatch = pagePath.match(/^collaborative-goals\/(.+)$/);
  if (collaborativeGoalMatch) {
    return <CollaborativeGoalDetailPage />;
  }
  
  // Get component for current page
  const PageComponent = pageComponents[pagePath] || pageComponents['dashboard']; // Default to dashboard
  
  // If no specific route matched, default to dashboard for authenticated users
  if (!pagePath || pagePath === '') {
    return <Dashboard />;
  }
  
  // Render the appropriate component
  return <PageComponent />;
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
            <DynamicPageRouter />
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