import crypto from "crypto";
import { aiCache } from "../server/cache";

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
  const cacheKey = `${task}:${userId}:${hashObject(payload)}`;

  const cached = await checkCache(cacheKey);
  if (cached) {
    console.log(`AI [${task}]: using cached response.`);
    return cached;
  }

  try {
    const response = await fetch("https://finanserpro-ai-processor.fly.dev/execute-gpt-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, userId, payload })
    });

    if (!response.ok) {
      console.error(`[AI ${task}] HTTP error`, response.status);
      return { error: "GPT service unavailable" };
    }

    const result = await response.json();
    await storeCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`[AI ${task}] Failed to fetch from Fly.io`, err);
    return { error: "Fallback response due to GPT failure" };
  }
}