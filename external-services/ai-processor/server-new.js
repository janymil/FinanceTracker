const http = require('http');
const url = require('url');
const fs = require('fs');

// Load environment variables from .env file
function loadEnv() {
  try {
    const envFile = fs.readFileSync('.env', 'utf8');
    const lines = envFile.split('\n');
    lines.forEach(line => {
      const [key, ...values] = line.split('=');
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join('=').trim();
      }
    });
  } catch (error) {
    console.log('No .env file found, using environment variables');
  }
}

loadEnv();

const port = parseInt(process.env.PORT || '8080', 10);

// OpenAI API integration
async function callOpenAI(messages, model = 'gpt-4o', responseFormat = null) {
  const body = {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 2000
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
  }

  return await response.json();
}

// Helper function to parse request body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

// SOPHISTICATED AI FUNCTIONS - COPIED FROM openai-functions.ts
async function generateDailyRecommendations(payload) {
  const { summary, transactions, budgets, categories } = payload;
  
  if (!transactions || transactions.length < 3) {
    return {
      recommendations: [],
      insights: []
    };
  }

  // Calculate category spending for insights
  const categorySpending = {};
  transactions.forEach(t => {
    if (t.type === 'expense') {
      const categoryName = categories?.find(c => c.id === t.categoryId)?.name || 'Other';
      categorySpending[categoryName] = (categorySpending[categoryName] || 0) + parseFloat(t.amount);
    }
  });

  const topCategories = Object.entries(categorySpending)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  // Sophisticated prompt with detailed financial context
  const prompt = `You are an AI financial advisor providing personalized daily task recommendations and insights.

Financial Overview:
- Total Income: $${summary.totalIncome || 0}
- Total Expenses: $${summary.totalExpenses || 0}
- Net Position: $${(summary.totalIncome || 0) - (summary.totalExpenses || 0)}
- Transaction Count: ${transactions.length}
- Active Budgets: ${budgets?.length || 0}
- Top Spending Categories: ${topCategories.map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`).join(', ')}

Recent Transaction Patterns:
${transactions.slice(0, 10).map(t => `- ${t.description}: $${t.amount} (${t.type}) on ${t.date}`).join('\n')}

Based on this comprehensive financial data, generate personalized daily recommendations and insights. Focus on:
1. Actionable tasks they can complete today to improve their financial situation
2. Specific insights about their spending patterns with exact dollar amounts
3. Recommendations that consider their actual budget constraints and goals
4. Priority levels based on potential financial impact

Respond with JSON in this exact format:
{
  "recommendations": [
    {
      "id": "rec_1",
      "task": "Clear, specific actionable task",
      "description": "Detailed explanation with specific steps and expected outcomes",
      "priority": "high|medium|low",
      "timeEstimate": "X minutes",
      "category": "budgeting|spending|saving|income",
      "potentialSaving": 0
    }
  ],
  "insights": [
    {
      "id": "insight_1", 
      "insight": "Specific financial insight with exact numbers from their data",
      "confidence": 0.85,
      "category": "spending|income|budgeting|saving",
      "actionable": true,
      "impact": "high|medium|low"
    }
  ]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Generate my personalized daily financial recommendations and insights." }
  ];

  try {
    const response = await callOpenAI(messages, 'gpt-4o', { type: "json_object" });
    const result = JSON.parse(response.choices[0].message.content || '{"recommendations":[],"insights":[]}');
    
    return {
      recommendations: result.recommendations || [],
      insights: result.insights || []
    };
  } catch (error) {
    console.error('Daily recommendations error:', error);
    return {
      recommendations: [],
      insights: []
    };
  }
}

