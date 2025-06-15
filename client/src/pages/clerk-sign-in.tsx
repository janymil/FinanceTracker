
import { SignIn } from "@clerk/clerk-react";
import { Link } from "wouter";
import { ArrowLeft, Shield, Zap, Users } from "lucide-react";

export default function ClerkSignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Branding and benefits */}
        <div className="hidden lg:block space-y-8">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Welcome back to
              <span className="text-blue-600 dark:text-blue-400 block">FinanzerPro</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Take control of your financial future with intelligent expense tracking and AI-powered insights.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Secure & Private</h3>
                <p className="text-gray-600 dark:text-gray-300">Your financial data is protected with industry-standard encryption</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">AI-Powered Insights</h3>
                <p className="text-gray-600 dark:text-gray-300">Get personalized financial recommendations and trend predictions</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Trusted by Thousands</h3>
                <p className="text-gray-600 dark:text-gray-300">Join users who've improved their financial health with FinanzerPro</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Sign-in form */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <h2 className="text-2xl font-bold">Sign In</h2>
              <p className="text-blue-100 mt-1">Welcome back! Please sign in to your account.</p>
            </div>
            
            <div className="p-8">
              <SignIn 
                routing="path"
                path="/sign-in-clerk"
                fallbackRedirectUrl="/"
                signUpUrl="/sign-up-clerk"
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
                    formFieldInput: "w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-colors",
                    formFieldLabel: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-2",
                    formButtonPrimary: "w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl",
                    footerActionLink: "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors",
                    identityPreviewText: "text-gray-600 dark:text-gray-300",
                    identityPreviewEditButton: "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300",
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
              Don't have an account?{" "}
              <Link href="/sign-up-clerk" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors">
                Sign up for free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
