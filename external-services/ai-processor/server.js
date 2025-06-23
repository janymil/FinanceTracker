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
      temperature: model === 'gpt-4o' && messages.some(m => m.content.includes('daily recommendations')) ? 0.3 : 0.9
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

  // Generate daily recommendation endpoint
  if (path === '/generate-daily-recommendation' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { summary, transactions, budgets, categories } = body;

      // Validate required fields
      if (!transactions || !Array.isArray(transactions)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Invalid request: transactions array is required' 
        }));
        return;
      }

      // Check minimum data requirements
      if (transactions.length < 3) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          recommendations: [],
          insights: [],
          message: "Add at least 3 transactions to get personalized daily recommendations"
        }));
        return;
      }

      console.log('FLY.IO EXTERNAL SERVICE: Generating new daily recommendations with OpenAI GPT-4o');

      // Limit data to last 3 months and 100 transactions for efficiency
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const recentTransactions = transactions
        .filter(t => new Date(t.date) >= threeMonthsAgo)
        .slice(0, 100);

      // Calculate spending patterns
      const categorySpending = new Map();
      const dailySpending = new Map();
      
      recentTransactions.forEach(t => {
        if (t.type === 'expense') {
          const amount = parseFloat(t.amount);
          const categoryName = t.categoryId && categories ? categories[t.categoryId] || 'Other' : 'Other';
          const date = new Date(t.date).toDateString();
          
          categorySpending.set(categoryName, (categorySpending.get(categoryName) || 0) + amount);
          dailySpending.set(date, (dailySpending.get(date) || 0) + amount);
        }
      });

      const topCategories = Array.from(categorySpending.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const avgDailySpending = Array.from(dailySpending.values())
        .reduce((sum, amount) => sum + amount, 0) / Math.max(dailySpending.size, 1);

      const prompt = `You are a financial advisor analyzing a user's spending patterns. Based on their financial data, provide personalized daily recommendations and insights.

Financial Summary:
- Total Income: $${(summary?.totalIncome || 0).toFixed(2)}
- Total Expenses: $${(summary?.totalExpenses || 0).toFixed(2)}
- Net Amount: $${(summary?.netAmount || 0).toFixed(2)}
- Recent Transactions: ${recentTransactions.length}
- Average Daily Spending: $${avgDailySpending.toFixed(2)}

Top Spending Categories:
${topCategories.map(([cat, amount]) => `- ${cat}: $${amount.toFixed(2)}`).join('\n')}

Budget Information:
${(budgets || []).map(b => `- ${b.name}: $${b.amount} (${b.period})`).join('\n')}

Recent Transaction Sample:
${recentTransactions.slice(0, 10).map(t => 
  `- ${t.date}: ${t.type} $${t.amount} - ${t.description}`
).join('\n')}

IMPORTANT: Use actual category names from the Top Spending Categories list above. Do NOT use "Category 1", "Category 2", etc. Use the real category names like "Transportation", "Food", "Utilities", etc.

Please provide:
1. 3-5 actionable daily task recommendations
2. 2-3 personalized financial insights

Return your response in this exact JSON format:
{
  "recommendations": [
    {
      "id": "rec-1",
      "type": "budget_review",
      "priority": "high",
      "title": "Review Budget Allocation",
      "description": "Your spending in dining exceeded budget by 20% this week",
      "action": "Reduce dining expenses for the next 3 days",
      "impact": "Save $50-75 this week",
      "timeToComplete": "5 minutes"
    }
  ],
  "insights": [
    {
      "id": "insight-1", 
      "insight": "Your weekend spending is 40% higher than weekdays",
      "basedOn": "Transaction pattern analysis",
      "confidence": 0.85,
      "timeframe": "Last 30 days"
    }
  ]
}

Focus on:
- Actionable tasks for today/this week
- Specific spending patterns from their actual data
- Budget optimization opportunities
- Realistic financial improvements
- Data-driven insights with confidence levels

Only provide recommendations and insights based on the actual financial data provided. Do not include generic advice.`;

      const messages = [
        {
          role: "system",
          content: "You are an expert financial advisor who provides personalized, actionable recommendations based on real user data. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ];

      const response = await callOpenAI(messages, 'gpt-4o');
      const aiResponse = JSON.parse(response.choices[0].message.content || '{}');
      
      // Ensure proper data structure
      const recommendations = Array.isArray(aiResponse.recommendations) 
        ? aiResponse.recommendations.map((rec, index) => ({
            id: rec.id || `rec-${index + 1}`,
            type: rec.type || 'general',
            priority: rec.priority || 'medium',
            title: rec.title || 'Financial Task',
            description: rec.description || 'Complete this financial task',
            action: rec.action || 'Take action on this recommendation',
            impact: rec.impact || 'Positive financial impact',
            timeToComplete: rec.timeToComplete || '10 minutes'
          }))
        : [];

      const insights = Array.isArray(aiResponse.insights)
        ? aiResponse.insights.map((insight, index) => ({
            id: insight.id || `insight-${index + 1}`,
            insight: insight.insight || 'Financial insight based on your data',
            basedOn: insight.basedOn || 'Transaction analysis',
            confidence: Number(insight.confidence) || 0.7,
            timeframe: insight.timeframe || 'Recent activity'
          }))
        : [];

      const result = {
        recommendations,
        insights
      };

      console.log('FLY.IO EXTERNAL SERVICE: Daily recommendations generated successfully via OpenAI API');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));

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