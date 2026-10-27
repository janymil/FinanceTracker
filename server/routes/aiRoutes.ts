import { log } from '../logger';
import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { aiGuard, getAiQuota } from "../aiAccess";
import { storage } from "../storage";
import { rateLimit } from "../middleware/rateLimit";
import { adminAuth } from "../adminAuth";
import { anonymizeText } from "../../shared/aiAnonymizer";
import { sumTransactionAmountsByType } from "../../shared/calculations";
import { budgetsForPeriod, calculateFinancialHealth, type FinancialHealth } from "../../shared/financialHealth";
import { presetRange, rangeStartFrom, rangeEndFrom, localParts } from "../../shared/timezones";
import { PLAN_PRICES, formatMoney } from "../../shared/pricing";
import { getUserLanguage } from "../categoryTranslations";
import { 
  categorizeExpense,
  type ExpenseCategorizationResult 
} from "../openai";
import { runAI, runMeteredAI } from "../../lib/aiProcessor";
import { generateMascotImage, stableIndexFromId } from "../mascotImage";
import { annotateEmptyReason } from "../../shared/dailyRecommendations";
import { isAIFailure, isDegraded } from "../../shared/aiResults";
import { contextualFallbackTips } from "../../shared/aiFallbacks";
import { AI_MODELS, getAIProviderStatus } from "../../lib/aiProvider";
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

/**
 * Sentences about the prompt instead of the person's money.
 *
 * The health prompt used to print its own payload limits ("22 transactions, first 20 listed"), and
 * the model dutifully reported them back: "the history lists 20 of 22 transactions, so two are not
 * shown", and a risk assessment that named "incomplete visibility" as the main risk. That is a note
 * to the developer, shown to the customer in place of advice. The prompt no longer says it and
 * forbids it; this is the belt to that braces, so the same sentence cannot reach a screen again
 * when a model decides to be helpful.
 */
const META_COMMENTARY = [
  /\bnot shown\b/i,
  /\bvisibility\b/i,
  /\blists? \d+ of \d+/i,
  /\b\d+ of \d+ (?:transactions|payments|rows)\b/i,
  /\bdetails (?:are|were) (?:only )?shown\b/i,
  /\bdata (?:provided|given|supplied)\b/i,
];

function isMetaCommentary(text: string): boolean {
  return META_COMMENTARY.some((pattern) => pattern.test(text));
}

/**
 * The window a health answer covers: the month the dashboard is showing, or this month.
 *
 * A date-only `yyyy-mm-dd` means that calendar day in the person's own zone, exactly as
 * `/api/financial-summary` reads it, so both cards describe the same days.
 * `null` means the caller sent dates that are not dates.
 */
function healthPeriod(req: any, timeZone: string): { start: Date; end: Date } | null {
  const startDate = req.query?.startDate;
  const endDate = req.query?.endDate;

  if (typeof startDate === 'string' && typeof endDate === 'string') {
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (!Number.isFinite(parsedStart.getTime()) || !Number.isFinite(parsedEnd.getTime())) {
      return null;
    }
    const start = rangeStartFrom(startDate, parsedStart, timeZone);
    const end = rangeEndFrom(endDate, parsedEnd, timeZone);
    return end < start ? null : { start, end };
  }

  return presetRange('month', timeZone);
}

/**
 * The calendar day of an instant in the person's zone, as `yyyy-mm-dd`.
 *
 * `period.end` is the last instant of the last day (23:59 in Lima, which is 04:59 the next day in
 * UTC), so slicing the ISO string would tell the model the period ended on the 1st of the
 * following month.
 */
