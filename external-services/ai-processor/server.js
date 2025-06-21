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
          content: `You are a premium-level financial advisor AI analyzing a client's monthly financial profile. The user provides their income, expenses, and category breakdown.

Your task is to write a professional, detailed, and insightful advisory response that covers 4 key areas with proper formatting for readability:

**📊 SPENDING ANALYSIS**
Analyze their spending patterns with exact percentages and benchmark comparisons (housing ≤30% of income, etc.). Point out strengths and critical weaknesses.

**💰 SAVING STRATEGIES** 
Provide specific actionable steps with exact dollar amounts and methods (e.g., "reduce housing from $6500 to $2208 by downsizing").

**⚖️ BUDGET OPTIMIZATION**
Recommend intelligent budget restructuring with ideal percentage allocations and practical implementation steps.

**🎯 ADVANCED INSIGHTS**
Include cash flow forecasting, emergency fund calculations, investment readiness assessment, and risk identification.

Use real math from their data. Be direct, practical, and insightful. Format with clear sections, bullet points where helpful, and bold text for emphasis. Make it visually engaging and easy to scan.

Return properly formatted text with markdown-style formatting for better readability.`
        },
        {
          role: "user",
          content: summary
        }
      ];

      const response = await callOpenAI(messages);
      const advisoryText = response.choices[0].message.content || '';

      res.json({ 
        tip: advisoryText,
        success: true 
      });

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