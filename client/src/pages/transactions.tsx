import { useState } from "react";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
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
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Repeat,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import RequirePlan from "@/components/require-plan";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MonthFilter from "@/components/month-filter";
import { format } from "date-fns";

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

export default function Transactions() {
  const { isReady, user } = useClerkUserReady();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRecurring, setFilterRecurring] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

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

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["/api/transactions", user?.id],
    enabled: isReady,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    enabled: isReady,
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
      queryClient.refetchQueries({ queryKey: ["/api/transactions"] });
      queryClient.refetchQueries({ queryKey: ["/api/financial-summary"] });
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

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & typeof newTransaction) => {
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
        const originalDate = editingTransaction.date instanceof Date 
          ? editingTransaction.date.toISOString().split('T')[0]
          : new Date(editingTransaction.date).toISOString().split('T')[0];
        if (data.date !== originalDate) {
          updateData.date = data.date;
        }
        
        if (data.type !== editingTransaction.type) {
          updateData.type = data.type;
        }
        
        // Find original category ID
        const originalCategory = (categories as Category[]).find(
          cat => cat.name === editingTransaction.categoryName
        );
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
          ? (editingTransaction.recurringEndDate instanceof Date 
              ? editingTransaction.recurringEndDate.toISOString().split('T')[0]
              : new Date(editingTransaction.recurringEndDate).toISOString().split('T')[0])
          : "";
        if (data.recurringEndDate !== originalRecurringEndDate) {
          updateData.recurringEndDate = data.recurringEndDate || null;
        }
        
        if (data.paymentUrl !== (editingTransaction.paymentUrl || "")) {
          updateData.paymentUrl = data.paymentUrl;
        }
        
        if (data.referenceNote !== (editingTransaction.referenceNote || "")) {
          updateData.referenceNote = data.referenceNote;
        }
      }
      
      const res = await apiRequest("PUT", `/api/transactions/${id}`, updateData);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/transactions", user?.id] });
      await queryClient.refetchQueries({ queryKey: ["/api/financial-summary", user?.id] });
      setEditingTransaction(null);
      setIsDialogOpen(false);
      toast({
        title: "Transaction Updated",
        description: "Transaction has been updated successfully",
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

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/transactions/${id}`);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/transactions", user?.id] });
      await queryClient.refetchQueries({ queryKey: ["/api/financial-summary", user?.id] });
      toast({
        title: "Transaction Deleted",
        description: "Transaction has been removed successfully",
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

  // Filter transactions based on search and filters
  const filteredTransactions = transactions.filter((transaction: Transaction) => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.categoryName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === "all" || transaction.type === filterType;

    const matchesCategory = filterCategory === "all" || transaction.categoryName === filterCategory;

    const matchesRecurring = filterRecurring === "all" || 
                           (filterRecurring === "recurring" && transaction.isRecurring) ||
                           (filterRecurring === "one-time" && !transaction.isRecurring);

    // Check month filter first (horizontal filter takes priority)
    let matchesMonth = true;
    if (selectedMonth) {
      const transactionDate = new Date(transaction.date);
      const [year, month] = selectedMonth.split('-');
      matchesMonth = transactionDate.getFullYear() === parseInt(year) && 
                     transactionDate.getMonth() === parseInt(month) - 1;
    }

    let matchesDate = true;
    if (dateRange !== "all" && !selectedMonth) {
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

    return matchesSearch && matchesType && matchesCategory && matchesRecurring && matchesMonth && matchesDate;
  });

  const availableCategories = Array.from(new Set(transactions.map((t: Transaction) => t.categoryName).filter(Boolean)));

  const handleSubmit = () => {
    if (!newTransaction.amount || !newTransaction.description) return;

    if (editingTransaction) {
      updateTransactionMutation.mutate({ id: editingTransaction.id, ...newTransaction });
    } else {
      createTransactionMutation.mutate(newTransaction);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);

    // Find the category ID from the transaction's category name
    const matchingCategory = (categories as Category[]).find(
      cat => cat.name === transaction.categoryName
    );

    // Format the date properly - ensure it's in YYYY-MM-DD format
    const formattedDate = transaction.date instanceof Date 
      ? transaction.date.toISOString().split('T')[0]
      : new Date(transaction.date).toISOString().split('T')[0];

    // Format recurring end date if it exists
    const formattedRecurringEndDate = transaction.recurringEndDate 
      ? (transaction.recurringEndDate instanceof Date 
          ? transaction.recurringEndDate.toISOString().split('T')[0]
          : new Date(transaction.recurringEndDate).toISOString().split('T')[0])
      : "";

    setNewTransaction({
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: formattedDate,
      type: transaction.type,
      categoryId: matchingCategory ? matchingCategory.id.toString() : "",
      isRecurring: Boolean(transaction.isRecurring),
      recurringFrequency: (transaction.recurringFrequency as "weekly" | "monthly" | "yearly") || "monthly",
      recurringEndDate: formattedRecurringEndDate,
      paymentUrl: transaction.paymentUrl || "",
      referenceNote: transaction.referenceNote || "",
    });
    setIsDialogOpen(true);
  };

  const totalIncome = filteredTransactions
    .filter((t: Transaction) => t.type === "income")
    .reduce((sum: number, t: Transaction) => sum + parseFloat(t.amount), 0);

  const totalExpenses = filteredTransactions
    .filter((t: Transaction) => t.type === "expense")
    .reduce((sum: number, t: Transaction) => sum + parseFloat(t.amount), 0);

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
                All Transactions
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Manage all your income and expense transactions
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => {
                    setEditingTransaction(null);
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
                  <DialogTitle>
                    {editingTransaction ? "Edit Transaction" : "Add New Transaction"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTransaction ? "Update the transaction details" : 
                     user?.plan === 'free' ? 
                     `Record a new transaction (${transactions?.length || 0}/100 entries used)` :
                     "Record a new income or expense transaction"}
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
                        {(categories as Category[])
                          .filter((cat: Category) => cat.type === newTransaction.type)
                          .map((category: Category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Premium Features - Standard/Premium only */}
                  <RequirePlan plan="standard" compact={true}>
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
                      disabled={!newTransaction.amount || !newTransaction.description || createTransactionMutation.isPending || updateTransactionMutation.isPending}
                    >
                      {editingTransaction ? "Update" : "Add"}
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
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
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
                <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
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
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Balance</p>
                  <p className={`text-2xl font-bold ${(totalIncome - totalExpenses) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    ${(totalIncome - totalExpenses).toFixed(2)}
                  </p>
                </div>
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    className="pl-10"
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Type</Label>
                <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
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
                    <SelectItem value="all">All Transactions</SelectItem>
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

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
            <CardDescription>
              {searchTerm || filterType !== "all" || filterCategory !== "all" || filterRecurring !== "all" || dateRange !== "all" 
                ? "Filtered transactions" 
                : "All your transactions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 dark:text-gray-300 mt-2">Loading transactions...</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Transactions Found
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {searchTerm || filterType !== "all" || filterCategory !== "all" || dateRange !== "all"
                    ? "Try adjusting your filters or search terms"
                    : "Add your first transaction to get started"}
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((transaction: Transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${transaction.type === "income" ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                        {transaction.type === "income" ? (
                          <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
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
                              <Badge variant="outline">{transaction.categoryName}</Badge>
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
                      <p className={`font-semibold ${transaction.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {transaction.type === "income" ? "+" : "-"}${parseFloat(transaction.amount).toFixed(2)}
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
                          onClick={() => deleteTransactionMutation.mutate(transaction.id)}
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