function zonedDay(instant: Date, timeZone: string): string {
  const { year, month, day } = localParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The person's average monthly spend per category over the three months before `period`.
 *
 * Advice that compares a category with the person's own habit is advice ("you spent 62 on coffee,
 * usually 40"); advice that compares it with nothing is a description. The window is theirs, not a
 * fixed one: it starts three months before the period the dashboard is showing.
 *
 * A new account gets an empty map, not a baseline of zero - a zero baseline would make every
 * ordinary purchase look like a spike.
 */
async function usualMonthlySpendByCategory(
  userId: string,
  period: { start: Date; end: Date },
): Promise<Map<string, number>> {
  const monthsBack = 3;
  const until = new Date(period.start.getTime() - 24 * 60 * 60 * 1000);
  const since = new Date(period.start);
  since.setUTCMonth(since.getUTCMonth() - monthsBack);

  const rows = await storage.getTransactionsByDateRange(userId, since, until);

  const totals = new Map<string, { amount: number; months: Set<string> }>();
  for (const row of rows) {
    if (row.type !== 'expense') continue;
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;

    const name = row.categoryName || 'Other';
    const entry = totals.get(name) || { amount: 0, months: new Set<string>() };
    entry.amount += amount;
    entry.months.add(row.date.toISOString().slice(0, 7));
    totals.set(name, entry);
  }

  // Divided by the months that actually hold spending, so an account three weeks old is not
  // compared against a third of its own history.
  const averages = new Map<string, number>();
  totals.forEach((entry, name) => {
    const months = Math.max(1, Math.min(monthsBack, entry.months.size));
    averages.set(name, Number((entry.amount / months).toFixed(2)));
  });

  return averages;
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

  // The person's own AI allowance, for the meter in the app (Profile, pricing).
  // Login is required, but this is deliberately NOT behind aiGuard: a free account and a
  // blocked account must still be able to see the number and the upgrade path.
  app.get('/api/ai/usage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      const plan = user?.plan ?? 'free';
      const quota = await getAiQuota(userId, plan);

      return res.json({
        ...quota.state,
        breakdown: quota.breakdown,
        costThisMonth: Number(quota.costThisMonth.toFixed(6)),
      });
    } catch (error) {
      log.error("Error reading AI usage:", error);
      return res.status(500).json({ message: "Failed to read AI usage" });
    }
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
          
          // Use the correct categorization task based on transaction type. It goes through
          // runAI so the call is metered against this person like every other AI feature.
          const task = transaction.type === 'income'
            ? 'categorizeIncomeWithCategories'
            : 'categorizeExpenseWithCategories';
          const result = await runAI(task, userId, {
            description: transaction.description,
            amount: parseFloat(transaction.amount),
            language,
            userCategories: categoryList,
          }, user.plan || 'free');

          // A failed answer is not a suggestion
          if (isAIFailure(result) || result?.failed) continue;

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
          log.error(`Failed to categorize transaction ${transaction.id}:`, error);
        }
      }

      return res.json({ suggestions });
    } catch (error) {
      log.error("Error in auto-categorization:", error);
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
      
      // Metered like every other AI call: runAI writes the usage row for this person.
      const task = type === 'income' ? 'categorizeIncomeWithCategories' : 'categorizeExpenseWithCategories';
      const result = await runAI(task, userId, {
        description,
        amount: amount || 0,
        language,
        userCategories: categoryList,
      }, user.plan || 'free');
      
      if (isAIFailure(result) || result?.failed) return aiUnavailable(res);

      return res.json({
        category: result.suggestedCategory || `Category ID: ${result.categoryId}`,
        categoryId: result.categoryId,
        confidence: result.confidence,
        reasoning: result.reasoning
      });
    } catch (error) {
      log.error("Error categorizing expense:", error);
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
        log.error('TIP ENDPOINT: Unexpected response format:', {
          type: typeof tipResults,
          isArray: Array.isArray(tipResults),
          keys: tipResults ? Object.keys(tipResults) : 'null',
        });
        return res.status(500).json({ message: "Failed to generate financial tip" });
      }

      // Cache the successful result for 168 hours (7 days). A fixed stand-in is rebuilt every
      // time instead: keeping it for a week would show old text as if it were today's advice.
      if (!isDegraded(tipResults)) await cache.set(aiPayload, responseData, false, 168);

      return res.json(responseData);
    } catch (error) {
      log.error("Error generating financial tip:", error);
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
      log.error("Error generating spending insights:", error);
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

      const { summary, budgets } = req.body;

      const transactions = await storage.getUserTransactions(userId, 100);

      log.info('AI financial advice: calling the AI processor');
      
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
      const adviceData = await runAI('financial-health-score', userId, aiPayload, user.plan || 'free');
      if (isAIFailure(adviceData)) return aiUnavailable(res);

      /*
       * The number comes from the rubric, not from the model.
       *
       * This endpoint used to return whatever total the model wrote, so the same month could come
       * back as 71 here and 78 on the dashboard. The model now supplies only the advice.
       */
      const health = calculateFinancialHealth({
        totalIncome: Number(summary?.totalIncome || 0),
        totalExpenses: Number(summary?.totalExpenses || 0),
        budgetTotal: Array.isArray(budgets)
          ? budgets.reduce((total: number, budget: any) => total + Number(budget?.amount || 0), 0)
          : 0,
      });

      const response = { ...adviceData, score: health.score, category: health.band, factors: health.factors };

      // Cache the result for 24 hours
      await cache.set(aiPayload, response, false, 24);

      return res.json(response);
    } catch (error) {
      log.error("Error generating AI financial health score:", error);
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
      log.error("Error generating trend predictions:", error);
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
        budgets: (Array.isArray(budgets) ? budgets : []).map((b: any) => {
          /*
           * `spent` was missing from this payload, so the model saw "Groceries: 650" and nothing
           * else: it could not tell a budget that was over from one that had not started, and its
           * "budget_review" recommendation had no figure to stand on. Counted here, from the same
           * transactions the model is shown.
           */
          const categoryName = b.categoryName || b.name;
          const spent = transactions
            .filter((t: any) => t.type === 'expense' && (t.categoryName || '') === categoryName)
            .reduce((total: number, t: any) => total + (Number(t.amount) || 0), 0);

          return {
            id: b.id,
            name: b.name,
            amount: String(b.amount),
            categoryName: b.categoryName,
            period: b.period,
            spent,
          };
        }),
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
      log.error("Error generating daily recommendations:", error);
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

      /*
       * The window this answer is about.
       *
       * The dashboard passes the month it is showing; without that, this month. The old code asked
       * for "the last 100 transactions" — a rolling window that begins at an arbitrary date and
       * describes no period at all. It also fed the model six months of spending next to one
       * month's budget, which is why the advice said both "expenses are below income" and
       * "spending exceeds budgets" in the same breath.
       */
      const timeZone = await storage.getUserTimeZone(userId);
      const period = healthPeriod(req, timeZone);
      if (!period) {
        return res.status(400).json({ message: "Start date and end date must be valid dates" });
      }

      // The same window the score card uses. `getUserBudgets` attaches `spent` per budget over
      // that budget's own dates, so the model never reads October's spending against May's budget.
      const transactions = await storage.getTransactionsByDateRange(userId, period.start, period.end);
      const periodBudgets = budgetsForPeriod(
        await storage.getUserBudgets(userId, timeZone),
        period.start,
        period.end,
      );
      
      // Summed in integer cents. Adding `parseFloat(t.amount)` accumulated binary-float drift,
      // so a total could be 1246.30000000000004 — which the anonymiser then read as a long
      // account number and the model turned into "income was 1246.[account]".
      const totalIncome = sumTransactionAmountsByType(transactions, 'income');
      const totalExpenses = sumTransactionAmountsByType(transactions, 'expense');
      const budgetTotal = periodBudgets.reduce(
        (total, budget) => total + Number(budget.amount || 0),
        0,
      );

      /*
       * The number is computed here, not by the model.
       *
       * `shared/financialHealth` is the rubric the score card prints in its tooltip, so the badge
       * on this card and the score beside it are the same number by construction. The model is
       * still asked for the sentences: what is going well, what is not, and what to do next.
       */
      const health = calculateFinancialHealth({ totalIncome, totalExpenses, budgetTotal });

      // Process transactions with category names
      const processedTransactions = transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        description: t.description,
        date: t.date.toISOString(),
        type: t.type,
        categoryName: t.categoryName || 'Other'
      }));

      // `spent` comes from the budget itself (its own dates), not from whatever the window holds.
      const processedBudgets = periodBudgets
        .filter(b => b.categoryName)
        .map(b => ({
          categoryName: b.categoryName as string,
          amount: b.amount,
          spent: Number(b.spent || 0),
        }));

      // Get user language from consistent header detection
      const language = getUserLanguage(req);

      /*
       * What the adviser needs to give advice instead of a report.
       *
       * It used to get one month's totals and twenty transaction lines, so the only true sentence it
       * could write was "expenses were X". These two blocks hand it the shape of the month: every
       * category with its share and the person's own usual level, and the largest single payments,
       * which is where a subscription or an avoidable charge actually shows up.
       */
      const byCategory = new Map<string, { amount: number; purchases: number }>();
      const byPayment = new Map<string, { amount: number; count: number }>();
      for (const transaction of transactions) {
        if (transaction.type !== 'expense') continue;
        const amount = Number(transaction.amount);
        if (!Number.isFinite(amount)) continue;

        const categoryName = transaction.categoryName || 'Other';
        const category = byCategory.get(categoryName) || { amount: 0, purchases: 0 };
        category.amount += amount;
        category.purchases += 1;
        byCategory.set(categoryName, category);

        const description = (transaction.description || '').trim();
        if (description) {
          const payment = byPayment.get(description) || { amount: 0, count: 0 };
          payment.amount += amount;
          payment.count += 1;
          byPayment.set(description, payment);
        }
      }

      const usualByCategory = await usualMonthlySpendByCategory(userId, period);

      const categories = Array.from(byCategory.entries())
        .sort((left, right) => right[1].amount - left[1].amount)
        .slice(0, 12)
        .map(([name, { amount, purchases }]) => ({
          name,
          amount: Number(amount.toFixed(2)),
          share: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0,
          purchases,
          average: Number((amount / purchases).toFixed(2)),
          previousAverage: usualByCategory.get(name) ?? null,
        }));

      const topMerchants = Array.from(byPayment.entries())
        .sort((left, right) => right[1].amount - left[1].amount)
        .slice(0, 5)
        .map(([description, { amount, count }]) => ({
          description,
          amount: Number(amount.toFixed(2)),
          count,
        }));

      const aiPayload = {
        transactions: processedTransactions,
        budgets: processedBudgets,
        categories,
        topMerchants,
        summary: {
          totalIncome,
          totalExpenses,
          netBalance: totalIncome - totalExpenses
        },
        // Stated explicitly: "for the period shown" needs a period, or the model invents one.
        period: {
          start: zonedDay(period.start, timeZone),
          end: zonedDay(period.end, timeZone)
        },
        language: language
      };

      // Initialize UnifiedAICache with 24 hours TTL
      const cache = new UnifiedAICache('financial-health-score', userId);

      // Try to get cached result. Only the narrative is cached: the score is recomputed on every
      // request, so a stale entry can never put a stale number in front of the person.
      const cachedResult = await cache.get(aiPayload);
      if (cachedResult) {
        return res.json(transformAIResponseForMascot(cachedResult, health));
      }

      // Use unified AI processor for financial health score
      const healthData = await runAI('financial-health-score', userId, aiPayload, user.plan || 'free');
      if (isAIFailure(healthData)) return aiUnavailable(res);

      // Transform AI analysis into frontend-expected format
      const response = transformAIResponseForMascot(healthData, health);

      // Cache the result for 24 hours
      await cache.set(aiPayload, healthData, false, 24);

      return res.json(response);
    } catch (error) {
      log.error("Error generating financial health score:", error);
      return res.status(500).json({ message: "Failed to generate financial health score" });
    }
  });

  // Helper function to transform AI response for mascot component
  /**
   * Turns the model's narrative plus the computed score into what the card renders.
   *
   * Four things changed here, all of them symptoms of the same "two scores" problem:
   *
   *  - the number comes from `health` (the shared rubric), never from the model's own total;
   *  - achievements and warnings come from the computed factors, so a month scored 100 cannot
   *    show "0 achievements" while a factor is at its maximum;
   *  - the model's advice lands in `advice`, an array of objects the "Advice" tab renders with its
   *    reason beside each action. It used to be flattened into `warnings`, so the tab was a list of
   *    imperatives with nothing behind them, and the same text also appeared among the observations;
   *  - `category` is the band that goes with the number, so the mascot's face and the badge agree.
   */
  function transformAIResponseForMascot(aiData: any, health: FinancialHealth) {
    const insights: string[] = [];
    const warnings: string[] = [];

    // The adviser's observations, one sentence each, already in the person's language.
    if (Array.isArray(aiData.aiAnalysis?.personalizedFactors)) {
      insights.push(...aiData.aiAnalysis.personalizedFactors);
    }

    /*
     * The advice, kept as objects instead of flattened to strings.
     *
     * Flattened, the panel showed "Cap food at 500" with no reason, which reads like an order from
     * a machine that does not know the month. The reason - "Food reached 620, 120 over the budget"
     * - is the part that makes it believable and the part the person can check.
     */
    const advice: Array<{ action: string; reason: string; impact: string; priority: 'high' | 'medium' | 'low' }> =
      Array.isArray(aiData.aiAnalysis?.recommendations)
        ? aiData.aiAnalysis.recommendations
            .map((rec: any) => (typeof rec === 'string'
              ? { action: rec.trim(), reason: '', impact: '', priority: 'medium' as const }
              : {
                  action: String(rec?.action || '').trim(),
                  reason: String(rec?.reason || '').trim(),
                  impact: String(rec?.impact || '').trim(),
                  priority: (rec?.priority === 'high' || rec?.priority === 'low' ? rec.priority : 'medium') as 'high' | 'medium' | 'low',
                }))
            .filter((rec: { action: string }) => rec.action && !isMetaCommentary(rec.action))
            .slice(0, 5)
        : [];

    /*
     * Only the risk line stays in `warnings`. The actions used to be pushed here as well, so the
     * same advice appeared twice: once as a string in this list and once as a card.
     */
    if (typeof aiData.aiAnalysis?.riskAssessment === 'string' && aiData.aiAnalysis.riskAssessment.trim()) {
      warnings.push(aiData.aiAnalysis.riskAssessment.trim());
    }

    return {
      score: health.score,
      trend: aiData.trend || 'stable',
      category: health.band,
      summary: typeof aiData.aiAnalysis?.summary === 'string' ? aiData.aiAnalysis.summary.trim() : '',
      insights: insights.filter((line) => !isMetaCommentary(line)).slice(0, 10), // Limit to 10 insights
      // The strengths tab is computed from `factors` on the client; this field stays for the shape.
      achievements: [],
      warnings: warnings.filter((line) => !isMetaCommentary(line)).slice(0, 3),
      advice,
      factors: health.factors,
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
      log.error("Error fetching mascot:", error);
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
      const uniqueTraits = [
        "wearing glasses", "with a bow tie", "holding a tiny calculator", "with a small hat",
        "wearing a vest", "with a monocle", "holding coins", "with a briefcase",
        "wearing suspenders", "with a pocket watch", "holding a chart", "with a cape"
      ];
      const colorSchemes = [
        "blue and gold", "green and silver", "purple and white", "orange and blue",
        "red and gold", "teal and cream", "pink and gray", "navy and yellow"
      ];
      
      const uniqueTrait = uniqueTraits[stableIndexFromId(userId, uniqueTraits.length)];
      const colorScheme = colorSchemes[stableIndexFromId(userId, colorSchemes.length)];
      
      /*
       * One stable character, varied only in mood, accessory and palette: the picture is
       * regenerated as the health score changes, and without a fixed description the same person
       * got a different creature every time. "Advisor" is also gone - the rest of the app is
       * careful never to call itself that.
       */
      const prompt = `A cute, friendly money-helper mascot: a small round creature with short ears, a simple friendly face and stubby arms - always the same character, shown here feeling ${mood}: ${personalityTraits[mood as keyof typeof personalityTraits]}. It is ${uniqueTrait} and the palette is ${colorScheme}. Modern, clean, approachable cartoon style, polished flat background, no text, no logos.`;

      // Hero image, metered: image generation is the most expensive single call in the app,
      // so it must use up allowance like the text features do. The model list and the
      // "bytes or URL" handling live in server/mascotImage.ts.
      const generated = await runMeteredAI('mascot-image', userId, user.plan || 'free', () =>
        generateMascotImage(prompt)
      );

      const imageBuffer = generated.bytes;
      const filename = `mascot-${userId}-${Date.now()}.png`;
      log.info(`Mascot image generated with ${generated.model} (${imageBuffer.length} bytes)`);

      // Store it permanently in Bunny CDN
      const { bunnyStorage } = await import('../bunnyStorage');
      
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
        log.error("Failed to store image on CDN, falling back to local storage:", storageError);
        
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
          log.error("Failed to store image locally as well:", localError);
          if (!generated.temporaryUrl) {
            throw new Error("The generated mascot image could not be stored");
          }
          // Last resort - use the provider URL (it expires in about an hour)
          permanentImageUrl = generated.temporaryUrl;
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
            log.warn("Failed to delete old mascot image:", error);
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
      log.error("Error generating mascot:", error);
      return res.status(500).json({ message: "Failed to generate mascot", code: "mascot_generation_failed" });
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
      log.error("Error toggling mascot:", error);
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
      log.error("Error generating expense predictions:", error);
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
        // Deliberately NOT with the shared house rules: those forbid the word "bank", and the
        // help screen has to be able to say "import a bank statement". The rules that matter
        // here (no advice, no invented figures, no vendor names, no prices) are in the prompt.
        model: AI_MODELS.generation,
        messages: [
          {
            role: "system",
            content: `You are the in-app help assistant for Kaptia, a personal budgeting application.

WHAT KAPTIA DOES:
- Tracking income and expenses: typed by hand, or read from a photo of a receipt
- Budgets and savings goals
- Sorting spending into categories, automatically as well
- A financial health score, spending insights, spending forecasts and daily suggestions
- Export and import of the person's own data, and a backup

PLANS:
- Free Plan: basic transaction tracking (up to 100 transactions)
- Standard Plan (${formatMoney(PLAN_PRICES.standard.usd.monthly, 'usd')}/month or ${formatMoney(PLAN_PRICES.standard.usd.yearly, 'usd')}/year; in Peru ${formatMoney(PLAN_PRICES.standard.pen.monthly, 'pen')}/month): budgets, goals, transaction reminders, automatic categorisation, receipt scanning
- Premium Plan (${formatMoney(PLAN_PRICES.premium.usd.monthly, 'usd')}/month or ${formatMoney(PLAN_PRICES.premium.usd.yearly, 'usd')}/year; in Peru ${formatMoney(PLAN_PRICES.premium.pen.monthly, 'pen')}/month): unlimited transactions, deeper analytics, insights, forecasts, data export and import, cloud backup

HOW TO ANSWER:
- Answer about the app, its plans and how to use it. For a general money question, give one
  practical budgeting sentence and point to the screen in the app; do not give financial advice.
- You cannot see the person's account, their transactions or their plan. Never claim that you can
  and never invent a figure from their data: say which screen shows the number instead.
- If something is not working, name the first two things to check (the plan in Profile, the AI
  switch in Profile, a login that needs renewing) and point to the help page.
- Be brief: three sentences, unless the question is a step-by-step "how do I".
- Answer in the language the person wrote in.

NEVER:
- promise a refund, a discount, a feature that does not exist, or a date when something will ship;
- name the companies that provide login, payments or document processing;
- quote a price that is not in the two lists above.

It is fine to say "bank statement" when describing the import feature. Do not otherwise recommend
a bank, a loan, a card or an investment.`
          },
          {
            role: "user",
            // Anonymous visitors may paste anything: strip e-mails, phones, card numbers, IDs.
            content: anonymizeText(message).text
          }
        ],
        // A help answer is short and factual; 0.7 produced wandering replies about general finance.
        temperature: 0.4,
        max_tokens: 500
      });

      const assistantResponse = response.choices[0].message.content || "I'm sorry, I couldn't generate a response. Please try again.";

      return res.json({ response: assistantResponse });
    } catch (error) {
      log.error("Error in help chat:", error);
      return res.status(500).json({ message: "Failed to get help response" });
    }
  });

  // Contextual Financial Tips endpoint (moved from contextualFinancialTipsRoutes.ts)
  app.post('/api/ai/contextual-financial-tips', isAuthenticated, aiGuard(), async (req: any, res) => {
    try {
      log.info('🎯 [CONTEXTUAL-TIPS] Starting request processing...');
      const userId = getUserId(req);
      if (!userId) {
        log.error('🚨 [CONTEXTUAL-TIPS] No userId found');
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
        log.error('🚨 [CONTEXTUAL-TIPS] AI failed:', aiError.message);
        return res.json({ tips: generateFallbackTips(safeSummary, safeTransactions, safeBudgets, language) });
      }
      
      // The model could not be reached: rule-based tips in the person's language, never cached.
      if (isAIFailure(result)) {
        log.error('🚨 AI returned an error for contextual tips');
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
      log.error("Error generating contextual financial tips:", {
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
        log.error("Error generating fallback tips:", fallbackError);
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