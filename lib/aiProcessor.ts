// Centralized AI entry point: prompts live in server/openai.ts, routing in lib/aiProvider.ts
import crypto from 'crypto';
import { storage } from '../server/storage.js';
import { reportSwallowed } from '../server/errorGuard/report.js';
import { collectAIUsage, type AIUsageRecord } from './aiProvider';
import { isAIFailure } from '../shared/aiResults';
import {
  categorizeExpense,
  voiceExtraction,
  generateContextualFinancialTips,
  generateFinancialTips,
  generateDailyRecommendations,
  generateSpendingInsights,
  generateAIFinancialHealthScore,
  generateTrendPredictions,
  generateExpensePredictions,
  parseBankStatement
} from '../server/openai.js';

function hashObject(obj: any): string {
  const json = JSON.stringify(obj);
  return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * AI usage tracking wrapper
 */
async function trackAIUsage(
  userId: string, 
  functionName: string, 
  userPlan: string,
  fn: () => Promise<any>
): Promise<any> {
  const startTime = Date.now();
  let result: any = null;
  let status = 'success';
  let errorMessage: string | null = null;
  let usageRecords: AIUsageRecord[] = [];

  try {
    // Check usage limits before processing
    const accessCheck = await storage.canUseAIFunction(userId, functionName, userPlan);
    if (!accessCheck.allowed) {
      throw new Error(accessCheck.reason || 'Usage limit exceeded');
    }

    // Execute the AI function and capture real provider usage
    const collected = await collectAIUsage(fn);
    result = collected.result;
    usageRecords = collected.records;

    if (usageRecords.some((record) => record.fallback)) {
      status = 'fallback';
    }
    // The "service unavailable" payload is a failure even though nothing threw.
    if (isAIFailure(result)) {
      status = 'error';
      errorMessage = String((result as any)?.error ?? 'AI failure');
    }

    return result;
  } catch (error: any) {
    status = 'error';
    errorMessage = error.message;
    throw error;
  } finally {
    const executionTime = Date.now() - startTime;
    
    // Log usage data with real token counts and cost
    const promptTokens = usageRecords.reduce((total, record) => total + record.inputTokens, 0);
    const completionTokens = usageRecords.reduce((total, record) => total + record.outputTokens, 0);
    const totalCost = usageRecords.reduce((total, record) => total + record.costUsd, 0);
    try {
      await storage.recordAIUsage({
        userId,
        functionName,
        model: usageRecords[0]?.model ?? 'none',
        cost: totalCost.toFixed(6),
        tokensUsed: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        executionTime,
        language: 'en-us',
        plan: userPlan,
        status,
        errorMessage,
        cached: false,
        requestSize: 0,
        responseSize: result ? JSON.stringify(result).length : 0,
        ipAddress: null,
        userAgent: null
      });
    } catch (logError) {
      reportSwallowed(logError, { where: 'runAI.recordUsage', fallback: 'usage not recorded' });
      console.error('Failed to log AI usage:', logError);
    }
  }
}

/** Runs one task. Every task gets the person's language. */
async function runDirect(task: string, userId: string, payload: Record<string, any>, userPlan: string): Promise<any> {
  const language: string = payload.language || 'en-us';

  switch (task) {
    case 'voice-extraction':
      return voiceExtraction(userId, payload as any, userPlan);
    case 'contextual-tips':
      return generateContextualFinancialTips(userId, payload as any, language);
    case 'financial-tips':
      return generateFinancialTips(userId, payload as any, language);
    case 'daily-recommendations':
      return generateDailyRecommendations(userId, payload as any, language);
    case 'spending-insights':
      return generateSpendingInsights(userId, payload.transactions, language);
    case 'financial-health-score':
      return generateAIFinancialHealthScore(payload as any, language);
    case 'trend-predictions':
      return generateTrendPredictions(userId, payload.transactions, payload.budgets, language);
    case 'expense-predictions':
      return generateExpensePredictions(userId, payload.transactions, language);
    case 'categorizeExpense':
      return categorizeExpense(
        payload.description,
        payload.amount,
        language,
        payload.userTransactions || [],
        payload.userCategories || [],
      );
    case 'parseBankStatement':
      return parseBankStatement(payload.text, language);
    default:
      throw new Error(`No direct provider path for task: ${task}`);
  }
}

/**
 * Centralized AI entry point: runAI(task, userId, payload, userPlan)
 *
 * Every task builds its prompt here in the app (server/openai.ts is the only copy) and sends it
 * through lib/aiProvider, which tries the ai-processor gateway first and falls back to calling
 * the providers directly. This function handles usage tracking and passes the language on.
 * On total failure it returns `{ error, message }` — callers must check `isAIFailure`.
 */
export async function runAI(task: string, userId: string, payload: Record<string, any>, userPlan: string = 'free') {
  return await trackAIUsage(userId, task, userPlan, async () => {
    try {
      return await runDirect(task, userId, payload, userPlan);
    } catch (error: any) {
      // Highest-value swallow in the app: the feature degrades to an error payload.
      reportSwallowed(error, { where: 'runAI', fallback: 'errorPayload', route: `/ai/${task}` });
      console.error(`[AI ${task}] all providers failed:`, error?.message || error);
      return {
        error: 'AI service temporarily unavailable',
        message: 'Unable to process request at this time',
      };
    }
  });
}
