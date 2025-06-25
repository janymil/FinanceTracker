// Test script to verify fallback mechanism
import { runAI } from './lib/aiProcessor.js';

async function testFallback() {
  console.log('=== TESTING AI PROCESSOR FALLBACK MECHANISM ===');
  
  // Test with mock data to trigger contextual tips
  const mockPayload = {
    summary: {
      totalIncome: 3000,
      totalExpenses: 2500,
      netBalance: 500,
      transactionCount: 15
    },
    transactions: [
      {
        description: "Grocery Store",
        amount: 120,
        categoryName: "Food",
        type: "expense",
        date: "2025-06-24",
        recurring: false
      },
      {
        description: "Salary Payment",
        amount: 3000,
        categoryName: "Income", 
        type: "income",
        date: "2025-06-01",
        recurring: true
      },
      {
        description: "Gas Station",
        amount: 50,
        categoryName: "Transportation",
        type: "expense", 
        date: "2025-06-20",
        recurring: false
      }
    ],
    budgets: [],
    goals: []
  };

  try {
    console.log('Testing contextual-tips with real Fly.io endpoint...');
    const result = await runAI('contextual-tips', 'test-user', mockPayload);
    console.log('SUCCESS: Received result:', JSON.stringify(result, null, 2));
    
    if (result.tips && result.tips.length > 0) {
      console.log(`Generated ${result.tips.length} tips`);
      result.tips.forEach((tip, index) => {
        console.log(`Tip ${index + 1}: ${tip.title} (${tip.category})`);
      });
    }
    
  } catch (error) {
    console.error('ERROR during fallback test:', error.message);
  }
}

// Temporarily break Fly.io URL to test fallback
async function testForcedFallback() {
  console.log('\n=== TESTING FORCED FALLBACK (SIMULATED FLY.IO FAILURE) ===');
  
  // Modify the AI processor to use invalid URL temporarily
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (url.includes('finanzerpro.fly.dev')) {
      console.log('Simulating Fly.io failure...');
      throw new Error('Simulated network failure');
    }
    return originalFetch(url, options);
  };
  
  try {
    const mockPayload = {
      summary: { totalIncome: 2000, totalExpenses: 1500, netBalance: 500, transactionCount: 10 },
      transactions: [
        { description: "Test Transaction", amount: 100, categoryName: "Food", type: "expense", date: "2025-06-24" }
      ],
      budgets: [],
      goals: []
    };
    
    const result = await runAI('contextual-tips', 'test-user-fallback', mockPayload);
    console.log('FALLBACK SUCCESS: Local OpenAI generated result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('FALLBACK ERROR:', error.message);
  } finally {
    // Restore original fetch
    global.fetch = originalFetch;
  }
}

// Run tests
testFallback().then(() => {
  return testForcedFallback();
}).then(() => {
  console.log('\n=== FALLBACK TESTING COMPLETE ===');
}).catch(error => {
  console.error('Test suite error:', error);
});