import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

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

async function handleContextualTips({ summary, transactions, budgets, selectedMonth }: any) {
  const cacheKey = `contextual_tips_${JSON.stringify({ summary, selectedMonth })}`;
  
  try {
  const messages = [
    {
      role: "system",
      content: `You are a financial advisor AI that provides personalized financial tips based on user data. 

Generate 4 contextual financial tips that are:
- Specific to their spending patterns and financial situation
- Actionable with clear next steps  
- Relevant to their current month's activity
- Focused on improvement opportunities

Categories: spending, saving, budgeting, income
Priorities: high, medium, low

Respond with JSON in this exact format:
{
  "tips": [
    {
      "id": "tip_1",
      "title": "Clear, actionable tip title", 
      "description": "Detailed explanation with specific recommendations and dollar amounts when relevant",
      "category": "spending|saving|budgeting|income",
      "priority": "high|medium|low",
      "actionable": true
    }
  ]
}`
    },
    {
      role: "user",
      content: `Month: ${selectedMonth}

Summary: ${JSON.stringify(summary)}

Recent Transactions: ${JSON.stringify(transactions?.slice(0, 10) || [])}

Budgets: ${JSON.stringify(budgets || [])}

Generate contextual financial tips based on this data.`
    }
  ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content || '{"tips":[]}');
    
    // Cache successful result for fallback
    fallbackCache.set(cacheKey, result);
    return result;
    
  } catch (error) {
    console.error('OpenAI error in contextual tips:', error);
    
    // Return cached data if available
    const cached = fallbackCache.get(cacheKey);
    if (cached) {
      console.log('Using cached contextual tips as fallback');
      return cached;
    }
    
    // Only return empty if no cache available
    return { tips: [] };
  }
}

async function handleDailyRecommendations({ summary, transactions, budgets, categories }: any) {
  const cacheKey = `daily_recommendations_${JSON.stringify({ summary, transactionCount: transactions?.length })}`;
  
  try {
  const messages = [
    {
      role: "system",
      content: `You are a daily financial task manager. Generate personalized daily financial recommendations and insights.

Generate response in JSON format:
{
  "recommendations": [
    {
      "id": "rec_1",
      "task": "Clear, actionable daily task",
      "description": "Detailed explanation with specific steps",
      "priority": "high|medium|low",
      "timeEstimate": "5 minutes",
      "category": "budgeting|spending|saving|income"
    }
  ],
  "insights": [
    {
      "id": "insight_1", 
      "insight": "Personalized financial insight",
      "basedOn": "What data this insight comes from",
      "confidence": 0.8,
      "timeframe": "This week"
    }
  ]
}`
    },
    {
      role: "user",
      content: `Based on:

Summary: ${JSON.stringify(summary)}

Recent Transactions: ${transactions?.length || 0} transactions
${JSON.stringify(transactions?.slice(0, 10) || [])}

Active Budgets: ${budgets?.length || 0} budgets
${JSON.stringify(budgets || [])}

Generate daily recommendations and insights based on my financial data.`
    }
  ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content || '{"recommendations":[],"insights":[]}');
    
    // Cache successful result for fallback
    fallbackCache.set(cacheKey, result);
    return result;
    
  } catch (error) {
    console.error('OpenAI error in daily recommendations:', error);
    
    // Return cached data if available
    const cached = fallbackCache.get(cacheKey);
    if (cached) {
      console.log('Using cached daily recommendations as fallback');
      return cached;
    }
    
    // Only return empty if no cache available
    return { recommendations: [], insights: [] };
  }
}

async function handleFinancialTips({ summary }: any) {
  const cacheKey = `financial_tips_${JSON.stringify(summary)}`;
  
  try {
  const messages = [
    {
      role: "system",
      content: `You are an AI Financial Analyst providing premium-level insights. Your analysis must demonstrate these EXACT capabilities that users pay for:

1. SPENDING PATTERN ANALYSIS: Identify spending trends, seasonal patterns, category concentrations, and behavioral insights
2. PERSONALIZED SAVING RECOMMENDATIONS: Calculate specific saving opportunities based on their exact income/expense ratios
3. BUDGET OPTIMIZATION SUGGESTIONS: Recommend category rebalancing with precise dollar amounts
4. CONTEXT-AWARE FINANCIAL ADVICE: Consider their financial position, goals, and risk tolerance

Return comprehensive analysis in JSON:
{
  "title": "Advanced Financial Analysis: [Specific Focus Area]",
  "description": "DETAILED multi-paragraph analysis including: 1) Mathematical breakdown of their spending patterns with percentages, 2) Specific optimization recommendations with exact dollar targets, 3) Implementation timeline with measurable milestones, 4) Risk assessment and protection strategies. Use their exact financial numbers throughout.",
  "category": "spending|saving|budgeting|income|education", 
  "priority": "high|medium|low",
  "actionable": true,
  "estimatedSaving": [realistic_amount],
  "educational": false
}`
    },
    {
      role: "user",
      content: summary
    }
  ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.9
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content || '{}');
    const tipData = { tip: result };
    
    // Cache successful result for fallback
    fallbackCache.set(cacheKey, tipData);
    return tipData;
    
  } catch (error) {
    console.error('OpenAI error in financial tips:', error);
    
    // Return cached data if available
    const cached = fallbackCache.get(cacheKey);
    if (cached) {
      console.log('Using cached financial tips as fallback');
      return cached;
    }
    
    // Only return empty if no cache available
    return { tip: {} };
  }
}

