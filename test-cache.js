// Test script to verify cache functionality
const { UnifiedAICache } = require('./lib/unifiedAICache.ts');

async function testCache() {
  console.log('Testing UnifiedAICache system...');
  
  // Test financial-tips function
  const cache = new UnifiedAICache('financial-tips', 'user_2yYgmUlJG1EBLQqYEg7d64Ex2Zc');
  
  const testInput = {
    totalIncome: 5000,
    totalExpenses: 3500,
    categories: [
      {categoryName: "Food", amount: 800, type: "expense"},
      {categoryName: "Transport", amount: 400, type: "expense"}
    ]
  };
  
  // Test cache miss
  console.log('Testing cache miss...');
  const result1 = await cache.get(testInput);
  console.log('Cache miss result:', result1);
  
  // Test cache set
  console.log('Setting cache entry...');
  const testOutput = {
    tips: ["Test tip 1", "Test tip 2"],
    timestamp: Date.now()
  };
  
  await cache.set(testInput, testOutput);
  console.log('Cache entry set successfully');
  
  // Test cache hit
  console.log('Testing cache hit...');
  const result2 = await cache.get(testInput);
  console.log('Cache hit result:', result2);
  
  // Test stats
  const stats = await cache.getStats();
  console.log('Cache stats:', stats);
}

testCache().catch(console.error);