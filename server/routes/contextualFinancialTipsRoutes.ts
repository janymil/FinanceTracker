
import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { openai } from "../openaiClient";

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

      // Prepare financial summary for AI analysis
      const financialSummary = `
Financial Summary for ${selectedMonth || 'Current Month'}:
- Total Income: $${summary.totalIncome || 0}
- Total Expenses: $${summary.totalExpenses || 0}
- Net Balance: $${summary.netBalance || 0}
- Transaction Count: ${transactions.length || 0}

Spending by Category:
${summary.transactionsByCategory?.filter((cat: any) => cat.type === 'expense')
  .map((cat: any) => `- ${cat.categoryName}: $${cat.amount}`)
  .join('\n') || 'No expense categories'}

Budget Information:
${budgets?.map((budget: any) => 
  `- ${budget.categoryName}: Budget $${budget.amount}, Spent $${budget.spent || 0}, Remaining $${budget.remaining || budget.amount}`
).join('\n') || 'No budgets set'}

Recent Transactions:
${transactions.slice(0, 10).map((t: any) => 
  `- ${t.description || t.note || 'Transaction'}: $${t.amount} (${t.category || 'Uncategorized'})`
).join('\n')}
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a financial advisor AI that provides personalized financial tips based on user data. 

Generate 2-3 contextual financial tips that are:
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
            content: financialSummary
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

      return res.json({ tips });

    } catch (error) {
      console.error("Error generating contextual financial tips:", error);
      
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
