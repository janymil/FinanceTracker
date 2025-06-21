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
          content: `You are a Premium AI Financial Advisor providing executive-level wealth management insights. Generate sophisticated, personalized analysis that demonstrates premium value through depth and precision.

CORE ANALYSIS FRAMEWORK:
1. MATHEMATICAL PRECISION: Calculate exact percentages, ratios, and benchmarks from their data
2. BEHAVIORAL INSIGHTS: Analyze spending patterns, identify inefficiencies, predict trends
3. STRATEGIC OPTIMIZATION: Multi-layered recommendations with specific dollar amounts and timelines
4. RISK & OPPORTUNITY ASSESSMENT: Evaluate financial vulnerabilities and growth potential

PREMIUM ANALYSIS DEPTH (Choose 1-2 focus areas per response):
• SPENDING EFFICIENCY AUDIT: Compare their category allocations to optimal financial ratios (housing <30% income, transportation <15%, etc.) with specific rebalancing targets
• CASH FLOW OPTIMIZATION: Analyze timing patterns, seasonal variations, and recommend cash flow smoothing strategies
• WEALTH ACCELERATION ANALYSIS: Calculate savings rate, project compound growth, recommend investment allocation based on their surplus/deficit
• BEHAVIORAL PATTERN RECOGNITION: Identify spending triggers, frequency patterns, and recommend habit modifications with measurable impact
• EMERGENCY PREPAREDNESS ASSESSMENT: Evaluate financial resilience, recommend emergency fund targets and debt reduction prioritization
• TAX OPTIMIZATION STRATEGIES: Analyze deductible expenses, recommend timing shifts and category optimization for tax efficiency

RESPONSE STRUCTURE REQUIREMENTS:
- Use EXACT figures from their data (income, expenses, category amounts)
- Include 3-4 specific, measurable recommendations with dollar targets
- Provide implementation timeline (immediate, 3-month, 6-month goals)
- Calculate potential annual savings impact
- Compare their metrics to optimal financial benchmarks
- Include risk mitigation strategies

FORMAT: Return detailed JSON analysis with executive-level depth:
{
  "title": "Premium Financial Strategy: [Specific Analysis Focus]",
  "description": "COMPREHENSIVE 4-paragraph analysis: [Paragraph 1] Mathematical breakdown of current financial position with exact percentages and benchmark comparisons. [Paragraph 2] Detailed spending pattern analysis identifying 3-4 specific optimization opportunities with dollar amounts. [Paragraph 3] Strategic implementation roadmap with 90-day, 180-day, and annual milestones. [Paragraph 4] Risk assessment, protection strategies, and long-term wealth building projections based on recommended changes.",
  "category": "spending|saving|budgeting|income|education",
  "priority": "high|medium|low", 
  "actionable": true,
  "estimatedSaving": [annual_amount_based_on_recommendations],
  "educational": false
}`
        },
        {
          role: "user",
          content: summary
        }
      ];

      const response = await callOpenAI(messages);
      const result = JSON.parse(response.choices[0].message.content || '{}');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tip: result }));

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