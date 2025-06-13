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
import ExportTools from "@/components/export-tools";
import InteractiveChart from "@/components/interactive-chart";
import AIInsights from "@/components/ai-insights";
import AutoCategorization from "@/components/auto-categorization";

export default function Reports() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState("month");

  if (!user) {
    return null;
  }

  const hasStandardOrBetter = user?.plan === 'standard' || user?.plan === 'premium';
  const hasPremium = user?.plan === 'premium';

  // Sample data for charts - in real app this would come from API
  const sampleChartData = [
    { date: "2025-01", income: 4500, expenses: 3200, balance: 1300 },
    { date: "2025-02", income: 4700, expenses: 3400, balance: 1600 },
    { date: "2025-03", income: 4600, expenses: 3100, balance: 2100 },
    { date: "2025-04", income: 4800, expenses: 3600, balance: 2300 },
    { date: "2025-05", income: 5000, expenses: 3800, balance: 2500 },
  ];

  const { data: financialData } = useQuery({
    queryKey: ["/api/financial-data"],
    enabled: !!user && hasPremium,
  });

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

        {/* Reports Tabs - Basic available for all, Advanced for Premium */}
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
              {!hasStandardOrBetter && <Badge variant="secondary" className="ml-1 text-xs">Standard+</Badge>}
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Insights
              {!hasStandardOrBetter && <Badge variant="secondary" className="ml-1 text-xs">Premium</Badge>}
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
              {!hasStandardOrBetter && <Badge variant="secondary" className="ml-1 text-xs">Standard+</Badge>}
            </TabsTrigger>
            <TabsTrigger value="categorization" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Auto-Tag
              {!hasPremium && <Badge variant="secondary" className="ml-1 text-xs">Premium</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Interactive Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <RequirePlan plan="standard">
                <InteractiveChart
                  data={sampleChartData}
                  chartType="line"
                  title="Income vs Expenses Trend"
                  description="Track your cash flow over time with interactive zoom and insights"
                  onExport={() => console.log("Exporting chart...")}
                />
              </RequirePlan>
              <RequirePlan plan="standard">
                <InteractiveChart
                  data={sampleChartData}
                  chartType="bar"
                  title="Monthly Comparison"
                  description="Compare monthly performance with detailed tooltips"
                />
              </RequirePlan>
            </div>
            <RequirePlan plan="standard">
              <InteractiveChart
                data={sampleChartData}
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
                data={financialData as any}
              />
            </RequirePlan>
          </TabsContent>

          {/* Export Tools */}
          <TabsContent value="export" className="space-y-6">
            <RequirePlan plan="standard">
              <ExportTools 
                data={financialData as any}
              />
            </RequirePlan>
          </TabsContent>

          {/* Auto-Categorization */}
          <TabsContent value="categorization" className="space-y-6">
            <RequirePlan plan="standard">
              <AutoCategorization 
                transactions={(financialData as any)?.transactions || []}
              />
            </RequirePlan>
          </TabsContent>

          {/* Financial Summary - Available for All Users */}
          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Overview</CardTitle>
                  <CardDescription>
                    Basic financial summary for {selectedPeriod === "month" ? "this month" : selectedPeriod}
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
                          <p className="text-xs text-green-600 dark:text-green-400">Current month</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-green-700 dark:text-green-300">$0.00</p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full">
                          <PieChart className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-red-900 dark:text-red-100">Total Expenses</p>
                          <p className="text-xs text-red-600 dark:text-red-400">Current month</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-red-700 dark:text-red-300">$0.00</p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full">
                          <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Net Balance</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">Income - Expenses</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-300">$0.00</p>
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
                </CardContent>
              </Card>
            </div>

            {/* Category Breakdown - Basic for Free Users */}
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
                <CardDescription>
                  {hasStandardOrBetter ? "Detailed spending analysis by category" : "Standard category overview (upgrade for detailed analysis)"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <div className="mx-auto h-16 w-16 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                    <PieChart className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {hasStandardOrBetter ? "No Data to Display" : "Category Charts Available with Standard+"}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto mb-6">
                    {hasStandardOrBetter 
                      ? "Add transactions to see detailed category breakdowns and spending patterns"
                      : "Upgrade to Basic to unlock interactive category charts, spending trends, and detailed financial analysis"
                    }
                  </p>

                  {!hasStandardOrBetter && (
                    <Button 
                      onClick={() => setLocation("/subscribe")}
                      className="bg-premium hover:bg-premium/90"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Unlock Basic Charts
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common financial management tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                    <Download className="h-5 w-5" />
                    <span className="text-xs">Basic Export</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    <span className="text-xs">Date Range</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2" disabled>
                    <Brain className="h-5 w-5" />
                    <div className="flex items-center gap-1">
                      <span className="text-xs">AI Insights</span>
                      <Badge variant="secondary" className="text-xs">Pro</Badge>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2" disabled>
                    <Zap className="h-5 w-5" />
                    <div className="flex items-center gap-1">
                      <span className="text-xs">Auto-Tag</span>
                      <Badge variant="secondary" className="text-xs">Pro</Badge>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Upgrade Banner for Free Users */}
            {!hasStandardOrBetter && (
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