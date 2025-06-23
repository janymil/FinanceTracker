
import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { openai } from "../openaiClient";
import { storage } from "../storage";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { contextualFinancialTips } from "../../shared/schema";
import { db } from "../db";
import { processAIRequest } from "../aiOrchestrator";

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
      await db.delete(contextualFinancialTips).where(eq(contextualFinancialTips.userId, userId));
      
      // Clear memory cache
      const { aiCache } = await import('../cache');
      aiCache.clearUserCache(userId);
      
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

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { transactions, summary, budgets, selectedMonth } = req.body;

      if (!transactions || !summary) {
        return res.status(400).json({ message: "Transactions and summary are required" });
      }

      // Define the AI logic function that contains the existing OpenAI logic
      const contextualTipsAILogic = async () => {

      // Format the selected month for natural language
      const formatMonth = (selectedMonth: string) => {
        if (!selectedMonth) return 'Current Month';
        const [year, month] = selectedMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      };

      const formattedMonth = formatMonth(selectedMonth);

      // Prepare natural language prompt for AI analysis
      const financialPrompt = `Given the following financial data for the user in ${formattedMonth}:

Summary: ${JSON.stringify({
        totalIncome: summary.totalIncome || 0,
        totalExpenses: summary.totalExpenses || 0,
        netBalance: summary.netBalance || 0,
        transactionCount: transactions.length || 0
      })}

Budgets: ${JSON.stringify(budgets?.map((budget: any) => ({
        category: budget.categoryName,
        budgetAmount: budget.amount,
        spent: budget.spent || 0,
        remaining: budget.remaining || budget.amount
      })) || [])}

Transactions: ${JSON.stringify(transactions.slice(0, 10).map((t: any) => ({
        description: t.description || t.note || 'Transaction',
        amount: t.amount,
        category: t.category || 'Uncategorized',
        date: t.date
      })))}

Analyze this data and return 4 personalized financial improvement tips in JSON format with keys: id, title, description, category, priority (high|medium|low), actionable (true|false). Tips must be clear, direct, and relevant to the data. Output only a valid JSON.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a financial advisor AI that provides personalized financial tips based on user data. 

Generate 4 contextual financial tips that are:
- Specific to their spending patterns and financial situation
- Actionable with clear next steps
- Relevant to their current month's activity
- Focused on improvement opportunities

Categories: spending, saving, budgeting, income
Priorities: high, medium, low

Respond with JSON in this exact format:
{
  "tips": [
    {
      "id": "tip_1",
      "title": "Clear, actionable tip title",
      "description": "Detailed explanation with specific recommendations and dollar amounts when relevant",
      "category": "spending|saving|budgeting|income",
      "priority": "high|medium|low",
      "actionable": true
    }
  ]
}`
          },
          {
            role: "user",
            content: financialPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"tips": []}');
      
      // Ensure proper response format
      const tips = Array.isArray(result.tips) ? result.tips.map((tip: any, index: number) => ({
        id: tip.id || `tip_${Date.now()}_${index}`,
        title: tip.title || 'Financial Tip',
        description: tip.description || 'No description available',
        category: ['spending', 'saving', 'budgeting', 'income'].includes(tip.category) ? tip.category : 'budgeting',
        priority: ['high', 'medium', 'low'].includes(tip.priority) ? tip.priority : 'medium',
        actionable: Boolean(tip.actionable)
      })) : [];

        return { tips };
      };

      // Pass through centralized AI infrastructure
      const result = await processAIRequest({
        taskName: 'contextual-tips',
        userId,
        userPlan: user.plan || 'free',
        dataPayload: { transactions, summary, budgets, selectedMonth },
        aiLogicFunction: contextualTipsAILogic,
        flyioEndpoint: '/generate-contextual-tips',
        cacheDuration: 3600
      });

      return res.json(result);
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
