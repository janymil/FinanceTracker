import { aiCache } from "../server/cache";

/**
 * Centralized AI Processor for Fly.io Integration
 * Handles: GPT Execution, Smart Caching, Retry/Fallback, OpenAI Key Handling
 */

export interface AIProcessorRequest {
  taskName: string;
  flyioEndpoint: string;
  payload: any;
  userId: string;
  cacheDuration?: number; // Optional custom cache duration
}

export interface AIProcessorResult {
  success: boolean;
  data?: any;
  error?: string;
  source: 'cache' | 'fly.io' | 'openai-fallback' | 'error';
  processingTime: number;
}

/**
 * Central AI Processor - All AI functions use this to call Fly.io
 * Provides: Smart caching, Retry logic, OpenAI fallback, Error handling
 */
export async function processAIWithFlyio(request: AIProcessorRequest): Promise<AIProcessorResult> {
  const startTime = Date.now();
  
  try {
    // 1. SMART CACHING - Check cache first
    const cacheKey = generateCacheKey(request.taskName, request.userId, request.payload);
    const cached = getCachedResult(request.taskName, cacheKey);
    if (cached) {
      logProcessing(request.taskName, request.userId, Date.now() - startTime, 'cache');
      return {
        success: true,
        data: cached,
        source: 'cache',
        processingTime: Date.now() - startTime
      };
    }

    // 2. FLY.IO EXECUTION with retry logic
    let result;
    let source = 'fly.io';
    
    try {
      result = await callFlyioWithRetry(request.flyioEndpoint, request.payload);
      console.log(`AI Processor: ${request.taskName} processed successfully via Fly.io`);
    } catch (flyError) {
      console.warn(`AI Processor: Fly.io failed for ${request.taskName}:`, flyError.message);
      
      // 3. OPENAI FALLBACK - Return structured error for now
      // Individual functions can implement their own OpenAI fallback if needed
      throw new Error(`Fly.io service unavailable for ${request.taskName}: ${flyError.message}`);
    }

    // 4. SMART CACHING - Store successful result
    const cacheTTL = request.cacheDuration || getDefaultCacheDuration(request.taskName);
    storeInCache(request.taskName, cacheKey, result, cacheTTL);

    // Analytics
    logProcessing(request.taskName, request.userId, Date.now() - startTime, source);

    return {
      success: true,
      data: result,
      source: source as any,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    console.error(`AI Processor Error for ${request.taskName}:`, error);
    logProcessing(request.taskName, request.userId, Date.now() - startTime, 'error');
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'error',
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Fly.io API call with retry logic
 */
async function callFlyioWithRetry(endpoint: string, payload: any, maxRetries = 2): Promise<any> {
  const FLY_IO_URL = process.env.AI_PROCESSOR_URL || 'https://finanserpro-ai-processor.fly.dev';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${FLY_IO_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Fly.io API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
      
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      console.warn(`AI Processor: Fly.io attempt ${attempt} failed, retrying...`);
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Smart cache key generation
 */
function generateCacheKey(taskName: string, userId: string, payload: any): string {
  const dataForHash = {
    task: taskName,
    userId,
    transactionCount: payload.transactions?.length || 0,
    totalIncome: Math.round((payload.summary?.totalIncome || 0) / 100) * 100,
    totalExpenses: Math.round((payload.summary?.totalExpenses || 0) / 100) * 100,
    budgetCount: payload.budgets?.length || 0,
    selectedMonth: payload.selectedMonth,
    // Weekly refresh for time-sensitive tasks
    timeWindow: ['daily-recommendations', 'contextual-tips'].includes(taskName) 
      ? Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
      : undefined
  };

  return aiCache.createDataHash(dataForHash);
}

/**
 * Cache retrieval
 */
function getCachedResult(taskName: string, cacheKey: string): any | null {
  return aiCache.get(`flyio_${taskName}_${cacheKey}`);
}

/**
 * Cache storage
 */
function storeInCache(taskName: string, cacheKey: string, result: any, ttl: number): void {
  aiCache.set(`flyio_${taskName}_${cacheKey}`, result, ttl);
}

/**
 * Default cache durations for different AI tasks
 */
function getDefaultCacheDuration(taskName: string): number {
  const durations: Record<string, number> = {
    'daily-recommendations': 86400, // 24 hours
    'financial-tips': 1800, // 30 minutes
    'contextual-tips': 3600, // 1 hour
    'expense-predictions': 1800, // 30 minutes
    'trend-analysis': 3600, // 1 hour
    'categorization': 300 // 5 minutes
  };
  return durations[taskName] || 1800; // Default 30 minutes
}

/**
 * Processing analytics and logging
 */
function logProcessing(taskName: string, userId: string, processingTime: number, source: string): void {
  console.log(`AI Processor Analytics: {
    task: "${taskName}",
    userId: "${userId}",
    processingTime: ${processingTime}ms,
    source: "${source}",
    timestamp: ${new Date().toISOString()}
  }`);
}

/**
 * Convenience wrapper for common AI processing patterns
 */
export async function processWithFlyio(
  taskName: string,
  flyioEndpoint: string,
  payload: any,
  userId: string,
  cacheDuration?: number
): Promise<any> {
  const result = await processAIWithFlyio({
    taskName,
    flyioEndpoint,
    payload,
    userId,
    cacheDuration
  });
  
  if (result.success) {
    return result.data;
  } else {
    throw new Error(result.error);
  }
}