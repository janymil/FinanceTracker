import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Heart, 
  AlertTriangle,
  CheckCircle,
  Zap,
  Target,
  Smile,
  Frown,
  Meh,
  Star,
  Crown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FinancialHealthData {
  score: number;
  status: string;
  color: string;
  factors?: string[];
  aiAnalysis?: {
    personalizedFactors?: string[];
    recommendations?: Array<{
      action: string;
      impact: string;
      priority: string;
    }>;
    riskAssessment?: string;
  };
}

interface MascotState {
  emotion: 'happy' | 'neutral' | 'concerned' | 'excited' | 'sleeping';
  animation: 'idle' | 'celebrating' | 'thinking' | 'warning' | 'sleeping';
  message: string;
  color: string;
}

const mascotConfigs = {
  excellent: {
    emotion: 'excited' as const,
    animation: 'celebrating' as const,
    message: "You're crushing your financial goals! 🎉",
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300'
  },
  good: {
    emotion: 'happy' as const,
    animation: 'idle' as const,
    message: "Great financial habits! Keep it up! 💪",
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300'
  },
  fair: {
    emotion: 'neutral' as const,
    animation: 'thinking' as const,
    message: "You're on the right track, but there's room to improve! 🤔",
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300'
  },
  poor: {
    emotion: 'concerned' as const,
    animation: 'warning' as const,
    message: "Let's work together to improve your financial health! 💡",
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300'
  }
};

export default function FinancialHealthMascot() {
  const { isReady, user } = useClerkUserReady();
  const [mascotState, setMascotState] = useState<MascotState>({
    emotion: 'neutral',
    animation: 'idle',
    message: 'Analyzing your financial health...',
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
  });



  useEffect(() => {
    if (healthData) {
      // Map status to category for mascot config
      const category = healthData.status?.toLowerCase().includes('excellent') ? 'excellent' :
                      healthData.status?.toLowerCase().includes('good') ? 'good' :
                      healthData.status?.toLowerCase().includes('fair') ? 'fair' : 'poor';
      
      const config = mascotConfigs[category] || mascotConfigs.fair;
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
            Your financial assistant is waking up...
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
              Add some transactions to see your financial health mascot!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Map status to category for mascot config
  const category = healthData.status?.toLowerCase().includes('excellent') ? 'excellent' :
                  healthData.status?.toLowerCase().includes('good') ? 'good' :
                  healthData.status?.toLowerCase().includes('fair') ? 'fair' : 'poor';
  
  const config = mascotConfigs[category] || mascotConfigs.fair;

  return (
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
                Financial Health Assistant
              </h3>
              <Badge className={`${getScoreBadgeColor(healthData.score)} text-xs`}>
                {healthData.score}/100
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {healthData.score >= 80 && (
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <TrendingUp className="h-5 w-5 text-green-500" />
              </motion.div>
            )}
            {healthData.score < 50 && (
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
              Health Score
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
              {healthData.factors?.length || 0} Factors
            </p>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <Target className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {healthData.aiAnalysis?.personalizedFactors?.length || 0} Insights
            </p>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {healthData.aiAnalysis?.recommendations?.length || 0} Tips
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
          {showDetails ? 'Hide Details' : 'Show Details'}
        </Button>

        {/* Detailed Information */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 space-y-3"
            >
              {/* Factors */}
              {healthData?.factors && healthData.factors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                    📊 Financial Factors
                  </h4>
                  <ul className="space-y-1">
                    {healthData.factors.map((factor, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2"
                      >
                        <Target className="h-3 w-3 text-green-500" />
                        {factor}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Insights */}
              {healthData?.aiAnalysis?.personalizedFactors && healthData.aiAnalysis.personalizedFactors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                    💡 AI Insights
                  </h4>
                  <ul className="space-y-1">
                    {healthData.aiAnalysis.personalizedFactors.map((factor, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2"
                      >
                        <Zap className="h-3 w-3 text-blue-500" />
                        {factor}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {healthData?.aiAnalysis?.recommendations && healthData.aiAnalysis.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-2">
                    🎯 Recommendations
                  </h4>
                  <ul className="space-y-1">
                    {healthData.aiAnalysis.recommendations.slice(0, 3).map((rec, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="text-xs text-gray-600 dark:text-gray-400"
                      >
                        <div className="flex items-start gap-2">
                          <Crown className="h-3 w-3 text-purple-500 mt-0.5" />
                          <div>
                            <span className="font-medium">{rec.action}</span>
                            <div className="text-xs text-gray-500">{rec.impact}</div>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risk Assessment */}
              {healthData?.aiAnalysis?.riskAssessment && (
                <div>
                  <h4 className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-2">
                    ⚠️ Risk Assessment
                  </h4>
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 text-orange-500 mt-0.5" />
                    {healthData.aiAnalysis.riskAssessment}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}