// Simple cache implementation for JavaScript compatibility
class AICache {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if expired (5 minutes)
    if (Date.now() - entry.timestamp > 5 * 60 * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  createDataHash(data) {
    return JSON.stringify(data).length.toString();
  }
}

module.exports = { aiCache: new AICache() };