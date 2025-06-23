import crypto from "crypto";
import { storage } from "../server/storage";
import { db } from "../server/db";
import { contextualFinancialTips, dailyRecommendations } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Unified AI Cache System
 * 
 * Features:
 * - Session persistence (database storage)
 * - Month-specific filtering
 * - Data change detection via hashing
 * - Per-function isolation
 * - Smart invalidation
 */

export interface CacheEntry {
  userId: string;
  functionName: string;
  month: string;
  dataHash: string;
  result: any;
  createdAt: Date;
  lastAccessed: Date;
}

export class UnifiedAICache {
  private memoryCache = new Map<string, CacheEntry>();

  /**
   * Generate cache key for consistent lookup
   */
  private generateKey(functionName: string, userId: string, month: string, dataHash: string): string {
    return `ai:${functionName}:${userId}:${month}:${dataHash}`;
  }

  /**
   * Create hash from user data to detect significant changes
   */
  private createDataHash(data: any): string {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 8); // Use 8 chars for shorter keys
  }

  /**
   * Get cached result if available and valid
   */
  async get(functionName: string, userId: string, month: string, userData: any): Promise<any | null> {
    const dataHash = this.createDataHash(userData);
    const key = this.generateKey(functionName, userId, month, dataHash);

    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      memoryEntry.lastAccessed = new Date();
      console.log(`[UnifiedCache] Memory hit for ${functionName}:${month}`);
      return memoryEntry.result;
    }

    // Try database cache
    try {
      const dbEntry = await this.getFromDatabase(functionName, userId, month, dataHash);
      if (dbEntry) {
        // Store in memory for faster access
        this.memoryCache.set(key, dbEntry);
        console.log(`[UnifiedCache] Database hit for ${functionName}:${month}`);
        return dbEntry.result;
      }
    } catch (error) {
      console.error('[UnifiedCache] Database read error:', error);
    }

    console.log(`[UnifiedCache] Cache miss for ${functionName}:${month}`);
    return null;
  }

  /**
   * Store result in cache
   */
  async set(functionName: string, userId: string, month: string, userData: any, result: any): Promise<void> {
    const dataHash = this.createDataHash(userData);
    const key = this.generateKey(functionName, userId, month, dataHash);
    
    const entry: CacheEntry = {
      userId,
      functionName,
      month,
      dataHash,
      result,
      createdAt: new Date(),
      lastAccessed: new Date()
    };

    // Store in memory
    this.memoryCache.set(key, entry);
    
    // Store in database for persistence
    try {
      await this.saveToDatabase(entry);
      console.log(`[UnifiedCache] Cached ${functionName}:${month} (hash: ${dataHash})`);
    } catch (error) {
      console.error('[UnifiedCache] Database write error:', error);
    }
  }

  /**
   * Clear cache for specific user when data changes significantly
   */
  async invalidateUser(userId: string): Promise<void> {
    // Clear memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.userId === userId) {
        this.memoryCache.delete(key);
      }
    }

    // Clear database cache
    try {
      await this.clearUserFromDatabase(userId);
      console.log(`[UnifiedCache] Invalidated all cache for user ${userId}`);
    } catch (error) {
      console.error('[UnifiedCache] Database clear error:', error);
    }
  }

  /**
   * Clear cache for specific function and month when data changes
   */
  async invalidateFunction(userId: string, functionName: string, month?: string): Promise<void> {
    // Clear memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.userId === userId && entry.functionName === functionName) {
        if (!month || entry.month === month) {
          this.memoryCache.delete(key);
        }
      }
    }

    // Clear database cache
    try {
      await this.clearFunctionFromDatabase(userId, functionName, month);
      const scope = month ? `${functionName}:${month}` : functionName;
      console.log(`[UnifiedCache] Invalidated ${scope} for user ${userId}`);
    } catch (error) {
      console.error('[UnifiedCache] Database clear error:', error);
    }
  }

  /**
   * Get entry from database using existing tables
   */
  private async getFromDatabase(functionName: string, userId: string, month: string, dataHash: string): Promise<CacheEntry | null> {
    try {
      if (functionName === 'contextual-tips') {
        const result = await db.select()
          .from(contextualFinancialTips)
          .where(eq(contextualFinancialTips.userId, userId))
          .limit(1);
        
        if (result.length > 0 && result[0].dataHash === dataHash) {
          return {
            userId,
            functionName,
            month,
            dataHash,
            result: { tips: result[0].tips },
            createdAt: result[0].createdAt,
            lastAccessed: new Date()
          };
        }
      }
      
      if (functionName === 'daily-recommendations') {
        const result = await db.select()
          .from(dailyRecommendations)
          .where(eq(dailyRecommendations.userId, userId))
          .limit(1);
        
        if (result.length > 0 && result[0].dataHash === dataHash) {
          return {
            userId,
            functionName,
            month,
            dataHash,
            result: {
              recommendations: result[0].recommendations,
              insights: result[0].insights
            },
            createdAt: result[0].generatedAt,
            lastAccessed: new Date()
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Database read error:', error);
      return null;
    }
  }

  /**
   * Save entry to database using existing tables
   */
  private async saveToDatabase(entry: CacheEntry): Promise<void> {
    try {
      if (entry.functionName === 'contextual-tips') {
        const existingTips = await storage.getContextualFinancialTips(entry.userId);
        const tipsData = {
          userId: entry.userId,
          tips: entry.result.tips || [],
          dataHash: entry.dataHash,
          transactionCount: 0, // Will be filled by calling function
          totalIncome: "0.00",
          totalExpenses: "0.00", 
          budgetCount: 0
        };
        
        if (existingTips) {
          await storage.updateContextualFinancialTips(entry.userId, tipsData);
        } else {
          await storage.saveContextualFinancialTips(tipsData);
        }
      }
      
      if (entry.functionName === 'daily-recommendations') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration
        
        await storage.saveDailyRecommendations({
          userId: entry.userId,
          recommendations: entry.result.recommendations || [],
          insights: entry.result.insights || [],
          dataHash: entry.dataHash,
          expiresAt
        });
      }
    } catch (error) {
      console.error('Database save error:', error);
    }
  }

  /**
   * Clear user data from database
   */
  private async clearUserFromDatabase(userId: string): Promise<void> {
    try {
      await db.delete(contextualFinancialTips).where(eq(contextualFinancialTips.userId, userId));
      await db.delete(dailyRecommendations).where(eq(dailyRecommendations.userId, userId));
    } catch (error) {
      console.error('Database clear error:', error);
    }
  }

  /**
   * Clear function data from database
   */
  private async clearFunctionFromDatabase(userId: string, functionName: string, month?: string): Promise<void> {
    try {
      if (functionName === 'contextual-tips') {
        await db.delete(contextualFinancialTips).where(eq(contextualFinancialTips.userId, userId));
      }
      
      if (functionName === 'daily-recommendations') {
        await db.delete(dailyRecommendations).where(eq(dailyRecommendations.userId, userId));
      }
    } catch (error) {
      console.error('Database function clear error:', error);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats() {
    const memoryEntries = this.memoryCache.size;
    const functionBreakdown = new Map<string, number>();
    
    for (const entry of this.memoryCache.values()) {
      const count = functionBreakdown.get(entry.functionName) || 0;
      functionBreakdown.set(entry.functionName, count + 1);
    }

    return {
      memoryEntries,
      functionBreakdown: Object.fromEntries(functionBreakdown),
      lastAccessed: new Date()
    };
  }

  /**
   * Clean up old entries from memory
   */
  cleanup(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = new Date();
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now.getTime() - entry.lastAccessed.getTime() > maxAge) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const unifiedAICache = new UnifiedAICache();