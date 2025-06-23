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

// Import sophisticated AI functions from openai-functions.js
const {
  categorizeExpense,
  generateFinancialTips,
  generateSpendingInsights,
  generateAIFinancialHealthScore,
  generateDailyRecommendations,
  generateExpensePredictions,
  generateTrendPredictions
} = require('./openai-functions.js');

const port = parseInt(process.env.PORT || '8080', 10);

// Parse JSON request body
function parseBody(req) {
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

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (path === '/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      service: 'ai-processor',
      model: 'gpt-4o'
    }));
    return;
  }

  // Unified AI task endpoint
  if (path === '/execute-gpt-task' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { task, userId, payload } = body;

      if (!task || !userId || !payload) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Missing required fields: task, userId, payload' 
        }));
        return;
      }

      let result;

      // Route to sophisticated AI functions from openai-functions.js
      switch (task) {
        case 'financial-tips':
          result = await generateFinancialTips(
            payload.totalIncome,
            payload.totalExpenses,
            payload.transactionsByCategory,
            payload.recentTransactions
          );
          break;

        case 'daily-recommendations':
          result = await generateDailyRecommendations(
            payload.summary,
            payload.transactions,
            payload.budgets,
            payload.categories
          );
          break;

        case 'expense-predictions':
          result = await generateExpensePredictions(
            payload.summary,
            payload.transactions
          );
          break;

        case 'trend-predictions':
          result = await generateTrendPredictions(
            payload.transactions,
            payload.categoryMap,
            payload.budgets
          );
          break;

        case 'financial-health-score':
          result = await generateAIFinancialHealthScore(
            payload.summary,
            payload.budgets,
            payload.transactions,
            payload.useAdvancedFactors
          );
          break;

        case 'spending-insights':
          result = await generateSpendingInsights(
            payload.transactions,
            payload.budgets,
            payload.categories
          );
          break;

        case 'categorize-expense':
          result = await categorizeExpense(
            payload.description,
            payload.amount
          );
          break;

        default:
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Unknown task: ${task}` }));
          return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));

    } catch (error) {
      console.error(`Error processing ${req.url}:`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }));
    }
    return;
  }

  // Legacy endpoint for financial tips
  if (path === '/generate-financial-tip' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await generateFinancialTips(
        body.totalIncome,
        body.totalExpenses,
        body.transactionsByCategory,
        body.recentTransactions
      );
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Error in /generate-financial-tip:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  // Legacy endpoint for daily recommendations
  if (path === '/generate-daily-recommendation' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await generateDailyRecommendations(
        body.summary,
        body.transactions,
        body.budgets,
        body.categories
      );
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Error in /generate-daily-recommendation:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`AI Processor server running on port ${port}`);
  console.log('Available endpoints:');
  console.log('- POST /execute-gpt-task (unified endpoint for all AI tasks)');
  console.log('- POST /generate-daily-recommendation (legacy)');
  console.log('- POST /generate-financial-tip (legacy)');
  console.log('- GET /health');
});