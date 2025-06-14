
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, TrendingUp, Star } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  const handleGetStarted = (plan: string) => {
    if (user) {
      if (plan === 'free') {
        setLocation("/dashboard");
      } else {
        setLocation("/subscribe");
      }
    } else {
      setLocation("/auth");
    }
  };

  const features = [
    {
      name: "Registration and Login",
      free: true,
      standard: true,
      premium: true
    },
    {
      name: "Income and Expense Tracking",
      free: true,
      standard: true,
      premium: true
    },
    {
      name: "Manual Categories",
      free: true,
      standard: true,
      premium: true
    },
    {
      name: "Financial Overview",
      free: "Basic (Last 3 transactions)",
      standard: true,
      premium: true
    },
    {
      name: "Personalized Financial Tips",
      free: true,
      standard: true,
      premium: true
    },
    {
      name: "Goals and Budget Management",
      free: false,
      standard: true,
      premium: true
    },
    {
      name: "Charts and Reports",
      free: false,
      standard: true,
      premium: true
    },
    {
      name: "AI Expense Categorization",
      free: false,
      standard: true,
      premium: true
    },
    {
      name: "Calendar View",
      free: false,
      standard: true,
      premium: true
    },
    {
      name: "Reminders and Streaks",
      free: false,
      standard: true,
      premium: true
    },
    {
      name: "Data Management (CSV, PDF)",
      free: false,
      standard: false,
      premium: true
    },
    {
      name: "AI Financial Tips & Insights",
      free: false,
      standard: false,
      premium: true
    },
    {
      name: "Advanced Trends Analysis",
      free: false,
      standard: false,
      premium: true
    },
    {
      name: "Expense Prediction",
      free: false,
      standard: false,
      premium: true
    },
    {
      name: "Daily Personalized Recommendations",
      free: false,
      standard: false,
      premium: true
    },
    {
      name: "Cloud Data Backup",
      free: false,
      standard: false,
      premium: true
    },
    {
      name: "Priority Support",
      free: false,
      standard: false,
      premium: true
    }
  ];

  const renderFeatureValue = (value: boolean | string) => {
    if (value === true) {
      return <Check className="h-5 w-5 text-success" />;
    } else if (value === false) {
      return <X className="h-5 w-5 text-gray-400" />;
    } else {
      return <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setLocation("/")}>
              <TrendingUp className="h-8 w-8 text-primary mr-2" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">FinanceFlow</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setLocation("/")}>
                Home
              </Button>
              {user ? (
                <Button onClick={() => setLocation("/dashboard")} className="bg-primary hover:bg-primary/90">
                  Dashboard
                </Button>
              ) : (
                <Button onClick={() => setLocation("/auth")} className="bg-primary hover:bg-primary/90">
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Perfect
            <span className="text-primary block">Financial Plan</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Start free and upgrade as your financial management needs grow. Every plan includes industry-standard security and privacy protection.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Free Plan */}
            <Card className="border-2 relative">
              <CardHeader className="text-center pb-8">
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Star className="h-8 w-8 text-gray-600 dark:text-gray-300" />
                </div>
                <CardTitle className="text-2xl">Free</CardTitle>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  $0<span className="text-lg font-normal text-gray-500">/month</span>
                </div>
                <CardDescription>Perfect for getting started with expense tracking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Basic expense and income tracking</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Manual categorization</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Last 3 transactions view</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Simple financial overview</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Personalized financial tips</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleGetStarted('free')} 
                  className="w-full mt-6" 
                  variant="outline"
                >
                  Get Started Free
                </Button>
              </CardContent>
            </Card>

            {/* Standard Plan */}
            <Card className="border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-500 text-white px-4 py-1">
                  Most Popular
                </Badge>
              </div>
              <CardHeader className="text-center pb-8 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-transparent">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Standard</CardTitle>
                <div className="text-4xl font-bold text-blue-600">
                  $7.99<span className="text-lg font-normal text-gray-500">/month</span>
                </div>
                <CardDescription>For users serious about financial management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Everything in Free plan</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Goals and budget management</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Interactive charts and reports</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>AI expense categorization</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Calendar view and reminders</span>
                  </div>
                  
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Unlimited transaction history</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleGetStarted('standard')} 
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700"
                >
                  Start 7-Day Free Trial
                </Button>
                <p className="text-xs text-gray-500 text-center">No credit card required</p>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="border-2 border-premium relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-premium text-white px-4 py-1">
                  <Crown className="h-4 w-4 mr-1" />
                  AI Powered
                </Badge>
              </div>
              <CardHeader className="text-center pb-8 bg-gradient-to-br from-premium-light to-white dark:from-premium/20 dark:to-transparent">
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Crown className="h-8 w-8 text-premium" />
                </div>
                <CardTitle className="text-2xl">Premium</CardTitle>
                <div className="text-4xl font-bold text-premium">
                  $14.99<span className="text-lg font-normal text-gray-500">/month</span>
                </div>
                <CardDescription>Complete AI-powered financial automation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Everything in Standard plan</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>AI financial tips and insights</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Advanced trends analysis</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Expense prediction</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Daily personalized recommendations</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Cloud data backup</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Data management (CSV, PDF)</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3" />
                    <span>Priority email support</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleGetStarted('premium')} 
                  className="w-full mt-6 bg-premium hover:bg-premium/90"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Start Premium Trial
                </Button>
                <p className="text-xs text-gray-500 text-center">7-day free trial included</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Compare All Features
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              See exactly what's included in each plan
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left p-6 font-semibold text-gray-900 dark:text-white">Features</th>
                  <th className="text-center p-6 font-semibold text-gray-900 dark:text-white">Free</th>
                  <th className="text-center p-6 font-semibold text-blue-600">Standard</th>
                  <th className="text-center p-6 font-semibold text-premium">Premium</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="p-6 text-gray-900 dark:text-white font-medium">{feature.name}</td>
                    <td className="p-6 text-center">{renderFeatureValue(feature.free)}</td>
                    <td className="p-6 text-center">{renderFeatureValue(feature.standard)}</td>
                    <td className="p-6 text-center">{renderFeatureValue(feature.premium)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Can I switch between plans?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately for upgrades, 
                and at the end of your billing cycle for downgrades.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Is my financial data secure?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Absolutely. We use industry-standard encryption and security measures to protect your data. 
                We never store your bank login credentials and all data is encrypted both in transit and at rest.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                What happens if I cancel my subscription?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                You can cancel anytime and you'll retain access to paid features until the end of your billing period. 
                After that, your account will automatically switch to the free plan.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                We offer a 7-day free trial for all paid plans, so you can try before you buy. 
                If you're not satisfied within the first 7 days, we'll provide a full refund.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Take Control of Your Finances?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join thousands of users who have transformed their financial habits with FinanceFlow
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => handleGetStarted('free')} 
              size="lg" 
              className="bg-white text-primary hover:bg-gray-100 text-lg px-8 py-3"
            >
              Start Free Today
            </Button>
            <Button 
              onClick={() => handleGetStarted('standard')} 
              size="lg" 
              variant="outline" 
              className="border-white text-white hover:bg-white hover:text-primary text-lg px-8 py-3"
            >
              Try Premium Free
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
