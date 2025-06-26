import { useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { AnonymousHeader } from "@/components/anonymous-header";
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
    <div className="min-h-screen bg-background">
      {/* Header for anonymous users */}
      <AnonymousHeader />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: June 14, 2025</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="mb-4">
              By accessing and using FinanzerPro, you accept and agree to be bound by the terms 
              and provision of this agreement. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="mb-4">
              FinanzerPro is a personal finance management application that helps users track expenses, 
              manage budgets, set financial goals, and gain insights into their spending patterns.
            </p>
            <h3 className="text-lg font-semibold mb-2">2.1 Service Plans</h3>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Free Plan:</strong> Basic transaction tracking (limited to 100 transactions)</li>
              <li><strong>Standard Plan:</strong> Enhanced features including budgeting, goals, AI categorization, and reminders</li>
              <li><strong>Premium Plan:</strong> Unlimited transactions, advanced analytics, AI insights, data export, and cloud backup</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <p className="mb-4">
              To use our service, you must create an account and provide accurate, current, and complete information. 
              You are responsible for maintaining the confidentiality of your account credentials.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>You must be at least 18 years old to use this service</li>
              <li>One account per person is allowed</li>
              <li>You are responsible for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
            <p className="mb-4">You agree not to use FinanzerPro to:</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Transmit any harmful, threatening, or offensive content</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the service</li>
              <li>Use the service for illegal financial activities</li>
              <li>Share your account with others</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Payment and Billing</h2>
            <h3 className="text-lg font-semibold mb-2">5.1 Subscription Plans</h3>
            <p className="mb-4">
              Paid plans are billed monthly or annually in advance. All fees are non-refundable except 
              as required by law or as specifically permitted in our refund policy.
            </p>
            <h3 className="text-lg font-semibold mb-2">5.2 Payment Processing</h3>
            <p className="mb-4">
              Payments are processed securely through Stripe. We do not store your payment information.
            </p>
            <h3 className="text-lg font-semibold mb-2">5.3 Cancellation</h3>
            <p className="mb-4">
              You may cancel your subscription at any time. Cancellations take effect at the end of your current billing period.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Data and Privacy</h2>
            <p className="mb-4">
              Your financial data belongs to you. We do not sell or share your personal financial information 
              with third parties except as described in our Privacy Policy.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>You own your financial data</li>
              <li>We provide data export capabilities</li>
              <li>You may delete your account and data at any time</li>
              <li>We use encryption to protect your data</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Service Availability</h2>
            <p className="mb-4">
              While we strive for 99.9% uptime, we do not guarantee uninterrupted service. 
              We may temporarily suspend service for maintenance or updates.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="mb-4">
              FinanzerPro is provided "as is" without warranties of any kind. We are not liable for 
              any indirect, incidental, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Intellectual Property</h2>
            <p className="mb-4">
              The FinanzerPro service, including its design, functionality, and content, is protected by 
              intellectual property laws. You may not copy, modify, or distribute our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
            <p className="mb-4">
              We may terminate or suspend your account immediately if you violate these terms. 
              You may terminate your account at any time through your account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
            <p className="mb-4">
              We may modify these terms at any time. We will notify users of significant changes 
              via email or through the service. Continued use constitutes acceptance of modified terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Contact Information</h2>
            <p className="mb-4">
              For questions about these Terms of Service, please contact us at:
            </p>
            <p className="mb-2">Email: info@finanzerpro.com</p>
            <p>Address: NutriNova LLC, 2105 Vista Oeste NW, Albuquerque, NM 87120</p>
          </section>
        </div>
      </div>
    </div>
  );
}