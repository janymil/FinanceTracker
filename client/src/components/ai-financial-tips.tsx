import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles, TrendingUp, GraduationCap } from "lucide-react";
import { useUser } from '@clerk/clerk-react';

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
      id: number;
      amount: string;
      description: string;
      date: string;
      categoryName: string;
      type: string;
    }>;
  };
}

export default function AIFinancialTips({ summary }: AIFinancialTipsProps) {
  const { toast } = useToast();
  const [currentTip, setCurrentTip] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useUser();

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
    staleTime: 0,
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

  // Function to fetch detailed transactions for specific month/year
  const fetchDetailedTransactions = async (month: number, year: number) => {
    const response = await fetch(`/api/transactions/by-month?month=${month}&year=${year}`, {
      method: "GET",
      headers: {
        ...(await getAuthHeaders())
      }
    });
    const data = await response.json();
    return data.transactions || [];
  };

  async function getAuthHeaders(): Promise<Record<string, string>> {
    try {
      if (typeof window !== 'undefined' && window.Clerk?.session) {
        const token = await window.Clerk.session.getToken();
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
      }
    } catch (error) {
      console.warn('Failed to get Clerk token:', error);
    }
    return {};
  }

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
      const detailedTransactions = summary.recentTransactions || [];

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

      // Handle structured 4-section format from API
      if (data.sections && Array.isArray(data.sections) && data.sections.length === 4) {
        // New 4-section structured format
        const structuredSections = data.sections;
        setCurrentTip(JSON.stringify(structuredSections)); // Store as JSON for parsing
      } else if (data.tips && Array.isArray(data.tips) && data.tips.length > 0) {
        // Legacy structured format with detailed analysis
        const detailedTip = data.tips[0];
        const formattedTip = `**${detailedTip.title}**\n\n${detailedTip.description}`;
        tipContent = formattedTip;
        setCurrentTip(formattedTip);
      } else if (data.tip) {
        // Legacy format
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
        title: "AI Tip Generated",
        description: "New financial advice based on your spending data",
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
        title: "Error",
        description: error.message || "Failed to generate AI tip. Please try again.",
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
          AI Financial Tips
        </CardTitle>
        <CardDescription>
          Get personalized financial advice based on your spending patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RequirePlan plan="premium">
          <div className="space-y-4">
            {/* Generate Tip Button */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Personalized AI Analysis
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Generate insights based on your monthly spending data
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
                    Generating...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4" />
                    Get AI Tip
                  </>
                )}
              </Button>
            </div>

            {/* Current Tip Display */}
            {currentTip && (
              <div className="space-y-4">
                {/* Display complete AI analysis in 4 themed boxes */}
                {(() => {
                  try {
                    // Parse structured tips format (working system)
                    if (currentTip.includes('**') && currentTip.includes('\n\n')) {
                      // Parse: **Title**\n\nDescription format
                      const parts = currentTip.split('\n\n');
                      const title = parts[0]?.replace(/\*\*/g, '').trim() || 'AI Financial Analysis';
                      const fullDescription = parts.slice(1).join('\n\n').trim();
                      
                      // Split the complete analysis into 4 logical sections while preserving content
                      const sentences = fullDescription.split(/(?<=[.!?])\s+/);
                      const totalSentences = sentences.length;
                      const sentencesPerBox = Math.max(1, Math.floor(totalSentences / 4));
                      
                      const sections = [
                        {
                          title: "📊 Spending Pattern Analysis",
                          content: sentences.slice(0, sentencesPerBox).join(' '),
                          color: "blue",
                          icon: TrendingUp
                        },
                        {
                          title: "💡 Personalized Saving Recommendations", 
                          content: sentences.slice(sentencesPerBox, sentencesPerBox * 2).join(' '),
                          color: "green",
                          icon: Lightbulb
                        },
                        {
                          title: "🎓 Budget Optimization Suggestions",
                          content: sentences.slice(sentencesPerBox * 2, sentencesPerBox * 3).join(' '),
                          color: "purple", 
                          icon: GraduationCap
                        },
                        {
                          title: "✨ Advanced Financial Analysis",
                          content: sentences.slice(sentencesPerBox * 3).join(' '),
                          color: "orange",
                          icon: Sparkles
                        }
                      ];

                      const colorClasses = {
                        blue: "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700",
                        green: "from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700", 
                        purple: "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700",
                        orange: "from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700"
                      };

                      return sections.map((section, index) => {
                        const IconComponent = section.icon;
                        
                        return (
                          <div key={index} className={`p-4 bg-gradient-to-r ${colorClasses[section.color as keyof typeof colorClasses]} rounded-lg border`}>
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
                                  {cleanAIText(section.content)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    }

                    // Handle legacy structured format (array of tips with titles and descriptions)
                    if (currentTip.includes('**') && currentTip.includes('\n\n')) {
                      // Parse structured format: **Title**\n\nDescription
                      const parts = currentTip.split('\n\n');
                      const title = parts[0]?.replace(/\*\*/g, '').trim() || 'AI Financial Analysis';
                      const description = parts.slice(1).join('\n\n').trim();
                      
                      return (
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <Sparkles className="h-5 w-5 text-purple-600" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                                {title}
                              </h4>
                              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {cleanAIText(description)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Handle plain text format
                    return (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            <Lightbulb className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                              Personalized Financial Analysis
                            </h4>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                              {cleanAIText(currentTip)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  } catch (error) {
                    // Fallback for any parsing errors
                    return (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            <Lightbulb className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                              AI Financial Tips
                            </h4>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                              {cleanAIText(currentTip)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>
            )}

            {/* No Data Message */}
            {!summary && (
              <div className="text-center py-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  No Financial Data
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Add some transactions to get personalized AI tips
                </p>
              </div>
            )}

            {/* Features List */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                AI Analysis Features:
              </h4>
              <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  Spending pattern analysis
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  Personalized saving recommendations
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  Budget optimization suggestions
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  Context-aware financial advice
                </div>
              </div>
            </div>
          </div>
        </RequirePlan>
      </CardContent>
    </Card>
  );
}