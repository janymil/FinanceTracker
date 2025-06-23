// Converted from openai-functions.ts to JavaScript for CommonJS compatibility
const OpenAI = require("openai");

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an AI financial categorization expert. Categorize the expense into one of these categories: Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Travel, Education, Personal Care, Other. Also provide a confidence score from 0 to 1."
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
    return { category: "Other", confidence: 0.5 };
  }
}

async function generateFinancialTips(data) {
  const cacheKey = getCacheKey('financialTips', data);
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  const { totalIncome, totalExpenses, transactionsByCategory, recentTransactions } = data;
  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert financial analyst providing premium-level insights. Analyze this financial profile and provide sophisticated recommendations in JSON array format.

FINANCIAL PROFILE:
- Monthly Income: $${totalIncome?.toFixed(2) || 0}
- Monthly Expenses: $${totalExpenses?.toFixed(2) || 0}
- Net Cash Flow: $${netBalance?.toFixed(2) || 0}
- Savings Rate: ${savingsRate?.toFixed(1) || 0}%
- Categories: ${transactionsByCategory?.length || 0}
- Recent Transactions: ${recentTransactions?.length || 0}

Provide detailed financial analysis with actionable recommendations. Return as JSON array with this exact structure:
[
  {
    "id": "tip_1",
    "title": "Specific Financial Optimization",
    "description": "Detailed multi-paragraph analysis with exact percentages, dollar targets, implementation steps, and expected savings. Use their actual financial numbers.",
    "category": "spending",
    "priority": "high",
    "actionable": true,
    "estimatedSaving": 150,
    "confidence": 0.85
  }
]`
        },
        {
          role: "user",
          content: "Provide comprehensive financial analysis based on the data above."
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content;
    let result = JSON.parse(content || '[]');
    
    if (!Array.isArray(result)) {
      result = result.tips || [result];
    }
    
    const processedTips = result.filter(tip => tip && tip.title);
    simpleCache.set(cacheKey, processedTips);
    return processedTips;
  } catch (error) {
    console.error('Financial tips generation error:', error);
    return [];
  }
}

async function generateDailyRecommendations(data) {
  const cacheKey = getCacheKey('dailyRecommendations', data);
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  const { summary, transactions, budgets, categories } = data;
  
  if (!transactions || transactions.length < 3) {
    return { recommendations: [], insights: [] };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI financial advisor providing personalized daily recommendations. Based on this financial data, generate actionable daily tasks and insights in JSON format:

Financial Overview:
- Income: $${summary?.totalIncome || 0}
- Expenses: $${summary?.totalExpenses || 0}  
- Transactions: ${transactions.length}
- Categories: ${categories?.length || 0}

Respond with JSON in this exact format:
{
  "recommendations": [
    {
      "id": "rec_1",
      "task": "Specific actionable task",
      "description": "Detailed explanation with steps",
      "priority": "high|medium|low",
      "timeEstimate": "X minutes",
      "category": "budgeting|spending|saving|income"
    }
  ],
  "insights": [
    {
      "id": "insight_1",
      "insight": "Financial insight with specific numbers",
      "confidence": 0.85,
      "category": "spending|income|budgeting|saving",
      "actionable": true
    }
  ]
}`
        },
        {
          role: "user",
          content: "Generate personalized daily recommendations based on the financial data."
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{"recommendations":[],"insights":[]}');
    const finalResult = {
      recommendations: result.recommendations || [],
      insights: result.insights || []
    };
    
    simpleCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (error) {
    console.error('Daily recommendations error:', error);
    return { recommendations: [], insights: [] };
  }
}

