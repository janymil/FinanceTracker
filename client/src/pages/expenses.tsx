import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus, Search, Filter, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useTransactions } from "@/hooks/useTransactions";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import RequirePlan from "@/components/require-plan";
import { Switch } from "@/components/ui/switch";

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
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  
  const [newExpense, setNewExpense] = useState({
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

  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();

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
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary", user?.id] });
      queryClient.refetchQueries({ queryKey: ["transactions", user?.id] });
      queryClient.refetchQueries({ queryKey: ["financial-summary", user?.id] });
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
    mutationFn: async ({ id, ...updateData }: { id: number } & Partial<Transaction>) => {
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
  
  // Apply additional filters
  const filteredExpenses = expenseTransactions.filter((transaction: Transaction) => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (transaction.categoryName && transaction.categoryName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !selectedCategory || transaction.categoryName === selectedCategory;
    
    const matchesDate = !dateFilter || transaction.date.startsWith(dateFilter);
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  const expenseCategories = categories.filter((cat: Category) => cat.type === "expense");
  const availableCategories = Array.from(new Set(expenseTransactions.map((t: Transaction) => t.categoryName).filter(Boolean)));

  const totalExpenses = filteredExpenses.reduce((sum: number, t: Transaction) => sum + parseFloat(t.amount), 0);

  const monthlyExpenseData = expenseTransactions.reduce((acc: any, transaction: Transaction) => {
    const month = transaction.date.substring(0, 7);
    acc[month] = (acc[month] || 0) + parseFloat(transaction.amount);
    return acc;
  }, {});

  const categoryData = expenseTransactions.reduce((acc: any, transaction: Transaction) => {
    const category = transaction.categoryName || "Uncategorized";
    acc[category] = (acc[category] || 0) + parseFloat(transaction.amount);
    return acc;
  }, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTransaction) {
      await updateExpenseMutation.mutateAsync({
        id: editingTransaction.id,
        amount: newExpense.amount,
        description: newExpense.description,
        date: newExpense.date,
        categoryId: parseInt(newExpense.categoryId),
      });
    } else {
      await createExpenseMutation.mutateAsync(newExpense);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    const category = categories.find((cat: Category) => cat.name === transaction.categoryName);
    setEditingTransaction(transaction);
    setNewExpense({
      amount: transaction.amount,
      description: transaction.description,
      date: transaction.date,
      categoryId: category?.id.toString() || "",
      isRecurring: false,
      recurringFrequency: "monthly",
      recurringEndDate: "",
      paymentUrl: transaction.paymentUrl || "",
      referenceNote: transaction.referenceNote || "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track and manage your expense transactions</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTransaction ? "Edit Expense" : "Add New Expense"}</DialogTitle>
              <DialogDescription>
                {editingTransaction ? "Update your expense transaction" : "Record a new expense transaction"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Expense description"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={newExpense.categoryId}
                  onValueChange={(value) => setNewExpense({ ...newExpense, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category: Category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        <div className="flex items-center">
                          <span className="mr-2">{category.icon}</span>
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <RequirePlan plan="standard" feature="Advanced Expense Features">
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="recurring"
                      checked={newExpense.isRecurring}
                      onCheckedChange={(checked) => setNewExpense({ ...newExpense, isRecurring: checked })}
                    />
                    <Label htmlFor="recurring">Recurring Expense</Label>
                  </div>

                  {newExpense.isRecurring && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="frequency">Frequency</Label>
                        <Select
                          value={newExpense.recurringFrequency}
                          onValueChange={(value) => setNewExpense({ ...newExpense, recurringFrequency: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
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
                          onChange={(e) => setNewExpense({ ...newExpense, recurringEndDate: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="paymentUrl">Payment URL (Optional)</Label>
                    <Input
                      id="paymentUrl"
                      type="url"
                      placeholder="https://example.com/receipt"
                      value={newExpense.paymentUrl}
                      onChange={(e) => setNewExpense({ ...newExpense, paymentUrl: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="referenceNote">Reference Note (Optional)</Label>
                    <Input
                      id="referenceNote"
                      placeholder="Additional notes or reference"
                      value={newExpense.referenceNote}
                      onChange={(e) => setNewExpense({ ...newExpense, referenceNote: e.target.value })}
                    />
                  </div>
                </div>
              </RequirePlan>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending} className="flex-1">
                  {createExpenseMutation.isPending || updateExpenseMutation.isPending ? "Saving..." : editingTransaction ? "Update Expense" : "Add Expense"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {filteredExpenses.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${(monthlyExpenseData[new Date().toISOString().substring(0, 7)] || 0).toFixed(2)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Current month expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Top Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {Object.keys(categoryData).length > 0 
                ? Object.entries(categoryData).sort(([,a], [,b]) => (b as number) - (a as number))[0][0]
                : "No expenses"}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              ${Object.keys(categoryData).length > 0 
                ? (Object.entries(categoryData).sort(([,a], [,b]) => (b as number) - (a as number))[0][1] as number).toFixed(2)
                : "0.00"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {availableCategories.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="month"
                placeholder="Filter by month"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("");
                setDateFilter("");
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recent Expenses</span>
            <Badge variant="secondary">{filteredExpenses.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl text-gray-300 dark:text-gray-600 mb-4">💸</div>
              <p className="text-gray-500 dark:text-gray-400 mb-4">No expenses found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {searchTerm || selectedCategory || dateFilter 
                  ? "Try adjusting your filters or add your first expense."
                  : "Start tracking your expenses by adding your first transaction."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredExpenses.map((transaction: Transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                        <span className="text-lg">{transaction.categoryIcon || "💸"}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {transaction.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        {transaction.categoryName && (
                          <Badge variant="outline" className="text-xs">
                            {transaction.categoryName}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(transaction.date), "MMM dd, yyyy")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-lg font-semibold text-red-600">
                        -${parseFloat(transaction.amount).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(transaction)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteExpenseMutation.mutate(transaction.id)}
                        disabled={deleteExpenseMutation.isPending}
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
  );
}