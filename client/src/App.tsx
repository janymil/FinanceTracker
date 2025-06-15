import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Core components loaded immediately
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import { Footer } from "@/components/footer";
import { CookieBanner } from "@/components/cookie-banner";
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

// Optimized loading state
const AppLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-300">Loading FinanzerPro...</p>
    </div>
  </div>
);

function AppContent() {
  const { user, isLoading, isUnauthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Show loading state
  if (isLoading) {
    return <AppLoader />;
  }

  // Public routes for guest users
  const publicRoutes = ['/', '/pricing', '/privacy-policy', '/terms-of-service', '/cookie-policy', '/contact', '/help'];
  const currentPath = window.location.pathname;
  const isOnPublicRoute = publicRoutes.includes(currentPath);

  // If clearly unauthenticated and on a protected route, redirect to login
  if (isUnauthenticated && !isOnPublicRoute) {
    window.location.href = '/api/login';
    return <AppLoader />;
  }

  // Show guest routes if no user and on public route OR while authentication is uncertain
  if (!user && (isOnPublicRoute || !isUnauthenticated)) {
    return (
      <>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          <Route path="/terms-of-service" component={TermsOfService} />
          <Route path="/cookie-policy" component={CookiePolicy} />
          <Route path="/contact" component={Contact} />
          <Route path="/help" component={Help} />
          <Route component={NotFoundPage} />
        </Switch>
        <Footer />
        <CookieBanner />
      </>
    );
  }

  // Authenticated user layout
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
          "flex-1 transition-all duration-300 pt-16",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}>
          <div className="p-6">
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
      <CookieBanner />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster />
    </QueryClientProvider>
  );
}