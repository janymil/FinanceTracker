/**
 * AI Usage Tracker
 * 
 * Handles tracking OpenAI API usage, cost calculation, and usage limits enforcement.
 */

import { storage } from '../server/storage';
import { calculateCost, formatCost, type TokenUsage, type ImageGeneration } from './aiCostCalculator';
import type { InsertAiUsage } from '../shared/schema';

export interface UsageTrackingParams {
  userId: string;
  functionName: string;
  model: string;
  usage?: TokenUsage | ImageGeneration;
  requestSize?: number;
  responseSize?: number;
  executionTime?: number;
  cached?: boolean;
  language?: string;
  plan: string;
  status?: 'success' | 'error' | 'limited';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UsageLimitCheck {
  allowed: boolean;
  reason?: string;
  remainingRequests: number;
  remainingCost: number;
  monthlyRequestLimit: number;
  monthlyCostLimit: number;
  dailyRequestLimit: number;
  dailyCostLimit: number;
  cooldownRemaining?: number; // seconds until next request allowed
}

export class AIUsageTracker {
  
  /**
   * Track an AI API usage event
   */
  static async trackUsage(params: UsageTrackingParams): Promise<void> {
    try {
      const cost = params.usage ? calculateCost(params.usage, params.model) : 0;
      
      let tokensUsed = 0;
      let promptTokens = 0;
      let completionTokens = 0;

      // Extract token information if available
      if (params.usage && 'total_tokens' in params.usage) {
        tokensUsed = params.usage.total_tokens || 0;
        promptTokens = params.usage.prompt_tokens || 0;
        completionTokens = params.usage.completion_tokens || 0;
      }

      const usageRecord: InsertAiUsage = {
        userId: params.userId,
        functionName: params.functionName,
        tokensUsed,
        promptTokens,
        completionTokens,
        cost: cost.toString(),
        model: params.model,
        requestSize: params.requestSize || 0,
        responseSize: params.responseSize || 0,
        executionTime: params.executionTime || 0,
        cached: params.cached || false,
        language: params.language || 'en-us',
        plan: params.plan,
        status: params.status || 'success',
        errorMessage: params.errorMessage || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      };

      await storage.recordAIUsage(usageRecord);
      
      console.log(`AI Usage tracked: ${params.functionName} for ${params.userId} - ${formatCost(cost)}`);
    } catch (error) {
      console.error('Error tracking AI usage:', error);
      // Don't throw - tracking failures shouldn't break AI functionality
    }
  }

