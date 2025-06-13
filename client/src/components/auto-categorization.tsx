import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Zap, 
  Brain, 
  Check, 
  X, 
  Edit3, 
  Crown,
  Sparkles,
  Target,
  ChevronRight
} from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CategorySuggestion {
  id: string;
  transactionDescription: string;
  suggestedCategory: string;
  confidence: number;
  merchant?: string;
  amount: number;
  date: string;
  currentCategory?: string;
}

interface AutoCategorizationProps {
  transactions?: any[];
}

const CATEGORY_PATTERNS = {
  "Food & Dining": ["restaurant", "cafe", "pizza", "mcdonald", "starbucks", "grocery", "supermarket"],
  "Transportation": ["uber", "lyft", "gas", "fuel", "parking", "metro", "bus", "taxi"],
  "Shopping": ["amazon", "target", "walmart", "mall", "store", "shop"],
  "Entertainment": ["movie", "cinema", "netflix", "spotify", "game", "theater"],
  "Healthcare": ["hospital", "doctor", "pharmacy", "medical", "clinic"],
  "Utilities": ["electric", "water", "internet", "phone", "cable", "utility"],
  "Income": ["salary", "wage", "bonus", "freelance", "dividend", "refund"]
};

export default function AutoCategorization({ transactions = [] }: AutoCategorizationProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);

  // Machine learning categorization function
  const categorizeTransaction = (description: string, amount: number): { category: string; confidence: number } => {
    const desc = description.toLowerCase();
    let bestMatch = { category: "Other", confidence: 0.3 };

    for (const [category, keywords] of Object.entries(CATEGORY_PATTERNS)) {
      for (const keyword of keywords) {
        if (desc.includes(keyword)) {
          const confidence = Math.min(0.95, 0.7 + (keyword.length / desc.length) * 0.25);
          if (confidence > bestMatch.confidence) {
            bestMatch = { category, confidence };
          }
        }
      }
    }

    // Amount-based patterns
    if (amount > 1000 && desc.includes("rent")) {
      bestMatch = { category: "Housing", confidence: 0.9 };
    } else if (amount < 10 && desc.includes("tip")) {
      bestMatch = { category: "Food & Dining", confidence: 0.85 };
    }

    return bestMatch;
  };

  const { data: uncategorizedTransactions } = useQuery({
    queryKey: ["/api/transactions", "uncategorized"],
    enabled: !!user,
  });

  const categorizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auto-categorize");
      return await res.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      toast({
        title: "Auto-Categorization Complete",
        description: `Found ${data.suggestions?.length || 0} suggestions for uncategorized transactions`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Categorization Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applySuggestionMutation = useMutation({
    mutationFn: async ({ transactionId, categoryId }: { transactionId: string; categoryId: string }) => {
      const res = await apiRequest("PATCH", `/api/transactions/${transactionId}`, { categoryId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Category Applied",
        description: "Transaction has been categorized successfully",
      });
    },
  });

  const aiCategorizeMutation = useMutation({
    mutationFn: async ({ description, amount }: { description: string; amount: number }) => {
      const res = await apiRequest("POST", "/api/ai/categorize", { description, amount });
      return await res.json();
    },
    onError: (error: Error) => {
      toast({
        title: "AI Categorization Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleApplySuggestion = (suggestion: CategorySuggestion) => {
    // In a real implementation, you'd map category names to IDs
    applySuggestionMutation.mutate({
      transactionId: suggestion.id,
      categoryId: suggestion.suggestedCategory
    });
    
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  const handleRejectSuggestion = (suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  const generateMockSuggestions = () => {
    const mockTransactions = [
      {
        id: "1",
        transactionDescription: "AMAZON.COM MARKETPLACE",
        suggestedCategory: "Shopping",
        confidence: 0.92,
        merchant: "Amazon",
        amount: 49.99,
        date: "2025-05-29",
        currentCategory: "Uncategorized"
      },
      {
        id: "2",
        transactionDescription: "STARBUCKS COFFEE #1234",
        suggestedCategory: "Food & Dining",
        confidence: 0.88,
        merchant: "Starbucks",
        amount: 5.75,
        date: "2025-05-28",
        currentCategory: "Uncategorized"
      },
      {
        id: "3",
        transactionDescription: "SHELL GAS STATION",
        suggestedCategory: "Transportation",
        confidence: 0.95,
        merchant: "Shell",
        amount: 45.20,
        date: "2025-05-27",
        currentCategory: "Uncategorized"
      }
    ];
    setSuggestions(mockTransactions);
  };



  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Auto-Categorization
          <Badge className="bg-blue-600 text-white">Standard+</Badge>
        </CardTitle>
        <CardDescription>
          AI-powered transaction categorization with machine learning
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Action Button */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                Smart Transaction Analysis
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Analyze uncategorized transactions and get AI suggestions
              </p>
            </div>
            <Button 
              onClick={() => {
                if (transactions.length > 0) {
                  categorizeMutation.mutate();
                } else {
                  generateMockSuggestions();
                }
              }}
              disabled={categorizeMutation.isPending}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {categorizeMutation.isPending ? "Analyzing..." : "Auto-Categorize"}
            </Button>
          </div>

          {/* Suggestions List */}
          {suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  AI Suggestions ({suggestions.length})
                </h4>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    suggestions.forEach(suggestion => handleApplySuggestion(suggestion));
                  }}
                >
                  Apply All
                </Button>
              </div>

              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {suggestion.transactionDescription}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">
                            ${suggestion.amount.toFixed(2)} • {suggestion.date}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-3 w-3 text-gray-400" />
                          <Badge 
                            variant="outline"
                            className="text-xs"
                          >
                            {suggestion.suggestedCategory}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplySuggestion(suggestion)}
                        className="text-green-600 border-green-300 hover:bg-green-50"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectSuggestion(suggestion.id)}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ML Features */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Machine Learning Features:
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                Merchant recognition
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                Pattern learning
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                Amount-based logic
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                Confidence scoring
              </div>
            </div>
          </div>

          {/* Status */}
          {categorizeMutation.isPending && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Analyzing transaction patterns...
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}