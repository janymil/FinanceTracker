import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Shield, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface FinancialHealthProps {
  summary?: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
  };
  budgets?: any[];
}

export default function FinancialHealthScore({ summary, budgets }: FinancialHealthProps) {
  const [useAIScore, setUseAIScore] = useState(false);
  const { isReady, user } = useClerkUserReady();

  // Get user's plan from database to determine if AI features should be enabled
  const { data: databaseUser } = useQuery({
    queryKey: ["auth-user", user?.id],
    enabled: isReady && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - plan doesn't change often
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/user");
      return response.json();
    },
  });

  // Enable AI score for standard and premium users
  useEffect(() => {
    if (databaseUser?.plan && ['standard', 'premium'].includes(databaseUser.plan)) {
      setUseAIScore(true);
    } else {
      setUseAIScore(false);
    }
  }, [databaseUser?.plan]);

  // Fetch AI-powered financial health score using React Query
  const aiScoreQuery = useQuery({
    queryKey: ['financial-health', user?.id, summary, budgets],
    enabled: isReady && useAIScore && !!user?.id && !!summary,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/financial-health");
      return response.json();
    },
  });

  const { data: aiScore, isLoading: aiScoreLoading } = aiScoreQuery;

  const calculateHealthScore = () => {
    if (!summary) return { score: 0, status: 'Loading...', color: 'gray' };

    // Return AI score if available and enabled
    if (useAIScore && aiScore) {
      return aiScore;
    }

    let score = 0;
    const factors = [];

    // Income vs Expenses ratio (30% weight)
    const incomeExpenseRatio = summary.totalIncome > 0 ? Math.abs(summary.totalExpenses) / summary.totalIncome : 0;
    if (incomeExpenseRatio <= 0.5) {
      score += 30;
      factors.push({ name: 'Spending Control', score: 30, max: 30, status: 'excellent' });
    } else if (incomeExpenseRatio <= 0.8) {
      score += 20;
      factors.push({ name: 'Spending Control', score: 20, max: 30, status: 'good' });
    } else {
      score += 10;
      factors.push({ name: 'Spending Control', score: 10, max: 30, status: 'needs improvement' });
    }

    // Savings rate (25% weight)
    const savingsRate = summary.totalIncome > 0 ? summary.netBalance / summary.totalIncome : 0;
    if (savingsRate >= 0.2) {
      score += 25;
      factors.push({ name: 'Savings Rate', score: 25, max: 25, status: 'excellent' });
    } else if (savingsRate >= 0.1) {
      score += 18;
      factors.push({ name: 'Savings Rate', score: 18, max: 25, status: 'good' });
    } else if (savingsRate >= 0) {
      score += 10;
      factors.push({ name: 'Savings Rate', score: 10, max: 25, status: 'fair' });
    } else {
      score += 0;
      factors.push({ name: 'Savings Rate', score: 0, max: 25, status: 'critical' });
    }

    // Budget adherence (25% weight)
    const totalBudget = budgets?.reduce((sum, budget) => sum + parseFloat(budget.amount), 0) || 0;
    const budgetUsage = totalBudget > 0 ? Math.abs(summary.totalExpenses) / totalBudget : 0;
    if (budgetUsage <= 0.8) {
      score += 25;
      factors.push({ name: 'Budget Adherence', score: 25, max: 25, status: 'excellent' });
    } else if (budgetUsage <= 1.0) {
      score += 18;
      factors.push({ name: 'Budget Adherence', score: 18, max: 25, status: 'good' });
    } else {
      score += 8;
      factors.push({ name: 'Budget Adherence', score: 8, max: 25, status: 'needs improvement' });
    }

    // Financial stability (20% weight)
    if (summary.netBalance > 0 && summary.totalIncome > Math.abs(summary.totalExpenses)) {
      score += 20;
      factors.push({ name: 'Financial Stability', score: 20, max: 20, status: 'excellent' });
    } else if (summary.netBalance >= 0) {
      score += 12;
      factors.push({ name: 'Financial Stability', score: 12, max: 20, status: 'good' });
    } else {
      score += 5;
      factors.push({ name: 'Financial Stability', score: 5, max: 20, status: 'needs attention' });
    }

    let status = 'Excellent';
    let color = 'green';
    let icon = CheckCircle;

    if (score >= 80) {
      status = 'Excellent';
      color = 'green';
      icon = CheckCircle;
    } else if (score >= 65) {
      status = 'Good';
      color = 'blue';
      icon = TrendingUp;
    } else if (score >= 50) {
      status = 'Fair';
      color = 'yellow';
      icon = Shield;
    } else {
      status = 'Needs Improvement';
      color = 'red';
      icon = AlertTriangle;
    }

    return { score: Math.round(score), status, color, factors, icon };
  };

  const healthData = calculateHealthScore();
  const StatusIcon = healthData.icon || CheckCircle;

  if (aiScoreLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (aiScoreQuery.error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="text-4xl text-gray-300 dark:text-gray-600 mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Unable to Load Health Score
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Please try again in a moment
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 text-${healthData.color}-600`} />
          Financial Health Score
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm p-4 text-sm">
                <div className="space-y-2">
                  <div className="font-semibold">How Your Financial Health Score is Calculated:</div>
                  {useAIScore ? (
                    <div>
                      <div className="text-blue-600 font-medium mb-2">🤖 AI-Powered Calculation</div>
                      <div>AI analyzes your spending patterns, seasonal trends, and financial behavior to provide a personalized score that adapts to your unique situation.</div>
                      <div className="mt-2">
                        <strong>AI considers:</strong> Transaction patterns, spending volatility, category preferences, seasonal adjustments, goal progress, and predictive factors.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <strong>Spending Control (30%):</strong> Compares your expenses to income. Lower expense ratio = higher score.
                      </div>
                      <div>
                        <strong>Savings Rate (25%):</strong> Measures how much you save. Aim for 10-20% of income.
                      </div>
                      <div>
                        <strong>Budget Adherence (25%):</strong> How well you stick to your budgets. Under budget = excellent.
                      </div>
                      <div>
                        <strong>Financial Stability (20%):</strong> Overall balance between income and expenses.
                      </div>
                    </>
                  )}
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <strong>Score Ranges:</strong><br />
                    80-100: Excellent | 65-79: Good | 50-64: Fair | Below 50: Needs Improvement
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            onClick={() => {
              if (!useAIScore && !aiScore) {
                aiScoreQuery.refetch();
              }
              setUseAIScore(!useAIScore);
            }}
            className={`ml-2 px-2 py-1 text-xs rounded-full transition-colors ${
              useAIScore 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
            title={useAIScore ? 'Switch to Standard Calculation' : 'Use AI-Powered Score'}
          >
            {useAIScore ? '🤖 AI' : 'AI'}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className={`text-4xl font-bold text-${healthData.color}-600 mb-2`}>
            {healthData.score}
          </div>
          <div className={`text-sm font-medium text-${healthData.color}-600`}>
            {healthData.status}
          </div>
          <Progress 
            value={healthData.score} 
            className="mt-3"
            style={{
              background: `linear-gradient(to right, ${
                healthData.color === 'green' ? '#10b981' :
                healthData.color === 'blue' ? '#3b82f6' :
                healthData.color === 'yellow' ? '#f59e0b' : '#ef4444'
              } 0%, ${
                healthData.color === 'green' ? '#10b981' :
                healthData.color === 'blue' ? '#3b82f6' :
                healthData.color === 'yellow' ? '#f59e0b' : '#ef4444'
              } ${healthData.score}%, #e5e7eb ${healthData.score}%)`
            }}
          />
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
            Score Breakdown:
          </h4>
          {(healthData.factors || []).map((factor, index) => (
            <div key={index} className="flex justify-between items-center text-xs">
              <span className="text-gray-600 dark:text-gray-400">{factor.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{factor.score}/{factor.max}</span>
                <div className={`w-2 h-2 rounded-full ${
                  factor.status === 'excellent' ? 'bg-green-500' :
                  factor.status === 'good' ? 'bg-blue-500' :
                  factor.status === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p className="font-medium">Recommendations:</p>
            {healthData.score < 80 && (
              <ul className="list-disc list-inside space-y-1 ml-2">
                {(healthData.factors || []).find(f => f.name === 'Spending Control' && f.score < 25) && (
                  <li>Review and reduce unnecessary expenses</li>
                )}
                {(healthData.factors || []).find(f => f.name === 'Savings Rate' && f.score < 20) && (
                  <li>Aim to save at least 10-20% of income</li>
                )}
                {(healthData.factors || []).find(f => f.name === 'Budget Adherence' && f.score < 20) && (
                  <li>Create and stick to monthly budgets</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}