async function generateFinancialTips(payload) {
  const { totalIncome, totalExpenses, transactionsByCategory, recentTransactions } = payload;
  
  // Enhanced financial analysis
  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;
  
  // Category analysis
  const expensesByCategory = transactionsByCategory.filter(cat => cat.type === 'expense');
  const largestExpenseCategory = expensesByCategory.reduce((max, cat) => 
    cat.amount > (max?.amount || 0) ? cat : max, null);
  
  // Spending pattern analysis
  const totalExpenseAmount = expensesByCategory.reduce((sum, cat) => sum + cat.amount, 0);
  const categoryPercentages = expensesByCategory.map(cat => ({
    name: cat.categoryName,
    amount: cat.amount,
    percentage: ((cat.amount / totalExpenseAmount) * 100).toFixed(1)
  }));

  const prompt = `You are an expert financial analyst providing premium-level personalized financial insights.

COMPREHENSIVE FINANCIAL PROFILE:
- Monthly Income: $${totalIncome.toFixed(2)}
- Monthly Expenses: $${totalExpenses.toFixed(2)}
- Net Cash Flow: $${netBalance.toFixed(2)}
- Savings Rate: ${savingsRate.toFixed(1)}%
- Largest Expense Category: ${largestExpenseCategory?.categoryName || 'N/A'} ($${largestExpenseCategory?.amount?.toFixed(2) || '0'})

DETAILED CATEGORY BREAKDOWN:
${categoryPercentages.map(cat => `- ${cat.name}: $${cat.amount.toFixed(2)} (${cat.percentage}% of expenses)`).join('\n')}

RECENT TRANSACTION PATTERNS:
${recentTransactions.slice(0, 8).map(tx => 
  `- ${tx.description}: $${tx.amount} (${tx.categoryName || 'Uncategorized'}) on ${tx.date}`
).join('\n')}

Provide sophisticated financial analysis with actionable recommendations. Consider:
1. Mathematical optimization opportunities based on spending patterns
2. Category-specific reduction strategies with exact dollar targets
3. Income enhancement opportunities
4. Risk mitigation and emergency fund strategies
5. Long-term wealth building recommendations

Return as JSON array with detailed analysis:
[
  {
    "id": "tip_1",
    "title": "Category Optimization: [Specific Area]",
    "description": "Multi-paragraph analysis: 1) Current spending analysis with exact percentages, 2) Specific optimization recommendations with dollar targets, 3) Implementation steps with timeline, 4) Expected monthly/yearly savings impact. Include mathematical breakdown using their actual numbers.",
    "category": "spending|saving|budgeting|income|education",
    "priority": "high|medium|low", 
    "actionable": true,
    "estimatedSaving": [monthly_dollar_amount],
    "confidence": 0.85,
    "timeframe": "immediate|1-month|3-months|6-months"
  }
]`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Provide comprehensive financial analysis and optimization recommendations based on my detailed financial profile." }
  ];

  try {
    const response = await callOpenAI(messages, 'gpt-4o', { type: "json_object" });
    const content = response.choices[0].message.content;
    let result = JSON.parse(content || '[]');
    
    // Handle both array and object responses
    if (!Array.isArray(result)) {
      result = [result];
    }
    
    return result.filter(tip => tip && tip.title); // Filter out empty tips
  } catch (error) {
    console.error('Financial tips error:', error);
    return [];
  }
}

