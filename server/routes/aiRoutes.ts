import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { 
  categorizeExpense,
  type ExpenseCategorizationResult 
} from "../openai";
import { runAI } from "../../lib/aiProcessor";
import { aiCache } from "../cache";
import { unifiedAICache } from "../../lib/unifiedAICache";
import { db } from "../db";
import { 
  transactions, 
  categories, 
  budgets, 
  goals,
  expenseReminders,
  users
} from "../../shared/schema";
import { eq, desc, lt, gte, sql, and } from "drizzle-orm";

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
      const uncategorized = transactions.filter(t => !t.categoryName || t.categoryName === 'Uncategorized');

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

      return res.json({ suggestions });
    } catch (error) {
      console.error("Error in auto-categorization:", error);
      return res.status(500).json({ message: "Failed to auto-categorize transactions" });
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
      return res.json({ category: result.category });
    } catch (error) {
      console.error("Error categorizing expense:", error);
      return res.status(500).json({ message: "Failed to categorize expense" });
    }
  });

  // AI Financial Tips endpoint with detailed transaction data
  app.post('/api/ai/tip', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "AI financial tips require premium plan" });
      }

      // Get financial data from request body (sent from frontend)
      const { financialData } = req.body;
      
      if (!financialData || !financialData.transactions) {
        return res.status(400).json({ message: "Financial data with transactions required" });
      }

      // Validate and process transaction data
      const transactions = financialData.transactions;
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return res.json({ tip: "Start by adding some transactions to get personalized financial insights." });
      }

      // Format transaction data for AI analysis with detailed information
      const formattedTransactions = transactions.map((t: any) => ({
        id: t.id,
        description: t.note || `${t.categoryName || 'Transaction'}`,
        amount: t.amount,
        date: t.date,
        categoryName: t.categoryName || 'Uncategorized',
        type: t.type,
        recurring: t.recurring,
        budgetAssigned: t.budgetAssigned
      }));

      // Check unified cache for financial tips
      const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const cachedResult = await unifiedAICache.get('financial-tips', userId, month, {
        totalIncome: financialData.totalIncome || 0,
        totalExpenses: financialData.totalExpenses || 0,
        transactions: formattedTransactions.slice(0, 50)
      });
      
      if (cachedResult && !financialData.timestamp) {
        console.log('AI financial tips: Using unified cache - avoiding API call');
        return res.json({ tip: `${cachedResult[0]?.title}: ${cachedResult[0]?.description}` });
      }

      console.log(`Processing ${formattedTransactions.length} transactions for AI analysis`);

      console.log('AI financial tips: Making Fly.io API call via centralized processor');
      
      const aiPayload = {
        totalIncome: financialData.totalIncome || 0,
        totalExpenses: financialData.totalExpenses || 0,
        transactionsByCategory: financialData.categories || [],
        recentTransactions: formattedTransactions,
        timestamp: financialData.timestamp
      };

      const tipResults = await runAI('financial-tips', userId, aiPayload);

      // Save to unified cache if not bypassing cache
      if (!financialData.timestamp && tipResults && tipResults.length > 0) {
        try {
          await unifiedAICache.set('financial-tips', userId, month, {
            totalIncome: financialData.totalIncome || 0,
            totalExpenses: financialData.totalExpenses || 0,
            transactions: formattedTransactions.slice(0, 50)
          }, tipResults);
          console.log('AI financial tips: Saved to unified cache');
        } catch (cacheError) {
          console.error("Error saving financial tips to unified cache:", cacheError);
        }
      }

      if (tipResults && tipResults.length > 0) {
        const tip = tipResults[0];
        return res.json({ tip: `${tip.title}: ${tip.description}` });
      } else {
        // Provide specific fallback based on actual data
        const expenseCount = transactions.filter((t: any) => t.type === 'expense').length;
        const incomeCount = transactions.filter((t: any) => t.type === 'income').length;
        const totalExpenses = transactions
          .filter((t: any) => t.type === 'expense')
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        const totalIncome = transactions
          .filter((t: any) => t.type === 'income')
          .reduce((sum: number, t: any) => sum + t.amount, 0);
          
        return res.json({ 
          tip: `Based on your ${expenseCount} expense transactions ($${totalExpenses.toFixed(2)}) and ${incomeCount} income transactions ($${totalIncome.toFixed(2)}), consider setting up budgets for your top spending categories to better manage your finances.` 
        });
      }
    } catch (error) {
      console.error("Error generating financial tip:", error);
      return res.status(500).json({ message: "Failed to generate financial tip" });
    }
  });

  // AI Spending Insights endpoint
  app.get('/api/ai/insights', isAuthenticated, async (req: any, res) => {
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

      // Standardize cache payload for spending insights
      const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const cachePayload = {
        transactions: transactions.slice(0, 100)
      };
      
      const cachedResult = await unifiedAICache.get('spending-insights', userId, month, cachePayload);
      
      if (cachedResult) {
        console.log('AI spending insights: Using unified cache - avoiding API call');
        return res.json(cachedResult);
      }

      console.log('AI spending insights: Making Fly.io API call via centralized processor');
      
      const aiPayload = {
        transactions: transactions.map(t => ({
          description: t.description,
          amount: parseFloat(t.amount),
          date: t.date.toISOString(),
          categoryName: t.categoryName || 'Uncategorized',
          type: t.type
        }))
      };

      const insights = await runAI('spending-insights', userId, aiPayload);
      
      // Save to unified cache
      try {
        await unifiedAICache.set('spending-insights', userId, month, cachePayload, insights);
        console.log('AI spending insights: Saved to unified cache');
      } catch (cacheError) {
        console.error("Error saving spending insights to unified cache:", cacheError);
      }

      return res.json(insights);
    } catch (error) {
      console.error("Error generating spending insights:", error);
      return res.status(500).json({ message: "Failed to generate spending insights" });
    }
  });

  // AI Financial Health Score (Standard+ required)
  app.post('/api/ai/financial-health-score', isAuthenticated, async (req: any, res) => {
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

      console.log('AI financial health score: Making Fly.io API call via centralized processor');
      
      const aiPayload = {
        summary,
        budgets: budgets || [],
        transactions: transactions.map(t => ({
          description: t.description,
          amount: parseFloat(t.amount),
          date: t.date.toISOString(),
          categoryName: t.categoryName || 'Uncategorized',
          type: t.type
        })),
        useAdvancedFactors
      };

      const aiScore = await runAI('financial-health-score', userId, aiPayload);

      return res.json(aiScore);
    } catch (error) {
      console.error("Error generating AI financial health score:", error);
      return res.status(500).json({ message: "Failed to generate AI financial health score" });
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
      const categories = await storage.getCategories(userId);
      const budgets = await storage.getUserBudgets(userId);

      // Check unified cache for trend predictions
      const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const cachedResult = await unifiedAICache.get('trend-predictions', userId, month, {
        transactions: transactions.slice(0, 100),
        budgets: budgets.slice(0, 20)
      });
      
      if (cachedResult) {
        console.log('AI trend predictions: Using unified cache - avoiding API call');
        return res.json(cachedResult);
      }

      console.log('AI trend predictions: Making Fly.io API call via centralized processor');
      
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
          }))
      };

      const predictions = await runAI('trend-predictions', userId, aiPayload);

      // Save to unified cache
      try {
        await unifiedAICache.set('trend-predictions', userId, month, {
          transactions: transactions.slice(0, 100),
          budgets: budgets.slice(0, 20)
        }, predictions);
        console.log('AI trend predictions: Saved to unified cache');
      } catch (cacheError) {
        console.error("Error saving trend predictions to unified cache:", cacheError);
      }

      return res.json(predictions);
    } catch (error) {
      console.error("Error generating trend predictions:", error);
      return res.status(500).json({ message: "Failed to generate trend predictions" });
    }
  });

  // Daily Recommendations endpoint (Premium only)
  app.post('/api/ai/daily-recommendations', isAuthenticated, async (req: any, res) => {
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

      console.log('DEBUG: Raw daily recommendations request data:', {
        transactionCount: transactions?.length || 0,
        firstTransactionStructure: transactions?.[0] || 'none',
        summaryReceived: summary || 'none',
        budgetCount: budgets?.length || 0
      });

      if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ message: "Transactions array is required" });
      }

      // Check minimum data requirements
      if (transactions.length < 3) {
        return res.json({
          recommendations: [],
          insights: [],
          message: "Add at least 3 transactions to get personalized daily recommendations"
        });
      }

      // Create stable hash for caching - only regenerate on significant changes
      const lastWeekTransactions = transactions?.filter(t => {
        const transactionDate = new Date(t.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return transactionDate >= weekAgo;
      }).length || 0;

      const dataForHash = {
        transactionCount: transactions?.length || 0,
        lastWeekTransactionCount: lastWeekTransactions,
        totalIncome: Math.round((summary?.totalIncome || 0) / 100) * 100, // Round to nearest $100
        totalExpenses: Math.round((summary?.totalExpenses || 0) / 100) * 100,
        budgetCount: budgets?.length || 0,
        currentWeek: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) // Weekly refresh
      };
      const dataHash = aiCache.createDataHash(dataForHash);

      // Standardize cache payload for daily recommendations
      const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const cachePayload = {
        summary,
        transactions: transactions.slice(0, 100),
        budgets
      };
      
      const cachedResult = await unifiedAICache.get('daily-recommendations', userId, month, cachePayload);
      
      if (cachedResult) {
        console.log('Daily recommendations: Using cached data');
        return res.json(cachedResult);
      }

      console.log('Making Fly.io API call via centralized processor');
      
      // Create categories object for the payload
      const categoriesData = await storage.getCategories(userId);
      const categories = {};
      categoriesData.forEach(cat => {
        categories[cat.id] = cat.name;
      });
      
      const aiPayload = {
        summary: summary || { totalIncome: 0, totalExpenses: 0, netAmount: 0 },
        transactions: transactions.slice(0, 100).map(t => ({
          id: t.id,
          amount: String(t.amount || 0),
          description: t.description || '',
          date: t.date || '',
          type: t.type || 'expense',
          categoryName: t.categoryName || 'Uncategorized'
        })),
        budgets: (budgets || []).map(b => ({
          id: b.id || 0,
          name: b.name || '',
          amount: String(b.amount || 0),
          categoryName: b.categoryName || 'Uncategorized',
          period: b.period || 'monthly'
        })),
        categories: categories
      };

      console.log('DEBUG: Daily recommendations payload being sent to Fly.io:', {
        transactionCount: aiPayload.transactions.length,
        summaryData: aiPayload.summary,
        budgetCount: aiPayload.budgets.length,
        categoryCount: Object.keys(aiPayload.categories || {}).length,
        hasActualTransactions: aiPayload.transactions.length > 0,
        firstTransaction: aiPayload.transactions[0] || 'none'
      });

      let recommendations = await runAI('daily-recommendations', userId, aiPayload);
      
      console.log('Daily recommendations: Received response from Fly.io:', {
        hasRecommendations: Array.isArray(recommendations?.recommendations),
        recommendationCount: recommendations?.recommendations?.length || 0,
        hasInsights: Array.isArray(recommendations?.insights),
        insightCount: recommendations?.insights?.length || 0,
        source: 'fly.io-external-service',
        actualRecommendations: recommendations?.recommendations || [],
        actualInsights: recommendations?.insights || []
      });

      // Force local fallback if Fly.io returns empty results
      if ((!recommendations?.recommendations || recommendations.recommendations.length === 0) && 
          (!recommendations?.insights || recommendations.insights.length === 0)) {
        console.log('Daily recommendations: Fly.io returned empty, using local fallback');
        console.log('Daily recommendations: Payload for local fallback:', {
          transactionCount: aiPayload.transactions?.length || 0,
          summaryData: aiPayload.summary,
          budgetCount: aiPayload.budgets?.length || 0,
          categoriesCount: Object.keys(aiPayload.categories || {}).length
        });
        
        try {
          const { generateDailyRecommendations } = await import('../../server/openai');
          const localResult = await generateDailyRecommendations(aiPayload);
          
          console.log('Daily recommendations: Local fallback result:', {
            localRecommendationCount: localResult?.recommendations?.length || 0,
            localInsightCount: localResult?.insights?.length || 0,
            sampleRecommendation: localResult?.recommendations?.[0] || 'none'
          });
          
          if (localResult && (localResult.recommendations?.length > 0 || localResult.insights?.length > 0)) {
            // Use local result instead of empty Fly.io result
            recommendations = localResult;
            console.log('Daily recommendations: Successfully using local fallback');
          } else {
            console.log('Daily recommendations: Local fallback also returned empty results');
          }
        } catch (localError) {
          console.error('Daily recommendations: Local fallback failed:', localError);
        }
      }



      // Save to unified cache system
      try {
        await unifiedAICache.set('daily-recommendations', userId, month, cachePayload, recommendations);
        console.log('Daily recommendations: Saved to cache');
      } catch (cacheError) {
        console.error("Error saving daily recommendations to cache:", cacheError);
      }

      return res.json(recommendations);
    } catch (error) {
      console.error("Error generating daily recommendations:", error);
      return res.status(500).json({ message: "Failed to generate daily recommendations" });
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
      const cachedResult = await unifiedAICache.get('financial-health', userId, month, stableFinancialData);
      
      if (cachedResult) {
        console.log('AI financial health: Using unified cache - avoiding API call');
        return res.json(cachedResult);
      }

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

      // Use unified AI processor for financial health score
      console.log('Financial health: Making Fly.io API call via centralized processor');
      const healthData = await runAI('financial-health-score', userId, {
        transactions: processedTransactions,
        budgets: processedBudgets,
        summary: {
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          netBalance: summary.totalIncome - summary.totalExpenses
        }
      });

      // Save to unified cache
      try {
        await unifiedAICache.set('financial-health', userId, month, stableFinancialData, healthData);
        console.log('Financial health: Saved to unified cache');
      } catch (cacheError) {
        console.error("Error saving financial health to unified cache:", cacheError);
      }

      return res.json(healthData);
    } catch (error) {
      console.error("Error generating financial health score:", error);
      return res.status(500).json({ message: "Failed to generate financial health score" });
    }
  });

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

  app.post('/api/mascot/generate', isAuthenticated, async (req: any, res) => {
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

      // Download the image from DALL-E and store it permanently
      const fetch = (await import('node-fetch')).default;
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const imageResponse = await fetch(tempImageUrl);
      if (!imageResponse.ok) {
        throw new Error("Failed to download generated image");
      }
      
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const filename = `mascot-${userId}-${Date.now()}.png`;
      
      let permanentImageUrl: string;
      
      try {
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'uploads', 'mascots');
        await fs.mkdir(uploadsDir, { recursive: true });
        
        // Store image permanently in local file system
        const filePath = path.join(uploadsDir, filename);
        await fs.writeFile(filePath, imageBuffer);
        
        // Create permanent URL for the stored image
        permanentImageUrl = `/uploads/mascots/${filename}`;
        console.log(`Mascot image stored permanently at: ${permanentImageUrl}`);
      } catch (storageError) {
        console.error("Failed to store image locally, using temporary URL:", storageError);
        // Fallback to temporary URL if local storage fails
        permanentImageUrl = tempImageUrl;
      }

      // Check if user already has a mascot
      const existingMascot = await storage.getUserMascot(userId);
      
      let mascot;
      if (existingMascot) {
        // Delete old image if it exists and is stored locally
        if (existingMascot.imageUrl && existingMascot.imageUrl.startsWith('/uploads/mascots/')) {
          try {
            const oldFilePath = path.join(process.cwd(), existingMascot.imageUrl);
            await fs.unlink(oldFilePath);
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
  app.post('/api/ai/expense-predictions', isAuthenticated, async (req: any, res) => {
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

      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return res.json({ 
          categoryPredictions: [],
          monthlyPredictions: []
        });
      }

      // Standardize cache payload for expense predictions  
      const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const cachePayload = {
        transactions: transactions.slice(0, 100)
      };
      
      const cachedResult = await unifiedAICache.get('expense-predictions', userId, month, cachePayload);
      
      if (cachedResult) {
        console.log('AI expense predictions: Using unified cache - avoiding API call');
        return res.json(cachedResult);
      }

      console.log('AI expense predictions: Making Fly.io API call via centralized processor');
      
      const aiPayload = {
        transactions: transactions.slice(0, 100),
        summary: req.body.summary || { totalIncome: 0, totalExpenses: 0, netAmount: 0 }
      };

      const predictions = await runAI('expense-predictions', userId, aiPayload);

      // Save to unified cache
      try {
        await unifiedAICache.set('expense-predictions', userId, month, cachePayload, predictions);
        console.log('AI expense predictions: Saved to unified cache');
      } catch (cacheError) {
        console.error("Error saving expense predictions to unified cache:", cacheError);
      }

      return res.json(predictions);
    } catch (error) {
      console.error("Error generating expense predictions:", error);
      return res.status(500).json({ message: "Failed to generate expense predictions" });
    }
  });

  // Help Chat Assistant endpoint
  app.post('/api/help-chat', async (req: any, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }

      const { openai } = await import('../openaiClient');

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant for FinanzerPro, a personal finance management application. 

FinanzerPro offers three subscription tiers:
- Free Plan: Basic transaction tracking (up to 100 transactions)
- Standard Plan ($4.99/month or $49.90/year): Enhanced features including budgeting, goals, transaction reminders, AI categorization, receipt OCR processing
- Premium Plan ($9.99/month or $99.90/year): Unlimited transactions, advanced analytics, AI insights, data export/import, cloud backup, predictions, recommendations

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
            content: message
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
}