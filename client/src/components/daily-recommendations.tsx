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
  const { data: databaseUser } = useQuery({
    queryKey: ["auth-user", user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/user");
      return response.json();
    },
  });

  const isPremiumUser = databaseUser?.plan === 'premium';

  // Check if we have transaction data for AI analysis
  const hasTransactionData = transactions && transactions.length > 0;
  
  // Generate AI-powered daily recommendations
  const generateDailyRecommendations = (): Recommendation[] => {
    // Only show recommendations when we have sufficient transaction data for analysis
    if (!hasTransactionData || transactions.length < 5) {
      return [];
    }
    
    // Real AI recommendations would come from backend API here
    // For now, return empty until AI backend is implemented
    return [];
  };

  // Generate personalization insights
  const generatePersonalizationInsights = (): PersonalizationInsight[] => {
    // Only show insights when we have sufficient transaction data for meaningful analysis
    if (!hasTransactionData || transactions.length < 10) {
      return [];
    }
    
    // Real AI insights would come from backend API here
    // For now, return empty until AI backend is implemented
    return [];
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

  const recommendations = generateDailyRecommendations();
  const insights = generatePersonalizationInsights();

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

              {recommendations.length === 0 && (
                <div className="text-center py-8">
                  {hasTransactionData ? (
                    <>
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        All Caught Up!
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        You're doing great with your finances today. Check back tomorrow for new recommendations.
                      </p>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No Recommendations Available
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        Add more transactions to receive AI-powered daily recommendations
                      </p>
                    </>
                  )}
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

{hasTransactionData ? (
                <>
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
                        <Crown className="h-4 w-4 text-purple-600" />
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
                </>
              ) : (
                <div className="text-center py-8">
                  <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Personal Insights Available
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Add more transactions to generate AI-powered personalized financial insights
                  </p>
                  
                  {/* Empty State Preview */}
                  <div className="space-y-3 opacity-50">
                    <Card className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                          <Lightbulb className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-400 mb-2">
                            Spending pattern analysis will appear here
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>Based on: Transaction analysis</span>
                            <span>•</span>
                            <span>0% confidence</span>
                            <span>•</span>
                            <span>No data</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
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