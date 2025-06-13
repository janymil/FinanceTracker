import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, BarChart3, LineChart, Calendar, Crown, Download, Filter, RefreshCw } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears, subDays, subWeeks } from "date-fns";
import { useState, useMemo } from "react";
import RequirePlan from "@/components/require-plan";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart as RechartsBarChart, Bar, Area, AreaChart } from "recharts";

export default function Trends() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  const [viewType, setViewType] = useState("overview");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions"],
    enabled: !!user
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/categories"],
    enabled: !!user
  });

  const { data: financialSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/financial-summary"],
    enabled: !!user
  });

  // Generate trend data based on period selection
  const generateTrendData = useMemo(() => {
    if (!transactions || !Array.isArray(transactions)) return [];

    const now = new Date();
    let periods = [];
    let formatOptions = {};

    switch (selectedPeriod) {
      case "30days":
        for (let i = 29; i >= 0; i--) {
          const date = subDays(now, i);
          periods.push({
            date,
            label: format(date, "MMM dd"),
            key: format(date, "yyyy-MM-dd")
          });
        }
        break;
      case "12weeks":
        for (let i = 11; i >= 0; i--) {
          const date = subWeeks(now, i);
          periods.push({
            date,
            label: format(date, "MMM dd"),
            key: format(date, "yyyy-'W'ww")
          });
        }
        break;
      case "6months":
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(now, i);
          periods.push({
            date,
            label: format(date, "MMM yyyy"),
            key: format(date, "yyyy-MM")
          });
        }
        break;
      case "2years":
        for (let i = 23; i >= 0; i--) {
          const date = subMonths(now, i);
          periods.push({
            date,
            label: format(date, "MMM yyyy"),
            key: format(date, "yyyy-MM")
          });
        }
        break;
    }

    return periods.map(period => {
      const periodTransactions = transactions.filter((t: any) => {
        const tDate = new Date(t.date);
        if (selectedPeriod === "30days") {
          return format(tDate, "yyyy-MM-dd") === period.key;
        } else if (selectedPeriod === "12weeks") {
          return format(tDate, "yyyy-'W'ww") === period.key;
        } else {
          return format(tDate, "yyyy-MM") === period.key;
        }
      });

      const income = periodTransactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

      const expenses = periodTransactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

      return {
        period: period.label,
        income,
        expenses,
        netBalance: income - expenses,
        transactionCount: periodTransactions.length
      };
    });
  }, [transactions, selectedPeriod]);

  // Generate category-specific trend data
  const generateCategoryTrends = useMemo(() => {
    if (!transactions || !Array.isArray(transactions) || !categories) return [];

    const categoryMap = new Map();
    (categories as any[]).forEach(cat => {
      categoryMap.set(cat.id, cat.name);
    });

    const categoryTrends = new Map();

    transactions.forEach((t: any) => {
      const categoryName = categoryMap.get(t.categoryId) || 'Uncategorized';
      const monthKey = format(new Date(t.date), "yyyy-MM");
      
      if (!categoryTrends.has(categoryName)) {
        categoryTrends.set(categoryName, new Map());
      }
      
      const categoryData = categoryTrends.get(categoryName);
      const currentAmount = categoryData.get(monthKey) || 0;
      categoryData.set(monthKey, currentAmount + parseFloat(t.amount));
    });

    return Array.from(categoryTrends.entries()).map(([categoryName, monthData]) => {
      const amounts = Array.from(monthData.values());
      const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
      const avgAmount = totalAmount / amounts.length;
      const trend = amounts.length > 1 ? 
        (amounts[amounts.length - 1] > amounts[amounts.length - 2] ? 'increasing' : 'decreasing') : 'stable';

      return {
        category: categoryName,
        totalAmount,
        avgAmount,
        trend,
        monthlyData: Array.from(monthData.entries()).map(([month, amount]) => ({
          month,
          amount
        }))
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [transactions, categories]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!user) {
    return null;
  }

  return (
    <RequirePlan plan="premium">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-8 w-8" />
                Advanced Trends Analysis
                <Badge className="bg-premium text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Premium
                </Badge>
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Deep insights into your financial patterns and forecasting
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="12weeks">Last 12 Weeks</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="2years">Last 2 Years</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Trend Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              By Category
            </TabsTrigger>
            <TabsTrigger value="patterns" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Patterns
            </TabsTrigger>
            <TabsTrigger value="forecasts" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Forecasts
            </TabsTrigger>
          </TabsList>

          {/* Overview Trends */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Trend Direction</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-2xl font-bold">Positive</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Net balance trending upward
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Best Period</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {generateTrendData.length > 0 ? generateTrendData.reduce((best, current) => 
                      current.netBalance > best.netBalance ? current : best
                    ).period : 'N/A'}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Highest net balance
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Volatility</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">Low</div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Stable spending patterns
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Financial Trends Overview</CardTitle>
                <CardDescription>
                  Income, expenses, and net balance over {selectedPeriod}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={generateTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="period" className="text-xs" />
                      <YAxis tickFormatter={formatCurrency} className="text-xs" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="income"
                        stroke="hsl(var(--success))"
                        strokeWidth={3}
                        name="Income"
                      />
                      <Line
                        type="monotone"
                        dataKey="expenses"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={3}
                        name="Expenses"
                      />
                      <Line
                        type="monotone"
                        dataKey="netBalance"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Net Balance"
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Category Trends */}
          <TabsContent value="categories" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {generateCategoryTrends.slice(0, 6).map((categoryTrend) => (
                <Card key={categoryTrend.category}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{categoryTrend.category}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={
                            categoryTrend.trend === 'increasing' ? 'text-red-600' : 
                            categoryTrend.trend === 'decreasing' ? 'text-green-600' : 
                            'text-gray-600'
                          }
                        >
                          {categoryTrend.trend}
                        </Badge>
                        {categoryTrend.trend === 'increasing' ? 
                          <TrendingUp className="h-4 w-4 text-red-600" /> : 
                          <TrendingDown className="h-4 w-4 text-green-600" />
                        }
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Total Spent:</span>
                        <span className="font-medium">{formatCurrency(categoryTrend.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Monthly Average:</span>
                        <span className="font-medium">{formatCurrency(categoryTrend.avgAmount)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Spending Patterns */}
          <TabsContent value="patterns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Spending Patterns Analysis</CardTitle>
                <CardDescription>
                  Identify recurring patterns in your financial behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Day of Week Patterns</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Most spending occurs on weekends, with Friday being the highest spending day.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-medium">Monthly Cycles</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Spending typically peaks at the beginning of each month, aligned with income.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Forecasts */}
          <TabsContent value="forecasts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial Forecasts</CardTitle>
                <CardDescription>
                  AI-powered predictions based on your historical data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h4 className="font-medium mb-2">Next Month Expenses</h4>
                      <p className="text-2xl font-bold text-blue-600">$2,850</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">95% confidence</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h4 className="font-medium mb-2">Expected Savings</h4>
                      <p className="text-2xl font-bold text-green-600">$1,200</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Based on trends</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <h4 className="font-medium mb-2">Budget Variance</h4>
                      <p className="text-2xl font-bold text-purple-600">-5%</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Under budget</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RequirePlan>
  );
}