import { useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/AppLayout";
import { useTranslation } from 'react-i18next';

export default function TermsOfService() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  
  useEffect(() => {
    document.title = "Terms of Service - Kaptia";
  }, []);

  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">{t("Terms of Service")}</h1>
        <p className="text-muted-foreground mb-8">{t("terms.last_updated", "Last updated: October 24, 2026")}</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("1. Acceptance of Terms")}</h2>
            <p className="mb-4">
              {t("By accessing and using Kaptia, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our service.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("2. Description of Service")}</h2>
            <p className="mb-4">
              {t("Kaptia is a personal finance management application that helps users track expenses, manage budgets, set financial goals, and gain insights into their spending patterns.")}
            </p>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg my-4">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">
                {t("terms.disclaimer_title", "Software Utility Disclaimer (Not a Financial Service)")}
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {t("terms.disclaimer_text", "Kaptia is strictly a software productivity tool for personal record-keeping, receipt organization, and budget planning. Kaptia is NOT a bank, credit union, lender, broker, investment firm, or financial institution. Kaptia does not provide banking services, financial services, loan or credit services, investment advice, tax advice, accounting advice, or legal advice. The software and any automated summaries, categorizations, or insights are provided solely for general informational and personal productivity purposes. You are solely responsible for your personal decisions, expense entries, and records.")}
              </p>
            </div>
            <h3 className="text-lg font-semibold mb-2">{t("2.1 Service Plans")}</h3>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("Free Plan:")}</strong> {t("Basic transaction tracking (limited to 100 transactions)")}</li>
              <li><strong>{t("Standard Plan:")}</strong> {t("Enhanced features including budgeting, goals, AI categorization, and reminders")}</li>
              <li><strong>{t("Premium Plan:")}</strong> {t("Unlimited transactions, advanced analytics, AI insights, data export, and cloud backup")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("3. User Accounts")}</h2>
            <p className="mb-4">
              {t("To use our service, you must create an account and provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials.")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("You must be at least 18 years old to use this service")}</li>
              <li>{t("One account per person is allowed")}</li>
              <li>{t("You are responsible for all activities under your account")}</li>
              <li>{t("Notify us immediately of any unauthorized use")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("4. Acceptable Use")}</h2>
            <p className="mb-4">{t("You agree not to use Kaptia to:")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("Violate any applicable laws or regulations")}</li>
              <li>{t("Transmit any harmful, threatening, or offensive content")}</li>
              <li>{t("Attempt to gain unauthorized access to our systems")}</li>
              <li>{t("Interfere with or disrupt the service")}</li>
              <li>{t("terms.acceptable_use_illegal", "Use the service for illegal or fraudulent activities")}</li>
              <li>{t("Share your account with others")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("5. Payment and Billing")}</h2>
            
            <h3 className="text-lg font-semibold mb-2">{t("terms.pricing_title", "5.1 Subscription Plans and Pricing")}</h3>
            <p className="mb-4">
              {t("terms.pricing_desc", "Paid plans are billed in advance on a recurring monthly or annual basis. Prices are charged in United States Dollars (USD) or Peruvian Soles (PEN) depending on your region and selected payment method. Any applicable taxes (such as sales taxes, VAT, or local consumption taxes) are calculated and displayed at checkout or included where required by law.")}
            </p>

            <h3 className="text-lg font-semibold mb-2">{t("terms.auto_renewal_title", "5.2 Automatic Renewal")}</h3>
            <p className="mb-4">
              {t("terms.auto_renewal_desc", "By subscribing to a paid plan, you agree that your subscription will automatically renew at the end of each billing cycle (monthly or annually) at the then-current price, and you authorize Kaptia to automatically charge your chosen payment method until you cancel. You may cancel recurring billing at any time in your account settings.")}
            </p>

            <h3 className="text-lg font-semibold mb-2">{t("terms.payment_processing_title", "5.3 Payment Processing")}</h3>
            <p className="mb-4">
              {t("terms.payment_processing_desc", "Payment transactions are handled securely through certified third-party payment gateways: Stripe (for USD credit and debit card payments worldwide) and Mercado Pago (for PEN payments in Peru and Latin America). Kaptia never receives, processes, or stores your credit card numbers, debit card numbers, or bank account credentials on our servers.")}
            </p>

            <h3 className="text-lg font-semibold mb-2">{t("terms.cancellation_refund_title", "5.4 Cancellation and Refund Policy")}</h3>
            <p className="mb-4">
              {t("terms.cancellation_refund_desc", "You may cancel your subscription at any time through your Profile settings. Your cancellation will take effect at the end of your current paid billing cycle, and you will maintain full access to paid features until that period ends. All subscription fees are non-refundable, except where a refund is mandatory under applicable law.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("6. Data and Privacy")}</h2>
            <p className="mb-4">
              {t("terms.privacy_description", "Your personal data and expense records belong to you. We do not sell or share your personal information with third parties except as described in our Privacy Policy.")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("terms.privacy_ownership", "You own your data and expense records")}</li>
              <li>{t("We provide data export capabilities")}</li>
              <li>{t("You may delete your account and data at any time")}</li>
              <li>{t("We use encryption to protect your data")}</li>
              <li>{t("AI features process anonymized data only (see Privacy Policy for details)")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("7. Service Availability")}</h2>
            <p className="mb-4">
              {t("terms.availability_desc", "Kaptia is hosted on cloud server infrastructure and provided on an 'as-available' and commercially reasonable efforts basis. We do not provide a guaranteed Service Level Agreement (SLA) or warrant uninterrupted, continuous, or error-free operation. We may temporarily suspend or restrict access to the service for maintenance, system updates, or emergency repairs.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("terms.liability_title", "8. Limitation of Liability and Liability Cap")}</h2>
            <p className="mb-4">
              {t("terms.liability_desc", "Kaptia is provided \"as is\" and \"as available\" without warranties of any kind, whether express, statutory, or implied. To the maximum extent permitted by applicable law, in no event shall Kaptia, NutriNova LLC, or its officers, employees, or affiliates be liable for any indirect, incidental, special, exemplary, or consequential damages, or loss of profits, data, or personal productivity arising from your use of the service.")}
            </p>
            <p className="mb-4">
              {t("terms.liability_cap", "To the maximum extent permitted by applicable law, our total aggregate liability arising out of or relating to these Terms or the service shall not exceed the greater of one hundred United States dollars ($100 USD) or the total subscription fees paid by you to Kaptia in the twelve (12) months preceding the event giving rise to liability.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("9. Intellectual Property")}</h2>
            <p className="mb-4">
              {t("The Kaptia service, including its design, functionality, and content, is protected by intellectual property laws. You may not copy, modify, or distribute our service.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("10. Termination")}</h2>
            <p className="mb-4">
              {t("We may terminate or suspend your account immediately if you violate these terms. You may terminate your account at any time through your account settings.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("11. Changes to Terms")}</h2>
            <p className="mb-4">
              {t("We may modify these terms at any time. We will notify users of significant changes via email or through the service. Continued use constitutes acceptance of modified terms.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("terms.governing_law_title", "12. Governing Law and Jurisdiction")}</h2>
            <p className="mb-4">
              {t("terms.governing_law_desc", "These Terms of Service and any dispute, controversy, or claim arising out of or relating to them or the service shall be governed by and construed in accordance with the laws of the State of New Mexico, United States of America, without regard to conflict of law principles. Any legal action or proceeding arising under these Terms shall be instituted exclusively in the state or federal courts located in Bernalillo County, New Mexico, and each party irrevocably consents to personal jurisdiction and venue in such courts.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("terms.contact_title", "13. Contact Information")}</h2>
            <p className="mb-4">
              {t("For questions about these Terms of Service, please contact us at:")}
            </p>
            <p className="mb-2">{t("Email: info@kaptia.app")}</p>
            <p>{t("Address: NutriNova LLC, 2105 Vista Oeste NW, Albuquerque, NM 87120")}</p>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}