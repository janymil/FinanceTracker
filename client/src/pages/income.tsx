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
  DollarSign,
  TrendingUp,
  BarChart3,
  Repeat,
  ChevronLeft,
  ChevronRight
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
  userId: string | null;
}

export default function Income() {
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

  // React Query hooks for data fetching using the same pattern as transactions page
  const { data: allTransactions = [], isLoading: transactionsLoading, refetch: refetchTransactions } = useTransactions();
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

  const [newIncome, setNewIncome] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    type: "income" as "income" | "expense",
    categoryId: "",
    isRecurring: false,
    recurringFrequency: "monthly" as "weekly" | "monthly" | "yearly",
    recurringEndDate: "",
    paymentUrl: "",
    referenceNote: "",
  });

  // React Query mutation for creating income transactions
  const createIncomeMutation = useMutation({
    mutationFn: async (incomeData: typeof newIncome) => {
      const res = await apiRequest("POST", "/api/transactions", {
        ...incomeData,
        amount: parseFloat(incomeData.amount),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      setIsDialogOpen(false);
      setNewIncome({
        amount: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
        type: "income" as "income" | "expense",
        categoryId: "",
        isRecurring: false,
        recurringFrequency: "monthly" as "weekly" | "monthly" | "yearly",
        recurringEndDate: "",
        paymentUrl: "",
        referenceNote: "",
      });
      toast({
        title: t("income.added_title"),
        description: t("income.added_description"),
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

  // React Query mutation for editing income transactions
  const editIncomeMutation = useMutation({
    mutationFn: async (incomeData: any) => {
      const res = await apiRequest("PUT", `/api/transactions/${incomeData.id}`, incomeData);
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
      toast({
        title: t("income.updated_title"),
        description: t("income.updated_description"),
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

  // React Query mutation for deleting income transactions
  const deleteIncomeMutation = useMutation({
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
        title: t("income.deleted_title"),
        description: t("income.deleted_description"),
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

  // Filter transactions for income only
  const incomeTransactions = allTransactions.filter((transaction: Transaction) => transaction.type === "income");
  
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
      const currentMonth = today.getMonth();
      
      switch (dateRange) {
        case "this-month":
          matchesDate = transactionDate.getFullYear() === currentYear && 
                       transactionDate.getMonth() === currentMonth;
          break;
        case "last-month":
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          matchesDate = transactionDate.getFullYear() === lastMonthYear && 
                       transactionDate.getMonth() === lastMonth;
          break;
        case "this-year":
          matchesDate = transactionDate.getFullYear() === currentYear;
          break;
        case "last-30-days":
          const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = transactionDate >= thirtyDaysAgo;
          break;
      }
    }
    
    return matchesSearch && matchesCategory && matchesRecurring && matchesDate;
  });

  const incomeCategories = categories.filter((cat: Category) => cat.type === "income");
  const availableCategories = Array.from(new Set(incomeTransactions.map((t: Transaction) => t.categoryName).filter(Boolean))) as string[];

  const totalIncome = filteredIncomes.reduce((sum: number, t: Transaction) => sum + parseFloat(t.amount), 0);

  // Calculate monthly income data for chart
  const monthlyIncomeData = incomeTransactions.reduce((acc: any, transaction: Transaction) => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = 0;
    }
    acc[monthKey] += parseFloat(transaction.amount);
    
    return acc;
  }, {});

  const chartData = Object.entries(monthlyIncomeData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({
      month: format(new Date(month + '-01'), 'MMM yyyy'),
      amount: amount as number
    }));

  // Calculate category distribution
  const categoryData = incomeTransactions.reduce((acc: any, transaction: Transaction) => {
    const category = transaction.categoryName || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += parseFloat(transaction.amount);
    return acc;
  }, {});

  const pieData = Object.entries(categoryData).map(([name, value]) => ({
    name,
    value: value as number
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const handleEdit = (transaction: Transaction) => {
    const category = categories.find((cat: Category) => cat.name === transaction.categoryName);
    
    setEditingTransaction({
      ...transaction,
      categoryId: category?.id || transaction.categoryId,
      date: transaction.date.split('T')[0] // Ensure date is in YYYY-MM-DD format
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncome.amount || !newIncome.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    createIncomeMutation.mutate(newIncome);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    
    const updateData = {
      id: editingTransaction.id,
      amount: parseFloat(editingTransaction.amount),
      description: editingTransaction.description,
      date: editingTransaction.date,
      type: "income" as const,
      categoryId: editingTransaction.categoryId ? parseInt(editingTransaction.categoryId.toString()) : null,
      isRecurring: editingTransaction.isRecurring,
      recurringFrequency: editingTransaction.recurringFrequency,
      recurringEndDate: editingTransaction.recurringEndDate || null,
      paymentUrl: editingTransaction.paymentUrl || "",
      referenceNote: editingTransaction.referenceNote || "",
    };

    editIncomeMutation.mutate(updateData);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this income?")) {
      deleteIncomeMutation.mutate(id);
    }
  };

  const handleReceiptProcessed = (data: any) => {
    setNewIncome({
      amount: data.amount || "",
      description: data.description || "",
      date: data.date || new Date().toISOString().split('T')[0],
      type: "income" as "income" | "expense",
      categoryId: data.categoryId || "",
      isRecurring: false,
      recurringFrequency: "monthly" as "weekly" | "monthly" | "yearly",
      recurringEndDate: "",
      paymentUrl: "",
      referenceNote: "",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">{t("income.loading")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{t("income.title")}</h1>
            <p className="text-muted-foreground">{t("income.subtitle")}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <UploadReceiptModal onReceiptProcessed={handleReceiptProcessed} />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("income.add_income")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("income.add_new_income")}</DialogTitle>
                  <DialogDescription>
                    {t("income.add_description")}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="amount">{t("common.amount")} *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newIncome.amount}
                      onChange={(e) => setNewIncome({...newIncome, amount: e.target.value})}
                      required
                    />
                  </div>
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="description">{t("common.description")} *</Label>
                    <Input
                      id="description"
                      placeholder={t("income.description_placeholder")}
                      value={newIncome.description}
                      onChange={(e) => setNewIncome({...newIncome, description: e.target.value})}
                      required
                    />
                  </div>
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="date">{t("common.date")}</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newIncome.date}
                      onChange={(e) => setNewIncome({...newIncome, date: e.target.value})}
                    />
                  </div>
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="category">{t("common.category")}</Label>
                    <Select 
                      value={newIncome.categoryId} 
                      onValueChange={(value) => setNewIncome({...newIncome, categoryId: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("common.select_category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {incomeCategories.map((category: Category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {getLocalizedCategoryName(category, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="recurring"
                      checked={newIncome.isRecurring}
                      onCheckedChange={(checked) => setNewIncome({...newIncome, isRecurring: checked as boolean})}
                    />
                    <Label htmlFor="recurring">{t("common.recurring")} {t("types.income")}</Label>
                  </div>
                  {newIncome.isRecurring && (
                    <>
                      <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="frequency">{t("common.frequency")}</Label>
                        <Select 
                          value={newIncome.recurringFrequency} 
                          onValueChange={(value) => setNewIncome({...newIncome, recurringFrequency: value as any})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">{t("frequencies.weekly")}</SelectItem>
                            <SelectItem value="monthly">{t("frequencies.monthly")}</SelectItem>
                            <SelectItem value="yearly">{t("frequencies.yearly")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="endDate">{t("common.end_date")} ({t("common.optional")})</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={newIncome.recurringEndDate}
                          onChange={(e) => setNewIncome({...newIncome, recurringEndDate: e.target.value})}
                        />
                      </div>
                    </>
                  )}
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="referenceNote">{t("common.reference_note")}</Label>
                    <Input
                      id="referenceNote"
                      placeholder={t("common.reference_note_placeholder")}
                      value={newIncome.referenceNote}
                      onChange={(e) => setNewIncome({...newIncome, referenceNote: e.target.value})}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createIncomeMutation.isPending}>
                    {createIncomeMutation.isPending ? t("income.adding") : t("income.add_income")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("income.total_income")}</p>
                <p className="text-2xl font-bold">{displayCurrency}{totalIncome.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Income Sources</p>
                <p className="text-2xl font-bold">{availableCategories.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold">{filteredIncomes.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Income Trend</CardTitle>
            <CardDescription>Monthly income over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`${displayCurrency}${value}`, 'Income']} />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income by Category</CardTitle>
            <CardDescription>Distribution of income sources</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
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
        searchPlaceholder="Search income..."
      />

      {/* Income List */}
      <Card>
        <CardHeader>
          <CardTitle>Income Transactions</CardTitle>
          <CardDescription>
            {filteredIncomes.length} of {incomeTransactions.length} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredIncomes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No income transactions found</p>
              </div>
            ) : (
              filteredIncomes.map((transaction: Transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <ArrowUpRight className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>{format(new Date(transaction.date), 'MMM dd, yyyy')}</span>
                        {transaction.categoryName && (
                          <>
                            <span>•</span>
                            <span>{transaction.categoryName}</span>
                          </>
                        )}
                        {transaction.isRecurring && (
                          <>
                            <span>•</span>
                            <div className="flex items-center">
                              <Repeat className="h-3 w-3 mr-1" />
                              <span>{transaction.recurringFrequency}</span>
                            </div>
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
                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-green-600">
                      +{displayCurrency}{parseFloat(transaction.amount).toFixed(2)}
                    </span>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(transaction)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(transaction.id)}
                        disabled={deleteIncomeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingTransaction && (
        <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransaction(null)}>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Income</DialogTitle>
              <DialogDescription>
                Update the income transaction details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="editAmount">Amount *</Label>
                <Input
                  id="editAmount"
                  type="number"
                  step="0.01"
                  value={editingTransaction.amount}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    amount: e.target.value
                  })}
                  required
                />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="editDescription">Description *</Label>
                <Input
                  id="editDescription"
                  value={editingTransaction.description}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    description: e.target.value
                  })}
                  required
                />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="editDate">Date</Label>
                <Input
                  id="editDate"
                  type="date"
                  value={editingTransaction.date}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    date: e.target.value
                  })}
                />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="editCategory">Category</Label>
                <Select 
                  value={editingTransaction.categoryId?.toString() || ""} 
                  onValueChange={(value) => setEditingTransaction({
                    ...editingTransaction,
                    categoryId: parseInt(value)
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
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
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="editRecurring"
                  checked={editingTransaction.isRecurring}
                  onCheckedChange={(checked) => setEditingTransaction({
                    ...editingTransaction,
                    isRecurring: checked as boolean
                  })}
                />
                <Label htmlFor="editRecurring">Recurring income</Label>
              </div>
              {editingTransaction.isRecurring && (
                <>
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="editFrequency">Frequency</Label>
                    <Select 
                      value={editingTransaction.recurringFrequency} 
                      onValueChange={(value) => setEditingTransaction({
                        ...editingTransaction,
                        recurringFrequency: value as any
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="editEndDate">End Date (optional)</Label>
                    <Input
                      id="editEndDate"
                      type="date"
                      value={editingTransaction.recurringEndDate || ""}
                      onChange={(e) => setEditingTransaction({
                        ...editingTransaction,
                        recurringEndDate: e.target.value
                      })}
                    />
                  </div>
                </>
              )}
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="editReferenceNote">Reference Note</Label>
                <Input
                  id="editReferenceNote"
                  value={editingTransaction.referenceNote || ""}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    referenceNote: e.target.value
                  })}
                />
              </div>
              <div className="flex space-x-2">
                <Button type="submit" className="flex-1" disabled={editIncomeMutation.isPending}>
                  {editIncomeMutation.isPending ? "Updating..." : "Update Income"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingTransaction(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}