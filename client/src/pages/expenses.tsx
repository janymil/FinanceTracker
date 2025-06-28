import { useState, useEffect } from "react";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useTransactions } from "@/hooks/useTransactions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UploadReceiptModal from "@/components/UploadReceiptModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Edit3, 
  Trash2, 
  ArrowDownLeft,
  DollarSign,
  TrendingDown,
  BarChart3,
  Repeat
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import RequirePlan from "@/components/require-plan";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import MonthFilter from "@/components/month-filter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useCurrency } from "@/context/CurrencyContext";
import { useTranslation } from "react-i18next";
import TransactionFilters from "@/components/TransactionFilters";

// Helper functions for category localization
const isPredefinedCategory = (category: Category): boolean => {
  return category.userId === null;
};

const getLocalizedCategoryName = (category: Category, t: any): string => {
  if (isPredefinedCategory(category)) {
    return t(`categories.${category.name.toLowerCase().replace(/\s+/g, '_')}`);
  }
  return category.name;
};

interface Transaction {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: "income" | "expense";
  categoryId?: number;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  isRecurring?: boolean;
  recurringFrequency?: "weekly" | "monthly" | "yearly";
  recurringEndDate?: string;
  paymentUrl?: string;
  referenceNote?: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
  userId: string | null;
}

