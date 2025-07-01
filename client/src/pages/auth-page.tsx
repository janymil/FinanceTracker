import { useState, useEffect } from "react";
import { SignIn, SignUp, useUser } from "@clerk/clerk-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { DollarSign, TrendingUp, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/AppLayout";

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { user: clerkUser, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState("sign-up");
  const [hasRedirected, setHasRedirected] = useState(false);
  const { t } = useTranslation();

  // Extract current language from URL to build language-aware redirect URLs
  // If no language in URL, use saved preference or browser language
  const urlLang = location.match(/^\/([a-z]{2})\//)?.[1];
  const savedLang = localStorage.getItem('preferredLanguage');
  const browserLang = navigator.language.toLowerCase().split('-')[0];
  const supportedLangs = ['en', 'es', 'sk'];
  
  const currentLang = urlLang || 
    (savedLang && supportedLangs.includes(savedLang) ? savedLang : 
    (supportedLangs.includes(browserLang) ? browserLang : 'en'));
  
  const dashboardUrl = `/${currentLang}/dashboard`;

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



  // Redirect if already logged in - prevent multiple redirects
  useEffect(() => {
    if (isLoaded && clerkUser && !hasRedirected) {
      setHasRedirected(true);
      setLocation(dashboardUrl);
    }
  }, [isLoaded, clerkUser, dashboardUrl, setLocation, hasRedirected]);

  // Show loading state while Clerk is loading
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout isPublicPage={true}>
      <SEO 
        title={t("seo.authTitle")}
        description={t("seo.authDescription")}
        keywords={t("seo.authKeywords")}
        canonical="https://finanzerpro.com/auth"
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Authentication Section - First Column */}
        <div className="w-full max-w-2xl mx-auto order-1 lg:order-1">

          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            // Update URL hash when tab changes
            window.location.hash = value;
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="sign-up">{t("auth.signUp")}</TabsTrigger>
              <TabsTrigger value="sign-in">{t("auth.signIn")}</TabsTrigger>
            </TabsList>

            <TabsContent value="sign-up" className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
                <SignUp 
                  routing="virtual"
                  signInUrl="#sign-in"
                  initialValues={{
                    emailAddress: "",
                    firstName: "",
                    lastName: ""
                  }}
                  appearance={{
                    elements: {
                      formButtonPrimary: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2.5 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 w-full disabled:opacity-75 disabled:transform-none disabled:cursor-wait disabled:animate-pulse",
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
                      showOptionalFields: false,
                      logoPlacement: "none"
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
                  routing="virtual"
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

        {/* Hero Section - Second Column */}
        <div className="space-y-6 text-center lg:text-left order-2 lg:order-2">
          {/* Signup Info Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="animate-pulse">
                  <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  {t("auth.accountCreationProcess")}
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {t("auth.accountCreationDescription")}
                </p>
                <div className="mt-2 flex items-center text-xs text-blue-700 dark:text-blue-300">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="ml-2">{t("auth.creatingSecureAccount")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              {t("auth.takeControlOfFinances")}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              {t("auth.trackExpensesDescription")}
            </p>
          </div>

          <div className="grid gap-4 mt-8">
            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{t("auth.smartExpenseTracking")}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("auth.smartExpenseTrackingDesc")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{t("auth.financialAnalytics")}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("auth.financialAnalyticsDesc")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{t("auth.securePrivate")}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("auth.securePrivateDesc")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}