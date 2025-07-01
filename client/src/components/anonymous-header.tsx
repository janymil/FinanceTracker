import { Button } from "@/components/ui/button";
import { TrendingUp, Sun, Moon } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from 'react-i18next';

interface AnonymousHeaderProps {
  showHelpContact?: boolean;
}

export function AnonymousHeader({ showHelpContact = true }: AnonymousHeaderProps) {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const handleLogin = () => {
    setLocation('/auth#sign-in');
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <button 
            onClick={() => setLocation('/')} 
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <TrendingUp className="h-8 w-8 text-primary mr-3" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">FinanzerPro</span>
          </button>
          <div className="flex items-center space-x-4">
            {showHelpContact && (
              <>
                <button 
                  onClick={() => {
                    // Get current language from URL or localStorage
                    const currentPath = window.location.pathname;
                    const langMatch = currentPath.match(/^\/([a-z]{2})\//);
                    const currentLang = langMatch ? langMatch[1] : localStorage.getItem('preferredLanguage') || 'en';
                    setLocation(`/${currentLang}/features`);
                  }} 
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  {t('nav.features')}
                </button>
                <button 
                  onClick={() => setLocation('/help')} 
                  className="hidden sm:block text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  {t('nav.help')}
                </button>
                <button 
                  onClick={() => setLocation('/contact')} 
                  className="hidden sm:block text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  {t('nav.contact')}
                </button>
              </>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
            <Button onClick={handleLogin} className="bg-primary hover:bg-primary/90">
              {t('auth.signIn')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}