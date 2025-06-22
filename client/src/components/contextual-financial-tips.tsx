'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingDown, PiggyBank, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';

interface ContextualTipsProps {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    transactionsByCategory: Array<{
      categoryName: string;
      amount: number;
      type: string;
    }>;
  };
  transactions: any[];
  budgets: any[];
  selectedMonth: string; // e.g. '2025-06'
}

interface FinancialTip {
  id: string;
  title: string;
  description: string;
  category: 'spending' | 'saving' | 'budgeting' | 'income';
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export default function ContextualFinancialTips({ summary, transactions, budgets, selectedMonth }: ContextualTipsProps) {
  const [tips, setTips] = useState<FinancialTip[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<string | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'spending': return TrendingDown;
      case 'saving': return PiggyBank;
      case 'budgeting': return AlertCircle;
      case 'income': return CheckCircle;
      default: return Lightbulb;
    }
  };

  // Reset loading state when month changes
  useEffect(() => {
    const monthKey = selectedMonth || new Date().toISOString().slice(0, 7);
    if (currentMonth !== monthKey) {
      setCurrentMonth(monthKey);
      setHasLoaded(false);
      setTips(null);
    }
  }, [selectedMonth, currentMonth]);

  useEffect(() => {
    if (!transactions || transactions.length === 0 || !summary || hasLoaded) return;

    // Create a month-specific cache key
    const monthKey = selectedMonth || new Date().toISOString().slice(0, 7); // YYYY-MM format
    const dataHash = JSON.stringify({
      transactionCount: transactions.length,
      totalIncome: summary?.totalIncome || 0,
      totalExpenses: summary?.totalExpenses || 0,
      budgetCount: budgets?.length || 0
    });
    const cacheKey = `financial-tips-${monthKey}-${btoa(dataHash).slice(0, 12)}`;

    // Check localStorage for cached tips first
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const { tips: cachedTips, timestamp } = JSON.parse(cachedData);
        const isExpired = Date.now() - timestamp > 60 * 60 * 1000; // 1 hour
        
        if (!isExpired && cachedTips && cachedTips.length > 0) {
          setTips(cachedTips);
          setHasLoaded(true);
          return; // Use cached tips, skip API call
        }
      } catch (e) {
        // Invalid cached data, continue to fetch
      }
    }

    const fetchTips = async () => {
      if (loading) return; // Prevent multiple simultaneous calls
      
      setLoading(true);
      try {
        const res = await axios.post('/api/ai/contextual-financial-tips', {
          summary,
          transactions,
          budgets,
          selectedMonth
        });
        
        const fetchedTips = res.data.tips || [];
        setTips(fetchedTips);
        setHasLoaded(true);
        
        // Cache the tips with timestamp for this specific month
        if (fetchedTips.length > 0) {
          localStorage.setItem(cacheKey, JSON.stringify({
            tips: fetchedTips,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Failed to fetch AI tips:', error);
        setTips([]);
        setHasLoaded(true);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the API call to prevent multiple rapid calls
    const timeoutId = setTimeout(fetchTips, 100);
    return () => clearTimeout(timeoutId);
  }, [summary?.totalIncome, summary?.totalExpenses, transactions?.length, budgets?.length, selectedMonth, hasLoaded, loading]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-600" />
          Personalized Financial Tips
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500">Generating AI insights...</p>
        ) : tips && tips.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              No tips available. Add more transactions to receive personalized insights.
            </p>
          </div>
        ) : (
          tips?.map((tip) => {
            const IconComponent = getCategoryIcon(tip.category);
            return (
              <div key={tip.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className={`h-5 w-5 ${
                      tip.priority === 'high' ? 'text-red-600' :
                      tip.priority === 'medium' ? 'text-yellow-600' :
                      'text-green-600'
                    }`} />
                    <h4 className="font-medium text-sm">{tip.title}</h4>
                  </div>
                  <Badge className={`${getPriorityColor(tip.priority)} text-xs`}>
                    {tip.priority}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {tip.description}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {tip.category}
                  </Badge>
                  {tip.actionable && (
                    <span className="text-xs text-blue-600 font-medium">
                      Action Required
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        {tips && tips.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tips are generated using AI based on your current transactions and budget settings.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
