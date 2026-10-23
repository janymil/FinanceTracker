// Centralized AI Processor with Fly.io Primary + Local Fallback
import crypto from 'crypto';
import { storage } from '../server/storage.js';
import { reportSwallowed } from '../server/errorGuard/report.js';
import { collectAIUsage, type AIUsageRecord } from './aiProvider';
import { 
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

/**
 * Optional AI processor service (external-services/ai-processor).
 *
 * Disabled by default: the app calls OpenAI/DeepSeek/Groq directly through lib/aiProvider.
 * Once the service is deployed (162.35.25.125 / ai-processor.formatika.dev), set:
 *   AI_PROCESSOR_ENABLED=true
 *   AI_PROCESSOR_URL=https://ai-processor.formatika.dev
 * A failed processor is skipped for 5 minutes so a dead host never adds latency.
 */
const PROCESSOR_TIMEOUT_MS = Number(process.env.AI_PROCESSOR_TIMEOUT_MS) || 20_000;
const PROCESSOR_COOLDOWN_MS = Number(process.env.AI_PROCESSOR_COOLDOWN_MS) || 300_000;
let processorDownUntil = 0;

function isProcessorEnabled(): boolean {
  return process.env.AI_PROCESSOR_ENABLED === 'true' && Boolean(process.env.AI_PROCESSOR_URL);
}

async function callAIProcessor(task: string, userId: string, payload: Record<string, any>): Promise<any | null> {
  if (!isProcessorEnabled() || Date.now() < processorDownUntil) return null;

  const baseUrl = String(process.env.AI_PROCESSOR_URL).replace(/\/+$/, '');
  const timeoutMs = task === 'parseBankStatement'
    ? Math.max(PROCESSOR_TIMEOUT_MS, 120_000)
    : PROCESSOR_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/execute-gpt-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, userId, payload }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`processor HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result || result.error || (Array.isArray(result) && result.length === 0)) {
      throw new Error('empty processor response');
    }

    return result;
  } catch (error: any) {
    processorDownUntil = Date.now() + PROCESSOR_COOLDOWN_MS;
    console.warn(
      `[AI ${task}] AI processor unavailable (${error?.message || error}); ` +
      `using direct providers for ${Math.round(PROCESSOR_COOLDOWN_MS / 60000)} min`,
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Centralized AI Processor for Fly.io Integration
 * Simple interface: runAI(task, userId, payload, userPlan)
 * Handles: GPT Execution, Retry/Fallback, OpenAI Key Handling, Usage Tracking
 */
export async function runAI(task: string, userId: string, payload: Record<string, any>, userPlan: string = 'free') {
  // Wrap the AI execution with usage tracking
  return await trackAIUsage(userId, task, userPlan, async () => {
    console.log(`[AI ${task}] Processing (AI processor ${isProcessorEnabled() ? 'enabled' : 'disabled'}, direct providers ready)`);

    try {
    if (!isProcessorEnabled() || Date.now() < processorDownUntil) {
      throw new Error('AI processor disabled or cooling down');
    }
    console.log(`[AI ${task}] Calling AI processor...`);
    
    // Log contextual tips specific data
    if (task === 'contextual-tips') {
      console.log('[AI contextual-tips] Request payload:', {
        hasSummary: !!payload.summary,
        hasTransactions: !!payload.transactions,
        transactionCount: payload.transactions?.length || 0,
        language: payload.language
      });
    }
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROCESSOR_TIMEOUT_MS);
    
    const response = await fetch(`${String(process.env.AI_PROCESSOR_URL || 'https://ai-processor.formatika.dev').replace(/\/+$/, '')}/execute-gpt-task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.AI_PROCESSOR_API_KEY ? { "x-api-key": process.env.AI_PROCESSOR_API_KEY } : {}),
      },
      body: JSON.stringify({
        task,
        userId,
        payload
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[AI ${task}] Fly.io error:`, response.status, response.statusText);
      throw new Error(`Fly.io processor failed: ${response.status}`);
    }

    const result = await response.json();
    
    // Log contextual tips response
    if (task === 'contextual-tips') {
      console.log('[AI contextual-tips] Fly.io response:', {
        hasResult: !!result,
        hasError: !!result?.error,
        hasTips: !!result?.tips,
        tipsCount: result?.tips?.length || 0,
        resultKeys: result ? Object.keys(result) : []
      });
    }
    
    // Check if result is empty or error
    if (result?.error || !result || (Array.isArray(result) && result.length === 0)) {

      throw new Error('Empty or error response from Fly.io');
    }

    return result;

    } catch (error: any) {
      processorDownUntil = Date.now() + PROCESSOR_COOLDOWN_MS;
      // The user still gets an answer from the local fallback, so nothing throws — which is
      // exactly why this must be reported explicitly (blueprint 07 §17.1).
      reportSwallowed(error, {
        where: 'runAI.processor',
        fallback: 'local',
        route: `/ai/${task}`,
      });
      console.error(`[AI ${task}] AI processor unavailable:`, error.message || error);
      
      try {
        console.log(`[AI ${task}] Attempting local fallback...`);
        let fallbackResult;
        
        switch (task) {
          case 'voice-extraction':
            fallbackResult = await import('../server/openai.js').then(m => 
              m.voiceExtraction(userId, payload as any, userPlan)
            );
            break;
          case 'contextual-tips':
            console.log('[AI contextual-tips] Running local fallback with payload:', {
              hasSummary: !!payload.summary,
              hasTransactions: !!payload.transactions,
              transactionCount: payload.transactions?.length || 0,
              language: payload.language || 'en-us'
            });
            fallbackResult = await generateContextualFinancialTips(userId, payload as any, payload.language || 'en-us');
            console.log('[AI contextual-tips] Local fallback result:', {
              hasResult: !!fallbackResult,
              hasTips: !!fallbackResult?.tips,
              tipsCount: fallbackResult?.tips?.length || 0
            });
            break;
          case 'financial-tips':
            fallbackResult = await generateFinancialTips(userId, payload as any);
            break;
          case 'daily-recommendations':
            fallbackResult = await generateDailyRecommendations(userId, payload as any, payload.language || 'en-us');
            break;
          case 'spending-insights':
            fallbackResult = await generateSpendingInsights(userId, payload.transactions);
            break;
          case 'financial-health-score':
            fallbackResult = await generateAIFinancialHealthScore(payload as any, payload.language || 'en-us');
            break;
          case 'trend-predictions':
            fallbackResult = await generateTrendPredictions(userId, payload.transactions, payload.budgets);
            break;
          case 'expense-predictions':
            fallbackResult = await generateExpensePredictions(userId, payload.transactions);
            break;
          case 'categorizeExpense':
            const { categorizeExpense } = await import('../server/openai');
            fallbackResult = await categorizeExpense(
              payload.description, 
              payload.amount, 
              payload.language || 'en-us',
              payload.userTransactions || [],
              payload.userCategories || []
            );
            break;
          case 'parseBankStatement':
            fallbackResult = await parseBankStatement(payload.text, payload.language || 'en-us');
            break;
          default:
            throw new Error(`No local fallback available for task: ${task}`);
        }
        
        console.log(`[AI ${task}] SUCCESS: Local fallback completed`);
        return fallbackResult;
      } catch (fallbackError: any) {
        // Both the service and the local path failed: the feature silently degrades to a
        // canned error payload. Highest-value swallow in the app.
        reportSwallowed(fallbackError, {
          where: 'runAI.localFallback',
          fallback: 'errorPayload',
          route: `/ai/${task}`,
        });
        console.error(`[AI ${task}] Local fallback also failed:`, fallbackError.message);
        return { 
          error: 'AI service temporarily unavailable', 
          message: 'Unable to process request at this time' 
        };
      }
    }
  });
}