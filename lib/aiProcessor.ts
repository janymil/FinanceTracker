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
  // Check unified cache first
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const cachedResult = await unifiedAICache.get(task, userId, month, payload);
  
  if (cachedResult) {
    console.log(`[AI ${task}] Using cached result - avoiding API call`);
    return cachedResult;
  }
  
  console.log(`[AI ${task}] Cache miss - calling Fly.io processor`);

  try {
    console.log(`[AI ${task}] Testing Fly.io connectivity...`);
    // Try unified endpoint first
    const response = await fetch("https://finanzerpro.fly.dev/execute-gpt-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, userId, payload }),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    console.log(`[AI ${task}] Fly.io fetch completed, status: ${response.status}`);

    console.log(`[AI ${task}] Fly.io response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[AI ${task}] Fly.io error:`, response.status, response.statusText);
      const errorText = await response.text();
      console.error(`[AI ${task}] Fly.io error details:`, errorText);
      throw new Error(`Fly.io processor failed: ${response.status}`);
    }

    if (response.ok) {
      const result = await response.json();
      
      // Only force fallback for actual error responses, not empty data
      console.log(`[AI ${task}] SUCCESS: Fly.io returned valid response (may be empty due to insufficient data)`);
      
      // Don't fall back on empty results - that's valid when user has no data
      // if (task === 'daily-recommendations' && (!result.recommendations || result.recommendations.length === 0) && (!result.insights || result.insights.length === 0)) {
      //   console.log(`[AI ${task}] Fly.io returned empty results, forcing local fallback`);
      //   throw new Error('Empty results from Fly.io, using local fallback');
      // }
      
      // Only force fallback for explicit fallback markers, not empty data
      // if (task === 'contextual-tips' && result.tips && result.tips.length === 1 && result.tips[0].id === 'fallback_tip') {
      //   console.log(`[AI ${task}] Fly.io returned fallback tip, forcing local fallback`);
      //   throw new Error('Fallback response from Fly.io, using local fallback');
      // }
      
      console.log(`[AI ${task}] SUCCESS: Using Fly.io response (not local fallback)`);
      
      try {
        console.log(`[AI ${task}] ATTEMPTING to cache result for user ${userId.substring(0, 8)}... in month ${month}`);
        await unifiedAICache.set(task, userId, month, payload, result);
        console.log(`[AI ${task}] SUCCESS: Cached result via unified endpoint`);
      } catch (cacheError) {
        console.error(`[AI ${task}] CRITICAL: Failed to cache Fly.io result:`, cacheError);
        console.error(`[AI ${task}] Cache error details:`, {
          message: cacheError.message,
          stack: cacheError.stack,
          task,
          userId: userId.substring(0, 8) + '...',
          month
        });
      }
      return result;
    }

    // If Fly.io returns error status, throw to trigger fallback
    console.error(`[AI ${task}] Fly.io endpoint failed: ${response.status} ${response.statusText}`);
    throw new Error(`Fly.io endpoint failed with status ${response.status} for task: ${task}`);

  } catch (err) {
    console.error(`[AI ${task}] CRITICAL ERROR: Fly.io completely unreachable:`, err.message);
    console.error(`[AI ${task}] Network/timeout error - falling back to local OpenAI`);
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
        console.log(`[AI ${task}] FALLBACK: Network/timeout error - using local OpenAI`);
        const result = await generateSpendingInsights(payload.transactions || []);
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
        console.log(`[AI ${task}] FALLBACK: Network/timeout error - using local OpenAI`);
        const result = await generateContextualFinancialTips(payload);
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