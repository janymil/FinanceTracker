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

import { useToast } from "@/hooks/use-toast";
import MonthFilter from "@/components/month-filter";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyContext";
import { useTranslation } from "react-i18next";
import TransactionFilters from "@/components/TransactionFilters";

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
  imageUrl?: string;
  ocrText?: string;
  ocrVendor?: string;
  ocrDetectedAmount?: string;
  ocrDetectedDate?: string;
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
  const { currency } = useCurrency();
  const displayCurrency = currency || '$';
  const { t } = useTranslation();

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

  // React Query hooks for data fetching using the same pattern as dashboard
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



  // React Query mutation for creating transactions
  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: typeof newTransaction) => {
      const res = await apiRequest("POST", "/api/transactions", {
        ...transactionData,
        amount: parseFloat(transactionData.amount),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      setIsDialogOpen(false);
      toast({
        title: t("Transaction Added"),
        description: t("transactions.transactionAddedSuccess"),
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

  // React Query mutation for editing transactions
  const editTransactionMutation = useMutation({
    mutationFn: async (transactionData: any) => {
      const res = await apiRequest("PUT", `/api/transactions/${transactionData.id}`, transactionData);
      if (!res.ok) {
        throw new Error(`Edit failed: ${res.status}`);
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
        title: t("Transaction Updated"),
        description: t("Transaction has been updated successfully"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("Edit Failed"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // React Query mutation for updating transactions via form
  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & typeof newTransaction) => {
      const updateData = {
        amount: parseFloat(newTransaction.amount),
        description: newTransaction.description,
        date: newTransaction.date,
        type: newTransaction.type,
        categoryId: parseInt(newTransaction.categoryId),
        isRecurring: newTransaction.isRecurring,
        recurringFrequency: newTransaction.recurringFrequency,
        recurringEndDate: newTransaction.recurringEndDate || null,
        paymentUrl: newTransaction.paymentUrl || "",
        referenceNote: newTransaction.referenceNote || ""
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
        title: t("Transaction Updated"),
        description: t("Transaction has been updated successfully"),
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

  // React Query mutation for deleting transactions
  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/transactions/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      toast({
        title: t("Transaction Deleted"),
        description: t("Transaction has been removed successfully"),
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

  const availableCategories = Array.from(new Set(transactions.map((t: Transaction) => t.categoryName).filter(Boolean))) as string[];

  const handleSubmit = async () => {
    if (!newTransaction.amount || !newTransaction.description) return;

    if (editingTransaction) {
      // Use React Query mutation for editing
      const updateData = {
        id: editingTransaction.id,
        amount: parseFloat(newTransaction.amount),
        description: newTransaction.description,
        date: newTransaction.date,
        type: newTransaction.type,
        categoryId: newTransaction.categoryId ? parseInt(newTransaction.categoryId) : null,
        isRecurring: newTransaction.isRecurring,
        recurringFrequency: newTransaction.recurringFrequency,
        recurringEndDate: newTransaction.recurringEndDate || null,
        paymentUrl: newTransaction.paymentUrl || "",
        referenceNote: newTransaction.referenceNote || ""
      };

      editTransactionMutation.mutate(updateData);
      
      // Reset form
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
    } else {
      // Use React Query mutation for creating
      const createData = {
        amount: newTransaction.amount,
        description: newTransaction.description,
        date: newTransaction.date,
        type: newTransaction.type,
        categoryId: newTransaction.categoryId || "",
        isRecurring: newTransaction.isRecurring,
        recurringFrequency: newTransaction.recurringFrequency,
        recurringEndDate: newTransaction.recurringEndDate || "",
        paymentUrl: newTransaction.paymentUrl || "",
        referenceNote: newTransaction.referenceNote || ""
      };

      createTransactionMutation.mutate(createData);
      
      // Reset form
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
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);

    // Find the category ID from the transaction's category name
    const matchingCategory = (categories as Category[]).find(
      cat => cat.name === transaction.categoryName
    );

    // Format the date properly - ensure it's in YYYY-MM-DD format
    const formattedDate = typeof transaction.date === 'string' 
      ? transaction.date.split('T')[0]
      : new Date(transaction.date).toISOString().split('T')[0];

    // Format recurring end date if it exists
    const formattedRecurringEndDate = transaction.recurringEndDate 
      ? (typeof transaction.recurringEndDate === 'string' 
          ? transaction.recurringEndDate.split('T')[0]
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
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                All Transactions
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1 text-sm sm:text-base">
                Manage all your income and expense transactions
              </p>
            </div>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <UploadReceiptModal 
                onReceiptProcessed={(data) => {
                  // Refresh transactions after receipt processing
                  refetchTransactions();
                }}
                buttonText={t("Upload Image")}
              />
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
                    {t("Add Transaction")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTransaction ? t("Edit Transaction") : t("Add New Transaction")}
                    </DialogTitle>
                    <DialogDescription>
                      {editingTransaction ? t("Update the transaction details") : 
                       user?.primaryEmailAddress ? 
                       t("Record a new transaction", {entries: transactions?.length || 0}) :
                       t("Record a new income or expense transaction")}
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
                      placeholder={t("Transaction description")}
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
                    <Select 
                      value={newTransaction.categoryId || ""} 
                      onValueChange={(value) => setNewTransaction({ ...newTransaction, categoryId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("Select a category")}>
                          {newTransaction.categoryId && (categories as Category[]).find(cat => cat.id.toString() === newTransaction.categoryId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(categories as Category[])
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

                      {/* Smart Bill Assistant - Expense only */}
                      {newTransaction.type === "expense" && (
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
                      {editingTransaction ? t("Update") : t("Add")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Income</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {displayCurrency}{totalIncome.toFixed(2)}
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
                    {currency || '$'}{totalExpenses.toFixed(2)}
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
                    {currency || '$'}{(totalIncome - totalExpenses).toFixed(2)}
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

        {/* Search and Filters */}
        <div className="mb-6">
          <TransactionFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterType={filterType}
            onTypeChange={(value: string) => setFilterType(value as "all" | "income" | "expense")}
            filterCategory={filterCategory}
            onCategoryChange={setFilterCategory}
            filterRecurring={filterRecurring}
            onRecurringChange={setFilterRecurring}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            availableCategories={availableCategories}
            showTypeFilter={true}
            searchPlaceholder={t("Search transactions...")}
          />
        </div>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
            <CardDescription>
              {searchTerm || filterType !== "all" || filterCategory !== "all" || filterRecurring !== "all" || dateRange !== "all" 
                ? t("Filtered transactions") 
                : t("All your transactions")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 dark:text-gray-300 mt-2">{t("Loading transactions...")}</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t("No Transactions Found")}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {searchTerm || filterType !== "all" || filterCategory !== "all" || dateRange !== "all"
                    ? t("Try adjusting your filters or search terms")
                    : t("Add your first transaction to get started")}
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("Add Transaction")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((transaction: Transaction) => (
                  <div
                    key={transaction.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg shrink-0 ${transaction.type === "income" ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                        {transaction.type === "income" ? (
                          <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {transaction.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm text-gray-600 dark:text-gray-300 mt-1">
                          <span className="shrink-0">{format(new Date(transaction.date), "MMM dd, yyyy")}</span>
                          {transaction.categoryName && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <Badge variant="outline" className="text-xs">{transaction.categoryName}</Badge>
                            </>
                          )}
                          {transaction.isRecurring && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                🔄 {transaction.recurringFrequency}
                              </Badge>
                            </>
                          )}
                        </div>
                        {transaction.referenceNote && (
                          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">
                            Note: {transaction.referenceNote}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                      <p className={`font-semibold text-lg ${transaction.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {transaction.type === "income" ? "+" : "-"}{displayCurrency}{parseFloat(transaction.amount).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingTransaction(transaction);
                            
                            // Find the category ID - check both categoryId field and categoryName
                            let categoryId = "";
                            if (transaction.categoryId) {
                              categoryId = transaction.categoryId.toString();
                            } else if (transaction.categoryName) {
                              const matchingCategory = (categories as Category[]).find(
                                cat => cat.name === transaction.categoryName
                              );
                              categoryId = matchingCategory ? matchingCategory.id.toString() : "";
                            }
                            
                            setNewTransaction({
                              amount: transaction.amount.toString(),
                              description: transaction.description,
                              date: typeof transaction.date === 'string' 
                                ? transaction.date.split('T')[0]
                                : new Date(transaction.date).toISOString().split('T')[0],
                              type: transaction.type,
                              categoryId: categoryId,
                              isRecurring: Boolean(transaction.isRecurring),
                              recurringFrequency: transaction.recurringFrequency || "monthly",
                              recurringEndDate: transaction.recurringEndDate || "",
                              paymentUrl: transaction.paymentUrl || "",
                              referenceNote: transaction.referenceNote || ""
                            });
                            setIsDialogOpen(true);
                          }}
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
    </div>
  );
}