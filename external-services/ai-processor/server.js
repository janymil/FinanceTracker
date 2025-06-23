const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const dotenv = require('dotenv');

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

// === Task-specific handlers ===

// Simple in-memory cache for fallback data
const fallbackCache = new Map();

// Simple OpenAI API call using fetch
async function callOpenAI(messages, model = 'gpt-4o') {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
  }

  return await response.json();
}

async function handleContextualTips(payload) {
  return await handleFinancialTips(payload);
}

async function handleDailyRecommendations(payload) {
  const { summary, transactions, budgets, categories } = payload;
  
  if (!transactions || transactions.length < 3) {
    return {
      recommendations: [],
      insights: []
    };
  }

  const prompt = `You are an AI financial advisor providing personalized daily task recommendations and insights.

Financial Overview:
- Total Income: $${summary.totalIncome || 0}
- Total Expenses: $${summary.totalExpenses || 0}
- Net Position: $${(summary.totalIncome || 0) - (summary.totalExpenses || 0)}
- Transaction Count: ${transactions.length}

Generate personalized daily recommendations and insights. Focus on actionable tasks.

Respond with JSON:
{
  "recommendations": [
    {
      "id": "rec_1",
      "task": "Clear, specific actionable task",
      "description": "Detailed explanation with specific steps",
      "priority": "high|medium|low",
      "timeEstimate": "X minutes",
      "category": "budgeting|spending|saving|income"
    }
  ],
  "insights": [
    {
      "id": "insight_1", 
      "insight": "Specific financial insight with exact numbers",
      "confidence": 0.85,
      "category": "spending|income|budgeting|saving",
      "actionable": true
    }
  ]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Generate my personalized daily financial recommendations." }
  ];

  try {
    const response = await callOpenAI(messages);
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

async function handleFinancialTips(payload) {
  const { totalIncome, totalExpenses, transactionsByCategory, recentTransactions } = payload;
  
  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;
  
  const categoryBreakdown = transactionsByCategory.map(cat => 
    `${cat.categoryName}: $${cat.amount} (${cat.type})`
  ).join(', ');
  
  const recentActivity = recentTransactions.slice(0, 5).map(tx => 
    `${tx.description}: $${tx.amount} on ${tx.date}`
  ).join(', ');

  const prompt = `You are an expert financial analyst providing premium-level personalized financial insights.

COMPREHENSIVE FINANCIAL PROFILE:
- Monthly Income: $${totalIncome.toFixed(2)}
- Monthly Expenses: $${totalExpenses.toFixed(2)}
- Net Cash Flow: $${netBalance.toFixed(2)}
- Savings Rate: ${savingsRate.toFixed(1)}%
- Category Breakdown: ${categoryBreakdown}
- Recent Activity: ${recentActivity}

Provide sophisticated financial analysis with actionable recommendations.

Return as JSON array:
[
  {
    "id": "tip_1",
    "title": "Category Optimization: [Specific Area]",
    "description": "Multi-paragraph analysis with exact percentages, dollar targets, implementation steps, and expected savings impact. Include mathematical breakdown using actual numbers.",
    "category": "spending|saving|budgeting|income|education",
    "priority": "high|medium|low", 
    "actionable": true,
    "estimatedSaving": [monthly_dollar_amount],
    "confidence": 0.85
  }
]`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Provide comprehensive financial analysis based on my detailed financial profile." }
  ];

  try {
    const response = await callOpenAI(messages);
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

  const prompt = `Analyze spending patterns to forecast future expenses based on this data:
- Total Expenses: $${summary.totalExpenses || 0}
- Transactions: ${transactions.length}

Generate predictions in JSON:
{
  "categoryPredictions": [
    {
      "category": "Category Name", 
      "currentMonth": [current_spending],
      "predictedNext": [predicted_amount],
      "confidence": [0-100],
      "trend": "increasing|decreasing|stable"
    }
  ],
  "monthlyPredictions": [
    {
      "month": "2025-07",
      "predicted": [total_predicted_expenses],
      "confidence": [0-100]
    }
  ],
  "overallTrend": "increasing|decreasing|stable",
  "confidence": [0-100]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Generate expense predictions based on my spending patterns." }
  ];

  try {
    const response = await callOpenAI(messages);
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

  const prompt = `Analyze financial trends and predict future patterns based on transaction data.

Generate predictions in JSON:
{
  "categoryPredictions": [
    {
      "categoryName": "Category Name",
      "currentMonthSpending": [current_amount],
      "predictedNextMonth": [predicted_amount],
      "trend": "increasing|decreasing|stable",
      "confidence": [0-100],
      "insights": "Detailed explanation of prediction factors"
    }
  ],
  "financialForecast": {
    "nextMonthExpectedIncome": [predicted_income],
    "nextMonthExpectedExpenses": [predicted_expenses], 
    "projectedSavings": [income_minus_expenses],
    "confidenceLevel": [0-100],
    "trendDirection": "improving|declining|stable",
    "keyInsights": [
      "Insight 1 with specific numbers",
      "Insight 2 about trends", 
      "Insight 3 about implications"
    ]
  }
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Analyze my financial trends and provide predictions." }
  ];

  try {
    const response = await callOpenAI(messages);
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
        keyInsights: ["Error generating predictions. Please try again."]
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

  const prompt = `Calculate a comprehensive financial health score based on:
- Income: $${summary.totalIncome || 0}
- Expenses: $${summary.totalExpenses || 0}
- Transactions: ${transactions?.length || 0}
- Budgets: ${budgets?.length || 0}

Return analysis in JSON:
{
  "score": [0-100],
  "status": "excellent|good|fair|poor|insufficient-data",
  "color": "green|yellow|orange|red|gray",
  "factors": [
    {
      "name": "Cash Flow Management",
      "score": [0-100],
      "max": 100,
      "description": "Analysis of income vs expenses with recommendations"
    }
  ],
  "recommendations": [
    "Specific actionable recommendation"
  ],
  "riskFactors": [
    "Identified financial risk"
  ]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Calculate my financial health score with factor analysis." }
  ];

  try {
    const response = await callOpenAI(messages);
    return JSON.parse(response.choices[0].message.content || '{"score":0,"status":"insufficient-data","color":"gray","factors":[],"recommendations":[],"riskFactors":[]}');
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

async function handleSpendingInsights(payload) {
  const { transactions } = payload;
  
  if (!transactions || transactions.length < 3) {
    return [];
  }

  const prompt = `Analyze spending patterns and generate actionable insights based on transaction data.

Generate insights as JSON array:
[
  {
    "id": "insight_1",
    "type": "trend|suggestion|warning|achievement|optimization",
    "title": "Clear, specific insight title",
    "description": "Detailed analysis with specific dollar amounts and percentages",
    "impact": "high|medium|low", 
    "category": "Category Name",
    "amount": [dollar_amount_referenced],
    "recommendation": "Specific actionable recommendation",
    "actionable": true,
    "confidence": [0-100]
  }
]`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Analyze my spending patterns and provide insights." }
  ];

  try {
    const response = await callOpenAI(messages);
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
});