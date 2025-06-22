
import * as crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  
  // Default TTL (Time To Live) in milliseconds
  private readonly DEFAULT_TTL = {
    categorization: Number.MAX_SAFE_INTEGER, // No expiration - categories are stable
    insights: 24 * 60 * 60 * 1000,          // 24 hours - daily insights refresh
    trends: Number.MAX_SAFE_INTEGER,         // No expiration - only invalidate on data change
    tips: 48 * 60 * 60 * 1000,              // 48 hours - tips change less frequently
    financialHealth: 24 * 60 * 60 * 1000    // 24 hours - financial health cache
  };

  private generateKey(prefix: string, data: any): string {
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    const hash = crypto.createHash('md5').update(serialized).digest('hex');
    return `${prefix}:${hash}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiresAt;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.cache.delete(key);
      }
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.DEFAULT_TTL.insights);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt
    });
  }

  // Specific cache methods for different AI operations
  getCategorization(description: string, amount: number) {
    const key = this.generateKey('categorization', { description, amount });
    return this.get(key);
  }

  setCategorization(description: string, amount: number, result: any) {
    const key = this.generateKey('categorization', { description, amount });
    this.set(key, result, this.DEFAULT_TTL.categorization);
  }

  getInsights(transactionsHash: string) {
    const key = `insights:${transactionsHash}`;
    return this.get(key);
  }

  setInsights(transactionsHash: string, result: any) {
    const key = `insights:${transactionsHash}`;
    this.set(key, result, this.DEFAULT_TTL.insights);
  }

  getTrends(transactionsHash: string, budgetsHash: string) {
    const key = this.generateKey('trends', { transactionsHash, budgetsHash });
    return this.get(key);
  }

  setTrends(transactionsHash: string, budgetsHash: string, result: any) {
    const key = this.generateKey('trends', { transactionsHash, budgetsHash });
    this.set(key, result, this.DEFAULT_TTL.trends);
  }

  getTips(financialDataHash: string) {
    const key = `tips:${financialDataHash}`;
    return this.get(key);
  }

  setTips(financialDataHash: string, result: any) {
    const key = `tips:${financialDataHash}`;
    this.set(key, result, this.DEFAULT_TTL.tips);
  }

  getFinancialHealth(userId: string, dataHash: string) {
    const key = `financial_health:${userId}:${dataHash}`;
    return this.get(key);
  }

  setFinancialHealth(userId: string, dataHash: string, result: any) {
    const key = `financial_health:${userId}:${dataHash}`;
    this.set(key, result, this.DEFAULT_TTL.financialHealth);
  }

  // Utility method to create hash for complex data
  createDataHash(data: any): string {
    return crypto.createHash('md5')
      .update(JSON.stringify(data, Object.keys(data).sort()))
      .digest('hex');
  }

  // Clear expired entries (call periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        timestamp: entry.timestamp,
        expiresAt: entry.expiresAt,
        isExpired: this.isExpired(entry)
      }))
    };
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
  }

  // Clear all cache entries for a specific user
  clearUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, _] of this.cache.entries()) {
      // Clear any cache entries that contain the user ID or are user-specific
      if (key.includes(userId) || 
          key.includes('insights:') || 
          key.includes('trends:') || 
          key.includes('tips:') || 
          key.includes('financial_health:') ||
          key.includes('daily_recommendations_') ||
          key.includes('expense_predictions_')) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`Cleared ${keysToDelete.length} cache entries for user ${userId}`);
  }
}

export const aiCache = new APICache();

// Clean up expired entries every hour
setInterval(() => {
  aiCache.cleanup();
}, 60 * 60 * 1000);
