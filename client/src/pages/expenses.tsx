import { useState } from "react";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useTransactions } from "@/hooks/useTransactions";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import MonthFilter from "@/components/month-filter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Transaction {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: "income" | "expense";
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  paymentUrl?: string;
  referenceNote?: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
}

export default function Expenses() {
  const { isReady, user } = useClerkUserReady();
  const { toast } = useToast();
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

  const { data: transactions = [], isLoading } = useTransactions();

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    enabled: isReady,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 && !isReady) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (expenseData: typeof newExpense) => {
      const res = await apiRequest("POST", "/api/transactions", {
        ...expenseData,
        amount: parseFloat(expenseData.amount),
        type: "expense",
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
        title: "Expense Added",
        description: "Expense transaction has been created successfully",
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

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & typeof newExpense) => {
      // Always send complete transaction data
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
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary", user?.id] });
      queryClient.refetchQueries({ queryKey: ["transactions", user?.id] });
      queryClient.refetchQueries({ queryKey: ["financial-summary", user?.id] });
      
      setEditingTransaction(null);
      setIsDialogOpen(false);
      toast({
        title: "Expense Updated",
        description: "Expense transaction has been updated successfully",
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

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/transactions/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary", user?.id] });
      queryClient.refetchQueries({ queryKey: ["transactions", user?.id] });
      queryClient.refetchQueries({ queryKey: ["financial-summary", user?.id] });
      toast({
        title: "Expense Deleted",
        description: "Expense transaction has been removed successfully",
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

  // Filter only expense transactions
  const expenseTransactions = transactions.filter((transaction: Transaction) => transaction.type === "expense");
  
  // Debug log to track re-renders
  console.log("Expenses component rendered", expenseTransactions);
  
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
  const availableCategories = Array.from(new Set(expenseTransactions.map((t: Transaction) => t.categoryName).filter(Boolean)));

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

  const handleSubmit = () => {
    if (!newExpense.amount || !newExpense.description) return;

    if (editingTransaction) {
      updateExpenseMutation.mutate({ id: editingTransaction.id, ...newExpense });
    } else {
      createExpenseMutation.mutate(newExpense);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    // Find the category ID for this transaction
    const category = categories.find((cat: Category) => cat.name === transaction.categoryName);
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
      categoryId: category ? category.id.toString() : "",
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
                Expense Management
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Track and manage all your expenses and spending
              </p>
            </div>
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
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? "Edit Expense" : "Add New Expense"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTransaction ? "Update the expense details" : "Record a new expense transaction"}
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
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newExpense.description}
                      onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                      placeholder="Expense description"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={newExpense.categoryId} onValueChange={(value) => setNewExpense({ ...newExpense, categoryId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an expense category" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((category: Category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
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
                          Smart Bill Assistant
                        </div>
                        <div>
                          <Label htmlFor="paymentUrl">Payment URL (Optional)</Label>
                          <Input
                            id="paymentUrl"
                            type="url"
                            value={newExpense.paymentUrl}
                            onChange={(e) => setNewExpense({ ...newExpense, paymentUrl: e.target.value })}
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
                            value={newExpense.referenceNote}
                            onChange={(e) => setNewExpense({ ...newExpense, referenceNote: e.target.value })}
                            placeholder="Account #123456, Reference: ABC789"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Account number or other reference information
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
                            Make this a recurring expense
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
                      disabled={!newExpense.amount || !newExpense.description || createExpenseMutation.isPending || updateExpenseMutation.isPending}
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
                    ${totalExpenses.toFixed(2)}
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
                    ${averageExpense.toFixed(2)}
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
                    <Tooltip formatter={(value) => [`$${value}`, 'Expenses']} />
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

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    className="pl-10"
                    placeholder="Search expenses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Category</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Recurring</Label>
                <Select value={filterRecurring} onValueChange={setFilterRecurring}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Expenses</SelectItem>
                    <SelectItem value="recurring">Recurring Only</SelectItem>
                    <SelectItem value="one-time">One-time Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="current-month">This Month</SelectItem>
                    <SelectItem value="jan">January</SelectItem>
                    <SelectItem value="feb">February</SelectItem>
                    <SelectItem value="mar">March</SelectItem>
                    <SelectItem value="apr">April</SelectItem>
                    <SelectItem value="may">May</SelectItem>
                    <SelectItem value="jun">June</SelectItem>
                    <SelectItem value="jul">July</SelectItem>
                    <SelectItem value="aug">August</SelectItem>
                    <SelectItem value="sep">September</SelectItem>
                    <SelectItem value="oct">October</SelectItem>
                    <SelectItem value="nov">November</SelectItem>
                    <SelectItem value="dec">December</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

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
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                        <ArrowDownLeft className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {transaction.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <span>{format(new Date(transaction.date), "MMM dd, yyyy")}</span>
                          {transaction.categoryName && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                {transaction.categoryName}
                              </Badge>
                            </>
                          )}
                          {transaction.isRecurring && (
                            <>
                              <span>•</span>
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                🔄 {transaction.recurringFrequency}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        -${parseFloat(transaction.amount).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(transaction)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteExpenseMutation.mutate(transaction.id)}
                        >
                          <Trash2 className="h-3 w-3" />
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
  );
}