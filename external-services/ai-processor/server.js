const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Import sophisticated AI functions from openai-functions.js (converted from TypeScript)
const {
  categorizeExpense,
  generateFinancialTips,
  generateSpendingInsights,
  generateAIFinancialHealthScore,
  generateTrendPredictions,
  generateExpensePredictions,
  generateDailyRecommendations,
  generateFinancialHealthScore
} = require('./openai-functions');

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

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

// === Task-specific handlers that call sophisticated functions from openai-functions.js ===

async function handleContextualTips(payload) {
  // Call the sophisticated financial tips function from openai-functions.js
  return await generateFinancialTips(payload);
}

async function handleDailyRecommendations(payload) {
  // Call the sophisticated daily recommendations function from openai-functions.js
  return await generateDailyRecommendations(payload);
}

async function handleFinancialTips(payload) {
  // Call the sophisticated financial tips function from openai-functions.js
  return await generateFinancialTips(payload);
}

async function handleExpensePredictions(payload) {
  // Call the sophisticated expense predictions function from openai-functions.js
  return await generateExpensePredictions(payload);
}

async function handleTrendPredictions(payload) {
  // Call the sophisticated trend predictions function from openai-functions.js
  const { transactions, categoryMap, budgets } = payload;
  return await generateTrendPredictions(transactions, categoryMap, budgets);
}

async function handleFinancialHealthScore(payload) {
  // Call the sophisticated financial health score function from openai-functions.js
  return await generateFinancialHealthScore(payload);
}

async function handleSpendingInsights(payload) {
  // Call the sophisticated spending insights function from openai-functions.js
  return await generateSpendingInsights(payload.transactions);
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