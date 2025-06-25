import crypto from "crypto";
import { storage } from "../server/storage";
import { db } from "../server/db";
import { aiCache } from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";

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
  createDataHash(data: any): string {
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

    // CACHE COMPLETELY DISABLED FOR TESTING
    console.log(`[UnifiedCache] Cache disabled - returning null for ${functionName}:${month}`);
    return null;

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
      console.log(`[UnifiedCache] ATTEMPTING to save ${functionName}:${month} for user ${userId.substring(0, 8)}...`);
      await this.saveToDatabase(entry);
      console.log(`[UnifiedCache] SUCCESS: Cached ${functionName}:${month} (hash: ${dataHash})`);
    } catch (error) {
      console.error(`[UnifiedCache] CRITICAL ERROR saving ${functionName}:${month}:`, error);
      console.error('[UnifiedCache] Error details:', {
        message: error.message,
        code: error.code,
        constraint: error.constraint,
        detail: error.detail
      });
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
   * Get entry from unified ai_cache table
   */
  private async getFromDatabase(functionName: string, userId: string, month: string, dataHash: string): Promise<CacheEntry | null> {
    try {
      // First try exact hash match
      let result = await db.select()
        .from(aiCache)
        .where(and(
          eq(aiCache.userId, userId),
          eq(aiCache.functionName, functionName),
          eq(aiCache.month, month),
          eq(aiCache.dataHash, dataHash)
        ))
        .limit(1);

      // If no exact match, try fallback to most recent entry for same function/month
      if (result.length === 0) {
        console.log(`[UnifiedCache] No exact hash match (${dataHash}), trying recent fallback`);
        result = await db.select()
          .from(aiCache)
          .where(and(
            eq(aiCache.userId, userId),
            eq(aiCache.functionName, functionName),
            eq(aiCache.month, month)
          ))
          .orderBy(desc(aiCache.createdAt))
          .limit(1);
        
        if (result.length > 0) {
          console.log(`[UnifiedCache] Using fallback cache entry with hash: ${result[0].dataHash}`);
        }
      }
      
      if (result.length > 0) {
        return {
          userId,
          functionName,
          month,
          dataHash: result[0].dataHash,
          result: result[0].result,
          createdAt: result[0].createdAt,
          lastAccessed: new Date()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Database read error:', error);
      return null;
    }
  }

  /**
   * Save entry to unified ai_cache table
   */
  private async saveToDatabase(entry: CacheEntry): Promise<void> {
    try {
      // Check if entry already exists
      const existing = await db.select()
        .from(aiCache)
        .where(and(
          eq(aiCache.userId, entry.userId),
          eq(aiCache.functionName, entry.functionName),
          eq(aiCache.month, entry.month)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update existing entry
        await db.update(aiCache)
          .set({
            dataHash: entry.dataHash,
            result: entry.result,
            lastAccessed: new Date(),
            updatedAt: new Date()
          })
          .where(eq(aiCache.id, existing[0].id));
      } else {
        // Insert new entry
        console.log(`[UnifiedCache] Inserting new cache entry:`, {
          userId: entry.userId.substring(0, 8) + '...',
          functionName: entry.functionName,
          month: entry.month,
          dataHash: entry.dataHash.substring(0, 8) + '...',
          resultSize: JSON.stringify(entry.result).length
        });
        await db.insert(aiCache).values({
          userId: entry.userId,
          functionName: entry.functionName,
          month: entry.month,
          dataHash: entry.dataHash,
          result: entry.result,
          createdAt: new Date(),
          lastAccessed: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Database save error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        column: error.column
      });
      throw error;
    }
  }

  /**
   * Clear user data from unified ai_cache table
   */
  private async clearUserFromDatabase(userId: string): Promise<void> {
    try {
      await db.delete(aiCache).where(eq(aiCache.userId, userId));
    } catch (error) {
      console.error('Database clear error:', error);
    }
  }

  /**
   * Clear function data from unified ai_cache table
   */
  private async clearFunctionFromDatabase(userId: string, functionName: string, month?: string): Promise<void> {
    try {
      if (month) {
        // Clear specific function and month
        await db.delete(aiCache).where(and(
          eq(aiCache.userId, userId),
          eq(aiCache.functionName, functionName),
          eq(aiCache.month, month)
        ));
      } else {
        // Clear all months for this function
        await db.delete(aiCache).where(and(
          eq(aiCache.userId, userId),
          eq(aiCache.functionName, functionName)
        ));
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