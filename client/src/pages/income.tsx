import { useState, useEffect } from "react";
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
  ArrowUpRight,
  DollarSign,
  TrendingUp,
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
}

export default function Income() {
  const { isReady, user } = useClerkUserReady();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRecurring, setFilterRecurring] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  
  const [newIncome, setNewIncome] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    categoryId: "",
    isRecurring: false,
    recurringFrequency: "monthly" as "weekly" | "monthly" | "yearly",
    recurringEndDate: "",
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: isReady,
    retry: (failureCount, error: any) => {
      // Don't retry if authentication failed due to timing
      if (error?.status === 401 && !isReady) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    enabled: isReady,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 && !isReady) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
  });

  const createIncomeMutation = useMutation({
    mutationFn: async (incomeData: typeof newIncome) => {
      const res = await apiRequest("POST", "/api/transactions", {
        ...incomeData,
        amount: parseFloat(incomeData.amount),
        type: "income",
      });
      return await res.json();
    },
    onMutate: async (newIncomeData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["transactions"] });
      
      // Snapshot the previous value
      const previousTransactions = queryClient.getQueryData(["transactions"]);
      
      // Optimistically update to the new value
      const optimisticTransaction = {
        id: Date.now(), // Temporary ID
        ...newIncomeData,
        amount: newIncomeData.amount,
        type: "income",
        date: new Date(newIncomeData.date).toISOString(),
        userId: user?.id,
        categoryName: categories.find((cat: any) => cat.id.toString() === newIncomeData.categoryId)?.name || null
      };
      
      queryClient.setQueryData(["transactions"], (old: any) => {
        return old ? [optimisticTransaction, ...old] : [optimisticTransaction];
      });
      
      // Return a context object with the snapshotted value
      return { previousTransactions };
    },
    onError: (err, newIncomeData, context) => {
      // If the mutation fails, use the context to roll back
      queryClient.setQueryData(["/api/transactions"], context?.previousTransactions);
      toast({
        title: "Error",
        description: "Failed to add income. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (newTransaction) => {
      // Update with real data from server
      queryClient.setQueryData(["/api/transactions", user?.id], (old: any) => {
        if (!old) return [newTransaction];
        // Replace the optimistic update with real data
        return [newTransaction, ...old.filter((t: any) => t.id !== Date.now())];
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary", user?.id] });
      queryClient.refetchQueries({ queryKey: ["/api/financial-summary", user?.id] });
      queryClient.refetchQueries({ queryKey: ["/api/expense-breakdown"] });
      
      setIsDialogOpen(false);
      setNewIncome({
        amount: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
        categoryId: "",
        isRecurring: false,
        recurringFrequency: "monthly",
        recurringEndDate: "",
      });
      toast({
        title: "Income Added",
        description: "Income transaction has been created successfully",
      });
    },
  });

  const updateIncomeMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & typeof newIncome) => {
      // Only send fields that have actually changed from the original transaction
      const updateData: any = {};
      
      if (editingTransaction) {
        // Convert the original amount to string for comparison
        const originalAmount = editingTransaction.amount.toString();
        if (data.amount !== originalAmount) {
          updateData.amount = parseFloat(data.amount);
        }
        
        if (data.description !== editingTransaction.description) {
          updateData.description = data.description;
        }
        
        // Format original date for comparison
        const originalDate = new Date(editingTransaction.date).toISOString().split('T')[0];
        if (data.date !== originalDate) {
          updateData.date = data.date;
        }
        
        // Find original category ID
        const originalCategory = categories.find((cat: Category) => cat.name === editingTransaction.categoryName);
        const originalCategoryId = originalCategory ? originalCategory.id.toString() : "";
        if (data.categoryId !== originalCategoryId) {
          updateData.categoryId = data.categoryId ? parseInt(data.categoryId) : null;
        }
        
        if (data.isRecurring !== Boolean(editingTransaction.isRecurring)) {
          updateData.isRecurring = data.isRecurring;
        }
        
        if (data.recurringFrequency !== (editingTransaction.recurringFrequency || "monthly")) {
          updateData.recurringFrequency = data.recurringFrequency;
        }
        
        // Format original recurring end date for comparison
        const originalRecurringEndDate = editingTransaction.recurringEndDate 
          ? new Date(editingTransaction.recurringEndDate).toISOString().split('T')[0]
          : "";
        if (data.recurringEndDate !== originalRecurringEndDate) {
          updateData.recurringEndDate = data.recurringEndDate || null;
        }
        
        // Always ensure type is income for this page
        updateData.type = "income";
      }
      
      const res = await apiRequest("PUT", `/api/transactions/${id}`, updateData);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["transactions", user?.id] });
      await queryClient.refetchQueries({ queryKey: ["financial-summary", user?.id] });
      setEditingTransaction(null);
      setIsDialogOpen(false);
      toast({
        title: "Income Updated",
        description: "Income transaction has been updated successfully",
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

  const deleteIncomeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/transactions/${id}`);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["transactions", user?.id] });
      await queryClient.refetchQueries({ queryKey: ["financial-summary", user?.id] });
      toast({
        title: "Income Deleted",
        description: "Income transaction has been removed successfully",
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

  // Filter only income transactions
  const incomeTransactions = transactions.filter((transaction: Transaction) => transaction.type === "income");
  
  // Apply additional filters
  const filteredIncomes = incomeTransactions.filter((transaction: Transaction) => {
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

  const incomeCategories = categories.filter((cat: Category) => cat.type === "income");
  const availableCategories = Array.from(new Set(incomeTransactions.map((t: Transaction) => t.categoryName).filter(Boolean)));

  const totalIncome = filteredIncomes.reduce((sum: number, t: Transaction) => sum + parseFloat(t.amount), 0);
  const averageIncome = filteredIncomes.length > 0 ? totalIncome / filteredIncomes.length : 0;

  // Chart data preparation
  const monthlyIncomeData = incomeTransactions.reduce((acc: any, transaction: Transaction) => {
    const month = format(new Date(transaction.date), "MMM yyyy");
    acc[month] = (acc[month] || 0) + parseFloat(transaction.amount);
    return acc;
  }, {});

  const chartData = Object.entries(monthlyIncomeData).map(([month, amount]) => ({
    month,
    amount: amount as number,
  }));

  const categoryData = incomeTransactions.reduce((acc: any, transaction: Transaction) => {
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
    if (!newIncome.amount || !newIncome.description) return;

    if (editingTransaction) {
      updateIncomeMutation.mutate({ id: editingTransaction.id, ...newIncome });
    } else {
      createIncomeMutation.mutate(newIncome);
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
    
    setNewIncome({
      amount: transaction.amount,
      description: transaction.description,
      date: formattedDate,
      categoryId: category ? category.id.toString() : "",
      isRecurring: Boolean(transaction.isRecurring),
      recurringFrequency: (transaction.recurringFrequency as "weekly" | "monthly" | "yearly") || "monthly",
      recurringEndDate: formattedRecurringEndDate,
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
                Income Management
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Track and manage all your income sources
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setEditingTransaction(null);
                    setNewIncome({
                      amount: "",
                      description: "",
                      date: new Date().toISOString().split('T')[0],
                      categoryId: "",
                      isRecurring: false,
                      recurringFrequency: "monthly",
                      recurringEndDate: "",
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Income
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? "Edit Income" : "Add New Income"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTransaction ? "Update the income details" : "Record a new income transaction"}
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
                        value={newIncome.amount}
                        onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newIncome.date}
                        onChange={(e) => setNewIncome({ ...newIncome, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newIncome.description}
                      onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                      placeholder="Income description"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={newIncome.categoryId} onValueChange={(value) => setNewIncome({ ...newIncome, categoryId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an income category" />
                      </SelectTrigger>
                      <SelectContent>
                        {incomeCategories.map((category: Category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Recurring transaction options - Standard/Premium only */}
                  <RequirePlan plan="standard" compact={true}>
                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="recurring"
                          checked={newIncome.isRecurring}
                          onCheckedChange={(checked) => 
                            setNewIncome({ ...newIncome, isRecurring: checked as boolean })
                          }
                        />
                        <label htmlFor="recurring" className="flex items-center text-sm font-medium">
                          <Repeat className="h-4 w-4 mr-2" />
                          Make this a recurring income
                        </label>
                      </div>

                      {newIncome.isRecurring && (
                        <div className="grid grid-cols-2 gap-4 pl-6">
                          <div>
                            <Label htmlFor="frequency">Frequency</Label>
                            <Select
                              value={newIncome.recurringFrequency}
                              onValueChange={(value) => setNewIncome({ 
                                ...newIncome, 
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
                              value={newIncome.recurringEndDate}
                              onChange={(e) => setNewIncome({ 
                                ...newIncome, 
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
                      disabled={!newIncome.amount || !newIncome.description || createIncomeMutation.isPending || updateIncomeMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {editingTransaction ? "Update" : "Add Income"}
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
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Income</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${totalIncome.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Income</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${averageIncome.toFixed(2)}
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
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Income Count</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {filteredIncomes.length}
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
              <CardTitle>Income Trend</CardTitle>
              <CardDescription>Monthly income over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, 'Income']} />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      dot={{ fill: '#10B981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Income by Category</CardTitle>
              <CardDescription>Distribution of income sources</CardDescription>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    className="pl-10"
                    placeholder="Search income..."
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
                    <SelectItem value="all">All Income</SelectItem>
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

        {/* Income List */}
        <Card>
          <CardHeader>
            <CardTitle>Income Transactions ({filteredIncomes.length})</CardTitle>
            <CardDescription>
              {searchTerm || filterCategory !== "all" || filterRecurring !== "all" || dateRange !== "all" 
                ? "Filtered income transactions" 
                : "All your income transactions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-gray-600 dark:text-gray-300 mt-2">Loading income...</p>
              </div>
            ) : filteredIncomes.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Income Found
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {searchTerm || filterCategory !== "all" || filterRecurring !== "all" || dateRange !== "all"
                    ? "Try adjusting your filters or search terms"
                    : "Add your first income transaction to get started"}
                </p>
                <Button 
                  onClick={() => setIsDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Income
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredIncomes.map((transaction: Transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
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
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                {transaction.categoryName}
                              </Badge>
                            </>
                          )}
                          {transaction.isRecurring && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-blue-600 border-blue-600">
                                Recurring
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        +${parseFloat(transaction.amount).toFixed(2)}
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
                          onClick={() => deleteIncomeMutation.mutate(transaction.id)}
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