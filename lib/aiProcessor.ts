import { unifiedAICache } from "./unifiedAICache";

function hashObject(obj: any): string {
  const json = JSON.stringify(obj);
  return crypto.createHash("sha256").update(json).digest("hex");
}

async function checkCache(key: string) {
  return aiCache.get(key);
}

async function storeCache(key: string, value: any) {
  // Use default 30 minute cache for most AI tasks
  aiCache.set(key, value, 1800);
}

/**
 * Centralized AI Processor for Fly.io Integration
 * Simple interface: runAI(task, userId, payload)
 * Handles: GPT Execution, Smart Caching, Retry/Fallback, OpenAI Key Handling
 */
export async function runAI(task: string, userId: string, payload: Record<string, any>) {
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  // Try to get cached result using unified cache
  const cached = await unifiedAICache.get(task, userId, month, payload);
  if (cached) {
    console.log(`[AI ${task}] Using unified cache for ${month}`);
    return cached;
  }

  try {
    // Try unified endpoint first
    const response = await fetch("https://finanzerpro.fly.dev/execute-gpt-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, userId, payload })
    });

    if (response.ok) {
      const result = await response.json();
      
      // Check if daily-recommendations returned empty results and force fallback
      if (task === 'daily-recommendations' && (!result.recommendations || result.recommendations.length === 0) && (!result.insights || result.insights.length === 0)) {
        console.log(`[AI ${task}] Fly.io returned empty results, forcing local fallback`);
        throw new Error('Empty results from Fly.io, using local fallback');
      }
      
      await unifiedAICache.set(task, userId, month, payload, result);
      console.log(`[AI ${task}] Success via unified endpoint`);
      return result;
    }

    // All tasks should use unified endpoint - no fallback to legacy  
    console.error(`[AI ${task}] Unified endpoint failed: ${response.status} ${response.statusText}`);
    throw new Error(`Unified endpoint failed for task: ${task}`);

  } catch (err) {
    console.error(`[AI ${task}] CRITICAL ERROR: Task ${task} failed to reach Fly.io:`, err.message);
    console.error(`[AI ${task}] Full error details:`, err);
    
    // Import and use local functions as fallback
    try {
      const { 
        generateSpendingInsights, 
        generateExpensePredictions, 
        generateContextualFinancialTips, 
        generateDailyRecommendations,
        generateFinancialTips,
        generateTrendPredictions,
        generateAIFinancialHealthScore
      } = await import('../server/openai');
      
      if (task === 'spending-insights') {
        console.log(`[AI ${task}] Using local fallback for spending-insights`);
        const result = await generateSpendingInsights(payload.transactions || []);
        try {
          await unifiedAICache.set(task, userId, month, payload, result);
          console.log(`[AI ${task}] Local fallback result saved to cache`);
        } catch (cacheError) {
          console.error(`[AI ${task}] Failed to save fallback to cache:`, cacheError);
        }
        return result;
      }
      
      if (task === 'expense-predictions') {
        console.log(`[AI ${task}] Using local fallback for expense-predictions`);
        const result = await generateExpensePredictions(payload.transactions || []);
        try {
          await unifiedAICache.set(task, userId, month, payload, result);
          console.log(`[AI ${task}] Local fallback result saved to cache`);
        } catch (cacheError) {
          console.error(`[AI ${task}] Failed to save fallback to cache:`, cacheError);
        }
        return result;
      }
      
      if (task === 'contextual-tips') {
        console.log(`[AI ${task}] Using local fallback for contextual-tips`);
        const result = await generateContextualFinancialTips(payload);
        try {
          await unifiedAICache.set(task, userId, month, payload, result);
          console.log(`[AI ${task}] Local fallback result saved to cache`);
        } catch (cacheError) {
          console.error(`[AI ${task}] Failed to save fallback to cache:`, cacheError);
        }
        return result;
      }
      
      if (task === 'daily-recommendations') {
        console.log(`[AI ${task}] Using local fallback for daily-recommendations`);
        const result = await generateDailyRecommendations(payload);
        // CRITICAL: Save fallback result to cache
        try {
          await unifiedAICache.set(task, userId, month, payload, result);
          console.log(`[AI ${task}] Local fallback result saved to cache`);
        } catch (cacheError) {
          console.error(`[AI ${task}] Failed to save fallback to cache:`, cacheError);
        }
        return result;
      }
      
      if (task === 'financial-tips') {
        console.log(`[AI ${task}] Using local fallback for financial-tips`);
        const result = await generateFinancialTips(payload);
        try {
          await unifiedAICache.set(task, userId, month, payload, result);
          console.log(`[AI ${task}] Local fallback result saved to cache`);
        } catch (cacheError) {
          console.error(`[AI ${task}] Failed to save fallback to cache:`, cacheError);
        }
        return result;
      }
      
      if (task === 'trend-predictions') {
        console.log(`[AI ${task}] Using local fallback for trend-predictions`);
        const result = await generateTrendPredictions(payload.transactions || [], payload.budgets || []);
        try {
          await unifiedAICache.set(task, userId, month, payload, result);
          console.log(`[AI ${task}] Local fallback result saved to cache`);
        } catch (cacheError) {
          console.error(`[AI ${task}] Failed to save fallback to cache:`, cacheError);
        }
        return result;
      }
      
      if (task === 'financial-health-score') {
        console.log(`[AI ${task}] Using local fallback for financial-health-score`);
        const result = await generateAIFinancialHealthScore(payload);
        try {
          await unifiedAICache.set(task, userId, month, payload, result);
          console.log(`[AI ${task}] Local fallback result saved to cache`);
        } catch (cacheError) {
          console.error(`[AI ${task}] Failed to save fallback to cache:`, cacheError);
        }
        return result;
      }
    } catch (localError) {
      console.error(`[AI ${task}] Local fallback also failed:`, localError.message);
    }
    
    // For other tasks, return empty structures to make the problem visible
    switch (task) {
      case 'daily-recommendations':
        return { recommendations: [], insights: [], error: 'Fly.io service unavailable' };
      case 'financial-tips':
        return { tip: {}, error: 'Fly.io service unavailable' };
      case 'contextual-tips':
        return { tips: [], error: 'Fly.io service unavailable' };
      default:
        return { error: 'Fly.io service unavailable' };
    }
  }
}