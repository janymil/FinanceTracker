import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trash2, Filter, Lock, Crown } from "lucide-react";
import { Link } from "wouter";

interface Transaction {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

interface TransactionListProps {
  transactions?: Transaction[];
  isLoading: boolean;
  isPremium: boolean;
}

export default function TransactionList({ transactions, isLoading, isPremium }: TransactionListProps) {
  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getCategoryIcon = (icon?: string) => {
    const iconMap: { [key: string]: string } = {
      'utensils': '🍽️',
      'film': '🎬',
      'home': '🏠',
      'car': '🚗',
      'heart': '❤️',
      'shopping-bag': '🛍️',
      'dollar-sign': '💰',
      'laptop': '💻',
      'trending-up': '📈',
    };
    return iconMap[icon || ''] || '💰';
  };

  if (isLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayTransactions = transactions || [];
  const limitedTransactions = !isPremium ? displayTransactions.slice(0, 3) : displayTransactions;

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Recent Expenses</CardTitle>
          {isPremium ? (
            <div className="flex items-center space-x-2">
              <Input 
                placeholder="Search transactions..." 
                className="w-48 h-8 text-sm"
              />
              <Button size="sm" variant="outline">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last 3 transactions
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {limitedTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No transactions found</p>
              <p className="text-sm">Start by adding your first transaction</p>
            </div>
          ) : (
            limitedTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-lg">
                    {getCategoryIcon(transaction.categoryIcon)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {transaction.description}
                    </p>
                    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>{transaction.categoryName || 'Uncategorized'}</span>
                      <span>•</span>
                      <span>{formatDate(transaction.date)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`font-semibold ${
                    transaction.type === 'expense' ? 'text-destructive' : 'text-success'
                  }`}>
                    {transaction.type === 'expense' ? '-' : '+'}{formatCurrency(transaction.amount)}
                  </span>
                  {isPremium && (
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {!isPremium && displayTransactions.length > 3 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Link href="/subscribe">
              <Button variant="ghost" className="w-full text-premium hover:text-premium/80">
                <Lock className="h-4 w-4 mr-2" />
                View all transactions with Premium
              </Button>
            </Link>
          </div>
        )}
        
        {isPremium && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between">
            <Button variant="ghost" className="text-primary hover:text-primary/80">
              View All Transactions
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Export
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
