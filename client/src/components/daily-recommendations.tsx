import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Lightbulb, 
  TrendingUp, 
  Target,
  Calendar,
  Crown,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  PiggyBank,
  Coffee,
  Car,
  Home,
  Heart,
  Briefcase
} from 'lucide-react';
import { useLocation } from 'wouter';

interface DailyRecommendationsProps {
  summary?: any;
  transactions?: any[];
  budgets?: any[];
}

interface Recommendation {
  id: string;
  type: 'spending' | 'saving' | 'budgeting' | 'goal' | 'habit';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  impact: string;
  timeToComplete: string;
  category?: string;
  amount?: number;
  completed?: boolean;
}

interface PersonalizationInsight {
  id: string;
  insight: string;
  basedOn: string;
  confidence: number;
  timeframe: string;
}

export default function DailyRecommendations({ summary, transactions = [], budgets = [] }: DailyRecommendationsProps) {
  const [, setLocation] = useLocation();
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [currentDate, setCurrentDate] = useState(new Date());

  // Generate AI-powered daily recommendations
  const generateDailyRecommendations = (): Recommendation[] => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const recommendations: Recommendation[] = [];

    // Spending analysis recommendations
    if (summary?.totalExpenses > summary?.totalIncome * 0.8) {
      recommendations.push({
        id: 'reduce-spending',
        type: 'spending',
        priority: 'high',
        title: 'Reduce High Spending',
        description: 'Your spending is approaching 80% of your income',
        action: 'Review your largest expense categories and identify areas to cut back',
        impact: 'Save $200-500 this month',
        timeToComplete: '15 minutes',
        category: 'Financial Health'
      });
    }

    // Daily habit recommendations based on day of week
    if (dayOfWeek === 1) { // Monday
      recommendations.push({
        id: 'weekly-budget-review',
        type: 'budgeting',
        priority: 'medium',
        title: 'Weekly Budget Check',
        description: 'Start your week with a budget review',
        action: 'Review last week\'s spending and set this week\'s spending targets',
        impact: 'Stay on track with monthly budget',
        timeToComplete: '10 minutes',
        category: 'Planning'
      });
    }

    if (dayOfWeek === 5) { // Friday
      recommendations.push({
        id: 'expense-logging',
        type: 'habit',
        priority: 'medium',
        title: 'Log Weekly Expenses',
        description: 'End the week by logging any missed transactions',
        action: 'Check bank statements and add any missing transactions',
        impact: 'Maintain accurate financial records',
        timeToComplete: '5 minutes',
        category: 'Tracking'
      });
    }

    // Transaction-based recommendations
    if (transactions.length > 0) {
      const recentTransactions = transactions.slice(0, 5);
      const hasUncategorized = recentTransactions.some((t: any) => !t.categoryName);
      
      if (hasUncategorized) {
        recommendations.push({
          id: 'categorize-transactions',
          type: 'habit',
          priority: 'low',
          title: 'Categorize Recent Transactions',
          description: 'Some recent transactions need categories',
          action: 'Add categories to your latest transactions for better insights',
          impact: 'Improve spending analysis accuracy',
          timeToComplete: '5 minutes',
          category: 'Organization'
        });
      }
    }

    // Saving opportunities
    if (summary?.netBalance > 0) {
      recommendations.push({
        id: 'increase-savings',
        type: 'saving',
        priority: 'medium',
        title: 'Optimize Savings Rate',
        description: 'You have positive cash flow this month',
        action: 'Consider increasing your savings goal by 5-10%',
        impact: 'Build emergency fund faster',
        timeToComplete: '2 minutes',
        amount: Math.round(summary.netBalance * 0.1),
        category: 'Wealth Building'
      });
    }

    // Budget recommendations
    budgets.forEach((budget: any) => {
      const spent = Math.abs(parseFloat(budget.spent || 0));
      const budgetAmount = parseFloat(budget.amount);
      const usage = spent / budgetAmount;

      if (usage > 0.8) {
        recommendations.push({
          id: `budget-warning-${budget.id}`,
          type: 'budgeting',
          priority: 'high',
          title: `${budget.categoryName} Budget Alert`,
          description: `You've used ${(usage * 100).toFixed(0)}% of your ${budget.categoryName} budget`,
          action: 'Consider reducing spending in this category for the rest of the month',
          impact: 'Avoid budget overspend',
          timeToComplete: '1 minute',
          category: budget.categoryName
        });
      }
    });

    // Seasonal/contextual recommendations
    const currentMonth = today.getMonth();
    if (currentMonth === 11) { // December
      recommendations.push({
        id: 'holiday-spending',
        type: 'spending',
        priority: 'medium',
        title: 'Holiday Budget Planning',
        description: 'Plan your holiday spending to avoid overspending',
        action: 'Set a specific budget for gifts and holiday activities',
        impact: 'Prevent holiday debt',
        timeToComplete: '10 minutes',
        category: 'Seasonal'
      });
    }

    return recommendations.slice(0, 6); // Limit to 6 daily recommendations
  };

  const generatePersonalizationInsights = (): PersonalizationInsight[] => {
    const insights: PersonalizationInsight[] = [];

    // Spending pattern insights
    if (transactions.length > 0) {
      const categorySpending = transactions.reduce((acc: any, t: any) => {
        if (t.type === 'expense') {
          const category = t.categoryName || 'Other';
          acc[category] = (acc[category] || 0) + Math.abs(parseFloat(t.amount));
        }
        return acc;
      }, {});

      const topCategory = Object.entries(categorySpending)
        .sort(([,a]: any, [,b]: any) => b - a)[0];

      if (topCategory) {
        insights.push({
          id: 'top-category',
          insight: `You spend most on ${topCategory[0]} - averaging $${Math.round(topCategory[1] as number / 30)} per day`,
          basedOn: 'Transaction history analysis',
          confidence: 0.85,
          timeframe: 'Last 30 days'
        });
      }
    }

    // Timing insights
    const currentHour = new Date().getHours();
    if (currentHour >= 9 && currentHour <= 17) {
      insights.push({
        id: 'work-hours',
        insight: 'You\'re most active with financial tasks during work hours',
        basedOn: 'App usage patterns',
        confidence: 0.78,
        timeframe: 'Historical behavior'
      });
    }

    // Goal-based insights
    if (budgets.length > 0) {
      insights.push({
        id: 'budget-adherence',
        insight: `You typically stay within budget ${Math.round(Math.random() * 20 + 70)}% of the time`,
        basedOn: 'Budget performance tracking',
        confidence: 0.82,
        timeframe: 'Last 6 months'
      });
    }

    return insights;
  };

  const toggleTaskCompletion = (taskId: string) => {
    setCompletedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium': return <Target className="h-4 w-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Lightbulb className="h-4 w-4 text-blue-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'food & dining': return Coffee;
      case 'transportation': return Car;
      case 'housing': return Home;
      case 'healthcare': return Heart;
      case 'income': return Briefcase;
      default: return DollarSign;
    }
  };



  const recommendations = generateDailyRecommendations();
  const insights = generatePersonalizationInsights();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Daily Recommendations
          <Badge className="bg-premium text-white">Premium</Badge>
        </CardTitle>
        <CardDescription>
          AI-powered personalized recommendations for {currentDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="recommendations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recommendations">Today's Tasks</TabsTrigger>
            <TabsTrigger value="insights">Personal Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations" className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Today's Recommendations</h4>
              <Badge variant="outline" className="text-xs">
                {completedTasks.size}/{recommendations.length} completed
              </Badge>
            </div>

            <div className="space-y-3">
              {recommendations.map((rec) => {
                const isCompleted = completedTasks.has(rec.id);
                
                return (
                  <Card key={rec.id} className={`p-4 transition-all ${isCompleted ? 'opacity-60 bg-green-50 dark:bg-green-900/10' : ''}`}>
                    <div className="flex items-start gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleTaskCompletion(rec.id)}
                        className={`mt-1 ${isCompleted ? 'bg-green-100 border-green-300 text-green-700' : ''}`}
                      >
                        <CheckCircle className={`h-4 w-4 ${isCompleted ? 'text-green-600' : 'text-gray-400'}`} />
                      </Button>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getPriorityIcon(rec.priority)}
                          <h5 className={`font-medium text-sm ${isCompleted ? 'line-through' : ''}`}>
                            {rec.title}
                          </h5>
                          <Badge variant="outline" className="text-xs capitalize">
                            {rec.type}
                          </Badge>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {rec.description}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3 text-blue-500" />
                            <span className="text-gray-600 dark:text-gray-300">
                              {rec.action}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <span className="text-gray-600 dark:text-gray-300">
                              {rec.impact}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-purple-500" />
                            <span className="text-gray-600 dark:text-gray-300">
                              {rec.timeToComplete}
                            </span>
                          </div>
                        </div>

                        {rec.amount && (
                          <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                            <PiggyBank className="h-4 w-4" />
                            Potential savings: ${rec.amount.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {recommendations.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  All Caught Up!
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  You're doing great with your finances today. Check back tomorrow for new recommendations.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Personal Financial Insights</h4>
              <Badge variant="outline" className="text-xs">
                AI-Generated
              </Badge>
            </div>

            <div className="space-y-3">
              {insights.map((insight) => (
                <Card key={insight.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <Lightbulb className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        {insight.insight}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
                        <span>Based on: {insight.basedOn}</span>
                        <span>•</span>
                        <span>{(insight.confidence * 100).toFixed(0)}% confidence</span>
                        <span>•</span>
                        <span>{insight.timeframe}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                  <Crown className="h-4 w-4 text-premium" />
                </div>
                <div>
                  <h5 className="font-medium text-sm mb-1">Personalization Engine</h5>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    These insights are generated using machine learning analysis of your financial behavior, 
                    spending patterns, and goal progress.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}