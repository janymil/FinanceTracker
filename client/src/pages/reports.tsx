import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Download, TrendingUp, PieChart, BarChart3, FileText, Crown, Brain, Zap } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import InteractiveChart from "@/components/interactive-chart";
import AIInsights from "@/components/ai-insights";
import ExportTools from "@/components/export-tools";
import AutoCategorization from "@/components/auto-categorization";

export default function Reports() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState("month");

  if (!user) {
    return null;
  }

  const isPremium = user.isPremium;

  // Sample data for charts - in real app this would come from API
  const sampleChartData = [
    { date: "2025-01", income: 4500, expenses: 3200, balance: 1300 },
    { date: "2025-02", income: 4700, expenses: 3400, balance: 1600 },
    { date: "2025-03", income: 4600, expenses: 3100, balance: 2100 },
    { date: "2025-04", income: 4800, expenses: 3600, balance: 2300 },
    { date: "2025-05", income: 5000, expenses: 3800, balance: 2500 },
  ];

  const { data: financialData, isLoading } = useQuery({
    queryKey: ["/api/financial-data"],
    enabled: !!user && isPremium,
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

        {/* Premium Features Tabs */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </TabsTrigger>
            <TabsTrigger value="categorization" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Auto-Tag
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Summary
            </TabsTrigger>
          </TabsList>

          {/* Interactive Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <InteractiveChart
                data={sampleChartData}
                chartType="line"
                title="Income vs Expenses Trend"
                description="Track your cash flow over time with interactive zoom and insights"
                isPremium={isPremium}
                onExport={() => console.log("Exporting chart...")}
              />
              <InteractiveChart
                data={sampleChartData}
                chartType="bar"
                title="Monthly Comparison"
                description="Compare monthly performance with detailed tooltips"
                isPremium={isPremium}
              />
            </div>
            <InteractiveChart
              data={sampleChartData}
              chartType="area"
              title="Financial Overview"
              description="Comprehensive view of your financial health with trend analysis"
              isPremium={isPremium}
            />
          </TabsContent>

          {/* AI Insights */}
          <TabsContent value="insights" className="space-y-6">
            <AIInsights 
              isPremium={isPremium}
              data={financialData}
            />
          </TabsContent>

          {/* Export Tools */}
          <TabsContent value="export" className="space-y-6">
            <ExportTools 
              isPremium={isPremium}
              data={financialData}
            />
          </TabsContent>

          {/* Auto-Categorization */}
          <TabsContent value="categorization" className="space-y-6">
            <AutoCategorization 
              isPremium={isPremium}
              transactions={financialData?.transactions || []}
            />
          </TabsContent>

          {/* Basic Summary for Free Users */}
          <TabsContent value="summary" className="space-y-6">

        {/* Report Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Basic Report - Available for Free */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Basic Summary</CardTitle>
                    <CardDescription>Simple income vs expenses</CardDescription>
                  </div>
                </div>
                <Badge variant="outline">Free</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Basic overview of your income and expenses for the current month.
              </p>
            </CardContent>
          </Card>

          {/* Premium Report */}
          <Card className={`${!isPremium ? 'opacity-60' : 'cursor-pointer hover:shadow-lg'} transition-shadow relative`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <PieChart className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Category Analysis</CardTitle>
                    <CardDescription>Detailed spending breakdown</CardDescription>
                  </div>
                </div>
                {isPremium ? (
                  <Badge className="bg-premium text-white">Pro</Badge>
                ) : (
                  <Badge variant="secondary">Pro</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Interactive charts showing spending patterns across categories with percentage analysis.
              </p>
            </CardContent>
            {!isPremium && (
              <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center rounded-lg">
                <Button 
                  onClick={() => setLocation("/subscribe")}
                  size="sm"
                  className="bg-premium hover:bg-premium/90"
                >
                  <Crown className="h-4 w-4 mr-1" />
                  Upgrade
                </Button>
              </div>
            )}
          </Card>

          {/* Premium Report */}
          <Card className={`${!isPremium ? 'opacity-60' : 'cursor-pointer hover:shadow-lg'} transition-shadow relative`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Budget Performance</CardTitle>
                    <CardDescription>Budget vs actual analysis</CardDescription>
                  </div>
                </div>
                {isPremium ? (
                  <Badge className="bg-premium text-white">Pro</Badge>
                ) : (
                  <Badge variant="secondary">Pro</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Compare budgeted amounts with actual spending, track budget adherence over time.
              </p>
            </CardContent>
            {!isPremium && (
              <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center rounded-lg">
                <Button 
                  onClick={() => setLocation("/subscribe")}
                  size="sm"
                  className="bg-premium hover:bg-premium/90"
                >
                  <Crown className="h-4 w-4 mr-1" />
                  Upgrade
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Basic Report for Free Users */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Basic Financial Summary</CardTitle>
                <CardDescription>
                  {isPremium ? 'Current month overview' : 'Free tier - Basic report for current month'}
                </CardDescription>
              </div>
              {!isPremium && (
                <Badge variant="outline">Free Tier</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Total Income */}
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Total Income</h4>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">$0.00</p>
                <p className="text-xs text-green-600 dark:text-green-400">This month</p>
              </div>

              {/* Total Expenses */}
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Total Expenses</h4>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">$0.00</p>
                <p className="text-xs text-red-600 dark:text-red-400">This month</p>
              </div>

              {/* Net Balance */}
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Net Balance</h4>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">$0.00</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Difference</p>
              </div>
            </div>

            {/* Premium Features Locked */}
            {!isPremium && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
                  <div className="flex items-center justify-center mb-4">
                    <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <BarChart3 className="h-6 w-6 text-gray-400" />
                    </div>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Advanced Analytics Locked
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Unlock detailed charts, custom date ranges, category breakdowns, and export functionality
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                      Interactive Charts
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                      Export to PDF/Excel
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                      Custom Date Ranges
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                      Trend Analysis
                    </div>
                  </div>
                  <Button 
                    onClick={() => setLocation("/subscribe")}
                    className="bg-premium hover:bg-premium/90"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Premium
                  </Button>
                </div>
              </div>
            )}

            {/* Premium Advanced Features */}
            {isPremium && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Category Breakdown
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Food & Dining</span>
                        <span className="text-sm font-medium">$0.00</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Transportation</span>
                        <span className="text-sm font-medium">$0.00</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Shopping</span>
                        <span className="text-sm font-medium">$0.00</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Monthly Trends
                    </h4>
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <TrendingUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Interactive chart would appear here
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}