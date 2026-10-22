import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Menu, X, ArrowLeft } from "lucide-react";
import { KaptiaLogo } from "@/components/KaptiaLogo";
import { useLocation } from "wouter";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";

interface AnonymousHeaderProps {
  showHelpContact?: boolean;
}

export function AnonymousHeader({ showHelpContact = true }: AnonymousHeaderProps) {
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Extract current language from URL or localStorage
  const langMatch = location.match(/^\/([a-z]{2})(?:\/|$)/);
  const currentLang = langMatch ? langMatch[1] : (localStorage.getItem('preferredLanguage') || 'en');

  const isCurrent = (path: string) => {
    return location.includes(path);
  };

  const navigateTo = (path: string) => {
    setMobileMenuOpen(false);
    setLocation(path);
  };

  const handleLogin = () => {
    setMobileMenuOpen(false);
    setLocation(`/${currentLang}/auth#sign-in`);
  };

  const handleGetStarted = () => {
    setMobileMenuOpen(false);
    setLocation(`/${currentLang}/auth#sign-up`);
  };

  return (
    <header className="sticky top-0 inset-x-0 z-50 border-b border-gray-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-[#07080f]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">
          {/* Left: Logo and Go Back Button */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => navigateTo(`/${currentLang}`)} 
              className="flex items-center gap-2 group focus:outline-none"
              aria-label="Kaptia Home"
            >
              <KaptiaLogo className="h-8 w-8 transition-transform group-hover:scale-105" />
              <span className="font-display text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Kaptia
              </span>
            </button>

            {/* Go Back button in the header */}
            <button
              onClick={() => navigateTo(`/${currentLang}`)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-gray-100/80 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-white/10 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-200/80 dark:border-white/10 transition-all group"
              title={t("Back to Home")}
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>{t("Back to Home")}</span>
            </button>
          </div>

          {/* Center/Right Navigation: Subpages only */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => navigateTo(`/${currentLang}/features`)}
              className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                isCurrent('/features')
                  ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-white/10 font-semibold"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              {t("Features")}
            </button>
            {showHelpContact && (
              <>
                <button
                  onClick={() => navigateTo(`/${currentLang}/help`)}
                  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                    isCurrent('/help')
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-white/10 font-semibold"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  {t("Help")}
                </button>
                <button
                  onClick={() => navigateTo(`/${currentLang}/contact`)}
                  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                    isCurrent('/contact')
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-white/10 font-semibold"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  {t("Contact")}
                </button>
              </>
            )}
          </nav>

          {/* Right Action buttons */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <Button
              onClick={handleLogin}
              variant="ghost"
              className="hidden sm:inline-flex font-medium text-gray-700 dark:text-gray-200"
            >
              {t("Sign In")}
            </Button>

            <Button
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-indigo-500/25 font-medium text-xs sm:text-sm px-3 sm:px-4"
            >
              {t("Get Started Free")}
            </Button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              aria-label={mobileMenuOpen ? t("Close menu") : t("Menu")}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200/60 dark:border-white/[0.06] space-y-1.5">
            <button
              onClick={() => navigateTo(`/${currentLang}`)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-white/10 flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t("Back to Home")}</span>
            </button>
            <button
              onClick={() => navigateTo(`/${currentLang}/features`)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isCurrent('/features')
                  ? "bg-indigo-50/80 dark:bg-white/10 text-indigo-600 dark:text-indigo-400 font-semibold"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              {t("Features")}
            </button>
            {showHelpContact && (
              <>
                <button
                  onClick={() => navigateTo(`/${currentLang}/help`)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isCurrent('/help')
                      ? "bg-indigo-50/80 dark:bg-white/10 text-indigo-600 dark:text-indigo-400 font-semibold"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  {t("Help")}
                </button>
                <button
                  onClick={() => navigateTo(`/${currentLang}/contact`)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isCurrent('/contact')
                      ? "bg-indigo-50/80 dark:bg-white/10 text-indigo-600 dark:text-indigo-400 font-semibold"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  {t("Contact")}
                </button>
              </>
            )}
            <div className="pt-3 border-t border-gray-200/60 dark:border-white/[0.06] flex gap-2">
              <Button
                onClick={handleLogin}
                variant="outline"
                className="w-1/2 text-sm justify-center"
              >
                {t("Sign In")}
              </Button>
              <Button
                onClick={handleGetStarted}
                className="w-1/2 text-sm justify-center bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0"
              >
                {t("Get Started Free")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
