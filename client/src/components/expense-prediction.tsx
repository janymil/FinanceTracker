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
  
  // AI-powered predictions state
  const [aiPredictions, setAiPredictions] = useState<{
    categoryPredictions: Prediction[];
    monthlyPredictions: MonthlyPrediction[];
    totalPredicted: number;
    confidence: number;
  }>({
    categoryPredictions: [],
    monthlyPredictions: [],
    totalPredicted: 0,
    confidence: 0
  });
  const [predictionsLoading, setPredictionsLoading] = useState(false);

  // Fetch AI predictions when component mounts or transactions change
  useEffect(() => {
    if (!isPremiumUser || !hasTransactionData || transactions.length < 3) return;

    const fetchAIPredictions = async () => {
      setPredictionsLoading(true);
      try {
        const token = await window.Clerk?.session?.getToken();
        const response = await fetch('/api/ai/expense-predictions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            transactions,
            summary
          })
        });

        if (response.ok) {
          const data = await response.json();
          setAiPredictions(data);
          console.log('AI expense predictions loaded:', data);
        } else {
          console.error('Failed to fetch AI predictions:', response.status);
        }
      } catch (error) {
        console.error('Error fetching AI predictions:', error);
      } finally {
        setPredictionsLoading(false);
      }
    };

    fetchAIPredictions();
  }, [isPremiumUser, transactions, summary]);

  // Use AI predictions if available, otherwise show empty state
  const predictions = aiPredictions.categoryPredictions;
  const monthlyPredictions = aiPredictions.monthlyPredictions;

  const totalPredicted = aiPredictions.totalPredicted || predictions.reduce((sum, p) => sum + p.predictedNext, 0);

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
              {predictionsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <span className="ml-2">Generating AI predictions...</span>
                </div>
              ) : hasTransactionData && predictions.length > 0 ? (
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
                        {aiPredictions.confidence ? (aiPredictions.confidence * 100).toFixed(0) : (predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length).toFixed(0)}%
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
                        {predictions.filter(p => p.trend === 'increasing').length > predictions.filter(p => p.trend === 'decreasing').length ? '+' : '-'}
                        {Math.abs(((totalPredicted - Math.abs(summary?.totalExpenses || 0)) / Math.abs(summary?.totalExpenses || 1)) * 100).toFixed(0)}%
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
                        <Tooltip 
                          formatter={(value: any, name) => [
                            `$${value.toLocaleString()}`,
                            name === 'predicted' ? 'Predicted' : 'Confidence'
                          ]}
                        />
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
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Prediction Data Available
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Add more transactions to generate AI-powered expense predictions
                  </p>
                  
                  {/* Empty State Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-50">
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-400">Next Month</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-400">$0</div>
                      <p className="text-xs text-gray-400">No data</p>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-400">Confidence</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-400">0%</div>
                      <p className="text-xs text-gray-400">No data</p>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-400">Trend</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-400">0%</div>
                      <p className="text-xs text-gray-400">No data</p>
                    </Card>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              {hasTransactionData && predictions.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Category Predictions</h4>
                    <Badge variant="outline" className="text-xs">
                      Next Month Forecast
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {predictions.slice(0, 8).map((prediction) => (
                  <Card key={prediction.category} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h5 className="font-medium text-sm">{prediction.category}</h5>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              prediction.trend === 'increasing' ? 'text-red-600' : 
                              prediction.trend === 'decreasing' ? 'text-green-600' : 
                              'text-gray-600'
                            }`}
                          >
                            {prediction.trend}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {(prediction.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          ${prediction.predictedNext.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          vs ${prediction.currentMonth.toLocaleString()} current
                        </div>
                      </div>
                    </div>

                    {prediction.factors.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Prediction factors:</p>
                        <div className="flex flex-wrap gap-1">
                          {prediction.factors.map((factor, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Category Data Available
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Add transactions to generate category-specific expense predictions
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              {hasTransactionData && monthlyPredictions.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Timeline Forecast</h4>
                    <Select value={predictionPeriod} onValueChange={(value: any) => setPredictionPeriod(value)}>
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

                  <Card className="p-4">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={monthlyPredictions.slice(0, predictionPeriod === '1m' ? 1 : predictionPeriod === '3m' ? 3 : 6)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: any) => [`$${value.toLocaleString()}`, 'Predicted Expenses']}
                        />
                        <Bar dataKey="predicted" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  <div className="grid gap-3">
                    {monthlyPredictions.slice(0, predictionPeriod === '1m' ? 1 : predictionPeriod === '3m' ? 3 : 6).map((month) => (
                      <div key={month.month} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                            <Clock className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <h5 className="font-medium text-sm">{month.month}</h5>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              {(month.confidence * 100).toFixed(0)}% confidence
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">${month.predicted.toLocaleString()}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300">predicted</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Timeline Data Available
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Add transactions to generate timeline expense predictions
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
              AI-powered expense predictions help you plan your budget with machine learning insights
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