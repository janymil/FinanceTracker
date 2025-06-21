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
          content: `You are a premium financial advisor analyzing a client's finances. Generate 4 SPECIFIC, ACTIONABLE analyses with exact implementation steps:

📊 SPENDING PATTERN ANALYSIS BOX:
- Calculate exact spending percentages by category from their data
- Identify the 3 highest expense categories with dollar amounts and percentages of total income
- Compare each to financial benchmarks (housing ≤30%, food ≤15%, transportation ≤15%)
- Point out specific categories that exceed optimal percentages
- Analyze spending frequency patterns (daily/weekly/monthly habits)

💡 PERSONALIZED SAVING RECOMMENDATIONS BOX:
Must include ALL of these elements:
- "Start by..." followed by 2-3 specific actionable steps
- Exact dollar amounts to save per month/week
- Specific timeline: "Within 30/60/90 days you should..."
- Target categories to reduce with specific reduction amounts
- Practical implementation: "Set up automatic transfers of $X on the 1st of each month"
- Expected outcome: "This will save you $X annually"

🎯 ADVANCED FINANCIAL ANALYSIS BOX:
Must provide comprehensive assessment including:
- Emergency fund status: "You need $X for 3-6 months expenses" (calculate exact amount)
- Debt-to-income ratio if applicable
- Cash flow trend analysis: "Your deficit/surplus trend shows..."
- Risk factors: Identify 2-3 specific financial vulnerabilities
- Investment readiness: Specific criteria they must meet first
- Credit utilization optimization if relevant
- Long-term wealth projection: "At current savings rate, in 5 years you'll have..."

📋 BUDGET OPTIMIZATION SUGGESTIONS BOX:
Provide specific restructuring plan:
- "Reduce [specific category] from $X to $Y (saving $Z monthly)"
- "Reallocate $X from [category A] to [category B] for better balance"
- Target percentages: "Aim for Housing: X%, Food: Y%, Entertainment: Z%"
- Month-by-month implementation plan
- Specific apps/tools to use: "Use [specific budgeting method]"
- Success metrics: "Track weekly to ensure you stay under $X in [category]"

REQUIREMENTS FOR EACH BOX:
- Use EXACT dollar amounts from their actual data
- Provide specific deadlines and timelines
- Include implementation steps ("Download X app", "Set up automatic transfer", "Review weekly")
- Calculate precise savings opportunities
- Give measurable success criteria

RETURN EXACTLY THIS JSON FORMAT:
{
  "spendingAnalysis": "Category breakdown with exact percentages, benchmark comparisons, and spending pattern insights",
  "savingRecommendations": "Step-by-step action plan with specific dollar amounts, timelines, and implementation methods", 
  "advancedAnalysis": "Complete financial health assessment with emergency fund calculations, risk analysis, and wealth projections",
  "budgetOptimization": "Detailed restructuring plan with specific category targets, reallocation amounts, and tracking methods"
}`
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