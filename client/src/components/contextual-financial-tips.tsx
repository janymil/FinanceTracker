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
  const [lastLoadedMonth, setLastLoadedMonth] = useState<string | null>(null);

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

  useEffect(() => {
    if (!transactions || !summary) return;

    const currentMonth = selectedMonth || new Date().toISOString().slice(0, 7);
    
    // Filter transactions for the selected month
    const monthTransactions = transactions.filter((transaction: any) => {
      const transactionDate = new Date(transaction.date);
      const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
      return transactionMonth === currentMonth;
    });

    // If month changed, clear previous tips and reset state
    if (lastLoadedMonth && lastLoadedMonth !== currentMonth) {
      setTips(null);
      setLastLoadedMonth(null);
    }

    // If no transactions for this month, show no data state
    if (monthTransactions.length === 0) {
      setTips([]);
      setLastLoadedMonth(currentMonth);
      return;
    }

    // Skip if we already loaded tips for this month
    if (lastLoadedMonth === currentMonth && tips) return;

    // Create a month-specific cache key based on filtered transactions
    const dataHash = JSON.stringify({
      transactionCount: monthTransactions.length,
      totalIncome: summary?.totalIncome || 0,
      totalExpenses: summary?.totalExpenses || 0,
      budgetCount: budgets?.length || 0
    });
    const cacheKey = `financial-tips-${currentMonth}-${btoa(dataHash).slice(0, 12)}`;

    // Check for cache invalidation flag (set after data imports or manual refresh)
    const shouldSkipCache = localStorage.getItem('invalidate-ai-cache') === 'true';
    
    // Force refresh if invalidation flag is set
    if (shouldSkipCache) {
      setTips(null);
      setLastLoadedMonth(null);
    }
    
    // Check localStorage for cached tips first (unless cache invalidation flag is set)
    if (!shouldSkipCache) {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const { tips: cachedTips, timestamp } = JSON.parse(cachedData);
          const isExpired = Date.now() - timestamp > 30 * 60 * 1000; // 30 minutes (shorter cache)
          
          if (!isExpired && cachedTips) {
            setTips(cachedTips);
            setLastLoadedMonth(currentMonth);
            return; // Use cached tips, skip API call
          }
        } catch (e) {
          // Invalid cached data, continue to fetch
        }
      }
    }

    const fetchTips = async () => {
      if (loading) return; // Prevent multiple simultaneous calls
      
      setLoading(true);
      try {
        // Get auth headers for Clerk authentication
        const getAuthHeaders = async (): Promise<Record<string, string>> => {
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
        };

        const authHeaders = await getAuthHeaders();
        const res = await axios.post('/api/ai/contextual-financial-tips', {
          summary,
          transactions: monthTransactions, // Pass only filtered transactions
          budgets,
          selectedMonth
        }, {
          headers: authHeaders
        });
        
        const fetchedTips = res.data.tips || [];
        setTips(fetchedTips);
        setLastLoadedMonth(currentMonth);
        
        // Cache the tips with timestamp for this specific month
        localStorage.setItem(cacheKey, JSON.stringify({
          tips: fetchedTips,
          timestamp: Date.now()
        }));
        
        // Clear cache invalidation flag after successful fetch
        localStorage.removeItem('invalidate-ai-cache');
      } catch (error) {
        console.error('Failed to fetch AI tips:', error);
        setTips([]);
        setLastLoadedMonth(currentMonth);
      } finally {
        setLoading(false);
      }
    };

    fetchTips();
  }, [summary, transactions, budgets, selectedMonth, lastLoadedMonth, tips, loading]);

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
              No financial data available for {selectedMonth ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'this month'}. Add transactions to receive personalized insights.
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
