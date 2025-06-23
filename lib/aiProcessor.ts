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
    const response = await fetch("https://finanserpro-ai-processor.fly.dev/execute-gpt-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, userId, payload })
    });

    if (response.ok) {
      const result = await response.json();
      await unifiedAICache.set(task, userId, month, payload, result);
      console.log(`[AI ${task}] Success via unified endpoint`);
      return result;
    }

    // If unified endpoint fails, try legacy endpoints
    if (response.status === 404) {
      console.log(`[AI ${task}] Unified endpoint not available, trying legacy`);
      const legacyEndpoints = {
        'daily-recommendations': '/generate-daily-recommendation',
        'financial-tips': '/generate-financial-tip'
      };
      
      const endpoint = legacyEndpoints[task];
      if (endpoint) {
        const legacyResponse = await fetch(`https://finanserpro-ai-processor.fly.dev${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        if (legacyResponse.ok) {
          const result = await legacyResponse.json();
          await unifiedAICache.set(task, userId, month, payload, result);
          console.log(`[AI ${task}] Success via legacy endpoint`);
          return result;
        }
      }
    }

    // No fallback for new functions - must use Fly.io
    console.error(`[AI ${task}] No Fly.io endpoint available - migration incomplete`);
    throw new Error(`Task ${task} requires Fly.io deployment`);

  } catch (err) {
    console.error(`[AI ${task}] Fly.io service failed:`, err.message);
    
    // Only return empty structures for critical failures
    // This makes problems visible instead of hiding them
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