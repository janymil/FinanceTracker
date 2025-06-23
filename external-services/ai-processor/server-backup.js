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

const port = parseInt(process.env.PORT || '8080', 10);

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

  // Unified AI endpoint - routes all tasks through single interface
  } else if (path === '/execute-gpt-task' && method === 'POST') {
    try {
      const { task, userId, payload } = await parseBody(req);
      
      if (!task || !userId || !payload) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: task, userId, payload' }));
        return;
      }

      let result;
      switch(task) {
        case 'daily-recommendations':
          result = await handleDailyRecommendations(payload);
          break;
        case 'financial-tips':
          result = await handleFinancialTips(payload);
          break;
        case 'contextual-tips':
          result = await handleContextualTips(payload);
          break;
        case 'trend-predictions':
          result = await handleTrendPredictions(payload);
          break;
        case 'expense-predictions':
          result = await handleExpensePredictions(payload);
          break;
        case 'financial-health-score':
          result = await handleFinancialHealthScore(payload);
          break;
        case 'spending-insights':
          result = await handleSpendingInsights(payload);
          break;
        default:
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Unknown task: ${task}` }));
          return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Unified endpoint error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  // Catch-all for unknown routes
  console.log(`404 - Unknown route: ${method} ${path}`);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path, method }));
});

// Task handlers with preserved prompts and logic
async function handleDailyRecommendations(payload) {
  const { summary, transactions, budgets, categories } = payload;
  
  // Daily recommendations specific prompt
  const prompt = `You are a daily financial task manager. Generate personalized daily financial recommendations and insights.

Based on the user's financial data:
- Summary: ${JSON.stringify(summary)}
- Recent transactions: ${transactions.length} transactions
- Active budgets: ${budgets.length} budgets

Generate response in JSON format:
{
  "recommendations": [
    {
      "id": "rec_1",
      "task": "Clear, actionable daily task",
      "description": "Detailed explanation with specific steps",
      "priority": "high|medium|low",
      "timeEstimate": "5 minutes",
      "category": "budgeting|spending|saving|income"
    }
  ],
  "insights": [
    {
      "id": "insight_1", 
      "insight": "Personalized financial insight",
      "basedOn": "What data this insight comes from",
      "confidence": 0.8,
      "timeframe": "This week"
    }
  ]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Generate daily recommendations based on my financial data." }
  ];

  const response = await callOpenAI(messages);
  return JSON.parse(response.choices[0].message.content || '{"recommendations":[],"insights":[]}');
}

async function handleFinancialTips(payload) {
  const { totalIncome, totalExpenses, transactionsByCategory, recentTransactions } = payload;
  
  // Prepare the financial summary for AI analysis
  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0;
  
  const categoryBreakdown = transactionsByCategory.map(cat => 
    `${cat.categoryName}: $${cat.amount} (${cat.type})`
  ).join(', ');
  
  const recentActivity = recentTransactions.slice(0, 5).map(tx => 
    `${tx.description}: $${tx.amount} on ${tx.date}`
  ).join(', ');
  
  // Financial tips specific prompt with complex analysis
  const prompt = `You are an AI Financial Analyst providing premium-level insights.

Financial Overview:
- Total Income: $${totalIncome}
- Total Expenses: $${totalExpenses}  
- Net Balance: $${netBalance}
- Savings Rate: ${savingsRate}%
- Category Breakdown: ${categoryBreakdown}
- Recent Activity: ${recentActivity}

Provide comprehensive financial analysis and actionable recommendations. Return as JSON array:
[
  {
    "id": "tip_1",
    "title": "Advanced Financial Analysis: [Specific Focus Area]",
    "description": "DETAILED multi-paragraph analysis including: 1) Mathematical breakdown of spending patterns with percentages, 2) Specific optimization recommendations with exact dollar targets, 3) Implementation timeline with measurable milestones, 4) Risk assessment strategies. Use exact financial numbers throughout.",
    "category": "spending|saving|budgeting|income|education", 
    "priority": "high|medium|low",
    "actionable": true,
    "estimatedSaving": [realistic_amount],
    "educational": false
  }
]`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Generate advanced financial tips based on my comprehensive financial data." }
  ];

  const response = await callOpenAI(messages);
  const result = JSON.parse(response.choices[0].message.content || '[]');
  return Array.isArray(result) ? result : [result];
}

