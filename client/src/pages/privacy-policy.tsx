import { useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    document.title = "Privacy Policy - FinanzerPro";
  }, []);

  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header for anonymous users */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button 
              onClick={() => setLocation('/')} 
              className="flex items-center hover:opacity-80 transition-opacity"
            >
              <TrendingUp className="h-8 w-8 text-primary mr-3" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">FinanzerPro</span>
            </button>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setLocation('/help')} 
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Help
              </button>
              <button 
                onClick={() => setLocation('/contact')} 
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Contact
              </button>
              <Button onClick={handleLogin} className="bg-primary hover:bg-primary/90">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: June 14, 2025</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="mb-4">
              We collect information you provide directly to us, such as when you create or modify your account, 
              add financial transactions, set budgets, or contact us for support.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Account Information:</strong> Email address, name, password (encrypted)</li>
              <li><strong>Financial Data:</strong> Transaction details, categories, budgets, goals</li>
              <li><strong>Usage Data:</strong> How you interact with our service, features used</li>
              <li><strong>Device Information:</strong> Browser type, IP address, operating system</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>Provide, maintain, and improve our financial management services</li>
              <li>Process transactions and send related information</li>
              <li>Provide AI-powered insights and recommendations (Premium users)</li>
              <li>Send technical notices, updates, security alerts, and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Analyze usage patterns to improve our service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Information Sharing</h2>
            <p className="mb-4">
              We do not sell, trade, or otherwise transfer your personal information to third parties except:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Service Providers:</strong> Third-party companies that help us operate our service</li>
              <li><strong>Payment Processing:</strong> Stripe for subscription payments (no financial transaction data shared)</li>
              <li><strong>Cloud Storage:</strong> Encrypted backups for Premium users</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect rights and safety</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
            <p className="mb-4">
              We implement appropriate security measures to protect your personal information:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>All data transmission is encrypted using SSL/TLS</li>
              <li>Passwords are hashed using industry-standard encryption</li>
              <li>Regular security audits and updates</li>
              <li>Limited access to personal data on a need-to-know basis</li>
              <li>Secure cloud backup storage with encryption</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
            <p className="mb-4">
              We retain your information for as long as your account is active or as needed to provide services.
              You may delete your account and data at any time through your account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>Access, update, or delete your personal information</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of certain communications</li>
              <li>Request information about how your data is used</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking</h2>
            <p className="mb-4">
              We use cookies and similar tracking technologies to provide and improve our service. 
              See our Cookie Policy for detailed information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Changes to This Policy</h2>
            <p className="mb-4">
              We may update this privacy policy from time to time. We will notify you of any changes 
              by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
            <p className="mb-4">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mb-2">Email: info@finanzerpro.com</p>
            <p>Address: NutriNova LLC, 2105 Vista Oeste NW, Albuquerque, NM 87120</p>
          </section>
        </div>
      </div>
    </div>
  );
}