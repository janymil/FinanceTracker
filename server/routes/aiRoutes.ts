import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { 
  generateFinancialTips, 
  categorizeExpense, 
  generateSpendingInsights, 
  generateTrendPredictions,
  generateAIFinancialHealthScore,
  type ExpenseCategorizationResult 
} from "../openai";
import { aiCache } from "../cache";

export function registerAIRoutes(app: Express) {
  // Auto-categorization endpoint for bulk processing
  app.post('/api/auto-categorize', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      // Require standard+ plan for auto-categorization
      if (!user || !['standard', 'premium'].includes(user.plan || '')) {
        return res.status(403).json({ message: "Auto-categorization requires standard or premium plan" });
      }

      // Get uncategorized transactions
      const transactions = await storage.getUserTransactions(userId);
      const uncategorized = transactions.filter(t => !t.categoryId);

      if (uncategorized.length === 0) {
        return res.json({ suggestions: [] });
      }

      // Process up to 10 transactions at a time to avoid rate limits
      const suggestions = [];
      const limit = Math.min(uncategorized.length, 10);

      for (let i = 0; i < limit; i++) {
        const transaction = uncategorized[i];
        try {
          const result = await categorizeExpense(transaction.description, parseFloat(transaction.amount));
          suggestions.push({
            id: `suggestion-${transaction.id}`,
            transactionDescription: transaction.description,
            suggestedCategory: result.category,
            confidence: result.confidence,
            amount: parseFloat(transaction.amount),
            date: transaction.date.toISOString(),
            transactionId: transaction.id
          });
        } catch (error) {
          console.error(`Failed to categorize transaction ${transaction.id}:`, error);
        }
      }

      res.json({ suggestions });
    } catch (error) {
      console.error("Error in auto-categorization:", error);
      res.status(500).json({ message: "Failed to auto-categorize transactions" });
    }
  });

  // AI Categorization endpoint
  app.post('/api/ai/categorize', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      // Require standard+ plan for AI categorization
      if (!user || !['standard', 'premium'].includes(user.plan || '')) {
        return res.status(403).json({ message: "AI categorization requires standard or premium plan" });
      }

      const { description, amount } = req.body;

      if (!description) {
        return res.status(400).json({ message: "Description is required" });
      }

      const result = await categorizeExpense(description, amount || 0);
      res.json({ category: result.category });
    } catch (error) {
      console.error("Error categorizing expense:", error);
      res.status(500).json({ message: "Failed to categorize expense" });
    }
  });

  // AI Financial Tips endpoint - bypasses cache for fresh responses
  app.post('/api/ai/tip', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      // Require premium plan for AI tips
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI financial tips require premium plan" });
      }

      // Get user's complete financial data for analysis
      const currentDate = new Date();
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      
      const financialSummary = await storage.getUserFinancialSummary(userId, startOfYear, currentDate);
      const transactions = await storage.getUserTransactions(userId, 100);
      const categories = await storage.getCategories();

      // Create category name mapping
      const categoryMap = new Map();
      categories.forEach(cat => categoryMap.set(cat.id, cat.name));

      // Prepare comprehensive financial data
      const financialData = {
        totalIncome: financialSummary.totalIncome,
        totalExpenses: financialSummary.totalExpenses,
        transactionsByCategory: financialSummary.transactionsByCategory,
        recentTransactions: transactions.map(t => ({
          description: t.description,
          amount: parseFloat(t.amount),
          date: t.date.toISOString(),
          categoryName: categoryMap.get(t.categoryId) || 'Uncategorized',
          type: t.type
        })),
        // Add timestamp to force fresh AI response
        timestamp: Date.now()
      };

      console.log(`Generating fresh AI tip for user ${getUserId(req)} with ${transactions.length} transactions`);
      
      const tips = await generateFinancialTips(financialData);
      const tip = tips.length > 0 ? tips[0] : null;

      if (tip) {
        res.json({ tip: `${tip.title}: ${tip.description}` });
      } else {
        // Provide specific fallback based on actual data
        if (transactions.length === 0) {
          res.json({ tip: "Start by adding some transactions to get personalized financial insights." });
        } else {
          const expenseCount = transactions.filter(t => t.type === 'expense').length;
          const incomeCount = transactions.filter(t => t.type === 'income').length;
          res.json({ 
            tip: `Based on your ${expenseCount} expense transactions ($${financialSummary.totalExpenses.toFixed(2)}) and ${incomeCount} income transactions ($${financialSummary.totalIncome.toFixed(2)}), consider setting up budgets for your top spending categories to better manage your finances.` 
          });
        }
      }
    } catch (error) {
      console.error("Error generating financial tip:", error);
      res.status(500).json({ message: "Failed to generate financial tip" });
    }
  });

  // AI Spending Insights endpoint
  app.get('/api/ai/insights', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(getUserId(req));

      // Require premium plan for AI insights
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI spending insights require premium plan" });
      }

      const transactions = await storage.getUserTransactions(getUserId(req), 100);

      const insights = await generateSpendingInsights(transactions.map(t => ({
        description: t.description,
        amount: parseFloat(t.amount),
        date: t.date.toISOString(),
        categoryName: t.categoryId?.toString() || 'Uncategorized',
        type: t.type
      })));

      res.json(insights);
    } catch (error) {
      console.error("Error generating spending insights:", error);
      res.status(500).json({ message: "Failed to generate spending insights" });
    }
  });

  // AI Financial Health Score
  app.post('/api/ai/financial-health-score', isAuthenticated, async (req: any, res) => {
    try {
      const { summary, budgets, useAdvancedFactors } = req.body;

      const transactions = await storage.getUserTransactions(getUserId(req), 100);

      const aiScore = await generateAIFinancialHealthScore({
        summary,
        budgets,
        transactions: transactions.map(t => ({
          description: t.description,
          amount: parseFloat(t.amount),
          date: t.date.toISOString(),
          categoryName: t.categoryId?.toString() || 'Uncategorized',
          type: t.type
        })),
        useAdvancedFactors
      });

      res.json(aiScore);
    } catch (error) {
      console.error("Error generating AI financial health score:", error);
      res.status(500).json({ message: "Failed to generate AI financial health score" });
    }
  });

  // AI Trend Predictions (Premium only)
  app.get('/api/trend-predictions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI trend predictions require Premium subscription" });
      }

      const transactions = await storage.getUserTransactions(userId, 200);
      const categories = await storage.getCategories();
      const budgets = await storage.getUserBudgets(userId);

      const categoryMap = new Map();
      categories.forEach(cat => {
        categoryMap.set(cat.id, cat.name);
      });

      const predictions = await generateTrendPredictions(
        transactions.map(t => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          date: t.date.toISOString(),
          type: t.type,
          categoryId: t.categoryId || 1 // Default to first category if null
        })),
        categoryMap,
        budgets
          .filter(b => b.categoryId !== null)
          .map(b => ({
            categoryId: b.categoryId as number,
            amount: b.amount
          }))
      );

      res.json(predictions);
    } catch (error) {
      console.error("Error generating trend predictions:", error);
      res.status(500).json({ message: "Failed to generate trend predictions" });
    }
  });

  // Financial Health Score (Free for all users)
  app.get('/api/financial-health', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get user's financial data
      const transactions = await storage.getUserTransactions(userId, 100);
      const budgets = await storage.getUserBudgets(userId);
      const categories = await storage.getCategories();
      
      // Calculate summary from transactions
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const summary = {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses
      };

      // Create a stable data hash that only changes with significant financial changes
      // This prevents cache misses from minor data changes like transaction IDs or exact timestamps
      const stableFinancialData = {
        transactionCount: transactions.length,
        totalIncome: Math.round(totalIncome),
        totalExpenses: Math.round(totalExpenses),
        budgetCount: budgets.length,
        recentTransactionTypes: transactions
          .slice(0, 10)
          .map(t => ({ type: t.type, amount: Math.round(parseFloat(t.amount)) })),
        budgetAllocations: budgets.map(b => ({ 
          categoryId: b.categoryId, 
          amount: Math.round(parseFloat(b.amount)) 
        }))
      };

      const dataHash = aiCache.createDataHash(stableFinancialData);
      
      // Check cache first - 24 hour expiration
      const cachedHealth = aiCache.getFinancialHealth(userId, dataHash);
      if (cachedHealth) {
        console.log('Financial health: Using cached data - avoiding OpenAI API call');
        return res.json(cachedHealth);
      }

      // Create category map
      const categoryMap = new Map();
      categories.forEach(cat => {
        categoryMap.set(cat.id, cat.name);
      });

      // Process transactions with category names
      const processedTransactions = transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        description: t.description,
        date: t.date.toISOString(),
        type: t.type,
        categoryName: categoryMap.get(t.categoryId) || 'Other'
      }));

      // Calculate budget spending
      const budgetSpending = new Map();
      transactions.forEach(t => {
        if (t.type === 'expense' && t.categoryId) {
          const current = budgetSpending.get(t.categoryId) || 0;
          budgetSpending.set(t.categoryId, current + parseFloat(t.amount));
        }
      });

      const processedBudgets = budgets
        .filter(b => b.categoryId !== null)
        .map(b => ({
          categoryId: b.categoryId as number,
          amount: b.amount,
          spent: budgetSpending.get(b.categoryId) || 0
        }));

      // Generate financial health score with OpenAI
      console.log('Financial health: Making new OpenAI API call - no cached data available');
      const { generateFinancialHealthScore } = await import('../openai');
      const healthData = await generateFinancialHealthScore({
        transactions: processedTransactions,
        budgets: processedBudgets,
        summary: {
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          netBalance: summary.totalIncome - summary.totalExpenses
        }
      });

      // Cache the result for 24 hours
      aiCache.setFinancialHealth(userId, dataHash, healthData);
      console.log('Financial health: Cached new result for 24 hours');

      res.json(healthData);
    } catch (error) {
      console.error("Error generating financial health score:", error);
      res.status(500).json({ message: "Failed to generate financial health score" });
    }
  });

  // Get user's mascot data
  app.get('/api/mascot', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const mascot = await storage.getUserMascot(userId);
      res.json(mascot);
    } catch (error) {
      console.error("Error getting mascot:", error);
      res.status(500).json({ message: "Failed to get mascot" });
    }
  });

  // Generate new mascot
  app.post('/api/mascot/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || !['standard', 'premium'].includes(user.plan || '')) {
        return res.status(403).json({ message: "Mascot generation requires standard or premium plan" });
      }

      // Get financial health data
      const transactions = await storage.getUserTransactions(userId, 100);
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const healthScore = Math.max(0, Math.min(100, 
        50 + (totalIncome - totalExpenses) / Math.max(totalIncome, 1) * 50
      ));

      // Generate mascot with DALL-E
      const { generateMascotImage } = await import('../openai');
      const imageUrl = await generateMascotImage(userId, healthScore);

      // Create or update mascot
      const existingMascot = await storage.getUserMascot(userId);
      let mascot;
      
      if (existingMascot) {
        mascot = await storage.updateMascot(userId, {
          imageUrl,
          healthScore,
          mood: healthScore >= 70 ? 'happy' : healthScore >= 40 ? 'neutral' : 'concerned',
          lastGenerated: new Date().toISOString(),
          isEnabled: true
        });
      } else {
        mascot = await storage.createMascot({
          userId,
          imageUrl,
          healthScore,
          mood: healthScore >= 70 ? 'happy' : healthScore >= 40 ? 'neutral' : 'concerned',
          lastGenerated: new Date().toISOString(),
          isEnabled: true
        });
      }

      res.json(mascot);
    } catch (error) {
      console.error("Error generating mascot:", error);
      res.status(500).json({ message: "Failed to generate mascot" });
    }
  });

  // Toggle mascot visibility
  app.post('/api/mascot/toggle', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { enabled } = req.body;
      const mascot = await storage.toggleMascot(userId, enabled);
      res.json(mascot);
    } catch (error) {
      console.error("Error toggling mascot:", error);
      res.status(500).json({ message: "Failed to toggle mascot" });
    }
  });
}