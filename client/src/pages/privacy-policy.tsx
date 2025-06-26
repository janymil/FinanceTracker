import { useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/AppLayout";
import { useTranslation } from 'react-i18next';

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  
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
            <h2 className="text-2xl font-semibold mb-4">{t("3. Information Sharing")}</h2>
            <p className="mb-4">
              {t("We do not sell, trade, or otherwise transfer your personal information to third parties except:")}
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>{t("Service Providers:")}</strong> {t("Third-party companies that help us operate our service")}</li>
              <li><strong>{t("Payment Processing:")}</strong> {t("Stripe for subscription payments (no financial transaction data shared)")}</li>
              <li><strong>{t("Cloud Storage:")}</strong> {t("Encrypted backups for Premium users")}</li>
              <li><strong>{t("Legal Requirements:")}</strong> {t("When required by law or to protect rights and safety")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("4. Data Security")}</h2>
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
            <h2 className="text-2xl font-semibold mb-4">{t("5. Data Retention")}</h2>
            <p className="mb-4">
              {t("We retain your information for as long as your account is active or as needed to provide services. You may delete your account and data at any time through your account settings.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("6. Your Rights")}</h2>
            <p className="mb-4">{t("You have the right to:")}</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>{t("Access, update, or delete your personal information")}</li>
              <li>{t("Export your data in a portable format")}</li>
              <li>{t("Opt out of certain communications")}</li>
              <li>{t("Request information about how your data is used")}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("7. Cookies and Tracking")}</h2>
            <p className="mb-4">
              {t("We use cookies and similar tracking technologies to provide and improve our service. See our Cookie Policy for detailed information.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("8. Changes to This Policy")}</h2>
            <p className="mb-4">
              {t("We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the \"Last updated\" date.")}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">{t("9. Contact Us")}</h2>
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