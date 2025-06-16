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
            <Card className={`border-2 relative ${isCurrentPlan('free') ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}`}>
              {isCurrentPlan('free') && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-green-500 text-white px-4 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}
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
                    <span>Up to 100 transaction entries</span>
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
                  variant={isCurrentPlan('free') ? "default" : "outline"}
                  disabled={isCurrentPlan('free')}
                >
                  {getButtonText('free')}
                </Button>
              </CardContent>
            </Card>

            {/* Standard Plan */}
            <Card className={`border-2 relative ${isCurrentPlan('standard') ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-blue-500'}`}>
              {isCurrentPlan('standard') ? (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-green-500 text-white px-4 py-1">
                    Current Plan
                  </Badge>
                </div>
              ) : (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white px-4 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
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
                  disabled={isCurrentPlan('standard')}
                >
                  {getButtonText('standard')}
                </Button>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className={`border-2 relative ${isCurrentPlan('premium') ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-purple-500'}`}>
              {isCurrentPlan('premium') && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-green-500 text-white px-4 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-8 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-transparent">
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Crown className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle className="text-2xl">Premium</CardTitle>
                <div className="text-4xl font-bold text-purple-600">
                  $9.99<span className="text-lg font-normal text-gray-500">/month</span>
                </div>
                <CardDescription>The ultimate financial management experience</CardDescription>
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
                  className="w-full mt-6 bg-purple-600 hover:bg-purple-700"
                  disabled={isCurrentPlan('premium')}
                >
                  {getButtonText('premium')}
                </Button>
              </CardContent>
            </Card>
            </div>
            </TabsContent>

            <TabsContent value="yearly">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Free Plan - Yearly */}
            <Card className={`border-2 relative ${isCurrentPlan('free') ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}`}>
              {isCurrentPlan('free') && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-green-500 text-white px-4 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}
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
                    <span>Up to 100 transaction entries</span>
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
                  variant={isCurrentPlan('free') ? "default" : "outline"}
                  disabled={isCurrentPlan('free')}
                >
                  {getButtonText('free')}
                </Button>
              </CardContent>
            </Card>

            {/* Standard Plan - Yearly */}
            <Card className={`border-2 relative ${isCurrentPlan('standard') ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-blue-500'}`}>
              {isCurrentPlan('standard') ? (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-green-500 text-white px-4 py-1">
                    Current Plan
                  </Badge>
                </div>
              ) : (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white px-4 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-8 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-transparent">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Standard</CardTitle>
                <div className="text-4xl font-bold text-blue-600">
                  $49.90<span className="text-lg font-normal text-gray-500">/year</span>
                </div>
                <div className="text-sm text-green-600 font-medium mt-1">Save $9.98 annually</div>
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
                  disabled={isCurrentPlan('standard')}
                >
                  {getButtonText('standard')}
                </Button>
              </CardContent>
            </Card>

            {/* Premium Plan - Yearly */}
            <Card className={`border-2 relative ${isCurrentPlan('premium') ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-purple-500'}`}>
              {isCurrentPlan('premium') && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-green-500 text-white px-4 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-8 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-transparent">
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Crown className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle className="text-2xl">Premium</CardTitle>
                <div className="text-4xl font-bold text-purple-600">
                  $99.90<span className="text-lg font-normal text-gray-500">/year</span>
                </div>
                <div className="text-sm text-green-600 font-medium mt-1">Save $19.98 annually</div>
                <CardDescription>The ultimate financial management experience</CardDescription>
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
                  className="w-full mt-6 bg-purple-600 hover:bg-purple-700"
                  disabled={isCurrentPlan('premium')}
                >
                  {getButtonText('premium')}
                </Button>
              </CardContent>
            </Card>
            </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}