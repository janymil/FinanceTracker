import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Link } from "wouter";

interface Budget {
  id: number;
  amount: number;
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [newBudget, setNewBudget] = useState({
    amount: "",
    categoryId: "",
    startDate: format(startOfMonth(currentDate), "yyyy-MM-dd"),
    endDate: format(endOfMonth(currentDate), "yyyy-MM-dd"),
  });

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["/api/budgets"],
    enabled: !!user?.isPremium,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    enabled: !!user?.isPremium,
  });

  const createBudgetMutation = useMutation({
    mutationFn: async (budgetData: typeof newBudget) => {
      const res = await apiRequest("POST", "/api/budgets", {
        ...budgetData,
        amount: parseFloat(budgetData.amount),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setIsDialogOpen(false);
      setNewBudget({
        amount: "",
        categoryId: "",
        startDate: format(startOfMonth(currentDate), "yyyy-MM-dd"),
        endDate: format(endOfMonth(currentDate), "yyyy-MM-dd"),
      });
      toast({
        title: "Budget Created",
        description: "Budget has been created successfully",
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

  const updateBudgetMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & typeof newBudget) => {
      const res = await apiRequest("PUT", `/api/budgets/${id}`, {
        ...data,
        amount: parseFloat(data.amount),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setEditingBudget(null);
      setIsDialogOpen(false);
      toast({
        title: "Budget Updated",
        description: "Budget has been updated successfully",
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

  const deleteBudgetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/budgets/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Budget Deleted",
        description: "Budget has been removed successfully",
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

  const expenseCategories = categories.filter((cat: Category) => cat.type === "expense");
  const totalBudget = budgets.reduce((sum: number, budget: Budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum: number, budget: Budget) => sum + (budget.spent || 0), 0);
  const totalRemaining = totalBudget - totalSpent;

  const handleSubmit = () => {
    if (!newBudget.amount || !newBudget.categoryId) return;

    if (editingBudget) {
      updateBudgetMutation.mutate({ id: editingBudget.id, ...newBudget });
    } else {
      createBudgetMutation.mutate(newBudget);
    }
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setNewBudget({
      amount: budget.amount.toString(),
      categoryId: "",
      startDate: budget.startDate,
      endDate: budget.endDate,
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

  // Free tier upgrade prompt
  if (!user.isPremium) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-full flex items-center justify-center mb-6">
            <Lock className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Budget Management
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Take control of your spending with advanced budget tracking and management tools
          </p>

          <Card className="max-w-4xl mx-auto mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Premium Feature
              </CardTitle>
              <CardDescription>
                Budget management is available for premium subscribers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="text-center p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <Target className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Category Budgets</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Set spending limits for different expense categories
                  </p>
                </div>
                
                <div className="text-center p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <TrendingDown className="h-8 w-8 text-green-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Spending Tracking</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Monitor your progress against budget goals
                  </p>
                </div>
                
                <div className="text-center p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <AlertTriangle className="h-8 w-8 text-orange-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Budget Alerts</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Get notified when approaching budget limits
                  </p>
                </div>
              </div>

              <div className="text-center">
                <Link href="/subscribe">
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Premium
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Preview mockup */}
          <Card className="max-w-4xl mx-auto opacity-50 pointer-events-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {format(currentDate, "MMMM yyyy")}
                  </CardTitle>
                  <CardDescription>Budget overview for this month</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button disabled>
                    <Plus className="h-4 w-4 mr-2" />
                    New Budget
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Budget</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">$2,500</p>
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
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Spent</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">$1,850</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Remaining</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">$650</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sample budget cards */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                          <DollarSign className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Food & Dining</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {format(startOfMonth(currentDate), "MMM dd")} - {format(endOfMonth(currentDate), "MMM dd, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                        74% used
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Spent: $370</span>
                        <span>Budget: $500</span>
                      </div>
                      <Progress value={74} className="h-2" />
                      <p className="text-sm text-green-600 dark:text-green-400">$130 remaining</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Entertainment</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {format(startOfMonth(currentDate), "MMM dd")} - {format(endOfMonth(currentDate), "MMM dd, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-red-100 text-red-800 border-red-200">
                        105% used
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Spent: $315</span>
                        <span>Budget: $300</span>
                      </div>
                      <Progress value={100} className="h-2" />
                      <p className="text-sm text-red-600 dark:text-red-400">$15 over budget</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {format(currentDate, "MMMM yyyy")}
              </CardTitle>
              <CardDescription>Total budget for {format(currentDate, "MMMM yyyy")}: ${totalBudget.toFixed(2)}</CardDescription>
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
                    New Budget
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingBudget ? "Edit Budget" : "Create New Budget"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingBudget ? "Update the budget details" : "Set up a new budget for a category"}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select value={newBudget.categoryId} onValueChange={(value) => setNewBudget({ ...newBudget, categoryId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
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
                      <Label htmlFor="amount">Budget Amount</Label>
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
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={newBudget.startDate}
                          onChange={(e) => setNewBudget({ ...newBudget, startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">End Date</Label>
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
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSubmit}
                        disabled={!newBudget.amount || !newBudget.categoryId || createBudgetMutation.isPending || updateBudgetMutation.isPending}
                      >
                        {editingBudget ? "Update" : "Create"} Budget
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
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Budget</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ${totalBudget.toFixed(2)}
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
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Spent</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ${totalSpent.toFixed(2)}
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
                  {totalRemaining >= 0 ? 'Remaining' : 'Over Budget'}
                </p>
                <p className={`text-2xl font-bold ${totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ${Math.abs(totalRemaining).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget List */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Categories</CardTitle>
          <CardDescription>
            For the period: {format(startOfMonth(currentDate), "MMMM dd")} - {format(endOfMonth(currentDate), "MMMM dd, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Loading budgets...</p>
            </div>
          ) : budgets.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Budgets Created
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Create your first budget to start tracking your spending goals
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Budget
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {budgets.map((budget: Budget) => {
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
                              {format(new Date(budget.startDate), "MMM dd")} - {format(new Date(budget.endDate), "MMM dd, yyyy")}
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
                            onClick={() => deleteBudgetMutation.mutate(budget.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Spent: ${(budget.spent || 0).toFixed(2)}</span>
                          <span>Budget: ${budget.amount.toFixed(2)}</span>
                        </div>
                        <Progress value={budget.percentage || 0} className="h-2" />
                        <div className="flex justify-between items-center">
                          <p className={`text-sm ${color}`}>
                            {budget.remaining !== undefined && budget.remaining >= 0 
                              ? `$${budget.remaining.toFixed(2)} remaining`
                              : `$${Math.abs(budget.remaining || 0).toFixed(2)} over budget`
                            }
                          </p>
                          <Badge 
                            variant="outline" 
                            className={`${color} border-current`}
                          >
                            {(budget.percentage || 0).toFixed(0)}% used
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
  );
}