async function handleExpensePredictions({ transactions, summary }: any) {
  const cacheKey = `expense_predictions_${JSON.stringify({ summary, transactionCount: transactions?.length })}`;
  
  try {
  const messages = [
    {
      role: "system",
      content: `You are an AI financial analyst that predicts future expenses based on spending patterns.

Analyze the transaction data and provide predictions in JSON format:
{
  "categoryPredictions": [
    {
      "category": "category name",
      "currentMonth": amount,
      "predictedNext": amount,
      "confidence": 0.8,
      "trend": "increasing|decreasing|stable"
    }
  ],
  "monthlyPredictions": [
    {
      "month": "2025-07",
      "predicted": amount,
      "confidence": 0.75
    }
  ],
  "overallTrend": "increasing|decreasing|stable",
  "confidence": 0.8
}`
    },
    {
      role: "user",
      content: `Analyze transaction patterns:

Summary: ${JSON.stringify(summary)}

Recent Transactions: ${JSON.stringify(transactions?.slice(0, 50) || [])}

Predict future expenses based on these patterns.`
    }
  ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content || '{"categoryPredictions":[],"monthlyPredictions":[]}');
    
    // Cache successful result for fallback
    fallbackCache.set(cacheKey, result);
    return result;
    
  } catch (error) {
    console.error('OpenAI error in expense predictions:', error);
    
    // Return cached data if available
    const cached = fallbackCache.get(cacheKey);
    if (cached) {
      console.log('Using cached expense predictions as fallback');
      return cached;
    }
    
    // Only return empty if no cache available
    return { categoryPredictions: [], monthlyPredictions: [] };
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

async function handleFinancialHealthScore(payload: any) {
  const { summary, budgets, transactions, useAdvancedFactors } = payload;
  
  const prompt = `You are an AI financial health analyst. Calculate a comprehensive financial health score and provide improvement recommendations.

Financial Data:
- Summary: ${JSON.stringify(summary)}
- Budgets: ${JSON.stringify(budgets)}
- Recent Transactions: ${transactions?.length || 0} transactions
- Advanced Analysis: ${useAdvancedFactors ? 'enabled' : 'disabled'}

Return analysis in JSON format:
{
  "score": number_0_to_100,
  "status": "excellent|good|fair|poor",
  "color": "green|yellow|orange|red",
  "factors": [
    {
      "name": "factor name",
      "score": number_0_to_100,
      "max": 100,
      "description": "detailed explanation"
    }
  ],
  "recommendations": ["recommendation1", "recommendation2"],
  "riskFactors": ["risk1", "risk2"]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Analyze my financial health and provide a comprehensive score." }
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    response_format: { type: "json_object" },
    temperature: 0.7
  });

  return JSON.parse(response.choices[0].message.content || '{"score":50,"status":"fair","color":"yellow","factors":[],"recommendations":[],"riskFactors":[]}');
}

async function handleSpendingInsights(payload: any) {
  const { transactions } = payload;
  
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const prompt = `You are a financial analysis expert. Analyze spending transactions to identify patterns, trends, and insights.

Generate 2-4 insights focusing on:
- Unusual spending patterns
- Budget optimization opportunities  
- Positive financial behaviors
- Spending trends and recommendations

Transactions: ${JSON.stringify(transactions.slice(0, 30))}

Return insights in JSON format:
{
  "insights": [
    {
      "id": "insight_1",
      "type": "warning|suggestion|achievement|trend",
      "title": "insight title",
      "description": "detailed description",
      "impact": "high|medium|low",
      "category": "category name",
      "amount": number,
      "recommendation": "actionable recommendation",
      "actionable": true
    }
  ]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Analyze my spending patterns and provide insights." }
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    response_format: { type: "json_object" },
    temperature: 0.7
  });

  const result = JSON.parse(response.choices[0].message.content || '{"insights":[]}');
  return Array.isArray(result) ? result : (result.insights || []);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`AI Processor server running on port ${port}`);
});