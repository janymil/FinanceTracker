import { log } from '../logger';
import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { aiGuard } from "../aiAccess";
import { storage } from "../storage";
import { rateLimit } from "../middleware/rateLimit";
import { adminAuth } from "../adminAuth";
import { anonymizeText } from "../../shared/aiAnonymizer";
import { PLAN_PRICES, formatMoney } from "../../shared/pricing";
import { getUserLanguage } from "../categoryTranslations";
import { 
  categorizeExpense,
  categorizeExpenseWithUserCategories,
  categorizeIncomeWithUserCategories,
  type ExpenseCategorizationResult 
} from "../openai";
import { runAI } from "../../lib/aiProcessor";
import { annotateEmptyReason } from "../../shared/dailyRecommendations";
import { isAIFailure } from "../../shared/aiResults";
import { contextualFallbackTips } from "../../shared/aiFallbacks";
import { getAIProviderStatus } from "../../lib/aiProvider";
import { UnifiedAICache } from "../../lib/unifiedAICache";
import { 
  transactions, 
  categories, 
  budgets, 
  goals,
  expenseReminders,
  users
} from "../../shared/schema";
import { eq, desc, lt, gte, sql, and } from "drizzle-orm";

/** `runAI` answered with its failure payload: say so with a stable code and cache nothing. */
function aiUnavailable(res: any) {
  return res.status(503).json({ message: 'AI service temporarily unavailable', code: 'ai_unavailable' });
}

