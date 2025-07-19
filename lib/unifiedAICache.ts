import crypto from 'crypto';
import { storage } from '../server/storage';
import { db } from '../server/db';
import { aiCache } from '../shared/schema.ts';
import { eq, and, lt, isNotNull } from 'drizzle-orm';

// Default TTL configurations for different AI functions (in hours)
const DEFAULT_TTL_CONFIG = {
  'financial-tips': 168, // 7 days
  'daily-recommendations': 24, // 1 day
  'contextual-tips': 72, // 3 days
  'expense-predictions': 48, // 2 days
  'financial-health-score': 24, // 1 day
  'spending-insights': 72, // 3 days
  'trend-predictions': 48, // 2 days
} as const;

export interface CacheStats {
  totalEntries: number;
  hitCount: number;
  errorEntries: number;
  avgHitsPerEntry: number;
  lastAccessed: Date | null;
}

export class UnifiedAICache {
  private functionKey: string;
  private userId: string;
  private month?: string;
  private maxEntriesPerUserFunction: number = 100;

  constructor(functionKey: string, userId: string, month?: string) {
    this.functionKey = functionKey;
    this.userId = userId;
    this.month = this.validateMonth(month);
  }

  /**
   * Validate month format (YYYY-MM)
   */
  private validateMonth(month?: string): string | undefined {
    if (!month) return undefined;
    
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      console.warn(`Invalid month format: ${month}. Expected YYYY-MM format.`);
      return undefined;
    }
    
    return month;
  }

  /**
   * Generate SHA-256 hash for input data
   */
  private hashInput(input: any): string {
    const json = JSON.stringify(input);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * Get cached result if exists and not expired
   */
  async get(input: any): Promise<any | null> {
    try {
      const inputHash = this.hashInput(input);
      
      const entry = await storage.getAICacheEntry(this.userId, this.functionKey, inputHash);
      
      if (!entry) {
        return null;
      }

      // Check if expired
      if (entry.expiresAt && new Date() > entry.expiresAt) {
        return null;
      }

      // Check month filter if specified
      if (this.month && entry.month !== this.month) {
        return null;
      }

      return entry.outputJson;
    } catch (error) {
      console.error('UnifiedAICache.get error:', error);
      return null;
    }
  }

  /**
   * Get default TTL for this function
   */
  private getDefaultTTL(): number {
    return DEFAULT_TTL_CONFIG[this.functionKey as keyof typeof DEFAULT_TTL_CONFIG] || 24;
  }

  /**
   * Note: Cache size limits are managed by the storage layer through LRU eviction
   */
  private async enforceCacheLimit(): Promise<void> {
    // Cache limits handled automatically by storage layer
  }

  /**
   * Save AI output to cache
   */
  async set(input: any, output: any, isError = false, ttlHours?: number): Promise<void> {
    try {
      const inputHash = this.hashInput(input);
      
      // Use default TTL if not provided
      const finalTtlHours = ttlHours || this.getDefaultTTL();
      
      // Use storage layer to set cache entry with TTL
      await storage.setAICacheEntry(
        this.userId,
        this.functionKey,
        inputHash,
        input,
        output,
        this.month,
        isError,
        finalTtlHours
      );
    } catch (error) {
      console.error('UnifiedAICache.set error:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics for this user/function combination
   */
  async getStats(): Promise<CacheStats> {
    try {
      const conditions = [
        eq(aiCache.userId, this.userId),
        eq(aiCache.functionKey, this.functionKey)
      ];

      if (this.month) {
        conditions.push(eq(aiCache.month, this.month));
      }

      const entries = await db
        .select()
        .from(aiCache)
        .where(and(...conditions));

      const totalEntries = entries.length;
      const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
      const errorEntries = entries.filter(entry => entry.isError).length;
      const avgHitsPerEntry = totalEntries > 0 ? totalHits / totalEntries : 0;
      const lastAccessed = entries.length > 0 
        ? entries.reduce((latest, entry) => 
            entry.lastAccessed && (!latest || entry.lastAccessed > latest) 
              ? entry.lastAccessed 
              : latest, null as Date | null)
        : null;

      return {
        totalEntries,
        hitCount: totalHits,
        errorEntries,
        avgHitsPerEntry: Math.round(avgHitsPerEntry * 100) / 100,
        lastAccessed
      };
    } catch (error) {
      console.error('UnifiedAICache.getStats error:', error);
      return {
        totalEntries: 0,
        hitCount: 0,
        errorEntries: 0,
        avgHitsPerEntry: 0,
        lastAccessed: null
      };
    }
  }

  /**
   * Clear all cache entries for this user and function
   */
  async clear(): Promise<void> {
    try {
      const conditions = [
        eq(aiCache.userId, this.userId),
        eq(aiCache.functionKey, this.functionKey)
      ];

      if (this.month) {
        conditions.push(eq(aiCache.month, this.month));
      }

      await db
        .delete(aiCache)
        .where(and(...conditions));
    } catch (error) {
      console.error('UnifiedAICache.clear error:', error);
      throw error;
    }
  }

  /**
   * Clear all cache entries for a specific user (admin function)
   */
  static async clearUserCache(userId: string): Promise<number> {
    try {
      const result = await db
        .delete(aiCache)
        .where(eq(aiCache.userId, userId));

      return result.rowCount || 0;
    } catch (error) {
      console.error('UnifiedAICache.clearUserCache error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache entries for a specific function across all users (admin function)
   */
  static async clearFunctionCache(functionKey: string): Promise<number> {
    try {
      const result = await db
        .delete(aiCache)
        .where(eq(aiCache.functionKey, functionKey));

      return result.rowCount || 0;
    } catch (error) {
      console.error('UnifiedAICache.clearFunctionCache error:', error);
      return 0;
    }
  }

  /**
   * Get global cache statistics (admin function)
   */
  static async getGlobalStats(): Promise<{
    totalEntries: number;
    totalUsers: number;
    totalFunctions: number;
    totalHits: number;
    errorRate: number;
  }> {
    try {
      const entries = await db.select().from(aiCache);
      
      const totalEntries = entries.length;
      const uniqueUsers = new Set(entries.map(e => e.userId)).size;
      const uniqueFunctions = new Set(entries.map(e => e.functionKey)).size;
      const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
      const errorEntries = entries.filter(entry => entry.isError).length;
      const errorRate = totalEntries > 0 ? (errorEntries / totalEntries) * 100 : 0;

      return {
        totalEntries,
        totalUsers: uniqueUsers,
        totalFunctions: uniqueFunctions,
        totalHits,
        errorRate: Math.round(errorRate * 100) / 100
      };
    } catch (error) {
      console.error('UnifiedAICache.getGlobalStats error:', error);
      return {
        totalEntries: 0,
        totalUsers: 0,
        totalFunctions: 0,
        totalHits: 0,
        errorRate: 0
      };
    }
  }

  /**
   * Clean up expired cache entries
   */
  static async cleanupExpired(): Promise<number> {
    try {
      const now = new Date();
      const result = await db
        .delete(aiCache)
        .where(
          and(
            isNotNull(aiCache.expiresAt),
            lt(aiCache.expiresAt, now)
          )
        );

      return result.rowCount || 0;
    } catch (error) {
      console.error('UnifiedAICache.cleanupExpired error:', error);
      return 0;
    }
  }
}