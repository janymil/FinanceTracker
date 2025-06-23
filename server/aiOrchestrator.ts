import { aiCache } from "./cache";
import { openai } from "./openaiClient";

// Mandatory AI Infrastructure Layer
// ALL AI functions must pass through this centralized system
export interface AIInfrastructureRequest {
  taskName: string;
  userId: string;
  userPlan: string;
  dataPayload: any;
  aiLogicFunction: () => Promise<any>; // Each function's unique AI logic
  flyioEndpoint?: string; // Fly.io endpoint if available
  cacheDuration?: number; // Custom cache duration
}

/**
 * MANDATORY AI INFRASTRUCTURE LAYER
 * All AI functions must call this - handles the 6 core infrastructure tasks:
 * 1. Smart caching
 * 2. Fly.io processing  
 * 3. OpenAI fallback
 * 4. Error recovery
 * 5. User verification
 * 6. Data security
 */
export async function processAIRequest(request: AIInfrastructureRequest): Promise<any> {
  const startTime = Date.now();
  
  try {
    // 1. USER VERIFICATION & DATA SECURITY
    await validateUserSecurity(request.userId, request.userPlan, request.taskName);
    
    // 2. SMART CACHING
    const cacheKey = generateSmartCacheKey(request.taskName, request.userId, request.dataPayload);
    const cachedResult = retrieveFromCache(request.taskName, cacheKey);
    if (cachedResult) {
      logInfrastructureUsage(request.taskName, request.userId, Date.now() - startTime, 'cache');
      return cachedResult;
    }

    // 3. FLY.IO PROCESSING with 4. OPENAI FALLBACK
    let result;
    let processingSource = 'local-openai';
    
    if (request.flyioEndpoint) {
      try {
        // Try Fly.io first
        result = await processFlyIO(request.flyioEndpoint, request.dataPayload);
        processingSource = 'fly.io';
        console.log(`AI Infrastructure: ${request.taskName} processed via Fly.io`);
      } catch (flyError) {
        // 4. OPENAI FALLBACK - Execute the function's own AI logic
        console.warn(`AI Infrastructure: Fly.io failed for ${request.taskName}, using OpenAI fallback:`, flyError.message);
        result = await executeWithErrorRecovery(request.aiLogicFunction);
        processingSource = 'openai-fallback';
      }
    } else {
      // 5. ERROR RECOVERY - Execute the function's own AI logic with error handling
      result = await executeWithErrorRecovery(request.aiLogicFunction);
    }

    // Cache the successful result
    const cacheDuration = request.cacheDuration || getCacheDuration(request.taskName);
    storeInCache(request.taskName, cacheKey, result, cacheDuration);

    // Analytics logging
    logInfrastructureUsage(request.taskName, request.userId, Date.now() - startTime, processingSource);

    return result;

  } catch (error) {
    // 5. ERROR RECOVERY - Comprehensive error handling
    console.error(`AI Infrastructure Error for ${request.taskName}:`, error);
    logInfrastructureUsage(request.taskName, request.userId, Date.now() - startTime, 'error');
    throw error;
  }
}

// 1. USER VERIFICATION & DATA SECURITY
async function validateUserSecurity(userId: string, userPlan: string, taskName: string): Promise<void> {
  // Data contamination prevention
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID - security violation');
  }

  // Plan-based access control
  const planRequirements: Record<string, string[]> = {
    'financial-tips': ['premium'],
    'daily-recommendations': ['premium'],
    'contextual-tips': ['free', 'standard', 'premium'],
    'expense-predictions': ['premium'],
    'trend-analysis': ['premium'],
    'categorization': ['standard', 'premium'],
    'spending-insights': ['premium'],
    'financial-health': ['free', 'standard', 'premium']
  };

  const requiredPlans = planRequirements[taskName] || ['premium'];
  if (!requiredPlans.includes(userPlan)) {
    throw new Error(`${taskName} requires ${requiredPlans.join(' or ')} plan`);
  }
}

// 2. SMART CACHING
function generateSmartCacheKey(taskName: string, userId: string, dataPayload: any): string {
  const dataForHash = {
    task: taskName,
    userId,
    transactionCount: dataPayload.transactions?.length || 0,
    totalIncome: Math.round((dataPayload.summary?.totalIncome || 0) / 100) * 100,
    totalExpenses: Math.round((dataPayload.summary?.totalExpenses || 0) / 100) * 100,
    budgetCount: dataPayload.budgets?.length || 0,
    selectedMonth: dataPayload.selectedMonth,
    // Weekly refresh for time-sensitive tasks
    timeWindow: ['daily-recommendations', 'contextual-tips'].includes(taskName) 
      ? Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
      : undefined
  };

  return aiCache.createDataHash(dataForHash);
}

function retrieveFromCache(taskName: string, cacheKey: string): any | null {
  return aiCache.get(`${taskName}_${cacheKey}`);
}

function storeInCache(taskName: string, cacheKey: string, result: any, ttl: number): void {
  aiCache.set(`${taskName}_${cacheKey}`, result, ttl);
}

function getCacheDuration(taskName: string): number {
  const durations: Record<string, number> = {
    'financial-tips': 1800, // 30 minutes
    'daily-recommendations': 86400, // 24 hours
    'contextual-tips': 3600, // 1 hour
    'expense-predictions': 1800, // 30 minutes
    'trend-analysis': 3600, // 1 hour
    'categorization': 300, // 5 minutes
    'spending-insights': 1800, // 30 minutes
    'financial-health': 1800 // 30 minutes
  };
  return durations[taskName] || 1800;
}

// 3. FLY.IO PROCESSING
async function processFlyIO(endpoint: string, payload: any): Promise<any> {
  const FLY_IO_URL = process.env.AI_PROCESSOR_URL || 'https://finanserpro-ai-processor.fly.dev';
  
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
}

// 5. ERROR RECOVERY
async function executeWithErrorRecovery(aiLogicFunction: () => Promise<any>): Promise<any> {
  try {
    return await aiLogicFunction();
  } catch (error) {
    console.error('AI Logic Function Error:', error);
    throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Analytics and logging
function logInfrastructureUsage(taskName: string, userId: string, processingTime: number, source: string): void {
  console.log(`AI Infrastructure Analytics: {
    task: "${taskName}",
    userId: "${userId}",
    processingTime: ${processingTime}ms,
    source: "${source}",
    timestamp: ${new Date().toISOString()}
  }`);
}