import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Crown, Check, ArrowLeft, CreditCard } from "lucide-react";

export default function Subscribe() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  
  // Get plan from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const selectedPlan = urlParams.get('plan') || 'standard';

  const handleSubscribe = async (plan: string, interval: 'month' | 'year' = 'month') => {
    setLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan, interval }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        console.error('Failed to create checkout session');
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

  const currentPlan = plans[selectedPlan as keyof typeof plans];

  if (!currentPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Plan</CardTitle>
            <CardDescription>The selected plan is not available.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
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
            <h1 className="text-4xl font-bold mb-4">Subscribe to {currentPlan.name}</h1>
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
              <Card className="max-w-2xl mx-auto">
                <CardHeader className="text-center pb-8 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-transparent">
                  <div className={`p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center ${
                    selectedPlan === 'premium' 
                      ? 'bg-purple-100 dark:bg-purple-900' 
                      : 'bg-blue-100 dark:bg-blue-900'
                  }`}>
                    {selectedPlan === 'premium' ? (
                      <Crown className="h-8 w-8 text-purple-600" />
                    ) : (
                      <TrendingUp className="h-8 w-8 text-blue-600" />
                    )}
                  </div>
                  <CardTitle className="text-3xl">{currentPlan.name} Plan</CardTitle>
                  <div className={`text-5xl font-bold mb-2 ${
                    selectedPlan === 'premium' ? 'text-purple-600' : 'text-blue-600'
                  }`}>
                    ${currentPlan.monthly}
                    <span className="text-lg font-normal text-gray-500">/month</span>
                  </div>
                  <CardDescription>Billed monthly, cancel anytime</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-4 mb-8">
                    {currentPlan.features.map((feature, index) => (
                      <div key={index} className="flex items-center">
                        <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={() => handleSubscribe(selectedPlan, 'month')}
                    disabled={loading}
                    className={`w-full py-6 text-lg ${
                      selectedPlan === 'premium'
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    {loading ? 'Processing...' : `Subscribe for $${currentPlan.monthly}/month`}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="yearly">
              <Card className="max-w-2xl mx-auto">
                <CardHeader className="text-center pb-8 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-transparent">
                  <div className={`p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center ${
                    selectedPlan === 'premium' 
                      ? 'bg-purple-100 dark:bg-purple-900' 
                      : 'bg-blue-100 dark:bg-blue-900'
                  }`}>
                    {selectedPlan === 'premium' ? (
                      <Crown className="h-8 w-8 text-purple-600" />
                    ) : (
                      <TrendingUp className="h-8 w-8 text-blue-600" />
                    )}
                  </div>
                  <CardTitle className="text-3xl">{currentPlan.name} Plan</CardTitle>
                  <div className={`text-5xl font-bold mb-2 ${
                    selectedPlan === 'premium' ? 'text-purple-600' : 'text-blue-600'
                  }`}>
                    ${currentPlan.yearly}
                    <span className="text-lg font-normal text-gray-500">/year</span>
                  </div>
                  <CardDescription>
                    Save ${((currentPlan.monthly * 12) - currentPlan.yearly).toFixed(2)} per year
                  </CardDescription>
                  <Badge className="mt-2 bg-green-100 text-green-800">
                    Best Value - 17% Off
                  </Badge>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-4 mb-8">
                    {currentPlan.features.map((feature, index) => (
                      <div key={index} className="flex items-center">
                        <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={() => handleSubscribe(selectedPlan, 'year')}
                    disabled={loading}
                    className={`w-full py-6 text-lg ${
                      selectedPlan === 'premium'
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    {loading ? 'Processing...' : `Subscribe for $${currentPlan.yearly}/year`}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Already have an account */}
          <div className="text-center mt-8">
            <p className="text-gray-600 dark:text-gray-300">
              Already have an account?{' '}
              <button 
                onClick={() => setLocation('/auth')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign in here
              </button>
            </p>
          </div>

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