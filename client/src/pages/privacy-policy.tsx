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
  const { requiresGDPR, requiresCCPA, loading: locationLoading } = useGeolocation();
  
  useEffect(() => {
    document.title = "Privacy Policy - FinanzerPro";
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
            <h2 className="text-2xl font-semibold mb-4">{t("privacy.section6.title")}</h2>
            <p className="mb-4">
              {t("privacy.section6.description")}
            </p>
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

          {/* GDPR Compliance Section - Only shown to EU users */}
          {requiresGDPR && (
          <div className="gdpr-section">
            <section className="mb-8 border-l-4 border-blue-500 pl-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-r-lg">
              <h2 className="text-2xl font-semibold mb-4 text-blue-800 dark:text-blue-200">{t("gdpr.title")}</h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("gdpr.legal_basis.title")}</h3>
                <p className="mb-4">{t("gdpr.legal_basis.description")}</p>
                <ul className="list-disc list-inside mb-4 space-y-2">
                  <li><strong>{t("gdpr.legal_basis.contract")}</strong> {t("gdpr.legal_basis.contract_desc")}</li>
                  <li><strong>{t("gdpr.legal_basis.legitimate_interest")}</strong> {t("gdpr.legal_basis.legitimate_desc")}</li>
                  <li><strong>{t("gdpr.legal_basis.consent")}</strong> {t("gdpr.legal_basis.consent_desc")}</li>
                  <li><strong>{t("gdpr.legal_basis.legal_obligation")}</strong> {t("gdpr.legal_basis.legal_desc")}</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("gdpr.data_subject_rights.title")}</h3>
                <p className="mb-4">{t("gdpr.data_subject_rights.description")}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <h4 className="font-medium mb-2">{t("gdpr.rights.access.title")}</h4>
                    <p className="text-sm">{t("gdpr.rights.access.description")}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <h4 className="font-medium mb-2">{t("gdpr.rights.rectification.title")}</h4>
                    <p className="text-sm">{t("gdpr.rights.rectification.description")}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <h4 className="font-medium mb-2">{t("gdpr.rights.erasure.title")}</h4>
                    <p className="text-sm">{t("gdpr.rights.erasure.description")}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <h4 className="font-medium mb-2">{t("gdpr.rights.restriction.title")}</h4>
                    <p className="text-sm">{t("gdpr.rights.restriction.description")}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <h4 className="font-medium mb-2">{t("gdpr.rights.portability.title")}</h4>
                    <p className="text-sm">{t("gdpr.rights.portability.description")}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <h4 className="font-medium mb-2">{t("gdpr.rights.objection.title")}</h4>
                    <p className="text-sm">{t("gdpr.rights.objection.description")}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("gdpr.international_transfers.title")}</h3>
                <p className="mb-4">{t("gdpr.international_transfers.description")}</p>
                <ul className="list-disc list-inside mb-4 space-y-2">
                  <li><strong>{t("gdpr.transfers.us_services")}</strong> {t("gdpr.transfers.us_desc")}</li>
                  <li><strong>{t("gdpr.transfers.safeguards")}</strong> {t("gdpr.transfers.safeguards_desc")}</li>
                  <li><strong>{t("gdpr.transfers.adequacy")}</strong> {t("gdpr.transfers.adequacy_desc")}</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("gdpr.breach_notification.title")}</h3>
                <p className="mb-4">{t("gdpr.breach_notification.description")}</p>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                  <p className="text-sm">{t("gdpr.breach_notification.procedure")}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("gdpr.supervisory_authority.title")}</h3>
                <p className="mb-4">{t("gdpr.supervisory_authority.description")}</p>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <p className="text-sm"><strong>{t("gdpr.supervisory_authority.contact")}</strong></p>
                  <p className="text-sm">{t("gdpr.supervisory_authority.details")}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("gdpr.dpo.title")}</h3>
                <p className="mb-4">{t("gdpr.dpo.description")}</p>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                  <p className="text-sm"><strong>{t("gdpr.dpo.contact")}</strong> dpo@finanzerpro.com</p>
                  <p className="text-sm"><strong>{t("gdpr.dpo.responsibilities")}</strong> {t("gdpr.dpo.responsibilities_desc")}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("gdpr.eu_representative.title")}</h3>
                <p className="mb-4">{t("gdpr.eu_representative.description")}</p>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-700">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {t("gdpr.eu_representative.notice")}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("gdpr.exercise_rights.title")}</h3>
                <p className="mb-4">{t("gdpr.exercise_rights.description")}</p>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                  <p className="text-sm"><strong>{t("gdpr.exercise_rights.email")}</strong> privacy@finanzerpro.com</p>
                  <p className="text-sm"><strong>{t("gdpr.exercise_rights.dpo_email")}</strong> dpo@finanzerpro.com</p>
                  <p className="text-sm"><strong>{t("gdpr.exercise_rights.response_time")}</strong> {t("gdpr.exercise_rights.response_desc")}</p>
                </div>
              </div>
            </section>
          </div>
          )}

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
                  <li><strong>{t("ccpa.providers.openai")}</strong> {t("ccpa.providers.openai_desc")}</li>
                  <li><strong>{t("ccpa.providers.bunny")}</strong> {t("ccpa.providers.bunny_desc")}</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{t("ccpa.exercise_rights.title")}</h3>
                <p className="mb-4">{t("ccpa.exercise_rights.description")}</p>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                  <p className="text-sm"><strong>{t("ccpa.exercise_rights.email")}</strong> privacy@finanzerpro.com</p>
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

          {/* Financial Services Compliance Section */}
          <section className="mb-8 border-l-4 border-green-500 pl-4 bg-green-50 dark:bg-green-900/20 p-4 rounded-r-lg">
            <h2 className="text-2xl font-semibold mb-4 text-green-800 dark:text-green-200">{t("financial_compliance.title")}</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("financial_compliance.bsa.title")}</h3>
              <p className="mb-4">{t("financial_compliance.bsa.description")}</p>
              <div className="bg-white dark:bg-gray-800 p-3 rounded">
                <ul className="list-disc list-inside space-y-2">
                  <li>{t("financial_compliance.bsa.aml_procedures")}</li>
                  <li>{t("financial_compliance.bsa.transaction_monitoring")}</li>
                  <li>{t("financial_compliance.bsa.suspicious_activity")}</li>
                  <li>{t("financial_compliance.bsa.record_keeping")}</li>
                </ul>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("financial_compliance.pci_dss.title")}</h3>
              <p className="mb-4">{t("financial_compliance.pci_dss.description")}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <h4 className="font-medium mb-2">{t("financial_compliance.pci_dss.data_encryption.title")}</h4>
                  <p className="text-sm">{t("financial_compliance.pci_dss.data_encryption.description")}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <h4 className="font-medium mb-2">{t("financial_compliance.pci_dss.secure_networks.title")}</h4>
                  <p className="text-sm">{t("financial_compliance.pci_dss.secure_networks.description")}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <h4 className="font-medium mb-2">{t("financial_compliance.pci_dss.access_control.title")}</h4>
                  <p className="text-sm">{t("financial_compliance.pci_dss.access_control.description")}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded">
                  <h4 className="font-medium mb-2">{t("financial_compliance.pci_dss.monitoring.title")}</h4>
                  <p className="text-sm">{t("financial_compliance.pci_dss.monitoring.description")}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("financial_compliance.data_security.title")}</h3>
              <p className="mb-4">{t("financial_compliance.data_security.description")}</p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li><strong>{t("financial_compliance.data_security.encryption")}</strong> {t("financial_compliance.data_security.encryption_desc")}</li>
                <li><strong>{t("financial_compliance.data_security.tokenization")}</strong> {t("financial_compliance.data_security.tokenization_desc")}</li>
                <li><strong>{t("financial_compliance.data_security.secure_transmission")}</strong> {t("financial_compliance.data_security.transmission_desc")}</li>
                <li><strong>{t("financial_compliance.data_security.regular_audits")}</strong> {t("financial_compliance.data_security.audits_desc")}</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("financial_compliance.regulatory_disclosures.title")}</h3>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                <p className="text-sm font-medium mb-2">{t("financial_compliance.regulatory_disclosures.not_advisor")}</p>
                <p className="text-sm mb-2">{t("financial_compliance.regulatory_disclosures.educational_purposes")}</p>
                <p className="text-sm">{t("financial_compliance.regulatory_disclosures.consult_professional")}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("financial_compliance.regulatory_oversight.title")}</h3>
              <p className="mb-4">{t("financial_compliance.regulatory_oversight.description")}</p>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                <p className="text-sm"><strong>{t("financial_compliance.regulatory_oversight.finra")}</strong> {t("financial_compliance.regulatory_oversight.finra_desc")}</p>
                <p className="text-sm"><strong>{t("financial_compliance.regulatory_oversight.sec")}</strong> {t("financial_compliance.regulatory_oversight.sec_desc")}</p>
                <p className="text-sm"><strong>{t("financial_compliance.regulatory_oversight.cfpb")}</strong> {t("financial_compliance.regulatory_oversight.cfpb_desc")}</p>
              </div>
            </div>
          </section>

          {/* EU AI Act Compliance Section */}
          <section className="mb-8 border-l-4 border-purple-500 pl-4 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-r-lg">
            <h2 className="text-2xl font-semibold mb-4 text-purple-800 dark:text-purple-200">{t("ai_act_compliance.title")}</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("ai_act_compliance.classification.title")}</h3>
              <p className="mb-4">{t("ai_act_compliance.classification.description")}</p>
              <div className="bg-white dark:bg-gray-800 p-3 rounded">
                <p className="text-sm"><strong>{t("ai_act_compliance.classification.limited_risk")}</strong> {t("ai_act_compliance.classification.limited_desc")}</p>
                <p className="text-sm mt-2"><strong>{t("ai_act_compliance.classification.transparency")}</strong> {t("ai_act_compliance.classification.transparency_desc")}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("ai_act_compliance.transparency.title")}</h3>
              <p className="mb-4">{t("ai_act_compliance.transparency.description")}</p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li>{t("ai_act_compliance.transparency.clear_disclosure")}</li>
                <li>{t("ai_act_compliance.transparency.model_information")}</li>
                <li>{t("ai_act_compliance.transparency.data_usage")}</li>
                <li>{t("ai_act_compliance.transparency.decision_logic")}</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("ai_act_compliance.bias_fairness.title")}</h3>
              <p className="mb-4">{t("ai_act_compliance.bias_fairness.description")}</p>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                <p className="text-sm">{t("ai_act_compliance.bias_fairness.measures")}</p>
              </div>
            </div>
          </section>

          {/* International Data Transfers Section */}
          <section className="mb-8 border-l-4 border-orange-500 pl-4 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-r-lg">
            <h2 className="text-2xl font-semibold mb-4 text-orange-800 dark:text-orange-200">{t("data_transfers.title")}</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("data_transfers.scc.title")}</h3>
              <p className="mb-4">{t("data_transfers.scc.description")}</p>
              <div className="bg-white dark:bg-gray-800 p-3 rounded">
                <ul className="list-disc list-inside space-y-2">
                  <li>{t("data_transfers.scc.stripe_scc")}</li>
                  <li>{t("data_transfers.scc.clerk_scc")}</li>
                  <li>{t("data_transfers.scc.openai_scc")}</li>
                  <li>{t("data_transfers.scc.bunny_scc")}</li>
                </ul>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("data_transfers.adequacy.title")}</h3>
              <p className="mb-4">{t("data_transfers.adequacy.description")}</p>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                <p className="text-sm">{t("data_transfers.adequacy.us_framework")}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t("data_transfers.safeguards.title")}</h3>
              <p className="mb-4">{t("data_transfers.safeguards.description")}</p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li>{t("data_transfers.safeguards.technical")}</li>
                <li>{t("data_transfers.safeguards.organizational")}</li>
                <li>{t("data_transfers.safeguards.contractual")}</li>
                <li>{t("data_transfers.safeguards.monitoring")}</li>
              </ul>
            </div>
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