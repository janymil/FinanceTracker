// Quick test of all 7 AI functions with shorter timeout
const testData = {
  'contextual-tips': { totalIncome: 3000, totalExpenses: 500, transactions: [{ description: 'Coffee', amount: 5, date: '2025-06-23', type: 'expense' }] },
  'daily-recommendations': { transactions: [{ description: 'Coffee', amount: 5, date: '2025-06-23', type: 'expense' }], summary: { totalIncome: 3000, totalExpenses: 500, netAmount: 2500 }, budgets: [] },
  'financial-tips': { totalIncome: 3000, totalExpenses: 500, transactionsByCategory: [], recentTransactions: [{ description: 'Coffee', amount: 5, date: '2025-06-23', type: 'expense' }] },
  'expense-predictions': { transactions: [{ description: 'Coffee', amount: 5, date: '2025-06-23', type: 'expense', categoryName: 'Food' }] },
  'financial-health-score': { transactions: [{ description: 'Coffee', amount: 5, date: '2025-06-23', type: 'expense', categoryName: 'Food' }], budgets: [], summary: { totalIncome: 3000, totalExpenses: 500, netBalance: 2500 } },
  'spending-insights': { transactions: [{ description: 'Coffee', amount: 5, date: '2025-06-23', categoryName: 'Food', type: 'expense' }] },
  'trend-predictions': { transactions: [{ id: 1, amount: '5', description: 'Coffee', date: '2025-06-23', type: 'expense', categoryId: 1 }], categoryMap: { '1': 'Food' }, budgets: [] }
};

async function quickTest() {
  console.log("Quick test of all 7 AI functions:\n");
  let passed = 0;
  
  for (const [task, payload] of Object.entries(testData)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch("https://finanzerpro.fly.dev/execute-gpt-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, userId: 'test-user', payload }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${task}: Working`);
        passed++;
      } else {
        console.log(`❌ ${task}: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`⏱️ ${task}: ${error.name === 'AbortError' ? 'Timeout (8s)' : error.message}`);
    }
  }
  
  console.log(`\nResult: ${passed}/7 functions working immediately`);
  console.log(`Note: Timeout functions may work but take >8 seconds`);
}

quickTest();