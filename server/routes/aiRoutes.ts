import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage } from "../categoryTranslations";
import { 
  categorizeExpense,
  type ExpenseCategorizationResult 
} from "../openai";
import { runAI } from "../../lib/aiProcessor";
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
        return res.json({ message: "No uncategorized transactions found" });
      }

      // Process up to 10 transactions at a time to avoid rate limits
      const suggestions = [];
      const limit = Math.min(uncategorized.length, 10);

      for (let i = 0; i < limit; i++) {
        const transaction = uncategorized[i];
        try {
          // Get user language from consistent header detection
          const language = getUserLanguage(req);
          const result = await categorizeExpense(transaction.description, parseFloat(transaction.amount), language);
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

      const result = await categorizeExpense(description, amount);
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

      // Handle fetch_cached mode
      const { mode, financialData } = req.body;
      
      if (mode === 'fetch_cached') {
        // Get the most recent cached tip directly from database
        const recentEntry = await storage.getRecentAICacheEntry(userId, 'financial-tips');
        
        if (recentEntry && recentEntry.output) {
          return res.json({ tip: recentEntry.output });
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
      const tipResults = await runAI('financial-tips', userId, aiPayload);

      // Handle AI processor response format
      console.log('TIP ENDPOINT: AI processor response type:', typeof tipResults, 'isArray:', Array.isArray(tipResults));
      
      if (tipResults?.error) {
        console.error('TIP ENDPOINT: AI processor returned error:', tipResults.error);
        return res.status(500).json({ message: "AI service temporarily unavailable" });
      }

      let responseData;
      if (Array.isArray(tipResults) && tipResults.length > 0) {
        // AI processor returns array of tips directly
        responseData = { tips: tipResults };
        console.log('TIP ENDPOINT: Using array format, tips count:', tipResults.length);
      } else if (tipResults && typeof tipResults === 'object' && tipResults.tip) {
        // Legacy single tip format
        responseData = { tip: tipResults.tip };
        console.log('TIP ENDPOINT: Using legacy tip format');
      } else if (tipResults && typeof tipResults === 'object' && tipResults.tips) {
        // Wrapped tips format
        responseData = tipResults;
        console.log('TIP ENDPOINT: Using wrapped tips format');
      } else {
        console.error('TIP ENDPOINT: Unexpected response format:', {
          type: typeof tipResults,
          isArray: Array.isArray(tipResults),
          keys: tipResults ? Object.keys(tipResults) : 'null',
          content: tipResults
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
      const insights = await runAI('spending-insights', userId, aiPayload);

      // Cache the result for 72 hours
      await cache.set(aiPayload, insights, false, 72);

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
        budgets: budgets,
        transactions: transactions.map(t => ({
          description: t.description,
          amount: parseFloat(t.amount),
          date: t.date.toISOString(),
          categoryName: t.categoryName || 'Uncategorized',
          type: t.type
        })),
        useAdvancedFactors
      };

      // Initialize UnifiedAICache with 24 hours TTL
      const cache = new UnifiedAICache('financial-health-score', userId);

      // Try to get cached result
      const cachedResult = await cache.get(aiPayload);
      if (cachedResult) {
        return res.json(cachedResult);
      }

      // Generate new AI response
      const aiScore = await runAI('financial-health-score', userId, aiPayload);

      // Cache the result for 24 hours
      await cache.set(aiPayload, aiScore, false, 24);
      
      console.log('Financial health: Fly.io response structure:', {
        hasScore: typeof aiScore?.score === 'number',
        score: aiScore?.score,
        hasStatus: !!aiScore?.status,
        status: aiScore?.status,
        fullResponse: aiScore
      });

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

      // Initialize UnifiedAICache with 48 hours TTL
      const cache = new UnifiedAICache('trend-predictions', userId);

      // Try to get cached result
      const cachedResult = await cache.get(aiPayload);
      if (cachedResult) {
        return res.json(cachedResult);
      }

      // Generate new AI response
      const predictions = await runAI('trend-predictions', userId, aiPayload);

      // Cache the result for 48 hours
      await cache.set(aiPayload, predictions, false, 48);

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

      // Create categories object for the payload
      const categoriesData = await storage.getCategories(userId);
      const categories = {};
      categoriesData.forEach(cat => {
        categories[cat.id] = cat.name;
      });
      
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
        budgets: budgets.map(b => ({
          id: b.id,
          name: b.name,
          amount: String(b.amount),
          categoryName: b.categoryName,
          period: b.period
        })),
        categories: categories
      };

      // Initialize UnifiedAICache with 24 hours TTL
      const cache = new UnifiedAICache('daily-recommendations', userId);

      // Create stable date-based cache key instead of using full transaction data
      const todayKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const cacheKey = { date: todayKey, userId: userId };

      // Try to get cached result using date-based key
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult) {
        console.log('Daily recommendations: Using cached result for date:', todayKey);
        return res.json(cachedResult);
      }

      // Generate new AI response
      let recommendations = await runAI('daily-recommendations', userId, aiPayload);
      
      console.log('Daily recommendations: Received response from Fly.io:', {
        hasRecommendations: Array.isArray(recommendations?.recommendations),
        recommendationCount: recommendations?.recommendations?.length || 0,
        hasInsights: Array.isArray(recommendations?.insights),
        insightCount: recommendations?.insights?.length || 0,
        source: 'fly.io-external-service',
        actualRecommendations: recommendations?.recommendations,
        actualInsights: recommendations?.insights
      });

      console.log('Daily recommendations: Fly.io response structure:', {
        hasRecommendations: !!recommendations?.recommendations,
        recommendationCount: recommendations?.recommendations?.length || 0,
        hasInsights: !!recommendations?.insights,
        insightCount: recommendations?.insights?.length || 0,
        fullResponse: recommendations
      });

      // Cache the result for 24 hours using date-based key
      await cache.set(cacheKey, recommendations, false, 24);
      console.log('Daily recommendations: Cached new result for date:', todayKey);

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

      // Debug logging to trace user data collection
      console.log('=== FINANCIAL HEALTH DATA COLLECTION DEBUG ===');
      console.log('User ID:', userId);
      console.log('Raw transactions count:', transactions.length);
      console.log('Raw budgets count:', budgets.length);
      console.log('Processed transactions count:', processedTransactions.length);
      console.log('Sample transactions:', processedTransactions.slice(0, 3));
      console.log('Summary:', summary);
      console.log('AI Payload:', JSON.stringify(aiPayload, null, 2));
      console.log('==============================================');

      // Initialize UnifiedAICache with 24 hours TTL
      const cache = new UnifiedAICache('financial-health-score', userId);

      // Try to get cached result - DISABLED FOR DEBUGGING
      // const cachedResult = await cache.get(aiPayload);
      // if (cachedResult) {
      //   return res.json(cachedResult);
      // }

      // Use unified AI processor for financial health score
      const healthData = await runAI('financial-health-score', userId, aiPayload);

      // Debug: Log the response structure to understand the data flow
      console.log('=== FINANCIAL HEALTH DEBUG ===');
      console.log('Raw AI Response:', JSON.stringify(healthData, null, 2));
      console.log('Has insights:', healthData?.insights?.length || 0);
      console.log('Has achievements:', healthData?.achievements?.length || 0);
      console.log('Has warnings:', healthData?.warnings?.length || 0);
      console.log('================================');

      // Cache the result for 24 hours
      await cache.set(aiPayload, healthData, false, 24);

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

      // Always call Fly.io even with empty data for testing
      console.log('EXPENSE PREDICTIONS: Processing with', transactions.length, 'transactions');

      // Filter expense transactions for consistent cache hashing
      const expenseTransactions = transactions
        .filter(t => t.type === 'expense')
        .slice(0, 100)
        .map(t => ({
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

      // Generate new AI response with full payload
      const aiPayload = {
        transactions: transactions.slice(0, 100),
        summary: req.body.summary || { totalIncome: 0, totalExpenses: 0, netAmount: 0 }
      };
      const predictions = await runAI('expense-predictions', userId, aiPayload);

      // Cache the result for 48 hours using consistent input
      await cache.set(cacheInput, predictions, false, 48);

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

  // Contextual Financial Tips endpoint (moved from contextualFinancialTipsRoutes.ts)
  app.post('/api/ai/contextual-financial-tips', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { transactions, summary, budgets, goals, selectedMonth } = req.body;

      console.log('🔥 Contextual tips API request received:', {
        userId: userId?.substring(0, 8) + '...',
        selectedMonth,
        transactionCount: transactions?.length || 0,
        hasIncome: summary?.totalIncome > 0,
        hasExpenses: summary?.totalExpenses > 0,
        budgetCount: budgets?.length || 0,
        goalsCount: goals?.length || 0,
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
        language: getUserLanguage(req)
      };

      // Initialize UnifiedAICache with 72 hours TTL
      const cache = new UnifiedAICache('contextual-tips', userId);

      // Try to get cached result
      const cachedResult = await cache.get(aiPayload);
      if (cachedResult) {
        // Return cached tips with proper formatting
        const tips = Array.isArray(cachedResult?.tips) ? cachedResult.tips.map((tip: any, index: number) => ({
          id: tip.id || `tip_${Date.now()}_${index}`,
          title: tip.title || 'Financial Tip',
          description: tip.description || 'No description available',
          category: ['spending', 'saving', 'budgeting', 'income'].includes(tip.category) ? tip.category : 'budgeting',
          priority: ['high', 'medium', 'low'].includes(tip.priority) ? tip.priority : 'medium',
          actionable: Boolean(tip.actionable)
        })) : [];
        
        return res.json({ tips });
      }

      // Generate new AI response
      const result = await runAI('contextual-tips', userId, aiPayload);
      
      // Handle centralized processor response
      const tips = Array.isArray(result?.tips) ? result.tips.map((tip: any, index: number) => ({
        id: tip.id || `tip_${Date.now()}_${index}`,
        title: tip.title || 'Financial Tip',
        description: tip.description || 'No description available',
        category: ['spending', 'saving', 'budgeting', 'income'].includes(tip.category) ? tip.category : 'budgeting',
        priority: ['high', 'medium', 'low'].includes(tip.priority) ? tip.priority : 'medium',
        actionable: Boolean(tip.actionable)
      })) : [];

      // Cache the result for 72 hours
      await cache.set(aiPayload, { tips }, false, 72);

      return res.json({ tips });
    } catch (error) {
      console.error("Error generating contextual financial tips:", error);
      return res.status(500).json({ message: "Failed to generate contextual financial tips" });
    }
  });
}