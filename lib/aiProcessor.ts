// Centralized AI Processor with Fly.io Primary + Local Fallback
import crypto from 'crypto';
import { storage } from '../server/storage.js';
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
  let result = null;
  let status = 'success';
  let errorMessage = null;

  try {
    // Check usage limits before processing
    const accessCheck = await storage.canUseAIFunction(userId, functionName, userPlan);
    if (!accessCheck.allowed) {
      throw new Error(accessCheck.reason || 'Usage limit exceeded');
    }

    // Execute the AI function
    result = await fn();
    
    return result;
  } catch (error: any) {
    status = 'error';
    errorMessage = error.message;
    throw error;
  } finally {
    const executionTime = Date.now() - startTime;
    
    // Log usage data (basic tracking for now)
    try {
      await storage.recordAIUsage({
        userId,
        functionName,
        model: 'gpt-4o', // Default model
        cost: '0.001', // Default cost, will be updated with real data later
        tokensUsed: 0,
        promptTokens: 0,
        completionTokens: 0,
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
      console.error('Failed to log AI usage:', logError);
    }
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
    console.log(`[AI ${task}] Direct Fly.io call with local fallback`);

    try {
    console.log(`[AI ${task}] Calling Fly.io processor...`);
    
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
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for bank statement processing
    
    const response = await fetch("http://31.97.103.28:8080/execute-gpt-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      console.error(`[AI ${task}] Fly.io service failed:`, error.message || error);
      
      try {
        console.log(`[AI ${task}] Attempting local fallback...`);
        let fallbackResult;
        
        switch (task) {
          case 'contextual-tips':
            console.log('[AI contextual-tips] Running local fallback with payload:', {
              hasSummary: !!payload.summary,
              hasTransactions: !!payload.transactions,
              transactionCount: payload.transactions?.length || 0,
              language: payload.language || 'en-us'
            });
            fallbackResult = await generateContextualFinancialTips(userId, payload, payload.language || 'en-us');
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
            fallbackResult = await generateDailyRecommendations(userId, payload, payload.language || 'en-us');
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
        console.error(`[AI ${task}] Local fallback also failed:`, fallbackError.message);
        return { 
          error: 'AI service temporarily unavailable', 
          message: 'Unable to process request at this time' 
        };
      }
    }
  });
}