import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/AppLayout";
import { SEO } from "@/components/SEO";
import { 
  TrendingUp, 
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
  BarChart3,
  Cloud,
  Zap,
  Camera,
  Search,
  Sparkles,
  CheckCircle2,
  Lock,
  DollarSign
} from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { amountFor, currencyForLanguage, formatMoney } from "@shared/pricing";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Help() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Language from route
  const langMatch = location.match(/^\/([a-z]{2})(?:\/|$)/);
  const currentLang = langMatch ? langMatch[1] : (localStorage.getItem('preferredLanguage') || 'en');
  // Prices shown in help must match /pricing: soles on Spanish pages, dollars elsewhere.
  const priceCurrency = currencyForLanguage(currentLang);
  const standardPrice = formatMoney(amountFor('standard', 'monthly', priceCurrency), priceCurrency);
  const premiumPrice = formatMoney(amountFor('premium', 'monthly', priceCurrency), priceCurrency);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: t("Hello! I am your Kaptia AI assistant. How can I help you today?"),
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
        content: data.response || t('help.chat.error_response', 'Sorry, could not get a response. Please try again.'),
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Help chat error:', error);
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: t('help.chat.error_response', 'Sorry, could not get a response. Please try again.'),
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

  const handleQuickPrompt = (promptText: string) => {
    const userMessage: ChatMessage = {
      role: "user",
      content: promptText,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);
    sendChatMessage(promptText);
  };

  // Canonical FAQ items using established translation keys
  const faqItems = [
    {
      id: "getting-started",
      question: t("How do I get started with Kaptia?"),
      answer: t("Simply create an account and start by adding your first transaction. You can manually enter expenses and income, or use our AI categorization feature (Standard+ plans) to automatically classify your transactions.")
    },
    {
      id: "subscription-plans",
      question: t("What are the differences between subscription plans?"),
      answer: t("help.pricing_answer", { standard: standardPrice, premium: premiumPrice })
    },
    {
      id: "receipt-ocr",
      question: t("How does receipt scanning work?"),
      answer: t("Upload photos of receipts using the 'Upload Image' button on any transaction page. Our OCR technology automatically extracts merchant name, amount, and date. Standard+ users get AI-powered category suggestions. Works with mobile camera or gallery photos.")
    },
    {
      id: "ai-categorization",
      question: t("How does AI categorization work?"),
      answer: t("Our AI analyzes your transaction descriptions and amounts to automatically suggest the most appropriate category. It learns from your patterns and becomes more accurate over time. Available for Standard and Premium plans.")
    },
    {
      id: "data-security",
      question: t("Is my financial data secure?"),
      answer: t("Yes, we use industry-standard encryption and security measures. Your data is stored securely with PostgreSQL, and we offer cloud backup for Premium users. We never share your personal financial information.")
    },
    {
      id: "budget-tracking",
      question: t("How does budget tracking work?"),
      answer: t("Navigate to the Budgets or Goals section from the sidebar. Set monthly spending limits by category for budgets, or create savings targets with deadlines for goals. The app will track your progress automatically.")
    },
    {
      id: "mobile-responsive",
      question: t("Is Kaptia available on mobile?"),
      answer: t("Kaptia is a responsive web application that works perfectly on mobile browsers. Simply bookmark the site on your phone for easy access anywhere.")
    }
  ];

  // Filter FAQs based on search input
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqItems;
    const query = searchQuery.toLowerCase();
    return faqItems.filter(item => 
      item.question.toLowerCase().includes(query) || 
      item.answer.toLowerCase().includes(query)
    );
  }, [searchQuery, faqItems]);

  return (
    <AppLayout isPublicPage={true}>
      <SEO 
        title={`${t("Help & Documentation")} | Kaptia`}
        description={t("Complete guide to mastering your spending with Kaptia's powerful features")}
        keywords="kaptia help, documentation, expense tracker guide, receipt ocr, budgets"
        canonical="https://kaptia.app/help"
      />

      <div className="min-h-screen bg-[#f7f8fc] dark:bg-[#07080f] text-gray-900 dark:text-white relative bg-grid pb-20">
        {/* Glow accent matching frontpage */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          {/* Header Section */}
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 dark:border-white/10 bg-indigo-50/70 dark:bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              <HelpCircle className="h-3.5 w-3.5" />
              {t("Help & Documentation")}
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mt-4">
              {t("Kaptia Documentation")}
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 mt-3 max-w-2xl mx-auto">
              {t("Complete guide to mastering your spending with Kaptia's powerful features")}
            </p>

            {/* Instant Search Bar */}
            <div className="max-w-xl mx-auto mt-6 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder={t("Search questions or topics...")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab !== "faq" && e.target.value.trim().length > 0) {
                    setActiveTab("faq");
                  }
                }}
                className="pl-12 pr-4 h-11 rounded-xl bg-white/90 dark:bg-[#0f111a]/90 border-gray-200 dark:border-white/10 shadow-sm focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>

          {/* Interactive Categorized Tabs: avoids long scrolling */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1.5 rounded-2xl bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl border border-gray-200/80 dark:border-white/10 shadow-sm gap-1 mb-8">
              <TabsTrigger 
                value="overview" 
                className="py-2.5 rounded-xl text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center gap-1.5 justify-center"
              >
                <Sparkles className="h-4 w-4" />
                <span>{t("Overview")}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="features" 
                className="py-2.5 rounded-xl text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center gap-1.5 justify-center"
              >
                <BookOpen className="h-4 w-4" />
                <span>{t("User Guide")}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="plans" 
                className="py-2.5 rounded-xl text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center gap-1.5 justify-center"
              >
                <Star className="h-4 w-4" />
                <span>{t("Plans")}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="faq" 
                className="py-2.5 rounded-xl text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center gap-1.5 justify-center"
              >
                <HelpCircle className="h-4 w-4" />
                <span>{t("FAQ")}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ai-chat" 
                className="col-span-2 md:col-span-1 py-2.5 rounded-xl text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center gap-1.5 justify-center"
              >
                <Bot className="h-4 w-4" />
                <span>{t("AI Assistant")}</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
              <div className="glass-card rounded-2xl p-6 sm:p-8 border border-gray-200/80 dark:border-white/10 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold">{t("Welcome to Kaptia")}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("Everything you need to get the most out of Kaptia")}</p>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                  {t("Kaptia is a modern, intelligent spending tracker designed to help you understand where your money goes. With AI-powered insights, comprehensive tracking, and flexible plans, staying on top of your spending has never been easier.")}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 w-fit mb-3">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{t("Smart Analytics")}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t("AI-powered insights and trend predictions for better financial decisions")}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit mb-3">
                    <Shield className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{t("Secure Data Protection")}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t("Your financial data is protected with industry-standard encryption")}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 w-fit mb-3">
                    <Cloud className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">{t("Cloud Backup & Restore", "Cloud Backup")}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t("Automatic backups keeping your financial history safe and accessible across devices")}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: USER GUIDE */}
            <TabsContent value="features" className="space-y-6 focus-visible:outline-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Camera className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-bold text-lg">{t("How does receipt scanning work?")}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {t("Upload photos of receipts using the 'Upload Image' button on any transaction page. Our OCR technology automatically extracts merchant name, amount, and date. Standard+ users get AI-powered category suggestions. Works with mobile camera or gallery photos.")}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-bold text-lg">{t("How does AI categorization work?")}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {t("Our AI analyzes your transaction descriptions and amounts to automatically suggest the most appropriate category. It learns from your patterns and becomes more accurate over time. Available for Standard and Premium plans.")}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Target className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-bold text-lg">{t("How does budget tracking work?")}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {t("Navigate to the Budgets or Goals section from the sidebar. Set monthly spending limits by category for budgets, or create savings targets with deadlines for goals. The app will track your progress automatically.")}
                  </p>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Shield className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-bold text-lg">{t("Is my financial data secure?")}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {t("Yes, we use industry-standard encryption and security measures. Your data is stored securely with PostgreSQL, and we offer cloud backup for Premium users. We never share your personal financial information.")}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: PLANS */}
            <TabsContent value="plans" className="space-y-6 focus-visible:outline-none">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Free */}
                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display text-xl font-bold">{t("Free", "Free")}</h3>
                    <div className="text-3xl font-extrabold mt-2 text-gray-900 dark:text-white">$0</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("Forever free", "Forever free")}</p>
                    <ul className="space-y-2.5 mt-6 text-sm text-gray-600 dark:text-gray-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{t("Up to 100 transactions view", "Up to 100 transactions view")}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{t("Manual categorization", "Manual categorization")}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{t("Simple overview dashboard", "Simple spending overview")}</span>
                      </li>
                    </ul>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setLocation(`/${currentLang}/auth#sign-up`)} 
                    className="w-full mt-6 rounded-xl"
                  >
                    {t("Get Started Free")}
                  </Button>
                </div>

                {/* Standard */}
                <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display text-xl font-bold">{t("Standard")}</h3>
                    <div className="text-3xl font-extrabold mt-2 text-gray-900 dark:text-white">{standardPrice}</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">/ {t("month", "month")}</p>
                    <ul className="space-y-2.5 mt-6 text-sm text-gray-600 dark:text-gray-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{t("AI expense categorization", "AI expense categorization")}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{t("Budgets and goal management", "Budgets and goal management")}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{t("Interactive charts and reports", "Interactive charts and reports")}</span>
                      </li>
                    </ul>
                  </div>
                  <Button 
                    onClick={() => setLocation(`/${currentLang}/auth#sign-up`)} 
                    className="w-full mt-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {t("Subscribe Now", "Subscribe Now")}
                  </Button>
                </div>

                {/* Premium */}
                <div className="glass-card rounded-2xl p-6 border-2 border-indigo-500 dark:border-indigo-400 relative flex flex-col justify-between bg-white dark:bg-[#0f111a]">
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 px-3 py-0.5 text-xs font-semibold">
                    {t("Most Popular")}
                  </Badge>
                  <div>
                    <h3 className="font-display text-xl font-bold">{t("Premium")}</h3>
                    <div className="text-3xl font-extrabold mt-2 text-indigo-600 dark:text-indigo-400">{premiumPrice}</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">/ {t("month", "month")}</p>
                    <ul className="space-y-2.5 mt-6 text-sm text-gray-600 dark:text-gray-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{t("Unlimited transaction history", "Unlimited transaction history")}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{t("AI expense prediction", "AI expense prediction")}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{t("Cloud data backup", "Cloud data backup")}</span>
                      </li>
                    </ul>
                  </div>
                  <Button 
                    onClick={() => setLocation(`/${currentLang}/auth#sign-up`)} 
                    className="w-full mt-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-indigo-500/25"
                  >
                    {t("Subscribe Now", "Subscribe Now")}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: FAQ */}
            <TabsContent value="faq" className="space-y-4 focus-visible:outline-none">
              <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10">
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-60" />
                    <p>{t("No questions matched your search.")}</p>
                    <Button 
                      variant="link" 
                      onClick={() => setSearchQuery("")} 
                      className="mt-2 text-indigo-600"
                    >
                      {t("Clear search")}
                    </Button>
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full space-y-2">
                    {filteredFaqs.map((faq) => (
                      <AccordionItem 
                        key={faq.id} 
                        value={faq.id}
                        className="border border-gray-200/60 dark:border-white/5 rounded-xl px-4 py-1 data-[state=open]:bg-indigo-50/30 dark:data-[state=open]:bg-white/[0.02]"
                      >
                        <AccordionTrigger className="text-left font-medium text-sm sm:text-base hover:no-underline hover:text-indigo-600 dark:hover:text-indigo-400">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed pt-1 pb-3">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            </TabsContent>

            {/* TAB 5: AI CHAT */}
            <TabsContent value="ai-chat" className="space-y-4 focus-visible:outline-none">
              <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10 flex flex-col h-[520px]">
                {/* Chat header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200/60 dark:border-white/10 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm sm:text-base">{t("Ask me anything about Kaptia")}</h3>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        {t("Online • Ask anything")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick prompt suggestions */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => handleQuickPrompt(t("How does receipt scanning work?"))}
                    className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-white/10 transition-colors"
                  >
                    📸 {t("How does receipt scanning work?")}
                  </button>
                  <button
                    onClick={() => handleQuickPrompt(t("How does AI categorization work?"))}
                    className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-white/10 transition-colors"
                  >
                    ✨ {t("How does AI categorization work?")}
                  </button>
                </div>

                {/* Chat messages */}
                <ScrollArea className="flex-1 pr-3">
                  <div className="space-y-3.5">
                    {chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 text-xs">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none'
                              : 'bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 rounded-bl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 text-xs">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="bg-gray-100 dark:bg-white/10 rounded-2xl px-4 py-2.5 text-sm text-gray-500 rounded-bl-none flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" />
                          <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Input box */}
                <div className="pt-3 border-t border-gray-200/60 dark:border-white/10 flex gap-2">
                  <Input
                    type="text"
                    placeholder={t("Ask about Kaptia features...")}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                    disabled={isLoading}
                    className="rounded-xl bg-white/90 dark:bg-[#0f111a]/90 text-sm"
                  />
                  <Button aria-label={t('a11y.send')}
                    onClick={handleSendMessage}
                    disabled={isLoading || !chatInput.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
