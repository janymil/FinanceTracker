// Test script to verify all 6 AI infrastructure components
import { processAIRequest } from './server/aiOrchestrator.js';

async function testInfrastructure() {
  console.log('🧪 Testing AI Infrastructure Components...\n');

  // 1. TEST USER VERIFICATION & DATA SECURITY
  console.log('1️⃣ Testing User Verification & Data Security');
  try {
    await processAIRequest({
      taskName: 'categorization',
      userId: 'invalid-user',
      userPlan: 'free',
      dataPayload: { test: 'data' },
      aiLogicFunction: async () => ({ result: 'test' })
    });
    console.log('❌ FAILED: Should have blocked invalid user');
  } catch (error) {
    console.log('✅ PASSED: Blocked invalid user -', error.message);
  }

  // Valid user test
  try {
    const result = await processAIRequest({
      taskName: 'contextual-tips',
      userId: 'test-user-123',
      userPlan: 'free',
      dataPayload: { test: 'data' },
      aiLogicFunction: async () => ({ tips: ['Test tip'] })
    });
    console.log('✅ PASSED: Valid user processed -', JSON.stringify(result).substring(0, 50) + '...');
  } catch (error) {
    console.log('❌ FAILED: Valid user should work -', error.message);
  }

  // 2. TEST SMART CACHING
  console.log('\n2️⃣ Testing Smart Caching');
  let callCount = 0;
  const testFunction = async () => {
    callCount++;
    return { timestamp: Date.now(), callNumber: callCount };
  };

  const result1 = await processAIRequest({
    taskName: 'categorization',
    userId: 'cache-test-user',
    userPlan: 'standard',
    dataPayload: { description: 'test expense' },
    aiLogicFunction: testFunction,
    cacheDuration: 300
  });

  const result2 = await processAIRequest({
    taskName: 'categorization',
    userId: 'cache-test-user',
    userPlan: 'standard',
    dataPayload: { description: 'test expense' },
    aiLogicFunction: testFunction,
    cacheDuration: 300
  });

  if (result1.callNumber === result2.callNumber && callCount === 1) {
    console.log('✅ PASSED: Cache working - only 1 function call made');
  } else {
    console.log('❌ FAILED: Cache not working - multiple calls made:', callCount);
  }

  // 3. TEST FLY.IO PROCESSING
  console.log('\n3️⃣ Testing Fly.io Processing');
  try {
    const flyResult = await processAIRequest({
      taskName: 'daily-recommendations',
      userId: 'fly-test-user',
      userPlan: 'premium',
      dataPayload: {
        summary: { totalIncome: 5000, totalExpenses: 3000 },
        transactions: [
          { description: 'Grocery', amount: 50, type: 'expense', date: '2025-06-23' }
        ],
        budgets: []
      },
      aiLogicFunction: async () => ({ fallback: 'local' }),
      flyioEndpoint: '/generate-daily-recommendation'
    });
    console.log('✅ PASSED: Fly.io processing worked -', Object.keys(flyResult));
  } catch (error) {
    console.log('⚠️  Fly.io unavailable, testing fallback -', error.message);
  }

  // 4. TEST OPENAI FALLBACK
  console.log('\n4️⃣ Testing OpenAI Fallback');
  try {
    const fallbackResult = await processAIRequest({
      taskName: 'categorization',
      userId: 'fallback-test-user',
      userPlan: 'standard',
      dataPayload: { description: 'coffee shop', amount: 5 },
      aiLogicFunction: async () => ({ category: 'Food & Dining', confidence: 0.9 }),
      flyioEndpoint: '/invalid-endpoint' // Force fallback
    });
    console.log('✅ PASSED: Fallback working -', fallbackResult);
  } catch (error) {
    console.log('❌ FAILED: Fallback should work -', error.message);
  }

  // 5. TEST ERROR RECOVERY
  console.log('\n5️⃣ Testing Error Recovery');
  try {
    const errorResult = await processAIRequest({
      taskName: 'contextual-tips',
      userId: 'error-test-user',
      userPlan: 'free',
      dataPayload: { test: 'data' },
      aiLogicFunction: async () => {
        throw new Error('Simulated AI function error');
      }
    });
    console.log('❌ FAILED: Should have caught error');
  } catch (error) {
    console.log('✅ PASSED: Error recovery working -', error.message);
  }

  // 6. TEST PLAN-BASED ACCESS CONTROL
  console.log('\n6️⃣ Testing Plan-Based Access Control');
  try {
    await processAIRequest({
      taskName: 'daily-recommendations',
      userId: 'free-user',
      userPlan: 'free',
      dataPayload: { test: 'data' },
      aiLogicFunction: async () => ({ result: 'premium feature' })
    });
    console.log('❌ FAILED: Should have blocked free user from premium feature');
  } catch (error) {
    console.log('✅ PASSED: Plan access control working -', error.message);
  }

  console.log('\n🎉 AI Infrastructure Testing Complete!');
}

testInfrastructure().catch(console.error);