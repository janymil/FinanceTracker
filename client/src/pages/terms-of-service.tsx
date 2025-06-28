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
    document.title = "Terms of Service - FinanzerPro";
  }, []);

  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">{t("Terms of Service")}</h1>
        <p className="text-muted-foreground mb-8">{t("Last updated: June 14, 2025")}</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("1. Acceptance of Terms")}</h2>
            <p className="mb-4">
              {t("By accessing and using FinanzerPro, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our service.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("2. Description of Service")}</h2>
            <p className="mb-4">
              {t("FinanzerPro is a personal finance management application that helps users track expenses, manage budgets, set financial goals, and gain insights into their spending patterns.")}
            </p>
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
            <p className="mb-4">{t("You agree not to use FinanzerPro to:")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("Violate any applicable laws or regulations")}</li>
              <li>{t("Transmit any harmful, threatening, or offensive content")}</li>
              <li>{t("Attempt to gain unauthorized access to our systems")}</li>
              <li>{t("Interfere with or disrupt the service")}</li>
              <li>{t("Use the service for illegal financial activities")}</li>
              <li>{t("Share your account with others")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("5. Payment and Billing")}</h2>
            <h3 className="text-lg font-semibold mb-2">{t("5.1 Subscription Plans")}</h3>
            <p className="mb-4">
              {t("Paid plans are billed monthly or annually in advance. All fees are non-refundable except as required by law or as specifically permitted in our refund policy.")}
            </p>
            <h3 className="text-lg font-semibold mb-2">{t("5.2 Payment Processing")}</h3>
            <p className="mb-4">
              {t("Payments are processed securely through Stripe. We do not store your payment information.")}
            </p>
            <h3 className="text-lg font-semibold mb-2">{t("5.3 Cancellation")}</h3>
            <p className="mb-4">
              {t("You may cancel your subscription at any time. Cancellations take effect at the end of your current billing period.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("6. Data and Privacy")}</h2>
            <p className="mb-4">
              {t("Your financial data belongs to you. We do not sell or share your personal financial information with third parties except as described in our Privacy Policy.")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("You own your financial data")}</li>
              <li>{t("We provide data export capabilities")}</li>
              <li>{t("You may delete your account and data at any time")}</li>
              <li>{t("We use encryption to protect your data")}</li>
              <li>{t("AI features process anonymized data only (see Privacy Policy for details)")}</li>
            </ul>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg mt-4">
              <p className="text-sm">
                <strong>{t("AI Data Processing:")}</strong> {t("By using AI-powered features, you consent to anonymized transaction data processing by OpenAI as detailed in our Privacy Policy. You can opt-out anytime in account settings.")}
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("7. Service Availability")}</h2>
            <p className="mb-4">
              {t("While we strive for 99.9% uptime, we do not guarantee uninterrupted service. We may temporarily suspend service for maintenance or updates.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("8. Limitation of Liability")}</h2>
            <p className="mb-4">
              {t("FinanzerPro is provided \"as is\" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("9. Intellectual Property")}</h2>
            <p className="mb-4">
              {t("The FinanzerPro service, including its design, functionality, and content, is protected by intellectual property laws. You may not copy, modify, or distribute our service.")}
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
            <h2 className="text-2xl font-semibold mb-4">{t("12. Contact Information")}</h2>
            <p className="mb-4">
              {t("For questions about these Terms of Service, please contact us at:")}
            </p>
            <p className="mb-2">{t("Email: info@finanzerpro.com")}</p>
            <p>{t("Address: NutriNova LLC, 2105 Vista Oeste NW, Albuquerque, NM 87120")}</p>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}