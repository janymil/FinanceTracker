
import { SignUp } from "@clerk/clerk-react";
import { Link } from "wouter";
import { ArrowLeft, TrendingUp, DollarSign, PieChart, Target } from "lucide-react";

export default function ClerkSignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Branding and benefits */}
        <div className="hidden lg:block space-y-8">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Start your journey to
              <span className="text-green-600 dark:text-green-400 block">Financial Freedom</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Join thousands of users who've transformed their financial lives with FinanzerPro's intelligent tracking and insights.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Smart Expense Tracking</h3>
                <p className="text-gray-600 dark:text-gray-300">Automatically categorize and track your expenses with AI-powered insights</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <PieChart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Visual Analytics</h3>
                <p className="text-gray-600 dark:text-gray-300">Beautiful charts and reports to understand your spending patterns</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Goal Achievement</h3>
                <p className="text-gray-600 dark:text-gray-300">Set and track financial goals with personalized recommendations</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Budget Management</h3>
                <p className="text-gray-600 dark:text-gray-300">Create and manage budgets that actually work for your lifestyle</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">🎉 Special Launch Offer</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Sign up now and get <span className="font-semibold text-green-600 dark:text-green-400">30 days free</span> access to Premium features!
            </p>
          </div>
        </div>

        {/* Right side - Sign-up form */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-green-600 to-blue-600 text-white">
              <h2 className="text-2xl font-bold">Create Account</h2>
              <p className="text-green-100 mt-1">Join FinanzerPro and start your financial journey today.</p>
            </div>
            
            <div className="p-8">
              <SignUp 
                routing="path"
                path="/sign-up-clerk"
                fallbackRedirectUrl="/"
                signInUrl="/sign-in-clerk"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border-0 bg-transparent",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: "w-full justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium",
                    socialButtonsBlockButtonText: "text-sm font-medium",
                    dividerLine: "bg-gray-200 dark:bg-gray-600",
                    dividerText: "text-gray-500 dark:text-gray-400 text-sm",
                    formFieldInput: "w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white transition-colors",
                    formFieldLabel: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-2",
                    formButtonPrimary: "w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl",
                    footerActionLink: "text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium transition-colors",
                    identityPreviewText: "text-gray-600 dark:text-gray-300",
                    identityPreviewEditButton: "text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300",
                    formFieldInputShowPasswordButton: "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
                  },
                  layout: {
                    socialButtonsPlacement: "top",
                    showOptionalFields: false,
                  },
                }}
              />
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Already have an account?{" "}
              <Link href="/sign-in-clerk" className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium transition-colors">
                Sign in here
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              By signing up, you agree to our{" "}
              <Link href="/terms" className="text-green-600 dark:text-green-400 hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-green-600 dark:text-green-400 hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
