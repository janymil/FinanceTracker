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

const SubscribeForm = () => {
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
        description: "Welcome to Premium! You now have access to all advanced features.",
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
            Start Premium Subscription
          </>
        )}
      </Button>
    </form>
  );
};

export default function Subscribe() {
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
        const res = await apiRequest("POST", "/api/get-or-create-subscription");
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
  }, [toast]);

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
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-premium-light p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <Crown className="h-10 w-10 text-premium" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Upgrade to Premium
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Unlock advanced financial analytics and take complete control of your money
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Plan Details */}
          <Card className="border-2 border-premium">
            <CardHeader className="bg-gradient-to-br from-premium-light to-white dark:from-premium/20 dark:to-transparent">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Premium Plan</CardTitle>
                <Badge className="bg-premium text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Popular
                </Badge>
              </div>
              <div className="text-3xl font-bold text-premium">
                $9.99<span className="text-lg font-normal text-gray-500">/month</span>
              </div>
              <CardDescription>Complete financial control with advanced features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center">
                <Check className="h-4 w-4 text-success mr-3 flex-shrink-0" />
                <span className="text-sm">Everything in Free plan</span>
              </div>
              <div className="flex items-center">
                <Check className="h-4 w-4 text-success mr-3 flex-shrink-0" />
                <span className="text-sm">Interactive charts & analytics</span>
              </div>
              <div className="flex items-center">
                <Check className="h-4 w-4 text-success mr-3 flex-shrink-0" />
                <span className="text-sm">Unlimited transaction history</span>
              </div>
              <div className="flex items-center">
                <Check className="h-4 w-4 text-success mr-3 flex-shrink-0" />
                <span className="text-sm">Advanced budget tracking</span>
              </div>
              <div className="flex items-center">
                <Check className="h-4 w-4 text-success mr-3 flex-shrink-0" />
                <span className="text-sm">Expense categorization</span>
              </div>
              <div className="flex items-center">
                <Check className="h-4 w-4 text-success mr-3 flex-shrink-0" />
                <span className="text-sm">Data export (CSV, PDF)</span>
              </div>
              <div className="flex items-center">
                <Check className="h-4 w-4 text-success mr-3 flex-shrink-0" />
                <span className="text-sm">Advanced filtering & search</span>
              </div>
              <div className="flex items-center">
                <Check className="h-4 w-4 text-success mr-3 flex-shrink-0" />
                <span className="text-sm">Priority email support</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Crown className="h-5 w-5 text-premium mr-2" />
                Complete Your Subscription
              </CardTitle>
              <CardDescription>
                Start your 7-day free trial of Premium features
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stripePromise ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <SubscribeForm />
                </Elements>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">Payment processing unavailable</p>
                </div>
              )}
              
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span>Premium Plan (Monthly)</span>
                  <span className="font-medium">$9.99</span>
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
