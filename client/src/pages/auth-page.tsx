import { useState } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { DollarSign, TrendingUp, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("sign-up");

  // Redirect if already logged in
  if (isAuthenticated && user) {
    setLocation("/");
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
        <div className="w-full max-w-md mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
              <TabsTrigger value="sign-in">Sign In</TabsTrigger>
            </TabsList>

            <TabsContent value="sign-up" className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2">
                <SignUp 
                  routing="hash"
                  redirectUrl="/"
                  signInUrl="#sign-in"
                  appearance={{
                    elements: {
                      formButtonPrimary: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105",
                      card: "shadow-none border-0 bg-transparent",
                      rootBox: "w-full",
                      headerTitle: "text-3xl font-bold text-gray-900 dark:text-white mb-2",
                      headerSubtitle: "text-gray-600 dark:text-gray-400 mb-6",
                      socialButtonsBlockButton: "border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-lg transition-all duration-200 hover:shadow-md",
                      socialButtonsBlockButtonText: "font-medium",
                      dividerLine: "bg-gray-200 dark:bg-gray-600",
                      dividerText: "text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-4",
                      formFieldInput: "border-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg py-3 px-4 transition-all duration-200 focus:shadow-md",
                      formFieldLabel: "text-gray-700 dark:text-gray-300 font-medium mb-2",
                      footerActionLink: "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200",
                      identityPreviewText: "text-gray-600 dark:text-gray-400",
                      identityPreviewEditButton: "text-blue-600 hover:text-blue-700 dark:text-blue-400",
                      formResendCodeLink: "text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium",
                      otpCodeFieldInput: "border-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 text-center text-lg font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-all duration-200"
                    },
                    layout: {
                      socialButtonsPlacement: "top",
                      showOptionalFields: true
                    }
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="sign-in" className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2">
                <SignIn 
                  routing="hash"
                  redirectUrl="/"
                  signUpUrl="#sign-up"
                  appearance={{
                    elements: {
                      formButtonPrimary: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105",
                      card: "shadow-none border-0 bg-transparent",
                      rootBox: "w-full",
                      headerTitle: "text-3xl font-bold text-gray-900 dark:text-white mb-2",
                      headerSubtitle: "text-gray-600 dark:text-gray-400 mb-6",
                      socialButtonsBlockButton: "border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-lg transition-all duration-200 hover:shadow-md",
                      socialButtonsBlockButtonText: "font-medium",
                      dividerLine: "bg-gray-200 dark:bg-gray-600",
                      dividerText: "text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-4",
                      formFieldInput: "border-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg py-3 px-4 transition-all duration-200 focus:shadow-md",
                      formFieldLabel: "text-gray-700 dark:text-gray-300 font-medium mb-2",
                      footerActionLink: "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200",
                      identityPreviewText: "text-gray-600 dark:text-gray-400",
                      identityPreviewEditButton: "text-blue-600 hover:text-blue-700 dark:text-blue-400",
                      formResendCodeLink: "text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium",
                      otpCodeFieldInput: "border-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 text-center text-lg font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-all duration-200",
                      alternativeMethodsBlockButton: "border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-lg transition-all duration-200"
                    },
                    layout: {
                      socialButtonsPlacement: "top"
                    }
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}