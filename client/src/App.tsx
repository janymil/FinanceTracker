import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SWRConfig } from "swr";
import { Route, Router, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Budget from "@/pages/budget";
import Goals from "@/pages/goals";
import Reports from "@/pages/reports";
import Calendar from "@/pages/calendar";
import Categories from "@/pages/categories";
import Profile from "@/pages/profile";
import Subscribe from "@/pages/subscribe";
import Pricing from "@/pages/pricing";
import Help from "@/pages/help";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth-page";
import Trends from "@/pages/trends";
import Expenses from "@/pages/expenses";
import Income from "@/pages/income";
import Export from "@/pages/export";
import Contact from "@/pages/contact";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import CookiePolicy from "@/pages/cookie-policy";
import CollaborativeGoals from "@/pages/collaborative-goals";
import AdminAnalytics from "@/pages/admin-analytics";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useAuth } from "@/hooks/useAuth";
import CookieBanner from "@/components/cookie-banner";
import DashboardSkeleton from "@/components/dashboard-skeleton";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: false,
    },
  },
});

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return (
      <Router>
        <Switch>
          <Route path="/pricing" component={Pricing} />
          <Route path="/help" component={Help} />
          <Route path="/contact" component={Contact} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsOfService} />
          <Route path="/cookies" component={CookiePolicy} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/" component={LandingPage} />
          <Route component={NotFound} />
        </Switch>
        <CookieBanner />
        <Toaster />
      </Router>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <Router>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/transactions" component={Transactions} />
                <Route path="/budget" component={Budget} />
                <Route path="/goals" component={Goals} />
                <Route path="/reports" component={Reports} />
                <Route path="/calendar" component={Calendar} />
                <Route path="/categories" component={Categories} />
                <Route path="/profile" component={Profile} />
                <Route path="/subscribe" component={Subscribe} />
                <Route path="/pricing" component={Pricing} />
                <Route path="/help" component={Help} />
                <Route path="/trends" component={Trends} />
                <Route path="/expenses" component={Expenses} />
                <Route path="/income" component={Income} />
                <Route path="/export" component={Export} />
                <Route path="/contact" component={Contact} />
                <Route path="/privacy" component={PrivacyPolicy} />
                <Route path="/terms" component={TermsOfService} />
                <Route path="/cookies" component={CookiePolicy} />
                <Route path="/collaborative-goals" component={CollaborativeGoals} />
                <Route path="/admin" component={AdminAnalytics} />
                <Route component={NotFound} />
              </Switch>
            </Router>
          </main>
        </div>
      </div>
      <CookieBanner />
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SWRConfig value={{ dedupingInterval: 2000 }}>
        <AppContent />
      </SWRConfig>
    </QueryClientProvider>
  );
}