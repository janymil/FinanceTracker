import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  incomeTransactionCount?: number;
  expenseTransactionCount?: number;
  totalTransactionCount?: number;
}

interface FinancialCardsProps {
  summary?: FinancialSummary;
  isLoading: boolean;
  budgetsData?: any[];
}

export default function FinancialCards({ summary, isLoading, budgetsData }: FinancialCardsProps) {
  const [animatedValues, setAnimatedValues] = useState({
    income: 0,
    expenses: 0,
    balance: 0
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Animate values when summary changes
  useEffect(() => {
    if (summary) {
      const duration = 1000; // 1 second animation
      const steps = 30;
      const stepDuration = duration / steps;

      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease-out

        setAnimatedValues({
          income: Math.round(summary.totalIncome * easeOut),
          expenses: Math.round(summary.totalExpenses * easeOut),
          balance: Math.round(summary.netBalance * easeOut)
        });

        if (currentStep >= steps) {
          clearInterval(interval);
          setAnimatedValues({
            income: summary.totalIncome,
            expenses: summary.totalExpenses,
            balance: summary.netBalance
          });
        }
      }, stepDuration);

      return () => clearInterval(interval);
    }
  }, [summary]);

  const getBudgetStatus = () => {
    if (!summary || !budgetsData) return { status: 'Loading...', percentage: 0, remaining: 0, bgColor: 'bg-gray-50', textColor: 'text-gray-600' };

    // If no budgets set, show "No Budget Set" status
    if (!budgetsData || budgetsData.length === 0) {
      return {
        status: 'No Budget Set',
        percentage: 0,
        remaining: 0,
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        textColor: 'text-gray-600 dark:text-gray-400'
      };
    }

    // Calculate total budget and total spending using real backend data
    let totalBudget = 0;
    let totalSpent = 0;

    budgetsData.forEach((budget: any) => {
      const budgetAmount = parseFloat(budget.amount || "0");
      const spent = parseFloat(budget.spent || "0");
      totalBudget += budgetAmount;
      totalSpent += spent;
    });

    const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const remaining = totalBudget - totalSpent;

    if (percentage <= 50) return { 
      status: 'Healthy', 
      percentage, 
      remaining, 
      bgColor: 'bg-green-50 dark:bg-green-900/20', 
      textColor: 'text-green-700 dark:text-green-300' 
    };
    if (percentage <= 90) return { 
      status: 'Moderate', 
      percentage, 
      remaining, 
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', 
      textColor: 'text-yellow-700 dark:text-yellow-300' 
    };
    return { 
      status: 'Critical', 
      percentage, 
      remaining, 
      bgColor: 'bg-red-50 dark:bg-red-900/20', 
      textColor: 'text-red-700 dark:text-red-300' 
    };
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
      <Card className="bg-green-50 dark:bg-green-900/20 shadow-sm border border-green-200 dark:border-green-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                Total Income
              </p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200 transition-all duration-300 ease-out">
                {formatCurrency(animatedValues.income)}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {summary?.incomeTransactionCount || 0} transaction{(summary?.incomeTransactionCount || 0) !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-green-100 dark:bg-green-800/40 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-700 dark:text-green-300" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Expenses Card */}
      <Card className="bg-red-50 dark:bg-red-900/20 shadow-sm border border-red-200 dark:border-red-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                Total Expenses
              </p>
              <p className="text-2xl font-bold text-red-800 dark:text-red-200 transition-all duration-300 ease-out">
                {formatCurrency(Math.abs(animatedValues.expenses))}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {summary?.expenseTransactionCount || 0} transaction{(summary?.expenseTransactionCount || 0) !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-red-100 dark:bg-red-800/40 p-3 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-700 dark:text-red-300" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Net Balance Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 shadow-sm border border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                Net Balance
              </p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200 transition-all duration-300 ease-out">
                {formatCurrency(animatedValues.balance)}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {summary?.totalTransactionCount || 0} total transaction{(summary?.totalTransactionCount || 0) !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-800/40 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-700 dark:text-blue-300" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Status Card */}
      <Card className={`${budgetInfo.bgColor} shadow-sm border ${
        budgetInfo.status === 'Healthy' ? 'border-green-200 dark:border-green-800' :
        budgetInfo.status === 'Moderate' ? 'border-yellow-200 dark:border-yellow-800' :
        'border-red-200 dark:border-red-800'
      }`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium mb-1 ${budgetInfo.textColor}`}>
                Budget Status
              </p>
              <p className={`text-2xl font-bold ${budgetInfo.textColor}`}>
                {budgetInfo.status}
              </p>
              <p className={`text-xs mt-1 ${budgetInfo.textColor} opacity-80`}>
                {Math.round(budgetInfo.percentage)}% utilized. Remaining: {formatCurrency(budgetInfo.remaining)}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${
              budgetInfo.status === 'Healthy' ? 'bg-green-100 dark:bg-green-800/40' :
              budgetInfo.status === 'Moderate' ? 'bg-yellow-100 dark:bg-yellow-800/40' :
              'bg-red-100 dark:bg-red-800/40'
            }`}>
              <Shield className={`h-6 w-6 ${budgetInfo.textColor}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}