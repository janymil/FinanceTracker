// Centralized AI Processor with Fly.io Primary + Local Fallback
import crypto from 'crypto';
import { 
  generateContextualFinancialTips,
  generateFinancialTips,
  generateDailyRecommendations,
  generateSpendingInsights,
  generateAIFinancialHealthScore,
  generateTrendPredictions,
  generateExpensePredictions
} from '../server/openai.js';

function hashObject(obj: any): string {
  const json = JSON.stringify(obj);
  return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * Centralized AI Processor for Fly.io Integration
 * Simple interface: runAI(task, userId, payload)
 * Handles: GPT Execution, Retry/Fallback, OpenAI Key Handling
 */
export async function runAI(task: string, userId: string, payload: Record<string, any>) {
  console.log(`[AI ${task}] Direct Fly.io call with local fallback`);

  try {
    console.log(`[AI ${task}] Calling Fly.io processor...`);
    const response = await fetch("https://finanzerpro.fly.dev/execute-gpt-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task,
        userId,
        payload
      })
    });

    if (!response.ok) {
      console.error(`[AI ${task}] Fly.io error:`, response.status, response.statusText);
      throw new Error(`Fly.io processor failed: ${response.status}`);
    }

    const result = await response.json();
    
    // Check if result is empty or error
    if (result?.error || !result || (Array.isArray(result) && result.length === 0)) {
      console.log(`[AI ${task}] Fly.io returned empty/error result, triggering local fallback`);
      throw new Error('Empty or error response from Fly.io');
    }

    console.log(`[AI ${task}] SUCCESS: Fly.io response received`);
    return result;

  } catch (error: any) {
    console.error(`[AI ${task}] Fly.io failed, attempting local fallback:`, error.message);
    
    try {
      let fallbackResult;
      
      switch (task) {
        case 'contextual-tips':
          fallbackResult = await generateContextualFinancialTips(payload, payload.language || 'en-us');
          break;
        case 'financial-tips':
          fallbackResult = await generateFinancialTips(payload, payload.language || 'en-us');
          break;
        case 'daily-recommendations':
          fallbackResult = await generateDailyRecommendations(payload, payload.language || 'en-us');
          break;
        case 'spending-insights':
          fallbackResult = await generateSpendingInsights(payload.transactions, payload.language || 'en-us');
          break;
        case 'financial-health-score':
          fallbackResult = await generateAIFinancialHealthScore(payload, payload.language || 'en-us');
          break;
        case 'trend-predictions':
          fallbackResult = await generateTrendPredictions(payload.transactions, payload.budgets, payload.language || 'en-us');
          break;
        case 'expense-predictions':
          fallbackResult = await generateExpensePredictions(userId, payload.transactions);
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
}