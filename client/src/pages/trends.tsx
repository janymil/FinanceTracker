import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, BarChart3, LineChart as LineChartIcon, Calendar, Crown, Download, Filter, RefreshCw } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears, subDays, subWeeks } from "date-fns";
import { useState, useMemo, useEffect } from "react";
import RequirePlan from "@/components/require-plan";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Area, AreaChart } from "recharts";
import { useCurrency } from "@/context/CurrencyContext";

export default function Trends() {
  const { isReady, user } = useClerkUserReady();
  const { currency } = useCurrency();
  const displayCurrency = currency || '$';
  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  const [viewType, setViewType] = useState("overview");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // State for data
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [aiPredictions, setAiPredictions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  // Fetch all data
  useEffect(() => {
    if (!isReady || !user?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeaders();
        
        // Fetch transactions
        const transactionsRes = await fetch('/api/transactions', { headers });
        if (transactionsRes.ok) {
          const transactionsData = await transactionsRes.json();
          setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
          console.log('Transactions loaded:', transactionsData.length);
        } else {
          console.error('Failed to fetch transactions:', transactionsRes.status);
        }

        // Fetch categories
        const categoriesRes = await fetch('/api/categories', { headers });
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(Array.isArray(categoriesData) ? categoriesData : []);
          console.log('Categories loaded:', categoriesData.length);
        } else {
          console.error('Failed to fetch categories:', categoriesRes.status);
        }

        // Fetch financial summary with date range
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        const summaryUrl = `/api/financial-summary?startDate=${sixMonthsAgo.toISOString().split('T')[0]}&endDate=${now.toISOString().split('T')[0]}`;
        const summaryRes = await fetch(summaryUrl, { headers });
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setFinancialSummary(summaryData);
          console.log('Financial summary loaded');
        } else {
          console.error('Failed to fetch financial summary:', summaryRes.status);
        }

        // Fetch AI predictions for premium users
        const predictionsRes = await fetch('/api/trend-predictions', { headers });
        if (predictionsRes.ok) {
          const predictionsData = await predictionsRes.json();
          setAiPredictions(predictionsData);
          console.log('AI predictions loaded');
        } else {
          console.error('Failed to fetch AI predictions:', predictionsRes.status);
        }
      } catch (error) {
        console.error('Error fetching trends data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isReady, user?.id]);

  // Debug logging
  console.log("Trends Debug:", {
    isReady,
    userId: user?.id,
    loading,
    transactionsLength: transactions.length,
    categoriesLength: categories.length,
    hasFinancialSummary: !!financialSummary,
    hasAiPredictions: !!aiPredictions
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
    return `${displayCurrency}${value.toLocaleString()}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Day of week spending analysis
  const getDayOfWeekData = () => {
    if (!transactions || !Array.isArray(transactions)) return [];
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayTotals = new Array(7).fill(0);
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const date = new Date(transaction.date);
        const dayOfWeek = date.getDay();
        dayTotals[dayOfWeek] += parseFloat(transaction.amount);
      });
    
    return dayNames.map((day, index) => ({
      day,
      amount: dayTotals[index]
    }));
  };

  // Monthly day spending analysis
  const getMonthlyDayData = () => {
    if (!transactions || !Array.isArray(transactions)) return [];
    
    const dayTotals = new Array(31).fill(0);
    const dayCounts = new Array(31).fill(0);
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const date = new Date(transaction.date);
        const dayOfMonth = date.getDate() - 1; // 0-indexed
        dayTotals[dayOfMonth] += parseFloat(transaction.amount);
        dayCounts[dayOfMonth]++;
      });
    
    return Array.from({ length: 31 }, (_, i) => ({
      day: (i + 1).toString(),
      amount: dayCounts[i] > 0 ? dayTotals[i] / dayCounts[i] : 0
    }));
  };

  // Category frequency analysis
  const getCategoryFrequencyData = () => {
    if (!transactions || !Array.isArray(transactions) || !categories) return [];
    
    const categoryStats = new Map();
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const categoryId = transaction.categoryId;
        const category = categories.find(c => c.id === categoryId);
        const categoryName = category?.name || 'Other';
        
        if (!categoryStats.has(categoryName)) {
          categoryStats.set(categoryName, {
            name: categoryName,
            frequency: 0,
            total: 0
          });
        }
        
        const stats = categoryStats.get(categoryName);
        stats.frequency++;
        stats.total += parseFloat(transaction.amount);
      });
    
    return Array.from(categoryStats.values())
      .map(stat => ({
        ...stat,
        average: stat.frequency > 0 ? stat.total / stat.frequency : 0
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 9); // Top 9 categories
  };

  // Generate insights for day of week patterns
  const getDayOfWeekInsight = () => {
    const data = getDayOfWeekData();
    if (data.length === 0) return "No spending data available.";
    
    const maxSpending = Math.max(...data.map(d => d.amount));
    const maxDay = data.find(d => d.amount === maxSpending);
    const weekendSpending = data[0].amount + data[6].amount; // Sunday + Saturday
    const weekdaySpending = data.slice(1, 6).reduce((sum, d) => sum + d.amount, 0);
    
    if (weekendSpending > weekdaySpending) {
      return `You spend more on weekends (${formatCurrency(weekendSpending)}) than weekdays. ${maxDay?.day} is your highest spending day.`;
    } else {
      return `You spend more on weekdays (${formatCurrency(weekdaySpending)}) than weekends. ${maxDay?.day} is your highest spending day.`;
    }
  };

  // Generate insights for monthly day patterns
  const getMonthlyDayInsight = () => {
    const data = getMonthlyDayData();
    if (data.length === 0) return "No spending data available.";
    
    const firstWeek = data.slice(0, 7).reduce((sum, d) => sum + d.amount, 0) / 7;
    const lastWeek = data.slice(-7).reduce((sum, d) => sum + d.amount, 0) / 7;
    
    if (firstWeek > lastWeek * 1.2) {
      return `You tend to spend more at the beginning of the month (${formatCurrency(firstWeek)} avg) than at the end (${formatCurrency(lastWeek)} avg).`;
    } else if (lastWeek > firstWeek * 1.2) {
      return `You tend to spend more at the end of the month (${formatCurrency(lastWeek)} avg) than at the beginning (${formatCurrency(firstWeek)} avg).`;
    } else {
      return `Your spending is relatively consistent throughout the month.`;
    }
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
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-1 text-xs md:text-sm">
              <LineChart className="h-3 w-3 md:h-4 md:w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-1 text-xs md:text-sm">
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
              <span>By Category</span>
            </TabsTrigger>
            <TabsTrigger value="patterns" className="flex items-center gap-1 text-xs md:text-sm">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
              <span>Patterns</span>
            </TabsTrigger>
            <TabsTrigger value="forecasts" className="flex items-center gap-1 text-xs md:text-sm">
              <RefreshCw className="h-3 w-3 md:h-4 md:w-4" />
              <span>Forecasts</span>
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
                    <LineChart data={generateTrendData}>
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
                    </LineChart>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Day of Week Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle>Day of Week Patterns</CardTitle>
                  <CardDescription>Your spending behavior across different days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getDayOfWeekData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Amount']} />
                        <Bar dataKey="amount" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {getDayOfWeekInsight()}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Day Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Spending Cycles</CardTitle>
                  <CardDescription>How your spending varies throughout the month</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getMonthlyDayData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Amount']} />
                        <Line type="monotone" dataKey="amount" stroke="#82ca9d" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {getMonthlyDayInsight()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Category Frequency Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Category Spending Frequency</CardTitle>
                <CardDescription>How often you spend in each category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getCategoryFrequencyData().map((category) => (
                    <div key={category.name} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{category.name}</h4>
                        <Badge variant="outline">{category.frequency} times</Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Total:</span>
                          <span className="font-medium">{formatCurrency(category.total)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Average:</span>
                          <span className="font-medium">{formatCurrency(category.average)}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(category.frequency / Math.max(...getCategoryFrequencyData().map(c => c.frequency))) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Forecasts */}
          <TabsContent value="forecasts" className="space-y-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </div>
              </div>
            ) : aiPredictions ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Financial Forecasts</CardTitle>
                    <CardDescription>
                      AI-powered predictions based on your historical data patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h4 className="font-medium mb-2">Next Month Expenses</h4>
                          <p className="text-2xl font-bold text-blue-600">
                            ${aiPredictions.financialForecast?.nextMonthExpenses?.toLocaleString() || '0'}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {Math.round((aiPredictions.financialForecast?.confidence || 0) * 100)}% confidence
                          </p>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <h4 className="font-medium mb-2">Expected Savings</h4>
                          <p className="text-2xl font-bold text-green-600">
                            ${aiPredictions.financialForecast?.expectedSavings?.toLocaleString() || '0'}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Based on AI analysis</p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <h4 className="font-medium mb-2">Budget Variance</h4>
                          <p className={`text-2xl font-bold ${
                            (aiPredictions.financialForecast?.budgetVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {(aiPredictions.financialForecast?.budgetVariance || 0) >= 0 ? '+' : ''}
                            {aiPredictions.financialForecast?.budgetVariance?.toFixed(1) || '0'}%
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {(aiPredictions.financialForecast?.budgetVariance || 0) >= 0 ? 'Over budget' : 'Under budget'}
                          </p>
                        </div>
                      </div>
                      
                      {/* AI Insights */}
                      {aiPredictions.financialForecast?.keyInsights?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-3">Key Insights</h4>
                          <div className="space-y-2">
                            {aiPredictions.financialForecast.keyInsights.map((insight, index) => (
                              <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <p className="text-sm">{insight}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Recommendations */}
                      {aiPredictions.financialForecast?.recommendations?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-3">AI Recommendations</h4>
                          <div className="space-y-2">
                            {aiPredictions.financialForecast.recommendations.map((rec, index) => (
                              <div key={index} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-600">
                                <p className="text-sm">{rec}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Risk Factors */}
                      {aiPredictions.financialForecast?.riskFactors?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-3">Risk Factors</h4>
                          <div className="space-y-2">
                            {aiPredictions.financialForecast.riskFactors.map((risk, index) => (
                              <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-600">
                                <p className="text-sm">{risk}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Category Predictions */}
                {aiPredictions.categoryPredictions?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Category-Specific Predictions</CardTitle>
                      <CardDescription>
                        AI forecasts for individual spending categories
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {aiPredictions.categoryPredictions.slice(0, 6).map((prediction, index) => (
                          <div key={index} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium">{prediction.category}</h5>
                              <Badge variant="outline" className={
                                prediction.trend === 'increasing' ? 'text-red-600' : 
                                prediction.trend === 'decreasing' ? 'text-green-600' : 
                                'text-gray-600'
                              }>
                                {prediction.trend}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Predicted Amount:</span>
                                <span className="font-medium">${prediction.predictedAmount?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Confidence:</span>
                                <span className="font-medium">{Math.round((prediction.confidence || 0) * 100)}%</span>
                              </div>
                              {prediction.reasoning && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                  {prediction.reasoning}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>AI Financial Forecasts</CardTitle>
                  <CardDescription>
                    Generate AI-powered predictions based on your transaction history
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Predictions Available
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Add more transactions to generate AI-powered financial forecasts
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </RequirePlan>
  );
}