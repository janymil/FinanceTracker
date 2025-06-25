// Cache system completely removed - direct Fly.io calls only
import crypto from 'crypto';

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
  console.log(`[AI ${task}] Direct Fly.io call - NO CACHE`);
  console.log(`[AI ${task}] PAYLOAD BEING SENT TO FLY.IO:`, JSON.stringify(payload, null, 2));

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
      const errorText = await response.text();
      console.error(`[AI ${task}] Fly.io error details:`, errorText);
      throw new Error(`Fly.io processor failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[AI ${task}] SUCCESS: Fly.io response received (direct call, no caching)`);
    return result;

  } catch (error: any) {
    console.error(`[AI ${task}] Fly.io error - returning empty result:`, error.message);
    
    // Return proper error structures - no fallback data
    return { 
      error: 'AI service temporarily unavailable', 
      message: 'Unable to process request at this time' 
    };
  }
}