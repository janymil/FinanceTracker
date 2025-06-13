import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Sparkles, RefreshCw, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentTip, setCurrentTip] = useState<string | null>(null);

  const generateTipMutation = useMutation({
    mutationFn: async () => {
      if (!summary) return null;
      
      const currentDate = new Date();
      const monthName = currentDate.toLocaleString('default', { month: 'long' });
      
      const response = await apiRequest("POST", "/api/ai/tip", {
        month: monthName,
        total: summary.totalExpenses,
        categories: summary.transactionsByCategory
          .filter(cat => cat.type === 'expense')
          .map(cat => ({
            name: cat.categoryName,
            amount: cat.amount
          }))
      });
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data?.tip) {
        setCurrentTip(data.tip);
        toast({
          title: "AI Tip Generated",
          description: "Your personalized financial tip is ready!",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate AI tip",
        variant: "destructive",
      });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI Financial Tips
          </div>
          <Badge variant="secondary" className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
            <Sparkles className="h-3 w-3 mr-1" />
            Premium AI
          </Badge>
        </CardTitle>
        <CardDescription>
          Get personalized financial advice based on your spending patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              disabled={generateTipMutation.isPending || !summary}
              className="flex items-center gap-2"
            >
              {generateTipMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              {generateTipMutation.isPending ? "Analyzing..." : "Get AI Tip"}
            </Button>
          </div>

          {/* Current Tip Display */}
          {currentTip && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    AI Recommendation
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                    {currentTip}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* No Data State */}
          {!summary && (
            <div className="text-center py-6">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mx-auto mb-3">
                <TrendingUp className="h-6 w-6 text-gray-400" />
              </div>
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
      </CardContent>
    </Card>
  );
}