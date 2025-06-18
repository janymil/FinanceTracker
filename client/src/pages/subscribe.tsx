import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Crown, Check, ArrowLeft, CreditCard } from "lucide-react";

export default function Subscribe() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  
  const handleSubscribe = async (plan: string, interval: 'month' | 'year' = 'month') => {
    if (!user) {
      setLocation('/auth');
      return;
    }
    
    setLoading(true);
    try {
      // Get the Clerk session token for authentication
      const token = await window.Clerk?.session?.getToken();
      
      const planName = interval === 'year' ? `${plan}-yearly` : plan;
      
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planName }),
      });

      if (response.ok) {
        const { url } = await response.json();
        console.log('Stripe checkout URL received:', url);
        if (url) {
          console.log('Redirecting to Stripe checkout...');
          // Don't set loading to false here since we're redirecting
          window.location.href = url;
          return; // Exit the function after redirect
        } else {
          console.error('No URL received from checkout session');
          setLoading(false);
        }
      } else {
        const error = await response.json();
        console.error('Failed to create checkout session:', error);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setLoading(false);
    }
  };

  const plans = {
    standard: {
      name: 'Standard',
      monthly: 4.99,
      yearly: 49.90,
      features: [
        'Everything in Free plan',
        'Goals and budget management',
        'Interactive charts and reports',
        'AI expense categorization',
        'Calendar view and reminders',
        'Unlimited transaction history'
      ]
    },
    premium: {
      name: 'Premium',
      monthly: 9.99,
      yearly: 99.90,
      features: [
        'Everything in Standard plan',
        'AI financial tips and insights',
        'Advanced trends analysis',
        'Expense prediction',
        'Daily personalized recommendations',
        'Cloud data backup',
        'Data management (CSV, PDF)',
        'Priority email support'
      ]
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Unlock powerful financial management features with your subscription
            </p>
          </div>

          {/* Billing Toggle */}
          <Tabs defaultValue="monthly" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">
                Yearly 
                <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                  Save 17%
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="monthly">
              <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {/* Standard Plan */}
                <Card className="relative">
                  <CardHeader className="text-center pb-8 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-transparent">
                    <div className="p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-blue-100 dark:bg-blue-900">
                      <TrendingUp className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-3xl">{plans.standard.name} Plan</CardTitle>
                    <div className="text-5xl font-bold mb-2 text-blue-600">
                      ${plans.standard.monthly}
                      <span className="text-lg font-normal text-gray-500">/month</span>
                    </div>
                    <CardDescription>Billed monthly, cancel anytime</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4 mb-8">
                      {plans.standard.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      onClick={() => handleSubscribe('standard', 'month')}
                      disabled={loading}
                      className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700"
                    >
                      <CreditCard className="h-5 w-5 mr-2" />
                      {loading ? 'Processing...' : `Subscribe for $${plans.standard.monthly}/month`}
                    </Button>
                  </CardContent>
                </Card>

                {/* Premium Plan */}
                <Card className="relative border-purple-200 dark:border-purple-800">
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-purple-600 text-white px-4 py-1">
                      <Crown className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                  <CardHeader className="text-center pb-8 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-transparent">
                    <div className="p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-purple-100 dark:bg-purple-900">
                      <Crown className="h-8 w-8 text-purple-600" />
                    </div>
                    <CardTitle className="text-3xl">{plans.premium.name} Plan</CardTitle>
                    <div className="text-5xl font-bold mb-2 text-purple-600">
                      ${plans.premium.monthly}
                      <span className="text-lg font-normal text-gray-500">/month</span>
                    </div>
                    <CardDescription>Billed monthly, cancel anytime</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4 mb-8">
                      {plans.premium.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      onClick={() => handleSubscribe('premium', 'month')}
                      disabled={loading}
                      className="w-full py-6 text-lg bg-purple-600 hover:bg-purple-700"
                    >
                      <CreditCard className="h-5 w-5 mr-2" />
                      {loading ? 'Processing...' : `Subscribe for $${plans.premium.monthly}/month`}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="yearly">
              <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {/* Standard Plan - Yearly */}
                <Card className="relative">
                  <CardHeader className="text-center pb-8 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-transparent">
                    <div className="p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-blue-100 dark:bg-blue-900">
                      <TrendingUp className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-3xl">{plans.standard.name} Plan</CardTitle>
                    <div className="text-5xl font-bold mb-2 text-blue-600">
                      ${plans.standard.yearly}
                      <span className="text-lg font-normal text-gray-500">/year</span>
                    </div>
                    <CardDescription>
                      Save ${((plans.standard.monthly * 12) - plans.standard.yearly).toFixed(2)} per year
                    </CardDescription>
                    <Badge className="mt-2 bg-green-100 text-green-800">
                      17% Off
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4 mb-8">
                      {plans.standard.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      onClick={() => handleSubscribe('standard', 'year')}
                      disabled={loading}
                      className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700"
                    >
                      <CreditCard className="h-5 w-5 mr-2" />
                      {loading ? 'Processing...' : `Subscribe for $${plans.standard.yearly}/year`}
                    </Button>
                  </CardContent>
                </Card>

                {/* Premium Plan - Yearly */}
                <Card className="relative border-purple-200 dark:border-purple-800">
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-purple-600 text-white px-4 py-1">
                      <Crown className="h-3 w-3 mr-1" />
                      Best Value
                    </Badge>
                  </div>
                  <CardHeader className="text-center pb-8 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-transparent">
                    <div className="p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-purple-100 dark:bg-purple-900">
                      <Crown className="h-8 w-8 text-purple-600" />
                    </div>
                    <CardTitle className="text-3xl">{plans.premium.name} Plan</CardTitle>
                    <div className="text-5xl font-bold mb-2 text-purple-600">
                      ${plans.premium.yearly}
                      <span className="text-lg font-normal text-gray-500">/year</span>
                    </div>
                    <CardDescription>
                      Save ${((plans.premium.monthly * 12) - plans.premium.yearly).toFixed(2)} per year
                    </CardDescription>
                    <Badge className="mt-2 bg-green-100 text-green-800">
                      Best Value - 17% Off
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4 mb-8">
                      {plans.premium.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      onClick={() => handleSubscribe('premium', 'year')}
                      disabled={loading}
                      className="w-full py-6 text-lg bg-purple-600 hover:bg-purple-700"
                    >
                      <CreditCard className="h-5 w-5 mr-2" />
                      {loading ? 'Processing...' : `Subscribe for $${plans.premium.yearly}/year`}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Only show sign-in text for non-logged-in users */}
          {!user && (
            <div className="text-center mt-8">
              <p className="text-gray-600 dark:text-gray-300">
                Already have an account?{' '}
                <a 
                  href="/sign-in-clerk"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign in here
                </a>
              </p>
            </div>
          )}

          {/* Security & Terms */}
          <div className="text-center mt-8 space-y-2">
            <p className="text-sm text-gray-500">
              Secure payment processing by Stripe
            </p>
            <p className="text-xs text-gray-400">
              By subscribing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}