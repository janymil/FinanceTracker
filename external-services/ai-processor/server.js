const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const dotenv = require('dotenv');

// Note: openai-functions.ts has compilation errors and dependencies issues
// For now, we need to implement the sophisticated functions directly in server.js
// This is a temporary solution until we can properly compile the TypeScript functions

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-processor', model: 'gpt-4o' });
});

// Unified AI endpoint - routes all tasks through single interface
app.post("/execute-gpt-task", async (req, res) => {
  const { task, userId, payload } = req.body;

  if (!task || !userId || !payload) {
    return res.status(400).json({ error: 'Missing required fields: task, userId, payload' });
  }

  try {
    let result;

    switch (task) {
      case "contextual-tips":
        result = await handleContextualTips(payload);
        break;

      case "daily-recommendations":
        result = await handleDailyRecommendations(payload);
        break;

      case "financial-tips":
        result = await handleFinancialTips(payload);
        break;

      case "expense-predictions":
        result = await handleExpensePredictions(payload);
        break;

      case "trend-predictions":
        result = await handleTrendPredictions(payload);
        break;

      case "financial-health-score":
        result = await handleFinancialHealthScore(payload);
        break;

      case "spending-insights":
        result = await handleSpendingInsights(payload);
        break;

      default:
        return res.status(400).json({ error: `Unknown AI task: ${task}` });
    }

    return res.json(result);
  } catch (err) {
    console.error(`AI task error [${task}]`, err);
    return res.status(500).json({ error: "AI task failed" });
  }
});

// === Task-specific handlers that call sophisticated functions from openai-functions.ts ===

// OpenAI API helper function
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

// Temporary implementation until TypeScript functions can be properly compiled
async function handleContextualTips(payload) {
  return await handleFinancialTips(payload);
}

async function handleDailyRecommendations(payload) {
  const { summary, transactions, budgets, categories } = payload;
  
  if (!transactions || transactions.length < 3) {
    return { recommendations: [], insights: [] };
  }

  const prompt = `You are an AI financial advisor providing personalized daily recommendations. Based on this financial data, generate actionable daily tasks and insights in JSON format:

Financial Overview:
- Income: $${summary?.totalIncome || 0}
- Expenses: $${summary?.totalExpenses || 0}  
- Transactions: ${transactions.length}
- Categories: ${categories?.length || 0}

Respond with JSON:
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
}`;

  try {
    const response = await callOpenAI([
      { role: "system", content: prompt },
      { role: "user", content: "Generate personalized daily recommendations." }
    ], 'gpt-4o', { type: "json_object" });
    
    const result = JSON.parse(response.choices[0].message.content || '{"recommendations":[],"insights":[]}');
    return {
      recommendations: result.recommendations || [],
      insights: result.insights || []
    };
  } catch (error) {
    console.error('Daily recommendations error:', error);
    return { recommendations: [], insights: [] };
  }
}

async function handleFinancialTips(payload) {
  const { totalIncome, totalExpenses, transactionsByCategory, recentTransactions } = payload;
  
  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;

  const prompt = `You are an expert financial analyst providing premium-level insights. Analyze this financial profile and provide sophisticated recommendations in JSON array format:

FINANCIAL PROFILE:
- Monthly Income: $${totalIncome?.toFixed(2) || 0}
- Monthly Expenses: $${totalExpenses?.toFixed(2) || 0}
- Net Cash Flow: $${netBalance?.toFixed(2) || 0}
- Savings Rate: ${savingsRate?.toFixed(1) || 0}%
- Categories: ${transactionsByCategory?.length || 0}
- Recent Transactions: ${recentTransactions?.length || 0}

Provide detailed financial analysis with actionable recommendations. Return as JSON array:
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
]`;

  try {
    const response = await callOpenAI([
      { role: "system", content: prompt },
      { role: "user", content: "Provide comprehensive financial analysis." }
    ], 'gpt-4o', { type: "json_object" });
    
    const content = response.choices[0].message.content;
    let result = JSON.parse(content || '[]');
    
    if (!Array.isArray(result)) {
      result = [result];
    }
    
    return result.filter(tip => tip && tip.title);
  } catch (error) {
    console.error('Financial tips error:', error);
    return [];
  }
}

