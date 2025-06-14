import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, TrendingUp, ArrowLeft, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Subscribe() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan') || 'standard';
    setSelectedPlan(plan);
  }, []);

  const planConfig = {
    'standard': {
      name: 'Standard',
      price: '$4.99',
      yearlyPrice: '$49.90',
      description: 'For users serious about financial management',
      features: [
        'Everything in Free plan',
        'Goals and budget management',
        'Interactive charts and reports',
        'AI expense categorization',
        'Calendar view and reminders',
        'Unlimited transaction history'
      ]
    },
    'standard-yearly': {
      name: 'Standard (Yearly)',
      price: '$49.90',
      yearlyPrice: '$49.90',
      description: 'For users serious about financial management - Save 20 months',
      features: [
        'Everything in Free plan',
        'Goals and budget management',
        'Interactive charts and reports',
        'AI expense categorization',
        'Calendar view and reminders',
        'Unlimited transaction history'
      ]
    },
    'premium': {
      name: 'Premium',
      price: '$9.99',
      yearlyPrice: '$99.90',
      description: 'Complete AI-powered financial automation',
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
    },
    'premium-yearly': {
      name: 'Premium (Yearly)',
      price: '$99.90',
      yearlyPrice: '$99.90',
      description: 'Complete AI-powered financial automation - Save 20 months',
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

  const handleSubscribe = async () => {
    if (!user) {
      setLocation('/login');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: selectedPlan,
          userId: user.id
        }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start subscription process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = planConfig[selectedPlan as keyof typeof planConfig];
  const isYearly = selectedPlan.includes('-yearly');

  if (!currentPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Plan</CardTitle>
            <CardDescription>The selected plan is not available.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/pricing')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pricing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/pricing')}
          className="mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pricing
        </Button>

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Subscribe to {currentPlan.name}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {currentPlan.description}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Plan Details */}
          <Card className="border-2 border-blue-500">
            <CardHeader className="text-center pb-8">
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                {selectedPlan.includes('premium') ? (
                  <Crown className="h-8 w-8 text-premium" />
                ) : (
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                )}
              </div>
              <CardTitle className="text-2xl">{currentPlan.name}</CardTitle>
              <div className="text-4xl font-bold text-blue-600">
                {currentPlan.price}
                <span className="text-lg font-normal text-gray-500">
                  {isYearly ? '/year' : '/month'}
                </span>
              </div>
              {isYearly && (
                <Badge className="bg-green-500 text-white mt-2">
                  Save {selectedPlan.includes('premium') ? '$19.98' : '$9.98'}
                </Badge>
              )}
              <CardDescription>{currentPlan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currentPlan.features.map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <Check className="h-5 w-5 text-success mr-3 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Complete Your Subscription
              </CardTitle>
              <CardDescription>
                You'll be redirected to our secure payment processor to complete your subscription.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  What happens next?
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Secure payment processing via Stripe</li>
                  <li>• 7-day free trial (no charge today)</li>
                  <li>• Cancel anytime with one click</li>
                  <li>• Instant access to all features</li>
                </ul>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>Plan</span>
                  <span className="font-semibold">{currentPlan.name}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>Billing</span>
                  <span className="font-semibold">{isYearly ? 'Yearly' : 'Monthly'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <span>Price</span>
                  <span className="font-semibold">{currentPlan.price}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                  <span>Today's charge</span>
                  <span className="font-semibold text-green-600">$0.00 (Free trial)</span>
                </div>
              </div>

              <Button 
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                {loading ? 'Processing...' : 'Start Free Trial'}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                By subscribing, you agree to our Terms of Service and Privacy Policy. 
                Your subscription will automatically renew unless cancelled.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}