export function registerAIRoutes(app: Express) {
  // Provider/routing diagnostics. Exposes configuration only (never keys), admin only.
  app.get('/api/ai/health', adminAuth, (_req, res) => {
    res.json({
      ...getAIProviderStatus(),
      processor: {
        enabled: process.env.AI_PROCESSOR_ENABLED === 'true',
        url: process.env.AI_PROCESSOR_URL || null,
      },
    });
  });

  // Auto-categorization endpoint for bulk processing
  app.post('/api/auto-categorize', isAuthenticated, aiGuard(), async (req: any, res) => {
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
      const uncategorized = transactions.filter(t => !t.categoryName || t.categoryName === 'Uncategorized');

      if (uncategorized.length === 0) {
        return res.json({ message: "No uncategorized transactions found" });
      }

      // Get user's existing categories for AI categorization
      const userCategories = await storage.getCategories(userId);
      const categoryList = userCategories.map(cat => ({ 
        id: cat.id, 
        name: cat.name, 
        type: cat.type 
      }));

      // Process up to 10 transactions at a time to avoid rate limits
      const suggestions = [];
      const limit = Math.min(uncategorized.length, 10);

      for (let i = 0; i < limit; i++) {
        const transaction = uncategorized[i];
        try {
          // Get user language from consistent header detection
          const language = getUserLanguage(req);
          
          // Use the correct categorization function based on transaction type
          let result;
          if (transaction.type === 'income') {
            result = await categorizeIncomeWithUserCategories(
              transaction.description, 
              parseFloat(transaction.amount), 
              categoryList, 
              language
            );
          } else {
            result = await categorizeExpenseWithUserCategories(
              transaction.description, 
              parseFloat(transaction.amount), 
              categoryList, 
              language
            );
          }

          // A failed answer is not a suggestion
          if (result.failed) continue;

          suggestions.push({
            id: `suggestion-${transaction.id}`,
            transactionDescription: transaction.description,
            suggestedCategory: result.suggestedCategory || `Category ID: ${result.categoryId}`,
            suggestedCategoryId: result.categoryId,
            confidence: result.confidence,
            reasoning: result.reasoning,
            amount: parseFloat(transaction.amount),
            date: transaction.date.toISOString(),
            transactionId: transaction.id
          });
        } catch (error) {
          console.error(`Failed to categorize transaction ${transaction.id}:`, error);
        }
      }

      return res.json({ suggestions });
    } catch (error) {
      console.error("Error in auto-categorization:", error);
      return res.status(500).json({ message: "Failed to auto-categorize transactions" });
    }
  });

  // AI Categorization endpoint
  app.post('/api/ai/categorize', isAuthenticated, aiGuard(), async (req: any, res) => {
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

      const { description, amount, type } = req.body;

      if (!description) {
        return res.status(400).json({ message: "Description is required" });
      }

      // Get user's existing categories for AI categorization
      const userCategories = await storage.getCategories(userId);
      const categoryList = userCategories.map(cat => ({ 
        id: cat.id, 
        name: cat.name, 
        type: cat.type 
      }));

      // Get user language from consistent header detection
      const language = getUserLanguage(req);
      
      // Use the correct categorization function based on transaction type
      let result;
      if (type === 'income') {
        result = await categorizeIncomeWithUserCategories(description, amount || 0, categoryList, language);
      } else {
        result = await categorizeExpenseWithUserCategories(description, amount || 0, categoryList, language);
      }
      
      if (result.failed) return aiUnavailable(res);

      return res.json({
        category: result.suggestedCategory || `Category ID: ${result.categoryId}`,
        categoryId: result.categoryId,
        confidence: result.confidence,
        reasoning: result.reasoning
      });
    } catch (error) {
      console.error("Error categorizing expense:", error);
      return res.status(500).json({ message: "Failed to categorize expense" });
    }
  });

  // AI Financial Tips endpoint with detailed transaction data
  app.post('/api/ai/tip', isAuthenticated, aiGuard(), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI financial tips require premium plan" });
      }

      // Handle fetch_cached mode
      const { mode, financialData } = req.body;
      
      if (mode === 'fetch_cached') {
        // Get the most recent cached tip directly from database
        const recentEntry = await storage.getRecentAICacheEntry(userId, 'financial-tips');

        // A tip written in another language than the one on screen is not shown.
        const storedLanguage = recentEntry?.inputJson?.language;
        const sameLanguage = !storedLanguage || storedLanguage === getUserLanguage(req);

        if (recentEntry && recentEntry.outputJson && sameLanguage) {
          return res.json({ tip: recentEntry.outputJson });
        } else {
          return res.json({ tip: null });
        }
      }

      // Get financial data from request body (sent from frontend)
      
      if (!financialData || !financialData.transactions) {
        return res.status(400).json({ message: "Financial data with transactions required" });
      }

      // Format transaction data for AI analysis with detailed information
      const formattedTransactions = financialData.transactions.map((t: any) => ({
        id: t.id,
        description: t.note || `${t.categoryName || 'Transaction'}`,
        amount: t.amount,
        date: t.date,
        categoryName: t.categoryName || 'Uncategorized',
        type: t.type,
        recurring: t.recurring,
        budgetAssigned: t.budgetAssigned
      }));

      // Get user language from consistent header detection
      const language = getUserLanguage(req);
      
      const aiPayload = {
        totalIncome: financialData.totalIncome,
        totalExpenses: financialData.totalExpenses,
        transactionsByCategory: financialData.categories,
        recentTransactions: formattedTransactions,
        timestamp: financialData.timestamp,
        language: language
      };

      // Initialize UnifiedAICache with 168 hours TTL (7 days)
      const cache = new UnifiedAICache('financial-tips', userId);

      // Try to get cached result
      const cachedResult = await cache.get(aiPayload);
      if (cachedResult) {
        return res.json(cachedResult);
      }

      // Generate new AI response
      const tipResults = await runAI('financial-tips', userId, aiPayload, user.plan || 'free');

      if (isAIFailure(tipResults)) return aiUnavailable(res);

      let responseData;
      if (Array.isArray(tipResults) && tipResults.length > 0) {
        // AI processor returns array of tips directly
        responseData = { tips: tipResults };
        log.info('TIP ENDPOINT: Using array format, tips count:', tipResults.length);
      } else if (tipResults && typeof tipResults === 'object' && tipResults.tip) {
        // Legacy single tip format
        responseData = { tip: tipResults.tip };
        log.info('TIP ENDPOINT: Using legacy tip format');
      } else if (tipResults && typeof tipResults === 'object' && tipResults.tips) {
        // Wrapped tips format
        responseData = tipResults;
        log.info('TIP ENDPOINT: Using wrapped tips format');
      } else {
        console.error('TIP ENDPOINT: Unexpected response format:', {
          type: typeof tipResults,
          isArray: Array.isArray(tipResults),
          keys: tipResults ? Object.keys(tipResults) : 'null',
        });
        return res.status(500).json({ message: "Failed to generate financial tip" });
      }

      // Cache the successful result for 168 hours (7 days)
      await cache.set(aiPayload, responseData, false, 168);

      return res.json(responseData);
    } catch (error) {
      console.error("Error generating financial tip:", error);
      return res.status(500).json({ message: "Failed to generate financial tip" });
    }
  });

  // AI Spending Insights endpoint
  app.get('/api/ai/insights', isAuthenticated, aiGuard(), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);

      // Require premium plan for AI insights
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI spending insights require premium plan" });
      }

      const transactions = await storage.getUserTransactions(userId, 100);

      // Get user language from consistent header detection
      const language = getUserLanguage(req);
      
      const aiPayload = {
        transactions: transactions.map(t => ({
          description: t.description,
          amount: parseFloat(t.amount),
          date: t.date.toISOString(),
          categoryName: t.categoryName || 'Uncategorized',
          type: t.type
        })),
        language: language
      };

      // Initialize UnifiedAICache with 72 hours TTL
      const cache = new UnifiedAICache('spending-insights', userId);

      // Try to get cached result
      const cachedResult = await cache.get(aiPayload);
      if (cachedResult) {
        return res.json(cachedResult);
      }

      // Generate new AI response
      const insights = await runAI('spending-insights', userId, aiPayload, user.plan || 'free');
      if (isAIFailure(insights)) return aiUnavailable(res);

      // Cache the result for 72 hours
      await cache.set(aiPayload, insights, false, 72);

      return res.json(insights);
    } catch (error) {
      console.error("Error generating spending insights:", error);
      return res.status(500).json({ message: "Failed to generate spending insights" });
    }
  });

  // AI Financial Health Score (Standard+ required)
  app.post('/api/ai/financial-health-score', isAuthenticated, aiGuard(), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      
      // Require standard+ plan for AI financial health score
      if (!user || !['standard', 'premium'].includes(user.plan || '')) {
        return res.status(403).json({ message: "AI financial health score requires standard or premium plan" });
      }

      const { summary, budgets, useAdvancedFactors } = req.body;

      const transactions = await storage.getUserTransactions(userId, 100);

      log.info('AI financial health score: calling the AI processor');
      
      // Get user language from consistent header detection
      const language = getUserLanguage(req);
      
      const aiPayload = {
        summary,
        budgets: budgets,
        transactions: transactions.map(t => ({
          description: t.description,
          amount: parseFloat(t.amount),
          date: t.date.toISOString(),
          categoryName: t.categoryName || 'Uncategorized',
          type: t.type
        })),
        useAdvancedFactors,
        language: language
      };

      // Initialize UnifiedAICache with 24 hours TTL
      const cache = new UnifiedAICache('financial-health-score', userId);

      // Try to get cached result
      const cachedResult = await cache.get(aiPayload);
      if (cachedResult) {
        return res.json(cachedResult);
      }

      // Generate new AI response
      const aiScore = await runAI('financial-health-score', userId, aiPayload, user.plan || 'free');
      if (isAIFailure(aiScore)) return aiUnavailable(res);

      // Cache the result for 24 hours
      await cache.set(aiPayload, aiScore, false, 24);

      return res.json(aiScore);
    } catch (error) {
      console.error("Error generating AI financial health score:", error);
      return res.status(500).json({ message: "Failed to generate AI financial health score" });
    }
  });

  // AI Trend Predictions (Premium only)
  app.get('/api/trend-predictions', isAuthenticated, aiGuard(), async (req: any, res) => {
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
      const categories = await storage.getCategories(userId);
      const budgets = await storage.getUserBudgets(userId);

      // Get user language from consistent header detection
      const language = getUserLanguage(req);
      
      const aiPayload = {
        transactions: transactions.map(t => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          date: t.date.toISOString(),
          type: t.type,
          categoryName: t.categoryName || 'Uncategorized'
        })),
        budgets: budgets
          .filter(b => b.categoryName)
          .map(b => ({
            categoryName: b.categoryName,
            amount: b.amount
          })),
        language: language
      };

      // Initialize UnifiedAICache with 48 hours TTL
      const cache = new UnifiedAICache('trend-predictions', userId);

      // Try to get cached result
      const cachedResult = await cache.get(aiPayload);
      if (cachedResult) {
        return res.json(cachedResult);
      }

      // Generate new AI response
      const predictions = await runAI('trend-predictions', userId, aiPayload, user.plan || 'free');
      if (isAIFailure(predictions)) return aiUnavailable(res);

      // Cache the result for 48 hours
      await cache.set(aiPayload, predictions, false, 48);

      return res.json(predictions);
    } catch (error) {
      console.error("Error generating trend predictions:", error);
      return res.status(500).json({ message: "Failed to generate trend predictions" });
    }
  });

  // Daily Recommendations endpoint (Premium only)
  app.post('/api/ai/daily-recommendations', isAuthenticated, aiGuard(), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Daily recommendations require premium plan" });
      }

      const { transactions, summary, budgets } = req.body;

      if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ message: "Transactions array is required" });
      }

      // Create categories object for the payload
      const categoriesData = await storage.getCategories(userId);
      const categories: Record<number, string> = {};
      categoriesData.forEach(cat => {
        categories[cat.id] = cat.name;
      });
      
      // Get user language from consistent header detection
      const language = getUserLanguage(req);
      
      const aiPayload = {
        summary: summary,
        transactions: transactions.slice(0, 100).map(t => ({
          id: t.id,
          amount: String(t.amount),
          description: t.description,
          date: t.date,
          type: t.type,
          categoryName: t.categoryName
        })),
        budgets: budgets.map((b: any) => ({
          id: b.id,
          name: b.name,
          amount: String(b.amount),
          categoryName: b.categoryName,
          period: b.period
        })),
        categories: categories,
        language: language
      };

      // Initialize UnifiedAICache with 24 hours TTL
      const cache = new UnifiedAICache('daily-recommendations', userId);

      // Create stable date-based cache key that includes language to prevent cross-language caching
      const todayKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const cacheKey = { date: todayKey, userId: userId, language: language };

      // Try to get cached result using date-based key
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult) {
        log.info('Daily recommendations: Using cached result for date:', todayKey, 'language:', language);
        return res.json(annotateEmptyReason(cachedResult, { transactionCount: transactions.length, totalIncome: summary?.totalIncome, totalExpenses: summary?.totalExpenses }));
      }

      // Generate new AI response
      let recommendations = await runAI('daily-recommendations', userId, aiPayload, user.plan || 'free');
      if (isAIFailure(recommendations)) return aiUnavailable(res);

      // Cache the result for 24 hours using date-based key with language
      await cache.set(cacheKey, recommendations, false, 24);
      log.info('Daily recommendations: Cached new result for date:', todayKey, 'language:', language);

      return res.json(annotateEmptyReason(recommendations, { transactionCount: transactions.length, totalIncome: summary?.totalIncome, totalExpenses: summary?.totalExpenses }));
    } catch (error) {
      console.error("Error generating daily recommendations:", error);
      return res.status(500).json({ message: "Failed to generate daily recommendations" });
    }
  });

  // Financial Health Score (AI-powered for Standard+ users only)
  app.get('/api/financial-health', isAuthenticated, aiGuard(), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }



      // Require standard+ plan for AI financial health analysis
      if (!user.plan || !['standard', 'premium'].includes(user.plan)) {
        return res.status(403).json({ 
          message: "AI financial health analysis requires Standard or Premium subscription",
          currentPlan: user.plan || 'free',
          requiredPlans: ['standard', 'premium']
        });
      }

      // Get user's financial data
      const transactions = await storage.getUserTransactions(userId, 100);
      const budgets = await storage.getUserBudgets(userId);
      const categories = await storage.getCategories(userId);
      
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
          categoryName: b.categoryName || 'Uncategorized', 
          amount: Math.round(parseFloat(b.amount)) 
        }))
      };

      // Check unified cache for financial health score
      const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      // CACHE DISABLED FOR TESTING
      // Cache system completely removed
      
      // Cache system removed

      // Categories already provided via storage layer joins

      // Process transactions with category names
      const processedTransactions = transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        description: t.description,
        date: t.date.toISOString(),
        type: t.type,
        categoryName: t.categoryName || 'Other'
      }));

      // Calculate budget spending
      const budgetSpending = new Map();
      transactions.forEach(t => {
        if (t.type === 'expense' && t.categoryName) {
          const current = budgetSpending.get(t.categoryName) || 0;
          budgetSpending.set(t.categoryName, current + parseFloat(t.amount));
        }
      });

      const processedBudgets = budgets
        .filter(b => b.categoryName)
        .map(b => ({
          categoryName: b.categoryName,
          amount: b.amount,
          spent: budgetSpending.get(b.categoryName) || 0
        }));

      // Get user language from consistent header detection
      const language = getUserLanguage(req);
      
      const aiPayload = {
        transactions: processedTransactions,
        budgets: processedBudgets,
        summary: {
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          netBalance: summary.totalIncome - summary.totalExpenses
        },
        language: language
      };





      // Initialize UnifiedAICache with 24 hours TTL
      const cache = new UnifiedAICache('financial-health-score', userId);

      // Try to get cached result
      const cachedResult = await cache.get(aiPayload);
      if (cachedResult) {
        // Transform AI analysis into frontend-expected format
        const response = transformAIResponseForMascot(cachedResult);
        return res.json(response);
      }

      // Use unified AI processor for financial health score
      const healthData = await runAI('financial-health-score', userId, aiPayload, user.plan || 'free');
      if (isAIFailure(healthData)) return aiUnavailable(res);

      // Transform AI analysis into frontend-expected format
      const response = transformAIResponseForMascot(healthData);

      // Cache the result for 24 hours
      await cache.set(aiPayload, healthData, false, 24);

      return res.json(response);
    } catch (error) {
      console.error("Error generating financial health score:", error);
      return res.status(500).json({ message: "Failed to generate financial health score" });
    }
  });

  // Helper function to transform AI response for mascot component
  function transformAIResponseForMascot(aiData: any) {
    // Extract insights from different AI response fields
    const insights: string[] = [];
    const achievements: string[] = [];
    const warnings: string[] = [];

    // Add personalized factors as insights
    if (aiData.aiAnalysis?.personalizedFactors && Array.isArray(aiData.aiAnalysis.personalizedFactors)) {
      insights.push(...aiData.aiAnalysis.personalizedFactors);
    }

    // Add factor insights
    if (aiData.factors) {
      aiData.factors.forEach((factor: any) => {
        if (factor.aiInsight) {
          insights.push(`${factor.name}: ${factor.aiInsight}`);
        }
      });
    }

    // Add recommendations as insights
    if (aiData.aiAnalysis?.recommendations) {
      if (Array.isArray(aiData.aiAnalysis.recommendations)) {
        aiData.aiAnalysis.recommendations.forEach((rec: any) => {
          if (typeof rec === 'string') {
            insights.push(rec);
          } else if (rec.action) {
            insights.push(rec.action);
          }
        });
      }
    }

    // Extract achievements from positive factors
    if (aiData.factors) {
      aiData.factors.forEach((factor: any) => {
        if (factor.status === 'good' || factor.status === 'excellent') {
          achievements.push(`${factor.name} (${factor.score}/${factor.max})`);
        }
      });
    }

    // Extract warnings from negative factors and risk assessment
    if (aiData.factors) {
      aiData.factors.forEach((factor: any) => {
        if (factor.status === 'poor' || factor.status === 'below average') {
          warnings.push(`${factor.name} (${factor.score}/${factor.max})`);
        }
      });
    }

    if (aiData.aiAnalysis?.riskAssessment) {
      warnings.push(aiData.aiAnalysis.riskAssessment);
    }

    return {
      score: aiData.score || 50,
      trend: aiData.trend || 'stable',
      category: aiData.category || 'fair',
      insights: insights.slice(0, 10), // Limit to 10 insights
      achievements: achievements.slice(0, 5), // Limit to 5 achievements
      warnings: warnings.slice(0, 5), // Limit to 5 warnings
      factors: aiData.factors || [],
      aiAnalysis: aiData.aiAnalysis || {}
    };
  }

  // Financial Mascot endpoints

  // Financial Mascot endpoints
  app.get('/api/mascot', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const mascot = await storage.getUserMascot(userId);
      
      if (!mascot) {
        // Return default mascot state for new users
        return res.json({
          id: null,
          userId,
          imageUrl: null,
          healthScore: 50,
          mood: "neutral",
          lastGenerated: null,
          isEnabled: true
        });
      }
      
      return res.json(mascot);
    } catch (error) {
      console.error("Error fetching mascot:", error);
      return res.status(500).json({ message: "Failed to fetch mascot" });
    }
  });

  app.post('/api/mascot/generate', isAuthenticated, aiGuard(), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's current financial health
      const financialSummary = await storage.getUserFinancialSummary(
        userId,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        new Date()
      );

      // Calculate financial health score
      const totalIncome = financialSummary.totalIncome || 0;
      const totalExpenses = financialSummary.totalExpenses || 0;
      const netAmount = totalIncome - totalExpenses;
      
      // Simple health score calculation (0-100)
      let healthScore = 50; // Default neutral
      if (totalIncome > 0) {
        const savingsRate = netAmount / totalIncome;
        if (savingsRate > 0.3) healthScore = 90;
        else if (savingsRate > 0.2) healthScore = 80;
        else if (savingsRate > 0.1) healthScore = 70;
        else if (savingsRate > 0) healthScore = 60;
        else if (savingsRate > -0.1) healthScore = 40;
        else if (savingsRate > -0.2) healthScore = 30;
        else healthScore = 20;
      }

      // Determine mood based on health score
      let mood = "neutral";
      if (healthScore >= 80) mood = "excellent";
      else if (healthScore >= 60) mood = "good";
      else if (healthScore >= 40) mood = "neutral";
      else if (healthScore >= 20) mood = "concerned";
      else mood = "worried";

      // Generate DALL-E 3 prompt based on financial health
      const personalityTraits = {
        excellent: "confident, cheerful, glowing with success, wearing a small crown or gold accessories",
        good: "happy, optimistic, well-dressed, with a slight smile and bright eyes",
        neutral: "calm, balanced, thoughtful, with a gentle expression",
        concerned: "slightly worried, furrowed brow, but still hopeful, looking determined",
        worried: "anxious, stressed, but cute and sympathetic, needing encouragement"
      };

      // Create unique characteristics based on user ID for personalization
      const userIdNumber = parseInt(userId.slice(-4), 10); // Use last 4 digits of user ID
      const uniqueTraits = [
        "wearing glasses", "with a bow tie", "holding a tiny calculator", "with a small hat",
        "wearing a vest", "with a monocle", "holding coins", "with a briefcase",
        "wearing suspenders", "with a pocket watch", "holding a chart", "with a cape"
      ];
      const colorSchemes = [
        "blue and gold", "green and silver", "purple and white", "orange and blue",
        "red and gold", "teal and cream", "pink and gray", "navy and yellow"
      ];
      
      const uniqueTrait = uniqueTraits[userIdNumber % uniqueTraits.length];
      const colorScheme = colorSchemes[userIdNumber % colorSchemes.length];
      
      const prompt = `A cute, friendly financial advisor mascot character that is ${personalityTraits[mood as keyof typeof personalityTraits]}. The character should be a small, adorable creature (like a mix between a piggy bank and a friendly animal) with expressive eyes, ${uniqueTrait}, in ${colorScheme} colors. The style should be modern, clean, and professional but approachable. The character represents someone's financial health and should look ${mood}. Background should be simple and clean. Digital art style, cartoon-like but polished.`;

      // Generate image using DALL-E 3
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      const tempImageUrl = response.data?.[0]?.url;
      if (!tempImageUrl) {
        throw new Error("Failed to generate mascot image - no URL returned from DALL-E 3");
      }

      // Download the image from DALL-E and store it permanently in Bunny CDN
      const fetch = (await import('node-fetch')).default;
      const { bunnyStorage } = await import('../bunnyStorage');
      
      const imageResponse = await fetch(tempImageUrl);
      if (!imageResponse.ok) {
        throw new Error("Failed to download generated image");
      }
      
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const filename = `mascot-${userId}-${Date.now()}.png`;
      
      let permanentImageUrl: string;
      
      try {
        // Upload to Bunny CDN
        const bunnyPath = `mascots/${userId}/${filename}`;
        await bunnyStorage.uploadFile(bunnyPath, imageBuffer, 'image/png');
        
        // Get the CDN URL
        const cdnBaseUrl = process.env.BUNNY_CDN_URL || `https://${process.env.BUNNY_STORAGE_ZONE}.b-cdn.net`;
        permanentImageUrl = `${cdnBaseUrl}/${bunnyPath}`;
        log.info(`Mascot image stored permanently on CDN at: ${permanentImageUrl}`);
      } catch (storageError) {
        console.error("Failed to store image on CDN, falling back to local storage:", storageError);
        
        // Fallback to local storage
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const uploadsDir = path.join(process.cwd(), 'uploads', 'mascots');
          await fs.mkdir(uploadsDir, { recursive: true });
          
          const filePath = path.join(uploadsDir, filename);
          await fs.writeFile(filePath, imageBuffer);
          
          permanentImageUrl = `/uploads/mascots/${filename}`;
          log.info(`Mascot image stored locally at: ${permanentImageUrl}`);
        } catch (localError) {
          console.error("Failed to store image locally as well:", localError);
          // Last resort - use temporary URL
          permanentImageUrl = tempImageUrl;
        }
      }

      // Check if user already has a mascot
      const existingMascot = await storage.getUserMascot(userId);
      
      let mascot;
      if (existingMascot) {
        // Delete old image if it exists
        if (existingMascot.imageUrl) {
          try {
            // Check if it's a CDN URL or local file
            if (existingMascot.imageUrl.includes('b-cdn.net') || existingMascot.imageUrl.includes('bunny')) {
              // Delete from Bunny CDN
              const cdnPath = existingMascot.imageUrl.split('.net/')[1];
              if (cdnPath) {
                await bunnyStorage.deleteFile(cdnPath);
                log.info('Deleted previous mascot from CDN:', cdnPath);
              }
            } else if (existingMascot.imageUrl.startsWith('/uploads/mascots/')) {
              // Delete local file (fallback for old mascots)
              const fs = await import('fs/promises');
              const path = await import('path');
              const oldFilePath = path.join(process.cwd(), existingMascot.imageUrl);
              await fs.unlink(oldFilePath);
              log.info('Deleted previous local mascot file');
            }
          } catch (error) {
            console.warn("Failed to delete old mascot image:", error);
          }
        }
        
        // Update existing mascot
        mascot = await storage.updateMascot(userId, {
          imageUrl: permanentImageUrl,
          healthScore,
          mood,
          generationPrompt: prompt,
          lastGenerated: new Date(),
        });
      } else {
        // Create new mascot
        mascot = await storage.createMascot({
          userId,
          imageUrl: permanentImageUrl,
          healthScore,
          mood,
          generationPrompt: prompt,
          isEnabled: true,
        });
      }

      return res.json(mascot);
    } catch (error) {
      console.error("Error generating mascot:", error);
      return res.status(500).json({ message: "Failed to generate mascot" });
    }
  });

  app.post('/api/mascot/toggle', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { enabled } = req.body;

      // Check if mascot exists, if not create a default one
      let mascot = await storage.getUserMascot(userId);
      
      if (!mascot) {
        mascot = await storage.createMascot({
          userId,
          imageUrl: '', // Will be generated when user first enables
          healthScore: 50,
          mood: 'neutral',
          generationPrompt: 'Default mascot',
          isEnabled: enabled,
        });
      } else {
        mascot = await storage.toggleMascot(userId, enabled);
      }

      return res.json(mascot);
    } catch (error) {
      console.error("Error toggling mascot:", error);
      return res.status(500).json({ message: "Failed to toggle mascot" });
    }
  });

  // AI Expense Predictions endpoint
  app.post('/api/ai/expense-predictions', isAuthenticated, aiGuard(), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);

      // Require premium plan for expense predictions
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI expense predictions require Premium subscription" });
      }

      const { transactions } = req.body;

      // Always call the AI processor even with empty data for testing
      log.info('EXPENSE PREDICTIONS: Processing with', transactions.length, 'transactions');

      // Filter expense transactions for consistent cache hashing
      const expenseTransactions = transactions
        .filter((t: any) => t.type === 'expense')
        .slice(0, 100)
        .map((t: any) => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          date: t.date,
          type: t.type,
          categoryName: t.categoryName,
          recurring: t.recurring
        }));

      // Use only filtered transactions for consistent cache key
      const cacheInput = { transactions: expenseTransactions };

      // Initialize UnifiedAICache with 48 hours TTL
      const cache = new UnifiedAICache('expense-predictions', userId);

      // Try to get cached result
      const cachedResult = await cache.get(cacheInput);
      if (cachedResult) {
        return res.json(cachedResult);
      }

      // Get user language from consistent header detection
      const language = getUserLanguage(req);
      
      // Generate new AI response with full payload
      const aiPayload = {
        transactions: transactions.slice(0, 100),
        summary: req.body.summary || { totalIncome: 0, totalExpenses: 0, netAmount: 0 },
        language: language
      };
      const predictions = await runAI('expense-predictions', userId, aiPayload, user.plan || 'free');
      if (isAIFailure(predictions)) return aiUnavailable(res);

      // Cache the result for 48 hours using consistent input
      await cache.set(cacheInput, predictions, false, 48);

      return res.json(predictions);
    } catch (error) {
      console.error("Error generating expense predictions:", error);
      return res.status(500).json({ message: "Failed to generate expense predictions" });
    }
  });

  // Help Chat Assistant endpoint
  // Public (the help page works before sign-up), so it is rate limited per visitor and the
  // message is capped. No user data is sent: the prompt below only describes the product.
  app.post('/api/help-chat',
    rateLimit({ windowMs: 60_000, max: 6, keyPrefix: 'help-chat-min', message: 'Too many questions. Please wait a minute.' }),
    rateLimit({ windowMs: 60 * 60_000, max: 30, keyPrefix: 'help-chat-hour', message: 'Hourly question limit reached. Please try again later.' }),
    async (req: any, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }
      if (message.length > 500) {
        return res.status(400).json({ message: "Message is too long (500 characters max)" });
      }

      const { openai } = await import('../openaiClient');

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant for Kaptia, a personal finance management application. 

Kaptia offers three subscription tiers:
- Free Plan: Basic transaction tracking (up to 100 transactions)
- Standard Plan (${formatMoney(PLAN_PRICES.standard.usd.monthly, 'usd')}/month or ${formatMoney(PLAN_PRICES.standard.usd.yearly, 'usd')}/year; in Peru ${formatMoney(PLAN_PRICES.standard.pen.monthly, 'pen')}/month): Enhanced features including budgeting, goals, transaction reminders, AI categorization, receipt OCR processing
- Premium Plan (${formatMoney(PLAN_PRICES.premium.usd.monthly, 'usd')}/month or ${formatMoney(PLAN_PRICES.premium.usd.yearly, 'usd')}/year; in Peru ${formatMoney(PLAN_PRICES.premium.pen.monthly, 'pen')}/month): Unlimited transactions, advanced analytics, AI insights, data export/import, cloud backup, predictions, recommendations

Key features include:
- Transaction tracking (manual entry and receipt OCR scanning)
- Budget management and goal setting  
- AI-powered expense categorization
- Receipt OCR with Google Cloud Vision
- Financial health analysis and AI insights
- Cloud backup and data export/import
- Collaborative financial planning
- Mobile-responsive design

Authentication is handled through Clerk. Payment processing uses Stripe.

Answer questions about features, subscription plans, how to use the app, troubleshooting, and general financial management tips. Be helpful, friendly, and concise.`
          },
          {
            role: "user",
            // Anonymous visitors may paste anything: strip e-mails, phones, card numbers, IDs.
            content: anonymizeText(message).text
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const assistantResponse = response.choices[0].message.content || "I'm sorry, I couldn't generate a response. Please try again.";

      return res.json({ response: assistantResponse });
    } catch (error) {
      console.error("Error in help chat:", error);
      return res.status(500).json({ message: "Failed to get help response" });
    }
  });

  // Contextual Financial Tips endpoint (moved from contextualFinancialTipsRoutes.ts)
  app.post('/api/ai/contextual-financial-tips', isAuthenticated, aiGuard(), async (req: any, res) => {
    try {
      log.info('🎯 [CONTEXTUAL-TIPS] Starting request processing...');
      const userId = getUserId(req);
      if (!userId) {
        console.error('🚨 [CONTEXTUAL-TIPS] No userId found');
        return res.status(401).json({ message: "Authentication required" });
      }
      log.info('✅ [CONTEXTUAL-TIPS] User authenticated:', userId.substring(0, 8) + '...');

      const { transactions, summary, budgets, goals, selectedMonth } = req.body;
      
      // First check user plan
      log.info('📊 [CONTEXTUAL-TIPS] Getting user data...');
      const user = await storage.getUser(userId);
      log.info('👤 [CONTEXTUAL-TIPS] User data:', { userId: userId.substring(0, 8) + '...', plan: user?.plan, hasUser: !!user });
      
      // Provide safe defaults for missing data
      const safeTransactions = transactions || [];
      const safeSummary = summary || { totalIncome: 0, totalExpenses: 0, netBalance: 0 };
      const safeBudgets = budgets || [];
      log.info('💾 [CONTEXTUAL-TIPS] Data prepared:', { 
        transactions: safeTransactions.length, 
        summary: !!safeSummary, 
        budgets: safeBudgets.length 
      });
      
      log.info('🎯 Contextual tips - User check:', {
        userId: userId?.substring(0, 8) + '...',
        userPlan: user?.plan || 'free',
        hasUser: !!user
      });


      if (!safeTransactions && !safeSummary) {
        return res.status(400).json({ message: "Financial data is required" });
      }

      // Format the selected month for natural language
      const formatMonth = (selectedMonth: string) => {
        if (!selectedMonth) return 'Current Month';
        const [year, month] = selectedMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      };

      const formattedMonth = formatMonth(selectedMonth);

      const language = getUserLanguage(req);

      // Prepare payload for the AI call
      const aiPayload = {
        summary: {
          totalIncome: safeSummary.totalIncome || 0,
          totalExpenses: safeSummary.totalExpenses || 0,
          netBalance: safeSummary.netBalance || 0,
          transactionCount: safeTransactions.length || 0
        },
        transactions: safeTransactions.slice(0, 10).map((t: any) => ({
          description: t.description || t.note || 'Transaction',
          amount: t.amount,
          categoryName: t.categoryName || t.category || 'Uncategorized',
          type: t.type || 'expense',
          date: t.date
        })),
        budgets: safeBudgets?.map((budget: any) => ({
          category: budget.categoryName,
          budgetAmount: budget.amount,
          spent: budget.spent,
          remaining: budget.remaining
        })) || [],
        goals: goals?.map((goal: any) => ({
          name: goal.name,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          targetDate: goal.targetDate,
          progress: goal.progress || ((goal.currentAmount / goal.targetAmount) * 100)
        })) || [],
        selectedMonth: formattedMonth,
        language
      };

      // Initialize UnifiedAICache with 72 hours TTL
      const cache = new UnifiedAICache('contextual-tips', userId);

      // Try to get cached result
      const cachedResult = await cache.get(aiPayload);
      if (cachedResult) {
        // Return cached tips with proper formatting
        const tips = Array.isArray(cachedResult?.tips) ? cachedResult.tips.map((tip: any, index: number) => ({
          id: tip.id || `tip_${Date.now()}_${index}`,
          title: tip.title || '',
          description: tip.description || '',
          category: ['spending', 'saving', 'budgeting', 'income'].includes(tip.category) ? tip.category : 'budgeting',
          priority: ['high', 'medium', 'low'].includes(tip.priority) ? tip.priority : 'medium',
          actionable: Boolean(tip.actionable)
        })) : [];
        
        return res.json({ tips });
      }

      // Add user plan check for contextual tips
      if (!user || user?.plan === 'free') {
        log.info('🚫 Contextual tips - Free plan, returning empty tips');
        return res.json({ tips: [] });
      }
      
      // Generate new AI response
      log.info('🤖 Contextual tips - Calling AI processor with payload:', {
        payloadKeys: Object.keys(aiPayload),
        language: aiPayload.language,
        transactionCount: aiPayload.transactions?.length || 0
      });
      
      let result;
      try {
        log.info('🤖 [CONTEXTUAL-TIPS] Calling runAI...');
        result = await runAI('contextual-tips', userId, aiPayload, user?.plan || 'free');
        log.info('✅ [CONTEXTUAL-TIPS] runAI completed successfully');
      } catch (aiError: any) {
        console.error('🚨 [CONTEXTUAL-TIPS] AI failed:', aiError.message);
        return res.json({ tips: generateFallbackTips(safeSummary, safeTransactions, safeBudgets, language) });
      }
      
      // The model could not be reached: rule-based tips in the person's language, never cached.
      if (isAIFailure(result)) {
        console.error('🚨 AI returned an error for contextual tips');
        return res.json({ tips: generateFallbackTips(safeSummary, safeTransactions, safeBudgets, language) });
      }

      const aiTips = (Array.isArray(result?.tips) ? result.tips : [])
        .filter((tip: any) => tip && typeof tip.title === 'string' && tip.title.trim()
          && typeof tip.description === 'string' && tip.description.trim())
        .map((tip: any, index: number) => ({
          id: tip.id || `tip_${Date.now()}_${index}`,
          title: tip.title,
          description: tip.description,
          category: ['spending', 'saving', 'budgeting', 'income'].includes(tip.category) ? tip.category : 'budgeting',
          priority: ['high', 'medium', 'low'].includes(tip.priority) ? tip.priority : 'medium',
          actionable: Boolean(tip.actionable)
        }));

      if (aiTips.length === 0) {
        return res.json({ tips: generateFallbackTips(safeSummary, safeTransactions, safeBudgets, language) });
      }

      // Cache only a real answer, for 72 hours
      await cache.set(aiPayload, { tips: aiTips }, false, 72);

      return res.json({ tips: aiTips });
    } catch (error: any) {
      console.error("Error generating contextual financial tips:", {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Return fallback tips instead of 500 error
      try {
        const fallbackSummary = req.body?.summary || { totalIncome: 0, totalExpenses: 0, netBalance: 0 };
        const fallbackTransactions = req.body?.transactions || [];
        const fallbackBudgets = req.body?.budgets || [];
        const fallbackTips = generateFallbackTips(fallbackSummary, fallbackTransactions, fallbackBudgets, getUserLanguage(req));
        log.info('🔄 Contextual tips - Returning fallback tips due to error');
        return res.json({ tips: fallbackTips });
      } catch (fallbackError) {
        console.error("Error generating fallback tips:", fallbackError);
        // Return empty tips as last resort
        return res.json({ tips: [] });
      }
    }
  });

  // Helper function to generate fallback tips when AI processor fails
  function generateFallbackTips(summary: any, transactions: any[], budgets: any[], language: string) {
    return contextualFallbackTips(language, {
      totalIncome: summary?.totalIncome,
      totalExpenses: summary?.totalExpenses,
      transactionCount: transactions?.length,
      budgetCount: budgets?.length,
    });
  }
}