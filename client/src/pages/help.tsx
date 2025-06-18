import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  CreditCard, 
  Target, 
  Calendar, 
  PieChart, 
  Shield, 
  Bot, 
  Send,
  BookOpen,
  HelpCircle,
  Star,
  Clock,
  DollarSign,
  BarChart3,
  Cloud,
  Zap,
  Users,
  Lock,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Help() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! I'm your FinanzerPro assistant. I can help you with questions about using the app, subscription plans, features, and more. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setLocation('/auth#sign-in');
  };

  const sendChatMessage = async (message: string) => {
    setIsLoading(true);
    try {
      const data = await apiRequest('POST', '/api/help-chat', { message });
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: data.response,
        timestamp: new Date()
      }]);
    } catch (error) {
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I'm having trouble right now. Please try again later.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    sendChatMessage(chatInput);
    setChatInput("");
  };

  const faqItems = [
    {
      id: "getting-started",
      question: "How do I get started with FinanzerPro?",
      answer: "Simply create an account and start by adding your first transaction. You can manually enter expenses and income, or use our AI categorization feature (Standard+ plans) to automatically classify your transactions."
    },
    {
      id: "subscription-plans",
      question: "What are the differences between subscription plans?",
      answer: "Free plan allows 100 transactions, Standard plan ($4.99/month) includes up to 100 transactions with AI features, budgeting, and goals. Premium plan ($9.99/month) offers unlimited transactions, advanced analytics, cloud backup, and data import/export."
    },
    {
      id: "data-security",
      question: "Is my financial data secure?",
      answer: "Yes, we use industry-standard encryption and security measures. Your data is stored securely with PostgreSQL, and we offer cloud backup for Premium users. We never share your personal financial information."
    },
    {
      id: "ai-categorization",
      question: "How does AI categorization work?",
      answer: "Our AI analyzes your transaction descriptions and amounts to automatically suggest the most appropriate category. It learns from your patterns and becomes more accurate over time. Available for Standard and Premium plans."
    },
    {
      id: "budgets-goals",
      question: "How do I set up budgets and goals?",
      answer: "Navigate to the Budgets or Goals section from the sidebar. Set monthly spending limits by category for budgets, or create savings targets with deadlines for goals. The app will track your progress automatically."
    },
    {
      id: "data-export",
      question: "Can I export my data?",
      answer: "Yes, Premium users can export data in CSV, Excel, or JSON formats. You can also set up automatic cloud backups and import data from other financial apps like Mint, QuickBooks, and YNAB."
    },
    {
      id: "mobile-access",
      question: "Is FinanzerPro available on mobile?",
      answer: "FinanzerPro is a responsive web application that works perfectly on mobile browsers. Simply bookmark the site on your phone for easy access anywhere."
    },
    {
      id: "customer-support",
      question: "How can I get help or support?",
      answer: "You can use this AI chat assistant for immediate help, check our comprehensive documentation below, or contact our support team through the contact page for personalized assistance."
    }
  ];

  const planFeatures = {
    free: [
      "Up to 100 transactions",
      "Basic transaction tracking",
      "Simple dashboard",
      "Mobile responsive design"
    ],
    standard: [
      "Up to 100 transactions",
      "AI expense categorization",
      "Budget management",
      "Financial goals",
      "Transaction reminders",
      "Calendar view",
      "Basic reporting"
    ],
    premium: [
      "Unlimited transactions",
      "Advanced AI insights",
      "Trend predictions",
      "Cloud backup & sync",
      "Data import/export",
      "Advanced analytics",
      "Priority support",
      "Multiple data formats"
    ]
  };

  const planPricing = {
    free: "$0",
    standard: "$4.99",
    premium: "$9.99"
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header for anonymous users */}
      {!user && (
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <button 
                  onClick={() => setLocation('/')} 
                  className="flex items-center hover:opacity-80 transition-opacity"
                >
                  <TrendingUp className="h-8 w-8 text-primary mr-3" />
                  <span className="text-xl font-bold text-gray-900 dark:text-white">FinanzerPro</span>
                </button>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setLocation('/help')} 
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Help
                </button>
                <button 
                  onClick={() => setLocation('/contact')} 
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Contact
                </button>
                <Button onClick={handleLogin} className="bg-primary hover:bg-primary/90">
                  Sign In
                </Button>
              </div>
            </div>
          </div>
        </header>
      )}

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Documentation */}
        <div className="lg:col-span-2">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              FinanzerPro Documentation
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Complete guide to managing your finances with FinanzerPro's powerful features
            </p>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="guide">User Guide</TabsTrigger>
              <TabsTrigger value="faq">FAQ</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    Welcome to FinanzerPro
                  </CardTitle>
                  <CardDescription>
                    Your comprehensive personal finance management solution
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    FinanzerPro is a modern, intelligent personal finance application designed to help you 
                    take control of your financial future. With AI-powered insights, comprehensive tracking, 
                    and flexible subscription plans, managing your money has never been easier.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <BarChart3 className="h-8 w-8 text-blue-500 mt-1" />
                      <div>
                        <h3 className="font-semibold">Smart Analytics</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          AI-powered insights and trend predictions for better financial decisions
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <Shield className="h-8 w-8 text-green-500 mt-1" />
                      <div>
                        <h3 className="font-semibold">Secure Data Protection</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Your financial data is protected with industry-standard encryption
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <Cloud className="h-8 w-8 text-purple-500 mt-1" />
                      <div>
                        <h3 className="font-semibold">Cloud Backup</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Never lose your data with automatic cloud synchronization
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <Zap className="h-8 w-8 text-yellow-500 mt-1" />
                      <div>
                        <h3 className="font-semibold">AI Categorization</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Automatically categorize transactions with machine learning
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Transaction Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• Add income and expense transactions</li>
                      <li>• AI-powered automatic categorization</li>
                      <li>• Smart search and filtering</li>
                      <li>• Monthly view with dynamic navigation</li>
                      <li>• Recurring transaction detection</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Budgets & Goals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• Set monthly spending limits by category</li>
                      <li>• Track progress with visual indicators</li>
                      <li>• Create savings goals with deadlines</li>
                      <li>• Automatic budget vs. actual comparisons</li>
                      <li>• Smart notifications and reminders</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Analytics & Reports
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• Comprehensive financial dashboard</li>
                      <li>• Category-wise spending breakdown</li>
                      <li>• Trend analysis and predictions</li>
                      <li>• Income vs. expense comparisons</li>
                      <li>• Export data in multiple formats</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Smart Features
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• AI financial health scoring</li>
                      <li>• Personalized recommendations</li>
                      <li>• Calendar view of transactions</li>
                      <li>• Automatic backup scheduling</li>
                      <li>• Data import from other apps</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="plans" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="relative">
                  <CardHeader>
                    <CardTitle className="text-center">Free</CardTitle>
                    <CardDescription className="text-center">
                      <span className="text-3xl font-bold">$0</span>
                      <span className="text-sm">/month</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {planFeatures.free.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <div className="h-2 w-2 bg-green-500 rounded-full" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="relative border-primary">
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-center">Standard</CardTitle>
                    <CardDescription className="text-center">
                      <span className="text-3xl font-bold">$4.99</span>
                      <span className="text-sm">/month</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {planFeatures.standard.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <div className="h-2 w-2 bg-green-500 rounded-full" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="relative">
                  <CardHeader>
                    <CardTitle className="text-center">Premium</CardTitle>
                    <CardDescription className="text-center">
                      <span className="text-3xl font-bold">$9.99</span>
                      <span className="text-sm">/month</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {planFeatures.premium.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <div className="h-2 w-2 bg-green-500 rounded-full" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="guide" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-6 w-6" />
                    Quick Start Guide
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        1
                      </div>
                      <div>
                        <h3 className="font-semibold">Create Your Account</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Sign up for a free account to get started. You can upgrade to Standard or Premium anytime.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        2
                      </div>
                      <div>
                        <h3 className="font-semibold">Add Your First Transaction</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Navigate to the dashboard and click "Add Transaction" to record your first income or expense.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        3
                      </div>
                      <div>
                        <h3 className="font-semibold">Set Up Categories</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Choose from predefined categories or let AI automatically categorize your transactions.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        4
                      </div>
                      <div>
                        <h3 className="font-semibold">Create Budgets (Standard+)</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Set monthly spending limits by category to stay on track with your financial goals.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        5
                      </div>
                      <div>
                        <h3 className="font-semibold">Monitor Your Progress</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Use the dashboard and reports to track your spending patterns and achieve your financial goals.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-4">Key Features Walkthrough</h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Adding Transactions
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 ml-6">
                          Click the "+" button on the dashboard or navigate to Transactions → Add New. 
                          Fill in the amount, description, date, and category. AI will suggest categories for Standard+ users.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Managing Budgets
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 ml-6">
                          Go to Budgets section, click "Create Budget", select a category, set an amount and time period. 
                          The app will track your spending against the budget automatically.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Viewing Reports
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 ml-6">
                          Access Reports from the sidebar to see spending breakdowns, income vs. expenses, 
                          and category analysis. Use the month filter to view different time periods.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="faq" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-6 w-6" />
                    Frequently Asked Questions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {faqItems.map((item) => (
                      <div key={item.id} className="border rounded-lg">
                        <button
                          className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                          onClick={() => setExpandedFaq(expandedFaq === item.id ? null : item.id)}
                        >
                          <span className="font-medium">{item.question}</span>
                          {expandedFaq === item.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        {expandedFaq === item.id && (
                          <div className="p-4 pt-0 text-sm text-gray-600 dark:text-gray-300">
                            {item.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* AI Chat Assistant */}
        <div className="lg:col-span-1">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI Assistant
              </CardTitle>
              <CardDescription>
                Ask me anything about FinanzerPro
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 mb-4">
                <div className="space-y-4 pr-4">
                  {chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === "user"
                            ? "bg-primary text-white"
                            : "bg-gray-100 dark:bg-gray-800"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                        <p className="text-sm">Thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about FinanzerPro features..."
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isLoading}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}