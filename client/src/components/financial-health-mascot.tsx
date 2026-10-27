import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Heart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lightbulb,
  Target,
  DollarSign,
  PiggyBank,
  Shield,
  Brain,
  Crown,
  Zap,
  Calendar,
  User,
  BarChart3,
  Meh,
  Smile,
  Frown,
  Star
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import RequirePlan from "./require-plan";
import { HelpTooltip } from "./help-tooltip";
import type { HealthFactorKey, HealthFactorStatus } from "@shared/financialHealth";

/** Label key per factor, so a strength is named without matching on translated text. */
const FACTOR_LABELS: Record<HealthFactorKey, string> = {
  spendingControl: 'financial_health.spending_control',
  savingsRate: 'financial_health.savings_rate',
  budgetAdherence: 'financial_health.budget_adherence',
  financialStability: 'financial_health.financial_stability',
};

/**
 * The insights tab groups sentences by topic, and a topic is not a verdict: "all seven budgets were
 * within their limits" and "spending exceeded the budgets" can sit in the same section. Painting
 * the section green or red therefore contradicts half its content — the old code painted anything
 * mentioning "expense" red, so good news arrived in the alarm colour.
 *
 * The panels stay neutral. The one precise claim is the factor status, shown as a dot beside the
 * section that matches it, and spelled out in full on the score card.
 */
const STATUS_DOT: Record<HealthFactorStatus, string> = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  fair: 'bg-yellow-500',
  needs_improvement: 'bg-red-500',
  not_measured: 'bg-gray-400',
};

const STATUS_RANK: Record<HealthFactorStatus, number> = {
  excellent: 0,
  good: 1,
  fair: 2,
  needs_improvement: 3,
  not_measured: 4,
};

// Helper function to translate AI factor names
const translateFactorName = (factorText: string, t: any): string => {
  // Map of English factor names to translation keys
  const factorTranslations: { [key: string]: string } = {
    'Budget Management': 'factors.budgetManagement',
    'Adaptive Spending Control': 'factors.adaptiveSpendingControl',
    'Expense Volatility': 'factors.expenseVolatility',
    'Financial Resilience': 'factors.financialResilience',
    'Savings Rate': 'factors.savingsRate',
    'Debt Management': 'factors.debtManagement',
    'Income Stability': 'factors.incomeStability',
    'Emergency Fund': 'factors.emergencyFund',
    'Investment Portfolio': 'factors.investmentPortfolio',
    'Risk Assessment': 'factors.riskAssessment',
    'Cash Flow': 'factors.cashFlow',
    'Financial Planning': 'factors.financialPlanning'
  };

  // Extract factor name and score from strings like "Improve Budget Management (5/15)"
  let translatedText = factorText;
  
  for (const [englishName, translationKey] of Object.entries(factorTranslations)) {
    if (factorText.includes(englishName)) {
      const translatedName = t(translationKey);
      translatedText = factorText.replace(englishName, translatedName);
      break;
    }
  }
  
  return translatedText;
};

type AdvicePriority = 'high' | 'medium' | 'low';

interface FinancialHealthData {
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  category: 'excellent' | 'good' | 'fair' | 'needs_improvement';
  /** The month in two sentences, from the adviser. */
  summary?: string;
  insights: string[];
  achievements: string[];
  /** Only the risk line now; the actions have their own, longer shape below. */
  warnings: string[];
  /** What to change, why, and what it frees up. */
  advice?: Array<{
    action: string;
    reason: string;
    impact: string;
    priority: AdvicePriority;
  }>;
  /** The four computed factors; the strengths tab and the section colours read these. */
  factors?: Array<{
    key: HealthFactorKey;
    score: number;
    max: number;
    status: HealthFactorStatus;
  }>;
}

interface FinancialHealthMascotProps {
  /**
   * The month the dashboard is showing. The assistant reads the same days as the score card —
   * without it, the two cards answered about different windows and could never agree.
   */
  startDate?: string;
  endDate?: string;
}

interface MascotState {
  emotion: 'happy' | 'neutral' | 'concerned' | 'excited' | 'sleeping';
  animation: 'idle' | 'celebrating' | 'thinking' | 'warning' | 'sleeping';
  message: string;
  color: string;
}

