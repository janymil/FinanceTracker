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
  };
}

export default function AIFinancialTips({ summary }: AIFinancialTipsProps) {
  const { toast } = useToast();
  const [currentTip, setCurrentTip] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useUser();

  // Function to clean AI-generated text
  const cleanAIText = (text: string): string => {
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

  // Load saved tips from localStorage on component mount
  useEffect(() => {
    if (user?.id) {
      const savedTips = localStorage.getItem(`ai-tip-${user.id}`);
      if (savedTips) {
        try {
          JSON.parse(savedTips); // Validate JSON
          setCurrentTip(savedTips);
        } catch {
          // Clear invalid data
          localStorage.removeItem(`ai-tip-${user.id}`);
        }
      }
    }
  }, [user?.id]);

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

  // React Query mutation for generating tips
  const generateTipMutation = useMutation({
    mutationFn: async () => {
      if (!summary) throw new Error("No financial summary available");
      
      const currentDate = new Date();
      const monthName = currentDate.toLocaleString('default', { month: 'long' });
      
      const response = await apiRequest("POST", "/api/ai/tips", {
        body: JSON.stringify({
          financialData: {
            totalIncome: summary.totalIncome,
            totalExpenses: summary.totalExpenses,
            categories: summary.transactionsByCategory || [],
            month: monthName,
            year: currentDate.getFullYear(),
            timestamp: Date.now()
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error("Failed to generate AI tip");
      }

      const data = await response.json();
      if (!data.tips || !Array.isArray(data.tips) || data.tips.length === 0) {
        throw new Error("No tips received from AI");
      }

      return data.tips;
    },
    onMutate: () => {
      setIsGenerating(true);
    },
    onSuccess: (tips: any[]) => {
      const tipsData = JSON.stringify(tips);
      setCurrentTip(tipsData);
      if (user?.id) {
        localStorage.setItem(`ai-tip-${user.id}`, tipsData);
      }
      toast({
        title: "AI Tip Generated",
        description: "New financial advice based on your spending data",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate AI tip. Please try again.",
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

            {/* Current Tips Display */}
            {currentTip && (
              <div className="space-y-4">
                {/* Parse and display the 4 independent tips */}
                {(() => {
                  try {
                    const tips = JSON.parse(currentTip);
                    
                    // Icon mapping for each tip category
                    const iconMap = {
                      'trending-chart': TrendingUp,
                      'lightbulb': Lightbulb,
                      'pie-chart': PieChart,
                      'target': Target
                    };
                    
                    // Color mapping for each tip category
                    const colorMap = {
                      'Spending Pattern Analysis': 'blue',
                      'Personalized Saving Recommendations': 'green',
                      'Budget Optimization Suggestions': 'purple',
                      'Advanced Financial Analysis': 'orange'
                    };
                    
                    return tips.map((tip: any, index: number) => {
                      const IconComponent = iconMap[tip.icon as keyof typeof iconMap] || TrendingUp;
                      const color = colorMap[tip.title as keyof typeof colorMap] || 'blue';
                      
                      return (
                        <div key={index} className={`p-4 rounded-lg border-l-4 ${
                          color === 'blue' ? 'bg-blue-50 border-blue-400 dark:bg-blue-900/20' :
                          color === 'green' ? 'bg-green-50 border-green-400 dark:bg-green-900/20' :
                          color === 'purple' ? 'bg-purple-50 border-purple-400 dark:bg-purple-900/20' :
                          'bg-orange-50 border-orange-400 dark:bg-orange-900/20'
                        }`}>
                          <div className="flex items-start gap-3">
                            <IconComponent className={`h-5 w-5 mt-0.5 ${
                              color === 'blue' ? 'text-blue-600' :
                              color === 'green' ? 'text-green-600' :
                              color === 'purple' ? 'text-purple-600' :
                              'text-orange-600'
                            }`} />
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                                {tip.title}
                              </h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {cleanAIText(tip.description)}
                              </p>
                              {tip.estimatedSaving && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                  Potential savings: ${tip.estimatedSaving}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  } catch (error) {
                    // Fallback for old format or parsing errors
                    return (
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {cleanAIText(currentTip)}
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            )}

            {!currentTip && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click "Get AI Tip" to generate personalized financial advice</p>
              </div>
            )}
          </div>
        </RequirePlan>
      </CardContent>
    </Card>
  );
}
                      icon: GraduationCap, 
                      keywords: ["budget", "optimization", "income-to-expense", "ratio", "financial", "strategies", "protection", "realigning"],
                      color: "purple"
                    },
                    {
                      title: "🎯 Advanced Financial Analysis",
                      icon: Sparkles,
                      keywords: ["advanced", "analysis", "necessitates", "action", "focus", "balanced", "cash flow", "immediate"],
                      color: "orange"
                    }
                  ];

                  // Split content into sentences and paragraphs
                  const sentences = cleanedContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
                  const sections = [];

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
                      title: "📊 AI Financial Analysis",
                      icon: TrendingUp,
                      content: cleanAIText(cleanedContent),
                      color: "blue"
                    });
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
                      <div key={index} className={`p-4 bg-gradient-to-r ${colorClasses[section.color] || colorClasses.blue} rounded-lg border`}>
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