import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, FileText, Brain, Download, Zap, Crown } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from "date-fns";
import { useState, useMemo } from "react";
import RequirePlan from "@/components/require-plan";
import MonthFilter from "@/components/month-filter";

import InteractiveChart from "@/components/interactive-chart";
import AIInsights from "@/components/ai-insights";
import AutoCategorization from "@/components/auto-categorization";

export default function Reports() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const hasStandardOrBetter = user?.plan === 'standard' || user?.plan === 'premium';
  const hasPremium = user?.plan === 'premium';

  // Calculate date ranges based on selected period
  const getDateRange = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        return { startDate: weekStart, endDate: now };
      case "month":
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case "quarter":
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(quarterStart);
        quarterEnd.setMonth(quarterStart.getMonth() + 3);
        quarterEnd.setDate(0);
        return { startDate: quarterStart, endDate: quarterEnd };
      case "year":
        return { startDate: startOfYear(now), endDate: endOfYear(now) };
      default:
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    }
  };

  const { startDate, endDate } = getDateRange();

  // Fetch financial summary data
  const { data: financialSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/financial-summary', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      const response = await fetch(`/api/financial-summary?${params}`);
      if (!response.ok) throw new Error('Failed to fetch financial summary');
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch transactions for recent activity
  const { data: transactions } = useQuery({
    queryKey: ['/api/transactions'],
    enabled: !!user,
  });

  // Filter transactions based on selected month
  const filteredTransactions = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }
    
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      return transactions.filter((transaction: any) => {
        const transactionDate = new Date(transaction.date);
        return transactionDate.getFullYear() === parseInt(year) && 
               transactionDate.getMonth() === parseInt(month) - 1;
      });
    }
    
    return transactions;
  }, [transactions, selectedMonth]);

  // Generate dynamic chart data from filtered transactions
  const generateChartData = () => {
    if (!Array.isArray(filteredTransactions) || filteredTransactions.length === 0) {
      return [];
    }

    // Group transactions by month
    const monthlyData: { [key: string]: { income: number; expenses: number } } = {};
    
    filteredTransactions.forEach((transaction: any) => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0 };
      }
      
      const amount = parseFloat(transaction.amount);
      if (transaction.type === 'income') {
        monthlyData[monthKey].income += amount;
      } else {
        monthlyData[monthKey].expenses += amount;
      }
    });

    // Convert to chart format and sort by date
    const chartData = Object.entries(monthlyData)
      .map(([date, data]) => ({
        date,
        income: data.income,
        expenses: data.expenses,
        balance: data.income - data.expenses
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return chartData;
  };

  const dynamicChartData = generateChartData();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Advanced Reports & Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                AI-powered insights, interactive charts, and comprehensive financial analysis
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Month Navigation Filter */}
        <MonthFilter 
          selectedMonth={selectedMonth}
          onMonthSelect={setSelectedMonth}
          onDateRangeReset={() => setSelectedPeriod("month")}
        />

        {/* Reports Tabs - Basic available for all, Advanced for Premium */}
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className={`grid w-full ${hasPremium ? 'grid-cols-4' : hasStandardOrBetter ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Summary
            </TabsTrigger>
            {hasStandardOrBetter && (
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            )}
            {hasPremium && (
              <TabsTrigger value="insights" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI Insights
              </TabsTrigger>
            )}
            {hasPremium && (
              <TabsTrigger value="categorization" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Auto-Tag
              </TabsTrigger>
            )}
          </TabsList>

          {/* Summary Tab - Available for all users */}
          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Basic financial summary cards available to all users */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary?.totalIncome ? `$${summary.totalIncome.toFixed(2)}` : '$0.00'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +2.5% from last period
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary?.totalExpenses ? `$${summary.totalExpenses.toFixed(2)}` : '$0.00'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    -1.2% from last period
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Savings</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary ? `$${(summary.totalIncome - summary.totalExpenses).toFixed(2)}` : '$0.00'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +12.3% from last period
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Upgrade prompt for advanced features */}
            {!hasStandardOrBetter && (
              <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Advanced Analytics Available</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4 max-w-md">
                    Unlock interactive charts, detailed breakdowns, and comprehensive financial analysis with Standard plan.
                  </p>
                  <Button 
                    onClick={() => setLocation("/subscribe")}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Standard
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Interactive Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <RequirePlan plan="standard">
                <InteractiveChart
                  data={dynamicChartData}
                  chartType="line"
                  title="Income vs Expenses Trend"
                  description="Track your cash flow over time with interactive zoom and insights"
                  onExport={() => console.log("Exporting chart...")}
                />
              </RequirePlan>
              <RequirePlan plan="standard">
                <InteractiveChart
                  data={dynamicChartData}
                  chartType="bar"
                  title="Monthly Comparison"
                  description="Compare monthly performance with detailed tooltips"
                />
              </RequirePlan>
            </div>
            <RequirePlan plan="standard">
              <InteractiveChart
                data={dynamicChartData}
                chartType="area"
                title="Financial Overview"
                description="Comprehensive view of your financial health with trend analysis"
              />
            </RequirePlan>
          </TabsContent>

          {/* AI Insights */}
          <TabsContent value="insights" className="space-y-6">
            <RequirePlan plan="premium">
              <AIInsights 
                data={{
                  transactions: Array.isArray(transactions) ? transactions : [],
                  budgets: [],
                  goals: []
                }}
              />
            </RequirePlan>
          </TabsContent>



          {/* Auto-Categorization */}
          <TabsContent value="categorization" className="space-y-6">
            <RequirePlan plan="standard">
              <AutoCategorization 
                transactions={Array.isArray(transactions) ? transactions : []}
              />
            </RequirePlan>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}