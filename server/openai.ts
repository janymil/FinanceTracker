import OpenAI from "openai";
import { aiCache } from "./cache";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ExpenseCategorizationResult {
  category: string;
  confidence: number;
  reasoning: string;
}

export interface FinancialTip {
  title: string;
  description: string;
  category: 'spending' | 'saving' | 'budgeting' | 'income' | 'education';
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  estimatedSaving?: number;
  educational?: boolean;
}

export interface TrendPrediction {
  category: string;
  predictedAmount: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  reasoning: string;
  monthlyForecast: Array<{
    month: string;
    predicted: number;
    confidence: number;
  }>;
}

export interface FinancialForecast {
  nextMonthExpenses: number;
  expectedSavings: number;
  budgetVariance: number;
  confidence: number;
  keyInsights: string[];
  recommendations: string[];
  riskFactors: string[];
}

export interface FinancialHealthData {
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  category: 'excellent' | 'good' | 'fair' | 'poor';
  insights: string[];
  achievements: string[];
  warnings: string[];
}

export async function categorizeExpense(description: string, amount: number): Promise<ExpenseCategorizationResult> {
  try {
    // Check cache first
    const cached = aiCache.getCategorization(description, amount);
    if (cached) {
      console.log('Using cached categorization result');
      return cached;
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert financial categorization assistant. Analyze the expense description and amount to determine the most appropriate category.

Available categories:
- Food & Dining (restaurants, groceries, takeout)
- Transportation (gas, public transport, parking, car maintenance)
- Shopping (clothes, electronics, general retail)
- Entertainment (movies, concerts, games, subscriptions)
- Bills & Utilities (electricity, water, internet, phone)
- Healthcare (medical, pharmacy, insurance)
- Travel (hotels, flights, vacation expenses)
- Education (courses, books, tuition)
- Home & Garden (rent, mortgage, home improvement, furniture)
- Personal Care (salon, spa, cosmetics)
- Business (office supplies, professional services)
- Other (miscellaneous expenses)

Respond with JSON in this exact format:
{
  "category": "category_name",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this category was chosen"
}`
        },
        {
          role: "user",
          content: `Description: "${description}"
Amount: $${amount}

Please categorize this expense.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    const categorization = {
      category: result.category || 'Other',
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      reasoning: result.reasoning || 'Unable to determine category'
    };

    // Cache the result
    aiCache.setCategorization(description, amount, categorization);
    
    return categorization;
  } catch (error) {
    console.error('Error categorizing expense:', error);
    return {
      category: 'Other',
      confidence: 0.1,
      reasoning: 'Error occurred during categorization'
    };
  }
}

export async function generateFinancialTips(financialData: {
  totalIncome: number;
  totalExpenses: number;
  transactionsByCategory: Array<{
    categoryName: string;
    amount: number;
    type: string;
  }>;
  recentTransactions: Array<{
    description: string;
    amount: number;
    date: string;
    categoryName?: string;
    type?: string;
  }>;
  timestamp?: number; // For bypassing cache
}): Promise<FinancialTip[]> {
  try {
    // Skip cache if timestamp is provided (for fresh responses)
    if (!financialData.timestamp) {
      const dataHash = aiCache.createDataHash(financialData);
      const cached = aiCache.getTips(dataHash);
      if (cached) {
        console.log('Using cached financial tips result');
        return cached;
      }
    } else {
      console.log('Bypassing cache for fresh AI financial tips');
    }
    const { totalIncome, totalExpenses, transactionsByCategory, recentTransactions } = financialData;

    // Prepare the financial summary for the AI processor
    const netBalance = totalIncome - totalExpenses;
    const transactionCount = recentTransactions.length;
    
    const summary = `Financial Summary:
- Monthly Income: $${totalIncome}
- Monthly Expenses: $${totalExpenses}
- Net Balance: $${netBalance} ${netBalance < 0 ? '(DEFICIT)' : '(SURPLUS)'}
- Transaction Count: ${transactionCount}
- Raw Transactions Retrieved: ${recentTransactions.length}

Spending by Category:
${transactionsByCategory.filter(cat => cat.type === 'expense').map(cat => 
  `- ${cat.categoryName}: $${cat.amount} (${((cat.amount / totalExpenses) * 100).toFixed(1)}% of expenses)`
).join('\n')}

Income by Category:
${transactionsByCategory.filter(cat => cat.type === 'income').map(cat => 
  `- ${cat.categoryName}: $${cat.amount} (${((cat.amount / totalIncome) * 100).toFixed(1)}% of income)`
).join('\n')}

Recent Transactions (last 10):
${recentTransactions.slice(0, 10).map(t => 
  `- ${t.description}: $${t.amount} (${t.categoryName || 'Uncategorized'}) [${t.type}] on ${new Date(t.date).toLocaleDateString()}`
).join('\n')}

Transaction Pattern Analysis:
- Average transaction size: $${(totalIncome + totalExpenses) / transactionCount}
- Income transactions: ${recentTransactions.filter(t => t.type === 'income').length}
- Expense transactions: ${recentTransactions.filter(t => t.type === 'expense').length}
- Date range: ${new Date(Math.min(...recentTransactions.map(t => new Date(t.date).getTime()))).toLocaleDateString()} to ${new Date(Math.max(...recentTransactions.map(t => new Date(t.date).getTime()))).toLocaleDateString()}

Generate 4 independent box analyses with exact mathematical calculations.`;

    // Call the Fly.io AI processor service with fallback to direct OpenAI
    let result;
    try {
      const AI_PROCESSOR_URL = process.env.AI_PROCESSOR_URL || 'https://finanserpro-ai-processor.fly.dev';
      console.log(`Calling AI processor at ${AI_PROCESSOR_URL}/generate-financial-tip`);
      
      const aiResponse = await fetch(`${AI_PROCESSOR_URL}/generate-financial-tip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ summary }),
        timeout: 30000 // 30 second timeout
      });

      if (!aiResponse.ok) {
        throw new Error(`AI processor error: ${aiResponse.status} ${aiResponse.statusText}`);
      }

      const aiData = await aiResponse.json();
      console.log('AI processor response received successfully');
      result = aiData.tip || aiData;
      console.log('Successfully received response from AI processor');
    } catch (aiProcessorError) {
      console.warn('AI processor service unavailable, falling back to direct OpenAI:', aiProcessorError.message);
      
      // Fallback to direct OpenAI call
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI Financial Analyst providing premium-level insights. Your analysis must demonstrate these EXACT capabilities that users pay for:

1. SPENDING PATTERN ANALYSIS: Identify spending trends, seasonal patterns, category concentrations, and behavioral insights
2. PERSONALIZED SAVING RECOMMENDATIONS: Calculate specific saving opportunities based on their exact income/expense ratios
3. BUDGET OPTIMIZATION SUGGESTIONS: Recommend category rebalancing with precise dollar amounts
4. CONTEXT-AWARE FINANCIAL ADVICE: Consider their financial position, goals, and risk tolerance

ANALYSIS REQUIREMENTS:
- Use their EXACT transaction amounts and categories 
- Calculate precise percentages and ratios from their data
- Identify the highest-impact optimization opportunities
- Provide specific dollar amounts for recommendations
- Include mathematical analysis (savings rate, expense ratios, etc.)
- Compare their spending to optimal financial benchmarks

GENERATE VARIED RESPONSES by focusing on different analytical angles:
- Detailed category spending analysis with optimization targets
- Income-to-expense ratio analysis with improvement strategies  
- Cash flow optimization with timing recommendations
- Risk assessment with protection strategies
- Wealth building analysis with investment allocation suggestions
- Efficiency analysis identifying wasteful spending patterns

Return comprehensive analysis in JSON:
{
  "title": "Advanced Financial Analysis: [Specific Focus Area]",
  "description": "DETAILED multi-paragraph analysis including: 1) Mathematical breakdown of their spending patterns with percentages, 2) Specific optimization recommendations with exact dollar targets, 3) Implementation timeline with measurable milestones, 4) Risk assessment and protection strategies. Use their exact financial numbers throughout.",
  "category": "spending|saving|budgeting|income|education", 
  "priority": "high|medium|low",
  "actionable": true,
  "estimatedSaving": [realistic_amount],
  "educational": false
}`
          },
          {
            role: "user",
            content: summary
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.9
      });

      result = JSON.parse(response.choices[0].message.content || '{}');
    }

    // Handle comprehensive analysis response
    const processedTips = result.title && result.description ? [{
      title: result.title,
      description: result.description,
      category: result.category || 'comprehensive',
      priority: result.priority || 'high',
      actionable: Boolean(result.actionable),
      estimatedSaving: result.estimatedSaving || undefined,
      educational: Boolean(result.educational)
    }] : [{
      title: 'Track Your Expenses',
      description: 'Start by categorizing all your expenses to understand where your money goes each month.',
      category: 'budgeting',
      priority: 'high',
      actionable: true
    }];

    // Only cache if not bypassing cache
    if (!financialData.timestamp) {
      const dataHash = aiCache.createDataHash(financialData);
      aiCache.setTips(dataHash, processedTips);
    }
    
    return processedTips;
  } catch (error) {
    console.error('Error generating financial tips:', error);
    return [
      {
        title: 'Track Your Expenses',
        description: 'Start by categorizing all your expenses to understand where your money goes each month.',
        category: 'budgeting',
        priority: 'high',
        actionable: true
      }
    ];
  }
}

