const https = require('https');

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
// Using native https instead of OpenAI package to avoid external dependencies
async function callOpenAI(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error.message || 'OpenAI API error'));
          } else {
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Simple cache implementation since we can't import the full cache system
const simpleCache = new Map();

function getCacheKey(functionName, data) {
  return `${functionName}_${JSON.stringify(data).slice(0, 100)}`;
}

async function categorizeExpense(description, amount) {
  const cacheKey = getCacheKey('categorizeExpense', { description, amount });
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  try {
    const response = await callOpenAI({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI financial categorization expert. Categorize the expense accurately and provide reasoning.

          Available categories:
          - Food & Dining
          - Transportation  
          - Shopping
          - Entertainment
          - Bills & Utilities
          - Healthcare
          - Travel
          - Education
          - Personal Care
          - Other

          Respond with JSON containing:
          - category: string (exact match from list above)
          - confidence: number (0-1)
          - reasoning: string (brief explanation)`
        },
        {
          role: "user",
          content: `Categorize this expense: "${description}" for amount $${amount}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content);
    simpleCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Expense categorization error:', error);
    return { 
      category: "Other", 
      confidence: 0.5,
      reasoning: "Unable to categorize due to system error"
    };
  }
}

async function generateFinancialTips(totalIncome, totalExpenses, transactionsByCategory, recentTransactions) {
  const cacheKey = getCacheKey('financialTips', { totalIncome, totalExpenses });
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  try {
    const netIncome = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    
    const categoryAnalysis = transactionsByCategory.map(cat => 
      `${cat.category}: $${cat.amount}`
    ).join(', ');

    const recentSpending = recentTransactions.slice(0, 5).map(t => 
      `${t.description}: $${t.amount}`
    ).join(', ');

    const response = await callOpenAI({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert financial advisor. Analyze the user's financial data and provide personalized, actionable tips.

          Provide exactly 3 financial tips in JSON format:
          {
            "tips": [
              {
                "title": "Concise tip title",
                "description": "Detailed actionable advice",
                "category": "spending|saving|budgeting|income|education",
                "priority": "high|medium|low",
                "actionable": true,
                "estimatedSaving": number (optional),
                "educational": boolean
              }
            ]
          }

          Focus on:
          - Specific actionable advice based on actual spending patterns
          - Realistic savings opportunities
          - Budgeting improvements
          - Educational content when appropriate
          
          Avoid generic advice - make it personal and specific.`
        },
        {
          role: "user",
          content: `Financial Analysis:
          - Monthly Income: $${totalIncome}
          - Monthly Expenses: $${totalExpenses}
          - Net Income: $${netIncome}
          - Savings Rate: ${savingsRate.toFixed(1)}%
          
          Spending by Category: ${categoryAnalysis}
          Recent Transactions: ${recentSpending}
          
          Please provide 3 personalized financial tips based on this data.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content);
    simpleCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Financial tips generation error:', error);
    return {
      tips: [
        {
          title: "Review Your Spending",
          description: "Analyze your recent transactions to identify potential savings opportunities.",
          category: "budgeting",
          priority: "medium",
          actionable: true,
          educational: true
        }
      ]
    };
  }
}

async function generateSpendingInsights(transactions, budgets, categories) {
  const cacheKey = getCacheKey('spendingInsights', { transactions: transactions.length });
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  try {
    const totalSpent = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const categorySpending = {};
    
    transactions.forEach(t => {
      const category = t.category || 'Other';
      categorySpending[category] = (categorySpending[category] || 0) + Math.abs(t.amount);
    });

    const topCategories = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`)
      .join(', ');

    const response = await callOpenAI({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a financial analyst. Analyze spending patterns and provide insights.

          Respond with JSON:
          {
            "insights": [
              {
                "title": "Insight title",
                "description": "Detailed analysis",
                "category": "category name",
                "impact": "high|medium|low",
                "trend": "increasing|decreasing|stable",
                "actionable": true|false
              }
            ],
            "summary": "Brief overall summary"
          }`
        },
        {
          role: "user",
          content: `Analyze spending data:
          - Total Spent: $${totalSpent}
          - Number of Transactions: ${transactions.length}
          - Top Categories: ${topCategories}
          
          Provide insights about spending patterns and trends.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.6
    });

    const result = JSON.parse(response.choices[0].message.content);
    simpleCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Spending insights generation error:', error);
    return {
      insights: [],
      summary: "Unable to generate insights at this time."
    };
  }
}

async function generateAIFinancialHealthScore(summary, budgets, transactions, useAdvancedFactors = true) {
  const cacheKey = getCacheKey('financialHealthScore', { 
    income: summary.totalIncome, 
    expenses: summary.totalExpenses,
    advanced: useAdvancedFactors 
  });
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  try {
    const savingsRate = summary.totalIncome > 0 ? 
      ((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100 : 0;
    
    const budgetUtilization = budgets.length > 0 ? 
      budgets.reduce((sum, b) => sum + (b.spent / b.amount), 0) / budgets.length * 100 : 0;

    const response = await callOpenAI({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a financial health expert. Calculate a comprehensive financial health score (0-100) and provide analysis.

          Respond with JSON:
          {
            "score": number (0-100),
            "grade": "A|B|C|D|F",
            "factors": [
              {
                "category": "factor name",
                "score": number (0-100),
                "weight": number (0-1),
                "description": "explanation"
              }
            ],
            "recommendations": ["recommendation1", "recommendation2"],
            "strengths": ["strength1", "strength2"],
            "concerns": ["concern1", "concern2"]
          }`
        },
        {
          role: "user",
          content: `Calculate financial health score:
          - Monthly Income: $${summary.totalIncome}
          - Monthly Expenses: $${summary.totalExpenses}
          - Savings Rate: ${savingsRate.toFixed(1)}%
          - Budget Utilization: ${budgetUtilization.toFixed(1)}%
          - Transaction Count: ${transactions.length}
          - Advanced Analysis: ${useAdvancedFactors}
          
          Provide comprehensive financial health analysis.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4
    });

    const result = JSON.parse(response.choices[0].message.content);
    simpleCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Financial health score generation error:', error);
    return {
      score: 50,
      grade: "C",
      factors: [],
      recommendations: ["Review your financial data for better analysis"],
      strengths: [],
      concerns: []
    };
  }
}

async function generateDailyRecommendations(summary, transactions, budgets, categories) {
  const cacheKey = getCacheKey('dailyRecommendations', { 
    transactions: transactions.length,
    date: new Date().toDateString()
  });
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  try {
    const recentTransactions = transactions.slice(0, 10);
    const totalSpent = recentTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const response = await callOpenAI({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a personal financial assistant. Provide daily financial recommendations and insights.

          Respond with JSON:
          {
            "recommendations": [
              {
                "title": "Task title",
                "description": "Detailed description",
                "category": "budgeting|saving|tracking|planning",
                "priority": "high|medium|low",
                "timeEstimate": "time in minutes",
                "actionable": true
              }
            ],
            "insights": [
              {
                "title": "Insight title",
                "description": "Personal insight",
                "confidence": number (0-100),
                "category": "spending|income|trends|goals"
              }
            ]
          }

          Focus on:
          - Actionable daily tasks
          - Personalized insights based on recent activity
          - Practical financial management advice`
        },
        {
          role: "user",
          content: `Generate daily recommendations based on:
          - Income: $${summary.totalIncome}
          - Expenses: $${summary.totalExpenses}
          - Recent Spending: $${totalSpent}
          - Active Budgets: ${budgets.length}
          - Recent Transactions: ${recentTransactions.map(t => `${t.description}: $${t.amount}`).slice(0, 5).join(', ')}
          
          Provide personalized daily financial recommendations.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5
    });

    const result = JSON.parse(response.choices[0].message.content);
    simpleCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Daily recommendations generation error:', error);
    return {
      recommendations: [],
      insights: []
    };
  }
}

async function generateExpensePredictions(summary, transactions) {
  const cacheKey = getCacheKey('expensePredictions', { 
    expenses: summary.totalExpenses,
    count: transactions.length 
  });
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  try {
    const categorySpending = {};
    transactions.forEach(t => {
      const category = t.category || 'Other';
      categorySpending[category] = (categorySpending[category] || 0) + Math.abs(t.amount);
    });

    const response = await callOpenAI({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a financial forecasting expert. Predict future expenses based on historical data.

          Respond with JSON:
          {
            "categoryPredictions": [
              {
                "category": "category name",
                "currentMonth": number,
                "predictedNext": number,
                "confidence": number (0-100),
                "trend": "increasing|decreasing|stable"
              }
            ],
            "totalPrediction": {
              "predicted": number,
              "confidence": number (0-100),
              "variance": number
            },
            "insights": ["insight1", "insight2"]
          }`
        },
        {
          role: "user",
          content: `Predict expenses based on:
          - Current Total Expenses: $${summary.totalExpenses}
          - Transaction Count: ${transactions.length}
          - Category Breakdown: ${Object.entries(categorySpending).map(([cat, amt]) => `${cat}: $${amt}`).join(', ')}
          
          Provide expense predictions for next month.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4
    });

    const result = JSON.parse(response.choices[0].message.content);
    simpleCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Expense predictions generation error:', error);
    return {
      categoryPredictions: [],
      totalPrediction: { predicted: 0, confidence: 0, variance: 0 },
      insights: []
    };
  }
}

async function generateTrendPredictions(transactions, categoryMap, budgets) {
  const cacheKey = getCacheKey('trendPredictions', { 
    transactions: transactions.length,
    categories: Object.keys(categoryMap).length 
  });
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  try {
    const response = await callOpenAI({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a financial trend analyst. Analyze spending patterns and predict future trends.

          Respond with JSON:
          {
            "predictions": [
              {
                "category": "category name",
                "predictedAmount": number,
                "confidence": number (0-100),
                "trend": "increasing|decreasing|stable",
                "reasoning": "explanation",
                "monthlyForecast": [
                  {
                    "month": "month name",
                    "predicted": number,
                    "confidence": number
                  }
                ]
              }
            ],
            "overallForecast": {
              "nextMonthExpenses": number,
              "expectedSavings": number,
              "budgetVariance": number,
              "confidence": number,
              "keyInsights": ["insight1", "insight2"],
              "recommendations": ["rec1", "rec2"],
              "riskFactors": ["risk1", "risk2"]
            }
          }`
        },
        {
          role: "user",
          content: `Analyze trends and predict future spending:
          - Transaction Count: ${transactions.length}
          - Categories: ${Object.keys(categoryMap).join(', ')}
          - Active Budgets: ${budgets.length}
          - Recent Transactions: ${transactions.slice(0, 5).map(t => `${t.description}: $${t.amount}`).join(', ')}
          
          Provide comprehensive trend analysis and predictions.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.6
    });

    const result = JSON.parse(response.choices[0].message.content);
    simpleCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Trend predictions generation error:', error);
    return {
      predictions: [],
      overallForecast: {
        nextMonthExpenses: 0,
        expectedSavings: 0,
        budgetVariance: 0,
        confidence: 0,
        keyInsights: [],
        recommendations: [],
        riskFactors: []
      }
    };
  }
}

module.exports = {
  categorizeExpense,
  generateFinancialTips,
  generateSpendingInsights,
  generateAIFinancialHealthScore,
  generateDailyRecommendations,
  generateExpensePredictions,
  generateTrendPredictions
};