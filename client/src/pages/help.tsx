import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEO } from "@/components/SEO";
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
  Download,
  Clock,
  DollarSign,
  BarChart3,
  Cloud,
  Zap,
  Users,
  Lock,
  ChevronDown,
  ChevronRight,
  Camera
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useUser } from "@clerk/clerk-react";
import Header from "@/components/header";
import { AnonymousHeader } from "@/components/anonymous-header";
import { Footer } from "@/components/footer";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Help() {
  const { isSignedIn } = useUser();
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
      const response = await fetch('/api/help-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: data.response || "I'm sorry, I couldn't generate a response. Please try again.",
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Help chat error:', error);
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
      id: "receipt-ocr",
      question: "How does receipt scanning work?",
      answer: "Upload photos of receipts using the 'Upload Image' button on any transaction page. Our OCR technology automatically extracts merchant name, amount, and date. Standard+ users get AI-powered category suggestions. Works with mobile camera or gallery photos."
    },
    {
      id: "mobile-qr-upload",
      question: "How does mobile QR code upload work?",
      answer: "Click 'Upload Image' on your computer and select 'Scan with Phone'. A QR code appears on your screen. Scan it with your phone's camera to open the mobile upload page. Take a photo of your receipt on your phone, and the extracted data automatically appears in your computer's transaction form. Perfect for seamless cross-device receipt scanning."
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
      "Receipt OCR scanning",
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
    <>
      <SEO 
        title="Help & Documentation - FinanzerPro User Guide | Features & Support"
        description="Complete FinanzerPro documentation covering expense tracking, receipt OCR scanning, AI categorization, budgeting, goals, and all features. Get help with setup, troubleshooting, and maximizing your financial management."
        keywords="finanzerpro help, expense tracker guide, receipt scanning tutorial, AI categorization help, budget app documentation, personal finance support, financial management tutorial"
        canonical="https://finanzerpro.com/help"
      />
      {isSignedIn ? <Header onMenuClick={() => {}} sidebarCollapsed={false} /> : <AnonymousHeader />}
      <main className="px-4 py-6 max-w-7xl mx-auto">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start space-x-3">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <CreditCard className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">Smart Tracking</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Track expenses and income with AI-powered categorization and receipt scanning.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <Target className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">Budget & Goals</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Set budgets and financial goals with intelligent progress tracking.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <Bot className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">AI Insights</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Get personalized financial tips and spending pattern analysis.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <div className="bg-orange-100 p-2 rounded-lg">
                          <Shield className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">Secure & Private</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Bank-level security with encrypted data storage and backup options.
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
                    <CardTitle>Frequently Asked Questions</CardTitle>
                    <CardDescription>
                      Find answers to common questions about FinanzerPro
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {faqItems.map((item) => (
                        <div key={item.id} className="border rounded-lg">
                          <button
                            className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
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
                            <div className="px-4 pb-3 text-gray-600 dark:text-gray-300">
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

          {/* Sidebar with Chat */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI Assistant
                </CardTitle>
                <CardDescription>
                  Ask questions about FinanzerPro features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 mb-4 border rounded-lg p-3">
                  <div className="space-y-3">
                    {chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-2 rounded-lg text-sm ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg text-sm">
                          Typing...
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isLoading}
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={isLoading || !chatInput.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      {!isSignedIn && <Footer />}
    </>
  );
}