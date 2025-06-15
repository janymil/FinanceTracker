import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Loader2, DollarSign, TrendingUp, Shield } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  plan: z.string().optional(),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
});

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("register");

  // Extract URL parameters from Stripe redirect
  const urlParams = new URLSearchParams(window.location.search);
  const selectedPlan = urlParams.get('plan') || 'free';
  const stripeSuccess = urlParams.get('success') === 'true';
  const stripeCustomer = urlParams.get('customer');
  const stripeSubscription = urlParams.get('subscription');
  const error = urlParams.get('error');

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      plan: selectedPlan,
    },
  });

  // Redirect if already logged in
  if (user) {
    setLocation("/");
    return null;
  }

  const onLogin = (data: z.infer<typeof loginSchema>) => {
    // Redirect to Clerk sign-in page
    setLocation("/sign-in-clerk");
  };

  const onRegister = (data: z.infer<typeof registerSchema>) => {
    // Redirect to Clerk sign-up page
    setLocation("/sign-up-clerk");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="space-y-6 text-center lg:text-left">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Take Control of Your Finances
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Track expenses, manage budgets, and achieve your financial goals with our comprehensive platform.
            </p>
          </div>

          <div className="grid gap-4 mt-8">
            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Smart Expense Tracking</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Categorize and monitor your spending automatically</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Financial Analytics</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Get insights with detailed charts and reports</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Secure & Private</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your financial data is encrypted and protected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Form */}
        <div className="w-full max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Welcome to FinanzerPro</CardTitle>
              <CardDescription>
                {stripeSuccess && selectedPlan ? (
                  <>Complete your {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} plan setup</>
                ) : error ? (
                  <span className="text-red-600">
                    {error === 'payment_not_completed' ? 'Payment was not completed' :
                     error === 'invalid_plan' ? 'Invalid plan selected' :
                     error === 'subscription_processing_failed' ? 'Subscription processing failed' :
                     'There was an error processing your request'}
                  </span>
                ) : (
                  'Create an account or sign in to get started'
                )}
              </CardDescription>
              {stripeSuccess && selectedPlan && (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✓ Subscription confirmed for {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} plan
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="register">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        {...loginForm.register("email")}
                        placeholder="Enter your email"
                      />
                      {loginForm.formState.errors.email && (
                        <p className="text-sm text-red-600">{loginForm.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        {...loginForm.register("password")}
                        placeholder="Enter your password"
                      />
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-red-600">{loginForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing In...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">

                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        {...registerForm.register("email")}
                        placeholder="Enter your email"
                      />
                      {registerForm.formState.errors.email && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <Input
                        id="register-password"
                        type="password"
                        {...registerForm.register("password")}
                        placeholder="Create a password"
                      />
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-red-600">{registerForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="register-firstName">First Name</Label>
                        <Input
                          id="register-firstName"
                          {...registerForm.register("firstName")}
                          placeholder="First name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-lastName">Last Name</Label>
                        <Input
                          id="register-lastName"
                          {...registerForm.register("lastName")}
                          placeholder="Last name"
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}