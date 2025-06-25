// Test script to verify cache functionality for the 3 broken functions
const { unifiedAICache } = require('./lib/unifiedAICache');

async function testCacheFunctions() {
  const testUserId = 'user_2yYgmUlJG1EBLQqYEg7d64Ex2Zc';
  const testMonth = '2025-06';
  
  console.log('Testing cache save operations for broken functions...');
  
  // Test contextual-tips
  try {
    const contextualPayload = {
      summary: { totalIncome: 1000, totalExpenses: 500 },
      transactions: [{ description: 'Test', amount: '10', categoryName: 'Food' }],
      budgets: []
    };
    await unifiedAICache.set('contextual-tips', testUserId, testMonth, contextualPayload, { tips: [{ id: 'test', title: 'Test Tip' }] });
    console.log('✅ contextual-tips cache save: SUCCESS');
  } catch (error) {
    console.log('❌ contextual-tips cache save: FAILED -', error.message);
  }
  
  // Test financial-tips
  try {
    const financialPayload = {
      totalIncome: 1000,
      totalExpenses: 500,
      transactions: [{ description: 'Test', amount: 10 }]
    };
    await unifiedAICache.set('financial-tips', testUserId, testMonth, financialPayload, [{ title: 'Test Financial Tip', description: 'Test' }]);
    console.log('✅ financial-tips cache save: SUCCESS');
  } catch (error) {
    console.log('❌ financial-tips cache save: FAILED -', error.message);
  }
  
  // Test spending-insights
  try {
    const spendingPayload = {
      transactions: [{ description: 'Test', amount: 10, type: 'expense' }]
    };
    await unifiedAICache.set('spending-insights', testUserId, testMonth, spendingPayload, [{ id: 'test', type: 'suggestion', title: 'Test Insight' }]);
    console.log('✅ spending-insights cache save: SUCCESS');
  } catch (error) {
    console.log('❌ spending-insights cache save: FAILED -', error.message);
  }
  
  process.exit(0);
}

testCacheFunctions().catch(console.error);