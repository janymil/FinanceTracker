import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles, TrendingUp, GraduationCap } from "lucide-react";
import { useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import RequirePlan from "./require-plan";

interface AIFinancialTipsProps {
  summary?: {
    totalIncome: number;
    totalExpenses: number;
    transactionsByCategory: Array<{
      categoryName: string;
      amount: number;
      type: string;
    }>;
    recentTransactions?: Array<{
      description: string;
      amount: string;
      categoryName: string;
      type: string;
      date: string;
    }>;
  };
}

export default function AIFinancialTips({ summary }: AIFinancialTipsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [currentTip, setCurrentTip] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useUser();

  // Fetch cached AI tip from database using React Query
  const { data: cachedTipData } = useQuery({
    queryKey: ['ai-financial-tip', user?.id],
    enabled: !!user?.id,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours cache
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/ai/tip', {
        mode: 'fetch_cached',
        userId: user?.id
      });
      return response.json();
    },
  });

  // Load cached tip from database or localStorage
  useEffect(() => {
    if (user?.id) {
      // First try database cache
      if (cachedTipData?.tip && !currentTip) {
        setCurrentTip(cachedTipData.tip);
        // Also save to localStorage for immediate access
        localStorage.setItem(`ai-financial-tip-${user.id}`, cachedTipData.tip);
      } else {
        // Fallback to localStorage
        const cachedTip = localStorage.getItem(`ai-financial-tip-${user.id}`);
        if (cachedTip && !currentTip) {
          setCurrentTip(cachedTip);
        }
      }
    }
  }, [user?.id, cachedTipData]);

  // Save tip to localStorage whenever it changes
  useEffect(() => {
    if (currentTip && user?.id) {
      localStorage.setItem(`ai-financial-tip-${user.id}`, currentTip);
    }
  }, [currentTip, user?.id]);

  // Function to clean AI-generated text
  const cleanAIText = (text: string | undefined): string => {
    if (!text || typeof text !== 'string') {
      return 'No content available';
    }
    return text
      // Remove asterisks used for emphasis
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      // Remove AI generation notes and system messages
      .replace(/Note:|Important:|Remember:|Disclaimer:|Please note:|Keep in mind:/gi, '')
      // Remove markdown-style formatting
      .replace(/#{1,6}\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove extra whitespace and clean up
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  };

  // Cache system removed - no localStorage loading

  // Get user's plan from database
  const { data: databaseUser } = useQuery({
    queryKey: ["auth-user", user?.id],
    enabled: !!user?.id,
    // AI output is cached server-side too; asking for it again on every mount paid twice.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/user");
      return response.json();
    },
  });

  console.log('AI Tips: Component state:', {
    hasUser: !!user,
    userPlan: databaseUser?.plan,
    hasSummary: !!summary,
    summaryIncome: summary?.totalIncome,
    summaryExpenses: summary?.totalExpenses
  });





  // React Query mutation for generating tips
  const generateTipMutation = useMutation({
    mutationFn: async () => {
      if (!summary) throw new Error("No financial summary available");

      const currentDate = new Date();
      const monthName = currentDate.toLocaleString('default', { month: 'long' });
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      // Fetch detailed transactions for current month
      // Get detailed transactions for current month using summary data
      const detailedTransactions = summary?.recentTransactions || [];

      // Remove blocking validation - let AI decide if data is sufficient

      // Direct fetch to avoid GET/HEAD method issues
      const token = await window.Clerk?.session?.getToken();
      const response = await fetch("/api/ai/tip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({
          financialData: {
            totalIncome: summary.totalIncome,
            totalExpenses: summary.totalExpenses,
            categories: summary.transactionsByCategory,
            transactions: detailedTransactions,
            month: monthName,
            year: year,
            timestamp: Date.now()
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      const data = await response.json();

      let tipContent = '';

      // Handle both new 4-section structured format and legacy formats
      if (data.tips && Array.isArray(data.tips) && data.tips.length === 4) {
        // New 4-section structured format - store the sections directly
        const structuredData = JSON.stringify({ sections: data.tips });
        setCurrentTip(structuredData);
        tipContent = structuredData;
        console.log('4-section format detected:', data.tips);
      } else if (data.tips && Array.isArray(data.tips) && data.tips.length > 0) {
        // Legacy structured format with detailed analysis
        const detailedTip = data.tips[0];
        const formattedTip = `**${detailedTip.title}**\n\n${detailedTip.description}`;
        tipContent = formattedTip;
        setCurrentTip(formattedTip);
      } else if (data.tip) {
        // Legacy single tip format
        tipContent = data.tip;
        setCurrentTip(data.tip);
      } else {
        // Fallback
        tipContent = 'Unable to generate tip at this time.';
        setCurrentTip(tipContent);
      }

      return cleanAIText(tipContent);
    },
    onMutate: () => {
      setIsGenerating(true);
    },
    onSuccess: (cleanedTip: string) => {
      setCurrentTip(cleanedTip);
      // Cache system removed
      toast({
        title: t('aiTipGenerated'),
        description: t('newFinancialAdviceGenerated'),
      });
    },
    onError: (error: any) => {
      console.error('AI Tips: Mutation error details:', {
        error: error,
        message: error?.message,
        stack: error?.stack,
        cause: error?.cause
      });
      toast({
        title: t('error'),
        description: error.message || t('failedToGenerateAITip'),
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGenerating(false);
    }
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          {t('aiFinancialTips')}
        </CardTitle>
        <CardDescription>
          {t('getPersonalizedFinancialAdvice')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RequirePlan plan="premium">
          <div className="space-y-4">
            {/* Generate Tip Button */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('personalizedAIAnalysis')}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('generateInsightsBasedOnSpendingData')}
                </p>
              </div>
              <Button 
                onClick={() => generateTipMutation.mutate()}
                disabled={!summary || isGenerating}
                className="flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4" />
                    {t('getAITip')}
                  </>
                )}
              </Button>
            </div>

            {/* Current Tip Display */}
            {currentTip && (
              <div className="space-y-4">
                {/* Parse the AI analysis into sections */}
                {(() => {
                  let sections: any[] = [];

                  // Check if this is the new 4-section structured format
                  try {
                    const parsedData = JSON.parse(currentTip);
                    if (parsedData.sections && Array.isArray(parsedData.sections) && parsedData.sections.length === 4) {
                      // Use the structured sections from the AI processor  
                      sections = parsedData.sections.map((section: any, index: number) => {
                        const iconMap = [TrendingUp, Lightbulb, GraduationCap, Sparkles];
                        const emojis = ['📊', '💡', '📋', '🎯'];
                        return {
                          title: `${emojis[index]} ${section.title || t('aiAnalysisSection')}`,
                          icon: iconMap[index] || TrendingUp,
                          content: cleanAIText(section.content || section.description || t('analysisInProgress')),
                          color: section.color || ['blue', 'green', 'purple', 'orange'][index]
                        };
                      });
                    }
                  } catch (e) {
                    // Not JSON, continue with legacy parsing
                  }

                  // Legacy parsing for non-structured responses
                  if (sections.length === 0) {
                    const cleanedContent = currentTip;

                    // Define the 4 thematic sections with their patterns
                    const sectionPatterns = [
                      {
                        title: t('spendingPatternAnalysisTitle'),
                        icon: TrendingUp,
                        keywords: ["spending", "pattern", "analysis", "breakdown", "category", "expenses", "mathematical", "reveals", "bulk"],
                        color: "blue"
                      },
                      {
                        title: t('personalizedSavingRecommendationsTitle'), 
                        icon: Lightbulb,
                        keywords: ["saving", "recommend", "rebalancing", "budget", "limiting", "redirect", "sustainable", "implementation"],
                        color: "green"
                      },
                      {
                        title: t('budgetOptimizationSuggestionsTitle'),
                        icon: GraduationCap, 
                        keywords: ["budget", "optimization", "income-to-expense", "ratio", "financial", "strategies", "protection", "realigning"],
                        color: "purple"
                      },
                      {
                        title: t('advancedFinancialAnalysisTitle'),
                        icon: Sparkles,
                        keywords: ["advanced", "analysis", "necessitates", "action", "focus", "balanced", "cash flow", "immediate"],
                        color: "orange"
                      }
                    ];

                    // Split content into sentences and paragraphs
                    const sentences = cleanedContent.split(/[.!?]+/).filter(s => s.trim().length > 10);

                    // Try to match sentences to sections based on keywords
                    sectionPatterns.forEach(pattern => {
                      const matchedSentences = sentences.filter(sentence => {
                        const lowerSentence = sentence.toLowerCase();
                        return pattern.keywords.some(keyword => lowerSentence.includes(keyword.toLowerCase()));
                      });

                      if (matchedSentences.length > 0) {
                        sections.push({
                          ...pattern,
                          content: cleanAIText(matchedSentences.join('. ').trim() + '.')
                        });

                        // Remove matched sentences from the pool
                        matchedSentences.forEach(matched => {
                          const index = sentences.indexOf(matched);
                          if (index > -1) sentences.splice(index, 1);
                        });
                      }
                    });

                    // If we have remaining sentences or didn't get 4 sections, distribute them
                    if (sentences.length > 0 || sections.length < 4) {
                      const remainingText = sentences.join('. ').trim();

                      // If we have less than 4 sections, add the remaining patterns with remaining content
                      const missingSections = sectionPatterns.filter(pattern => 
                        !sections.some(section => section.title === pattern.title)
                      );

                      if (remainingText && missingSections.length > 0) {
                        // Split remaining text evenly among missing sections
                        const chunks = remainingText.split(/(?:[.!?]+\s+)/).filter(chunk => chunk.trim());
                        missingSections.forEach((pattern, index) => {
                          const chunkStart = Math.floor((chunks.length / missingSections.length) * index);
                          const chunkEnd = Math.floor((chunks.length / missingSections.length) * (index + 1));
                          const content = chunks.slice(chunkStart, chunkEnd).join('. ').trim();

                          if (content) {
                            sections.push({
                              ...pattern,
                              content: cleanAIText(content + '.')
                            });
                          }
                        });
                      }
                    }

                    // Ensure we have at least one section
                    if (sections.length === 0) {
                      sections.push({
                        title: t('aiFinancialAnalysis'),
                        icon: TrendingUp,
                        content: cleanAIText(cleanedContent),
                        color: "blue"
                      });
                    }
                  }

                  return sections.map((section, index) => {
                    const IconComponent = section.icon;
                    const colorClasses = {
                      blue: "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700",
                      green: "from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700", 
                      purple: "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700",
                      orange: "from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700"
                    };

                    return (
                      <div key={index} className={`p-4 bg-gradient-to-r ${colorClasses[section.color as keyof typeof colorClasses] || colorClasses.blue} rounded-lg border`}>
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${
                            section.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900' :
                            section.color === 'green' ? 'bg-green-100 dark:bg-green-900' :
                            section.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900' :
                            'bg-orange-100 dark:bg-orange-900'
                          }`}>
                            <IconComponent className={`h-4 w-4 ${
                              section.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                              section.color === 'green' ? 'text-green-600 dark:text-green-400' :
                              section.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                              'text-orange-600 dark:text-orange-400'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h4 className={`font-medium mb-2 ${
                              section.color === 'blue' ? 'text-blue-900 dark:text-blue-100' :
                              section.color === 'green' ? 'text-green-900 dark:text-green-100' :
                              section.color === 'purple' ? 'text-purple-900 dark:text-purple-100' :
                              'text-orange-900 dark:text-orange-100'
                            }`}>
                              {section.title}
                            </h4>
                            <p className={`text-sm leading-relaxed ${
                              section.color === 'blue' ? 'text-blue-800 dark:text-blue-200' :
                              section.color === 'green' ? 'text-green-800 dark:text-green-200' :
                              section.color === 'purple' ? 'text-purple-800 dark:text-purple-200' :
                              'text-orange-800 dark:text-orange-200'
                            }`}>
                              {section.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* No Data Message */}
            {!summary && (
              <div className="text-center py-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {t('noFinancialData')}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('addTransactionsForAITips')}
                </p>
              </div>
            )}

            {/* Features List */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                {t('aiAnalysisFeatures')}
              </h4>
              <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  {t('spendingPatternAnalysis')}
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  {t('personalizedSavingRecommendations')}
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  {t('budgetOptimizationSuggestions')}
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  {t('contextAwareFinancialAdvice')}
                </div>
              </div>
            </div>
          </div>
        </RequirePlan>
      </CardContent>
    </Card>
  );
}