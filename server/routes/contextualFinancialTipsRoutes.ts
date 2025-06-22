
import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { openai } from "../openaiClient";
import { storage } from "../storage";
import crypto from "crypto";

export function registerContextualFinancialTipsRoutes(app: Express) {
  app.post('/api/ai/contextual-financial-tips', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { transactions, summary, budgets, selectedMonth } = req.body;

      if (!transactions || !summary) {
        return res.status(400).json({ message: "Transactions and summary are required" });
      }

      // Create a data hash to detect significant changes
      const dataForHash = {
        transactionCount: transactions.length,
        totalIncome: summary.totalIncome || 0,
        totalExpenses: summary.totalExpenses || 0,
        budgetCount: budgets?.length || 0,
        recentTransactions: transactions.slice(0, 5).map((t: any) => ({
          amount: t.amount,
          category: t.category,
          date: t.date
        }))
      };
      
      const currentDataHash = crypto
        .createHash('md5')
        .update(JSON.stringify(dataForHash))
        .digest('hex');

      // Check if we should regenerate tips or use cached ones
      const shouldRegenerate = await storage.shouldRegenerateFinancialTips(userId, currentDataHash);

      if (!shouldRegenerate) {
        // Return cached tips
        const cachedTips = await storage.getContextualFinancialTips(userId);
        if (cachedTips && cachedTips.tips) {
          console.log('Contextual financial tips: Using cached data - avoiding OpenAI API call');
          return res.json({ tips: cachedTips.tips });
        }
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

      // Save tips to database for persistence
      const tipsData = {
        userId,
        tips,
        dataHash: currentDataHash,
        transactionCount: transactions.length,
        totalIncome: (summary.totalIncome || 0).toString(),
        totalExpenses: (summary.totalExpenses || 0).toString(),
        budgetCount: budgets?.length || 0
      };

      try {
        const existingTips = await storage.getContextualFinancialTips(userId);
        if (existingTips) {
          await storage.updateContextualFinancialTips(userId, tipsData);
        } else {
          await storage.saveContextualFinancialTips(tipsData);
        }
      } catch (dbError) {
        console.error("Error saving contextual financial tips to database:", dbError);
        // Continue to return tips even if database save fails
      }

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
      
      // Return fallback tips based on available data
      const fallbackTips = [];
      const { summary, budgets } = req.body;
      
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
      
      if (!budgets || budgets.length === 0) {
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
        fallbackTips.push({
          id: 'fallback_general',
          title: 'Track Your Progress',
          description: 'Continue monitoring your financial transactions to identify spending patterns and optimization opportunities.',
          category: 'budgeting',
          priority: 'low',
          actionable: true
        });
      }
      
      return res.json({ tips: fallbackTips });
    }
  });
}
