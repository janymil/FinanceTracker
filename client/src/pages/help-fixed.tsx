import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Layout,
  Camera
} from "lucide-react";
import { useTranslation } from 'react-i18next';

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Help() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: t('Hello! I\'m your FinanzerPro AI assistant. How can I help you today?'),
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputMessage })
      });

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response || t('I apologize, but I\'m having trouble processing your request right now. Please try again later.'),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: t('I apologize, but I\'m having trouble connecting right now. Please try again later.'),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <SEO 
        title={t('Help & Documentation | FinanzerPro')}
        description={t('Get help with FinanzerPro. Find answers to common questions, learn about features, and get personalized assistance from our AI chatbot.')}
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Help Content */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {t('Help & Documentation')}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                {t('Everything you need to know about using FinanzerPro effectively')}
              </p>
            </div>

            <Tabs defaultValue="guide" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="guide">{t('User Guide')}</TabsTrigger>
                <TabsTrigger value="faq">{t('FAQ')}</TabsTrigger>
                <TabsTrigger value="plans">{t('Plans & Features')}</TabsTrigger>
              </TabsList>

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
                          <h3 className="font-semibold">{t('Explore Features')}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {t('Use the dashboard and reports to track your spending patterns and achieve your financial goals.')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-4">{t('Key Features Overview')}</h3>
                      <div className="space-y-6">
                        
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
                                <strong>{t('Location')}:</strong> {t('Right side of dashboard')}<br/>
                                <strong>{t('Function')}:</strong> {t('Calculate and display financial wellness score')}<br/>
                                <strong>{t('Free Users')}:</strong> {t('Simple calculation based on income/expense ratio')}<br/>
                                <strong>{t('Standard+ Users')}:</strong> {t('AI-powered analysis with detailed recommendations and improvement suggestions')}
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
                                <strong>Features:</strong> Form validation, category selection, date picker, recurring options
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
                      {[
                        {
                          question: t("What is FinanzerPro?"),
                          answer: t("FinanzerPro is a comprehensive personal finance management application that helps you track expenses, manage budgets, set financial goals, and gain insights into your spending patterns with AI-powered analysis.")
                        },
                        {
                          question: t("Is my financial data secure?"),
                          answer: t("Yes, we use bank-level security with AES-256 encryption, secure cloud storage, and strict privacy policies. Your data is encrypted both in transit and at rest, and we never share your personal financial information with third parties.")
                        },
                        {
                          question: t("What's the difference between Free, Standard, and Premium plans?"),
                          answer: t("Free includes basic transaction tracking and simple budgeting. Standard adds OCR receipt scanning, advanced budgets, goals, and export features. Premium includes AI financial insights, personalized tips, collaborative goals, and priority support.")
                        },
                        {
                          question: t("How does the AI categorization work?"),
                          answer: t("Our AI analyzes transaction descriptions, merchant names, and amounts to automatically suggest appropriate categories. It learns from your corrections and becomes more accurate over time. Available for Standard and Premium users.")
                        },
                        {
                          question: t("Can I import data from other financial apps?"),
                          answer: t("Yes, you can import data using CSV files or JSON format. We support importing transactions, budgets, goals, and categories. Use the Import/Export page to upload your data from other financial management tools.")
                        }
                      ].map((faq, index) => (
                        <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                            {faq.question}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {faq.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="plans" className="space-y-4">
                <div className="grid gap-6 md:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{t('Free')}</span>
                        <Badge variant="secondary">$0</Badge>
                      </CardTitle>
                      <CardDescription>{t('Perfect for getting started')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {(t('help.plans.features.free', { returnObjects: true }) as string[]).map((feature, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <div className="h-2 w-2 bg-blue-500 rounded-full" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{t('Standard')}</span>
                        <Badge variant="default">$9.99/mo</Badge>
                      </CardTitle>
                      <CardDescription>{t('Most popular for individuals')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {(t('help.plans.features.standard', { returnObjects: true }) as string[]).map((feature, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <div className="h-2 w-2 bg-orange-500 rounded-full" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{t('Premium')}</span>
                        <Badge variant="destructive">$19.99/mo</Badge>
                      </CardTitle>
                      <CardDescription>{t('Advanced features and AI insights')}</CardDescription>
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
            </Tabs>
          </div>

          {/* AI Chat Assistant */}
          <div className="lg:col-span-1">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  {t('AI Assistant')}
                </CardTitle>
                <CardDescription>
                  {t('Ask me anything about FinanzerPro')}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm">
                          {t('Typing...')}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="flex gap-2 pt-4">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={t('Ask a question...')}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isLoading}
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={isLoading || !inputMessage.trim()}
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
    </AppLayout>
  );
}