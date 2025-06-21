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
          content: `Analyze this person's finances and give 4 practical recommendations using their exact numbers.

Write complete, helpful paragraphs. Use their real dollar amounts. Be specific and actionable.

Return JSON format:
{
  "spendingAnalysis": "Complete paragraph analyzing their spending with percentages and benchmarks",
  "savingRecommendations": "Complete paragraph with specific steps to save money using exact dollar amounts", 
  "advancedAnalysis": "Complete paragraph assessing financial health with emergency fund calculations",
  "budgetOptimization": "Complete paragraph with specific budget changes and dollar reallocations"
}

Each paragraph should be detailed, complete, and use the person's actual financial data.`
        },
        {
          role: "user",
          content: summary
        }
      ];

      const response = await callOpenAI(messages);
      const result = JSON.parse(response.choices[0].message.content || '{}');

      let formattedResponse;

      // Check if AI returned the expected 4-box format
      if (result.spendingAnalysis && result.savingRecommendations && result.advancedAnalysis && result.budgetOptimization) {
        // Use the properly formatted AI response
        formattedResponse = {
          spendingAnalysis: result.spendingAnalysis,
          savingRecommendations: result.savingRecommendations, 
          advancedAnalysis: result.advancedAnalysis,
          budgetOptimization: result.budgetOptimization
        };
      } else {
        // AI didn't return expected format - intelligently split the actual AI response
        const fullAnalysis = result.description || result.title || result.analysis || 
                            JSON.stringify(result).replace(/[{}",]/g, ' ').trim();
        
        if (fullAnalysis && fullAnalysis.length > 50) {
          const sentences = fullAnalysis.split('.').filter(s => s.trim().length > 20);
          const quarterLength = Math.max(1, Math.floor(sentences.length / 4));
          
          formattedResponse = {
            spendingAnalysis: sentences.slice(0, quarterLength).join('.') + '.',
            savingRecommendations: sentences.slice(quarterLength, quarterLength * 2).join('.') + '.', 
            advancedAnalysis: sentences.slice(quarterLength * 2, quarterLength * 3).join('.') + '.',
            budgetOptimization: sentences.slice(quarterLength * 3).join('.') + '.'
          };
        } else {
          // Minimal AI content - distribute what we have
          formattedResponse = {
            spendingAnalysis: fullAnalysis,
            savingRecommendations: "Based on your data, review spending patterns for optimization opportunities.",
            advancedAnalysis: "Continue tracking transactions for more detailed analysis.", 
            budgetOptimization: "Add more financial data to receive personalized recommendations."
          };
        }
      }

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