export default function Expenses() {
  const { isReady, user } = useClerkUserReady();
  const { currency } = useCurrency();
  const displayCurrency = currency || '$';
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRecurring, setFilterRecurring] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  
  const [newExpense, setNewExpense] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    categoryId: "",
    isRecurring: false,
    recurringFrequency: "monthly" as "weekly" | "monthly" | "yearly",
    recurringEndDate: "",
    paymentUrl: "",
    referenceNote: "",
  });

  // React Query hooks for data fetching using the same pattern as transactions page
  const { data: transactions = [], isLoading: transactionsLoading, refetch: refetchTransactions } = useTransactions();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      return response.json();
    },
    enabled: isReady && !!user?.id
  });

  const isLoading = transactionsLoading || categoriesLoading;

  // React Query mutation for creating expenses
  const createExpenseMutation = useMutation({
    mutationFn: async (expenseData: typeof newExpense) => {
      const res = await apiRequest("POST", "/api/transactions", {
        ...expenseData,
        amount: parseFloat(expenseData.amount),
        type: "expense",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      setIsDialogOpen(false);
      setNewExpense({
        amount: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
        categoryId: "",
        isRecurring: false,
        recurringFrequency: "monthly",
        recurringEndDate: "",
        paymentUrl: "",
        referenceNote: "",
      });
      toast({
        title: t("expenses.expense_added"),
        description: t("expenses.expense_added_description"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // React Query mutation for updating expenses
  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & typeof newExpense) => {
      const updateData = {
        amount: parseFloat(data.amount),
        description: data.description,
        date: data.date,
        type: "expense" as const,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        isRecurring: data.isRecurring,
        recurringFrequency: data.recurringFrequency,
        recurringEndDate: data.recurringEndDate || null,
        paymentUrl: data.paymentUrl || "",
        referenceNote: data.referenceNote || ""
      };
      
      const res = await apiRequest("PUT", `/api/transactions/${id}`, updateData);
      if (!res.ok) {
        throw new Error(`Update failed: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      setEditingTransaction(null);
      setIsDialogOpen(false);
      toast({
        title: t("expenses.expense_updated"),
        description: t("expenses.expense_updated_description"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // React Query mutation for deleting expenses
  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/transactions/${id}`);
      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast({
        title: t("expenses.expense_deleted"),
        description: t("expenses.expense_deleted_description"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Filter only expense transactions
  const expenseTransactions = transactions.filter((transaction: Transaction) => transaction.type === "expense");
  
  // Apply additional filters
  const filteredExpenses = expenseTransactions.filter((transaction: Transaction) => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.categoryName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === "all" || transaction.categoryName === filterCategory;

    const matchesRecurring = filterRecurring === "all" || 
                           (filterRecurring === "recurring" && transaction.isRecurring) ||
                           (filterRecurring === "one-time" && !transaction.isRecurring);
    
    // Month filter takes precedence over date range
    if (selectedMonth) {
      const transactionDate = new Date(transaction.date);
      const [year, month] = selectedMonth.split('-');
      const monthMatches = transactionDate.getFullYear() === parseInt(year) && 
                          transactionDate.getMonth() === parseInt(month) - 1;
      return matchesSearch && matchesCategory && matchesRecurring && monthMatches;
    }
    
    let matchesDate = true;
    if (dateRange !== "all") {
      const transactionDate = new Date(transaction.date);
      const today = new Date();
      const currentYear = today.getFullYear();
      
      switch (dateRange) {
        case "today":
          matchesDate = transactionDate.toDateString() === today.toDateString();
          break;
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = transactionDate >= weekAgo;
          break;
        case "month":
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = transactionDate >= monthAgo;
          break;
        case "current-month":
          const currentMonth = today.getMonth();
          matchesDate = transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
          break;
        case "jan":
          matchesDate = transactionDate.getMonth() === 0 && transactionDate.getFullYear() === currentYear;
          break;
        case "feb":
          matchesDate = transactionDate.getMonth() === 1 && transactionDate.getFullYear() === currentYear;
          break;
        case "mar":
          matchesDate = transactionDate.getMonth() === 2 && transactionDate.getFullYear() === currentYear;
          break;
        case "apr":
          matchesDate = transactionDate.getMonth() === 3 && transactionDate.getFullYear() === currentYear;
          break;
        case "may":
          matchesDate = transactionDate.getMonth() === 4 && transactionDate.getFullYear() === currentYear;
          break;
        case "jun":
          matchesDate = transactionDate.getMonth() === 5 && transactionDate.getFullYear() === currentYear;
          break;
        case "jul":
          matchesDate = transactionDate.getMonth() === 6 && transactionDate.getFullYear() === currentYear;
          break;
        case "aug":
          matchesDate = transactionDate.getMonth() === 7 && transactionDate.getFullYear() === currentYear;
          break;
        case "sep":
          matchesDate = transactionDate.getMonth() === 8 && transactionDate.getFullYear() === currentYear;
          break;
        case "oct":
          matchesDate = transactionDate.getMonth() === 9 && transactionDate.getFullYear() === currentYear;
          break;
        case "nov":
          matchesDate = transactionDate.getMonth() === 10 && transactionDate.getFullYear() === currentYear;
          break;
        case "dec":
          matchesDate = transactionDate.getMonth() === 11 && transactionDate.getFullYear() === currentYear;
          break;
      }
    }
    
    return matchesSearch && matchesCategory && matchesRecurring && matchesDate;
  });

  const expenseCategories = categories.filter((cat: Category) => cat.type === "expense");
  const availableCategories = Array.from(new Set(expenseTransactions.map((t: Transaction) => t.categoryName).filter(Boolean))) as string[];

  const totalExpenses = filteredExpenses.reduce((sum: number, t: Transaction) => sum + parseFloat(t.amount), 0);
  const averageExpense = filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0;

  // Chart data preparation
  const monthlyExpenseData = expenseTransactions.reduce((acc: any, transaction: Transaction) => {
    const month = format(new Date(transaction.date), "MMM yyyy");
    acc[month] = (acc[month] || 0) + parseFloat(transaction.amount);
    return acc;
  }, {});

  const chartData = Object.entries(monthlyExpenseData).map(([month, amount]) => ({
    month,
    amount: amount as number,
  }));

  const categoryData = expenseTransactions.reduce((acc: any, transaction: Transaction) => {
    const category = transaction.categoryName || "Other";
    acc[category] = (acc[category] || 0) + parseFloat(transaction.amount);
    return acc;
  }, {});

  const pieData = Object.entries(categoryData).map(([name, value], index) => ({
    name,
    value: value as number,
    fill: `hsl(${index * 137.5 % 360}, 70%, 50%)`,
  }));

  const handleSubmit = async () => {
    if (!newExpense.amount || !newExpense.description) return;

    if (editingTransaction) {
      updateExpenseMutation.mutate({ id: editingTransaction.id, ...newExpense });
    } else {
      createExpenseMutation.mutate(newExpense);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    
    // Find the category ID - check both categoryId field and categoryName
    let categoryId = "";
    if (transaction.categoryId) {
      categoryId = transaction.categoryId.toString();
    } else if (transaction.categoryName) {
      const category = categories.find((cat: Category) => cat.name === transaction.categoryName);
      categoryId = category ? category.id.toString() : "";
    }
    
    // Convert date to proper format for date input (YYYY-MM-DD)
    const formattedDate = new Date(transaction.date).toISOString().split('T')[0];
    
    // Format recurring end date if it exists
    const formattedRecurringEndDate = transaction.recurringEndDate 
      ? new Date(transaction.recurringEndDate).toISOString().split('T')[0]
      : "";
    
    setNewExpense({
      amount: transaction.amount,
      description: transaction.description,
      date: formattedDate,
      categoryId: categoryId,
      isRecurring: Boolean(transaction.isRecurring),
      recurringFrequency: (transaction.recurringFrequency as "weekly" | "monthly" | "yearly") || "monthly",
      recurringEndDate: formattedRecurringEndDate,
      paymentUrl: transaction.paymentUrl || "",
      referenceNote: transaction.referenceNote || "",
    });
    setIsDialogOpen(true);
  };

  if (!user) {
    return null;
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t("expenses.title")}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {t("expenses.subtitle")}
              </p>
            </div>
            <div className="flex gap-2">
              <UploadReceiptModal 
                onReceiptProcessed={(data) => {
                  // Refresh expenses after receipt processing
                  refetchTransactions();
                }}
                buttonText={t("upload.button_text")}
              />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => {
                      setEditingTransaction(null);
                      setNewExpense({
                        amount: "",
                        description: "",
                        date: new Date().toISOString().split('T')[0],
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
                    {t("expenses.add_expense")}
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? t("expenses.edit_expense") : t("expenses.add_new_expense")}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTransaction ? t("expenses.edit_description") : t("expenses.add_description")}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="amount">{t("expenses.form.amount")}</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="date">{t("expenses.form.date")}</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">{t("expenses.form.description")}</Label>
                    <Input
                      id="description"
                      value={newExpense.description}
                      onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                      placeholder={t("expenses.form.description_placeholder")}
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">{t("expenses.form.category")}</Label>
                    <Select 
                      value={newExpense.categoryId || ""} 
                      onValueChange={(value) => setNewExpense({ ...newExpense, categoryId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("expenses.form.category_placeholder")}>
                          {newExpense.categoryId && expenseCategories.find(cat => cat.id.toString() === newExpense.categoryId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((category: Category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {getLocalizedCategoryName(category, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Advanced Features - Standard/Premium only */}
                  <RequirePlan plan="standard" compact={true}>
                    <div className="space-y-6 border-t pt-4">
                      {/* Smart Bill Assistant */}
                      <div className="space-y-4">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t("expenses.form.smart_bill_assistant")}
                        </div>
                        <div>
                          <Label htmlFor="paymentUrl">{t("expenses.form.payment_url")}</Label>
                          <Input
                            id="paymentUrl"
                            type="url"
                            value={newExpense.paymentUrl}
                            onChange={(e) => setNewExpense({ ...newExpense, paymentUrl: e.target.value })}
                            placeholder={t("expenses.form.payment_url_placeholder")}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {t("expenses.form.payment_url_help")}
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="referenceNote">{t("expenses.form.reference_note")}</Label>
                          <Input
                            id="referenceNote"
                            value={newExpense.referenceNote}
                            onChange={(e) => setNewExpense({ ...newExpense, referenceNote: e.target.value })}
                            placeholder={t("expenses.form.reference_note_placeholder")}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {t("expenses.form.reference_note_help")}
                          </p>
                        </div>
                      </div>

                      {/* Recurring transaction options */}
                      <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="recurring"
                            checked={newExpense.isRecurring}
                            onCheckedChange={(checked) => 
                              setNewExpense({ ...newExpense, isRecurring: checked as boolean })
                            }
                          />
                          <label htmlFor="recurring" className="flex items-center text-sm font-medium">
                            <Repeat className="h-4 w-4 mr-2" />
                            {t("expenses.form.make_recurring")}
                          </label>
                        </div>

                        {newExpense.isRecurring && (
                          <div className="grid grid-cols-2 gap-4 pl-6">
                            <div>
                              <Label htmlFor="frequency">Frequency</Label>
                              <Select
                                value={newExpense.recurringFrequency}
                                onValueChange={(value) => setNewExpense({ 
                                  ...newExpense, 
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
                                value={newExpense.recurringEndDate}
                                onChange={(e) => setNewExpense({ 
                                  ...newExpense, 
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
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmit}
                      disabled={!newExpense.amount || !newExpense.description}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {editingTransaction ? "Update" : "Add Expense"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                  <DollarSign className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {displayCurrency}{totalExpenses.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Expense</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {displayCurrency}{averageExpense.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Expense Count</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {filteredExpenses.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>



        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Expense Trend</CardTitle>
              <CardDescription>Monthly expenses over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${displayCurrency}${value}`, 'Expenses']} />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#EF4444" 
                      strokeWidth={2}
                      dot={{ fill: '#EF4444' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
              <CardDescription>Distribution of spending categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Month Navigation Filter */}
        <MonthFilter 
          selectedMonth={selectedMonth}
          onMonthSelect={setSelectedMonth}
          onDateRangeReset={() => setDateRange("all")}
        />

        {/* Search and Filters */}
        <div className="mb-6">
          <TransactionFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterCategory={filterCategory}
            onCategoryChange={setFilterCategory}
            filterRecurring={filterRecurring}
            onRecurringChange={setFilterRecurring}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            availableCategories={availableCategories}
            showTypeFilter={false}
            searchPlaceholder="Search expenses..."
          />
        </div>

        {/* Expense List */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Transactions ({filteredExpenses.length})</CardTitle>
            <CardDescription>
              {searchTerm || filterCategory !== "all" || filterRecurring !== "all" || dateRange !== "all" 
                ? "Filtered expense transactions" 
                : "All your expense transactions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                <p className="text-gray-600 dark:text-gray-300 mt-2">Loading expenses...</p>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Expenses Found
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {searchTerm || filterCategory !== "all" || dateRange !== "all"
                    ? "Try adjusting your filters or search terms"
                    : "Add your first expense transaction to get started"}
                </p>
                <Button 
                  onClick={() => setIsDialogOpen(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredExpenses.map((transaction: Transaction) => (
                  <div
                    key={transaction.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg shrink-0">
                        <ArrowDownLeft className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {transaction.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 flex-wrap">
                          <span className="shrink-0">{format(new Date(transaction.date), "MMM dd, yyyy")}</span>
                          {transaction.categoryName && (
                            <Badge variant="outline" className="text-red-600 border-red-600 text-xs">
                              {transaction.categoryName}
                            </Badge>
                          )}
                          {transaction.isRecurring && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                              🔄 {transaction.recurringFrequency}
                            </Badge>
                          )}
                        </div>
                        {transaction.referenceNote && (
                          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">
                            Note: {transaction.referenceNote}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end sm:gap-4 shrink-0">
                      <p className="font-semibold text-red-600 dark:text-red-400 text-lg">
                        -{displayCurrency}{parseFloat(transaction.amount).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(transaction)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteExpenseMutation.mutate(transaction.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}