import { useEffect } from "react";
import { TrendingUp } from "@/lib/icons-registry";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function CookiePolicy() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    document.title = "Cookie Policy - FinanzerPro";
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
        <h1 className="text-4xl font-bold mb-8">Cookie Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: June 14, 2025</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. What Are Cookies</h2>
            <p className="mb-4">
              Cookies are small text files that are stored on your device when you visit our website. 
              They help us provide you with a better experience by remembering your preferences and 
              enabling essential website functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Cookies</h2>
            <p className="mb-4">We use cookies for the following purposes:</p>
            
            <h3 className="text-lg font-semibold mb-2">2.1 Essential Cookies</h3>
            <p className="mb-4">
              These cookies are necessary for the website to function and cannot be switched off. 
              They are usually only set in response to actions made by you, such as logging in or 
              setting privacy preferences.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Session cookies:</strong> Keep you logged in during your visit</li>
              <li><strong>Security cookies:</strong> Protect against unauthorized access</li>
              <li><strong>Authentication cookies:</strong> Remember your login status</li>
            </ul>

            <h3 className="text-lg font-semibold mb-2">2.2 Functional Cookies</h3>
            <p className="mb-4">
              These cookies enable enhanced functionality and personalization, such as remembering 
              your preferences and settings.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Theme preferences:</strong> Remember dark/light mode selection</li>
              <li><strong>Language settings:</strong> Store your preferred language</li>
              <li><strong>Dashboard layout:</strong> Remember your customized view preferences</li>
            </ul>

            <h3 className="text-lg font-semibold mb-2">2.3 Analytics Cookies</h3>
            <p className="mb-4">
              These cookies help us understand how visitors interact with our website by collecting 
              and reporting information anonymously.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Usage analytics:</strong> Track page views and user interactions</li>
              <li><strong>Performance monitoring:</strong> Identify technical issues</li>
              <li><strong>Feature usage:</strong> Understand which features are most popular</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Third-Party Cookies</h2>
            <p className="mb-4">
              We may use third-party services that set their own cookies:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Stripe:</strong> For secure payment processing (payment pages only)</li>
              <li><strong>Analytics services:</strong> For website performance monitoring</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Cookie Duration</h2>
            <p className="mb-4">Cookies may be either:</p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li><strong>Session cookies:</strong> Deleted when you close your browser</li>
              <li><strong>Persistent cookies:</strong> Remain on your device for a set period or until manually deleted</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Managing Cookies</h2>
            <p className="mb-4">
              You can control and manage cookies in several ways:
            </p>
            
            <h3 className="text-lg font-semibold mb-2">5.1 Browser Settings</h3>
            <p className="mb-4">
              Most browsers allow you to refuse cookies or delete existing ones. However, 
              this may affect website functionality.
            </p>
            
            <h3 className="text-lg font-semibold mb-2">5.2 Cookie Banner</h3>
            <p className="mb-4">
              When you first visit our website, you can choose which types of cookies to accept 
              through our cookie consent banner.
            </p>
            
            <h3 className="text-lg font-semibold mb-2">5.3 Opt-Out Links</h3>
            <p className="mb-4">
              For third-party analytics cookies, you can opt out directly through the service provider's website.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Cookie List</h2>
            <p className="mb-4">Here are the specific cookies we use:</p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-border rounded-lg">
                <thead className="bg-muted">
                  <tr>
                    <th className="border border-border px-4 py-2 text-left">Cookie Name</th>
                    <th className="border border-border px-4 py-2 text-left">Purpose</th>
                    <th className="border border-border px-4 py-2 text-left">Duration</th>
                    <th className="border border-border px-4 py-2 text-left">Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-4 py-2">connect.sid</td>
                    <td className="border border-border px-4 py-2">Session management and authentication</td>
                    <td className="border border-border px-4 py-2">7 days</td>
                    <td className="border border-border px-4 py-2">Essential</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">theme</td>
                    <td className="border border-border px-4 py-2">Remember dark/light mode preference</td>
                    <td className="border border-border px-4 py-2">1 year</td>
                    <td className="border border-border px-4 py-2">Functional</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">cookie-consent</td>
                    <td className="border border-border px-4 py-2">Remember your cookie preferences</td>
                    <td className="border border-border px-4 py-2">1 year</td>
                    <td className="border border-border px-4 py-2">Essential</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Changes to This Policy</h2>
            <p className="mb-4">
              We may update this Cookie Policy from time to time. Any changes will be posted on this page 
              with an updated revision date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Contact Us</h2>
            <p className="mb-4">
              If you have any questions about our use of cookies, please contact us at:
            </p>
            <p className="mb-2">Email: info@finanzerpro.com</p>
            <p>Address: NutriNova LLC, 2105 Vista Oeste NW, Albuquerque, NM 87120</p>
          </section>
        </div>
      </div>
    </div>
  );
}