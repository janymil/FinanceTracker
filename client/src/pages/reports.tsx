import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, FileText, Brain, Crown } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { useState } from "react";
import RequirePlan from "@/components/require-plan";

export default function Reports() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState("month");

  if (!user) {
    return null;
  }

  const hasStandardOrBetter = user?.plan === 'standard' || user?.plan === 'premium';
  const hasPremium = user?.plan === 'premium';

  // Get date range
  const getDateRange = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case "month":
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case "year":
        return { startDate: startOfYear(now), endDate: endOfYear(now) };
      default:
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    }
  };

  const { startDate, endDate } = getDateRange();

  // Fetch data
  const { data: transactions } = useQuery({
    queryKey: ['/api/transactions'],
  });

  const { data: financialSummary } = useQuery({
    queryKey: ['/api/financial-summary', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Reports & Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Comprehensive financial insights and analysis
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${financialSummary?.totalIncome?.toFixed(2) || '0.00'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${financialSummary?.totalExpenses?.toFixed(2) || '0.00'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Savings</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${((financialSummary?.totalIncome || 0) - (financialSummary?.totalExpenses || 0)).toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {!hasStandardOrBetter && (
            <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Advanced Analytics Available</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4 max-w-md">
                  Unlock interactive charts and detailed analysis with Standard plan.
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

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <RequirePlan plan="standard">
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Analytics</CardTitle>
                  <CardDescription>
                    Interactive charts and detailed financial analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Interactive Charts Coming Soon
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Advanced analytics features will be available here
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </RequirePlan>
        </TabsContent>
      </Tabs>
    </div>
  );
}