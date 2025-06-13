import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import FinancialCards from "@/components/financial-cards";
import TransactionList from "@/components/transaction-list";
import TrendsChart from "@/components/trends-chart";
import { ExpenseChart } from "@/components/expense-chart";
import BudgetOverview from "@/components/budget-overview";
import RequirePlan from "@/components/require-plan";
import UpgradeBanner from "@/components/upgrade-banner";
import FinancialHealthScore from "@/components/financial-health-score";
import QuickFinancialSnapshot from "@/components/quick-financial-snapshot";
import ContextualFinancialTips from "@/components/contextual-financial-tips";
import RemindersStreaks from "@/components/reminders-streaks";
import ExpensePrediction from "@/components/expense-prediction";
import DailyRecommendations from "@/components/daily-recommendations";
import CloudBackup from "@/components/cloud-backup";
import AutoCategorization from "@/components/auto-categorization";
import AIFinancialTips from "@/components/ai-financial-tips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [selectedMonth, setSelectedMonth] = useState("2024-05");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [newTransaction, setNewTransaction] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    type: "expense" as "income" | "expense",
    categoryId: "",
  });

  // Get start and end dates for the selected month
  const startDate = new Date(`${selectedMonth}-01`);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

  const { data: financialSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/financial-summary', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      const response = await fetch(`/api/financial-summary?${params}`);
      if (!response.ok) throw new Error('Failed to fetch financial summary');
      return response.json();
    },
    enabled: !!user,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['/api/transactions'],
    enabled: !!user,
  });

  const { data: budgets } = useQuery({
    queryKey: ['/api/budgets'],
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    enabled: !!user,
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
                  <SelectItem value="2024-05">May 2024</SelectItem>
                  <SelectItem value="2024-04">April 2024</SelectItem>
                  <SelectItem value="2024-03">March 2024</SelectItem>
                  <SelectItem value="2024-02">February 2024</SelectItem>
                  <SelectItem value="2024-01">January 2024</SelectItem>
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
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </Button>
                </DialogTrigger>
                <DialogContent>
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
                          {categories
                            .filter((cat: Category) => cat.type === newTransaction.type)
                            .map((category: Category) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

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
        />

        {/* Free User Content */}
        {user?.plan === 'free' && (
          <div className="space-y-8">
            <UpgradeBanner />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <TransactionList
                transactions={transactions as any}
                isLoading={transactionsLoading}
                isPremium={false}
              />

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Budget Overview</h3>
                  <div className="bg-premium-light text-premium px-2 py-1 rounded text-xs font-medium">
                    Premium Feature
                  </div>
                </div>

                <div className="text-center py-8">
                  <div className="text-4xl text-gray-300 dark:text-gray-600 mb-4">📊</div>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Detailed expense breakdown and budget tracking available with Premium
                  </p>
                  <Button className="bg-premium hover:bg-premium/90 text-white">
                    Upgrade to Premium
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Basic/Premium User Content */}
        {(user?.plan === 'standard' || user?.plan === 'premium') && (
          <div className="space-y-8">
            {/* Advanced Analytics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <FinancialHealthScore 
                summary={financialSummary}
                budgets={budgets as any}
              />
              <QuickFinancialSnapshot 
                summary={financialSummary}
                transactions={transactions as any}
              />
              <ContextualFinancialTips
                summary={financialSummary}
                transactions={transactions as any}
                budgets={budgets as any}
              />
            </div>

            {/* Interactive Charts */}
            <TrendsChart />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <TransactionList
                transactions={transactions as any}
                isLoading={transactionsLoading}
                isPremium={user?.plan === 'premium'}
              />

              <ExpenseChart summary={financialSummary} />
            </div>

            {/* Budget Categories */}
            <RequirePlan plan="standard">
              <BudgetOverview />
            </RequirePlan>

            {/* Advanced Features */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <RequirePlan plan="standard">
                <RemindersStreaks />
              </RequirePlan>
              
              <RequirePlan plan="standard">
                <AutoCategorization transactions={transactions as any} />
              </RequirePlan>
            </div>

            {/* Premium Features */}
            <RequirePlan plan="premium">
              <ExpensePrediction 
                transactions={transactions as any}
                summary={financialSummary}
              />
            </RequirePlan>

            <RequirePlan plan="premium">
              <DailyRecommendations 
                summary={financialSummary}
                transactions={transactions as any}
                budgets={budgets as any}
              />
            </RequirePlan>

            <RequirePlan plan="premium">
              <AIFinancialTips 
                summary={financialSummary}
              />
            </RequirePlan>

            <RequirePlan plan="premium">
              <CloudBackup />
            </RequirePlan>
          </div>
        )}
      </div>
    </div>
  );
}