export async function generateSpendingInsights(transactions: Array<{
  description: string;
  amount: number;
  date: string;
  categoryName?: string;
  type: string;
}>): Promise<Array<{
  id: string;
  type: "warning" | "suggestion" | "achievement" | "trend";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category?: string;
  amount?: number;
  recommendation?: string;
  actionable: boolean;
}>> {
  try {
    // Create hash for transactions to use as cache key
    const transactionsHash = aiCache.createDataHash(transactions);
    const cached = aiCache.getInsights(transactionsHash);
    if (cached) {
      console.log('Using cached insights result');
      return cached;
    }
    const expenseTransactions = transactions.filter(t => t.type === 'expense');

    if (expenseTransactions.length === 0) {
      return [];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a financial analysis expert. Analyze spending transactions to identify patterns, trends, and insights.

Generate 2-4 insights focusing on:
- Unusual spending patterns
- Budget optimization opportunities  
- Positive financial behaviors
- Spending trends and recommendations

Each insight should have:
- Unique ID
- Type: warning, suggestion, achievement, or trend
- Clear title and description
- Impact level: high, medium, low
- Category if relevant
- Amount if relevant
- Actionable recommendation
- Whether it's actionable (boolean)

Respond with JSON array format:
[
  {
    "id": "insight_1",
    "type": "warning",
    "title": "High dining expenses",
    "description": "Your restaurant spending increased 40% this month",
    "impact": "high",
    "category": "Food & Dining",
    "amount": 450,
    "recommendation": "Consider meal planning to reduce dining out",
    "actionable": true
  }
]`
        },
        {
          role: "user",
          content: `Analyze these expense transactions:

${expenseTransactions.slice(0, 20).map(t => 
  `- ${t.description}: $${t.amount} (${t.categoryName || 'Uncategorized'}) on ${t.date}`
).join('\n')}

Total transactions: ${expenseTransactions.length}
Date range: ${expenseTransactions[expenseTransactions.length - 1]?.date} to ${expenseTransactions[0]?.date}

Generate financial insights based on this spending data.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const result = JSON.parse(response.choices[0].message.content || '{"insights": []}');
    const insights = Array.isArray(result) ? result : (result.insights || []);

    const processedInsights = insights.map((insight: any, index: number) => ({
      id: insight.id || `ai_insight_${index}`,
      type: ['warning', 'suggestion', 'achievement', 'trend'].includes(insight.type) ? insight.type : 'suggestion',
      title: insight.title || 'Financial Insight',
      description: insight.description || 'No description available',
      impact: ['high', 'medium', 'low'].includes(insight.impact) ? insight.impact : 'medium',
      category: insight.category || undefined,
      amount: insight.amount || undefined,
      recommendation: insight.recommendation || undefined,
      actionable: Boolean(insight.actionable)
    }));

    // Cache the result
    aiCache.setInsights(transactionsHash, processedInsights);
    
    return processedInsights;
  } catch (error) {
    console.error('Error generating spending insights:', error);
    return [];
  }
}

export async function generateAIFinancialHealthScore(financialData: {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
  };
  budgets: any[];
  transactions: Array<{
    description: string;
    amount: number;
    date: string;
    categoryName: string;
    type: string;
  }>;
  useAdvancedFactors?: boolean;
}): Promise<{
  score: number;
  status: string;
  color: string;
  factors: Array<{
    name: string;
    score: number;
    max: number;
    status: string;
    aiInsight?: string;
  }>;
  icon: string;
  aiAnalysis: {
    personalizedFactors: string[];
    riskAssessment: string;
    recommendations: string[];
    confidence: number;
  };
}> {
  try {
    const { summary, budgets, transactions, useAdvancedFactors } = financialData;
    
    // Create hash for caching
    const dataHash = aiCache.createDataHash(financialData);
    const cached = aiCache.get(`ai_health_score_${dataHash}`);
    if (cached) {
      console.log('Using cached AI financial health score');
      return cached;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an advanced financial health AI that calculates personalized financial health scores using sophisticated analysis beyond traditional metrics.

Your analysis should consider:
- Spending patterns and volatility
- Seasonal trends in expenses
- Category distribution and priorities
- Financial behavior consistency
- Risk factors and resilience
- Personalized weight adjustments based on user's situation

Provide a comprehensive financial health score from 0-100 with detailed factor breakdown.

Respond with JSON in this format:
{
  "score": 85,
  "status": "Good",
  "color": "blue",
  "factors": [
    {
      "name": "Adaptive Spending Control",
      "score": 25,
      "max": 30,
      "status": "good",
      "aiInsight": "Your spending shows good consistency with minor seasonal variations"
    }
  ],
  "icon": "TrendingUp",
  "aiAnalysis": {
    "personalizedFactors": ["Custom factor explanations"],
    "riskAssessment": "Overall risk level and factors",
    "recommendations": ["Personalized recommendations"],
    "confidence": 0.87
  }
}`
        },
        {
          role: "user",
          content: `Analyze this financial data for a personalized health score:

Financial Summary:
- Income: $${summary.totalIncome}
- Expenses: $${summary.totalExpenses}
- Net Balance: $${summary.netBalance}

Transaction History (${transactions.length} transactions):
${transactions.slice(0, 20).map(t => 
  `- ${t.description}: $${t.amount} (${t.categoryName}) on ${t.date.split('T')[0]}`
).join('\n')}

Budgets: ${budgets.length} active budgets
Advanced Analysis: ${useAdvancedFactors ? 'Enabled' : 'Standard'}

Provide an AI-powered financial health score that adapts to this user's specific situation and spending patterns.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    const processedResult = {
      score: Math.max(0, Math.min(100, result.score || 50)),
      status: result.status || 'Fair',
      color: result.color || 'yellow',
      factors: result.factors || [],
      icon: result.icon || 'Shield',
      aiAnalysis: {
        personalizedFactors: result.aiAnalysis?.personalizedFactors || [],
        riskAssessment: result.aiAnalysis?.riskAssessment || 'Standard risk assessment',
        recommendations: result.aiAnalysis?.recommendations || [],
        confidence: Math.max(0, Math.min(1, result.aiAnalysis?.confidence || 0.7))
      }
    };

    // Cache the result
    aiCache.set(`ai_health_score_${dataHash}`, processedResult, 3600); // Cache for 1 hour
    
    return processedResult;
  } catch (error) {
    console.error('Error generating AI financial health score:', error);
    return {
      score: 50,
      status: 'Analysis Unavailable',
      color: 'gray',
      factors: [],
      icon: 'AlertTriangle',
      aiAnalysis: {
        personalizedFactors: [],
        riskAssessment: 'Unable to assess risk',
        recommendations: ['Please try again later'],
        confidence: 0
      }
    };
  }
}

