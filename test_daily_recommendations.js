// Test script to verify daily recommendations are working with Fly.io
const fetch = require('node-fetch');

async function testDailyRecommendations() {
  console.log('🧪 Testing Daily Recommendations Integration...\n');

  // Test 1: Direct Fly.io endpoint test
  console.log('1. Testing Fly.io endpoint directly...');
  try {
    const response = await fetch('https://finanserpro-ai-processor.fly.dev/generate-daily-recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: {
          totalIncome: 5500,
          totalExpenses: 15,
          netAmount: 5485
        },
        transactions: [
          {
            id: 1,
            amount: "8.50",
            description: "Starbucks coffee",
            date: "2025-06-22",
            type: "expense",
            categoryId: 1
          },
          {
            id: 2,
            amount: "3.75",
            description: "Bus ticket",
            date: "2025-06-21",
            type: "expense",
            categoryId: 2
          },
          {
            id: 3,
            amount: "2.25",
            description: "Parking meter",
            date: "2025-06-20",
            type: "expense",
            categoryId: 3
          }
        ],
        budgets: [
          { name: "Food Budget", amount: "200", period: "monthly" }
        ],
        categories: {
          "1": "Food & Dining",
          "2": "Transportation", 
          "3": "Parking"
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Fly.io endpoint SUCCESS!');
      console.log(`📊 Generated ${result.recommendations?.length || 0} recommendations`);
      console.log(`💡 Generated ${result.insights?.length || 0} insights`);
      console.log('🔍 Sample recommendation:', result.recommendations?.[0]?.title || 'None');
      console.log('🔍 Sample insight:', result.insights?.[0]?.insight || 'None');
    } else {
      const errorText = await response.text();
      console.log('❌ Fly.io endpoint FAILED:', response.status, errorText);
    }
  } catch (error) {
    console.log('❌ Fly.io endpoint ERROR:', error.message);
  }

  console.log('\n' + '='.repeat(50));

  // Test 2: Local API endpoint test (through Replit to Fly.io)
  console.log('2. Testing local API endpoint (which should call Fly.io)...');
  try {
    const response = await fetch('http://localhost:5000/api/ai/daily-recommendations', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // This would be real Clerk token in practice
      },
      body: JSON.stringify({
        summary: {
          totalIncome: 5500,
          totalExpenses: 15,
          netAmount: 5485
        },
        transactions: [
          {
            id: 1,
            amount: "8.50",
            description: "Morning coffee",
            date: "2025-06-22",
            type: "expense",
            categoryId: 1
          },
          {
            id: 2,
            amount: "3.75",
            description: "Public transport",
            date: "2025-06-21", 
            type: "expense",
            categoryId: 2
          },
          {
            id: 3,
            amount: "2.25",
            description: "Parking fee",
            date: "2025-06-20",
            type: "expense",
            categoryId: 3
          }
        ],
        budgets: []
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Local API SUCCESS (called through to Fly.io)!');
      console.log(`📊 Generated ${result.recommendations?.length || 0} recommendations`);
      console.log(`💡 Generated ${result.insights?.length || 0} insights`);
    } else {
      const errorText = await response.text();
      console.log('❌ Local API FAILED:', response.status, errorText);
    }
  } catch (error) {
    console.log('❌ Local API ERROR:', error.message);
  }

  console.log('\n🎯 Check server logs for "FLY.IO API CALL" messages to verify external processing!');
}

testDailyRecommendations();