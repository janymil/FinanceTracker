import { useState, useEffect } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { DollarSign, TrendingUp, Shield } from "@/lib/icons-registry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEO } from "@/components/SEO";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("sign-up");

  // Check URL hash to determine which tab to show
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#sign-in") {
      setActiveTab("sign-in");
    } else if (hash === "#sign-up") {
      setActiveTab("sign-up");
    }

    // Listen for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash;
      if (newHash === "#sign-in") {
        setActiveTab("sign-in");
      } else if (newHash === "#sign-up") {
        setActiveTab("sign-up");
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Redirect if already logged in - use useEffect to prevent render loop
  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation("/");
    }
  }, [isAuthenticated, user, setLocation]);

  return (
    <>
      <SEO 
        title="Sign In & Sign Up - Join FinanzerPro | Smart Personal Finance"
        description="Create your FinanzerPro account or sign in to access your personal finance dashboard. Start tracking expenses, managing budgets, and achieving your financial goals today."
        keywords="finanzerpro login, sign up finance app, personal finance account, expense tracker registration, budget app login"
        canonical="https://finanzerpro.com/auth"
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-12 items-center">
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
                <p className="text-sm text-gray-600 dark:text-gray-400">Get insights and predictions about your financial future</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Secure & Private</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Industry-standard security keeps your data protected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Authentication Section */}
        <div className="w-full max-w-2xl mx-auto">

          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            // Update URL hash when tab changes
            window.location.hash = value;
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
              <TabsTrigger value="sign-in">Sign In</TabsTrigger>
            </TabsList>

            <TabsContent value="sign-up" className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
                <SignUp 
                  routing="hash"
                  fallbackRedirectUrl="/"
                  forceRedirectUrl="/"
                  signInUrl="#sign-in"
                  appearance={{
                    elements: {
                      formButtonPrimary: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2.5 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 w-full",
                      card: "shadow-none border-0 bg-transparent w-full max-w-none",
                      rootBox: "w-full max-w-none",
                      headerTitle: "text-2xl font-bold text-gray-900 dark:text-white mb-1",
                      headerSubtitle: "text-gray-600 dark:text-gray-400 mb-4 text-sm",
                      socialButtonsBlockButton: "border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium py-2.5 px-4 rounded-lg transition-all duration-200 hover:shadow-md w-full",
                      socialButtonsBlockButtonText: "font-medium text-sm",
                      dividerLine: "bg-gray-200 dark:bg-gray-600",
                      dividerText: "text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-4 text-sm",
                      formFieldInput: "border-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-4 transition-all duration-200 focus:shadow-md w-full",
                      formFieldLabel: "text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-sm",
                      footerActionLink: "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200 text-sm",
                      identityPreviewText: "text-gray-600 dark:text-gray-400 text-sm",
                      identityPreviewEditButton: "text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm",
                      formResendCodeLink: "text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium text-sm",
                      otpCodeFieldInput: "border-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 text-center text-lg font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-all duration-200 w-12 h-12",
                      alertText: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2.5 text-sm",
                      form: "space-y-3",
                      formFieldRow: "space-y-1"
                    },
                    layout: {
                      socialButtonsPlacement: "top",
                      showOptionalFields: false
                    },
                    variables: {
                      colorPrimary: "#3b82f6",
                      spacingUnit: "0.75rem",
                      borderRadius: "0.5rem"
                    }
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="sign-in" className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
                <SignIn 
                  routing="hash"
                  fallbackRedirectUrl="/"
                  forceRedirectUrl="/"
                  signUpUrl="#sign-up"
                  appearance={{
                    elements: {
                      formButtonPrimary: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2.5 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 w-full",
                      card: "shadow-none border-0 bg-transparent w-full max-w-none",
                      rootBox: "w-full max-w-none",
                      headerTitle: "text-2xl font-bold text-gray-900 dark:text-white mb-1",
                      headerSubtitle: "text-gray-600 dark:text-gray-400 mb-4 text-sm",
                      socialButtonsBlockButton: "border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium py-2.5 px-4 rounded-lg transition-all duration-200 hover:shadow-md w-full",
                      socialButtonsBlockButtonText: "font-medium text-sm",
                      dividerLine: "bg-gray-200 dark:bg-gray-600",
                      dividerText: "text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-4 text-sm",
                      formFieldInput: "border-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg py-2.5 px-4 transition-all duration-200 focus:shadow-md w-full",
                      formFieldLabel: "text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-sm",
                      footerActionLink: "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200 text-sm",
                      identityPreviewText: "text-gray-600 dark:text-gray-400 text-sm",
                      identityPreviewEditButton: "text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm",
                      formResendCodeLink: "text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium text-sm",
                      otpCodeFieldInput: "border-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 text-center text-lg font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-all duration-200 w-12 h-12",
                      alternativeMethodsBlockButton: "border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-lg transition-all duration-200 w-full text-sm",
                      form: "space-y-3",
                      formFieldRow: "space-y-1"
                    },
                    layout: {
                      socialButtonsPlacement: "top"
                    },
                    variables: {
                      colorPrimary: "#3b82f6",
                      spacingUnit: "0.75rem",
                      borderRadius: "0.5rem"
                    }
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
    </>
  );
}