  /**
   * Check if user is within usage limits before making an API call
   */
  static async checkUsageLimit(
    userId: string,
    functionName: string,
    plan: string,
    estimatedCost: number = 0
  ): Promise<UsageLimitCheck> {
    try {
      // Get current usage for this month and today
      const monthlyUsage = await storage.getMonthlyAIUsage(userId, functionName);
      const dailyUsage = await storage.getDailyAIUsage(userId, functionName);

      // Get limits for this plan and function
      const limits = await storage.getAIUsageLimit(plan, functionName);
      
      // Check for user-specific overrides
      const userOverride = await storage.getAIUserOverride(userId, functionName);
      
      // If user is blocked, deny immediately
      if (userOverride?.isBlocked) {
        return {
          allowed: false,
          reason: userOverride.reason || 'Function blocked for user',
          remainingRequests: 0,
          remainingCost: 0,
          monthlyRequestLimit: 0,
          monthlyCostLimit: 0,
          dailyRequestLimit: 0,
          dailyCostLimit: 0,
        };
      }

      // Apply overrides to limits
      const effectiveLimits = {
        monthlyRequestLimit: userOverride?.monthlyRequestLimit ?? limits.monthlyRequestLimit,
        monthlyCostLimit: userOverride?.monthlyCostLimit ? parseFloat(userOverride.monthlyCostLimit) : parseFloat(limits.monthlyCostLimit),
        dailyRequestLimit: userOverride?.dailyRequestLimit ?? limits.dailyRequestLimit,
        dailyCostLimit: userOverride?.dailyCostLimit ? parseFloat(userOverride.dailyCostLimit) : parseFloat(limits.dailyCostLimit),
        cooldownSeconds: userOverride?.cooldownSeconds ?? limits.cooldownSeconds,
      };

      // Check cooldown period
      const lastRequest = await storage.getLastAIRequest(userId, functionName);
      if (lastRequest && effectiveLimits.cooldownSeconds > 0) {
        const timeSinceLastRequest = (Date.now() - lastRequest.getTime()) / 1000;
        if (timeSinceLastRequest < effectiveLimits.cooldownSeconds) {
          return {
            allowed: false,
            reason: 'Cooldown period active',
            remainingRequests: Math.max(0, effectiveLimits.monthlyRequestLimit - monthlyUsage.requests),
            remainingCost: Math.max(0, effectiveLimits.monthlyCostLimit - monthlyUsage.cost),
            monthlyRequestLimit: effectiveLimits.monthlyRequestLimit,
            monthlyCostLimit: effectiveLimits.monthlyCostLimit,
            dailyRequestLimit: effectiveLimits.dailyRequestLimit,
            dailyCostLimit: effectiveLimits.dailyCostLimit,
            cooldownRemaining: Math.ceil(effectiveLimits.cooldownSeconds - timeSinceLastRequest),
          };
        }
      }

      // Check monthly limits
      if (effectiveLimits.monthlyRequestLimit > 0 && monthlyUsage.requests >= effectiveLimits.monthlyRequestLimit) {
        return {
          allowed: false,
          reason: 'Monthly request limit exceeded',
          remainingRequests: 0,
          remainingCost: Math.max(0, effectiveLimits.monthlyCostLimit - monthlyUsage.cost),
          monthlyRequestLimit: effectiveLimits.monthlyRequestLimit,
          monthlyCostLimit: effectiveLimits.monthlyCostLimit,
          dailyRequestLimit: effectiveLimits.dailyRequestLimit,
          dailyCostLimit: effectiveLimits.dailyCostLimit,
        };
      }

      if (effectiveLimits.monthlyCostLimit > 0 && (monthlyUsage.cost + estimatedCost) > effectiveLimits.monthlyCostLimit) {
        return {
          allowed: false,
          reason: 'Monthly cost limit exceeded',
          remainingRequests: Math.max(0, effectiveLimits.monthlyRequestLimit - monthlyUsage.requests),
          remainingCost: Math.max(0, effectiveLimits.monthlyCostLimit - monthlyUsage.cost),
          monthlyRequestLimit: effectiveLimits.monthlyRequestLimit,
          monthlyCostLimit: effectiveLimits.monthlyCostLimit,
          dailyRequestLimit: effectiveLimits.dailyRequestLimit,
          dailyCostLimit: effectiveLimits.dailyCostLimit,
        };
      }

      // Check daily limits
      if (effectiveLimits.dailyRequestLimit > 0 && dailyUsage.requests >= effectiveLimits.dailyRequestLimit) {
        return {
          allowed: false,
          reason: 'Daily request limit exceeded',
          remainingRequests: Math.max(0, effectiveLimits.monthlyRequestLimit - monthlyUsage.requests),
          remainingCost: Math.max(0, effectiveLimits.monthlyCostLimit - monthlyUsage.cost),
          monthlyRequestLimit: effectiveLimits.monthlyRequestLimit,
          monthlyCostLimit: effectiveLimits.monthlyCostLimit,
          dailyRequestLimit: effectiveLimits.dailyRequestLimit,
          dailyCostLimit: effectiveLimits.dailyCostLimit,
        };
      }

      if (effectiveLimits.dailyCostLimit > 0 && (dailyUsage.cost + estimatedCost) > effectiveLimits.dailyCostLimit) {
        return {
          allowed: false,
          reason: 'Daily cost limit exceeded',
          remainingRequests: Math.max(0, effectiveLimits.monthlyRequestLimit - monthlyUsage.requests),
          remainingCost: Math.max(0, effectiveLimits.monthlyCostLimit - monthlyUsage.cost),
          monthlyRequestLimit: effectiveLimits.monthlyRequestLimit,
          monthlyCostLimit: effectiveLimits.monthlyCostLimit,
          dailyRequestLimit: effectiveLimits.dailyRequestLimit,
          dailyCostLimit: effectiveLimits.dailyCostLimit,
        };
      }

      // All checks passed
      return {
        allowed: true,
        remainingRequests: Math.max(0, effectiveLimits.monthlyRequestLimit - monthlyUsage.requests),
        remainingCost: Math.max(0, effectiveLimits.monthlyCostLimit - monthlyUsage.cost),
        monthlyRequestLimit: effectiveLimits.monthlyRequestLimit,
        monthlyCostLimit: effectiveLimits.monthlyCostLimit,
        dailyRequestLimit: effectiveLimits.dailyRequestLimit,
        dailyCostLimit: effectiveLimits.dailyCostLimit,
      };

    } catch (error) {
      console.error('Error checking AI usage limits:', error);
      // On error, allow the request to proceed (fail open)
      return {
        allowed: true,
        reason: 'Limit check failed - allowing request',
        remainingRequests: 999999,
        remainingCost: 999999,
        monthlyRequestLimit: 999999,
        monthlyCostLimit: 999999,
        dailyRequestLimit: 999999,
        dailyCostLimit: 999999,
      };
    }
  }

