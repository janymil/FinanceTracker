import { useState, useEffect } from "react";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Calendar,
  Target,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Crown,
  Lock,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Link } from "wouter";
import RequirePlan from "@/components/require-plan";
import { useCurrency } from "@/context/CurrencyContext";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/dateUtils";
import { sumAmountsToCents, centsToNumber } from "@shared/money";

interface Budget {
  id: number;
  categoryId: number;
  amount: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  startDate: string;
  endDate: string;
  spent?: number;
  remaining?: number;
  percentage?: number;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
}

export default function Budget() {
  const { isReady, user } = useClerkUserReady();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const { t, i18n } = useTranslation();
  const displayCurrency = currency || '$';

  // Helper function to format dates with proper localization
  const formatDateLocalized = (date: Date, formatType: 'month-year' | 'month-day' | 'full-date' = 'month-year'): string => {
    const currentLang = i18n.language;
    
    if (formatType === 'month-year') {
      if (currentLang.startsWith('es')) {
        return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      } else if (currentLang.startsWith('sk')) {
        return date.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
    } else if (formatType === 'month-day') {
      if (currentLang.startsWith('es')) {
        return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
      } else if (currentLang.startsWith('sk')) {
        return date.toLocaleDateString('sk-SK', { month: 'short', day: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } else {
      if (currentLang.startsWith('es')) {
        return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' });
      } else if (currentLang.startsWith('sk')) {
        return date.toLocaleDateString('sk-SK', { month: 'short', day: 'numeric', year: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
  };
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [newBudget, setNewBudget] = useState({
    amount: "",
    categoryId: "",
    startDate: format(startOfMonth(currentDate), "yyyy-MM-dd"),
    endDate: format(endOfMonth(currentDate), "yyyy-MM-dd"),
  });

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

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

  // Fetch budgets
  const fetchBudgets = async () => {
    if (!isReady) return;
    
    setIsLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/budgets', {
        headers: authHeaders,
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setBudgets(data);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    if (!isReady) return;
    
    setCategoriesLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/categories', {
        headers: authHeaders,
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    if (isReady) {
      fetchBudgets();
      fetchCategories();
    }
  }, [isReady]);

  const createBudget = async (budgetData: typeof newBudget) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...budgetData,
          amount: parseFloat(budgetData.amount),
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create budget");
      }
      
      await fetchBudgets(); // Refresh budgets
      setIsDialogOpen(false);
      setNewBudget({
        amount: "",
        categoryId: "",
        startDate: format(startOfMonth(currentDate), "yyyy-MM-dd"),
        endDate: format(endOfMonth(currentDate), "yyyy-MM-dd"),
      });
      toast({
        title: t('budget.budget_created'),
        description: t('budget.budget_created_successfully'),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateBudget = async ({ id, ...data }: { id: number } & typeof newBudget) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/budgets/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount),
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update budget");
      }
      
      await fetchBudgets(); // Refresh budgets
      setEditingBudget(null);
      setIsDialogOpen(false);
      toast({
        title: t("budget.budget_updated"),
        description: t("budget.budget_updated_successfully"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteBudget = async (id: number) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/budgets/${id}`, {
        method: "DELETE",
        headers: authHeaders,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete budget");
      }
      
      await fetchBudgets(); // Refresh budgets
      toast({
        title: t("budget.budget_deleted"),
        description: t("budget.budget_deleted_successfully"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const expenseCategories = categories.filter((cat: Category) => cat.type === "expense");
  
  // Filter budgets to only show those active for the selected month
  const filteredBudgets = budgets.filter((budget: Budget) => {
    const budgetStart = new Date(budget.startDate);
    const budgetEnd = new Date(budget.endDate);
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // Budget is active if it overlaps with the selected month
    return budgetStart <= monthEnd && budgetEnd >= monthStart;
  });
  
  console.log("Categories:", categories);
  console.log("Expense categories:", expenseCategories);
  console.log("Filtered budgets for", format(currentDate, "MMMM yyyy"), ":", filteredBudgets);
  
  const totalBudget = centsToNumber(sumAmountsToCents(filteredBudgets.map((budget: Budget) => budget.amount)));
  const totalSpent = filteredBudgets.reduce((sum: number, budget: Budget) => sum + (budget.spent || 0), 0);
  const totalRemaining = totalBudget - totalSpent;

  const handleSubmit = () => {
    if (!newBudget.amount || !newBudget.categoryId) return;

    if (editingBudget) {
      updateBudget({ id: editingBudget.id, ...newBudget });
    } else {
      createBudget(newBudget);
    }
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setNewBudget({
      amount: budget.amount,
      categoryId: budget.categoryId.toString(),
      startDate: new Date(budget.startDate).toISOString().split('T')[0],
      endDate: new Date(budget.endDate).toISOString().split('T')[0],
    });
    setIsDialogOpen(true);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    setCurrentDate(newDate);
    setNewBudget({
      ...newBudget,
      startDate: format(startOfMonth(newDate), "yyyy-MM-dd"),
      endDate: format(endOfMonth(newDate), "yyyy-MM-dd"),
    });
  };

  const getBudgetStatus = (budget: Budget) => {
    const percentage = budget.percentage || 0;
    if (percentage >= 100) return { status: "over", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900" };
    if (percentage >= 80) return { status: "warning", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900" };
    return { status: "good", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900" };
  };

  if (!user) {
    return null;
  }

  return (
    <RequirePlan plan="standard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {formatDateLocalized(currentDate, 'month-year')}
                  </CardTitle>
                  <CardDescription>{t('budget.total_budget_for')} {formatDateLocalized(currentDate, 'month-year')}: {displayCurrency}{totalBudget.toFixed(2)}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => {
                      setEditingBudget(null);
                      setNewBudget({
                        amount: "",
                        categoryId: "",
                        startDate: format(startOfMonth(currentDate), "yyyy-MM-dd"),
                        endDate: format(endOfMonth(currentDate), "yyyy-MM-dd"),
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('budget.new_budget')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingBudget ? t('budget.edit_budget') : t('budget.create_new_budget')}
                    </DialogTitle>
                    <DialogDescription>
                      {editingBudget ? t('budget.update_budget_details') : t('budget.set_up_new_budget')}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="category">{t('budget.category')}</Label>
                      <Select value={newBudget.categoryId} onValueChange={(value) => setNewBudget({ ...newBudget, categoryId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('budget.select_category')} />
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

                    <div>
                      <Label htmlFor="amount">{t('budget.budget_amount')}</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newBudget.amount}
                        onChange={(e) => setNewBudget({ ...newBudget, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startDate">{t('budget.start_date')}</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={newBudget.startDate}
                          onChange={(e) => setNewBudget({ ...newBudget, startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">{t('budget.end_date')}</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={newBudget.endDate}
                          onChange={(e) => setNewBudget({ ...newBudget, endDate: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        {t('budget.cancel')}
                      </Button>
                      <Button 
                        onClick={handleSubmit}
                        disabled={!newBudget.amount || !newBudget.categoryId}
                      >
                        {editingBudget ? t('budget.update') : t('budget.create')} {t('budget.budget')}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('budget.total_budget')}</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {displayCurrency}{totalBudget.toFixed(2)}
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
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('budget.total_spent')}</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {displayCurrency}{totalSpent.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${totalRemaining >= 0 ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                <TrendingUp className={`h-6 w-6 ${totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {totalRemaining >= 0 ? t('budget.remaining') : t('budget.over_budget')}
                </p>
                <p className={`text-2xl font-bold ${totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {displayCurrency}{Math.abs(totalRemaining).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('budget.budget_categories')}</CardTitle>
          <CardDescription>
            {t('budget.for_the_period')}: {formatDateLocalized(startOfMonth(currentDate), 'month-day')} - {formatDateLocalized(endOfMonth(currentDate), 'full-date')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-300 mt-2">{t('budget.loading_budgets')}</p>
            </div>
          ) : filteredBudgets.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('budget.no_budgets_created')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t('budget.create_first_budget')}
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('budget.create_budget')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBudgets.map((budget: Budget) => {
                const { status, color, bgColor } = getBudgetStatus(budget);
                return (
                  <Card key={budget.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 ${bgColor} rounded-lg`}>
                            <Target className={`h-4 w-4 ${color}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold">{budget.categoryName}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {formatDateLocalized(new Date(budget.startDate), 'month-day')} - {formatDateLocalized(new Date(budget.endDate), 'full-date')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(budget)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteBudget(budget.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{t('budget.spent')}: {displayCurrency}{(budget.spent || 0).toFixed(2)}</span>
                          <span>{t('budget.budget')}: {displayCurrency}{parseFloat(budget.amount.toString()).toFixed(2)}</span>
                        </div>
                        <Progress value={budget.percentage || 0} className="h-2" />
                        <div className="flex justify-between items-center">
                          <p className={`text-sm ${color}`}>
                            {budget.remaining !== undefined && budget.remaining >= 0 
                              ? `${displayCurrency}${budget.remaining.toFixed(2)} ${t('budget.remaining')}`
                              : `${displayCurrency}${Math.abs(budget.remaining || 0).toFixed(2)} ${t('budget.over_budget')}`
                            }
                          </p>
                          <Badge 
                            variant="outline" 
                            className={`${color} border-current`}
                          >
                            {(budget.percentage || 0).toFixed(0)}% {t('budget.used')}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          </CardContent>
          </Card>
        </div>
    </RequirePlan>
  );
}