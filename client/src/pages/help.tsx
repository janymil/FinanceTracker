import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AppLayout } from "@/components/AppLayout";
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
import { AnonymousHeader } from "@/components/anonymous-header";
import { useTranslation } from "react-i18next";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Help() {
  const { t } = useTranslation();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: t('help.chat.initial_message'),
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
        content: data.response || t('help.chat.error_response'),
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Help chat error:', error);
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: t('help.chat.error_response'),
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
      question: t("How do I get started with FinanzerPro?"),
      answer: t("Simply create an account and start by adding your first transaction. You can manually enter expenses and income, or use our AI categorization feature (Standard+ plans) to automatically classify your transactions.")
    },
    {
      id: "subscription-plans",
      question: t("What are the differences between subscription plans?"),
      answer: t("Free plan allows 100 transactions, Standard plan ($4.99/month) includes up to 100 transactions with AI features, budgeting, and goals. Premium plan ($9.99/month) offers unlimited transactions, advanced analytics, cloud backup, and data import/export.")
    },
    {
      id: "data-security",
      question: t("Is my financial data secure?"),
      answer: t("Yes, we use industry-standard encryption and security measures. Your data is stored securely with PostgreSQL, and we offer cloud backup for Premium users. We never share your personal financial information.")
    },
    {
      id: "ai-categorization",
      question: t("How does AI categorization work?"),
      answer: t("Our AI analyzes your transaction descriptions and amounts to automatically suggest the most appropriate category. It learns from your patterns and becomes more accurate over time. Available for Standard and Premium plans.")
    },
    {
      id: "receipt-ocr",
      question: t("How does receipt scanning work?"),
      answer: t("Upload photos of receipts using the 'Upload Image' button on any transaction page. Our OCR technology automatically extracts merchant name, amount, and date. Standard+ users get AI-powered category suggestions. Works with mobile camera or gallery photos.")
    },
    {
      id: "mobile-qr-upload",
      question: t("How does mobile QR code upload work?"),
      answer: t("Click 'Upload Image' on your computer and select 'Scan with Phone'. A QR code appears on your screen. Scan it with your phone's camera to open the mobile upload page. Take a photo of your receipt on your phone, and the extracted data automatically appears in your computer's transaction form. Perfect for seamless cross-device receipt scanning.")
    },
    {
      id: "ocr-accuracy",
      question: t("What if OCR doesn't read my receipt correctly?"),
      answer: t("You can edit any extracted information before saving. The system shows extracted data in editable fields, allowing you to correct merchant names, amounts, or dates. Clear, well-lit photos produce the best results.")
    },
    {
      id: "supported-receipts",
      question: t("What types of receipts are supported?"),
      answer: t("All standard receipts including restaurant bills, grocery stores, gas stations, retail purchases, and service receipts. The system works best with printed receipts that have clear text and are photographed in good lighting conditions.")
    },
    {
      id: "budgets-goals",
      question: t("How do I set up budgets and goals?"),
      answer: t("Navigate to the Budgets or Goals section from the sidebar. Set monthly spending limits by category for budgets, or create savings targets with deadlines for goals. The app will track your progress automatically.")
    },
    {
      id: "data-export",
      question: t("Can I export my data?"),
      answer: t("Yes, Premium users can export data in CSV, Excel, or JSON formats. You can also set up automatic cloud backups and import data from other financial apps like Mint, QuickBooks, and YNAB.")
    },
    {
      id: "mobile-access",
      question: t("Is FinanzerPro available on mobile?"),
      answer: t("FinanzerPro is a responsive web application that works perfectly on mobile browsers. Simply bookmark the site on your phone for easy access anywhere.")
    },
    {
      id: "dashboard-widgets",
      question: t("What widgets are available on the dashboard?"),
      answer: t("Dashboard includes Financial Summary Cards (income/expenses/balance), Recent Transactions widget, Budget Overview (Standard+), Financial Health Score, AI Financial Tips (Premium), Financial Mascot (Premium), and Transaction Reminders (Standard+). All widgets update automatically.")
    },
    {
      id: "transaction-editing",
      question: t("How do I edit or delete transactions?"),
      answer: t("Click on any transaction in lists or dashboard widgets to edit. Modify amount, description, date, category, or notes. Use the delete button to remove transactions. Changes update immediately without page reloads.")
    },
    {
      id: "recurring-transactions",
      question: t("How do recurring transactions work?"),
      answer: t("Standard+ users can mark transactions as recurring (weekly, monthly, yearly). The system shows upcoming reminders in the dashboard widget and detects patterns automatically. Set end dates or leave open-ended for ongoing bills.")
    },
    {
      id: "categories-custom",
      question: t("Can I create custom categories?"),
      answer: t("Yes, create unlimited custom categories with personalized names, colors, and icons. Choose from income, expense, or goal types. Custom categories appear alongside 15+ predefined categories in all dropdown menus.")
    },
    {
      id: "financial-health-score",
      question: t("How is the Financial Health Score calculated?"),
      answer: t("Free users see a simple calculation based on income/expense ratio. Standard+ users get AI-powered analysis evaluating spending habits, budget adherence, savings rate, and goal progress with detailed improvement recommendations.")
    },
    {
      id: "budget-tracking",
      question: t("How does budget tracking work?"),
      answer: t("Standard+ users create budgets for categories with weekly/monthly/yearly limits. Progress bars show spending with color-coded status: green (under budget), yellow (approaching limit), red (over budget). Receive overspending alerts automatically.")
    },
    {
      id: "goals-collaboration",
      question: t("Can I share goals with family members?"),
      answer: t("Yes, Standard+ users can create collaborative goals and invite family members or partners. Track shared contributions, view progress together, and celebrate achievements as a team for joint savings efforts.")
    },
    {
      id: "calendar-view",
      question: t("What is the calendar view feature?"),
      answer: t("Standard+ users can view transactions in a monthly calendar grid showing daily spending totals and transaction previews. Navigate between months to see spending patterns over time with mobile-responsive design.")
    },
    {
      id: "trends-predictions",
      question: t("What are AI trend predictions?"),
      answer: t("Premium users get AI-powered financial forecasting showing spending predictions, income projections, budget recommendations, and goal timeline estimates. Uses machine learning to analyze patterns and predict future financial trends.")
    },
    {
      id: "financial-mascot",
      question: t("What is the Financial Mascot feature?"),
      answer: t("Premium users get a personalized AI companion that reflects financial health through mood changes and visual indicators. The mascot is draggable around the screen, has unique traits based on your profile, and can be hidden/restored.")
    },
    {
      id: "cloud-backup-restore",
      question: t("How does cloud backup work?"),
      answer: t("Premium users get automatic daily backups at 2:00 AM storing all transactions, budgets, goals, categories, and receipt images securely. Manual backup options available with complete restore functionality to recover all data.")
    },
    {
      id: "data-import",
      question: t("Can I import data from other financial apps?"),
      answer: t("Premium users can import from Mint, QuickBooks, YNAB, Personal Capital, and bank exports. Features include column mapping, data validation, preview before import, and batch processing with error handling.")
    },
    {
      id: "mobile-camera",
      question: t("Can I use my phone's camera for receipts?"),
      answer: t("Yes, mobile browsers support direct camera access. Choose 'Take Photo' to use your camera or 'Choose from Gallery' to select existing photos. QR code scanning allows cross-device upload from phone to computer.")
    },
    {
      id: "reports-filtering",
      question: t("How do I filter and view reports?"),
      answer: t("Use month dropdowns and period filters (week/month/quarter/year) on the Reports page. View financial overviews, category breakdowns, and analytics. Premium users get advanced trend analysis and comparative reports.")
    },
    {
      id: "subscription-changes",
      question: t("How do plan upgrades and downgrades work?"),
      answer: t("Upgrades apply immediately with prorated billing. Downgrades are scheduled for the end of your current billing period. Access subscription management through Profile page with full billing transparency and Stripe customer portal integration.")
    },
    {
      id: "mobile-responsive",
      question: t("Is the app fully mobile-friendly?"),
      answer: t("Yes, complete responsive design with touch-friendly interfaces, mobile navigation, collapsible filters, optimized forms, and camera integration. All desktop functionality is accessible on mobile browsers without requiring app downloads.")
    },
    {
      id: "customer-support",
      question: t("How can I get help or support?"),
      answer: t("Use this AI chat assistant for immediate help, check our comprehensive documentation below, or contact our support team through the contact page for personalized assistance.")
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
    <AppLayout isPublicPage={true}>
      <SEO 
        title="Help & Documentation - FinanzerPro User Guide | Features & Support"
        description="Complete FinanzerPro documentation covering expense tracking, receipt OCR scanning, AI categorization, budgeting, goals, and all features. Get help with setup, troubleshooting, and maximizing your financial management."
        keywords="finanzerpro help, expense tracker guide, receipt scanning tutorial, AI categorization help, budget app documentation, personal finance support, financial management tutorial"
        canonical="https://finanzerpro.com/help"
      />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Documentation */}
        <div className="lg:col-span-2">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('FinanzerPro Documentation')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {t("Complete guide to managing your finances with FinanzerPro's powerful features")}
            </p>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">{t('Overview')}</TabsTrigger>
              <TabsTrigger value="features">{t('Features')}</TabsTrigger>
              <TabsTrigger value="plans">{t('Plans')}</TabsTrigger>
              <TabsTrigger value="guide">{t('User Guide')}</TabsTrigger>
              <TabsTrigger value="faq">{t('FAQ')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    {t('Welcome to FinanzerPro')}
                  </CardTitle>
                  <CardDescription>
                    {t('Your comprehensive personal finance management solution')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    {t("FinanzerPro is a modern, intelligent personal finance application designed to help you take control of your financial future. With AI-powered insights, comprehensive tracking, and flexible subscription plans, managing your money has never been easier.")}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <BarChart3 className="h-8 w-8 text-blue-500 mt-1" />
                      <div>
                        <h3 className="font-semibold">{t('Smart Analytics')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {t('AI-powered insights and trend predictions for better financial decisions')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <Shield className="h-8 w-8 text-green-500 mt-1" />
                      <div>
                        <h3 className="font-semibold">{t('Secure Data Protection')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {t('Your financial data is protected with industry-standard encryption')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <Cloud className="h-8 w-8 text-purple-500 mt-1" />
                      <div>
                        <h3 className="font-semibold">{t('Cloud Backup')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {t('Never lose your data with automatic cloud synchronization')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 border rounded-lg">
                      <Zap className="h-8 w-8 text-yellow-500 mt-1" />
                      <div>
                        <h3 className="font-semibold">{t('AI Categorization')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {t('Automatically categorize transactions with machine learning')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      {t('Transaction Management')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• {t('Add income and expense transactions')}</li>
                      <li>• {t('Receipt OCR scanning (Standard+)')}</li>
                      <li>• {t('Mobile QR code upload')}</li>
                      <li>• {t('AI-powered automatic categorization')}</li>
                      <li>• {t('Smart search and filtering')}</li>
                      <li>• {t('Monthly view with dynamic navigation')}</li>
                      <li>• {t('Recurring transaction detection')}</li>
                      <li>• {t('Transaction editing and deletion')}</li>
                      <li>• {t('Bulk operations and imports')}</li>
                      <li>• {t('Custom category creation')}</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      {t('Budgets & Goals')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• {t('Set monthly spending limits by category')}</li>
                      <li>• {t('Track progress with visual indicators')}</li>
                      <li>• {t('Create savings goals with deadlines')}</li>
                      <li>• {t('Automatic budget vs. actual comparisons')}</li>
                      <li>• {t('Smart notifications and reminders')}</li>
                      <li>• {t('Collaborative savings goals with friends')}</li>
                      <li>• {t('Goal achievement tracking')}</li>
                      <li>• {t('Budget overflow warnings')}</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      {t('Analytics & Reports')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• {t('Comprehensive financial dashboard')}</li>
                      <li>• {t('Category-wise spending breakdown')}</li>
                      <li>• {t('Trend analysis and predictions')}</li>
                      <li>• {t('Income vs. expense comparisons')}</li>
                      <li>• {t('Export data in multiple formats')}</li>
                      <li>• {t('Period filtering (week/month/quarter/year)')}</li>
                      <li>• {t('Visual charts and graphs')}</li>
                      <li>• {t('Custom date range analysis')}</li>
                      <li>• {t('Financial health scoring')}</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {t('Smart Features')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• {t('AI financial health scoring')}</li>
                      <li>• {t('Personalized recommendations')}</li>
                      <li>• {t('Calendar view of transactions')}</li>
                      <li>• {t('Automatic backup scheduling')}</li>
                      <li>• {t('Data import from other apps')}</li>
                      <li>• {t('Financial mascot companion')}</li>
                      <li>• {t('Expense prediction and forecasting')}</li>
                      <li>• {t('Daily AI-powered financial tips')}</li>
                      <li>• {t('Transaction reminders and alerts')}</li>
                      <li>• {t('Multi-device receipt scanning')}</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      {t('Data Management')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• {t('Cloud storage and backup (Premium)')}</li>
                      <li>• {t('Import from CSV, Excel, JSON formats')}</li>
                      <li>• {t('Export to multiple file formats')}</li>
                      <li>• {t('Automatic daily backup scheduling')}</li>
                      <li>• {t('Data restore and recovery')}</li>
                      <li>• {t('Receipt image storage')}</li>
                      <li>• {t('Secure data encryption')}</li>
                      <li>• {t('Cross-platform synchronization')}</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {t('Security & Privacy')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• {t('Industry-standard data encryption')}</li>
                      <li>• {t('Secure authentication with Clerk')}</li>
                      <li>• {t('Private data isolation')}</li>
                      <li>• {t('GDPR compliance and privacy controls')}</li>
                      <li>• {t('Cookie consent management')}</li>
                      <li>• {t('Secure API endpoints')}</li>
                      <li>• {t('Regular security audits')}</li>
                      <li>• {t('Data ownership transparency')}</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="plans" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="relative">
                  <CardHeader>
                    <CardTitle className="text-center">{t('help.plans.free')}</CardTitle>
                    <CardDescription className="text-center">
                      <span className="text-3xl font-bold">{t('help.plans.price_free')}</span>
                      <span className="text-sm">{t('help.plans.per_month')}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {(t('help.plans.features.free', { returnObjects: true }) as string[]).map((feature, index) => (
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
                    <Badge className="bg-primary">{t('Most Popular')}</Badge>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-center">{t('help.plans.standard')}</CardTitle>
                    <CardDescription className="text-center">
                      <span className="text-3xl font-bold">{t('help.plans.price_standard')}</span>
                      <span className="text-sm">{t('help.plans.per_month')}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {(t('help.plans.features.standard', { returnObjects: true }) as string[]).map((feature, index) => (
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
                    <CardTitle className="text-center">{t('help.plans.premium')}</CardTitle>
                    <CardDescription className="text-center">
                      <span className="text-3xl font-bold">{t('help.plans.price_premium')}</span>
                      <span className="text-sm">{t('help.plans.per_month')}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {(t('help.plans.features.premium', { returnObjects: true }) as string[]).map((feature, index) => (
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
                    {t('Quick Start Guide')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        1
                      </div>
                      <div>
                        <h3 className="font-semibold">{t('Create Your Account')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {t('Sign up for a free account to get started. You can upgrade to Standard or Premium anytime.')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        2
                      </div>
                      <div>
                        <h3 className="font-semibold">{t('Add Your First Transaction')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {t('Navigate to the dashboard and click "Add Transaction" to record your first income or expense.')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        3
                      </div>
                      <div>
                        <h3 className="font-semibold">{t('Set Up Categories')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {t('Choose from predefined categories or let AI automatically categorize your transactions.')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        4
                      </div>
                      <div>
                        <h3 className="font-semibold">{t('Create Budgets (Standard+)')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {t('Set monthly spending limits by category to stay on track with your financial goals.')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold">
                        5
                      </div>
                      <div>
                        <h3 className="font-semibold">{t('Monitor Your Progress')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {t('Use the dashboard and reports to track your spending patterns and achieve your financial goals.')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-4">{t('Comprehensive Feature Documentation')}</h3>
                    
                    <div className="space-y-8">
                      
                      {/* Dashboard Functions */}
                      <div className="border-l-4 border-blue-500 pl-4">
                        <h4 className="font-medium flex items-center gap-2 mb-3 text-lg">
                          <BarChart3 className="h-5 w-5" />
                          {t('Dashboard Functions')}
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-medium text-sm mb-2">{t('Financial Summary Cards')}</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>{t('Location')}:</strong> {t('Top of dashboard')}<br/>
                              <strong>{t('Function')}:</strong> {t('Display total income, expenses, and balance for selected month')}<br/>
                              <strong>{t('Features')}:</strong> {t('Auto-updates with new transactions, clickable for detailed breakdown, color-coded positive/negative values')}
                            </p>
                          </div>
                          
                          <div>
                            <h5 className="font-medium text-sm mb-2">{t('Quick Transaction Entry')}</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>{t('Location')}:</strong> {t('Header "+" button or dashboard "Add Transaction" button')}<br/>
                              <strong>{t('Function')}:</strong> {t('Add new income or expense transactions')}<br/>
                              <strong>{t('Features')}:</strong> {t('Form validation, category selection, date picker, recurring transaction option (Standard+), receipt upload (Standard+)')}
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">{t('Recent Transactions Widget')}</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>{t('Location')}:</strong> {t('Left column of dashboard')}<br/>
                              <strong>{t('Function')}:</strong> {t('Shows last 5 transactions with edit/delete options')}<br/>
                              <strong>{t('Features')}:</strong> {t('One-click editing, category icons, amount formatting, receipt thumbnails, recurring transaction indicators')}
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">{t('Budget Overview Widget (Standard+)')}</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>{t('Location')}:</strong> {t('Right column of dashboard')}<br/>
                              <strong>{t('Function')}:</strong> {t('Monitor budget progress across all categories')}<br/>
                              <strong>{t('Features')}:</strong> {t('Progress bars, percentage completion, color-coded status (green/yellow/red), overspending alerts')}
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">{t('Financial Health Score')}</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>{t('Location')}:</strong> {t('Right column of dashboard')}<br/>
                              <strong>{t('Function')}:</strong> {t('Calculate and display financial wellness score')}<br/>
                              <strong>{t('Free Users')}:</strong> {t('Simple calculation based on income/expense ratio')}<br/>
                              <strong>{t('Standard+ Users')}:</strong> {t('AI-powered analysis with detailed recommendations and improvement suggestions')}
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">{t('AI Financial Tips (Premium)')}</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>{t('Location')}:</strong> {t('Left column of dashboard')}<br/>
                              <strong>{t('Function')}:</strong> {t('Personalized financial advice based on spending patterns')}<br/>
                              <strong>{t('Features')}:</strong> {t('AI-generated tips, trend analysis, actionable recommendations, persistent across sessions')}
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">{t('Financial Mascot (Premium)')}</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>{t('Location')}:</strong> {t('Floating on dashboard')}<br/>
                              <strong>{t('Function')}:</strong> {t('Personalized AI companion reflecting financial health')}<br/>
                              <strong>{t('Features')}:</strong> {t('Draggable positioning, mood changes based on spending, unique traits per user, hide/restore options')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Transaction Management */}
                      <div className="border-l-4 border-green-500 pl-4">
                        <h4 className="font-medium flex items-center gap-2 mb-3 text-lg">
                          <DollarSign className="h-5 w-5" />
                          {t('Transaction Management')}
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-medium text-sm mb-2">Transaction Entry Forms</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Expenses, Income, and Transactions pages<br/>
                              <strong>Function:</strong> Add new financial transactions with complete details<br/>
                              <strong>Fields:</strong> Amount, description, date, category, notes, recurring options<br/>
                              <strong>Validation:</strong> Required fields, positive amounts, valid dates, category selection
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Transaction Lists and Filtering</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> All transaction pages<br/>
                              <strong>Function:</strong> View, search, and filter transaction history<br/>
                              <strong>Filters:</strong> Month selection, category filtering, transaction type, date ranges<br/>
                              <strong>Features:</strong> Responsive design, mobile-friendly collapsible filters, real-time search
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Transaction Editing and Deletion</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Transaction list items and dashboard widgets<br/>
                              <strong>Function:</strong> Modify or remove existing transactions<br/>
                              <strong>Features:</strong> Inline editing, confirmation dialogs, immediate UI updates, undo options
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Recurring Transactions (Standard+)</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Transaction forms and reminders widget<br/>
                              <strong>Function:</strong> Set up automatic transaction detection and reminders<br/>
                              <strong>Features:</strong> Frequency selection (weekly, monthly, yearly), end date options, reminder notifications
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">{t('Receipt OCR Processing (Standard+)')}</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>{t('Location')}:</strong> {t('Upload Image buttons on transaction pages')}<br/>
                              <strong>{t('Function')}:</strong> {t('Extract transaction data from receipt photos')}<br/>
                              <strong>{t('Features')}:</strong> {t('Google Cloud Vision OCR, AI categorization, mobile camera support, QR code cross-device upload')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Category Management */}
                      <div className="border-l-4 border-purple-500 pl-4">
                        <h4 className="font-medium flex items-center gap-2 mb-3 text-lg">
                          <Target className="h-5 w-5" />
                          Category Management
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-medium text-sm mb-2">Category Creation and Editing</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Categories page<br/>
                              <strong>Function:</strong> Create custom expense and income categories<br/>
                              <strong>Features:</strong> Custom names, color selection, icon choices, type assignment (income/expense/goal)
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Predefined Categories</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Available:</strong> 20+ built-in categories for common expenses and income<br/>
                              <strong>Examples:</strong> Food & Dining, Transportation, Shopping, Bills & Utilities, Healthcare, Entertainment, Salary, Freelancing<br/>
                              <strong>Features:</strong> Professional icons, optimized colors, cannot be deleted
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">AI Auto-Categorization (Standard+)</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Function:</strong> Automatically suggest categories based on transaction descriptions<br/>
                              <strong>Features:</strong> Machine learning analysis, merchant recognition, user preference learning, manual override options
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Budget and Goals */}
                      <div className="border-l-4 border-orange-500 pl-4">
                        <h4 className="font-medium flex items-center gap-2 mb-3 text-lg">
                          <Target className="h-5 w-5" />
                          Budget and Goals (Standard+)
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-medium text-sm mb-2">Budget Creation and Management</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Budgets page<br/>
                              <strong>Function:</strong> Set spending limits for categories with time periods<br/>
                              <strong>Options:</strong> Weekly, monthly, quarterly, yearly timeframes<br/>
                              <strong>Features:</strong> Progress tracking, overspending alerts, visual indicators, budget history
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Financial Goals</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Goals page<br/>
                              <strong>Function:</strong> Set savings targets with deadlines<br/>
                              <strong>Types:</strong> Emergency Fund, Vacation, House Down Payment, Car Purchase, Debt Payoff, Retirement<br/>
                              <strong>Features:</strong> Progress tracking, milestone celebrations, contribution history, deadline reminders
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Collaborative Goals</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Function:</strong> Share goals with family members or partners<br/>
                              <strong>Features:</strong> Friend invitations, shared contributions, progress visibility, achievement tracking
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Reports and Analytics */}
                      <div className="border-l-4 border-red-500 pl-4">
                        <h4 className="font-medium flex items-center gap-2 mb-3 text-lg">
                          <BarChart3 className="h-5 w-5" />
                          Reports and Analytics
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-medium text-sm mb-2">Financial Overview Reports</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Reports page - Overview tab<br/>
                              <strong>Function:</strong> Comprehensive financial summary with charts and metrics<br/>
                              <strong>Features:</strong> Income vs. expenses, category breakdowns, time period filtering, trend indicators
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Advanced Analytics (Premium)</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Reports page - Analytics tab<br/>
                              <strong>Function:</strong> Detailed financial pattern analysis<br/>
                              <strong>Features:</strong> Spending trends, seasonal patterns, category comparisons, growth metrics
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">AI Trend Predictions (Premium)</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Trends page - Forecasts tab<br/>
                              <strong>Function:</strong> AI-powered financial forecasting<br/>
                              <strong>Features:</strong> Spending predictions, income projections, budget recommendations, goal timeline estimates
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Calendar View (Standard+)</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Calendar page<br/>
                              <strong>Function:</strong> Monthly grid view of all transactions<br/>
                              <strong>Features:</strong> Daily spending totals, transaction previews, monthly navigation, mobile responsive grid
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Data Management */}
                      <div className="border-l-4 border-indigo-500 pl-4">
                        <h4 className="font-medium flex items-center gap-2 mb-3 text-lg">
                          <Cloud className="h-5 w-5" />
                          Data Management (Premium)
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-medium text-sm mb-2">Cloud Backup System</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Data Management page - Backup tab<br/>
                              <strong>Function:</strong> Secure cloud storage of all financial data<br/>
                              <strong>Features:</strong> Automatic daily backups at 2:00 AM, manual backup options, backup history, restore functionality
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Data Export</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Data Management page - Export tab<br/>
                              <strong>Function:</strong> Download financial data in multiple formats<br/>
                              <strong>Formats:</strong> PDF reports, Excel spreadsheets, CSV files, JSON data<br/>
                              <strong>Features:</strong> Custom date ranges, selective data export, formatted reports
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Data Import</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Data Management page - Import tab<br/>
                              <strong>Function:</strong> Import transactions from other financial apps<br/>
                              <strong>Supported:</strong> Mint, QuickBooks, YNAB, Personal Capital, bank exports<br/>
                              <strong>Features:</strong> Column mapping, data validation, preview before import, batch processing
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Profile and Settings */}
                      <div className="border-l-4 border-teal-500 pl-4">
                        <h4 className="font-medium flex items-center gap-2 mb-3 text-lg">
                          <Users className="h-5 w-5" />
                          Profile and Settings
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-medium text-sm mb-2">Account Management</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Profile page - Account tab<br/>
                              <strong>Function:</strong> Manage personal information and security settings<br/>
                              <strong>Features:</strong> Clerk authentication, email updates, password changes, profile photos
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Subscription Management</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Profile page - Subscription tab<br/>
                              <strong>Function:</strong> View and modify subscription plans<br/>
                              <strong>Features:</strong> Plan comparisons, upgrade/downgrade options, billing history, Stripe customer portal
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Notification Preferences</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Location:</strong> Profile page - Notifications tab<br/>
                              <strong>Function:</strong> Control alert and reminder settings<br/>
                              <strong>Features:</strong> Budget alerts, goal reminders, transaction notifications, email preferences
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Mobile Features */}
                      <div className="border-l-4 border-pink-500 pl-4">
                        <h4 className="font-medium flex items-center gap-2 mb-3 text-lg">
                          <Camera className="h-5 w-5" />
                          Mobile Features
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <h5 className="font-medium text-sm mb-2">Responsive Design</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Function:</strong> Full mobile optimization for all features<br/>
                              <strong>Features:</strong> Touch-friendly interfaces, mobile navigation, responsive layouts, optimized forms
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">Mobile Camera Integration</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Function:</strong> Direct camera access for receipt scanning<br/>
                              <strong>Features:</strong> Camera capture, gallery selection, image preview, auto-focus optimization
                            </p>
                          </div>

                          <div>
                            <h5 className="font-medium text-sm mb-2">QR Code Cross-Device Upload</h5>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <strong>Function:</strong> Scan receipts on mobile, process on desktop<br/>
                              <strong>Features:</strong> QR code generation, anonymous mobile access, real-time polling, automatic form population
                            </p>
                          </div>
                        </div>
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
                    {t('Frequently Asked Questions')}
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
                          <span className="font-medium">{t(item.question)}</span>
                          <div className={`transform transition-transform ${expandedFaq === item.id ? 'rotate-180' : ''}`}>
                            ↓
                          </div>
                        </button>
                        {expandedFaq === item.id && (
                          <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-300">
                            {t(item.answer)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chat" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-6 w-6" />
                    {t('AI Assistant')}
                  </CardTitle>
                  <CardDescription>
                    {t('Get instant help with our AI-powered chat assistant')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="h-64 border rounded-lg p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                      {chatMessages.length === 0 ? (
                        <p className="text-gray-500 text-center">
                          {t('Start a conversation by asking a question about FinanzerPro features')}
                        </p>
                      ) : (
                        chatMessages.map((message, index) => (
                          <div
                            key={index}
                            className={`mb-4 p-3 rounded-lg ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground ml-8'
                                : 'bg-white dark:bg-gray-800 mr-8'
                            }`}
                          >
                            <div className="text-sm font-medium mb-1">
                              {message.role === 'user' ? t('You') : t('AI Assistant')}
                            </div>
                            <div className="text-sm">{message.content}</div>
                          </div>
                        ))
                      )}
                      {isLoading && (
                        <div className="flex items-center gap-2 text-gray-500">
                          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                          {t('AI is thinking...')}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={t('Ask about FinanzerPro features...')}
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
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <a href="/dashboard" className="block text-blue-600 hover:text-blue-800">Dashboard</a>
                <a href="/transactions" className="block text-blue-600 hover:text-blue-800">Transactions</a>
                <a href="/budgets" className="block text-blue-600 hover:text-blue-800">Budgets</a>
                <a href="/goals" className="block text-blue-600 hover:text-blue-800">Goals</a>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>
    </AppLayout>
  );
}