export async function generateTrendPredictions(
  transactions: Array<{
    id: number;
    amount: string;
    description: string;
    date: string;
    type: string;
    categoryId: number;
  }>,
  categoryMap: Map<number, string>,
  budgets: Array<{ categoryId: number; amount: string; }> = []
): Promise<{
  categoryPredictions: TrendPrediction[];
  financialForecast: FinancialForecast;
}> {
  try {
    // Return zeros for empty data instead of AI-generated examples
    if (!transactions || transactions.length === 0) {
      console.log('No transaction data available - returning zero predictions');
      return {
        categoryPredictions: [],
        financialForecast: {
          nextMonthExpenses: 0,
          expectedSavings: 0,
          budgetVariance: 0,
          confidence: 0,
          keyInsights: ['Add transactions to generate AI-powered financial forecasts'],
          recommendations: ['Start tracking your expenses to receive personalized predictions'],
          riskFactors: []
        }
      };
    }

    // Create cache keys for the input data
    const transactionsHash = aiCache.createDataHash(transactions);
    const budgetsHash = aiCache.createDataHash(budgets);
    const cached = aiCache.getTrends(transactionsHash, budgetsHash);
    
    if (cached) {
      console.log('Using cached trend predictions result');
      return cached;
    }

    // Prepare comprehensive financial data for AI analysis
    const monthlyData = new Map();
    const categoryTotals = new Map();

    transactions.forEach(t => {
      const month = t.date.slice(0, 7);
      const category = categoryMap.get(t.categoryId) || 'Other';
      const amount = parseFloat(t.amount);

      if (!monthlyData.has(month)) {
        monthlyData.set(month, { income: 0, expenses: 0, categories: new Map() });
      }

      const monthData = monthlyData.get(month);
      if (t.type === 'income') {
        monthData.income += amount;
      } else {
        monthData.expenses += amount;
        const catAmount = monthData.categories.get(category) || 0;
        monthData.categories.set(category, catAmount + amount);
      }

      const totalAmount = categoryTotals.get(category) || 0;
      categoryTotals.set(category, totalAmount + amount);
    });

    const financialSummary = {
      monthlyTrends: Array.from(monthlyData.entries()).map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expenses,
        netBalance: data.income - data.expenses,
        topCategories: Array.from(data.categories.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([cat, amount]) => ({ category: cat, amount }))
      })).sort((a, b) => a.month.localeCompare(b.month)),
      categoryTotals: Array.from(categoryTotals.entries()).map(([cat, amount]) => ({ category: cat, amount })),
      budgets: budgets.map(b => ({ category: categoryMap.get(b.categoryId) || 'Other', budgetAmount: parseFloat(b.amount) }))
    };

    const prompt = `Analyze this comprehensive financial data and provide AI-powered trend predictions and forecasting.

Financial Data Analysis:
${JSON.stringify(financialSummary, null, 2)}

Please provide detailed predictions in this JSON format:
{
  "categoryPredictions": [
    {
      "category": "category name",
      "predictedAmount": 0,
      "confidence": 0.95,
      "trend": "increasing|decreasing|stable",
      "reasoning": "explanation of prediction logic",
      "monthlyForecast": [
        {"month": "2025-01", "predicted": 0, "confidence": 0.9}
      ]
    }
  ],
  "financialForecast": {
    "nextMonthExpenses": 0,
    "expectedSavings": 0,
    "budgetVariance": 0,
    "confidence": 0.85,
    "keyInsights": ["insight 1", "insight 2"],
    "recommendations": ["recommendation 1", "recommendation 2"],
    "riskFactors": ["risk 1", "risk 2"]
  }
}

Analysis Requirements:
- Use historical patterns to predict future spending
- Identify seasonal trends and cyclical behaviors
- Calculate confidence based on data consistency
- Consider economic factors and spending volatility
- Provide actionable financial recommendations
- Include next 3 months forecast for each category
- Analyze budget adherence and variance predictions`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an advanced financial forecasting AI that analyzes spending patterns and predicts future financial trends with high accuracy. Use sophisticated pattern recognition and statistical analysis to provide reliable predictions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.3 // Lower temperature for more consistent predictions
    });

    const result = JSON.parse(response.choices[0].message.content || '{"categoryPredictions": [], "financialForecast": {}}');

    const predictions = {
      categoryPredictions: result.categoryPredictions || [],
      financialForecast: result.financialForecast || {
        nextMonthExpenses: 0,
        expectedSavings: 0,
        budgetVariance: 0,
        confidence: 0,
        keyInsights: [],
        recommendations: [],
        riskFactors: []
      }
    };

    // Cache the result
    aiCache.setTrends(transactionsHash, budgetsHash, predictions);
    
    return predictions;

  } catch (error) {
    console.error('Error generating trend predictions:', error);
    return {
      categoryPredictions: [],
      financialForecast: {
        nextMonthExpenses: 0,
        expectedSavings: 0,
        budgetVariance: 0,
        confidence: 0,
        keyInsights: [],
        recommendations: [],
        riskFactors: []
      }
    };
  }
}

