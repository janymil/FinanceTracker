import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@clerk/clerk-react";
import RequirePlan from "@/components/RequirePlan";

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

  // Function to render formatted AI text with proper markdown support
  const renderFormattedText = (text: string): JSX.Element => {
    // Split text by section headers (🎯, 📊, 💰, ⚖️)
    const sections = text.split(/(\*\*[📊💰⚖️🎯].*?\*\*)/).filter(Boolean);
    
    return (
      <div className="space-y-4">
        {sections.map((section, index) => {
          // Check if this is a header section
          if (section.match(/\*\*[📊💰⚖️🎯].*?\*\*/)) {
            const headerText = section.replace(/\*\*/g, '');
            const icon = headerText.charAt(0); // Extract emoji
            const title = headerText.substring(2); // Remove emoji and space
            
            return (
              <div key={index} className="mb-2">
                <h4 className="font-semibold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                  <span className="text-xl">{icon}</span>
                  {title}
                </h4>
              </div>
            );
          } else {
            // This is content - format with bullet points and bold text
            const formattedContent = section
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
              .replace(/• /g, '• ') // Preserve bullet points
              .replace(/\n/g, '<br>') // Line breaks
              .trim();
            
            if (formattedContent) {
              return (
                <div 
                  key={index} 
                  className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 mb-4 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formattedContent }}
                />
              );
            }
          }
          return null;
        })}
      </div>
    );
  };

  // Load saved tip from localStorage on component mount
  useEffect(() => {
    if (user?.id) {
      const savedTip = localStorage.getItem(`ai-tip-${user.id}`);
      if (savedTip) {
        setCurrentTip(savedTip);
      }
    }
  }, [user?.id]);

  // React Query mutation for generating tips
  const generateTipMutation = useMutation({
    mutationFn: async () => {
      if (!summary) throw new Error("No financial summary available");
      
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
      if (!data.tip || !data.tip.trim()) {
        throw new Error("No tip received from AI");
      }

      return data.tip;
    },
    onMutate: () => {
      setIsGenerating(true);
    },
    onSuccess: (tip: string) => {
      setCurrentTip(tip);
      if (user?.id) {
        localStorage.setItem(`ai-tip-${user.id}`, tip);
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

            {/* Current Tip Display */}
            {currentTip && (
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-lg border border-purple-200 dark:border-purple-700">
                {renderFormattedText(currentTip)}
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
                  Advanced financial insights
                </div>
              </div>
            </div>
          </div>
        </RequirePlan>
      </CardContent>
    </Card>
  );
}