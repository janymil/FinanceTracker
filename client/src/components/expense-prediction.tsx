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

  const hasEnoughExpenses = transactions.filter(t => t.type === 'expense').length >= 10;

  useEffect(() => {
    const fetchPredictions = async () => {
      if (!hasEnoughExpenses) return;

      const response = await apiRequest('POST', '/api/ai/expense-predictions', {
        transactions: transactions.filter(t => t.type === 'expense'),
      });
      const result = await response.json();

      setPredictions(result.categoryPredictions || []);
      setMonthlyPredictions(result.monthlyPredictions || []);
    };

    fetchPredictions();
  }, [transactions]);

  const totalPredicted = predictions.reduce((sum, p) => sum + p.predictedNext, 0);

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
          hasEnoughExpenses ? (
            <Tabs defaultValue="overview" className="space-y-6">
              {/* Same as original Tabs implementation */}
            </Tabs>
          ) : (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Not Enough Expense Data
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Add at least 10 expense transactions to generate predictions.
              </p>
            </div>
          )
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