async function generateExpensePredictions(data) {
  const cacheKey = getCacheKey('expensePredictions', data);
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  const { summary, transactions } = data;
  
  if (!transactions || transactions.length < 3) {
    return {
      categoryPredictions: [],
      monthlyPredictions: [],
      overallTrend: "stable",
      confidence: 0
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analyze spending patterns and predict future expenses. Return JSON in this exact format:
{
  "categoryPredictions": [
    {
      "category": "Category Name",
      "currentMonth": 500,
      "predictedNext": 520,
      "confidence": 80,
      "trend": "increasing"
    }
  ],
  "monthlyPredictions": [
    {
      "month": "2025-07",
      "predicted": 3200,
      "confidence": 75
    }
  ],
  "overallTrend": "increasing",
  "confidence": 80
}

Data: ${transactions.length} transactions, $${summary?.totalExpenses || 0} total expenses`
        },
        {
          role: "user",
          content: "Generate expense predictions based on the spending patterns."
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{"categoryPredictions":[],"monthlyPredictions":[],"overallTrend":"stable","confidence":0}');
    simpleCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Expense predictions error:', error);
    return {
      categoryPredictions: [],
      monthlyPredictions: [],
      overallTrend: "stable",
      confidence: 0
    };
  }
}

async function generateTrendPredictions(transactions, categoryMap, budgets) {
  const cacheKey = getCacheKey('trendPredictions', { transactions, categoryMap, budgets });
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

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

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analyze financial trends and predict future patterns. Return JSON in this exact format:
{
  "categoryPredictions": [
    {
      "categoryName": "Food & Dining",
      "currentMonthSpending": 800,
      "predictedNextMonth": 850,
      "trend": "increasing",
      "confidence": 85,
      "insights": "Detailed reasoning for prediction"
    }
  ],
  "financialForecast": {
    "nextMonthExpectedIncome": 5000,
    "nextMonthExpectedExpenses": 3500,
    "projectedSavings": 1500,
    "confidenceLevel": 80,
    "trendDirection": "improving",
    "keyInsights": [
      "Specific insight about trends",
      "Prediction reasoning",
      "Recommendation"
    ]
  }
}

Data: ${transactions.length} transactions across ${Object.keys(categoryMap || {}).length} categories`
        },
        {
          role: "user",
          content: "Analyze trends and provide predictions based on the financial data."
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{"categoryPredictions":[],"financialForecast":{"nextMonthExpectedIncome":0,"nextMonthExpectedExpenses":0,"projectedSavings":0,"confidenceLevel":0,"trendDirection":"stable","keyInsights":[]}}');
    simpleCache.set(cacheKey, result);
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
        keyInsights: ["Error generating predictions"]
      }
    };
  }
}

async function generateFinancialHealthScore(data) {
  const cacheKey = getCacheKey('financialHealthScore', data);
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  const { summary, budgets, transactions, useAdvancedFactors } = data;
  
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

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Calculate comprehensive financial health score. Return JSON in this exact format:
{
  "score": 75,
  "status": "good",
  "color": "green",
  "factors": [
    {
      "name": "Cash Flow Management",
      "score": 80,
      "max": 100,
      "description": "Analysis of income vs expenses"
    }
  ],
  "recommendations": [
    "Specific actionable recommendation"
  ],
  "riskFactors": [
    "Identified financial risk"
  ]
}

Data: Income $${summary?.totalIncome || 0}, Expenses $${summary?.totalExpenses || 0}, ${transactions?.length || 0} transactions`
        },
        {
          role: "user",
          content: "Calculate financial health score based on the provided data."
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{"score":0,"status":"insufficient-data","color":"gray","factors":[],"recommendations":[],"riskFactors":[]}');
    simpleCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Financial health score error:', error);
    return {
      score: 0,
      status: "error",
      color: "red",
      factors: [],
      recommendations: ["Error calculating financial health"],
      riskFactors: ["Analysis error"]
    };
  }
}

async function generateSpendingInsights(transactions) {
  const cacheKey = getCacheKey('spendingInsights', { transactions });
  if (simpleCache.has(cacheKey)) {
    return simpleCache.get(cacheKey);
  }

  if (!transactions || transactions.length < 3) {
    return [];
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analyze spending patterns and generate insights. Return JSON array in this exact format:
[
  {
    "id": "insight_1",
    "type": "trend",
    "title": "Specific insight title",
    "description": "Detailed analysis with dollar amounts",
    "impact": "high",
    "category": "Food & Dining",
    "amount": 250,
    "recommendation": "Actionable recommendation",
    "actionable": true,
    "confidence": 85
  }
]

Data: ${transactions.length} transactions to analyze`
        },
        {
          role: "user",
          content: "Analyze spending patterns and provide insights."
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500
    });
    
    const content = response.choices[0].message.content;
    let result = JSON.parse(content || '[]');
    
    if (!Array.isArray(result)) {
      result = result.insights || [result];
    }
    
    const processedInsights = result.filter(insight => insight && insight.title);
    simpleCache.set(cacheKey, processedInsights);
    return processedInsights;
  } catch (error) {
    console.error('Spending insights error:', error);
    return [];
  }
}

// Alias for backward compatibility
const generateAIFinancialHealthScore = generateFinancialHealthScore;

module.exports = {
  categorizeExpense,
  generateFinancialTips,
  generateSpendingInsights,
  generateAIFinancialHealthScore,
  generateTrendPredictions,
  generateExpensePredictions,
  generateDailyRecommendations,
  generateFinancialHealthScore
};