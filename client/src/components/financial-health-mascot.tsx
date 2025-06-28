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
import { motion, AnimatePresence } from "framer-motion";
import RequirePlan from "./require-plan";

interface FinancialHealthData {
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  category: 'excellent' | 'good' | 'fair' | 'poor';
  insights: string[];
  achievements: string[];
  warnings: string[];
}

interface MascotState {
  emotion: 'happy' | 'neutral' | 'concerned' | 'excited' | 'sleeping';
  animation: 'idle' | 'celebrating' | 'thinking' | 'warning' | 'sleeping';
  message: string;
  color: string;
}

export default function FinancialHealthMascot() {
  const { isReady, user } = useClerkUserReady();
  const { t } = useTranslation();

  const mascotConfigs = {
    excellent: {
      emotion: 'excited' as const,
      animation: 'celebrating' as const,
      message: t('youreCrushingGoals'),
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300'
    },
    good: {
      emotion: 'happy' as const,
      animation: 'idle' as const,
      message: t('greatFinancialHabits'),
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300'
    },
    fair: {
      emotion: 'neutral' as const,
      animation: 'thinking' as const,
      message: t('youreOnTheRightTrack'),
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300'
    },
    poor: {
      emotion: 'concerned' as const,
      animation: 'warning' as const,
      message: t('letsWorkTogether'),
      color: 'text-red-600',
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
    queryKey: ["/api/financial-health", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/financial-health");
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 60) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

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
      feature="AI-Enhanced Financial Health Mascot"
      description="Get a personalized AI companion that analyzes your financial behavior and provides intelligent insights"
      benefits={[
        "AI-powered financial health analysis",
        "Personalized insights and recommendations",
        "Real-time emotional feedback based on spending patterns",
        "Achievement tracking and celebration",
        "Smart warnings and action items"
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
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('financialHealthAssistant')}
                </h3>
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
                {healthData.achievements?.length || 0} {t('achievements')}
              </p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <Target className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {healthData.insights?.length || 0} {t('insights')}
              </p>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {healthData.warnings?.length || 0} {t('alerts')}
              </p>
            </div>
          </div>

          {/* Toggle Details Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full"
          >
            {showDetails ? t('hideDetails') : t('showDetails')}
          </Button>

          {/* Detailed Information */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4"
              >
                {/* AI Financial Metrics */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg mb-4">
                  <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    AI Financial Analysis
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                        {healthData.score || 0}%
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">Health Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                        {healthData.insights?.length || 0}
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400">AI Insights</div>
                    </div>
                  </div>
                </div>

                {/* Tabbed Interface for AI Outputs */}
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview" className="text-xs">
                      <Crown className="h-3 w-3 mr-1" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="insights" className="text-xs">
                      <Brain className="h-3 w-3 mr-1" />
                      Insights
                    </TabsTrigger>
                    <TabsTrigger value="recommendations" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      Actions
                    </TabsTrigger>
                    <TabsTrigger value="achievements" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Strengths
                    </TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="mt-4 space-y-3">
                    <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 p-3 rounded-lg">
                      <h5 className="text-sm font-medium text-indigo-700 dark:text-indigo-400 mb-2">Quick Summary</h5>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white dark:bg-gray-800 p-2 rounded">
                          <div className="text-sm font-bold text-green-600">{healthData.achievements?.length || 0}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Strengths</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-2 rounded">
                          <div className="text-sm font-bold text-blue-600">{healthData.insights?.length || 0}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Insights</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-2 rounded">
                          <div className="text-sm font-bold text-amber-600">{healthData.warnings?.length || 0}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Actions</div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Achievements Tab */}
                  <TabsContent value="achievements" className="mt-4 space-y-3">
                    {healthData?.achievements && healthData.achievements.length > 0 ? (
                      <div className="space-y-2">
                        {healthData.achievements.map((achievement, index) => (
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
                                {achievement}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Crown className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">No achievements yet</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Keep building your financial habits!</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Insights Tab */}
                  <TabsContent value="insights" className="mt-4 space-y-3">
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
                                <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-3 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="h-4 w-4 text-red-600" />
                                    <span className="text-xs font-medium text-red-700 dark:text-red-400">Spending Patterns</span>
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
                                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                        <div className="text-red-600 dark:text-red-300 text-xs leading-relaxed">{insight}</div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Savings & Budget */}
                              {savingInsights.length > 0 && (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-3 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <PiggyBank className="h-4 w-4 text-green-600" />
                                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Savings & Budget</span>
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
                                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                        <div className="text-green-600 dark:text-green-300 text-xs leading-relaxed">{insight}</div>
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
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Trends & Patterns</span>
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
                                        <div className="text-blue-600 dark:text-blue-300 text-xs leading-relaxed">{insight}</div>
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
                                    <span className="text-xs font-medium text-purple-700 dark:text-purple-400">General Insights</span>
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
                                        <div className="text-purple-600 dark:text-purple-300 text-xs leading-relaxed">{insight}</div>
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
                        <p className="text-sm text-gray-600 dark:text-gray-400">No insights available</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Add more transactions to get AI insights</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Recommendations Tab */}
                  <TabsContent value="recommendations" className="mt-4 space-y-3">
                    {healthData?.warnings && healthData.warnings.length > 0 ? (
                      <div className="space-y-3">
                        {(() => {
                          // Categorize recommendations for better organization
                          const urgentItems = healthData.warnings.filter(warning => 
                            warning.toLowerCase().includes('urgent') || 
                            warning.toLowerCase().includes('critical') ||
                            warning.toLowerCase().includes('immediately')
                          );
                          const budgetItems = healthData.warnings.filter(warning => 
                            warning.toLowerCase().includes('budget') || 
                            warning.toLowerCase().includes('limit') ||
                            warning.toLowerCase().includes('overspend')
                          );
                          const improvementItems = healthData.warnings.filter(warning => 
                            warning.toLowerCase().includes('improve') || 
                            warning.toLowerCase().includes('consider') ||
                            warning.toLowerCase().includes('try')
                          );
                          const otherItems = healthData.warnings.filter(warning => 
                            !urgentItems.includes(warning) && 
                            !budgetItems.includes(warning) && 
                            !improvementItems.includes(warning)
                          );

                          return (
                            <>
                              {/* Urgent Actions */}
                              {urgentItems.length > 0 && (
                                <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                    <span className="text-xs font-semibold text-red-700 dark:text-red-400">🚨 Urgent Action Required</span>
                                  </div>
                                  <div className="space-y-2">
                                    {urgentItems.map((item, index) => (
                                      <motion.div
                                        key={`urgent-${index}`}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-white dark:bg-gray-800 p-2 rounded border-l-4 border-red-500"
                                      >
                                        <div className="text-xs text-red-800 dark:text-red-200 font-medium leading-relaxed">
                                          {item}
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Budget Alerts */}
                              {budgetItems.length > 0 && (
                                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Shield className="h-4 w-4 text-yellow-600" />
                                    <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">💰 Budget Management</span>
                                  </div>
                                  <div className="space-y-2">
                                    {budgetItems.map((item, index) => (
                                      <motion.div
                                        key={`budget-${index}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-white dark:bg-gray-800 p-2 rounded border-l-4 border-yellow-500"
                                      >
                                        <div className="text-xs text-yellow-800 dark:text-yellow-200 font-medium leading-relaxed">
                                          {item}
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Improvement Suggestions */}
                              {improvementItems.length > 0 && (
                                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Lightbulb className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">💡 Smart Suggestions</span>
                                  </div>
                                  <div className="space-y-2">
                                    {improvementItems.map((item, index) => (
                                      <motion.div
                                        key={`improvement-${index}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-white dark:bg-gray-800 p-2 rounded border-l-4 border-blue-500"
                                      >
                                        <div className="text-xs text-blue-800 dark:text-blue-200 font-medium leading-relaxed">
                                          {item}
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* General Recommendations */}
                              {otherItems.length > 0 && (
                                <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Target className="h-4 w-4 text-gray-600" />
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-400">📋 General Recommendations</span>
                                  </div>
                                  <div className="space-y-2">
                                    {otherItems.map((item, index) => (
                                      <motion.div
                                        key={`other-${index}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-white dark:bg-gray-800 p-2 rounded border-l-4 border-gray-500"
                                      >
                                        <div className="text-xs text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                                          {item}
                                        </div>
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
                        <Target className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">No recommendations available</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Your financial health looks good!</p>
                      </div>
                    )}
                  </TabsContent>

                </Tabs>

                {/* Premium AI Badge */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-3 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                      Powered by AI
                    </span>
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400">
                    Advanced financial analysis for Standard & Premium users
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </RequirePlan>
  );
}