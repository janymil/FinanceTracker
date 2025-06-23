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
    const response = await fetch("https://finanserpro-ai-processor-v2.fly.dev/execute-gpt-task", {
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

    // All tasks should use unified endpoint - no fallback to legacy  
    console.error(`[AI ${task}] Unified endpoint failed: ${response.status} ${response.statusText}`);
    throw new Error(`Unified endpoint failed for task: ${task}`);

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