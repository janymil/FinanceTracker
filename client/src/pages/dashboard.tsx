import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, startTransition, useDeferredValue, useTransition } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";


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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar, ArrowUpRight, ArrowDownLeft, Repeat } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Check for subscription success/error messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const upgrade = urlParams.get('upgrade');
    const plan = urlParams.get('plan');
    const error = urlParams.get('error');
    
    if (upgrade === 'success' && plan) {
      toast({
        title: "Subscription Successful!",
        description: `You've been upgraded to the ${plan} plan. Enjoy your new features!`,
      });
      // Clean up URL parameters
      window.history.replaceState({}, '', '/');
    } else if (error) {
      let message = "An error occurred during payment processing.";
      switch (error) {
        case 'payment_not_completed':
          message = "Payment was not completed. Please try again.";
          break;
        case 'user_not_found':
          message = "User account not found. Please contact support.";
          break;
        case 'plan_update_failed':
          message = "Payment successful but plan update failed. Please contact support.";
          break;
      }
      toast({
        title: "Payment Error",
        description: message,
        variant: "destructive",
      });
      // Clean up URL parameters
      window.history.replaceState({}, '', '/');
    }
  }, [toast]);
  const [isPending, startTransition] = useTransition();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Defer expensive rendering to prevent Suspense errors
  const deferredSelectedMonth = useDeferredValue(selectedMonth);
  const deferredUser = useDeferredValue(user);

  useEffect(() => {
    // Check for subscription success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('subscription') === 'success') {
      toast({
        title: "Subscription Activated!",
        description: "Welcome to your new plan! All features are now available.",
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

  // Get start and end dates for the selected month
  const startDate = new Date(`${selectedMonth}-01`);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

  // Core data loads immediately
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['/api/transactions'],
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    enabled: !!user,
  });

  // Secondary data loads after a delay for better perceived performance
  const { data: financialSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/financial-summary', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      const response = await apiRequest("GET", `/api/financial-summary?${params}`);
      return response.json();
    },
    enabled: !!user && !!transactions, // Wait for transactions first
  });

  const { data: budgets } = useQuery({
    queryKey: ['/api/budgets'],
    enabled: !!user && !!transactions, // Wait for transactions first
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: typeof newTransaction) => {
      const res = await apiRequest("POST", "/api/transactions", {
        ...transactionData,
        amount: parseFloat(transactionData.amount),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
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
        title: "Transaction Added",
        description: "Transaction has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return null;
  }

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  // Generate dynamic month options (current month + last 11 months)
  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const value = `${year}-${month}`;
      const label = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });
      options.push({ value, label });
    }
    
    return options;
  };

  const handleSubmit = () => {
    if (!newTransaction.amount || !newTransaction.description) return;
    createTransactionMutation.mutate(newTransaction);
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Welcome back, {user.firstName || 'User'}!
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Here's an overview of your financial situation for {formatMonth(selectedMonth)}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateMonthOptions().map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-primary hover:bg-primary/90"
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
                    Add Transaction
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Transaction</DialogTitle>
                    <DialogDescription>
                      Record a new income or expense transaction
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="amount">Amount</Label>
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
                        <Label htmlFor="date">Date</Label>
                        <Input
                          id="date"
                          type="date"
                          value={newTransaction.date}
                          onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={newTransaction.description}
                        onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                        placeholder="Transaction description"
                      />
                    </div>

                    <div>
                      <Label>Type</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={newTransaction.type === "income" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewTransaction({ ...newTransaction, type: "income" })}
                        >
                          <ArrowUpRight className="h-4 w-4 mr-2" />
                          Income
                        </Button>
                        <Button
                          variant={newTransaction.type === "expense" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewTransaction({ ...newTransaction, type: "expense" })}
                        >
                          <ArrowDownLeft className="h-4 w-4 mr-2" />
                          Expense
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select value={newTransaction.categoryId} onValueChange={(value) => setNewTransaction({ ...newTransaction, categoryId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(categories) && (categories as Category[])
                            .filter((cat: Category) => cat.type === newTransaction.type)
                            .map((category: Category) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Smart Bill Assistant - Standard/Premium only, expenses only */}
                    {newTransaction.type === "expense" && (
                      <RequirePlan plan="standard">
                        <div className="space-y-4 border-t pt-4">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Smart Bill Assistant
                          </div>
                          <div>
                            <Label htmlFor="paymentUrl">Payment URL (Optional)</Label>
                            <Input
                              id="paymentUrl"
                              type="url"
                              value={newTransaction.paymentUrl}
                              onChange={(e) => setNewTransaction({ ...newTransaction, paymentUrl: e.target.value })}
                              placeholder="https://example.com/pay"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Link to where you can pay this bill
                            </p>
                          </div>
                          <div>
                            <Label htmlFor="referenceNote">Reference Note (Optional)</Label>
                            <Input
                              id="referenceNote"
                              value={newTransaction.referenceNote}
                              onChange={(e) => setNewTransaction({ ...newTransaction, referenceNote: e.target.value })}
                              placeholder="Account #123456, Reference: ABC789"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Account number or other reference information
                            </p>
                          </div>
                        </div>
                      </RequirePlan>
                    )}

                    {/* Recurring transaction options - Standard/Premium only */}
                    <RequirePlan plan="standard">
                      <div className="space-y-4 border-t pt-4">
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
                            Make this a recurring transaction
                          </label>
                        </div>

                        {newTransaction.isRecurring && (
                          <div className="grid grid-cols-2 gap-4 pl-6">
                            <div>
                              <Label htmlFor="frequency">Frequency</Label>
                              <Select
                                value={newTransaction.recurringFrequency}
                                onValueChange={(value) => setNewTransaction({ 
                                  ...newTransaction, 
                                  recurringFrequency: value as "weekly" | "monthly" | "yearly" 
                                })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="endDate">End Date (Optional)</Label>
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
                    </RequirePlan>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSubmit}
                        disabled={!newTransaction.amount || !newTransaction.description || createTransactionMutation.isPending}
                      >
                        Add
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
          summary={financialSummary}
          isLoading={summaryLoading}
          budgetsData={budgets as any}
          selectedMonth={selectedMonth}
        />



        {/* Free User Content */}
        {user?.plan === 'free' && (
          <div className="space-y-8">
            <UpgradeBanner />

            {/* Simple Financial Health Score for Free Users */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <LazyFinancialHealthScore 
                summary={financialSummary}
                budgets={budgets as any}
              />
              <LazyQuickFinancialSnapshot 
                summary={financialSummary}
                transactions={transactions as any}
              />
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Financial Tips</h3>
                  <div className="bg-standard-light text-standard px-2 py-1 rounded text-xs font-medium">
                    Standard Feature
                  </div>
                </div>

                <div className="text-center py-8">
                  <div className="text-4xl text-gray-300 dark:text-gray-600 mb-4">🤖</div>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    AI-powered financial tips available with Standard plan
                  </p>
                  <Button className="bg-standard hover:bg-standard/90 text-white">
                    Upgrade to Standard
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <TransactionList
                transactions={transactions as any}
                isLoading={transactionsLoading}
                isPremium={false}
              />

              <BudgetOverview isLimited={true} />
            </div>
          </div>
        )}

        {/* Basic/Premium User Content - Rendered with startTransition */}
        {(deferredUser?.plan === 'standard' || deferredUser?.plan === 'premium') && !isPending && (
          <div className="space-y-8">
            {/* Advanced Analytics Row - AI-driven for Standard/Premium */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <FinancialHealthMascot />
              <LazyQuickFinancialSnapshot 
                summary={financialSummary}
                transactions={transactions as any}
              />
              <LazyContextualFinancialTips
                summary={financialSummary}
                transactions={transactions as any}
                budgets={budgets as any}
              />
            </div>

            {/* Interactive Charts */}
            <LazyTrendsChart />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <TransactionList
                transactions={transactions as any}
                isLoading={transactionsLoading}
                isPremium={user?.plan === 'premium'}
              />

              <LazyExpenseChart summary={{
                totalExpenses: Math.abs(financialSummary?.totalExpenses || 0),
                expensesByCategory: financialSummary?.transactionsByCategory
                  ?.filter((cat: any) => cat.type === 'expense')
                  ?.map((cat: any, index: number) => ({
                    category: cat.categoryName,
                    amount: Math.abs(cat.amount)
                  })) || []
              }} />
            </div>

            {/* Budget Categories */}
            <RequirePlan plan="standard">
              <BudgetOverview />
            </RequirePlan>

            {/* Advanced Features */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <LazyTransactionRemindersWidget />
              
              <RequirePlan plan="standard">
                <LazyRemindersStreaks />
              </RequirePlan>
              
              <RequirePlan plan="standard">
                <LazyAutoCategorization transactions={transactions as any} />
              </RequirePlan>
            </div>

            {/* Premium Features */}
            <RequirePlan plan="premium">
              <LazyExpensePrediction 
                transactions={transactions as any}
                summary={financialSummary}
              />
            </RequirePlan>

            <RequirePlan plan="premium">
              <LazyDailyRecommendations 
                summary={financialSummary}
                transactions={transactions as any}
                budgets={budgets as any}
              />
            </RequirePlan>

            <RequirePlan plan="premium">
              <LazyAIFinancialTips 
                summary={financialSummary}
              />
            </RequirePlan>


          </div>
        )}
      </div>
    </div>
  );
}