import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";
import {
  categorizeExpense,
  generateFinancialTips,
  generateSpendingInsights,
  generateAIFinancialHealthScore,
  generateTrendPredictions,
  generateExpensePredictions,
  generateDailyRecommendations,
  generateFinancialHealthScore,
  generateContextualTips
} from './openai-functions';

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

async function handleContextualTips(payload: any) {
  // Call the sophisticated contextual tips function from openai-functions.ts
  const { summary, transactions, budgets, selectedMonth } = payload;
  return await generateContextualTips(summary, transactions, budgets, selectedMonth);
}

async function handleDailyRecommendations(payload: any) {
  // Call the sophisticated daily recommendations function from openai-functions.ts
  return await generateDailyRecommendations(payload);
}

async function handleFinancialTips(payload: any) {
  // Call the sophisticated financial tips function from openai-functions.ts
  return await generateFinancialTips(payload);
}

async function handleExpensePredictions(payload: any) {
  // Call the sophisticated expense predictions function from openai-functions.ts
  return await generateExpensePredictions(payload);
}

async function handleTrendPredictions(payload: any) {
  // Call the sophisticated trend predictions function from openai-functions.ts
  return await generateTrendPredictions(payload);
}

async function handleFinancialHealthScore(payload: any) {
  // Call the sophisticated financial health score function from openai-functions.ts
  return await generateFinancialHealthScore(payload);
}

async function handleSpendingInsights(payload: any) {
  // Call the sophisticated spending insights function from openai-functions.ts
  return await generateSpendingInsights(payload);
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
  return await generateAIFinancialHealthScore(payload);
}

async function handleSpendingInsights(payload: any) {
  return await generateSpendingInsights(payload.transactions);
}

async function handleTrendPredictions(payload: any) {
  const { transactions, categoryMap, budgets } = payload;
  return await generateTrendPredictions(transactions, categoryMap, budgets);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`AI Processor server running on port ${port}`);
});