async function generateContextualTips(payload) {
  const { summary, transactions, budgets, selectedMonth } = payload;
  
  if (!transactions || transactions.length === 0) {
    return { tips: [] };
  }

  // Enhanced contextual analysis
  const monthTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    const selectedDate = new Date(selectedMonth);
    return txDate.getMonth() === selectedDate.getMonth() && 
           txDate.getFullYear() === selectedDate.getFullYear();
  });

  if (monthTransactions.length === 0) {
    return { tips: [] };
  }

  // Category analysis for the selected month
  const categorySpending = {};
  const categoryTransactionCount = {};
  
  monthTransactions.forEach(t => {
    if (t.type === 'expense') {
      const category = t.categoryName || 'Other';
      categorySpending[category] = (categorySpending[category] || 0) + parseFloat(t.amount);
      categoryTransactionCount[category] = (categoryTransactionCount[category] || 0) + 1;
    }
  });

  const totalMonthExpenses = Object.values(categorySpending).reduce((sum, amount) => sum + amount, 0);
  const topSpendingCategories = Object.entries(categorySpending)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  // Budget comparison
  const budgetAnalysis = budgets?.map(budget => {
    const spent = categorySpending[budget.categoryName] || 0;
    const remaining = parseFloat(budget.amount) - spent;
    const utilization = (spent / parseFloat(budget.amount)) * 100;
    
    return {
      category: budget.categoryName,
      budgeted: parseFloat(budget.amount),
      spent: spent,
      remaining: remaining,
      utilization: utilization
    };
  }) || [];

  const prompt = `You are a personal financial advisor AI providing contextual tips for ${selectedMonth}.

MONTH-SPECIFIC FINANCIAL ANALYSIS:
- Selected Month: ${selectedMonth}
- Total Month Expenses: $${totalMonthExpenses.toFixed(2)}
- Transaction Count: ${monthTransactions.length}
- Active Categories: ${Object.keys(categorySpending).length}

TOP SPENDING CATEGORIES THIS MONTH:
${topSpendingCategories.map(([cat, amount]) => 
  `- ${cat}: $${amount.toFixed(2)} (${((amount/totalMonthExpenses)*100).toFixed(1)}%) - ${categoryTransactionCount[cat]} transactions`
).join('\n')}

BUDGET PERFORMANCE:
${budgetAnalysis.map(b => 
  `- ${b.category}: $${b.spent.toFixed(2)}/$${b.budgeted.toFixed(2)} (${b.utilization.toFixed(0)}% used) - $${b.remaining.toFixed(2)} remaining`
).join('\n')}

RECENT MONTH TRANSACTIONS:
${monthTransactions.slice(0, 10).map(t => 
  `- ${t.description}: $${t.amount} (${t.categoryName}) on ${new Date(t.date).toLocaleDateString()}`
).join('\n')}

Generate 4 contextual financial tips specifically for this month that are:
- Based on actual spending patterns and budget performance
- Actionable with specific dollar amounts and steps
- Relevant to their current month's financial situation  
- Focused on optimization opportunities with measurable outcomes

Respond with JSON in this exact format:
{
  "tips": [
    {
      "id": "tip_1",
      "title": "Month-Specific Actionable Tip Title",
      "description": "Detailed explanation with specific recommendations, exact dollar amounts from their data, and clear next steps. Include mathematical analysis of their spending patterns.",
      "category": "spending|saving|budgeting|income",
      "priority": "high|medium|low",
      "actionable": true,
      "potentialSaving": [dollar_amount],
      "timeframe": "rest-of-month|next-month"
    }
  ]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: `Provide contextual financial tips for ${selectedMonth} based on my month-specific spending patterns and budget performance.` }
  ];

  try {
    const response = await callOpenAI(messages, 'gpt-4o', { type: "json_object" });
    const result = JSON.parse(response.choices[0].message.content || '{"tips":[]}');
    return result;
  } catch (error) {
    console.error('Contextual tips error:', error);
    return { tips: [] };
  }
}

async function generateTrendPredictions(payload) {
  const { transactions, categoryMap, budgets } = payload;
  
  if (!transactions || transactions.length === 0) {
    return {
      categoryPredictions: [],
      financialForecast: {
        nextMonthExpectedIncome: 0,
        nextMonthExpectedExpenses: 0,
        projectedSavings: 0,
        confidenceLevel: 0,
        trendDirection: "stable",
        keyInsights: ["Add transactions to enable AI trend predictions"]
      }
    };
  }

  // Enhanced trend analysis
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Categorize transactions by month
  const monthlyData = {};
  const categoryData = {};
  
  transactions.forEach(tx => {
    const txDate = new Date(tx.date);
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
    const categoryName = categoryMap[tx.categoryId] || 'Other';
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0, transactions: [] };
    }
    
    if (!categoryData[categoryName]) {
      categoryData[categoryName] = { monthly: {}, total: 0, count: 0 };
    }
    
    const amount = parseFloat(tx.amount);
    
    if (tx.type === 'income') {
      monthlyData[monthKey].income += amount;
    } else {
      monthlyData[monthKey].expenses += amount;
      categoryData[categoryName].total += amount;
      categoryData[categoryName].count += 1;
      
      if (!categoryData[categoryName].monthly[monthKey]) {
        categoryData[categoryName].monthly[monthKey] = 0;
      }
      categoryData[categoryName].monthly[monthKey] += amount;
    }
    
    monthlyData[monthKey].transactions.push(tx);
  });

  // Calculate trends
  const monthKeys = Object.keys(monthlyData).sort();
  const recentMonths = monthKeys.slice(-3); // Last 3 months for trend analysis
  
  const prompt = `You are an AI financial forecasting expert. Analyze spending patterns and predict future trends.