export async function generateFinancialHealthScore(financialData: {
  transactions: Array<{
    id: number;
    amount: string;
    description: string;
    date: string;
    type: string;
    categoryName: string;
  }>;
  budgets: Array<{
    categoryId: number;
    amount: string;
    spent: number;
  }>;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
  };
}): Promise<FinancialHealthData> {
  try {
    const { transactions, budgets, summary } = financialData;
    
    // Create a more stable hash that focuses on significant financial changes
    // Exclude transaction IDs and exact timestamps to reduce cache misses
    const stableData = {
      transactionCount: transactions.length,
      totalIncome: summary.totalIncome,
      totalExpenses: summary.totalExpenses,
      budgetCount: budgets.length,
      recentTransactions: transactions
        .slice(0, 10)
        .map(t => ({
          amount: Math.round(parseFloat(t.amount)),
          type: t.type,
          categoryName: t.categoryName
        }))
    };
    
    const dataHash = aiCache.createDataHash(stableData);
    const cached = aiCache.get(`financial_health_${dataHash}`);
    if (cached) {
      console.log('Using cached financial health data - avoiding OpenAI API call');
      return cached;
    }

    // Prepare data for AI analysis
    const recentTransactions = transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);

    const categorySpending = new Map();
    transactions.forEach(t => {
      if (t.type === 'expense') {
        const current = categorySpending.get(t.categoryName) || 0;
        categorySpending.set(t.categoryName, current + parseFloat(t.amount));
      }
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert financial health analyst. Analyze the user's financial data and provide a comprehensive health assessment.

Calculate a financial health score (0-100) based on:
- Income vs expenses ratio
- Budget adherence 
- Spending patterns
- Emergency fund adequacy
- Debt management
- Savings rate

Categorize the score:
- 80-100: excellent
- 60-79: good  
- 40-59: fair
- 0-39: poor

Determine trend based on recent spending patterns:
- improving: positive financial trajectory
- declining: concerning financial habits
- stable: consistent financial behavior

Provide specific insights, achievements, and actionable warnings.

Respond with JSON in this exact format:
{
  "score": 75,
  "trend": "improving",
  "category": "good",
  "insights": ["Specific financial insights"],
  "achievements": ["Recent positive financial behaviors"],
  "warnings": ["Areas needing attention"]
}`
        },
        {
          role: "user",
          content: `Financial Summary:
- Total Income: $${summary.totalIncome}
- Total Expenses: $${summary.totalExpenses}
- Net Balance: $${summary.netBalance}
- Savings Rate: ${summary.totalIncome > 0 ? ((summary.totalIncome - summary.totalExpenses) / summary.totalIncome * 100).toFixed(1) : 0}%

Recent Transactions (${recentTransactions.length}):
${recentTransactions.slice(0, 20).map(t => 
  `${t.date.split('T')[0]}: ${t.description} - $${t.amount} (${t.categoryName})`
).join('\n')}

Budgets (${budgets.length}):
${budgets.map(b => {
  const utilization = b.amount ? (b.spent / parseFloat(b.amount) * 100).toFixed(1) : 0;
  return `Budget: $${b.amount}, Spent: $${b.spent} (${utilization}% used)`;
}).join('\n')}

Top Spending Categories:
${Array.from(categorySpending.entries())
  .sort(([,a], [,b]) => b - a)
  .slice(0, 5)
  .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`)
  .join('\n')}

Analyze this financial data and provide a comprehensive health assessment.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    const healthData: FinancialHealthData = {
      score: Math.max(0, Math.min(100, result.score || 50)),
      trend: result.trend || 'stable',
      category: result.category || 'fair',
      insights: Array.isArray(result.insights) ? result.insights : [],
      achievements: Array.isArray(result.achievements) ? result.achievements : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : []
    };

    // Cache the result for 2 hours to reduce frequent API calls
    aiCache.set(`financial_health_${dataHash}`, healthData, 7200);
    
    return healthData;
  } catch (error) {
    console.error('Error generating financial health score:', error);
    
    // Return fallback data based on simple calculations
    const { summary } = financialData;
    const savingsRate = summary.totalIncome > 0 ? 
      (summary.totalIncome - summary.totalExpenses) / summary.totalIncome : 0;
    
    let score = 50;
    let category: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
    
    if (savingsRate > 0.2) {
      score = 85;
      category = 'excellent';
    } else if (savingsRate > 0.1) {
      score = 70;
      category = 'good';
    } else if (savingsRate > 0) {
      score = 55;
      category = 'fair';
    } else {
      score = 30;
      category = 'poor';
    }
    
    return {
      score,
      trend: 'stable',
      category,
      insights: ['Financial analysis temporarily unavailable'],
      achievements: summary.netBalance > 0 ? ['Positive net balance'] : [],
      warnings: summary.netBalance < 0 ? ['Expenses exceed income'] : []
    };
  }
}