  /**
   * Get usage summary for a user
   */
  static async getUserUsageSummary(userId: string, timeframe: 'today' | 'month' | 'all' = 'month') {
    try {
      return await storage.getAIUsageSummary(userId, timeframe);
    } catch (error) {
      console.error('Error getting user usage summary:', error);
      return {
        totalRequests: 0,
        totalCost: 0,
        functionBreakdown: [],
        modelBreakdown: [],
      };
    }
  }

  /**
   * Check if a function is available for a given plan
   */
  static isFunctionAvailableForPlan(functionName: string, plan: string): boolean {
    const planPermissions = {
      free: [],
      standard: [
        'categorizeExpense',
        'categorizeIncomeWithUserCategories', 
        'generateAIFinancialHealthScore',
        'parseBankStatement'
      ],
      premium: [
        'categorizeExpense',
        'categorizeIncomeWithUserCategories',
        'generateFinancialTips',
        'generateContextualFinancialTips',
        'generateDailyRecommendations',
        'generateSpendingInsights',
        'generateAIFinancialHealthScore',
        'generateTrendPredictions',
        'generateExpensePredictions',
        'parseBankStatement',
        'generateFinancialMascot', // DALL-E
      ]
    };

    return (planPermissions[plan as keyof typeof planPermissions] || []).includes(functionName);
  }

  /**
   * Wrap an AI function call with usage tracking and limits
   */
  static async wrapAIFunction<T>(
    params: {
      userId: string;
      functionName: string;
      plan: string;
      model: string;
      language?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    aiFunction: () => Promise<T>,
    estimatedCost: number = 0
  ): Promise<T> {
    const startTime = Date.now();

    // Check if function is available for plan
    if (!this.isFunctionAvailableForPlan(params.functionName, params.plan)) {
      const error = new Error(`Function ${params.functionName} not available for ${params.plan} plan`);
      await this.trackUsage({
        ...params,
        status: 'error',
        errorMessage: error.message,
        executionTime: Date.now() - startTime,
      });
      throw error;
    }

    // Check usage limits
    const limitCheck = await this.checkUsageLimit(
      params.userId,
      params.functionName,
      params.plan,
      estimatedCost
    );

    if (!limitCheck.allowed) {
      const error = new Error(`Usage limit exceeded: ${limitCheck.reason}`);
      await this.trackUsage({
        ...params,
        status: 'limited',
        errorMessage: error.message,
        executionTime: Date.now() - startTime,
      });
      throw error;
    }

    try {
      // Execute the AI function
      const result = await aiFunction();
      
      // Track successful usage
      await this.trackUsage({
        ...params,
        status: 'success',
        executionTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      // Track failed usage
      await this.trackUsage({
        ...params,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      });
      throw error;
    }
  }
}