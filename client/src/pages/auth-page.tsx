import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { DollarSign, TrendingUp, Shield } from "lucide-react";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Extract URL parameters from Stripe redirect
  const urlParams = new URLSearchParams(window.location.search);
  const selectedPlan = urlParams.get('plan') || 'free';
  const stripeSuccess = urlParams.get('success') === 'true';
  const error = urlParams.get('error');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleSignIn = () => {
    window.location.href = "/api/login";
  };

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="space-y-6 text-center lg:text-left">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Take Control of Your Finances
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Track expenses, manage budgets, and achieve your financial goals with our comprehensive platform.
            </p>
          </div>

          <div className="grid gap-4 mt-8">
            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Smart Expense Tracking</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Categorize and monitor your spending automatically</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Financial Analytics</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Get insights with detailed charts and reports</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Secure & Private</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your financial data is encrypted and protected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Form */}
        <div className="w-full max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Welcome to FinanzerPro</CardTitle>
              <CardDescription>
                {stripeSuccess && selectedPlan ? (
                  <>Complete your {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} plan setup</>
                ) : error ? (
                  <span className="text-red-600">
                    {error === 'payment_not_completed' ? 'Payment was not completed' :
                     error === 'invalid_plan' ? 'Invalid plan selected' :
                     error === 'subscription_processing_failed' ? 'Subscription processing failed' :
                     'There was an error processing your request'}
                  </span>
                ) : (
                  'Sign in with your Replit account to get started'
                )}
              </CardDescription>
              {stripeSuccess && selectedPlan && (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✓ Subscription confirmed for {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} plan
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleSignIn}
                className="w-full"
                size="lg"
              >
                Sign In with Replit
              </Button>

              <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                <p>
                  By signing in, you agree to our{" "}
                  <a href="/terms" className="underline hover:text-gray-900 dark:hover:text-gray-200">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" className="underline hover:text-gray-900 dark:hover:text-gray-200">
                    Privacy Policy
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}