import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit3 } from "lucide-react";

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
  const { data: budgets, isLoading } = useQuery({
    queryKey: ['/api/budgets'],
  });

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
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

  // Mock data for demo - in real app this would come from API
  const mockBudgets = [
    {
      id: 1,
      categoryName: 'Food',
      categoryIcon: 'utensils',
      categoryColor: '#3B82F6',
      amount: '100.00',
      spent: '55.50',
      startDate: '2025-05-01',
      endDate: '2025-05-31',
    },
    {
      id: 2,
      categoryName: 'Housing',
      categoryIcon: 'home',
      categoryColor: '#10B981',
      amount: '500.00',
      spent: '245.00',
      startDate: '2025-05-01',
      endDate: '2025-05-31',
    },
    {
      id: 3,
      categoryName: 'Entertainment',
      categoryIcon: 'film',
      categoryColor: '#F59E0B',
      amount: '300.00',
      spent: '29.99',
      startDate: '2025-05-01',
      endDate: '2025-05-31',
    },
  ];

  if (isLoading) {
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

  const displayBudgets = budgets || mockBudgets;

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Budget by Category</CardTitle>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline">
              <Edit3 className="h-4 w-4 mr-1" />
              Edit Budgets
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1" />
              Add Category
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {displayBudgets.map((budget: any) => {
            const spent = parseFloat(budget.spent || '0');
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
                  <span>{formatCurrency(spent.toString())} / {formatCurrency(budget.amount)}</span>
                  <span>01/05/2025 - 31/05/2025</span>
                </div>
                
                <Progress 
                  value={percentage} 
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
      </CardContent>
    </Card>
  );
}
