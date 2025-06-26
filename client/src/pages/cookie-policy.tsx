import { useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/AppLayout";
import { useTranslation } from 'react-i18next';

export default function CookiePolicy() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  
  useEffect(() => {
    document.title = "Cookie Policy - FinanzerPro";
  }, []);

  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">{t("Cookie Policy")}</h1>
        <p className="text-muted-foreground mb-8">{t("Last updated: June 14, 2025")}</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("1. What Are Cookies")}</h2>
            <p className="mb-4">
              {t("Cookies are small text files that are stored on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and enabling essential website functionality.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("2. How We Use Cookies")}</h2>
            <p className="mb-4">{t("We use cookies for the following purposes:")}</p>
            
            <h3 className="text-lg font-semibold mb-2">{t("2.1 Essential Cookies")}</h3>
            <p className="mb-4">
              {t("These cookies are necessary for the website to function and cannot be switched off. They are usually only set in response to actions made by you, such as logging in or setting privacy preferences.")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("Session cookies:")}</strong> {t("Keep you logged in during your visit")}</li>
              <li><strong>{t("Security cookies:")}</strong> {t("Protect against unauthorized access")}</li>
              <li><strong>{t("Authentication cookies:")}</strong> {t("Remember your login status")}</li>
            </ul>

            <h3 className="text-lg font-semibold mb-2">{t("2.2 Functional Cookies")}</h3>
            <p className="mb-4">
              {t("These cookies enable enhanced functionality and personalization, such as remembering your preferences and settings.")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("Theme preferences:")}</strong> {t("Remember dark/light mode selection")}</li>
              <li><strong>{t("Language settings:")}</strong> {t("Store your preferred language")}</li>
              <li><strong>{t("Dashboard layout:")}</strong> {t("Remember your customized view preferences")}</li>
            </ul>

            <h3 className="text-lg font-semibold mb-2">{t("2.3 Analytics Cookies")}</h3>
            <p className="mb-4">
              {t("These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("Usage analytics:")}</strong> {t("Track page views and user interactions")}</li>
              <li><strong>{t("Performance monitoring:")}</strong> {t("Identify technical issues")}</li>
              <li><strong>{t("Feature usage:")}</strong> {t("Understand which features are most popular")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("3. Third-Party Cookies")}</h2>
            <p className="mb-4">
              {t("We may use third-party services that set their own cookies:")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("Stripe:")}</strong> {t("For secure payment processing (payment pages only)")}</li>
              <li><strong>{t("Analytics services:")}</strong> {t("For website performance monitoring")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("4. Cookie Duration")}</h2>
            <p className="mb-4">{t("Cookies may be either:")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("Session cookies:")}</strong> {t("Deleted when you close your browser")}</li>
              <li><strong>{t("Persistent cookies:")}</strong> {t("Remain on your device for a set period or until manually deleted")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("5. Managing Cookies")}</h2>
            <p className="mb-4">
              {t("You can control and manage cookies in several ways:")}
            </p>
            
            <h3 className="text-lg font-semibold mb-2">{t("5.1 Browser Settings")}</h3>
            <p className="mb-4">
              {t("Most browsers allow you to refuse cookies or delete existing ones. However, this may affect website functionality.")}
            </p>
            
            <h3 className="text-lg font-semibold mb-2">{t("5.2 Cookie Banner")}</h3>
            <p className="mb-4">
              {t("When you first visit our website, you can choose which types of cookies to accept through our cookie consent banner.")}
            </p>
            
            <h3 className="text-lg font-semibold mb-2">{t("5.3 Opt-Out Links")}</h3>
            <p className="mb-4">
              {t("For third-party analytics cookies, you can opt out directly through the service provider's website.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("6. Cookie List")}</h2>
            <p className="mb-4">{t("Here are the specific cookies we use:")}</p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-border rounded-lg">
                <thead className="bg-muted">
                  <tr>
                    <th className="border border-border px-4 py-2 text-left">{t("Cookie Name")}</th>
                    <th className="border border-border px-4 py-2 text-left">{t("Purpose")}</th>
                    <th className="border border-border px-4 py-2 text-left">{t("Duration")}</th>
                    <th className="border border-border px-4 py-2 text-left">{t("Type")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-4 py-2">connect.sid</td>
                    <td className="border border-border px-4 py-2">{t("Session management and authentication")}</td>
                    <td className="border border-border px-4 py-2">{t("7 days")}</td>
                    <td className="border border-border px-4 py-2">{t("Essential")}</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">theme</td>
                    <td className="border border-border px-4 py-2">{t("Remember dark/light mode preference")}</td>
                    <td className="border border-border px-4 py-2">{t("1 year")}</td>
                    <td className="border border-border px-4 py-2">{t("Functional")}</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">cookie-consent</td>
                    <td className="border border-border px-4 py-2">{t("Remember your cookie preferences")}</td>
                    <td className="border border-border px-4 py-2">{t("1 year")}</td>
                    <td className="border border-border px-4 py-2">{t("Essential")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("7. Changes to This Policy")}</h2>
            <p className="mb-4">
              {t("We may update this Cookie Policy from time to time. Any changes will be posted on this page with an updated revision date.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("8. Contact Us")}</h2>
            <p className="mb-4">
              {t("If you have any questions about our use of cookies, please contact us at:")}
            </p>
            <p className="mb-2">{t("Email: info@finanzerpro.com")}</p>
            <p>{t("Address: NutriNova LLC, 2105 Vista Oeste NW, Albuquerque, NM 87120")}</p>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}