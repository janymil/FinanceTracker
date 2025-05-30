import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Shield, DollarSign, BarChart3, Crown, Check } from "lucide-react";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();
  
  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-primary mr-2" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">FinanceFlow</span>
            </div>
            <Button onClick={handleLogin} className="bg-primary hover:bg-primary/90">
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Take Control of Your
            <span className="text-primary block">Financial Future</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Track expenses, manage budgets, and gain insights into your spending patterns with our comprehensive financial management platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={handleLogin} size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-3">
              Get Started Free
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-3">
              View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need to Manage Your Money
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Powerful tools designed to give you complete financial control
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Expense Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Automatically categorize and track all your expenses with detailed insights.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <BarChart3 className="h-8 w-8 text-success" />
                </div>
                <CardTitle>Budget Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Set budgets by category and get alerts when you're close to limits.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-premium" />
                </div>
                <CardTitle>Financial Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Interactive charts and reports to understand your spending patterns.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-gray-600 dark:text-gray-300" />
                </div>
                <CardTitle>Secure & Private</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Bank-level security to keep your financial data safe and private.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Start free and upgrade when you need more features
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <Card className="border-2">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl">Free Plan</CardTitle>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  $0<span className="text-lg font-normal text-gray-500">/month</span>
                </div>
                <CardDescription>Perfect for getting started</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-success mr-3" />
                  <span>Basic expense tracking</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-success mr-3" />
                  <span>Simple financial overview</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-success mr-3" />
                  <span>Last 3 transactions view</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-success mr-3" />
                  <span>Basic categorization</span>
                </div>
                <Button onClick={handleLogin} className="w-full mt-6" variant="outline">
                  Get Started Free
                </Button>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="border-2 border-premium relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-premium text-white px-4 py-1">
                  <Crown className="h-4 w-4 mr-1" />
                  Recommended
                </Badge>
              </div>
              <CardHeader className="text-center pb-8 bg-gradient-to-br from-premium-light to-white dark:from-premium/20 dark:to-transparent">
                <CardTitle className="text-2xl">Premium Plan</CardTitle>
                <div className="text-4xl font-bold text-premium">
                  $9.99<span className="text-lg font-normal text-gray-500">/month</span>
                </div>
                <CardDescription>Complete financial control</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-success mr-3" />
                  <span>Everything in Free plan</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-success mr-3" />
                  <span>Interactive charts & analytics</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-success mr-3" />
                  <span>Unlimited transaction history</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-success mr-3" />
                  <span>Advanced budget tracking</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-success mr-3" />
                  <span>Data export (CSV, PDF)</span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-success mr-3" />
                  <span>Priority email support</span>
                </div>
                <Button onClick={handleLogin} className="w-full mt-6 bg-premium hover:bg-premium/90">
                  <Crown className="h-4 w-4 mr-2" />
                  Start Premium Trial
                </Button>
                <p className="text-xs text-gray-500 text-center">7-day free trial</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <TrendingUp className="h-8 w-8 text-primary mr-2" />
              <span className="text-xl font-bold">FinanceFlow</span>
            </div>
            <p className="text-gray-400 mb-8">
              Take control of your financial future with intelligent expense tracking and budgeting.
            </p>
            <div className="border-t border-gray-800 pt-8">
              <p className="text-gray-400">
                © 2025 FinanceFlow. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
