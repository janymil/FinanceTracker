import crypto from "crypto";
import { aiCache } from "../server/cache";
import { openai } from "../server/openaiClient";

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
    // Try unified endpoint first
    const response = await fetch("https://finanserpro-ai-processor.fly.dev/execute-gpt-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, userId, payload })
    });

    if (response.ok) {
      const result = await response.json();
      await storeCache(cacheKey, result);
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
          await storeCache(cacheKey, result);
          console.log(`[AI ${task}] Success via legacy endpoint`);
          return result;
        }
      }
    }

    // If no Fly.io endpoint available, use local OpenAI for contextual-tips
    if (task === 'contextual-tips') {
      console.log(`[AI ${task}] Using local OpenAI fallback`);
      return await handleContextualTipsLocally(payload);
    }

    throw new Error(`No available endpoint for task: ${task}`);

  } catch (err) {
    console.error(`[AI ${task}] All endpoints failed:`, err.message);
    
    // Final fallback structures
    switch (task) {
      case 'daily-recommendations':
        return { recommendations: [], insights: [] };
      case 'financial-tips':
        return { tip: {} };
      case 'contextual-tips':
        return { tips: [] };
      default:
        return {};
    }
  }
}

// Local OpenAI fallback for contextual tips (preserves original prompt)
async function handleContextualTipsLocally(payload: any) {
  const { summary, transactions, budgets, selectedMonth } = payload;
  
  const messages = [
    {
      role: "system",
      content: `You are a financial advisor AI that provides personalized financial tips based on user data. 

Generate 4 contextual financial tips that are:
- Specific to their spending patterns and financial situation
- Actionable with clear next steps
- Relevant to their current month's activity
- Focused on improvement opportunities

Categories: spending, saving, budgeting, income
Priorities: high, medium, low

Respond with JSON in this exact format:
{
  "tips": [
    {
      "id": "tip_1",
      "title": "Clear, actionable tip title",
      "description": "Detailed explanation with specific recommendations and dollar amounts when relevant",
      "category": "spending|saving|budgeting|income",
      "priority": "high|medium|low",
      "actionable": true
    }
  ]
}`
    },
    {
      role: "user",
      content: `Month: ${selectedMonth}

Summary: ${JSON.stringify(summary)}

Recent Transactions: ${JSON.stringify(transactions?.slice(0, 10) || [])}

Budgets: ${JSON.stringify(budgets || [])}

Generate contextual financial tips based on this data.`
    }
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 1000
  });

  const result = JSON.parse(response.choices[0].message.content || '{"tips":[]}');
  return result;
}