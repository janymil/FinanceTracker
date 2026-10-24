import { useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/AppLayout";
import { useTranslation } from 'react-i18next';
import { useGeolocation } from '../hooks/useGeolocation';

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  // Kaptia serves customers in the United States and Peru. The EU/EEA (GDPR) section was
  // removed on purpose: we do not offer the service to EU residents.
  const { requiresCCPA } = useGeolocation();
  
  useEffect(() => {
    document.title = "Privacy Policy - Kaptia";
  }, []);

  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">{t("privacy.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("privacy.last_updated")}</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section1.title")}</h2>
            <p className="mb-4">
              {t("privacy.section1.description")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("privacy.section1.account_info.title")}</strong> {t("privacy.section1.account_info.description")}</li>
              <li><strong>{t("privacy.section1.financial_data.title")}</strong> {t("privacy.section1.financial_data.description")}</li>
              <li><strong>{t("privacy.section1.usage_data.title")}</strong> {t("privacy.section1.usage_data.description")}</li>
              <li><strong>{t("privacy.section1.device_info.title")}</strong> {t("privacy.section1.device_info.description")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section2.title")}</h2>
            <p className="mb-4">{t("privacy.section2.description")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("privacy.section2.services")}</li>
              <li>{t("privacy.section2.transactions")}</li>
              <li>{t("privacy.section2.ai_insights")}</li>
              <li>{t("privacy.section2.notifications")}</li>
              <li>{t("privacy.section2.support")}</li>
              <li>{t("privacy.section2.analytics")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section3.title")}</h2>
            <p className="mb-4">
              {t("privacy.section3.description")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("privacy.section3.ai_provider.title")}</strong> {t("privacy.section3.ai_provider.description")}</li>
              <li><strong>{t("privacy.section3.data_anonymization.title")}</strong> {t("privacy.section3.data_anonymization.description")}</li>
              <li><strong>{t("privacy.section3.processing_purpose.title")}</strong> {t("privacy.section3.processing_purpose.description")}</li>
              <li><strong>{t("privacy.section3.automated_processing.title", "Automated Processing & Decision-Making:")}</strong> {t("privacy.section3.automated_processing.description", "AI receipt scanning and categorization are assistive productivity utilities. No decision producing legal, financial, or similarly significant effects is ever taken automatically. You retain full discretion to review, edit, override, or delete any record, or disable AI processing entirely in your account.")}</li>
              <li><strong>{t("privacy.section3.data_retention.title")}</strong> {t("privacy.section3.data_retention.description")}</li>
              <li><strong>{t("privacy.section3.user_control.title")}</strong> {t("privacy.section3.user_control.description")}</li>
              <li><strong>{t("privacy.section3.no_personal_data.title")}</strong> {t("privacy.section3.no_personal_data.description")}</li>
            </ul>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-4">
              <p className="text-sm">
                <strong>{t("privacy.section3.important.title")}</strong> {t("privacy.section3.important.description")}
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section4.title")}</h2>
            <p className="mb-4">
              {t("privacy.section4.description")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("privacy.section4.service_providers.title")}</strong> {t("privacy.section4.service_providers.description")}</li>
              <li><strong>{t("privacy.section4.payment_processing.title")}</strong> {t("privacy.section4.payment_processing.description")}</li>
              <li><strong>{t("privacy.section4.ai_processing.title")}</strong> {t("privacy.section4.ai_processing.description")}</li>
              <li><strong>{t("privacy.section4.cloud_storage.title")}</strong> {t("privacy.section4.cloud_storage.description")}</li>
              <li><strong>{t("privacy.section4.legal_requirements.title")}</strong> {t("privacy.section4.legal_requirements.description")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section5.title")}</h2>
            <p className="mb-4">
              {t("privacy.section5.description")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("privacy.section5.ssl_encryption")}</li>
              <li>{t("privacy.section5.password_hashing")}</li>
              <li>{t("privacy.section5.security_audits")}</li>
              <li>{t("privacy.section5.limited_access")}</li>
              <li>{t("privacy.section5.secure_backup")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section6.title", "6. Data Retention and Deletion")}</h2>
            <p className="mb-4">
              {t("privacy.section6.description", "We retain your information only as long as necessary to provide our service, resolve technical diagnostics, or fulfill legal obligations. You may delete your account and records at any time through your Profile settings.")}
            </p>

            <div className="overflow-x-auto my-6 border rounded-lg">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">{t("privacy.section6.table.col_category", "Data Category")}</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">{t("privacy.section6.table.col_retention", "Retention Period")}</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">{t("privacy.section6.table.col_purpose", "Purpose & Purge Cycle")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-3 font-medium">{t("privacy.section6.table.user_session", "User Active Sessions")}</td>
                    <td className="px-4 py-3">{t("privacy.section6.table.user_session_retention", "24 hours")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t("privacy.section6.table.user_session_desc", "Authentication token expires automatically.")}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">{t("privacy.section6.table.admin_session", "Admin Sessions")}</td>
                    <td className="px-4 py-3">{t("privacy.section6.table.admin_session_retention", "24 hours")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t("privacy.section6.table.admin_session_desc", "Admin access cookie; expires automatically.")}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">{t("privacy.section6.table.ai_cache", "AI Processing Cache")}</td>
                    <td className="px-4 py-3">{t("privacy.section6.table.ai_cache_retention", "24 hours to 7 days")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t("privacy.section6.table.ai_cache_desc", "Temporary hash cache to prevent duplicate AI categorization requests; automatically purged.")}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">{t("privacy.section6.table.diagnostics", "Error Diagnostics & Server Logs")}</td>
                    <td className="px-4 py-3">{t("privacy.section6.table.diagnostics_retention", "30 days")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t("privacy.section6.table.diagnostics_desc", "Security monitoring, technical debugging, and error diagnostics; automatically purged after 30 days.")}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">{t("privacy.section6.table.receipts", "Receipts, Spending & Expense Records")}</td>
                    <td className="px-4 py-3">{t("privacy.section6.table.receipts_retention", "Until deleted by user")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t("privacy.section6.table.receipts_desc", "Retained while account is active; immediately deleted when removed by user or upon account deletion.")}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">{t("privacy.section6.table.backups", "Encrypted Disaster Recovery Backups")}</td>
                    <td className="px-4 py-3">{t("privacy.section6.table.backups_retention", "30 days (rolling)")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t("privacy.section6.table.backups_desc", "Automated system disaster recovery snapshots. Deleted data is permanently overwritten and purged from all backup cycles within 30 days.")}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-lg space-y-2 mt-4 text-sm">
              <h3 className="font-semibold text-foreground">{t("privacy.section6.deletion_notice_title", "Account Deletion and Automatic Subscription Cancellation")}</h3>
              <p>
                {t("privacy.section6.deletion_notice_desc", "When you delete your account in Profile settings, your personal data, expense records, and uploaded receipts are immediately deleted from active production databases. In addition, any active recurring subscription with our payment processor (Stripe or Mercado Pago) is automatically cancelled immediately, ensuring no further subscription charges occur.")}
              </p>
              <p className="text-muted-foreground">
                {t("privacy.section6.backup_notice_desc", "Please note that encrypted system backup archives retain residual snapshots for disaster recovery for up to 30 days, after which they are permanently and completely overwritten.")}
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section7.title")}</h2>
            <p className="mb-4">{t("privacy.section7.description")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("privacy.section7.access_rights")}</li>
              <li>{t("privacy.section7.export_rights")}</li>
              <li>{t("privacy.section7.opt_out_rights")}</li>
              <li>{t("privacy.section7.information_rights")}</li>
            </ul>
          </section>

          {/* CCPA Compliance Section - Only shown to California/US users */}
          {requiresCCPA && (
          <div className="ccpa-section">
            <section className="mb-8 border-l-4 border-yellow-500 pl-4 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-r-lg">
              <h2 className="text-2xl font-semibold mb-4 text-yellow-800 dark:text-yellow-200">{t("ccpa.title")}</h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("ccpa.consumer_rights.title")}</h3>
                <p className="mb-4">{t("ccpa.consumer_rights.description")}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <h4 className="font-medium mb-2">{t("ccpa.rights.know.title")}</h4>
                    <p className="text-sm">{t("ccpa.rights.know.description")}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <h4 className="font-medium mb-2">{t("ccpa.rights.delete.title")}</h4>
                    <p className="text-sm">{t("ccpa.rights.delete.description")}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <h4 className="font-medium mb-2">{t("ccpa.rights.opt_out.title")}</h4>
                    <p className="text-sm">{t("ccpa.rights.opt_out.description")}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <h4 className="font-medium mb-2">{t("ccpa.rights.non_discrimination.title")}</h4>
                    <p className="text-sm">{t("ccpa.rights.non_discrimination.description")}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("ccpa.categories_collected.title")}</h3>
                <p className="mb-4">{t("ccpa.categories_collected.description")}</p>
                <ul className="list-disc list-inside mb-4 space-y-2">
                  <li><strong>{t("ccpa.categories.identifiers")}</strong> {t("ccpa.categories.identifiers_desc")}</li>
                  <li><strong>{t("ccpa.categories.commercial")}</strong> {t("ccpa.categories.commercial_desc")}</li>
                  <li><strong>{t("ccpa.categories.internet")}</strong> {t("ccpa.categories.internet_desc")}</li>
                  <li><strong>{t("ccpa.categories.geolocation")}</strong> {t("ccpa.categories.geolocation_desc")}</li>
                  <li><strong>{t("ccpa.categories.inferences")}</strong> {t("ccpa.categories.inferences_desc")}</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("ccpa.sale_sharing.title")}</h3>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                  <p className="text-sm font-medium">{t("ccpa.sale_sharing.no_sale")}</p>
                  <p className="text-sm mt-2">{t("ccpa.sale_sharing.description")}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("ccpa.service_providers.title")}</h3>
                <p className="mb-4">{t("ccpa.service_providers.description")}</p>
                <ul className="list-disc list-inside mb-4 space-y-2">
                  <li><strong>{t("ccpa.providers.clerk")}</strong> {t("ccpa.providers.clerk_desc")}</li>
                  <li><strong>{t("ccpa.providers.stripe")}</strong> {t("ccpa.providers.stripe_desc")}</li>
                  <li><strong>{t("ccpa.providers.mercadopago", "Mercado Pago:")}</strong> {t("ccpa.providers.mercadopago_desc", "Subscription payment processing for Latin America (Peru).")}</li>
                  <li><strong>{t("ccpa.providers.openai")}</strong> {t("ccpa.providers.openai_desc")}</li>
                  <li><strong>{t("ccpa.providers.cloudflare", "Cloudflare:")}</strong> {t("ccpa.providers.cloudflare_desc", "Encrypted receipt storage (R2) and DDoS defense.")}</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("ccpa.exercise_rights.title")}</h3>
                <p className="mb-4">{t("ccpa.exercise_rights.description")}</p>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                  <p className="text-sm"><strong>{t("ccpa.exercise_rights.email")}</strong> privacy@kaptia.app</p>
                  <p className="text-sm"><strong>{t("ccpa.exercise_rights.phone")}</strong> +1 (505) 555-0123</p>
                  <p className="text-sm"><strong>{t("ccpa.exercise_rights.response_time")}</strong> {t("ccpa.exercise_rights.response_desc")}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("ccpa.verification.title")}</h3>
                <p className="mb-4">{t("ccpa.verification.description")}</p>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                  <p className="text-sm">{t("ccpa.verification.procedure")}</p>
                </div>
              </div>
            </section>
          </div>
          )}

          {/* Data Security & Software Notice */}
          <section className="mb-8 border-l-4 border-indigo-500 pl-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-r-lg">
            <h2 className="text-2xl font-semibold mb-4 text-indigo-900 dark:text-indigo-200">{t("security_notice.title")}</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("security_notice.software_disclaimer.title")}</h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">{t("security_notice.software_disclaimer.p1")}</p>
                <p className="text-sm">{t("security_notice.software_disclaimer.p2")}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("security_notice.data_security.title")}</h3>
              <p className="mb-4">{t("security_notice.data_security.description")}</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>{t("security_notice.data_security.encryption")}</strong> {t("security_notice.data_security.encryption_desc")}</li>
                <li><strong>{t("security_notice.data_security.isolation")}</strong> {t("security_notice.data_security.isolation_desc")}</li>
                <li><strong>{t("security_notice.data_security.transmission")}</strong> {t("security_notice.data_security.transmission_desc")}</li>
                <li><strong>{t("security_notice.data_security.audits")}</strong> {t("security_notice.data_security.audits_desc")}</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("security_notice.payment_processor.title")}</h3>
              <p className="mb-4">{t("security_notice.payment_processor.description")}</p>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                <p className="text-sm">{t("security_notice.payment_processor.details")}</p>
              </div>
            </div>
          </section>

          {/* Where your data is stored — facts, not EU legal machinery. */}
          <section className="mb-8 border-l-4 border-orange-500 pl-4 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-r-lg">
            <h2 className="text-2xl font-semibold mb-4 text-orange-800 dark:text-orange-200">{t("data_transfers.title")}</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>{t("data_transfers.database")}</li>
              <li>{t("data_transfers.storage")}</li>
              <li>{t("data_transfers.auth")}</li>
              <li>{t("data_transfers.ai")}</li>
              <li>{t("data_transfers.payments")}</li>
            </ul>
            <p className="mt-4 text-sm">{t("data_transfers.note")}</p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section8.title")}</h2>
            <p className="mb-4">
              {t("privacy.section8.description")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section9.title")}</h2>
            <p className="mb-4">
              {t("privacy.section9.description")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section10.title")}</h2>
            <p className="mb-4">
              {t("privacy.section10.description")}
            </p>
            <p className="mb-2">{t("privacy.section10.email")}</p>
            <p>{t("privacy.section10.address")}</p>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}