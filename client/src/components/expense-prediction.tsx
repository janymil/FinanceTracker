import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Calendar, TrendingUp, AlertTriangle, BarChart3, Clock, Lock, Crown, Brain } from 'lucide-react';
import { Link } from 'wouter';
import { useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ExpensePredictionProps {
  transactions?: any[];
  summary?: any;
}

interface Prediction {
  category: string;
  currentMonth: number;
  predictedNext: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  factors: string[];
}

interface MonthlyPrediction {
  month: string;
  predicted: number;
  confidence: number;
  actual?: number;
}

export default function ExpensePrediction({ transactions = [], summary }: ExpensePredictionProps) {
  const [predictionPeriod, setPredictionPeriod] = useState('3m');
  const { isLoaded, isSignedIn, user } = useUser();
  const isReady = isLoaded && isSignedIn && !!user?.id;

  // Get user's plan from database
  const { data: databaseUser, isLoading } = useQuery({
    queryKey: ["auth-user", user?.id],
    enabled: isReady && !!user?.id,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/user");
      return response.json();
    },
  });

  // Check if user has premium plan
  const userPlan = databaseUser?.plan || 'free';
  const isPremiumUser = userPlan === 'premium';

  if (isLoading || !isReady) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Expense Prediction
          </CardTitle>
          <CardDescription>
            Machine learning predictions based on your spending patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if we have transaction data to base predictions on
  const hasTransactionData = transactions && transactions.length > 0;
  
  // No hardcoded data - empty arrays for predictions
  const predictions: Prediction[] = [];
  const monthlyPredictions: MonthlyPrediction[] = [];
  const totalPredicted = 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          AI Expense Prediction
        </CardTitle>
        <CardDescription>
          Machine learning predictions based on your spending patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPremiumUser ? (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="categories">By Category</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {hasTransactionData && predictions.length > 0 ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Next Month</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        ${totalPredicted.toLocaleString()}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Predicted total expenses
                      </p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Confidence</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        0%
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Average prediction accuracy
                      </p>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium">Trend</span>
                      </div>
                      <div className="text-2xl font-bold text-yellow-600">
                        0%
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        vs current month
                      </p>
                    </Card>
                  </div>

                  {/* Monthly Trend Chart */}
                  <Card className="p-4">
                    <h4 className="font-medium mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      6-Month Expense Forecast
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={monthlyPredictions}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="predicted" 
                          stroke="#8884d8" 
                          strokeWidth={2} 
                          dot={{ fill: '#8884d8' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    No Predictions Available
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Add more transactions to enable AI expense predictions
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="categories" className="space-y-6">
              {hasTransactionData && predictions.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Category Predictions</h4>
                    <Select value={predictionPeriod} onValueChange={setPredictionPeriod}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1m">1 Month</SelectItem>
                        <SelectItem value="3m">3 Months</SelectItem>
                        <SelectItem value="6m">6 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    {predictions.map((prediction, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium">{prediction.category}</h5>
                          <Badge variant={prediction.trend === 'increasing' ? 'destructive' : prediction.trend === 'decreasing' ? 'default' : 'secondary'}>
                            {prediction.trend}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-300">Current</p>
                            <p className="text-lg font-medium">${prediction.currentMonth}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-300">Predicted</p>
                            <p className="text-lg font-medium">${prediction.predictedNext}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-300">Confidence</p>
                            <p className="text-lg font-medium">{Math.round(prediction.confidence * 100)}%</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-900 dark:text-white">Prediction factors:</p>
                          <div className="flex flex-wrap gap-2">
                            {prediction.factors.map((factor, factorIndex) => (
                              <Badge key={factorIndex} variant="outline" className="text-xs">
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    No Category Data
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Add transactions across different categories to see predictions
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-6">
              {hasTransactionData && monthlyPredictions.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Timeline Forecast</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <Clock className="h-3 w-3" />
                      Next 6 months
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={monthlyPredictions}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="predicted" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {monthlyPredictions.slice(0, 3).map((month, index) => (
                      <Card key={index} className="p-4">
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{month.month}</p>
                          <p className="text-2xl font-bold text-purple-600 mt-2">${month.predicted.toLocaleString()}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            {Math.round(month.confidence * 100)}% confidence
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    No Timeline Data
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Add transaction history to generate timeline forecasts
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          // Non-premium users see upgrade prompt with semi-transparent overlay
          <div className="relative">
            {/* Background content with reduced opacity */}
            <div className="opacity-30 pointer-events-none">
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="categories">By Category</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Next Month</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">$--</div>
                      <p className="text-xs text-gray-600">Predicted total expenses</p>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Confidence</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600">--%</div>
                      <p className="text-xs text-gray-600">Average prediction accuracy</p>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium">Trend</span>
                      </div>
                      <div className="text-2xl font-bold text-yellow-600">--%</div>
                      <p className="text-xs text-gray-600">vs current month</p>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Centered upgrade prompt overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 rounded-lg">
              <div className="text-center p-6 max-w-sm">
                <Crown className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Premium Feature
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Unlock AI-powered expense predictions and machine learning insights with Premium
                </p>
                <Link href="/pricing">
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Premium
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}