export default function FinancialHealthMascot({ startDate, endDate }: FinancialHealthMascotProps) {
  const { isReady, user } = useClerkUserReady();
  const { t } = useTranslation();

  const mascotConfigs = {
    excellent: {
      emotion: 'excited' as const,
      animation: 'celebrating' as const,
      message: t('youreCrushingGoals'),
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300'
    },
    good: {
      emotion: 'happy' as const,
      animation: 'idle' as const,
      message: t('greatFinancialHabits'),
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300'
    },
    fair: {
      emotion: 'neutral' as const,
      animation: 'thinking' as const,
      message: t('youreOnTheRightTrack'),
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300'
    },
    needs_improvement: {
      emotion: 'concerned' as const,
      animation: 'warning' as const,
      message: t('letsWorkTogether'),
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-300'
    }
  };
  const [mascotState, setMascotState] = useState<MascotState>({
    emotion: 'neutral',
    animation: 'idle',
    message: t('yourFinancialAssistantIsWakingUp'),
    color: 'text-gray-600'
  });
  const [showDetails, setShowDetails] = useState(false);

  const { data: healthData, isLoading } = useQuery<FinancialHealthData>({
    queryKey: ["/api/financial-health", user?.id, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const query = params.toString();
      const response = await apiRequest("GET", `/api/financial-health${query ? `?${query}` : ''}`);
      return response.json();
    },
    enabled: isReady && !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });



  useEffect(() => {
    if (healthData) {
      const config = mascotConfigs[healthData.category] || mascotConfigs.fair;
      setMascotState({
        emotion: config.emotion,
        animation: config.animation,
        message: config.message,
        color: config.color
      });
    }
  }, [healthData]);

  const MascotFace = ({ emotion, size = 'large' }: { emotion: string; size?: 'small' | 'large' }) => {
    const iconSize = size === 'large' ? 'h-16 w-16' : 'h-8 w-8';

    switch (emotion) {
      case 'excited':
        return <Star className={`${iconSize} text-yellow-500`} />;
      case 'happy':
        return <Smile className={`${iconSize} text-green-500`} />;
      case 'neutral':
        return <Meh className={`${iconSize} text-blue-500`} />;
      case 'concerned':
        return <Frown className={`${iconSize} text-red-500`} />;
      case 'sleeping':
        return <Heart className={`${iconSize} text-purple-500`} />;
      default:
        return <Smile className={`${iconSize} text-blue-500`} />;
    }
  };

  const getAnimationVariants = (animation: string) => {
    switch (animation) {
      case 'celebrating':
        return {
          animate: {
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0],
            transition: { duration: 2, repeat: Infinity, repeatType: "reverse" as const }
          }
        };
      case 'thinking':
        return {
          animate: {
            y: [0, -10, 0],
            transition: { duration: 2, repeat: Infinity, repeatType: "reverse" as const }
          }
        };
      case 'warning':
        return {
          animate: {
            x: [0, -5, 5, 0],
            transition: { duration: 0.5, repeat: Infinity, repeatType: "reverse" as const }
          }
        };
      case 'sleeping':
        return {
          animate: {
            scale: [1, 1.05, 1],
            transition: { duration: 3, repeat: Infinity, repeatType: "reverse" as const }
          }
        };
      default:
        return {
          animate: {
            y: [0, -2, 0],
            transition: { duration: 3, repeat: Infinity, repeatType: "reverse" as const }
          }
        };
    }
  };

  // 700-level: these are small labels on white or on a -100 tint, and the 600 shades sit below
  // the 4.5:1 AA floor for yellow (3.1:1) and green (3.3:1).
  // The thresholds are the ones the score card prints in its tooltip, so a score cannot be
  // "Good" here and "Fair" one card over.
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-700';
    if (score >= 65) return 'text-blue-700';
    if (score >= 50) return 'text-yellow-700';
    return 'text-red-700';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 65) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const factorStatus = (key: HealthFactorKey): HealthFactorStatus =>
    healthData?.factors?.find((factor) => factor.key === key)?.status ?? 'not_measured';

  const worstOf = (keys: HealthFactorKey[]): HealthFactorStatus =>
    keys
      .map(factorStatus)
      .sort((left, right) => STATUS_RANK[right] - STATUS_RANK[left])[0] ?? 'not_measured';

  const spendingDot = STATUS_DOT[factorStatus('spendingControl')];
  const savingDot = STATUS_DOT[worstOf(['savingsRate', 'budgetAdherence'])];

  /*
   * Strengths come from the computed factors, not from the model's reply.
   *
   * They used to read `factor.status` out of the AI answer, but the health-score prompt never asks
   * for a status — only name, score, max and a sentence — so the list was always empty and the tab
   * read "0 achievements" even on a month scored 83.
   */
  const strengths = (healthData?.factors ?? [])
    .filter((factor) => factor.status === 'excellent' || factor.status === 'good')
    .map((factor) => `${t(FACTOR_LABELS[factor.key])} (${factor.score}/${factor.max})`);

  /*
   * The advice, kept whole.
   *
   * It used to arrive as one string per recommendation and was then sorted into buckets by looking
   * for words like "budget" or "urgent" inside it - so an action could land under "Budget" for
   * mentioning the word, and its reason was dropped on the way. An action without its reason is a
   * command; the reason is what makes it worth following.
   */
  const advice = healthData?.advice ?? [];
  const riskNote = healthData?.warnings?.[0] ?? '';

  const priorityDot = (priority: AdvicePriority) =>
    priority === 'high' ? 'bg-red-500' : priority === 'low' ? 'bg-slate-400' : 'bg-amber-500';

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Zap className="h-12 w-12 text-blue-500" />
            </motion.div>
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-3">
            {t('yourFinancialAssistantIsWakingUp')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!healthData) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('addTransactionsToSeeMascot')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = mascotConfigs[healthData.category] || mascotConfigs.fair;

  return (
    <RequirePlan
      plan="standard"
      feature={t('mascot.requirePlan.feature')}
      description={t('mascot.requirePlan.description')}
      benefits={[
        t('mascot.requirePlan.benefits.aiAnalysis'),
        t('mascot.requirePlan.benefits.personalizedInsights'),
        t('mascot.requirePlan.benefits.emotionalFeedback'),
        t('mascot.requirePlan.benefits.achievementTracking'),
        t('mascot.requirePlan.benefits.smartWarnings')
      ]}
    >
      <Card className={`relative overflow-hidden transition-all duration-300 ${config?.borderColor || 'border-gray-300'} border-2`}>
        <CardContent className="p-6">
          {/* Mascot Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                {...getAnimationVariants(mascotState.animation)}
                className={`p-3 rounded-full ${config?.bgColor || 'bg-gray-100'}`}
              >
                <MascotFace emotion={mascotState.emotion} />
              </motion.div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {t('financialHealthAdvisor')}
                  </h3>
                  <HelpTooltip label={t('help.what_this_does')}>
                    {t('help.health_advisor')}
                  </HelpTooltip>
                </div>
                <Badge className={`${getScoreBadgeColor(healthData.score)} text-xs`}>
                  {healthData.score}/100
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {healthData.trend === 'improving' && (
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </motion.div>
              )}
              {healthData.trend === 'declining' && (
                <motion.div
                  animate={{ y: [0, 3, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </motion.div>
              )}
            </div>
          </div>

          {/* Mascot Message */}
          <div className={`p-4 rounded-lg ${config?.bgColor || 'bg-gray-100'} mb-4`}>
            <p className={`text-sm ${config?.color || 'text-gray-600'} text-center font-medium`}>
              {mascotState.message}
            </p>
          </div>

          {/* Health Score Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('healthScore')}
              </span>
              <span className={`text-sm font-bold ${getScoreColor(healthData.score)}`}>
                {healthData.score}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <motion.div
                className={`h-2 rounded-full ${
                  healthData.score >= 80 ? 'bg-green-500' :
                  healthData.score >= 60 ? 'bg-blue-500' :
                  healthData.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${healthData.score}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <CheckCircle className="h-4 w-4 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {strengths.length} {t('mascot.tabs.strengths')}
              </p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <Target className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {healthData.insights?.length || 0} {t('insights.count')}
              </p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {advice.length || healthData.warnings?.length || 0} {t('mascot.tabs.actions')}
              </p>
            </div>
          </div>

          {/* Details open in a dialog. Inline, the panel pushed the card out of its row and the
              recommendations ended up buried under four tabs, which is exactly the part people
              were meant to act on. */}
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                {t('showDetails')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('financialHealthAdvisor')}</DialogTitle>
                <DialogDescription>{t('help.health_advisor')}</DialogDescription>
              </DialogHeader>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* AI Financial Metrics */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg mb-4">
                  <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    {t('mascot.aiFinancialAnalysis')}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                        {healthData.score || 0}%
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">{t('mascot.healthScore')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                        {healthData.insights?.length || 0}
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400">{t('mascot.aiInsights')}</div>
                    </div>
                  </div>
                </div>

                {/* Tabbed Interface for AI Outputs */}
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview" className="text-xs">
                      <Crown className="h-3 w-3 mr-1" />
                      {t('mascot.tabs.overview')}
                    </TabsTrigger>
                    <TabsTrigger value="insights" className="text-xs">
                      <Brain className="h-3 w-3 mr-1" />
                      {t('mascot.tabs.insights')}
                    </TabsTrigger>
                    <TabsTrigger value="recommendations" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      {t('mascot.tabs.actions')}
                    </TabsTrigger>
                    <TabsTrigger value="achievements" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('mascot.tabs.strengths')}
                    </TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="mt-4 space-y-3">
                    <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 p-3 rounded-lg">
                      <h5 className="text-sm font-medium text-indigo-700 dark:text-indigo-400 mb-2">{t('mascot.quickSummary')}</h5>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white dark:bg-gray-800 p-2 rounded">
                          <div className="text-sm font-bold text-green-600">{strengths.length}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{t('mascot.tabs.strengths')}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-2 rounded">
                          <div className="text-sm font-bold text-blue-600">{healthData.insights?.length || 0}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{t('mascot.tabs.insights')}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-2 rounded">
                          <div className="text-sm font-bold text-amber-600">{advice.length || healthData.warnings?.length || 0}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{t('mascot.tabs.actions')}</div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Strengths Tab */}
                  <TabsContent value="achievements" className="mt-4 space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('mascot.strengthsHint')}
                    </p>
                    {strengths.length > 0 ? (
                      <div className="space-y-2">
                        {strengths.map((strength, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border-l-4 border-green-400"
                          >
                            <div className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <div className="text-xs text-green-800 dark:text-green-200 font-medium leading-relaxed">
                                {strength}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Crown className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('mascot.emptyStates.noAchievements')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{t('mascot.emptyStates.keepBuilding')}</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Insights Tab */}
                  <TabsContent value="insights" className="mt-4 space-y-3">
                    {healthData?.summary && (
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                        {healthData.summary}
                      </p>
                    )}
                    {healthData?.insights && healthData.insights.length > 0 ? (
                      <div className="space-y-3">
                        {(() => {
                          // Categorize insights for better grouping
                          const spendingInsights = healthData.insights.filter(insight => 
                            insight.toLowerCase().includes('spend') || 
                            insight.toLowerCase().includes('expense') ||
                            insight.toLowerCase().includes('cost')
                          );
                          const savingInsights = healthData.insights.filter(insight => 
                            insight.toLowerCase().includes('sav') || 
                            insight.toLowerCase().includes('budget') ||
                            insight.toLowerCase().includes('money')
                          );
                          const trendInsights = healthData.insights.filter(insight => 
                            insight.toLowerCase().includes('trend') || 
                            insight.toLowerCase().includes('pattern') ||
                            insight.toLowerCase().includes('increase') ||
                            insight.toLowerCase().includes('decrease')
                          );
                          const otherInsights = healthData.insights.filter(insight => 
                            !spendingInsights.includes(insight) && 
                            !savingInsights.includes(insight) && 
                            !trendInsights.includes(insight)
                          );

                          return (
                            <>
                              {/* Spending Patterns */}
                              {spendingInsights.length > 0 && (
                                <div className="bg-gradient-to-r from-slate-50 to-indigo-50 dark:from-slate-900/30 dark:to-indigo-900/20 p-3 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{t('mascot.categories.spendingPatterns')}</span>
                                    <span aria-hidden="true" className={`w-2 h-2 rounded-full ${spendingDot}`} />
                                  </div>
                                  <div className="space-y-2">
                                    {spendingInsights.map((insight, index) => (
                                      <motion.div
                                        key={`spending-${index}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex items-start gap-2"
                                      >
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                        <div className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{translateFactorName(insight, t)}</div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Savings & Budget */}
                              {savingInsights.length > 0 && (
                                <div className="bg-gradient-to-r from-slate-50 to-emerald-50 dark:from-slate-900/30 dark:to-emerald-900/20 p-3 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <PiggyBank className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{t('mascot.categories.savingsBudget')}</span>
                                    <span aria-hidden="true" className={`w-2 h-2 rounded-full ${savingDot}`} />
                                  </div>
                                  <div className="space-y-2">
                                    {savingInsights.map((insight, index) => (
                                      <motion.div
                                        key={`saving-${index}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex items-start gap-2"
                                      >
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                        <div className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{translateFactorName(insight, t)}</div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Trends & Patterns */}
                              {trendInsights.length > 0 && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <BarChart3 className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">{t('mascot.categories.trendsPatterns')}</span>
                                  </div>
                                  <div className="space-y-2">
                                    {trendInsights.map((insight, index) => (
                                      <motion.div
                                        key={`trend-${index}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex items-start gap-2"
                                      >
                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                        <div className="text-blue-600 dark:text-blue-300 text-xs leading-relaxed">{translateFactorName(insight, t)}</div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* General Insights */}
                              {otherInsights.length > 0 && (
                                <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 p-3 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Lightbulb className="h-4 w-4 text-purple-600" />
                                    <span className="text-xs font-medium text-purple-700 dark:text-purple-400">{t('mascot.categories.generalInsights')}</span>
                                  </div>
                                  <div className="space-y-2">
                                    {otherInsights.map((insight, index) => (
                                      <motion.div
                                        key={`other-${index}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex items-start gap-2"
                                      >
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                        <div className="text-purple-600 dark:text-purple-300 text-xs leading-relaxed">{translateFactorName(insight, t)}</div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Brain className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('mascot.emptyStates.noInsights')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{t('mascot.emptyStates.addTransactions')}</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Advice Tab: the change, the reason, and what it frees up */}
                  <TabsContent value="recommendations" className="mt-4 space-y-3">
                    {advice.length > 0 ? (
                      <div className="space-y-3">
                        {advice.map((item, index) => (
                          <motion.div
                            key={`advice-${index}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.08 }}
                            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                          >
                            <div className="flex items-start gap-2">
                              <span
                                aria-hidden="true"
                                className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${priorityDot(item.priority)}`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
                                  {item.action}
                                </p>
                                {item.reason && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                    {item.reason}
                                  </p>
                                )}
                                {item.impact && (
                                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-1">
                                    {item.impact}
                                  </p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}

                        {riskNote && (
                          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">{riskNote}</p>
                          </div>
                        )}
                      </div>
                    ) : healthData?.warnings && healthData.warnings.length > 0 ? (
                      /* A reply cached before the advice shape: show the lines rather than nothing. */
                      <div className="space-y-2">
                        {healthData.warnings.map((warning, index) => (
                          <div
                            key={`warning-${index}`}
                            className="bg-white dark:bg-gray-800 p-3 rounded-lg border-l-4 border-amber-500 text-xs text-gray-800 dark:text-gray-200 leading-relaxed"
                          >
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t('mascot.emptyStates.noRecommendations')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{t('mascot.emptyStates.addTransactions')}</p>
                      </div>
                    )}
                  </TabsContent>

                </Tabs>

                {/* Premium AI Badge */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-3 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                      {t('mascot.poweredByAI')}
                    </span>
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400">
                    {t('mascot.advancedAnalysis')}
                  </div>
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </RequirePlan>
  );
}