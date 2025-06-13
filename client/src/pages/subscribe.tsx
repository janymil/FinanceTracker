
import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ArrowLeft, Check } from "lucide-react";
import { Link } from "wouter";

const stripePublicKey = import.meta.env.STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

type PlanType = 'standard' | 'premium';

interface PlanDetails {
  name: string;
  price: number;
  description: string;
  features: string[];
  recommended?: boolean;
}

const plans: Record<PlanType, PlanDetails> = {
  standard: {
    name: 'Standard Plan',
    price: 4.99,
    description: 'Enhanced financial tracking with more features',
    features: [
      'Everything in Free plan',
      'Advanced budget tracking',
      'Basic analytics & charts',
      'Up to 100 transactions per month',
      'Email support',
      'Data export (CSV)',
    ],
  },
  premium: {
    name: 'Premium Plan',
    price: 9.99,
    description: 'Complete financial control with advanced features',
    features: [
      'Everything in Standard plan',
      'AI-powered insights',
      'Interactive charts & analytics',
      'Unlimited transaction history',
      'Advanced expense categorization',
      'Data export (CSV, PDF)',
      'Advanced filtering & search',
      'Priority email support',
    ],
    recommended: true,
  },
};

const SubscribeForm = ({ selectedPlan }: { selectedPlan: PlanType }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
    });

    setIsProcessing(false);

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: `Welcome to ${plans[selectedPlan].name}! You now have access to enhanced features.`,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full bg-premium hover:bg-premium/90"
      >
        {isProcessing ? (
          <div className="flex items-center">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
            Processing...
          </div>
        ) : (
          <>
            <Crown className="h-4 w-4 mr-2" />
            Start {plans[selectedPlan].name}
          </>
        )}
      </Button>
    </form>
  );
};

export default function Subscribe() {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('premium');
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!stripePublicKey) {
      setIsLoading(false);
      return;
    }

    const createSubscription = async () => {
      try {
        const res = await apiRequest("POST", "/api/get-or-create-subscription", {
          plan: selectedPlan
        });
        const data = await res.json();
        setClientSecret(data.clientSecret);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    createSubscription();
  }, [toast, selectedPlan]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!stripePublicKey) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-md mx-auto px-4">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-orange-600">Payment Service Unavailable</CardTitle>
              <CardDescription>
                Payment processing is currently being configured. Please check back soon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-md mx-auto px-4">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-red-600">Payment Error</CardTitle>
              <CardDescription>
                Unable to initialize payment. Please try again later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-premium-light p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <Crown className="h-10 w-10 text-premium" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Choose Your Plan
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Unlock advanced financial analytics and take complete control of your money
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Plan Selection */}
          <div className="lg:col-span-2 space-y-6">
            {Object.entries(plans).map(([planKey, plan]) => (
              <Card 
                key={planKey}
                className={`cursor-pointer transition-all ${
                  selectedPlan === planKey 
                    ? 'border-2 border-premium ring-2 ring-premium/20' 
                    : 'border hover:border-premium/50'
                }`}
                onClick={() => setSelectedPlan(planKey as PlanType)}
              >
                <CardHeader className={`${
                  plan.recommended 
                    ? 'bg-gradient-to-br from-premium-light to-white dark:from-premium/20 dark:to-transparent' 
                    : ''
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        selectedPlan === planKey 
                          ? 'bg-premium border-premium' 
                          : 'border-gray-300'
                      }`} />
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      {plan.recommended && (
                        <Badge className="bg-premium text-white">
                          <Crown className="h-3 w-3 mr-1" />
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-premium">
                        ${plan.price}<span className="text-lg font-normal text-gray-500">/month</span>
                      </div>
                    </div>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center">
                      <Check className="h-4 w-4 text-success mr-3 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Payment Form */}
          <Card className="lg:sticky lg:top-8 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Crown className="h-5 w-5 text-premium mr-2" />
                Complete Your Subscription
              </CardTitle>
              <CardDescription>
                Start your 7-day free trial of {plans[selectedPlan].name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stripePromise ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <SubscribeForm selectedPlan={selectedPlan} />
                </Elements>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">Payment processing unavailable</p>
                </div>
              )}
              
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span>{plans[selectedPlan].name} (Monthly)</span>
                  <span className="font-medium">${plans[selectedPlan].price}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span>7-day free trial</span>
                  <span>$0.00</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between items-center font-medium">
                  <span>Total due today</span>
                  <span>$0.00</span>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                By subscribing, you agree to our Terms of Service and Privacy Policy. Cancel anytime.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
