import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Sparkles, RefreshCw, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  selectedMonth?: Date;
}

export default function AIFinancialTips({ summary, selectedMonth }: AIFinancialTipsProps) {
  const { user, isLoaded } = useAuth();
  const [currentTip, setCurrentTip] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clean AI text by removing markdown and formatting artifacts
  const cleanAIText = (text: string): string => {
    return text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/^\d+\.\s/gm, '')
      .replace(/^-\s/gm, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  };

  // Get current month context
  const getCurrentMonthContext = () => {
    const currentDate = selectedMonth || new Date();
    const monthName = currentDate.toLocaleString('en-US', { month: 'long' });
    const year = currentDate.getFullYear();
    return { monthName, year, currentDate };
  };

  // Check if user has sufficient transactions for AI tips
  const hasEnoughTransactions = () => {
    if (!summary) return false;
    const transactionCount = summary.transactionsByCategory.length;
    return transactionCount >= 3;
  };

  // Generate financial data payload for AI
  const generateFinancialData = () => {
    const { monthName, year } = getCurrentMonthContext();
    
    return {
      totalIncome: summary?.totalIncome || 0,
      totalExpenses: summary?.totalExpenses || 0,
      categories: summary?.transactionsByCategory || [],
      month: monthName,
      year: year,
      timestamp: Date.now()
    };
  };

  // Load cached tip from localStorage
  const loadCachedTip = () => {
    if (!user?.id) return null;
    
    const { monthName, year } = getCurrentMonthContext();
    const cacheKey = `ai-tip-${user.id}-${monthName}-${year}`;
    
    // Clear invalid May 2025 cache (only 2 transactions)
    if (monthName === 'May' && year === 2025) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return localStorage.getItem(cacheKey);
  };

  // Save tip to localStorage
  const saveTipToCache = (tip: string) => {
    if (!user?.id) return;
    
    const { monthName, year } = getCurrentMonthContext();
    const cacheKey = `ai-tip-${user.id}-${monthName}-${year}`;
    localStorage.setItem(cacheKey, tip);
  };

  // Generate new AI tip
  const generateTip = async (forceRefresh = false) => {
    if (!user?.id || !summary || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const financialData = generateFinancialData();
      
      const requestData = {
        financialData: {
          ...financialData,
          timestamp: forceRefresh ? Date.now() : undefined
        }
      };

      console.log('AI Tips: Generating for', financialData.month, financialData.year);

      const response = await fetch('/api/ai/tip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.tip || typeof data.tip !== 'string' || !data.tip.trim()) {
        throw new Error('Invalid response from AI service');
      }

      const cleanedTip = cleanAIText(data.tip);
      setCurrentTip(cleanedTip);
      saveTipToCache(cleanedTip);

    } catch (err) {
      console.error('AI Tips Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate AI tip');
    } finally {
      setIsGenerating(false);
    }
  };

  // Load cached tip on component mount
  useEffect(() => {
    if (!isLoaded || !user?.id || !summary) return;

    const cachedTip = loadCachedTip();
    
    if (cachedTip) {
      setCurrentTip(cleanAIText(cachedTip));
    } else if (hasEnoughTransactions()) {
      // Auto-generate if no cached tip and enough transactions
      generateTip();
    }
  }, [user?.id, summary, selectedMonth, isLoaded]);

  // Loading state
  if (!isLoaded || !user) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Personalized Financial Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Insufficient transactions
  if (!hasEnoughTransactions()) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Personalized Financial Tips
          </CardTitle>
          <CardDescription>AI-powered insights for your finances</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              Add more transactions to unlock personalized AI financial tips. You need at least 3 transactions to generate insights.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Personalized Financial Tips
        </CardTitle>
        <CardDescription>AI-powered insights for your finances</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isGenerating ? (
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-purple-500" />
              <span className="text-muted-foreground">Generating personalized insights...</span>
            </div>
          </div>
        ) : currentTip ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4 rounded-lg border">
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {currentTip}
              </p>
            </div>
            <Button 
              onClick={() => generateTip(true)} 
              variant="outline" 
              size="sm"
              disabled={isGenerating}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate New Tip
            </Button>
          </div>
        ) : (
          <div className="text-center p-4">
            <Button 
              onClick={() => generateTip()} 
              disabled={isGenerating}
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate AI Financial Tips
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}