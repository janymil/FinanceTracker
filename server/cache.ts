
import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  
  // Default TTL (Time To Live) in milliseconds
  private readonly DEFAULT_TTL = {
    categorization: 24 * 60 * 60 * 1000, // 24 hours - categories don't change much
    insights: 6 * 60 * 60 * 1000,        // 6 hours - insights can be refreshed more often
    trends: 12 * 60 * 60 * 1000,         // 12 hours - trends need regular updates
    tips: 24 * 60 * 60 * 1000            // 24 hours - tips are fairly stable
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

  // Utility method to create hash for complex data
  createDataHash(data: any): string {
    return crypto.createHash('md5')
      .update(JSON.stringify(data, Object.keys(data).sort()))
      .digest('hex');
  }

  // Clear expired entries (call periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
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
}

export const aiCache = new APICache();

// Clean up expired entries every hour
setInterval(() => {
  aiCache.cleanup();
}, 60 * 60 * 1000);
