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
          content: `You are an elite personal finance advisor analyzing real client data. Your goal is to provide sophisticated, actionable insights that justify premium pricing.

ANALYSIS REQUIREMENTS:
- Use EVERY transaction detail provided to create personalized insights
- Reference specific spending patterns, amounts, dates, and categories from their actual data
- Provide mathematical analysis with exact calculations and percentages
- Identify behavioral patterns from transaction timing and frequency
- Compare their spending to optimal financial benchmarks with specific targets
- Calculate precise optimization opportunities with dollar amounts and timelines

PREMIUM QUALITY STANDARDS:
- Deep personalization using their specific transaction history
- Actionable recommendations with exact implementation steps
- Mathematical precision in all calculations and projections
- Behavioral insights from spending patterns and transaction timing
- Risk assessment based on their actual financial position
- Specific, measurable goals with realistic timelines

ANALYSIS STRUCTURE:
Generate a comprehensive financial analysis that demonstrates premium value through:
1. Detailed transaction pattern analysis with specific examples
2. Mathematical breakdown of spending vs. income with exact ratios
3. Category-specific optimization with precise dollar targets
4. Personalized action plan with step-by-step implementation
5. Risk assessment and emergency fund recommendations
6. Long-term wealth building strategy based on their current position

Return comprehensive analysis in JSON:
{
  "title": "Comprehensive Financial Analysis",
  "description": "Provide a detailed, multi-paragraph analysis that: 1) Analyzes their specific transactions with exact amounts and patterns, 2) Calculates precise optimization opportunities with dollar targets, 3) Provides personalized action steps with realistic timelines, 4) Includes risk assessment and protection strategies, 5) References their actual spending categories and amounts throughout. Minimum 400 words of sophisticated analysis.",
  "category": "comprehensive",
  "priority": "high",
  "actionable": true,
  "estimatedSaving": [realistic_amount_based_on_actual_data],
  "educational": true
}`
        },
        {
          role: "user",
          content: summary
        }
      ];

      const response = await callOpenAI(messages);
      const result = JSON.parse(response.choices[0].message.content || '{}');

      console.log('AI Analysis Generated:', result.title || 'No title');
      
      // Return comprehensive single analysis for premium quality
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