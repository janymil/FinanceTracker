import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
}

interface FinancialCardsProps {
  summary?: FinancialSummary;
  isLoading: boolean;
}

export default function FinancialCards({ summary, isLoading }: FinancialCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getBudgetStatus = () => {
    if (!summary) return { status: 'Loading...', percentage: 0, remaining: 0 };
    
    const budgetLimit = 900; // Mock budget limit
    const percentage = (summary.totalExpenses / budgetLimit) * 100;
    const remaining = budgetLimit - summary.totalExpenses;
    
    if (percentage <= 50) return { status: 'Healthy', percentage, remaining };
    if (percentage <= 75) return { status: 'Good', percentage, remaining };
    if (percentage <= 90) return { status: 'Warning', percentage, remaining };
    return { status: 'Over Budget', percentage, remaining };
  };

  const budgetInfo = getBudgetStatus();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Income Card */}
      <Card className="bg-white dark:bg-gray-800 shadow-sm border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Total Income
              </p>
              <p className="text-2xl font-bold text-success">
                {formatCurrency(summary?.totalIncome || 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Total income for the period
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Expenses Card */}
      <Card className="bg-white dark:bg-gray-800 shadow-sm border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Total Expenses
              </p>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(summary?.totalExpenses || 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Total spent in the period
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Net Balance Card */}
      <Card className="bg-white dark:bg-gray-800 shadow-sm border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Net Balance
              </p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(summary?.netBalance || 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {(summary?.netBalance || 0) >= 0 ? 'Positive result' : 'Negative result'}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Status Card */}
      <Card className="bg-white dark:bg-gray-800 shadow-sm border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Budget Status
              </p>
              <p className={`text-2xl font-bold ${
                budgetInfo.status === 'Healthy' ? 'text-success' :
                budgetInfo.status === 'Good' ? 'text-success' :
                budgetInfo.status === 'Warning' ? 'text-orange-500' :
                'text-destructive'
              }`}>
                {budgetInfo.status}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {Math.round(budgetInfo.percentage)}% utilized. Remaining: {formatCurrency(budgetInfo.remaining)}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <Shield className="h-6 w-6 text-success" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
