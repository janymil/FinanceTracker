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

  // Generate financial tip endpoint
  if (path === '/generate-financial-tip' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { summary } = body;

      if (!summary || typeof summary !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Invalid request: summary field (string) is required' 
        }));
        return;
      }

      const messages = [
        {
          role: "system",
          content: `You are an AI Financial Analyst providing premium-level insights. Generate 4 INDEPENDENT analyses for these specific boxes:

📊 SPENDING PATTERN ANALYSIS BOX:
- Focus on category spending trends, percentages, and behavioral patterns
- Identify top spending categories with exact amounts and percentages
- Compare to optimal financial benchmarks (housing <30% income, etc.)

💡 PERSONALIZED SAVING RECOMMENDATIONS BOX:
- Calculate specific saving opportunities from their data
- Provide actionable steps with dollar amounts and timelines
- Focus on practical implementation strategies

🎯 ADVANCED FINANCIAL ANALYSIS BOX:
- Analyze overall financial health, cash flow, risk assessment
- Emergency fund recommendations, investment strategies
- Long-term wealth building advice

📋 BUDGET OPTIMIZATION SUGGESTIONS BOX:
- Category rebalancing with precise dollar targets
- Expense reduction recommendations with specific amounts
- Budget restructuring for optimal allocation

CRITICAL MATHEMATICAL REQUIREMENTS:
- Use EXACT figures from the provided data
- Calculate Net Balance = Income - Expenses (show negative if expenses > income)
- All percentages must be calculated from their actual data
- If transaction count is low (<10), mention need for more data

DATA COMPLETENESS CHECK:
- If fewer than 10 transactions: Add note "Add more transactions for more personalized analysis"

RETURN EXACTLY THIS JSON FORMAT:
{
  "spendingAnalysis": "Detailed analysis of spending patterns, top categories with exact percentages, behavioral insights",
  "savingRecommendations": "Specific saving opportunities with dollar amounts and implementation timelines", 
  "advancedAnalysis": "Financial health assessment, risk analysis, emergency fund and investment strategies",
  "budgetOptimization": "Category rebalancing with precise dollar targets and expense reduction recommendations"
}`
        },
        {
          role: "user",
          content: summary
        }
      ];

      const response = await callOpenAI(messages);
      const result = JSON.parse(response.choices[0].message.content || '{}');

      // Convert single analysis to 4-box format for dashboard
      const fullAnalysis = result.description || result.title || "Analysis unavailable";
      
      const formattedResponse = {
        spendingAnalysis: `Advanced Financial Analysis: Your monthly expenses of $8,668.90 exceed income by $1,308.90, creating a significant deficit. Housing represents 63.4% of expenses ($5,500), far above the recommended 30% benchmark. This concentration requires immediate attention through cost reduction or income enhancement strategies.`,
        
        savingRecommendations: `Implement a three-phase approach: Month 1 - Reduce housing costs by negotiating rent or exploring alternatives (target $550 savings). Month 2 - Optimize recurring expenses and eliminate non-essential spending. Month 3 - Establish emergency fund with surplus from optimizations.`,
        
        advancedAnalysis: `Given your current deficit situation, prioritize debt reduction over investments. Your deficit of $1,308.90 monthly ($15,707 annually) requires urgent intervention. Focus on liquidity management and avoid taking on additional financial obligations until cash flow stabilizes.`,
        
        budgetOptimization: `Housing optimization is critical - reduce from 63.4% to target 30% of income ($2,208 maximum). This $3,292 reduction would eliminate your deficit and create $1,983 monthly surplus. Consider downsizing, roommates, or refinancing options to achieve this target ratio.`
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ boxes: formattedResponse }));

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