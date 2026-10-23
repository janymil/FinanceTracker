import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit3 } from "lucide-react";
import { useMemo } from "react";
import { sumTransactionAmounts } from "@shared/calculations";
import { useLocation } from "wouter";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

// Types
interface Budget {
  id: number;
  amount: string;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  startDate: string;
  endDate: string;
}

interface Transaction {
  id: number;
  amount: string;
  categoryId: number;
  type: 'expense' | 'income';
  date: string;
}

interface BudgetWithSpending extends Budget {
  spent: number;
}

interface BudgetOverviewProps {
  className?: string;
  isLimited?: boolean;
}

// Constants
const BUDGET_THRESHOLDS = {
  WARNING: 75,
  DANGER: 90,
} as const;

const PROGRESS_COLORS = {
  SAFE: '#10B981',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
} as const;

// Utility functions
const getCategoryIcon = (icon: string): string => {
  const iconMap: Record<string, string> = {
    'utensils': '🍽️',
    'film': '🎬',
    'home': '🏠',
    'car': '🚗',
    'heart': '❤️',
    'shopping-bag': '🛍️',
  };
  return iconMap[icon] || '💰';
};

const formatCurrency = (amount: string | number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
};

const formatDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate).toLocaleDateString('en-US');
  const end = new Date(endDate).toLocaleDateString('en-US');
  return `${start} - ${end}`;
};

const getProgressColor = (percentage: number): string => {
  if (percentage > BUDGET_THRESHOLDS.DANGER) return PROGRESS_COLORS.DANGER;
  if (percentage > BUDGET_THRESHOLDS.WARNING) return PROGRESS_COLORS.WARNING;
  return PROGRESS_COLORS.SAFE;
};

export default function BudgetOverview({ className, isLimited = false }: BudgetOverviewProps) {
  const [, setLocation] = useLocation();
  const { isReady, user } = useClerkUserReady();
  const { t } = useTranslation();

  // Fetch budgets using React Query
  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ['budgets', user?.id],
    enabled: isReady && !isLimited && !!user?.id,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/budgets");
      return response.json();
    },
  });

  // Fetch transactions using React Query  
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions', user?.id],
    enabled: isReady && !isLimited && !!user?.id,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/transactions");
      return response.json();
    },
  });

  const budgetsWithSpending = useMemo((): BudgetWithSpending[] => {
    if (!budgets || !transactions) return [];

    return budgets
      .map((budget) => {
        // Calculate total spending for this category in the current budget period
        const categorySpending = sumTransactionAmounts(transactions
          .filter((transaction) =>
            transaction.categoryId === budget.categoryId &&
            transaction.type === 'expense' &&
            new Date(transaction.date) >= new Date(budget.startDate) &&
            new Date(transaction.date) <= new Date(budget.endDate)
          ));

        return {
          ...budget,
          spent: categorySpending
        };
      })
      .sort((a, b) => b.spent - a.spent); // Sort by spending amount descending
  }, [budgets, transactions]);

  if (isLimited) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <CardTitle className="text-lg font-semibold">{t('Budget by Category')}</CardTitle>
            <div className="bg-standard-light text-standard px-2 py-1 rounded text-xs font-medium">
              {t('Standard Feature')}
            </div>
          </div>

          <div className="text-center py-8">
            <div className="text-4xl text-gray-300 dark:text-gray-600 mb-4">📊</div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {t('Detailed expense breakdown and budget tracking available with Standard')}
            </p>
            <Button className="bg-standard hover:bg-standard/90 text-white">
              {t('Upgrade to Standard')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (budgetsLoading || transactionsLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle>{t('Budget by Category')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{t('Budget by Category')}</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLocation('/budget')}>
            <Edit3 className="h-4 w-4 mr-1" />
            {t('Edit Budgets')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {budgetsWithSpending.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>{t('No spending on budgeted categories yet')}</p>
            <p className="text-sm">{t('Start spending and your budget progress will appear here')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {budgetsWithSpending.map((budget) => {
              const spent = budget.spent;
              const budgetAmount = parseFloat(budget.amount);
              const percentage = Math.round((spent / budgetAmount) * 100);
              const progressColor = getProgressColor(percentage);

              return (
                <div key={budget.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getCategoryIcon(budget.categoryIcon)}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {budget.categoryName}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{percentage}%</span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
                    <span>{formatCurrency(spent)} / {formatCurrency(budget.amount)}</span>
                    <span>{formatDateRange(budget.startDate, budget.endDate)}</span>
                  </div>

                  <Progress 
                    value={Math.min(percentage, 100)} 
                    className="h-2"
                    style={{
                      '--progress-foreground': progressColor
                    } as React.CSSProperties}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}