async function handleExpensePredictions(payload) {
  const { summary, transactions } = payload;
  
  if (!transactions || transactions.length < 3) {
    return {
      categoryPredictions: [],
      monthlyPredictions: [],
      overallTrend: "stable",
      confidence: 0
    };
  }

  const prompt = `Analyze spending patterns and predict future expenses. Return JSON:
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

Data: ${transactions.length} transactions, $${summary?.totalExpenses || 0} total expenses`;

  try {
    const response = await callOpenAI([
      { role: "system", content: prompt },
      { role: "user", content: "Generate expense predictions." }
    ], 'gpt-4o', { type: "json_object" });
    
    return JSON.parse(response.choices[0].message.content || '{"categoryPredictions":[],"monthlyPredictions":[],"overallTrend":"stable","confidence":0}');
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

async function handleTrendPredictions(payload) {
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

  const prompt = `Analyze financial trends and predict future patterns. Return JSON:
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

Data: ${transactions.length} transactions across ${Object.keys(categoryMap || {}).length} categories`;

  try {
    const response = await callOpenAI([
      { role: "system", content: prompt },
      { role: "user", content: "Analyze trends and provide predictions." }
    ], 'gpt-4o', { type: "json_object" });
    
    return JSON.parse(response.choices[0].message.content || '{"categoryPredictions":[],"financialForecast":{"nextMonthExpectedIncome":0,"nextMonthExpectedExpenses":0,"projectedSavings":0,"confidenceLevel":0,"trendDirection":"stable","keyInsights":[]}}');
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

async function handleFinancialHealthScore(payload) {
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

  const prompt = `Calculate comprehensive financial health score. Return JSON:
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

Data: Income $${summary?.totalIncome || 0}, Expenses $${summary?.totalExpenses || 0}, ${transactions?.length || 0} transactions`;

  try {
    const response = await callOpenAI([
      { role: "system", content: prompt },
      { role: "user", content: "Calculate financial health score." }
    ], 'gpt-4o', { type: "json_object" });
    
    return JSON.parse(response.choices[0].message.content || '{"score":0,"status":"insufficient-data","color":"gray","factors":[],"recommendations":[],"riskFactors":[]}');
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

async function handleSpendingInsights(payload) {
  const { transactions } = payload;
  
  if (!transactions || transactions.length < 3) {
    return [];
  }

  const prompt = `Analyze spending patterns and generate insights. Return JSON array:
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

Data: ${transactions.length} transactions to analyze`;

  try {
    const response = await callOpenAI([
      { role: "system", content: prompt },
      { role: "user", content: "Analyze spending patterns." }
    ], 'gpt-4o', { type: "json_object" });
    
    const content = response.choices[0].message.content;
    let result = JSON.parse(content || '[]');
    
    if (!Array.isArray(result)) {
      result = result.insights || [result];
    }
    
    return result.filter(insight => insight && insight.title);
  } catch (error) {
    console.error('Spending insights error:', error);
    return [];
  }
}

// Legacy endpoints for backward compatibility
app.post('/generate-financial-tip', async (req, res) => {
  try {
    const result = await handleFinancialTips(req.body);
    res.json(result);
  } catch (error) {
    console.error('Legacy financial tip error:', error);
    res.status(500).json({ error: 'Financial tip generation failed' });
  }
});

app.post('/generate-daily-recommendation', async (req, res) => {
  try {
    const result = await handleDailyRecommendations(req.body);
    res.json(result);
  } catch (error) {
    console.error('Legacy daily recommendation error:', error);
    res.status(500).json({ error: 'Daily recommendation generation failed' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`AI Processor server running on port ${port}`);
  console.log('Available endpoints:');
  console.log('- POST /execute-gpt-task (unified endpoint for all AI tasks)');
  console.log('- POST /generate-daily-recommendation (legacy)');
  console.log('- POST /generate-financial-tip (legacy)');
  console.log('- GET /health');
});