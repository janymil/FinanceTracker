import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Cookie, Settings } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from 'react-i18next';
import { getLocalizedPath } from './LanguageGuard';
import { readConsent, saveConsent, loadConsentedFonts, COOKIE_SETTINGS_EVENT, type CookiePreferences } from '@/lib/consent';
import { enableAnalytics } from '@/lib/analytics';

export function CookieBanner() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Nothing optional is pre-ticked: a switch that starts on is not a choice. The visitor has to
  // turn analytics on deliberately, which is what "consent" means under the rules we follow.
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always required
    functional: false,
    analytics: false,
  });

  useEffect(() => {
    // Only ask once; a stored decision (accept, select or reject) hides the banner.
    setIsVisible(readConsent() === null);
    // A stored decision may already allow the fonts, and they must not wait for a re-render.
    loadConsentedFonts();

    // Withdrawal: the footer's "Cookie settings" re-opens the banner with the current answer.
    const reopen = () => {
      const stored = readConsent();
      setPreferences({
        essential: true,
        functional: Boolean(stored?.functional),
        analytics: Boolean(stored?.analytics),
      });
      setShowSettings(true);
      setIsVisible(true);
    };
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  const sendConsentToServer = async (consent: CookiePreferences & { timestamp: string }) => {
    try {
      await fetch('/api/cookie-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ consent }),
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Failed to send cookie consent to server:', error);
    }
  };

  const applyConsent = async (next: CookiePreferences) => {
    const saved = saveConsent(next);
    // Analytics and the web fonts start only here — never before this click.
    if (saved.analytics) enableAnalytics();
    loadConsentedFonts(saved);
    await sendConsentToServer(saved as CookiePreferences & { timestamp: string });
    setIsVisible(false);
  };

  const acceptAll = () => applyConsent({ essential: true, functional: true, analytics: true });

  const acceptSelected = () => applyConsent(preferences);

  const rejectAll = () => applyConsent({ essential: true, functional: false, analytics: false });


  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <Card className="max-w-4xl mx-auto p-6 shadow-lg border">
        <div className="flex items-start gap-4">
          <Cookie className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
          <div className="flex-1">
            {!showSettings ? (
              <>
                <h3 className="text-lg font-semibold mb-2">{t('cookies.banner.title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('cookies.banner.description')}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={acceptAll} size="sm" data-testid="cookie-consent-accept">
                    {t('cookies.banner.accept_all')}
                  </Button>
                  <Button onClick={rejectAll} variant="outline" size="sm" data-testid="cookie-consent-reject">
                    {t('cookies.banner.reject_non_essential')}
                  </Button>
                  <Button 
                    onClick={() => setShowSettings(true)} 
                    variant="ghost" 
                    size="sm"
                    className="gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    {t('cookies.banner.customize')}
                  </Button>
                  <Link href={getLocalizedPath('/cookie-policy')}>
                    <Button variant="ghost" size="sm">
                      {t('cookies.banner.learn_more')}
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('cookies.preferences.title')}</h3>
                <div className="space-y-4 mb-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{t('cookies.preferences.essential.title')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('cookies.preferences.essential.description')}
                      </p>
                    </div>
                    <div className="text-sm font-medium text-primary">{t('cookies.preferences.always_active')}</div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{t('cookies.preferences.functional.title')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('cookies.preferences.functional.description')}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) => setPreferences(prev => ({
                          ...prev,
                          functional: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{t('cookies.preferences.analytics.title')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t('cookies.preferences.analytics.description')}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences(prev => ({
                          ...prev,
                          analytics: e.target.checked
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <Button onClick={acceptSelected} size="sm">
                    {t('cookies.preferences.save_preferences')}
                  </Button>
                  <Button onClick={acceptAll} variant="outline" size="sm">
                    {t('cookies.preferences.accept_all')}
                  </Button>
                  <Button 
                    onClick={() => setShowSettings(false)} 
                    variant="ghost" 
                    size="sm"
                  >
                    {t('cookies.preferences.back')}
                  </Button>
                </div>
              </>
            )}
          </div>
          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}