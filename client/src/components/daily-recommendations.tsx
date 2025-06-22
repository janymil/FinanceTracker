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
  Briefcase,
  Lock
} from 'lucide-react';
import { useLocation, Link } from 'wouter';
import { useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useCurrency } from '@/context/CurrencyContext';

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
  const { user } = useUser();
  const { currency } = useCurrency();

  // Get user's plan from database
  const { data: databaseUser, isLoading: userLoading } = useQuery({
    queryKey: ["auth-user", user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/user");
      return response.json();
    },
  });

  const isPremiumUser = databaseUser?.plan === 'premium';
  const isUserReady = !!user?.id && !userLoading && !!databaseUser;

  // Check if we have transaction data for AI analysis
  const hasTransactionData = transactions && transactions.length >= 3;
  
  // Enhanced debug logging
  useEffect(() => {
    console.log('Daily Recommendations Debug:', {
      userId: user?.id,
      isPremiumUser,
      hasTransactionData,
      transactionCount: transactions?.length,
      databaseUserPlan: databaseUser?.plan,
      databaseUserLoaded: !!databaseUser,
      isUserReady,
      userLoading,
      enabled: isUserReady && isPremiumUser && hasTransactionData,
      transactions: transactions?.slice(0, 3) // Show sample transactions
    });
  }, [user?.id, isPremiumUser, hasTransactionData, transactions?.length, databaseUser]);
  
  // Fetch AI recommendations from backend
  const { data: recommendationsData, isLoading: recommendationsLoading, error: recommendationsError } = useQuery({
    queryKey: ['daily-recommendations', user?.id, transactions?.length],
    enabled: isUserReady && isPremiumUser && hasTransactionData,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    queryFn: async () => {
      console.log('Making daily recommendations API call with data:', {
        transactionCount: transactions?.length,
        summaryExists: !!summary,
        budgetCount: budgets?.length
      });
      try {
        const response = await apiRequest('POST', '/api/ai/daily-recommendations', {
          transactions,
          summary,
          budgets
        });
        const data = await response.json();
        console.log('Daily recommendations response:', data);
        return data;
      } catch (error) {
        console.error('Failed to fetch daily recommendations:', error);
        throw error;
      }
    },
  });

  const recommendations = recommendationsData?.recommendations || [];
  const insights = recommendationsData?.insights || [];

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
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-600" />
          Daily Recommendations
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
        {isPremiumUser ? (
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

              {recommendationsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
                </div>
              ) : recommendationsError ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Failed to Load Recommendations
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Unable to generate daily recommendations. Please try again later.
                  </p>
                </div>
              ) : recommendations.length > 0 ? (
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
                              Potential savings: {currency}{rec.amount.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Recommendations Available
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {hasTransactionData 
                      ? "No recommendations available. Check back later for new suggestions." 
                      : "Add at least 3 transactions to receive AI-powered daily recommendations"
                    }
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

              {insights.length > 0 ? (
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
              ) : (
                <div className="text-center py-8">
                  <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Personal Insights Available
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {hasTransactionData 
                      ? "No insights available. Add more transaction data for personalized analysis." 
                      : "Add at least 3 transactions to generate AI-powered personalized financial insights"
                    }
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 px-6">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Premium Feature
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Get personalized daily recommendations and AI-powered financial insights
            </p>
            <Link href="/subscribe">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Premium
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}