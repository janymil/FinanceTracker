import crypto from 'crypto';
import { db } from '../server/db';
import { aiCache } from '../shared/schema';
import { eq, and, lt, isNotNull } from 'drizzle-orm';

export class UnifiedAICache {
  private functionKey: string;
  private userId: string;
  private month?: string;

  constructor(functionKey: string, userId: string, month?: string) {
    this.functionKey = functionKey;
    this.userId = userId;
    this.month = month;
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
      
      // Build query conditions
      const conditions = [
        eq(aiCache.userId, this.userId),
        eq(aiCache.functionKey, this.functionKey),
        eq(aiCache.inputHash, inputHash)
      ];

      // Add month condition if specified
      if (this.month) {
        conditions.push(eq(aiCache.month, this.month));
      }

      const cached = await db
        .select()
        .from(aiCache)
        .where(and(...conditions))
        .limit(1);

      if (cached.length === 0) {
        return null;
      }

      const entry = cached[0];

      // Check if expired
      if (entry.expiresAt && new Date() > entry.expiresAt) {
        return null;
      }

      // Update lastAccessed and increment hitCount
      await db
        .update(aiCache)
        .set({
          lastAccessed: new Date(),
          hitCount: entry.hitCount + 1,
          updatedAt: new Date()
        })
        .where(eq(aiCache.id, entry.id));

      return entry.outputJson;
    } catch (error) {
      console.error('UnifiedAICache.get error:', error);
      return null;
    }
  }

  /**
   * Save AI output to cache
   */
  async set(input: any, output: any, isError = false, ttlHours?: number): Promise<void> {
    try {
      const inputHash = this.hashInput(input);
      const now = new Date();
      
      // Calculate expiration if TTL provided
      let expiresAt: Date | null = null;
      if (ttlHours) {
        expiresAt = new Date(now.getTime() + (ttlHours * 60 * 60 * 1000));
      }

      // Check if entry already exists
      const conditions = [
        eq(aiCache.userId, this.userId),
        eq(aiCache.functionKey, this.functionKey),
        eq(aiCache.inputHash, inputHash)
      ];

      if (this.month) {
        conditions.push(eq(aiCache.month, this.month));
      }

      const existing = await db
        .select()
        .from(aiCache)
        .where(and(...conditions))
        .limit(1);

      if (existing.length > 0) {
        // Update existing entry
        await db
          .update(aiCache)
          .set({
            outputJson: output,
            isError,
            expiresAt,
            lastAccessed: now,
            updatedAt: now,
            hitCount: existing[0].hitCount + 1
          })
          .where(eq(aiCache.id, existing[0].id));
      } else {
        // Insert new entry
        await db
          .insert(aiCache)
          .values({
            userId: this.userId,
            functionKey: this.functionKey,
            inputHash,
            inputJson: input,
            outputJson: output,
            lastAccessed: now,
            month: this.month || null,
            expiresAt,
            hitCount: 1,
            isError,
            createdAt: now,
            updatedAt: now
          });
      }
    } catch (error) {
      console.error('UnifiedAICache.set error:', error);
      throw error;
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