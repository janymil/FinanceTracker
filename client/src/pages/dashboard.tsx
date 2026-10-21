import React from "react";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useTransactions } from "@/hooks/useTransactions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, startTransition, useDeferredValue, useTransition } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { SEO } from "@/components/SEO";
import { useCurrency } from "@/context/CurrencyContext";
import { CurrencySetupModal } from "@/components/CurrencySetupModal";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n/i18n";
import { getMonthDateRange } from "@/lib/dateRangeUtils";


// Core components for immediate display
import FinancialCards from "@/components/financial-cards";
import TransactionList from "@/components/transaction-list";
import BudgetOverview from "@/components/budget-overview";
import RequirePlan from "@/components/require-plan";
import UpgradeBanner from "@/components/upgrade-banner";
import FinancialHealthMascot from "@/components/financial-health-mascot";

// Modular lazy components with React 18 concurrent features
import {
  LazyTrendsChart,
  LazyExpenseChart,
  LazyFinancialHealthScore,
  LazyQuickFinancialSnapshot,
  LazyContextualFinancialTips,
  LazyRemindersStreaks,
  LazyExpensePrediction,
  LazyDailyRecommendations,
  LazyAutoCategorization,
  LazyAIFinancialTips,
  LazyTransactionRemindersWidget
} from "@/components/dashboard/lazy-components";
import { 
  TrendingUp,
  TrendingDown,
  DollarSign,
  PlusCircle,
  Calendar,
  Target,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  Zap,
  Shield,
  Star,

  ChevronRight,
  Plus,
  Minus,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Repeat,
  MessageCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import SimpleVoiceButton from "@/components/simple-voice-button";


interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
}

