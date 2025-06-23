// Standalone server with embedded dependencies via require() alternatives
const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');

// Simple CORS headers function
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Simple JSON body parser
function parseJSONBody(req, callback) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      callback(null, data);
    } catch (error) {
      callback(error, null);
    }
  });
}

// OpenAI API call function using native https
function callOpenAI(payload, callback) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return callback(new Error('OPENAI_API_KEY not set'), null);
  }

  const postData = JSON.stringify(payload);
  
  const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.error) {
          callback(new Error(response.error.message || 'OpenAI API error'), null);
        } else {
          callback(null, response);
        }
      } catch (error) {
        callback(error, null);
      }
    });
  });

  req.on('error', (error) => {
    callback(error, null);
  });

  req.write(postData);
  req.end();
}

// AI task handlers
const taskHandlers = {
  'financial-tips': (payload, callback) => {
    const openaiPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial advisor. Provide 3 concise, actionable financial tips based on the user's data. Return JSON with 'tips' array."
        },
        {
          role: "user", 
          content: `Income: $${payload.totalIncome}, Expenses: $${payload.totalExpenses}. Recent transactions: ${JSON.stringify(payload.recentTransactions || [])}`
        }
      ],
      response_format: { type: "json_object" }
    };
    
    callOpenAI(openaiPayload, callback);
  },

  'daily-recommendations': (payload, callback) => {
    const openaiPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial assistant. Provide daily recommendations and insights. Return JSON with 'recommendations' and 'insights' arrays."
        },
        {
          role: "user",
          content: `Financial summary: ${JSON.stringify(payload.summary)}. Recent transactions: ${JSON.stringify(payload.transactions || [])}`
        }
      ],
      response_format: { type: "json_object" }
    };
    
    callOpenAI(openaiPayload, callback);
  },

  'expense-predictions': (payload, callback) => {
    const openaiPayload = {
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: "You are a financial analyst. Predict future expenses based on transaction patterns. Return JSON with 'predictions' object."
        },
        {
          role: "user",
          content: `Total expenses: $${payload.summary?.totalExpenses || 0}. Transactions: ${JSON.stringify(payload.transactions || [])}`
        }
      ],
      response_format: { type: "json_object" }
    };
    
    callOpenAI(openaiPayload, callback);
  }
};

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Set CORS headers
  setCORSHeaders(res);

  // Handle preflight requests
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (path === '/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'standalone-ai-processor' }));
    return;
  }

  // Main AI task endpoint
  if (path === '/execute-gpt-task' && method === 'POST') {
    parseJSONBody(req, (error, data) => {
      if (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const { task, userId, payload } = data;
      
      if (!task || !taskHandlers[task]) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid task' }));
        return;
      }

      taskHandlers[task](payload, (aiError, aiResponse) => {
        if (aiError) {
          console.error('AI Error:', aiError.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'AI processing failed' }));
          return;
        }

        try {
          const result = aiResponse.choices[0].message.content;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(result);
        } catch (parseError) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Response parsing failed' }));
        }
      });
    });
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Standalone AI Processor server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('- POST /execute-gpt-task (unified endpoint for all AI tasks)');
  console.log('- GET /health');
});