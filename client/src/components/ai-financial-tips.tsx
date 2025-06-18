import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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

  // Load saved tip from localStorage on component mount
  useEffect(() => {
    if (user?.id) {
      const savedTip = localStorage.getItem(`ai-tip-${user.id}`);
      if (savedTip) {
        setCurrentTip(cleanAIText(savedTip));
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

  const generateTip = async () => {
    if (!summary) return;
    
    try {
      setIsGenerating(true);
      
      const currentDate = new Date();
      const monthName = currentDate.toLocaleString('default', { month: 'long' });
      
      const response = await apiRequest("POST", "/api/ai/tip", {
        body: JSON.stringify({
          financialData: {
            totalIncome: summary.totalIncome,
            totalExpenses: summary.totalExpenses,
            categories: summary.transactionsByCategory || [],
            month: monthName,
            year: currentDate.getFullYear(),
            timestamp: Date.now() // Force fresh generation
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.tip && data.tip.trim()) {
          setCurrentTip(data.tip);
          // Save to localStorage for persistence
          if (user?.id) {
            localStorage.setItem(`ai-tip-${user.id}`, data.tip);
          }
          toast({
            title: "AI Tip Generated",
            description: "New financial advice based on your spending data",
          });
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to generate AI tip. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate AI tip. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

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
                onClick={generateTip}
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
                {/* Parse the AI analysis into sections */}
                {(() => {
                  const analysisTitle = currentTip.match(/^([^:]+):/)?.[1] || "AI Financial Analysis";
                  const analysisContent = currentTip.replace(/^[^:]+:\s*/, '');
                  
                  // Split content into logical sections based on keywords
                  const sections = [];
                  const patterns = [
                    { title: "📊 Spending Pattern Analysis", keywords: ["spending pattern", "analysis", "breakdown", "percentage", "category", "expenses"], icon: TrendingUp },
                    { title: "💰 Personalized Saving Recommendations", keywords: ["saving", "recommend", "target", "reduction", "optimize", "monthly"], icon: Lightbulb },
                    { title: "📋 Budget Optimization Suggestions", keywords: ["budget", "allocation", "rebalancing", "guidelines", "financial", "benchmarks"], icon: GraduationCap },
                    { title: "🎯 Context-Aware Financial Advice", keywords: ["implement", "achieve", "strategic", "future", "investment", "opportunities", "timeline"], icon: Sparkles }
                  ];
                  
                  // Create grouped sections by collecting all content for each type
                  const groupedSections = {};
                  const sentences = analysisContent.split(/\.\s+/);
                  
                  // Initialize sections
                  patterns.forEach(pattern => {
                    groupedSections[pattern.title] = {
                      title: pattern.title,
                      content: [],
                      icon: pattern.icon
                    };
                  });
                  
                  // Add a default section for unmatched content
                  groupedSections[analysisTitle] = {
                    title: analysisTitle,
                    content: [],
                    icon: Lightbulb
                  };
                  
                  sentences.forEach((sentence) => {
                    if (sentence.trim()) {
                      const lowerSentence = sentence.toLowerCase();
                      
                      // Check if this sentence belongs to a specific analysis type
                      const matchedPattern = patterns.find(pattern => 
                        pattern.keywords.some(keyword => lowerSentence.includes(keyword))
                      );
                      
                      if (matchedPattern) {
                        groupedSections[matchedPattern.title].content.push(sentence + ".");
                      } else {
                        // Add to default section
                        groupedSections[analysisTitle].content.push(sentence + ".");
                      }
                    }
                  });
                  
                  // Convert to sections array, only including sections with content
                  Object.values(groupedSections).forEach(section => {
                    if (section.content.length > 0) {
                      sections.push({
                        title: section.title,
                        content: section.content.join(" "),
                        icon: section.icon
                      });
                    }
                  });
                  
                  // If no sections were created, create a single comprehensive section
                  if (sections.length === 0) {
                    sections.push({
                      title: analysisTitle,
                      content: analysisContent,
                      icon: Lightbulb
                    });
                  }
                  
                  return sections.map((section, index) => {
                    const IconComponent = section.icon;
                    return (
                      <div key={index} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                            <IconComponent className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                              {section.title}
                            </h4>
                            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
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