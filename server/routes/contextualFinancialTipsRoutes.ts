
import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { runAI } from "../../lib/aiProcessor";
import { storage } from "../storage";
import crypto from "crypto";
import { eq } from "drizzle-orm";
// Removed contextualFinancialTips import - using unified ai_cache system
import { db } from "../db";

export function registerContextualFinancialTipsRoutes(app: Express) {
  // Test endpoint to manually clear contextual tips cache
  app.delete('/api/ai/contextual-financial-tips/cache', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Clear database cache
      await storage.deleteCachedDailyRecommendations(userId);
      // Legacy table removed - unified cache handles clearing via unifiedAICache.invalidateUser()
      
      // No cache to clear
      
      console.log(`Manually cleared all AI caches for user ${userId}`);
      return res.json({ success: true, message: "Cache cleared successfully" });
    } catch (error) {
      console.error("Error clearing cache:", error);
      return res.status(500).json({ message: "Failed to clear cache" });
    }
  });

  app.post('/api/ai/contextual-financial-tips', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { transactions, summary, budgets, selectedMonth } = req.body;

      console.log('🔥 Contextual tips API request received:', {
        userId: userId?.substring(0, 8) + '...',
        selectedMonth,
        transactionCount: transactions?.length || 0,
        hasIncome: summary?.totalIncome > 0,
        hasExpenses: summary?.totalExpenses > 0,
        budgetCount: budgets?.length || 0,
        firstTransaction: transactions?.[0] ? {
          description: transactions[0].description,
          categoryName: transactions[0].categoryName,
          amount: transactions[0].amount,
          type: transactions[0].type
        } : 'none'
      });

      if (!transactions || !summary) {
        return res.status(400).json({ message: "Transactions and summary are required" });
      }

      // Standardize cache payload to match unified cache system
      const cachePayload = {
        summary,
        transactions: transactions.slice(0, 10),
        budgets
      };

      // CACHE COMPLETELY DISABLED FOR TESTING
      console.log('[AI contextual-tips] Cache check bypassed - forcing Fly.io call');
      
      if (forceRefresh) {
        console.log('Contextual financial tips: Force refresh requested - bypassing cache');
      }

      console.log('Contextual financial tips: Generating new AI tips - data changed or cache expired');

      // Format the selected month for natural language
      const formatMonth = (selectedMonth: string) => {
        if (!selectedMonth) return 'Current Month';
        const [year, month] = selectedMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      };

      const formattedMonth = formatMonth(selectedMonth);

      // Prepare payload for centralized AI processor
      const aiPayload = {
        summary: {
          totalIncome: summary.totalIncome || 0,
          totalExpenses: summary.totalExpenses || 0,
          netBalance: summary.netBalance || 0,
          transactionCount: transactions.length || 0
        },
        transactions: transactions.slice(0, 10).map((t: any) => ({
          description: t.description || t.note || 'Transaction',
          amount: t.amount,
          categoryName: t.categoryName || t.category || 'Uncategorized',
          type: t.type || 'expense',
          date: t.date
        })),
        budgets: budgets?.map((budget: any) => ({
          category: budget.categoryName,
          budgetAmount: budget.amount,
          spent: budget.spent || 0,
          remaining: budget.remaining || budget.amount
        })) || [],
        selectedMonth: formattedMonth
      };

      // Use centralized AI processor - fixed task name to match Fly.io processor
      console.log('[AI contextual-tips] Cache bypassed - testing Fly.io processor directly');
      const result = await runAI('contextual-tips', userId, aiPayload);
      console.log('[AI contextual-tips] Received result from processor:', result ? 'SUCCESS' : 'FAILED');
      
      // Handle centralized processor response
      const tips = Array.isArray(result?.tips) ? result.tips.map((tip: any, index: number) => ({
        id: tip.id || `tip_${Date.now()}_${index}`,
        title: tip.title || 'Financial Tip',
        description: tip.description || 'No description available',
        category: ['spending', 'saving', 'budgeting', 'income'].includes(tip.category) ? tip.category : 'budgeting',
        priority: ['high', 'medium', 'low'].includes(tip.priority) ? tip.priority : 'medium',
        actionable: Boolean(tip.actionable)
      })) : [];

      // No caching system

      // Add cache-busting headers
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      return res.json({ tips });

    } catch (error) {
      console.error("Error generating contextual financial tips:", error);
      
      // Try to return cached tips if available
      try {
        const cachedTips = await storage.getContextualFinancialTips(userId);
        if (cachedTips && cachedTips.tips) {
          console.log('Contextual financial tips: Returning cached tips due to error');
          return res.json({ tips: cachedTips.tips });
        }
      } catch (cacheError) {
        console.error("Error retrieving cached tips:", cacheError);
      }
      
      // Return smart fallback tips based on actual financial situation
      const fallbackTips = [];
      const { summary, budgets, transactions } = req.body;
      
      const savingsRate = summary?.totalIncome > 0 ? 
        ((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100 : 0;
      
      // Only suggest deficit help if actually overspending
      if (summary?.netBalance < 0) {
        fallbackTips.push({
          id: 'fallback_deficit',
          title: 'Address Spending Deficit',
          description: 'Your expenses exceed your income this month. Review your largest expense categories and identify areas to reduce spending.',
          category: 'spending',
          priority: 'high',
          actionable: true
        });
      } 
      // For excellent savers (>90% savings rate), suggest investment tips
      else if (savingsRate > 90) {
        fallbackTips.push({
          id: 'fallback_investment',
          title: 'Consider Investment Opportunities',
          description: `With a ${Math.round(savingsRate)}% savings rate, consider investing your surplus in index funds, retirement accounts, or other growth vehicles.`,
          category: 'saving',
          priority: 'medium',
          actionable: true
        });
      }
      
      // Only suggest budgeting if they actually have significant expenses
      if ((!budgets || budgets.length === 0) && summary?.totalExpenses > 100) {
        fallbackTips.push({
          id: 'fallback_budget',
          title: 'Create Monthly Budgets',
          description: 'Set up budgets for your main spending categories to better track and control your expenses.',
          category: 'budgeting',
          priority: 'medium',
          actionable: true
        });
      }
      
      if (fallbackTips.length === 0) {
        // For users with good finances, give appropriate advice
        if (savingsRate > 50) {
          fallbackTips.push({
            id: 'fallback_wealth_building',
            title: 'Build Long-term Wealth',
            description: 'Your excellent financial discipline creates opportunities for wealth building. Consider diversifying investments and setting long-term financial goals.',
            category: 'saving',
            priority: 'low',
            actionable: true
          });
        } else {
          fallbackTips.push({
            id: 'fallback_general',
            title: 'Track Your Progress',
            description: 'Continue monitoring your financial transactions to identify spending patterns and optimization opportunities.',
            category: 'budgeting',
            priority: 'low',
            actionable: true
          });
        }
      }
      
      return res.json({ tips: fallbackTips });
    }
  });
}
