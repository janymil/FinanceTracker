import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import RequirePlan from "./require-plan";
import { TrendingUp, Lightbulb, PieChart, Target, Sparkles } from "lucide-react";

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
  const { user } = useUser();
  const { toast } = useToast();
  const [currentTips, setCurrentTips] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Clean AI text by removing asterisks and formatting artifacts
  const cleanAIText = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#+\s*/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  };

  // Load saved tips from localStorage on component mount
  useEffect(() => {
    if (user?.id) {
      const savedTips = localStorage.getItem(`ai-tips-${user.id}`);
      if (savedTips) {
        try {
          const tips = JSON.parse(savedTips);
          setCurrentTips(Array.isArray(tips) ? tips : []);
        } catch {
          localStorage.removeItem(`ai-tips-${user.id}`);
        }
      }
    }
  }, [user?.id]);

  const generateTipsMutation = useMutation({
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
        throw new Error("Failed to generate AI tips");
      }

      const data = await response.json();
      if (!data.tips || !Array.isArray(data.tips)) {
        throw new Error("No tips received from AI");
      }

      return data.tips;
    },
    onMutate: () => {
      setIsGenerating(true);
    },
    onSuccess: (tips: any[]) => {
      setCurrentTips(tips);
      if (user?.id) {
        localStorage.setItem(`ai-tips-${user.id}`, JSON.stringify(tips));
      }
      toast({
        title: "AI Tips Generated",
        description: "4 personalized financial insights based on your data",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate AI tips. Please try again.",
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
          Get 4 personalized financial insights based on your spending patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RequirePlan plan="premium">
          <div className="space-y-4">
            {/* Generate Tips Button */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Personalized AI Analysis
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Generate 4 independent financial insights
                </p>
              </div>
              <Button 
                onClick={() => generateTipsMutation.mutate()}
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
                    Get AI Tips
                  </>
                )}
              </Button>
            </div>

            {/* Display 4 Independent Tips */}
            {currentTips.length > 0 && (
              <div className="space-y-4">
                {currentTips.map((tip, index) => {
                  const iconMap = {
                    'trending-chart': TrendingUp,
                    'lightbulb': Lightbulb,
                    'pie-chart': PieChart,
                    'target': Target
                  };
                  
                  const colorMap = {
                    'Spending Pattern Analysis': 'blue',
                    'Personalized Saving Recommendations': 'green',
                    'Budget Optimization Suggestions': 'purple',
                    'Advanced Financial Analysis': 'orange'
                  };
                  
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
                })}
              </div>
            )}

            {currentTips.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click "Get AI Tips" to generate 4 personalized financial insights</p>
              </div>
            )}
          </div>
        </RequirePlan>
      </CardContent>
    </Card>
  );
}