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

// TRULY Dynamic Page Router - automatically handles ANY route without hardcoding
function DynamicPageRouter() {
  const [location] = useLocation();
  const [PageComponent, setPageComponent] = useState<React.ComponentType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function loadComponent() {
      setIsLoading(true);
      
      // Extract page path from URL (remove language prefix)
      const matches = location.match(/^\/[a-z]{2}\/(.*)$/);
      let pagePath = matches ? matches[1] : location.replace(/^\/[a-z]{2}\/?/, '');
      
      // Handle empty path - default to dashboard
      if (!pagePath || pagePath === '') {
        pagePath = 'dashboard';
      }
      
      // Handle paths with parameters (like /collaborative-goals/123)
      let componentPath = pagePath;
      if (pagePath.includes('/')) {
        const basePath = pagePath.split('/')[0];
        if (basePath === 'collaborative-goals') {
          componentPath = 'collaborative-goal-detail';
        } else {
          // For other paths with parameters, just use the base path
          componentPath = basePath;
        }
      }
      
      try {
        // TRY to dynamically import ANY component based on path
        // This will work for any existing page AND any new page you create
        const component = (await import(`@/pages/${componentPath}`)).default;
        setPageComponent(() => component);
      } catch (error) {
        console.log(`Page not found: @/pages/${componentPath}, trying fallback...`);
        
        // If that fails, try common alternative names
        const alternativePaths = [
          componentPath.replace(/-/g, ''), // Remove dashes: admin-analytics -> adminanalytics
          componentPath.replace(/-/g, '_'), // Replace with underscores: admin-analytics -> admin_analytics
          `${componentPath}-page`, // Add -page suffix
          componentPath.replace(/s$/, ''), // Remove trailing 's': categories -> category
        ];
        
        let foundComponent = null;
        for (const altPath of alternativePaths) {
          try {
            foundComponent = (await import(`@/pages/${altPath}`)).default;
            console.log(`Found component at alternative path: @/pages/${altPath}`);
            break;
          } catch {
            // Continue trying alternatives
          }
        }
        
        if (foundComponent) {
          setPageComponent(() => foundComponent);
        } else {
          // Final fallback to 404
          console.error(`No component found for path: ${componentPath}`);
          const NotFound = (await import('@/pages/not-found')).default;
          setPageComponent(() => NotFound);
        }
      } finally {
        setIsLoading(false);
      }
    }
    
    loadComponent();
  }, [location]);
  
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  if (!PageComponent) {
    return <div className="flex items-center justify-center min-h-screen">Page not found</div>;
  }
  
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