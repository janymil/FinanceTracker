import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  DollarSign,
  Calendar,
  Crown,
  Lightbulb,
  ArrowRight
} from "lucide-react";
import { useLocation } from "wouter";
import RequirePlan from "@/components/require-plan";

interface SpendingInsight {
  id: string;
  type: "warning" | "suggestion" | "achievement" | "trend";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category?: string;
  amount?: number;
  recommendation?: string;
  actionable: boolean;
}

interface AIInsightsProps {
  data?: {
    transactions: any[];
    budgets: any[];
    goals: any[];
  };
}

export default function AIInsights({ data }: AIInsightsProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const handleTakeAction = (insight: SpendingInsight) => {
    // Navigate based on insight type and recommendation
    if (insight.type === 'warning' && insight.title?.toLowerCase().includes('spending')) {
      // High spending alerts -> go to expenses page
      setLocation('/expenses');
    } else if (insight.recommendation?.toLowerCase().includes('budget')) {
      // Budget-related recommendations -> go to budgets page
      setLocation('/budgets');
    } else if (insight.category) {
      // Category-specific insights -> go to transactions filtered by category
      setLocation('/transactions');
    } else if (insight.type === 'suggestion') {
      // General suggestions -> go to reports for analysis
      setLocation('/reports');
    } else {
      // Default action -> go to dashboard
      setLocation('/dashboard');
    }
  };

  // Generate AI insights based on user's financial data
  const generateInsights = (financialData: any): SpendingInsight[] => {
    if (!financialData || !financialData.transactions || !Array.isArray(financialData.transactions) || financialData.transactions.length === 0) return [];

    const insights: SpendingInsight[] = [];
    const { transactions, budgets = [], goals = [] } = financialData || {};

    // Analyze spending patterns
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const thisMonthTransactions = transactions.filter((t: any) => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });

    const totalExpenses = thisMonthTransactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

    const totalIncome = thisMonthTransactions
      .filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

    // High spending warning
    if (totalExpenses > totalIncome * 0.8) {
      insights.push({
        id: "high-spending",
        type: "warning",
        title: "High Spending Alert",
        description: `You've spent ${((totalExpenses / totalIncome) * 100).toFixed(0)}% of your income this month`,
        impact: "high",
        amount: totalExpenses,
        recommendation: "Consider reviewing your largest expense categories",
        actionable: true
      });
    }

    // Category analysis
    const categorySpending = thisMonthTransactions
      .filter((t: any) => t.type === 'expense')
      .reduce((acc: any, t: any) => {
        const category = t.categoryName || 'Other';
        acc[category] = (acc[category] || 0) + parseFloat(t.amount);
        return acc;
      }, {});

    const topCategory = Object.entries(categorySpending)
      .sort(([,a]: any, [,b]: any) => b - a)[0];

    if (topCategory && (topCategory[1] as number) > totalExpenses * 0.3) {
      insights.push({
        id: "category-dominance",
        type: "suggestion",
        title: "Category Focus Opportunity",
        description: `${topCategory[0]} represents ${((topCategory[1] as number / totalExpenses) * 100).toFixed(0)}% of your spending`,
        impact: "medium",
        category: topCategory[0] as string,
        amount: topCategory[1] as number,
        recommendation: `Consider setting a budget limit for ${topCategory[0]}`,
        actionable: true
      });
    }

    // Positive cash flow achievement
    if (totalIncome > totalExpenses) {
      const savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;
      insights.push({
        id: "positive-cashflow",
        type: "achievement",
        title: "Positive Cash Flow",
        description: `You're saving ${savingsRate.toFixed(1)}% of your income this month`,
        impact: "medium",
        amount: totalIncome - totalExpenses,
        recommendation: savingsRate < 20 ? "Consider increasing your savings rate to 20%" : "Excellent savings rate!",
        actionable: savingsRate < 20
      });
    }

    // Goal progress insights
    goals.forEach((goal: any) => {
      const progress = (goal.currentAmount / goal.targetAmount) * 100;
      const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      if (progress < 50 && daysLeft < 90) {
        insights.push({
          id: `goal-${goal.id}`,
          type: "warning",
          title: `Goal Behind Schedule: ${goal.name}`,
          description: `Only ${progress.toFixed(0)}% complete with ${daysLeft} days remaining`,
          impact: "high",
          recommendation: `Increase monthly contributions by $${Math.ceil((goal.targetAmount - goal.currentAmount) / (daysLeft / 30))}`,
          actionable: true
        });
      }
    });

    // Trend analysis
    if (transactions.length >= 2) {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      
      const lastMonthExpenses = transactions
        .filter((t: any) => {
          const tDate = new Date(t.date);
          return tDate.getMonth() === lastMonth.getMonth() && 
                 tDate.getFullYear() === lastMonth.getFullYear() &&
                 t.type === 'expense';
        })
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

      if (lastMonthExpenses > 0) {
        const spendingChange = ((totalExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
        
        if (Math.abs(spendingChange) > 15) {
          insights.push({
            id: "spending-trend",
            type: "trend",
            title: spendingChange > 0 ? "Spending Increased" : "Spending Decreased",
            description: `Your expenses ${spendingChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(spendingChange).toFixed(1)}% from last month`,
            impact: Math.abs(spendingChange) > 25 ? "high" : "medium",
            amount: Math.abs(totalExpenses - lastMonthExpenses),
            recommendation: spendingChange > 0 ? "Review recent purchases to identify spending increases" : "Great job reducing expenses!",
            actionable: spendingChange > 0
          });
        }
      }
    }

    return insights.slice(0, 5); // Limit to top 5 insights
  };

  const { data: insightsData, isLoading, error } = useQuery({
    queryKey: ["/api/ai/insights", data?.transactions?.length],
    enabled: !!user && user.plan === 'premium' && !!data?.transactions && data.transactions.length > 0,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/ai/insights');
      return response.json();
    },
  });

  // Use AI data if available, otherwise generate local insights
  const insights = Array.isArray(insightsData) && insightsData.length > 0 
    ? insightsData 
    : generateInsights(data);



  const getInsightIcon = (type: string) => {
    switch (type) {
      case "warning":
        return AlertTriangle;
      case "suggestion":
        return Lightbulb;
      case "achievement":
        return Target;
      case "trend":
        return TrendingUp;
      default:
        return Brain;
    }
  };

  const getInsightColor = (type: string, impact: string) => {
    if (type === "achievement") return "text-green-600 bg-green-50 border-green-200";
    if (type === "warning") return "text-red-600 bg-red-50 border-red-200";
    if (impact === "high") return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-blue-600 bg-blue-50 border-blue-200";
  };



  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          {t("ai_insights.title")}
          <Badge className="bg-premium text-white">{t("plans.premium")}</Badge>
        </CardTitle>
        <CardDescription>
          {t("ai_insights.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Insights Available
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Add more transactions to get personalized AI insights
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map((insight) => {
              const Icon = getInsightIcon(insight.type);
              const colorClasses = getInsightColor(insight.type, insight.impact);

              return (
                <div
                  key={insight.id}
                  className={`p-4 rounded-lg border ${colorClasses} dark:bg-gray-800 dark:border-gray-600`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium">{insight.title}</h4>
                        <Badge 
                          variant="outline" 
                          className={
                            insight.impact === "high" ? "border-red-300 text-red-700" :
                            insight.impact === "medium" ? "border-yellow-300 text-yellow-700" :
                            "border-gray-300 text-gray-700"
                          }
                        >
                          {insight.impact} impact
                        </Badge>
                      </div>
                      
                      <p className="text-sm mb-2">{insight.description}</p>
                      
                      {insight.amount && (
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            ${insight.amount.toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      {insight.recommendation && (
                        <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                          <p className="text-sm font-medium mb-1">Recommendation:</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {insight.recommendation}
                          </p>
                          {insight.actionable && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="mt-2"
                              onClick={() => handleTakeAction(insight)}
                            >
                              Take Action
                              <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}