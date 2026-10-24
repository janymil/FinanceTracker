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

        {/* Consent-first notice banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg my-6">
          <h3 className="text-base font-semibold text-blue-900 dark:text-blue-200 mb-1">
            {t("cookies.policy.consent_first_title", "Consent-First Tracking Notice")}
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            {t("cookies.policy.consent_first_desc", "We respect your choices. By default, no analytics or advertising tracking cookies or scripts are loaded when you visit our website. Tracking scripts (including Google Analytics and Google Ads) are activated only if and after you explicitly click 'Accept' on our Cookie Banner.")}
          </p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.what_are_cookies")}</h2>
            <p className="mb-4">
              {t("cookies.policy.what_are_cookies_desc")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.local_storage_title", "Cookies vs. Local Storage")}</h2>
            <p className="mb-4">
              {t("cookies.policy.local_storage_desc", "In addition to cookies, Kaptia uses browser local storage (localStorage) for client-side user interface preferences. Unlike cookies, localStorage items are stored only in your browser and are never transmitted in HTTP headers with your requests:")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>
                <strong>theme:</strong> {t("cookies.policy.local_storage_theme", "Stores your UI theme selection (light or dark mode) locally in your browser.")}
              </li>
              <li>
                <strong>preferredLanguage:</strong> {t("cookies.policy.local_storage_lang", "Stores your chosen display language (English, Spanish, or Slovak).")}
              </li>
              <li>
                <strong>cookie-consent:</strong> {t("cookies.policy.local_storage_consent", "Stores your cookie banner decision. It is saved directly in your browser's localStorage and remains until you modify or clear it.")}
              </li>
            </ul>
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
              <li><strong>Clerk:</strong> {t("cookies.policy.clerk_desc", "Handles user authentication sessions and identity tokens.")}</li>
              <li><strong>Cloudflare:</strong> {t("cookies.policy.cloudflare_desc", "Provides security, bot detection, and DDoS mitigation.")}</li>
              <li><strong>Stripe & Mercado Pago:</strong> {t("cookies.policy.stripe_desc")}</li>
              <li><strong>Google Analytics & Google Ads:</strong> {t("cookies.policy.analytics_services_desc")}</li>
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
            
            <h3 className="text-lg font-semibold mb-2">{t("cookies.policy.cookie_banner")}</h3>
            <p className="mb-4">
              {t("cookies.policy.banner_desc")}
            </p>

            <h3 className="text-lg font-semibold mb-2">{t("cookies.policy.browser_settings")}</h3>
            <p className="mb-4">
              {t("cookies.policy.browser_desc")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("cookies.policy.cookie_list")}</h2>
            <p className="mb-4">{t("cookies.policy.cookie_list_desc")}</p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-border rounded-lg text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="border border-border px-4 py-2 text-left">{t("cookies.policy.cookie_name")}</th>
                    <th className="border border-border px-4 py-2 text-left">{t("cookies.policy.provider", "Provider")}</th>
                    <th className="border border-border px-4 py-2 text-left">{t("cookies.policy.purpose")}</th>
                    <th className="border border-border px-4 py-2 text-left">{t("cookies.policy.duration")}</th>
                    <th className="border border-border px-4 py-2 text-left">{t("cookies.policy.type")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-4 py-2 font-mono text-xs">__session</td>
                    <td className="border border-border px-4 py-2">Clerk</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.clerk_session", "User authentication session token")}</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.session_active", "Active session / token refresh")}</td>
                    <td className="border border-border px-4 py-2 font-semibold text-emerald-600 dark:text-emerald-400">{t("cookies.policy.essential")}</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2 font-mono text-xs">__client_uat</td>
                    <td className="border border-border px-4 py-2">Clerk</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.clerk_uat", "User activity timestamp for session validation")}</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.one_year", "1 year")}</td>
                    <td className="border border-border px-4 py-2 font-semibold text-emerald-600 dark:text-emerald-400">{t("cookies.policy.essential")}</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2 font-mono text-xs">__cf_bm</td>
                    <td className="border border-border px-4 py-2">Cloudflare</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.cf_bm", "Bot management and DDoS mitigation")}</td>
                    <td className="border border-border px-4 py-2">30 {t("cookies.policy.minutes", "minutes")}</td>
                    <td className="border border-border px-4 py-2 font-semibold text-emerald-600 dark:text-emerald-400">{t("cookies.policy.essential")}</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2 font-mono text-xs">admin.session.id</td>
                    <td className="border border-border px-4 py-2">Kaptia</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.admin_session", "Internal admin panel authentication")}</td>
                    <td className="border border-border px-4 py-2">24 {t("cookies.policy.hours", "hours")}</td>
                    <td className="border border-border px-4 py-2 font-semibold text-emerald-600 dark:text-emerald-400">{t("cookies.policy.essential")} ({t("cookies.policy.admin_only", "Admin only")})</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2 font-mono text-xs">_ga</td>
                    <td className="border border-border px-4 py-2">Google Analytics</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.ga_desc", "Pseudonymous client identifier to measure site usage")}</td>
                    <td className="border border-border px-4 py-2">2 {t("cookies.policy.years", "years")}</td>
                    <td className="border border-border px-4 py-2 text-indigo-600 dark:text-indigo-400">{t("cookies.policy.analytics", "Analytics")} ({t("cookies.policy.consent_required", "Requires consent")})</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2 font-mono text-xs">_ga_PRRBGDT20Q</td>
                    <td className="border border-border px-4 py-2">Google Analytics</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.ga_session_desc", "Maintains pseudonymous session state and interaction metrics")}</td>
                    <td className="border border-border px-4 py-2">2 {t("cookies.policy.years", "years")}</td>
                    <td className="border border-border px-4 py-2 text-indigo-600 dark:text-indigo-400">{t("cookies.policy.analytics", "Analytics")} ({t("cookies.policy.consent_required", "Requires consent")})</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2 font-mono text-xs">_gcl_au / Google Ads</td>
                    <td className="border border-border px-4 py-2">Google Ads</td>
                    <td className="border border-border px-4 py-2">{t("cookies.policy.gcl_desc", "Measures pseudonymous conversion efficiency for advertising campaigns")}</td>
                    <td className="border border-border px-4 py-2">90 {t("cookies.policy.days", "days")}</td>
                    <td className="border border-border px-4 py-2 text-amber-600 dark:text-amber-400">{t("cookies.policy.marketing", "Marketing")} ({t("cookies.policy.consent_required", "Requires consent")})</td>
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