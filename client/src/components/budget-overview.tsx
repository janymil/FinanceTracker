import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit3 } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";

interface Budget {
  id: number;
  amount: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  startDate: string;
  endDate: string;
}

export default function BudgetOverview() {
  const [, setLocation] = useLocation();
  
  const { data: budgets, isLoading: budgetsLoading } = useQuery({
    queryKey: ['/api/budgets'],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['/api/transactions'],
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const getCategoryIcon = (icon: string) => {
    const iconMap: { [key: string]: string } = {
      'utensils': '🍽️',
      'film': '🎬',
      'home': '🏠',
      'car': '🚗',
      'heart': '❤️',
      'shopping-bag': '🛍️',
    };
    return iconMap[icon] || '💰';
  };

  const budgetsWithSpending = useMemo(() => {
    if (!budgets || !transactions) return [];
    
    return (budgets as any[])
      .map((budget: any) => {
        // Calculate total spending for this category in the current month
        const categorySpending = (transactions as any[])
          .filter((transaction: any) => 
            transaction.categoryId === budget.categoryId && 
            transaction.type === 'expense' &&
            new Date(transaction.date) >= new Date(budget.startDate) &&
            new Date(transaction.date) <= new Date(budget.endDate)
          )
          .reduce((total: number, transaction: any) => 
            total + Math.abs(parseFloat(transaction.amount)), 0
          );

        return {
          ...budget,
          spent: categorySpending
        };
      })
      .sort((a: any, b: any) => b.spent - a.spent); // Sort by spending amount descending
  }, [budgets, transactions]);

  if (budgetsLoading || transactionsLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle>Budget by Category</CardTitle>
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
          <CardTitle className="text-lg font-semibold">Budget by Category</CardTitle>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" onClick={() => setLocation('/budget')}>
              <Edit3 className="h-4 w-4 mr-1" />
              Edit Budgets
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setLocation('/expenses')}>
              <Plus className="h-4 w-4 mr-1" />
              Add Category
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {budgetsWithSpending.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No spending on budgeted categories yet</p>
            <p className="text-sm">Start spending and your budget progress will appear here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {budgetsWithSpending.map((budget: any) => {
              const spent = budget.spent;
              const budgetAmount = parseFloat(budget.amount);
              const percentage = Math.round((spent / budgetAmount) * 100);
              
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
                    <span>{new Date(budget.startDate).toLocaleDateString('en-US')} - {new Date(budget.endDate).toLocaleDateString('en-US')}</span>
                  </div>
                  
                  <Progress 
                    value={Math.min(percentage, 100)} 
                    className="h-2"
                    style={{
                      '--progress-foreground': percentage > 90 ? '#EF4444' : 
                                             percentage > 75 ? '#F59E0B' : '#10B981'
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
