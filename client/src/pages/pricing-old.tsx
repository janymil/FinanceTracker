import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Crown, TrendingUp, Star } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  // Get user's current plan
  const userPlan = user && 'plan' in user && user.plan ? user.plan : 'free';
  
  const handleGetStarted = (plan: string) => {
    if (user) {
      if (plan === 'free') {
        setLocation('/dashboard');
      } else {
        setLocation(`/subscribe?plan=${plan}`);
      }
    } else {
      setLocation('/sign-in-clerk');
    }
  };

  const getButtonText = (plan: string) => {
    if (userPlan === plan) {
      return 'This is your plan';
    }
    if (plan === 'free') {
      return 'Get Started Free';
    }
    return 'Subscribe Now';
  };

  const isCurrentPlan = (plan: string) => userPlan === plan;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Choose Your Perfect
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600"> Financial Plan</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              From basic expense tracking to AI-powered financial insights, we have the right plan for every financial journey.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="monthly" className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="monthly">
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
                  $4.99<span className="text-lg font-normal text-gray-500">/month</span>
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
                  Subscribe Now
                </Button>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="border-2 border-premium relative">
              <CardHeader className="text-center pb-8 bg-gradient-to-br from-premium-light to-white dark:from-premium/20 dark:to-transparent">
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Crown className="h-8 w-8 text-premium" />
                </div>
                <CardTitle className="text-2xl">Premium</CardTitle>
                <div className="text-4xl font-bold text-premium">
                  $9.99<span className="text-lg font-normal text-gray-500">/month</span>
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
                  Subscribe Now
                </Button>
              </CardContent>
            </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="yearly">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Free Plan */}
            <Card className="border-2 relative">
              <CardHeader className="text-center pb-8">
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Star className="h-8 w-8 text-gray-600 dark:text-gray-300" />
                </div>
                <CardTitle className="text-2xl">Free</CardTitle>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  $0<span className="text-lg font-normal text-gray-500">/year</span>
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
                <Badge className="bg-green-500 text-white px-4 py-1">
                  Save $9.98
                </Badge>
              </div>
              <CardHeader className="text-center pb-8 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-transparent">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Standard</CardTitle>
                <div className="text-4xl font-bold text-blue-600">
                  $49.90<span className="text-lg font-normal text-gray-500">/year</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  $4.16/month • Save 2 months
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
                  onClick={() => handleGetStarted('standard-yearly')} 
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700"
                >
                  Subscribe Now
                </Button>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="border-2 border-premium relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-green-500 text-white px-4 py-1">
                  Save $19.98
                </Badge>
              </div>
              <CardHeader className="text-center pb-8 bg-gradient-to-br from-premium-light to-white dark:from-premium/20 dark:to-transparent">
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Crown className="h-8 w-8 text-premium" />
                </div>
                <CardTitle className="text-2xl">Premium</CardTitle>
                <div className="text-4xl font-bold text-premium">
                  $99.90<span className="text-lg font-normal text-gray-500">/year</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  $8.33/month • Save 2 months
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
                  onClick={() => handleGetStarted('premium-yearly')} 
                  className="w-full mt-6 bg-premium hover:bg-premium/90"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Subscribe Now
                </Button>
              </CardContent>
            </Card>
              </div>
            </TabsContent>
          </Tabs>
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
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="p-6 font-medium text-gray-900 dark:text-white">Basic expense tracking</td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="p-6 font-medium text-gray-900 dark:text-white">Transaction history</td>
                  <td className="p-6 text-center text-gray-500">Last 3</td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="p-6 font-medium text-gray-900 dark:text-white">Budget management</td>
                  <td className="p-6 text-center"><X className="h-5 w-5 text-gray-400 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="p-6 font-medium text-gray-900 dark:text-white">AI categorization</td>
                  <td className="p-6 text-center"><X className="h-5 w-5 text-gray-400 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="p-6 font-medium text-gray-900 dark:text-white">Financial insights</td>
                  <td className="p-6 text-center"><X className="h-5 w-5 text-gray-400 mx-auto" /></td>
                  <td className="p-6 text-center"><X className="h-5 w-5 text-gray-400 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="p-6 font-medium text-gray-900 dark:text-white">Cloud backup</td>
                  <td className="p-6 text-center"><X className="h-5 w-5 text-gray-400 mx-auto" /></td>
                  <td className="p-6 text-center"><X className="h-5 w-5 text-gray-400 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr>
                  <td className="p-6 font-medium text-gray-900 dark:text-white">Priority support</td>
                  <td className="p-6 text-center"><X className="h-5 w-5 text-gray-400 mx-auto" /></td>
                  <td className="p-6 text-center"><X className="h-5 w-5 text-gray-400 mx-auto" /></td>
                  <td className="p-6 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
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
                Can I cancel my subscription anytime?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Yes, you can cancel your subscription at any time. Your access will continue until the end of your current billing period.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Is there a free trial for paid plans?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                No, there is no free trial for paid plans. However, you can start with our free plan to explore basic features before upgrading to Standard or Premium.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                How secure is my financial data?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                We use industry-standard encryption to protect your data. Your information is encrypted both in transit and at rest.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}