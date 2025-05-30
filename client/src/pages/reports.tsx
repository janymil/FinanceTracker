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

  const isPremium = !!user.isPremium;

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
              data={financialData as any}
            />
          </TabsContent>

          {/* Export Tools */}
          <TabsContent value="export" className="space-y-6">
            <ExportTools 
              isPremium={isPremium}
              data={financialData as any}
            />
          </TabsContent>

          {/* Auto-Categorization */}
          <TabsContent value="categorization" className="space-y-6">
            <AutoCategorization 
              isPremium={isPremium}
              transactions={(financialData as any)?.transactions || []}
            />
          </TabsContent>

          {/* Basic Summary for Free Users */}
          <TabsContent value="summary" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Financial Summary</CardTitle>
                <CardDescription>
                  {isPremium ? 'Current month overview' : 'Free tier - Basic report for current month'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Total Income</h4>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">$0.00</p>
                    <p className="text-xs text-green-600 dark:text-green-400">This month</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Total Expenses</h4>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">$0.00</p>
                    <p className="text-xs text-red-600 dark:text-red-400">This month</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Net Balance</h4>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">$0.00</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Difference</p>
                  </div>
                </div>
                
                {!isPremium && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Crown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Unlock Advanced Features
                          </h4>
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Get AI insights, interactive charts, and export capabilities
                          </p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setLocation("/subscribe")}
                        size="sm"
                        className="bg-premium hover:bg-premium/90"
                      >
                        Upgrade
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}