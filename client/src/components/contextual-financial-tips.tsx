'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingDown, PiggyBank, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguageForAPI } from '../../../lib/languageUtils';

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
  const { t, i18n } = useTranslation();
  const [tips, setTips] = useState<FinancialTip[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'busy' | 'failed' | 'ready'>('loading');
  /** Bumped by the retry button; the request itself lives in the effect below. */
  const [reloadToken, setReloadToken] = useState(0);
  
  // Dynamic month detection at component level for consistent access
  const getMostRecentTransactionMonth = () => {
    if (!transactions || transactions.length === 0) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    const mostRecentDate = new Date(sortedTransactions[0].date);
    return `${mostRecentDate.getFullYear()}-${String(mostRecentDate.getMonth() + 1).padStart(2, '0')}`;
  };

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
    const currentMonth = selectedMonth || getMostRecentTransactionMonth();
    
    if (!transactions || !summary) return;
    
    // Filter transactions for the selected month
    const monthTransactions = transactions.filter((transaction: any) => {
      const transactionDate = new Date(transaction.date);
      const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
      return transactionMonth === currentMonth;
    });

    // Skip API call if no transactions for this month
    if (monthTransactions.length === 0) {
      setTips([]);
      setStatus('ready');
      return;
    }

    let cancelled = false;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const getAuthHeaders = async () => {
      try {
        const clerk = (window as any).Clerk;
        if (clerk && clerk.session) {
          const token = await clerk.session.getToken();
          if (token) {
            return { Authorization: `Bearer ${token}` };
          }
        }
      } catch (error) {
        console.warn('Failed to get Clerk token:', error);
      }
      return {};
    };

    /*
     * The panel shows one of four states, and "no tips" is only one of them.
     *
     * It used to have two: an array, or an empty array - so a refused request looked exactly like
     * a month with nothing to say. Switching the language reloads the page, the dashboard asks for
     * the score and the tips at the same moment, and the server answers two questions at once; the
     * third request was refused and the panel told the person there were no tips for October. It
     * now waits and asks again, and says so while it does.
     */
    const fetchTips = async (attempt: number) => {
      setStatus('loading');

      try {
        const authHeaders = await getAuthHeaders();
        const res = await axios.post('/api/ai/contextual-financial-tips', {
          summary,
          transactions: monthTransactions, // Pass only filtered transactions
          budgets,
          // goals data handled by backend when available
          selectedMonth: currentMonth
        }, {
          headers: {
            ...authHeaders,
            'x-user-language': getCurrentLanguageForAPI()
          }
        });

        if (cancelled) return;
        setTips(res.data.tips || []);
        setStatus('ready');
      } catch (error: any) {
        if (cancelled) return;

        if (error.response?.status === 429 && attempt < 3) {
          setStatus('busy');
          await wait(2000 * attempt);
          if (!cancelled) await fetchTips(attempt + 1);
          return;
        }

        console.error('Failed to fetch AI tips:', {
          error: error.message,
          status: error.response?.status
        });
        setTips(null);
        setStatus('failed');
      }
    };

    fetchTips(1);

    return () => {
      cancelled = true;
    };
    // `i18n.language` belongs here: the tips are written by the model in the language on screen,
    // so a language switch has to ask again rather than keep what it already had.
  }, [summary, transactions, budgets, selectedMonth, i18n.language, reloadToken]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-600" />
          {t('personalizedFinancialTips')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'loading' || status === 'busy' ? (
          <p className="text-sm text-gray-500">
            {status === 'busy' ? t('aiTipsBusy') : t('generatingAIInsights')}
          </p>
        ) : status === 'failed' ? (
          <div className="text-center py-6">
            <div className="text-gray-400 mb-2">
              <AlertCircle className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-sm text-gray-500 mb-3">{t('aiTipsFailed')}</p>
            <Button variant="outline" size="sm" onClick={() => setReloadToken((token) => token + 1)}>
              {t('aiTipsRetry')}
            </Button>
          </div>
        ) : tips && tips.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-gray-400 mb-2">
              <Lightbulb className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-sm text-gray-500 mb-2">
              {t('noFinancialTipsAvailable')}
            </p>
            <p className="text-xs text-gray-500">
              {t('aiTipsDisclaimer')}
            </p>
          </div>
        ) : tips && tips.length > 0 ? (
          <div className="space-y-3">
            {tips.map((tip) => {
              const IconComponent = getCategoryIcon(tip.category);
              return (
                <div key={tip.id} className="p-3 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <div className="flex items-start gap-3">
                    <IconComponent className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm text-gray-900 truncate">{tip.title}</h4>
                        <Badge variant="outline" className={`text-xs ${getPriorityColor(tip.priority)}`}>
                          {tip.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{tip.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="text-center mt-4">
              <p className="text-xs text-gray-500">
                {t('aiTipsDisclaimer')}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="text-gray-400 mb-2">
              <Lightbulb className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-sm text-gray-500">{t('loadingFinancialInsights')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}