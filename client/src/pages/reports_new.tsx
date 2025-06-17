import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, FileText, Brain, Download, Zap, Crown } from "lucide-react";
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
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  if (!user) {
    return null;
  }

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

  const hasStandardOrBetter = user?.publicMetadata?.plan === 'standard' || user?.publicMetadata?.plan === 'premium';
  const hasPremium = user?.publicMetadata?.plan === 'premium';

  // Calculate date ranges based on selected period and month
  const getDateRange = () => {
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
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - daysFromMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { startDate: startOfWeek, endDate: endOfWeek };
      case "month":
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case "quarter":
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
        return { startDate: quarterStart, endDate: quarterEnd };
      case "year":
        return { startDate: startOfYear(now), endDate: endOfYear(now) };
      default:
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    }
  };

  const { startDate, endDate } = getDateRange();

  // Fetch financial summary and transactions with proper authentication
  const fetchData = async () => {
    if (!isReady) return;
    
    setSummaryLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      
      // Fetch financial summary
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      const summaryResponse = await fetch(`/api/financial-summary?${params}`, {
        headers: authHeaders,
        credentials: 'include',
      });
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setFinancialSummary(summaryData);
        console.log('Reports financial summary fetched:', summaryData);
      } else {
        console.error('Failed to fetch financial summary:', summaryResponse.status);
      }
      
      // Fetch transactions
      const transactionsResponse = await fetch('/api/transactions', {
        headers: authHeaders,
        credentials: 'include',
      });
      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        setTransactions(transactionsData);
        console.log('Reports transactions fetched:', transactionsData?.length || 0, 'transactions');
      } else {
        console.error('Failed to fetch transactions:', transactionsResponse.status);
      }
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (isReady) {
      fetchData();
    }
  }, [isReady, selectedPeriod, selectedMonth]);

  // Filter transactions based on selected period and month
  const filteredTransactions = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }
    
    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [transactions, startDate, endDate]);

  // Calculate period name for display
  const getPeriodDisplayName = () => {
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const monthDate = new Date(parseInt(year), parseInt(month) - 1);
      return format(monthDate, 'MMMM yyyy');
    }
    
    switch (selectedPeriod) {
      case "week":
        return `Current Week (${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')})`;
      case "month":
        return "Current Month";
      case "quarter":
        return "Current Quarter";
      case "year":
        return "Current Year";
      default:
        return "This Period";
    }
  };

  const getSelectDisplayText = () => {
    switch (selectedPeriod) {
      case "week":
        return "Weekly Overview";
      case "month":
        return "Monthly Overview";
      case "quarter":
        return "Quarterly Overview";
      case "year":
        return "Yearly Overview";
      default:
        return "Monthly Overview";
    }
  };

  return (
    <RequirePlan requiredPlan="free" feature="Reports">
      <div className="space-y-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Financial Reports
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Analyze your financial data with detailed insights and trends
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <MonthFilter 
            value={selectedMonth} 
            onChange={setSelectedMonth}
            placeholder="Filter by Month"
          />
          
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2" disabled={!hasStandardOrBetter}>
              <BarChart3 className="h-4 w-4" />
              Analytics
              {!hasStandardOrBetter && <Crown className="h-3 w-3 text-amber-500" />}
            </TabsTrigger>
            <TabsTrigger value="auto-tag" className="flex items-center gap-2" disabled={!hasStandardOrBetter}>
              <Zap className="h-4 w-4" />
              Auto-Tag
              {!hasStandardOrBetter && <Crown className="h-3 w-3 text-amber-500" />}
            </TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Financial Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    {getSelectDisplayText()}
                  </CardTitle>
                  <CardDescription>
                    Basic financial summary for {getPeriodDisplayName().toLowerCase()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {summaryLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium text-green-800 dark:text-green-300">Total Income</p>
                            <p className="text-sm text-green-600 dark:text-green-400">Current month</p>
                          </div>
                        </div>
                        <span className="text-2xl font-bold text-green-600">
                          ${financialSummary?.totalIncome?.toFixed(2) || '0.00'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <TrendingDown className="h-5 w-5 text-red-600" />
                          <div>
                            <p className="font-medium text-red-800 dark:text-red-300">Total Expenses</p>
                            <p className="text-sm text-red-600 dark:text-red-400">Current month</p>
                          </div>
                        </div>
                        <span className="text-2xl font-bold text-red-600">
                          ${financialSummary?.totalExpenses?.toFixed(2) || '0.00'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <BarChart3 className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-blue-800 dark:text-blue-300">Net Balance</p>
                            <p className="text-sm text-blue-600 dark:text-blue-400">Current month</p>
                          </div>
                        </div>
                        <span className="text-2xl font-bold text-blue-600">
                          ${((financialSummary?.totalIncome || 0) - (financialSummary?.totalExpenses || 0)).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>
                    Latest transactions and account activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No Recent Transactions
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        Add transactions to see your recent activity here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTransactions.slice(0, 5).map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {format(new Date(transaction.date), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <span className={`font-semibold ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {hasStandardOrBetter ? (
              <InteractiveChart />
            ) : (
              <RequirePlan requiredPlan="standard" feature="Advanced Analytics" />
            )}
          </TabsContent>

          {/* Auto-Tag Tab */}
          <TabsContent value="auto-tag" className="space-y-6">
            {hasStandardOrBetter ? (
              <AutoCategorization />
            ) : (
              <RequirePlan requiredPlan="standard" feature="AI Auto-Categorization" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </RequirePlan>
  );
}