HISTORICAL MONTHLY DATA:
${monthKeys.map(month => `${month}: Income $${monthlyData[month].income.toFixed(2)}, Expenses $${monthlyData[month].expenses.toFixed(2)}, Net $${(monthlyData[month].income - monthlyData[month].expenses).toFixed(2)}`).join('\n')}

CATEGORY SPENDING ANALYSIS:
${Object.entries(categoryData).map(([category, data]) => 
  `${category}: Total $${data.total.toFixed(2)} across ${data.count} transactions (Avg: $${(data.total/data.count).toFixed(2)} per transaction)`
).join('\n')}

RECENT TRENDS (Last 3 months):
${recentMonths.map(month => {
  const monthData = monthlyData[month];
  return `${month}: ${monthData.transactions.length} transactions, $${monthData.expenses.toFixed(2)} expenses`;
}).join('\n')}

ACTIVE BUDGETS:
${budgets?.map(b => `${categoryMap[b.categoryId] || 'Unknown'}: $${b.amount} budgeted`).join('\n') || 'No active budgets'}

Based on this comprehensive financial history, provide sophisticated trend predictions. Consider:
1. Seasonal spending patterns and cyclical behaviors
2. Category-specific growth or reduction trends
3. Income stability and expense volatility
4. Budget adherence patterns and projected overspending
5. Economic factors that might affect future spending

Generate predictions in JSON format:
{
  "categoryPredictions": [
    {
      "categoryName": "Category Name",
      "currentMonthSpending": [current_amount],
      "predictedNextMonth": [predicted_amount],
      "trend": "increasing|decreasing|stable",
      "confidence": [0-100],
      "insights": "Detailed explanation of prediction factors and reasoning"
    }
  ],
  "financialForecast": {
    "nextMonthExpectedIncome": [predicted_income],
    "nextMonthExpectedExpenses": [predicted_expenses], 
    "projectedSavings": [income_minus_expenses],
    "confidenceLevel": [0-100],
    "trendDirection": "improving|declining|stable",
    "keyInsights": [
      "Insight 1 with specific numbers and reasoning",
      "Insight 2 about category trends", 
      "Insight 3 about budget implications"
    ]
  }
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Analyze my spending patterns and provide sophisticated financial trend predictions." }
  ];

  try {
    const response = await callOpenAI(messages, 'gpt-4o', { type: "json_object" });
    const result = JSON.parse(response.choices[0].message.content || '{"categoryPredictions":[],"financialForecast":{"nextMonthExpectedIncome":0,"nextMonthExpectedExpenses":0,"projectedSavings":0,"confidenceLevel":0,"trendDirection":"stable","keyInsights":[]}}');
    
    return result;
  } catch (error) {
    console.error('Trend predictions error:', error);
    return {
      categoryPredictions: [],
      financialForecast: {
        nextMonthExpectedIncome: 0,
        nextMonthExpectedExpenses: 0,
        projectedSavings: 0,
        confidenceLevel: 0,
        trendDirection: "stable",
        keyInsights: ["Error generating predictions. Please try again."]
      }
    };
  }
}

