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

    // Dynamic month detection: use selectedMonth or find the most recent transaction month
    const getMostRecentTransactionMonth = () => {
      if (!transactions || transactions.length === 0) {
        // If no transactions, use current month
        return new Date().toISOString().slice(0, 7);
      }
      
      // Sort transactions by date descending and get the most recent month
      const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      const mostRecentDate = new Date(sortedTransactions[0].date);
      return `${mostRecentDate.getFullYear()}-${String(mostRecentDate.getMonth() + 1).padStart(2, '0')}`;
    };
    
    const currentMonth = selectedMonth || getMostRecentTransactionMonth();
    
    // Filter transactions for the selected month
    const monthTransactions = transactions.filter((transaction: any) => {
      const transactionDate = new Date(transaction.date);
      const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
      return transactionMonth === currentMonth;
    });

    console.log('Contextual tips: Month filtering debug', {
      selectedMonth: currentMonth,
      calculatedMonth: getMostRecentTransactionMonth(),
      totalTransactions: transactions.length,
      monthTransactions: monthTransactions.length,
      firstTxDate: transactions[0]?.date,
      firstMonthTxDate: monthTransactions[0]?.date,
      willMakeAPICall: monthTransactions.length > 0
    });

    // Check for cache invalidation flag (set after data imports or manual refresh)
    const shouldSkipCache = localStorage.getItem('invalidate-ai-cache') === 'true';

    // If month changed, clear previous tips and reset state
    if (lastLoadedMonth && lastLoadedMonth !== currentMonth) {
      setTips(null);
      setLastLoadedMonth(null);
    }

    // Force refresh if invalidation flag is set or month changed
    if (shouldSkipCache || lastLoadedMonth !== currentMonth) {
      setTips(null);
      setLastLoadedMonth(null);
      console.log('Contextual tips: Forcing refresh due to cache invalidation or month change');
    }

    // If no transactions for this month, show no data state
    if (monthTransactions.length === 0) {
      console.log('Contextual tips: No transactions for calculated month', {
        currentMonth,
        allTransactionDates: transactions.map(t => t.date).slice(0, 3)
      });
      setTips([]);
      setLastLoadedMonth(currentMonth);
      return;
    }

    // Skip if we already loaded tips for this month (unless forced refresh)
    if (lastLoadedMonth === currentMonth && tips && !shouldSkipCache) {
      console.log('Contextual tips: Skipping API call - already loaded for this month');
      return;
    }

    // Create a month-specific cache key based on filtered transactions
    const dataHash = JSON.stringify({
      transactionCount: monthTransactions.length,
      totalIncome: summary?.totalIncome || 0,
      totalExpenses: summary?.totalExpenses || 0,
      budgetCount: budgets?.length || 0
    });
    const cacheKey = `financial-tips-${currentMonth}-${btoa(dataHash).slice(0, 12)}`;
    
    // Check localStorage for cached tips first (unless cache invalidation flag is set)
    if (!shouldSkipCache) {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const { tips: cachedTips, timestamp } = JSON.parse(cachedData);
          const isExpired = Date.now() - timestamp > 30 * 60 * 1000; // 30 minutes (shorter cache)
          
          if (!isExpired && cachedTips) {
            console.log('Contextual tips: Using cached data, skipping API call');
            setTips(cachedTips);
            setLastLoadedMonth(currentMonth);
            return; // Use cached tips, skip API call
          } else {
            console.log('Contextual tips: Cache expired or invalid, will fetch fresh');
          }
        } catch (e) {
          console.log('Contextual tips: Invalid cached data, will fetch fresh');
        }
      } else {
        console.log('Contextual tips: No cached data found, will fetch fresh');
      }
    }

    const fetchTips = async () => {
      if (loading) return; // Prevent multiple simultaneous calls
      
      console.log('Contextual tips: Starting API call', {
        monthTransactions: monthTransactions.length,
        currentMonth,
        shouldSkipCache,
        summary,
        budgets: budgets?.length || 0,
        hasValidData: monthTransactions.length > 0 && summary && (summary.totalIncome > 0 || summary.totalExpenses > 0)
      });
      
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
          selectedMonth: currentMonth
        }, {
          headers: authHeaders
        });
        
        const fetchedTips = res.data.tips || [];
        console.log('Contextual tips: API response received', {
          tipsCount: fetchedTips.length,
          firstTip: fetchedTips[0]?.title || 'none'
        });
        
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

    // Only call fetchTips if we have data and haven't already loaded
    console.log('Contextual tips: useEffect decision point', {
      hasTransactions: !!transactions && transactions.length > 0,
      hasSummary: !!summary,
      monthTransactionCount: monthTransactions.length,
      currentMonth,
      lastLoadedMonth,
      shouldCallAPI: monthTransactions.length > 0 && (!lastLoadedMonth || lastLoadedMonth !== currentMonth || shouldSkipCache)
    });

    if (monthTransactions.length > 0 && (!lastLoadedMonth || lastLoadedMonth !== currentMonth || shouldSkipCache)) {
      fetchTips();
    }
  }, [summary, transactions, budgets, selectedMonth]);

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
          <div className="text-center py-6">
            <Lightbulb className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No transactions found for {currentMonth ? new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'this month'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Switch to a month with transaction data to see AI insights
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
