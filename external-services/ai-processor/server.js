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

const port = parseInt(process.env.PORT || '3000', 10);

// Simple OpenAI API call using fetch
async function callOpenAI(messages, model = 'gpt-4o') {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.9
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

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
    res.end(JSON.stringify({ status: 'ok', service: 'ai-processor' }));
    return;
  }

  // Generate 4 independent financial tips endpoint
  if (path === '/generate-financial-tips' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { financialData } = body;

      if (!financialData || typeof financialData !== 'object') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Invalid request: financialData object is required' 
        }));
        return;
      }

      const { totalIncome, totalExpenses, transactionsByCategory, recentTransactions } = financialData;
      const hasMinimalData = recentTransactions && recentTransactions.length >= 3;

      // Define the 4 independent tip categories
      const tipCategories = [
        {
          focus: "Spending Pattern Analysis",
          icon: "trending-chart",
          systemPrompt: `Analyze spending patterns and behavioral insights. Focus ONLY on spending trends, frequency patterns, category concentrations, and spending habits. ${hasMinimalData ? 'Use their exact transaction data to identify patterns.' : 'Suggest adding more transactions for better pattern analysis.'}`
        },
        {
          focus: "Personalized Saving Recommendations", 
          icon: "lightbulb",
          systemPrompt: `Generate specific saving opportunities and strategies. Focus ONLY on actionable ways to save money based on their income/expense ratio. ${hasMinimalData ? 'Calculate exact saving targets from their data.' : 'Provide general saving strategies and encourage more transaction data for personalized recommendations.'}`
        },
        {
          focus: "Budget Optimization Suggestions",
          icon: "pie-chart", 
          systemPrompt: `Recommend budget rebalancing and category optimization. Focus ONLY on budget allocation, category spending limits, and expense prioritization. ${hasMinimalData ? 'Use their category data for specific optimization targets.' : 'Explain budget basics and suggest tracking more expenses for detailed optimization.'}`
        },
        {
          focus: "Advanced Financial Analysis",
          icon: "target",
          systemPrompt: `Provide strategic financial insights and risk assessment. Focus ONLY on financial health, risk mitigation, and wealth building strategies. ${hasMinimalData ? 'Analyze their financial position for strategic recommendations.' : 'Provide foundational financial advice and recommend comprehensive transaction tracking.'}`
        }
      ];

      const tips = [];

      for (const category of tipCategories) {
        const messages = [
          {
            role: "system",
            content: `You are a Premium AI Financial Advisor specializing in ${category.focus}. 

FOCUS AREA: ${category.focus}
${category.systemPrompt}

CONTENT REQUIREMENTS:
- Generate ONLY content related to ${category.focus}
- Do NOT overlap with other categories
- Provide 2-3 specific, actionable recommendations
- Use exact financial figures when available
- Keep content concise but valuable (100-150 words)

DATA AVAILABILITY: ${hasMinimalData ? 'Sufficient transaction data available' : 'Limited transaction data - encourage more tracking'}

${hasMinimalData ? `
FINANCIAL DATA:
- Monthly Income: $${totalIncome}
- Monthly Expenses: $${totalExpenses}
- Net Balance: $${totalIncome - totalExpenses}
- Transaction Categories: ${transactionsByCategory?.filter(cat => cat.type === 'expense').map(cat => `${cat.categoryName}: $${cat.amount}`).join(', ')}
- Recent Transactions: ${recentTransactions?.length || 0} transactions
` : `
LIMITED DATA NOTICE: User has ${recentTransactions?.length || 0} transactions. Recommend adding more financial data for personalized analysis.
`}

Return JSON:
{
  "title": "${category.focus}",
  "description": "[Focused content for this category only]",
  "category": "spending|saving|budgeting|income|education",
  "priority": "high|medium|low",
  "actionable": true,
  "estimatedSaving": [number_or_null],
  "educational": false,
  "icon": "${category.icon}"
}`
          },
          {
            role: "user", 
            content: hasMinimalData ? 
              `Please analyze my financial data and provide specific recommendations for ${category.focus}.` :
              `I have limited financial data (${recentTransactions?.length || 0} transactions). Please provide guidance for ${category.focus} and encourage better tracking.`
          }
        ];

        try {
          const response = await callOpenAI(messages);
          const result = JSON.parse(response.choices[0].message.content || '{}');
          tips.push(result);
        } catch (error) {
          console.error(`Error generating ${category.focus}:`, error);
          // Provide fallback tip
          tips.push({
            title: category.focus,
            description: hasMinimalData ? 
              `Analysis for ${category.focus} requires more comprehensive data. Please add more transactions to unlock detailed insights.` :
              `To provide personalized ${category.focus}, please add more financial transactions to your account.`,
            category: "education",
            priority: "medium", 
            actionable: true,
            estimatedSaving: null,
            educational: true,
            icon: category.icon
          });
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tips }));

    } catch (error) {
      console.error('OpenAI API Error:', error);
      
      if (error.message.includes('OpenAI API error:')) {
        const statusMatch = error.message.match(/(\d{3})/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: error.message,
          type: 'api_error'
        }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }));
      }
    }
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`AI Processor service running on port ${port}`);
});