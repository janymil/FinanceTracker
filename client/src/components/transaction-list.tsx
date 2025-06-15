import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Filter, Lock, Crown, TrendingDown, TrendingUp } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";

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
  const [activeTab, setActiveTab] = useState("expenses");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [, setLocation] = useLocation();

  // Filter and search transactions
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    return transactions.filter(transaction => {
      // Search filter
      const matchesSearch = searchTerm === "" || 
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (transaction.categoryName && transaction.categoryName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Type filter
      const matchesType = filterType === "all" || transaction.type === filterType;
      
      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, filterType]);
  
  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(parseFloat(amount)));
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
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
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

  const displayTransactions = filteredTransactions || [];
  const expenseTransactions = displayTransactions
    .filter(t => t.type === 'expense')
    .slice(0, 5);
  const incomeTransactions = displayTransactions
    .filter(t => t.type === 'income')
    .slice(0, 5);
  
  const limitForFree = !isPremium ? 100 : 5;

  const renderTransactionList = (transactionList: Transaction[], type: string) => (
    <div className="space-y-3">
      {transactionList.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No {type} found</p>
          <p className="text-sm">Start by adding your first transaction</p>
        </div>
      ) : (
        transactionList.slice(0, limitForFree).map((transaction) => (
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
  );

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
          {isPremium ? (
            <div className="flex items-center space-x-2">
              <Input 
                placeholder="Search transactions..." 
                className="w-48 h-8 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48" align="end">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Filter by type</h4>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All transactions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All transactions</SelectItem>
                        <SelectItem value="expense">Expenses only</SelectItem>
                        <SelectItem value="income">Income only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last {limitForFree} transactions
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="expenses" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="income" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Income
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="expenses" className="mt-4">
            {renderTransactionList(expenseTransactions, 'expenses')}
          </TabsContent>
          
          <TabsContent value="income" className="mt-4">
            {renderTransactionList(incomeTransactions, 'income')}
          </TabsContent>
        </Tabs>
        
        {!isPremium && (
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
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button 
              variant="ghost" 
              className="w-full text-primary hover:text-primary/80"
              onClick={() => setLocation('/transactions')}
            >
              View All Transactions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}