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
  const { requiresGDPR, loading: locationLoading } = useGeolocation();
  
  useEffect(() => {
    document.title = "Privacy Policy - FinanzerPro";
  }, []);

  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">{t("Privacy Policy")}</h1>
        <p className="text-muted-foreground mb-8">{t("Last updated: June 14, 2025")}</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("1. Information We Collect")}</h2>
            <p className="mb-4">
              {t("We collect information you provide directly to us, such as when you create or modify your account, add financial transactions, set budgets, or contact us for support.")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("Account Information:")}</strong> {t("Email address, name, password (encrypted)")}</li>
              <li><strong>{t("Financial Data:")}</strong> {t("Transaction details, categories, budgets, goals")}</li>
              <li><strong>{t("Usage Data:")}</strong> {t("How you interact with our service, features used")}</li>
              <li><strong>{t("Device Information:")}</strong> {t("Browser type, IP address, operating system")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("2. How We Use Your Information")}</h2>
            <p className="mb-4">{t("We use the information we collect to:")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("Provide, maintain, and improve our financial management services")}</li>
              <li>{t("Process transactions and send related information")}</li>
              <li>{t("Provide AI-powered insights and recommendations (Premium users)")}</li>
              <li>{t("Send technical notices, updates, security alerts, and support messages")}</li>
              <li>{t("Respond to your comments and questions")}</li>
              <li>{t("Analyze usage patterns to improve our service")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("3. AI-Powered Features and Data Processing")}</h2>
            <p className="mb-4">
              {t("FinanzerPro uses artificial intelligence to provide personalized financial insights and recommendations. Here's how we handle your data for AI processing:")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("AI Service Provider:")}</strong> {t("We use OpenAI's GPT models to analyze spending patterns and generate insights")}</li>
              <li><strong>{t("Data Anonymization:")}</strong> {t("All transaction data is anonymized and stripped of personally identifiable information before AI processing")}</li>
              <li><strong>{t("Processing Purpose:")}</strong> {t("AI analysis is used exclusively for generating financial recommendations, spending insights, and personalized tips")}</li>
              <li><strong>{t("Data Retention:")}</strong> {t("Anonymized data sent to OpenAI is not stored by the AI service beyond processing requirements")}</li>
              <li><strong>{t("User Control:")}</strong> {t("You can disable AI features in your account settings to opt-out of this processing")}</li>
              <li><strong>{t("No Personal Data:")}</strong> {t("Your name, email, account details, or any identifying information is never shared with AI services")}</li>
            </ul>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-4">
              <p className="text-sm">
                <strong>{t("Important:")}</strong> {t("AI processing only occurs for Standard and Premium subscribers who have AI features enabled. Free plan users do not have their data processed by AI services.")}
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("4. Information Sharing")}</h2>
            <p className="mb-4">
              {t("We do not sell, trade, or otherwise transfer your personal information to third parties except:")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("Service Providers:")}</strong> {t("Third-party companies that help us operate our service")}</li>
              <li><strong>{t("Payment Processing:")}</strong> {t("Stripe for subscription payments (no financial transaction data shared)")}</li>
              <li><strong>{t("AI Processing:")}</strong> {t("OpenAI for anonymized financial insights (as detailed in section 3 above)")}</li>
              <li><strong>{t("Cloud Storage:")}</strong> {t("Encrypted backups for Premium users")}</li>
              <li><strong>{t("Legal Requirements:")}</strong> {t("When required by law or to protect rights and safety")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("5. Data Security")}</h2>
            <p className="mb-4">
              {t("We implement appropriate security measures to protect your personal information:")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("All data transmission is encrypted using SSL/TLS")}</li>
              <li>{t("Passwords are hashed using industry-standard encryption")}</li>
              <li>{t("Regular security audits and updates")}</li>
              <li>{t("Limited access to personal data on a need-to-know basis")}</li>
              <li>{t("Secure cloud backup storage with encryption")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("6. Data Retention")}</h2>
            <p className="mb-4">
              {t("We retain your information for as long as your account is active or as needed to provide services. You may delete your account and data at any time through your account settings.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("7. Your Rights")}</h2>
            <p className="mb-4">{t("You have the right to:")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("Access, update, or delete your personal information")}</li>
              <li>{t("Export your data in a portable format")}</li>
              <li>{t("Opt out of certain communications")}</li>
              <li>{t("Request information about how your data is used")}</li>
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
                <h3 className="text-lg font-semibold mb-3">{t("gdpr.exercise_rights.title")}</h3>
                <p className="mb-4">{t("gdpr.exercise_rights.description")}</p>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                  <p className="text-sm"><strong>{t("gdpr.exercise_rights.email")}</strong> privacy@finanzerpro.com</p>
                  <p className="text-sm"><strong>{t("gdpr.exercise_rights.response_time")}</strong> {t("gdpr.exercise_rights.response_desc")}</p>
                </div>
              </div>
            </section>
          </div>
          )}

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("8. Cookies and Tracking")}</h2>
            <p className="mb-4">
              {t("We use cookies and similar tracking technologies to provide and improve our service. See our Cookie Policy for detailed information.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("9. Changes to This Policy")}</h2>
            <p className="mb-4">
              {t("We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the \"Last updated\" date.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("10. Contact Us")}</h2>
            <p className="mb-4">
              {t("If you have any questions about this Privacy Policy, please contact us at:")}
            </p>
            <p className="mb-2">{t("Email: info@finanzerpro.com")}</p>
            <p>{t("Address: NutriNova LLC, 2105 Vista Oeste NW, Albuquerque, NM 87120")}</p>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}