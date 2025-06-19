import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, FileText, Brain, Download, Zap, Crown, RotateCcw } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from "date-fns";
import RequirePlan from "@/components/require-plan";
import MonthFilter from "@/components/month-filter";

import InteractiveChart from "@/components/interactive-chart";
import AIInsights from "@/components/ai-insights";
import AutoCategorization from "@/components/auto-categorization";

export default function Reports() {
  const { isReady, user } = useClerkUserReady();
  const [, setLocation] = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  // User tier checking is handled by RequirePlan components

  // Calculate date ranges based on selected period and month - memoized to prevent infinite loops
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    
    // If a specific month is selected, use that month's dates
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(month), 0);
      return { startDate: monthStart, endDate: monthEnd };
    }
    
    // Otherwise use the selected period
    switch (selectedPeriod) {
      case "week":
        const today = new Date(now);
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to Sunday=6, Monday=1 to Monday=0
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysFromMonday); // Start of current week (Monday)
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // End of current week (Sunday)
        weekEnd.setHours(23, 59, 59, 999);
        return { startDate: weekStart, endDate: weekEnd };
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
  }, [selectedPeriod, selectedMonth]);

  // React Query hooks for data fetching
  const { data: financialSummary = null, isLoading: summaryLoading } = useQuery({
    queryKey: ["financial-summary", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      const response = await apiRequest("GET", `/api/financial-summary?${params}`);
      return response.json();
    },
    enabled: isReady && !!user?.id
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/transactions");
      return response.json();
    },
    enabled: isReady && !!user?.id
  });

  // Filter transactions based on selected period and month
  const filteredTransactions = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }
    
    return transactions.filter((transaction: any) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [transactions, startDate, endDate]);

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
    <div>
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

        {/* Reports Tabs - Summary for all, Analytics/Auto-Tag for standard+, AI Insights for premium */}
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="summary" className="flex items-center gap-1 text-xs md:text-sm">
              <FileText className="h-3 w-3 md:h-4 md:w-4" />
              <span>Summary</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1 text-xs md:text-sm">
              <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="categorization" className="flex items-center gap-1 text-xs md:text-sm">
              <Zap className="h-3 w-3 md:h-4 md:w-4" />
              <span>Auto-Tag</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-1 text-xs md:text-sm">
              <Brain className="h-3 w-3 md:h-4 md:w-4" />
              <span>AI Insights</span>
            </TabsTrigger>
          </TabsList>

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

          {/* Auto-Categorization - Standard+ Users */}
          <TabsContent value="categorization" className="space-y-6">
            <RequirePlan plan="standard">
              <AutoCategorization 
                transactions={filteredTransactions}
              />
            </RequirePlan>
          </TabsContent>

          {/* AI Insights - Premium Users Only (Last Tab) */}
          <TabsContent value="insights" className="space-y-6">
            <RequirePlan plan="premium">
              <AIInsights 
                data={{
                  transactions: filteredTransactions,
                  budgets: [],
                  goals: []
                }}
              />
            </RequirePlan>
          </TabsContent>

          {/* Financial Summary - Available for All Users */}
          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedPeriod === "week" ? "Weekly Overview" : 
                     selectedPeriod === "month" ? "Monthly Overview" :
                     selectedPeriod === "quarter" ? "Quarterly Overview" :
                     selectedPeriod === "year" ? "Yearly Overview" : "Financial Overview"}
                  </CardTitle>
                  <CardDescription>
                    Basic financial summary for {selectedPeriod === "week" ? "this week" : 
                                                 selectedPeriod === "month" ? "this month" :
                                                 selectedPeriod === "quarter" ? "this quarter" :
                                                 selectedPeriod === "year" ? "this year" : selectedPeriod}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-900 dark:text-green-100">Total Income</p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            {selectedPeriod === "week" ? "Current week" : 
                             selectedPeriod === "month" ? "Current month" :
                             selectedPeriod === "quarter" ? "Current quarter" :
                             selectedPeriod === "year" ? "Current year" : "Current period"}
                          </p>
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {summaryLoading ? (
                          <Skeleton className="h-6 w-16" />
                        ) : (
                          `$${financialSummary?.totalIncome?.toFixed(2) || '0.00'}`
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full">
                          <PieChart className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-red-900 dark:text-red-100">Total Expenses</p>
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {selectedPeriod === "week" ? "Current week" : 
                             selectedPeriod === "month" ? "Current month" :
                             selectedPeriod === "quarter" ? "Current quarter" :
                             selectedPeriod === "year" ? "Current year" : "Current period"}
                          </p>
                        </div>
                      </div>
                      <div className="text-xl font-bold text-red-700 dark:text-red-300">
                        {summaryLoading ? (
                          <Skeleton className="h-6 w-16" />
                        ) : (
                          `$${financialSummary?.totalExpenses?.toFixed(2) || '0.00'}`
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full">
                          <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Net Balance</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            {selectedPeriod === "week" ? "Current week" : 
                             selectedPeriod === "month" ? "Current month" :
                             selectedPeriod === "quarter" ? "Current quarter" :
                             selectedPeriod === "year" ? "Current year" : "Current period"}
                          </p>
                        </div>
                      </div>
                      <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                        {summaryLoading ? (
                          <Skeleton className="h-6 w-16" />
                        ) : (
                          `$${((financialSummary?.totalIncome || 0) - (financialSummary?.totalExpenses || 0)).toFixed(2)}`
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Latest transactions and account activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!Array.isArray(transactions) || transactions.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="mx-auto h-12 w-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                        <FileText className="h-6 w-6 text-gray-400" />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        No Recent Transactions
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Add transactions to see your recent activity here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(transactions as any[]).slice(0, 5).map((transaction: any) => (
                          <div key={transaction.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                transaction.type === 'income' 
                                  ? 'bg-green-100 dark:bg-green-900' 
                                  : 'bg-red-100 dark:bg-red-900'
                              }`}>
                                {transaction.type === 'income' ? (
                                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {transaction.description}
                                  </p>
                                  {transaction.isRecurring && (
                                    <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                                      <RotateCcw className="h-3 w-3 mr-1" />
                                      Recurring
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {new Date(transaction.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-semibold ${
                                transaction.type === 'income' 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {transaction.type === 'income' ? '+' : '-'}$
                                {parseFloat(transaction.amount).toFixed(2)}
                              </p>
                            </div>
                          </div>
                      ))}
                      {Array.isArray(transactions) && transactions.length > 5 && (
                        <div className="text-center pt-2">
                          <p className="text-xs text-gray-500">
                            Showing 5 of {Array.isArray(transactions) ? transactions.length : 0} transactions
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Category Breakdown - Basic for Free Users */}
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
                <CardDescription>
                  Detailed spending analysis by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!Array.isArray(financialSummary?.transactionsByCategory) || financialSummary.transactionsByCategory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto h-16 w-16 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                      <PieChart className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Category Data
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto mb-6">
                      Add transactions to see detailed category breakdowns and spending patterns
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(financialSummary.transactionsByCategory as any[])
                      .filter((cat: any) => cat.type === 'expense')
                      .sort((a: any, b: any) => b.amount - a.amount)
                      .slice(0, 6)
                      .map((category: any, index: number) => {
                        const percentage = financialSummary.totalExpenses > 0 
                          ? (category.amount / financialSummary.totalExpenses) * 100 
                          : 0;
                        return (
                          <div key={index} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                                <PieChart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {category.categoryName}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {percentage.toFixed(1)}% of expenses
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                ${category.amount.toFixed(2)}
                              </p>
                              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                                <div 
                                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    
                    {Array.isArray(financialSummary.transactionsByCategory) && financialSummary.transactionsByCategory.filter((cat: any) => cat.type === 'expense').length > 6 && (
                      <div className="text-center pt-2">
                        <p className="text-xs text-gray-500">
                          Showing top 6 expense categories
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Statistics</CardTitle>
                <CardDescription>
                  Key metrics from your financial data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full w-fit mx-auto mb-2">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {Array.isArray(transactions) ? transactions.length : 0}
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Total Transactions</span>
                  </div>
                  
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full w-fit mx-auto mb-2">
                      <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {Array.isArray(financialSummary?.transactionsByCategory) 
                        ? financialSummary.transactionsByCategory.filter((cat: any) => cat.type === 'expense').length 
                        : 0}
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Categories Used</span>
                  </div>
                  
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-full w-fit mx-auto mb-2">
                      <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      ${((financialSummary?.totalIncome || 0) / Math.max(
                        Array.isArray(transactions) ? transactions.filter((t: any) => t.type === 'income').length : 1, 
                        1
                      )).toFixed(0)}
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Avg Income</span>
                  </div>
                  
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                    <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full w-fit mx-auto mb-2">
                      <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      ${((financialSummary?.totalExpenses || 0) / Math.max(
                        Array.isArray(transactions) ? transactions.filter((t: any) => t.type === 'expense').length : 1, 
                        1
                      )).toFixed(0)}
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Avg Expense</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upgrade Banner for Free Users */}
            {false && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Crown className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Unlock Advanced Reports
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        Get AI insights, interactive charts, export tools, and auto-categorization
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setLocation("/subscribe")}
                    className="bg-premium hover:bg-premium/90"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade Now
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}