async function generateExpensePredictions(payload) {
  const { summary, transactions } = payload;
  
  if (!transactions || transactions.length < 3) {
    return {
      categoryPredictions: [],
      monthlyPredictions: [],
      overallTrend: "stable",
      confidence: 0
    };
  }

  // Enhanced expense analysis
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const categoryTotals = {};
  const monthlyTotals = {};
  
  expenseTransactions.forEach(tx => {
    const category = tx.categoryName || 'Other';
    const txDate = new Date(tx.date);
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
    const amount = parseFloat(tx.amount);
    
    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + amount;
  });

  const topCategories = Object.entries(categoryTotals)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8);

  const monthKeys = Object.keys(monthlyTotals).sort();
  const recentMonths = monthKeys.slice(-6); // Last 6 months

  const prompt = `You are an AI expense prediction specialist. Analyze spending patterns to forecast future expenses.

EXPENSE SUMMARY:
- Total Expenses: $${summary.totalExpenses || 0}
- Expense Transactions: ${expenseTransactions.length}
- Active Categories: ${Object.keys(categoryTotals).length}
- Analysis Period: ${monthKeys.length} months

TOP EXPENSE CATEGORIES:
${topCategories.map(([cat, total]) => {
  const transactions = expenseTransactions.filter(t => (t.categoryName || 'Other') === cat);
  const avgTransaction = total / transactions.length;
  return `${cat}: $${total.toFixed(2)} total, ${transactions.length} transactions (Avg: $${avgTransaction.toFixed(2)})`;
}).join('\n')}

MONTHLY SPENDING TRENDS:
${recentMonths.map(month => `${month}: $${monthlyTotals[month].toFixed(2)}`).join('\n')}

DETAILED TRANSACTION PATTERNS:
${expenseTransactions.slice(0, 15).map(t => 
  `${t.categoryName || 'Other'}: $${t.amount} - ${t.description} on ${t.date}`
).join('\n')}

Based on this comprehensive expense analysis, predict future spending patterns. Consider:
1. Category-specific spending cycles and seasonality
2. Average transaction sizes and frequency patterns
3. Monthly spending trends and growth rates
4. Recurring expense identification
5. Unusual spending spikes or reductions

Generate predictions in JSON format:
{
  "categoryPredictions": [
    {
      "category": "Category Name", 
      "currentMonth": [current_spending],
      "predictedNext": [predicted_amount],
      "confidence": [0-100],
      "trend": "increasing|decreasing|stable",
      "reasoning": "Detailed explanation of prediction factors"
    }
  ],
  "monthlyPredictions": [
    {
      "month": "2025-07",
      "predicted": [total_predicted_expenses],
      "confidence": [0-100],
      "breakdown": "Key categories driving the prediction"
    }
  ],
  "overallTrend": "increasing|decreasing|stable",
  "confidence": [0-100],
  "insights": [
    "Key insight about spending patterns",
    "Warning about potential overspending areas",
    "Opportunity for expense optimization"
  ]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Analyze my expense patterns and generate sophisticated expense predictions." }
  ];

  try {
    const response = await callOpenAI(messages, 'gpt-4o', { type: "json_object" });
    const result = JSON.parse(response.choices[0].message.content || '{"categoryPredictions":[],"monthlyPredictions":[],"overallTrend":"stable","confidence":0}');
    
    return result;
  } catch (error) {
    console.error('Expense predictions error:', error);
    return {
      categoryPredictions: [],
      monthlyPredictions: [],
      overallTrend: "stable", 
      confidence: 0,
      insights: ["Error generating predictions. Please try again."]
    };
  }
}

async function generateFinancialHealthScore(payload) {
  const { summary, budgets, transactions, useAdvancedFactors } = payload;
  
  if (!summary || (!transactions || transactions.length < 3)) {
    return {
      score: 0,
      status: "insufficient-data",
      color: "gray",
      factors: [],
      recommendations: ["Add more transactions to calculate financial health"],
      riskFactors: ["Insufficient data for analysis"]
    };
  }

  const prompt = `You are an AI financial health analyst. Calculate a comprehensive financial health score and provide improvement recommendations.