export default function Dashboard() {
  const { isReady, user } = useClerkUserReady();
  const { showSetupModal, setShowSetupModal } = useCurrency();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Helper functions for category localization
  const isPredefinedCategory = (category: any): boolean => {
    return category.userId === null;
  };

  const getLocalizedCategoryName = (category: any): string => {
    if (isPredefinedCategory(category)) {
      return t(category.name);
    }
    return category.name;
  };

  // Check for subscription success/error messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const upgrade = urlParams.get('upgrade');
    const plan = urlParams.get('plan');
    const error = urlParams.get('error');

    if (upgrade === 'success' && plan) {
      toast({
        title: t("Subscription Successful!"),
        description: `${t("You've been upgraded to the")} ${plan} ${t("plan. Enjoy your new features!")}`,
      });
      // Clean up URL parameters
      window.history.replaceState({}, '', '/');
    } else if (error) {
      let message = t("An error occurred during payment processing.");
      switch (error) {
        case 'payment_not_completed':
          message = t("Payment was not completed. Please try again.");
          break;
        case 'user_not_found':
          message = t("User account not found. Please contact support.");
          break;
        case 'plan_update_failed':
          message = t("Payment successful but plan update failed. Please contact support.");
          break;
      }
      toast({
        title: t("Payment Error"),
        description: message,
        variant: "destructive",
      });
      // Clean up URL parameters
      window.history.replaceState({}, '', '/');
    }
  }, [toast]);
  const [isPending, startTransition] = useTransition();
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [selectedMonthNum, setSelectedMonthNum] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  
  // Combine month and year for API calls
  const selectedMonth = `${selectedYear}-${selectedMonthNum}`;
  const [isDialogOpen, setIsDialogOpen] = useState(false);


  // Defer expensive rendering to prevent Suspense errors
  const deferredSelectedMonth = useDeferredValue(selectedMonth);
  const deferredUser = useDeferredValue(user);

  useEffect(() => {
    // Check for subscription success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('subscription') === 'success') {
      toast({
        title: t("Subscription Activated!"),
        description: t("Welcome to your new plan! All features are now available."),
      });
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [toast]);

  const [newTransaction, setNewTransaction] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    type: "expense" as "income" | "expense",
    categoryId: "",
    isRecurring: false,
    recurringFrequency: "monthly" as "weekly" | "monthly" | "yearly",
    recurringEndDate: "",
    paymentUrl: "",
    referenceNote: "",
  });



  // Get start and end dates for the selected month using centralized utilities
  const { startDate, endDate } = getMonthDateRange(selectedMonth);

  // Hooks
  const queryClient = useQueryClient();

  // Core data loads immediately with shared cache
  const { data: transactions, isLoading: transactionsLoading, error: transactionsError } = useTransactions();

  // Get user's plan from database
  const { data: databaseUser } = useQuery({
    queryKey: ["auth-user", user?.id],
    enabled: isReady,
    staleTime: 5 * 60 * 1000, // 5 minutes - plan doesn't change often
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/user");
      return response.json();
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    enabled: isReady,
    staleTime: 0, // Always fresh for immediate updates
    retry: (failureCount, error: any) => {
      if (error?.status === 401 && !isReady) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      return response.json();
    },
  });

  // Load financial summary immediately alongside transactions
  const { data: financialSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['financial-summary', user?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      const response = await apiRequest("GET", `/api/financial-summary?${params}`);
      return response.json();
    },
    enabled: isReady, // Load immediately when authenticated
    staleTime: 0, // Always fresh for immediate updates
    retry: (failureCount, error: any) => {
      if (error?.status === 401 && !isReady) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
  });

  const [budgets, setBudgets] = useState<any[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);

  // Get auth headers for Clerk authentication
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      if (typeof window !== 'undefined' && window.Clerk?.session) {
        const token = await window.Clerk.session.getToken();
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
      }
    } catch (error) {
      console.warn('Failed to get Clerk token:', error);
    }
    return {};
  };

  // Fetch budgets with proper authentication
  const fetchBudgets = async () => {
    if (!isReady) return;
    
    setBudgetsLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/budgets', {
        headers: authHeaders,
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setBudgets(data);

      } else {

      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
    } finally {
      setBudgetsLoading(false);
    }
  };

  useEffect(() => {
    if (isReady && transactions) {
      fetchBudgets();
    }
  }, [isReady, transactions]);

  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: typeof newTransaction) => {
      const response = await apiRequest("POST", "/api/transactions", {
        ...transactionData,
        amount: parseFloat(transactionData.amount),
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all relevant queries to force refresh
      queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['transaction-reminders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['expense-reminders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['budgets', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['financial-health', user?.id] });
      
      setIsDialogOpen(false);
      setNewTransaction({
        amount: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
        type: "expense",
        categoryId: "",
        isRecurring: false,
        recurringFrequency: "monthly",
        recurringEndDate: "",
        paymentUrl: "",
        referenceNote: "",
      });
      toast({
        title: t("Transaction Added"),
        description: t("Transaction has been created successfully"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("Error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  if (!user) {
    return null;
  }

  // Helper function to get proper locale mapping for date formatting
  const getDateLocale = () => {
    const currentLang = i18n.language;
    
    if (currentLang.startsWith('es')) {
      return 'es-pe'; // Use Spanish (Peru) for all Spanish variants
    } else if (currentLang.startsWith('sk')) {
      return 'sk-sk'; // Use Slovak
    } else {
      return 'en-us'; // Default to English
    }
  };

  const formatMonth = React.useMemo(() => {
    return (monthStr: string) => {
      const [year, month] = monthStr.split('-');
      const currentLang = i18n.language;
      
      const monthNames = {
        'es': [
          'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ],
        'sk': [
          'január', 'február', 'marec', 'apríl', 'máj', 'jún',
          'júl', 'august', 'september', 'október', 'november', 'december'
        ],
        'en': [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ]
      };
      
      const langKey = currentLang.startsWith('es') ? 'es' : 
                      currentLang.startsWith('sk') ? 'sk' : 'en';
      
      const monthName = monthNames[langKey][parseInt(month) - 1];
      return `${monthName} ${year}`;
    };
  }, [i18n.language]);

  // Generate month options (1-12)
  const generateMonthOptions = () => {
    const currentLang = i18n.language;
    const monthNames = {
      'es': ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
      'sk': ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'],
      'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    };
    
    const langKey = currentLang.startsWith('es') ? 'es' : 
                    currentLang.startsWith('sk') ? 'sk' : 'en';
    
    return monthNames[langKey].map((name, index) => ({
      value: String(index + 1).padStart(2, '0'),
      label: name
    }));
  };

  // Generate year options (current year and previous years)
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
      const year = currentYear - i;
      years.push({ value: String(year), label: String(year) });
    }
    return years;
  };

  const handleSubmit = async () => {
    if (!newTransaction.amount || !newTransaction.description) return;
    createTransactionMutation.mutate(newTransaction);
  };

  return <>
    <SEO 
      title="Dashboard - Financial Overview | FinanzerPro"
      description="View your complete financial picture with real-time expense tracking, budget insights, and AI-powered recommendations. Manage transactions and monitor your financial health."
      keywords="personal finance dashboard, expense tracking, budget overview, financial insights, money management, transaction history"
      canonical="https://finanzerpro.com/dashboard"
    />
      <div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t("Welcome back")}, {user.firstName || t("User")}!
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {t("Here's an overview of your financial situation for")} {formatMonth(selectedMonth)}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <Select value={selectedMonthNum} onValueChange={setSelectedMonthNum}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder={t("Month")} />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMonthOptions().map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-20">
                      <SelectValue placeholder={t("Year")} />
                    </SelectTrigger>
                    <SelectContent>
                      {generateYearOptions().map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <SimpleVoiceButton onComplete={() => {
                  if (user) {
                    queryClient.invalidateQueries({ queryKey: ['transactions'] });
                    queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
                  }
                }} />
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                      onClick={() => {
                        setNewTransaction({
                          amount: "",
                          description: "",
                          date: new Date().toISOString().split('T')[0],
                          type: "expense",
                          categoryId: "",
                          isRecurring: false,
                          recurringFrequency: "monthly",
                          recurringEndDate: "",
                          paymentUrl: "",
                          referenceNote: "",
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t("Add Transaction")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
                  <DialogHeader>
                    <DialogTitle>{t("Add New Transaction")}</DialogTitle>
                    <DialogDescription>
                      {t("Record a new income or expense transaction")}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="amount">{t("Amount")}</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={newTransaction.amount}
                          onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="date">{t("Date")}</Label>
                        <Input
                          id="date"
                          type="date"
                          value={newTransaction.date}
                          onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">{t("Description")}</Label>
                      <Input
                        id="description"
                        value={newTransaction.description}
                        onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                        placeholder={t("Transaction description")}
                      />
                    </div>

                    <div>
                      <Label>{t("Type")}</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={newTransaction.type === "income" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewTransaction({ ...newTransaction, type: "income" })}
                        >
                          <ArrowUpRight className="h-4 w-4 mr-2" />
                          {t("Income")}
                        </Button>
                        <Button
                          variant={newTransaction.type === "expense" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewTransaction({ ...newTransaction, type: "expense" })}
                        >
                          <ArrowDownRight className="h-4 w-4 mr-2" />
                          {t("Expense")}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="category">{t("Category")}</Label>
                      <Select value={newTransaction.categoryId} onValueChange={(value) => setNewTransaction({ ...newTransaction, categoryId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select a category")} />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(categories) && (categories as Category[])
                            .filter((cat: Category) => cat.type === newTransaction.type)
                            .map((category: Category) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {getLocalizedCategoryName(category)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>



                    {/* Premium Features - Standard/Premium only */}
                    <RequirePlan plan="standard" compact={true}>
                      <div className="space-y-4 border-t pt-4">
                        {/* Smart Bill Assistant - for expenses only */}
                        {newTransaction.type === "expense" && (
                          <div className="space-y-4">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {t("Smart Bill Assistant")}
                            </div>
                            <div>
                              <Label htmlFor="paymentUrl">{t("Payment URL (Optional)")}</Label>
                              <Input
                                id="paymentUrl"
                                type="url"
                                value={newTransaction.paymentUrl}
                                onChange={(e) => setNewTransaction({ ...newTransaction, paymentUrl: e.target.value })}
                                placeholder="https://example.com/pay"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t("Link to where you can pay this bill")}
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="referenceNote">{t("Reference Note (Optional)")}</Label>
                              <Input
                                id="referenceNote"
                                value={newTransaction.referenceNote}
                                onChange={(e) => setNewTransaction({ ...newTransaction, referenceNote: e.target.value })}
                                placeholder={t("Account #123456, Reference: ABC789")}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {t("Account number or other reference information")}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Recurring transaction options */}
                        <div className={newTransaction.type === "expense" ? "border-t pt-4 space-y-4" : "space-y-4"}>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="recurring"
                              checked={newTransaction.isRecurring}
                              onCheckedChange={(checked) => 
                                setNewTransaction({ ...newTransaction, isRecurring: checked as boolean })
                              }
                            />
                            <label htmlFor="recurring" className="flex items-center text-sm font-medium">
                              <Repeat className="h-4 w-4 mr-2" />
                              {t("Make this a recurring transaction")}
                            </label>
                          </div>

                          {newTransaction.isRecurring && (
                            <div className="grid grid-cols-2 gap-4 pl-6">
                              <div>
                                <Label htmlFor="frequency">{t("Frequency")}</Label>
                                <Select
                                  value={newTransaction.recurringFrequency}
                                  onValueChange={(value) => setNewTransaction({ 
                                    ...newTransaction, 
                                    recurringFrequency: value as "weekly" | "monthly" | "yearly" 
                                  })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={t("Select frequency")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="weekly">{t("Weekly")}</SelectItem>
                                    <SelectItem value="monthly">{t("Monthly")}</SelectItem>
                                    <SelectItem value="yearly">{t("Yearly")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="endDate">{t("End Date (Optional)")}</Label>
                                <Input
                                  id="endDate"
                                  type="date"
                                  value={newTransaction.recurringEndDate}
                                  onChange={(e) => setNewTransaction({ 
                                    ...newTransaction, 
                                    recurringEndDate: e.target.value 
                                  })}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </RequirePlan>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        {t("Cancel")}
                      </Button>
                      <Button 
                        onClick={handleSubmit}
                        disabled={!newTransaction.amount || !newTransaction.description}
                      >
                        {t("Add")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Financial Overview Cards */}
        <FinancialCards
          key={i18n.language} // Force re-render when language changes
          summary={financialSummary}
          isLoading={summaryLoading}
          budgetsData={budgets as any}
          selectedMonth={selectedMonth}
        />






        {/* Panels are rendered for every signed-in user.
            Functions that require a higher plan are locked by <RequirePlan>. */}
        <div className="space-y-8">
          {/* Health score + quick snapshot + mascot */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <LazyFinancialHealthScore
              summary={financialSummary}
              budgets={budgets as any}
            />
            <LazyQuickFinancialSnapshot
              summary={financialSummary}
              transactions={transactions as any}
            />
            <RequirePlan
              plan="standard"
              compact
              feature={t("Financial Mascot")}
              description={t("Your companion that reacts to your financial health and motivates you.")}
            >
              <FinancialHealthMascot />
            </RequirePlan>
          </div>

          {/* Recent transactions + budget overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <TransactionList
              transactions={transactions as any}
              isLoading={transactionsLoading}
              isPremium={databaseUser?.plan === 'premium'}
            />
            <BudgetOverview isLimited={(databaseUser?.plan ?? 'free') === 'free'} />
          </div>

          {/* Interactive trends chart (Standard+) */}
          <RequirePlan
            plan="standard"
            compact
            feature={t("Trends")}
            description={t("See your spending trends over time with interactive charts.")}
          >
            <LazyTrendsChart />
          </RequirePlan>

          {/* Contextual tips + expense breakdown (Standard+) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RequirePlan
              plan="standard"
              compact
              feature={t("Contextual Tips")}
              description={t("Tips tailored to the data you are viewing, generated by AI.")}
            >
              <LazyContextualFinancialTips
                summary={financialSummary}
                transactions={transactions as any}
                budgets={budgets as any}
                selectedMonth={selectedMonth}
              />
            </RequirePlan>
            <RequirePlan
              plan="standard"
              compact
              feature={t("Expense Breakdown")}
              description={t("See which categories take the largest share of your spending.")}
            >
              <LazyExpenseChart summary={{
                totalExpenses: Math.abs(financialSummary?.totalExpenses || 0),
                expensesByCategory: financialSummary?.transactionsByCategory
                  ?.filter((cat: any) => cat.type === 'expense')
                  ?.map((cat: any, index: number) => ({
                    category: cat.categoryName,
                    amount: Math.abs(cat.amount)
                  })) || []
              }} />
            </RequirePlan>
          </div>

          {/* Reminders + daily recommendations (Standard+) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RequirePlan
              plan="standard"
              compact
              feature={t("Reminders")}
              description={t("Bill reminders and saving streaks to keep you on track.")}
            >
              <LazyTransactionRemindersWidget />
            </RequirePlan>
            <RequirePlan
              plan="standard"
              compact
              feature={t("Daily Recommendations")}
              description={t("Personalized suggestions to improve your spending every day.")}
            >
              <LazyDailyRecommendations
                summary={financialSummary}
                transactions={transactions as any}
                budgets={budgets as any}
              />
            </RequirePlan>
          </div>

          {/* Expense prediction (Premium) + auto-categorization (Standard+) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RequirePlan
              plan="premium"
              compact
              feature={t("Expense Prediction")}
              description={t("AI forecast of your upcoming expenses and cash flow.")}
            >
              <LazyExpensePrediction
                transactions={transactions as any}
                summary={financialSummary}
              />
            </RequirePlan>
            <RequirePlan
              plan="standard"
              compact
              feature={t("Auto-Categorization")}
              description={t("Let AI categorize your transactions automatically as they arrive.")}
            >
              <LazyAutoCategorization transactions={transactions as any} />
            </RequirePlan>
          </div>

          {/* AI financial tips (Premium) */}
          <RequirePlan
            plan="premium"
            compact
            feature={t("AI Financial Tips")}
            description={t("In-depth AI analysis of your spending with actionable advice.")}
          >
            <LazyAIFinancialTips
              summary={!summaryLoading ? financialSummary : undefined}
            />
          </RequirePlan>
        </div>


        
        </div>
      </div>
    </div>
    </>
}