async function handleContextualTips(payload) {
  const { summary, transactions, budgets, selectedMonth } = payload;
  
  // Contextual tips specific prompt
  const prompt = `You are a financial advisor AI that provides personalized financial tips based on user data. 

Generate 4 contextual financial tips that are:
- Specific to their spending patterns and financial situation
- Actionable with clear next steps  
- Relevant to their current month's activity
- Focused on improvement opportunities

Financial data: ${JSON.stringify({ summary, transactions: transactions.slice(0, 10), budgets, selectedMonth })}

Respond with JSON in this exact format:
{
  "tips": [
    {
      "id": "tip_1",
      "title": "Clear, actionable tip title", 
      "description": "Detailed explanation with specific recommendations and dollar amounts when relevant",
      "category": "spending|saving|budgeting|income",
      "priority": "high|medium|low",
      "actionable": true
    }
  ]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Generate contextual financial tips based on my data." }
  ];

  const response = await callOpenAI(messages, 'gpt-4o-mini');
  return JSON.parse(response.choices[0].message.content || '{"tips":[]}');
}

async function handleTrendPredictions(payload) {
  const { transactions, categoryMap, budgets } = payload;
  
  // Return zeros for empty data
  if (!transactions || transactions.length === 0) {
    return {
      categoryPredictions: [],
      financialForecast: {
        nextMonthExpectedIncome: 0,
        nextMonthExpectedExpenses: 0,
        projectedSavings: 0,
        confidenceLevel: 0,
        trendDirection: "stable",
        keyInsights: ["Add transactions to enable AI trend predictions"]
      }
    };
  }

  // Calculate category spending patterns
  const categorySpending = new Map();
  const monthlyData = new Map();
  
  transactions.forEach(t => {
    const amount = parseFloat(t.amount);
    const categoryName = categoryMap[t.categoryId] || 'Other';
    const monthKey = t.date.substring(0, 7);
    
    if (t.type === 'expense') {
      categorySpending.set(categoryName, (categorySpending.get(categoryName) || 0) + amount);
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { income: 0, expenses: 0 });
      }
      monthlyData.get(monthKey).expenses += amount;
    } else if (t.type === 'income') {
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { income: 0, expenses: 0 });
      }
      monthlyData.get(monthKey).income += amount;
    }
  });

  const prompt = `You are a financial forecasting AI that analyzes spending patterns to predict future trends.

Analyze these financial patterns:

Transactions (${transactions.length} total):
${transactions.slice(0, 20).map(t => 
  `${t.date}: ${t.type} $${t.amount} - ${t.description} (${categoryMap[t.categoryId] || 'Other'})`
).join('\n')}

Category Spending Summary:
${Array.from(categorySpending.entries()).map(([cat, amount]) => 
  `${cat}: $${amount.toFixed(2)}`
).join('\n')}

Monthly Data:
${Array.from(monthlyData.entries()).map(([month, data]) => 
  `${month}: Income $${data.income.toFixed(2)}, Expenses $${data.expenses.toFixed(2)}`
).join('\n')}

Budget Information:
${budgets?.map(b => `${categoryMap[b.categoryId] || 'Other'}: $${b.amount}`).join('\n') || 'No budgets set'}

Return your analysis in this exact JSON format:
{
  "categoryPredictions": [
    {
      "categoryName": "exact category name",
      "currentMonthSpending": number,
      "predictedNextMonth": number,
      "trend": "increasing|decreasing|stable",
      "confidence": number_0_to_100,
      "insights": "specific insight about this category"
    }
  ],
  "financialForecast": {
    "nextMonthExpectedIncome": number,
    "nextMonthExpectedExpenses": number,
    "projectedSavings": number,
    "confidenceLevel": number_0_to_100,
    "trendDirection": "improving|declining|stable",
    "keyInsights": ["insight1", "insight2", "insight3"]
  }
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Provide accurate predictions based on the actual data patterns." }
  ];

  const response = await callOpenAI(messages);
  return JSON.parse(response.choices[0].message.content || '{"categoryPredictions":[],"financialForecast":{"nextMonthExpectedIncome":0,"nextMonthExpectedExpenses":0,"projectedSavings":0,"confidenceLevel":0,"trendDirection":"stable","keyInsights":["Unable to generate predictions"]}}');
}

