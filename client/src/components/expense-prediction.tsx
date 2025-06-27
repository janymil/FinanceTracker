import { useEffect, useState } from 'react';
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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [predictionPeriod, setPredictionPeriod] = useState('3m');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [monthlyPredictions, setMonthlyPredictions] = useState<MonthlyPrediction[]>([]);

  const { isLoaded, isSignedIn, user } = useUser();
  const isReady = isLoaded && isSignedIn && !!user?.id;

  const { data: databaseUser, isLoading } = useQuery({
    queryKey: ['auth-user', user?.id],
    enabled: isReady,
    staleTime: 0,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/auth/user');
      return response.json();
    },
  });

  const userPlan = databaseUser?.plan || 'free';
  const isPremiumUser = userPlan === 'premium';

  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const hasTransactionData = expenseTransactions.length >= 3;

  // Use React Query for predictions with premium check and caching
  const { data: predictionsData, isLoading: predictionsLoading, error: predictionsError } = useQuery({
    queryKey: ['expense-predictions', user?.id, expenseTransactions.length],
    enabled: isReady && isPremiumUser, // Let AI decide if data is sufficient
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    queryFn: async () => {
      try {
        const response = await apiRequest('POST', '/api/ai/expense-predictions', {
          transactions: expenseTransactions,
        });
        return response.json();
      } catch (error) {
        console.error('Failed to fetch expense predictions:', error);
        throw error;
      }
    },
  });

  useEffect(() => {
    if (predictionsData) {
      setPredictions(predictionsData.categoryPredictions || []);
      setMonthlyPredictions(predictionsData.monthlyPredictions || []);
    }
  }, [predictionsData]);

  const totalPredicted = predictions.reduce((sum, p) => sum + p.predictedNext, 0);

  if (isLoading || !isReady) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            {t('AI Expense Prediction')}
          </CardTitle>
          <CardDescription>
            {t('Machine learning predictions based on your spending patterns')}
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

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          {t('AI Expense Prediction')}
        </CardTitle>
        <CardDescription>
          {t('Machine learning predictions based on your spending patterns')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPremiumUser ? (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">{t('Overview')}</TabsTrigger>
              <TabsTrigger value="categories">{t('By Category')}</TabsTrigger>
              <TabsTrigger value="timeline">{t('Timeline')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {predictionsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : predictionsError ? (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {t('Prediction Error')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {t('Failed to generate predictions. Please try again later.')}
                  </p>
                </div>
              ) : hasTransactionData && predictions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">{t('Next Month')}</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      ${totalPredicted.toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('Predicted total expenses')}</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">{t('Confidence')}</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length * 100).toFixed(0)}%
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('Average prediction accuracy')}</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium">{t('Trend')}</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {predictions.filter(p => p.trend === 'increasing').length > predictions.filter(p => p.trend === 'decreasing').length ? '+' : '-'}
                      {Math.abs(((totalPredicted - Math.abs(summary?.totalExpenses || 0)) / Math.abs(summary?.totalExpenses || 1)) * 100).toFixed(0)}%
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('vs current month')}</p>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {t('No Prediction Data Available')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {t('Add more transactions to generate AI-powered expense predictions')}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              {hasTransactionData && predictions.length > 0 ? (
                <div className="space-y-3">
                  {predictions.slice(0, 8).map((prediction) => (
                    <Card key={prediction.category} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h5 className="font-medium text-sm">{prediction.category}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${prediction.trend === 'increasing' ? 'text-red-600' : prediction.trend === 'decreasing' ? 'text-green-600' : 'text-gray-600'}`}>{t(prediction.trend)}</Badge>
                            <Badge variant="outline" className="text-xs">{(prediction.confidence * 100).toFixed(0)}% {t('confidence')}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">${prediction.predictedNext.toLocaleString()}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300">{t('vs')} ${prediction.currentMonth.toLocaleString()} {t('current')}</div>
                        </div>
                      </div>
                      {prediction.factors.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">{t('Prediction factors')}:</p>
                          <div className="flex flex-wrap gap-1">
                            {prediction.factors.map((factor, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">{factor}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('No Category Data Available')}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{t('Add transactions to generate category-specific expense predictions')}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              {hasTransactionData && monthlyPredictions.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{t('Timeline Forecast')}</h4>
                    <Select value={predictionPeriod} onValueChange={(value: any) => setPredictionPeriod(value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1m">{t('1 Month')}</SelectItem>
                        <SelectItem value="3m">{t('3 Months')}</SelectItem>
                        <SelectItem value="6m">{t('6 Months')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Card className="p-4">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={monthlyPredictions.slice(0, predictionPeriod === '1m' ? 1 : predictionPeriod === '3m' ? 3 : 6)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, t('Predicted Expenses')]} />
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
                            <p className="text-xs text-gray-600 dark:text-gray-300">{(month.confidence * 100).toFixed(0)}% {t('confidence')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">${month.predicted.toLocaleString()}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300">{t('predicted')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('No Timeline Data Available')}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{t('Add transactions to generate timeline expense predictions')}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 px-6">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('Premium Feature')}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{t('AI-powered expense predictions help you plan your budget with machine learning insights')}</p>
            <Link href="/subscribe">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                <Crown className="h-4 w-4 mr-2" />
                {t('Upgrade to Premium')}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
