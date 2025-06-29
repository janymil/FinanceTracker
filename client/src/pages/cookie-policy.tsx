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
    document.title = t("cookies.seo.title");
  }, [t]);

  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <AppLayout>
      <SEO 
        title={t("cookies.seo.title")}
        description={t("cookies.seo.description")}
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">{t("cookies.policy.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("cookies.policy.last_updated")}</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.what_are_cookies")}</h2>
            <p className="mb-4">
              {t("cookies.policy.what_are_cookies_desc")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.how_we_use")}</h2>
            <p className="mb-4">{t("cookies.policy.how_we_use_desc")}</p>
            
            <h3 className="text-lg font-semibold mb-2">{t("cookies.policy.essential_cookies")}</h3>
            <p className="mb-4">
              {t("cookies.policy.essential_desc")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("cookies.policy.session_cookies")}</strong> {t("cookies.policy.session_desc")}</li>
              <li><strong>{t("cookies.policy.security_cookies")}</strong> {t("cookies.policy.security_desc")}</li>
              <li><strong>{t("cookies.policy.auth_cookies")}</strong> {t("cookies.policy.auth_desc")}</li>
            </ul>

            <h3 className="text-lg font-semibold mb-2">{t("cookies.policy.functional_cookies")}</h3>
            <p className="mb-4">
              {t("cookies.policy.functional_desc")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("cookies.policy.theme_preferences")}</strong> {t("cookies.policy.theme_desc")}</li>
              <li><strong>{t("cookies.policy.language_settings")}</strong> {t("cookies.policy.language_desc")}</li>
              <li><strong>{t("cookies.policy.dashboard_layout")}</strong> {t("cookies.policy.dashboard_desc")}</li>
            </ul>

            <h3 className="text-lg font-semibold mb-2">{t("cookies.policy.analytics_cookies")}</h3>
            <p className="mb-4">
              {t("cookies.policy.analytics_desc")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("cookies.policy.usage_analytics")}</strong> {t("cookies.policy.usage_desc")}</li>
              <li><strong>{t("cookies.policy.performance_monitoring")}</strong> {t("cookies.policy.performance_desc")}</li>
              <li><strong>{t("cookies.policy.feature_usage")}</strong> {t("cookies.policy.feature_desc")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.third_party")}</h2>
            <p className="mb-4">
              {t("cookies.policy.third_party_desc")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("cookies.policy.stripe")}</strong> {t("cookies.policy.stripe_desc")}</li>
              <li><strong>{t("cookies.policy.analytics_services")}</strong> {t("cookies.policy.analytics_services_desc")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.cookie_duration")}</h2>
            <p className="mb-4">{t("cookies.policy.duration_desc")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("cookies.policy.session_duration")}</strong> {t("cookies.policy.session_duration_desc")}</li>
              <li><strong>{t("cookies.policy.persistent_cookies")}</strong> {t("cookies.policy.persistent_desc")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.managing_cookies")}</h2>
            <p className="mb-4">
              {t("cookies.policy.managing_desc")}
            </p>
            
            <h3 className="text-lg font-semibold mb-2">{t("cookies.policy.browser_settings")}</h3>
            <p className="mb-4">
              {t("cookies.policy.browser_desc")}
            </p>
            
            <h3 className="text-lg font-semibold mb-2">{t("cookies.policy.cookie_banner")}</h3>
            <p className="mb-4">
              {t("cookies.policy.banner_desc")}
            </p>
            
            <h3 className="text-lg font-semibold mb-2">{t("cookies.policy.opt_out")}</h3>
            <p className="mb-4">
              {t("cookies.policy.opt_out_desc")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.cookie_list")}</h2>
            <p className="mb-4">{t("cookies.policy.cookie_list_desc")}</p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-border rounded-lg">
                <thead className="bg-muted">
                  <tr>
                    <th className="border border-border px-4 py-2 text-left">{t("cookies.policy.cookie_name")}</th>
                    <th className="border border-border px-4 py-2 text-left">{t("cookies.policy.purpose")}</th>
                    <th className="border border-border px-4 py-2 text-left">{t("cookies.policy.duration")}</th>
                    <th className="border border-border px-4 py-2 text-left">{t("cookies.policy.type")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-4 py-2">connect.sid</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.session_mgmt")}</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.seven_days")}</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.essential")}</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">theme</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.theme_remember")}</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.one_year")}</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.functional")}</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">cookie-consent</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.consent_remember")}</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.one_year")}</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.essential")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.changes_policy")}</h2>
            <p className="mb-4">
              {t("cookies.policy.changes_desc")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.contact_us")}</h2>
            <p className="mb-4">
              {t("cookies.policy.contact_desc")}
            </p>
            <p className="mb-2">{t("cookies.policy.email")}</p>
            <p>{t("cookies.policy.address")}</p>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}