async function handleExpensePredictions(payload) {
  const { transactions, summary } = payload;
  
  if (!transactions || transactions.length < 3) {
    return {
      categoryPredictions: [],
      monthlyPredictions: [],
      overallTrend: "stable",
      confidence: 0
    };
  }

  const prompt = `You are an AI financial analyst that predicts future expenses based on spending patterns.

Analyze the transaction data and provide predictions in JSON format:
{
  "categoryPredictions": [
    {
      "category": "category name",
      "currentMonth": amount,
      "predictedNext": amount,
      "confidence": 0.8,
      "trend": "increasing|decreasing|stable"
    }
  ],
  "monthlyPredictions": [
    {
      "month": "2025-07",
      "predicted": amount,
      "confidence": 0.75
    }
  ],
  "overallTrend": "increasing|decreasing|stable",
  "confidence": 0.8
}

Summary: ${JSON.stringify(summary)}
Recent Transactions: ${JSON.stringify(transactions?.slice(0, 50) || [])}
Predict future expenses based on these patterns.`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Generate expense predictions based on my spending patterns." }
  ];

  const response = await callOpenAI(messages);
  return JSON.parse(response.choices[0].message.content || '{"categoryPredictions":[],"monthlyPredictions":[],"overallTrend":"stable","confidence":0}');
}

async function handleFinancialHealthScore(payload) {
  const { summary, budgets, transactions, useAdvancedFactors } = payload;
  
  const prompt = `You are an AI financial health analyst. Calculate a comprehensive financial health score and provide improvement recommendations.

Financial Data:
- Summary: ${JSON.stringify(summary)}
- Budgets: ${JSON.stringify(budgets)}
- Recent Transactions: ${transactions?.length || 0} transactions
- Advanced Analysis: ${useAdvancedFactors ? 'enabled' : 'disabled'}

Return analysis in JSON format:
{
  "score": number_0_to_100,
  "status": "excellent|good|fair|poor",
  "color": "green|yellow|orange|red",
  "factors": [
    {
      "name": "factor name",
      "score": number_0_to_100,
      "max": 100,
      "description": "detailed explanation"
    }
  ],
  "recommendations": ["recommendation1", "recommendation2"],
  "riskFactors": ["risk1", "risk2"]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Analyze my financial health and provide a comprehensive score." }
  ];

  const response = await callOpenAI(messages);
  return JSON.parse(response.choices[0].message.content || '{"score":50,"status":"fair","color":"yellow","factors":[],"recommendations":[],"riskFactors":[]}');
}

async function handleSpendingInsights(payload) {
  const { transactions } = payload;
  
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const prompt = `You are a financial analysis expert. Analyze spending transactions to identify patterns, trends, and insights.

Generate 2-4 insights focusing on:
- Unusual spending patterns
- Budget optimization opportunities  
- Positive financial behaviors
- Spending trends and recommendations

Transactions: ${JSON.stringify(transactions.slice(0, 30))}

Return insights in JSON format:
{
  "insights": [
    {
      "id": "insight_1",
      "type": "warning|suggestion|achievement|trend",
      "title": "insight title",
      "description": "detailed description",
      "impact": "high|medium|low",
      "category": "category name",
      "amount": number,
      "recommendation": "actionable recommendation",
      "actionable": true
    }
  ]
}`;

  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: "Analyze my spending patterns and provide insights." }
  ];

  const response = await callOpenAI(messages);
  const result = JSON.parse(response.choices[0].message.content || '{"insights":[]}');
  return Array.isArray(result) ? result : (result.insights || []);
}

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`AI Processor service running on port ${port}`);
});