COMPREHENSIVE FINANCIAL PROFILE:
- Monthly Income: $${summary.totalIncome || 0}
- Monthly Expenses: $${summary.totalExpenses || 0}
- Net Cash Flow: $${(summary.totalIncome || 0) - (summary.totalExpenses || 0)}
- Savings Rate: ${summary.totalIncome > 0 ? (((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100).toFixed(1) : 0}%
- Transaction Volume: ${transactions?.length || 0} transactions
- Active Budgets: ${budgets?.length || 0}
- Advanced Analysis: ${useAdvancedFactors ? 'Enabled' : 'Basic'}

BUDGET PERFORMANCE:
${budgets?.map(budget => {
  const categoryTransactions = transactions.filter(t => t.categoryId === budget.categoryId && t.type === 'expense');
  const spent = categoryTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const utilization = (spent / parseFloat(budget.amount)) * 100;
  return `${budget.name}: $${spent.toFixed(2)}/$${budget.amount} (${utilization.toFixed(0)}% used)`;
}).join('\n') || 'No active budgets'}

SPENDING PATTERNS:
${transactions ? (() => {
  const categorySpending = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const category = t.categoryName || 'Other';
    categorySpending[category] = (categorySpending[category] || 0) + parseFloat(t.amount);
  });
  
  return Object.entries(categorySpending)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`)
    .join('\n');
})() : 'No expense data'}

Calculate a comprehensive financial health score (0-100) considering:
1. Cash flow management and savings rate
2. Budget adherence and spending discipline  
3. Financial stability and consistency
4. Risk factors and emergency preparedness
5. Spending optimization opportunities

Return analysis in JSON format:
{
  "score": [0-100],
  "status": "excellent|good|fair|poor|insufficient-data",
  "color": "green|yellow|orange|red|gray",
  "factors": [
    {
      "name": "Cash Flow Management",
      "score": [0-100],
      "max": 100,
      "description": "Detailed analysis of income vs expenses with specific recommendations"
    },
    {
      "name": "Budget Discipline", 
      "score": [0-100],
      "max": 100,
      "description": "Assessment of budget adherence with improvement suggestions"
    },
    {
      "name": "Spending Patterns",
      "score": [0-100], 
      "max": 100,
      "description": "Analysis of spending consistency and optimization opportunities"
    }
  ],
  "recommendations": [
    "Specific actionable recommendation with dollar targets",
    "Budget optimization suggestion with expected savings",
    "Financial goal recommendation with timeline"
  ],
  "riskFactors": [
    "Identified financial risk with mitigation strategy",
    "Spending vulnerability with prevention advice"
  ],
  "insights": [
    "Key financial strength to leverage",
    "Critical improvement area with action plan"
  ]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Calculate my comprehensive financial health score with detailed factor analysis." }
  ];

  try {
    const response = await callOpenAI(messages, 'gpt-4o', { type: "json_object" });
    const result = JSON.parse(response.choices[0].message.content || '{"score":0,"status":"insufficient-data","color":"gray","factors":[],"recommendations":[],"riskFactors":[]}');
    
    return result;
  } catch (error) {
    console.error('Financial health score error:', error);
    return {
      score: 0,
      status: "error",
      color: "red",
      factors: [],
      recommendations: ["Error calculating financial health. Please try again."],
      riskFactors: ["Analysis error - unable to calculate score"]
    };
  }
}

async function generateSpendingInsights(payload) {
  const { transactions } = payload;
  
  if (!transactions || transactions.length < 3) {
    return [];
  }

  // Enhanced spending analysis
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const categoryAnalysis = {};
  const merchantAnalysis = {};
  const dailySpending = {};
  
  expenseTransactions.forEach(tx => {
    const category = tx.categoryName || 'Other';
    const amount = parseFloat(tx.amount);
    const date = tx.date.split('T')[0]; // Get date only
    const merchant = tx.description.split(' ').slice(0, 2).join(' '); // First two words as merchant
    
    // Category analysis
    if (!categoryAnalysis[category]) {
      categoryAnalysis[category] = { total: 0, count: 0, transactions: [] };
    }
    categoryAnalysis[category].total += amount;
    categoryAnalysis[category].count += 1;
    categoryAnalysis[category].transactions.push(tx);
    
    // Merchant analysis
    if (!merchantAnalysis[merchant]) {
      merchantAnalysis[merchant] = { total: 0, count: 0, category: category };
    }
    merchantAnalysis[merchant].total += amount;
    merchantAnalysis[merchant].count += 1;
    
    // Daily spending
    dailySpending[date] = (dailySpending[date] || 0) + amount;
  });

  const topCategories = Object.entries(categoryAnalysis)
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 5);
    
  const topMerchants = Object.entries(merchantAnalysis)
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 5);

  const totalExpenses = expenseTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
  const avgDailySpending = Object.values(dailySpending).reduce((sum, amount) => sum + amount, 0) / Object.keys(dailySpending).length;

  const prompt = `You are an AI spending pattern analyst. Analyze transaction data to identify meaningful insights and recommendations.

SPENDING OVERVIEW:
- Total Expenses: $${totalExpenses.toFixed(2)}
- Expense Transactions: ${expenseTransactions.length}
- Average Daily Spending: $${avgDailySpending.toFixed(2)}
- Active Spending Days: ${Object.keys(dailySpending).length}
- Categories Used: ${Object.keys(categoryAnalysis).length}

TOP SPENDING CATEGORIES:
${topCategories.map(([cat, data]) => 
  `${cat}: $${data.total.toFixed(2)} (${((data.total/totalExpenses)*100).toFixed(1)}%) - ${data.count} transactions (Avg: $${(data.total/data.count).toFixed(2)})`
).join('\n')}

TOP MERCHANTS/VENDORS:
${topMerchants.map(([merchant, data]) => 
  `${merchant}: $${data.total.toFixed(2)} - ${data.count} visits (${data.category})`
).join('\n')}

DAILY SPENDING PATTERN:
${Object.entries(dailySpending).slice(-10).map(([date, amount]) => 
  `${date}: $${amount.toFixed(2)}`
).join('\n')}

TRANSACTION DETAILS:
${expenseTransactions.slice(0, 15).map(t => 
  `${t.categoryName || 'Other'}: $${t.amount} - ${t.description} on ${t.date}`
).join('\n')}

Based on this comprehensive spending analysis, generate actionable insights. Focus on:
1. Unusual spending patterns or anomalies
2. Optimization opportunities with specific dollar amounts
3. Behavioral insights about spending habits
4. Category-specific recommendations
5. Merchant loyalty and spending concentration

Generate insights as JSON array:
[
  {
    "id": "insight_1",
    "type": "trend|suggestion|warning|achievement|optimization",
    "title": "Clear, specific insight title",
    "description": "Detailed analysis with specific dollar amounts and percentages from the data",
    "impact": "high|medium|low", 
    "category": "Category Name",
    "amount": [dollar_amount_referenced],
    "recommendation": "Specific actionable recommendation with expected outcome",
    "actionable": true,
    "confidence": [0-100]
  }
]`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Analyze my spending patterns and provide sophisticated insights with actionable recommendations." }
  ];

  try {
    const response = await callOpenAI(messages, 'gpt-4o', { type: "json_object" });
    const content = response.choices[0].message.content;
    let result = JSON.parse(content || '[]');
    
    // Handle both array and object responses
    if (!Array.isArray(result)) {
      result = result.insights || [result];
    }
    
    return result.filter(insight => insight && insight.title); // Filter out empty insights
  } catch (error) {
    console.error('Spending insights error:', error);
    return [];
  }
}

// HTTP server setup
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (path === '/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    return;
  }

  // Main unified endpoint - handles all AI tasks
  if (path === '/execute-gpt-task' && method === 'POST') {
    try {
      const { task, userId, payload } = await parseBody(req);
      
      if (!task || !userId || !payload) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: task, userId, payload' }));
        return;
      }

      console.log(`Processing task: ${task} for user: ${userId}`);

      let result;
      switch(task) {
        case 'daily-recommendations':
          result = await generateDailyRecommendations(payload);
          break;
        case 'financial-tips':
          result = await generateFinancialTips(payload);
          break;
        case 'contextual-tips':
          result = await generateContextualTips(payload);
          break;
        case 'trend-predictions':
          result = await generateTrendPredictions(payload);
          break;
        case 'expense-predictions':
          result = await generateExpensePredictions(payload);
          break;
        case 'financial-health-score':
          result = await generateFinancialHealthScore(payload);
          break;
        case 'spending-insights':
          result = await generateSpendingInsights(payload);
          break;
        default:
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Unknown task: ${task}` }));
          return;
      }

      console.log(`Task ${task} completed successfully`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error(`Unified endpoint error for task ${task}:`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Internal server error',
        task: task || 'unknown',
        message: error.message 
      }));
    }
    return;
  }

  // Legacy endpoints for backward compatibility
  if (path === '/generate-daily-recommendation' && method === 'POST') {
    try {
      const payload = await parseBody(req);
      const result = await generateDailyRecommendations(payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Daily recommendation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  if (path === '/generate-financial-tip' && method === 'POST') {
    try {
      const payload = await parseBody(req);
      const result = await generateFinancialTips(payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Financial tip error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  // 404 for unknown routes
  console.log(`404 - Unknown route: ${method} ${path}`);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path, method }));
});

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`AI Processor service running on port ${port}`);
  console.log('Available endpoints:');
  console.log('- POST /execute-gpt-task (unified endpoint for all AI tasks)');
  console.log('- POST /generate-daily-recommendation (legacy)');
  console.log('- POST /generate-financial-tip (legacy)');
  console.log('- GET /health');
});