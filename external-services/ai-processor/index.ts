import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Fly.io is stateless - no caching here, only OpenAI processing

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

export interface ExpensePrediction {
  categoryPredictions: Array<{
    category: string;
    currentMonth: number;
    predictedNext: number;
    confidence: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    factors: string[];
  }>;
  monthlyPredictions: Array<{
    month: string;
    predicted: number;
    confidence: number;
    breakdown: Array<{
      category: string;
      amount: number;
    }>;
  }>;
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
    // Check cache first (legacy function - not using unified cache due to different interface)
    const cached = null;
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
      confidence: Math.max(0, Math.min(1, result.confidence)),
      reasoning: result.reasoning || 'Unable to determine category'
    };

    // Cache the result (legacy function - not using unified cache due to different interface)
    // categorization caching handled by main application

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

export async function generateContextualFinancialTips(data: {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    transactionCount: number;
  };
  transactions: Array<{
    description: string;
    amount: number;
    categoryName: string;
    date: string;
    type?: 'income' | 'expense';
    recurring?: boolean;
  }>;
  budgets: Array<{
    categoryName: string;
    budgetAmount: number;
    spent: number;
    remaining: number;
    period?: string;
  }>;
  goals?: Array<{
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate: string;
    type: 'saving' | 'debt' | 'investment';
  }>;
  selectedMonth: string;
}): Promise<{ tips: Array<{
  id: string;
  title: string;
  description: string;
  category: 'spending' | 'saving' | 'budgeting' | 'income';
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}> }> {
  try {
    const { summary, transactions, budgets, goals = [], selectedMonth } = data;
    
    // Return basic tip if no meaningful data
    if (transactions.length === 0 && summary.totalIncome === 0 && summary.totalExpenses === 0) {
      return {
        tips: [{
          id: 'basic_tip',
          title: 'Start Your Financial Journey',
          description: 'Begin by tracking your income and expenses to get personalized financial insights.',
          category: 'budgeting',
          priority: 'high',
          actionable: true
        }]
      };
    }

    // Build comprehensive prompt based on contextual tips routes logic
    const netBalance = summary.totalIncome - summary.totalExpenses;
    const savingsRate = summary.totalIncome > 0 ? (netBalance / summary.totalIncome) * 100 : 0;
    
    // Analyze spending by category - use the correct field mapping
    const categorySpending = new Map();
    const categorizedCount = transactions.filter(t => {
      const category = t.category || t.categoryName;
      return category && category !== 'Uncategorized';
    }).length;
    const uncategorizedCount = transactions.filter(t => {
      const category = t.category || t.categoryName;
      return !category || category === 'Uncategorized';
    }).length;
    
    transactions.forEach(t => {
      const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount;
      if (amount > 0) {
        const category = t.category || t.categoryName || 'Uncategorized';
        const current = categorySpending.get(category) || 0;
        categorySpending.set(category, current + amount);
      }
    });
    
    const topSpendingCategories = Array.from(categorySpending.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Detailed transaction analysis with proper amount parsing
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const recurringTransactions = transactions.filter(t => t.recurring);
    
    // Calculate transaction patterns
    const transactionFrequency = new Map();
    const dailySpending = new Map();
    
    expenseTransactions.forEach(t => {
      const day = new Date(t.date).getDate();
      const category = t.category || t.categoryName || 'Uncategorized';
      const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount;
      dailySpending.set(day, (dailySpending.get(day) || 0) + amount);
      transactionFrequency.set(category, (transactionFrequency.get(category) || 0) + 1);
    });

    // Analyze specific financial scenarios for contextual insights
    const scenarios = [];
    
    // Check categorization status
    if (uncategorizedCount > 0 && transactions.length > 0) {
      const uncategorizedPercent = (uncategorizedCount / transactions.length) * 100;
      scenarios.push(`🟨 Transaction categorization: ${uncategorizedCount} of ${transactions.length} transactions (${uncategorizedPercent.toFixed(0)}%) are uncategorized. Better categorization improves spending insights.`);
    } else if (categorizedCount === transactions.length && transactions.length > 0) {
      scenarios.push(`🟩 Well organized: All ${transactions.length} transactions are properly categorized, enabling detailed spending analysis.`);
    }
    
    // Check for budget overruns with detailed analysis
    budgets.forEach(budget => {
      if (budget.remaining < 0) {
        const overrunPercent = Math.abs((budget.remaining / budget.budgetAmount) * 100);
        const categoryTransactions = expenseTransactions.filter(t => t.categoryName === budget.categoryName);
        const avgTransactionInCategory = categoryTransactions.length > 0 ? 
          categoryTransactions.reduce((sum, t) => sum + t.amount, 0) / categoryTransactions.length : 0;
        
        scenarios.push(`🟥 Budget overrun: You've exceeded your ${budget.categoryName} budget by ${overrunPercent.toFixed(0)}% this month. Average transaction: $${avgTransactionInCategory.toFixed(2)}, Total transactions: ${categoryTransactions.length}`);
      } else if (budget.remaining < budget.budgetAmount * 0.1) {
        // Budget almost exhausted
        scenarios.push(`🟨 Budget warning: Only $${budget.remaining.toFixed(2)} remaining in your ${budget.categoryName} budget (${((budget.remaining/budget.budgetAmount)*100).toFixed(0)}% left).`);
      }
    });
    
    // Check savings rate scenarios with goal analysis
    if (savingsRate < 5 && summary.totalIncome > 0) {
      scenarios.push(`🟨 Low savings rate: Your savings rate is ${savingsRate.toFixed(1)}%. Consider revisiting your financial goals.`);
    } else if (savingsRate > 20) {
      scenarios.push(`🟩 Excellent savings: Great job! You're saving ${savingsRate.toFixed(1)}% of your income this month.`);
    }
    
    // Analyze goals progress
    goals.forEach(goal => {
      const progressPercent = (goal.currentAmount / goal.targetAmount) * 100;
      const daysToTarget = Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const monthlyNeeded = daysToTarget > 0 ? (goal.targetAmount - goal.currentAmount) / (daysToTarget / 30) : 0;
      
      if (progressPercent >= 90) {
        scenarios.push(`🟩 Goal achievement: You're ${progressPercent.toFixed(0)}% towards your ${goal.name} goal! Only $${(goal.targetAmount - goal.currentAmount).toFixed(2)} remaining.`);
      } else if (monthlyNeeded > netBalance) {
        scenarios.push(`🟨 Goal at risk: Your ${goal.name} goal needs $${monthlyNeeded.toFixed(2)}/month, but current monthly surplus is $${netBalance.toFixed(2)}.`);
      }
    });
    
    // Check for irregular income patterns
    if (incomeTransactions.length > 0) {
      const incomeAmounts = incomeTransactions.map(t => {
        const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
        return Math.abs(amount);
      });
      const avgIncome = incomeAmounts.reduce((sum, amt) => sum + amt, 0) / incomeAmounts.length;
      const incomeVariability = incomeAmounts.some(amt => Math.abs(amt - avgIncome) / avgIncome > 0.3);
      
      if (incomeVariability && incomeTransactions.length > 1) {
        scenarios.push(`🟦 Income variability: Your income shows fluctuation. Largest: $${Math.max(...incomeAmounts).toFixed(2)}, Smallest: $${Math.min(...incomeAmounts).toFixed(2)}. Consider setting aside a buffer.`);
      }
    }
    
    // Check for spending concentration and patterns
    topSpendingCategories.forEach(([category, amount]) => {
      const categoryPercent = (amount / summary.totalExpenses) * 100;
      const categoryFreq = transactionFrequency.get(category) || 0;
      
      if (categoryPercent > 40) {
        scenarios.push(`🟨 High category spending: ${category} represents ${categoryPercent.toFixed(0)}% of expenses ($${amount.toFixed(2)} across ${categoryFreq} transactions).`);
      }
    });
    
    // Check for positive spending improvements
    if (expenseTransactions.length > 0) {
      const avgTransactionAmount = summary.totalExpenses / expenseTransactions.length;
      if (avgTransactionAmount < 30 && expenseTransactions.length > 15) {
        scenarios.push(`🟩 Controlled spending: Great job! You're averaging $${avgTransactionAmount.toFixed(2)} per transaction, showing mindful spending habits.`);
      }
    }
    
    // Check recurring transaction efficiency with proper amount parsing
    if (recurringTransactions.length > 0) {
      const recurringTotal = recurringTransactions.reduce((sum, t) => {
        const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
        return sum + amount;
      }, 0);
      const recurringPercent = (recurringTotal / summary.totalExpenses) * 100;
      scenarios.push(`🟦 Recurring expenses: ${recurringPercent.toFixed(0)}% of expenses are recurring ($${recurringTotal.toFixed(2)} from ${recurringTransactions.length} transactions).`);
    }

    // Build detailed prompt with scenario analysis
    const prompt = `You are an expert financial advisor analyzing a user's financial data for ${selectedMonth}. Provide 2-4 specific, actionable financial tips based on their actual data and identified scenarios.

FINANCIAL OVERVIEW:
- Total Income: $${summary.totalIncome.toLocaleString()}
- Total Expenses: $${summary.totalExpenses.toLocaleString()}
- Net Balance: $${netBalance.toLocaleString()}
- Savings Rate: ${savingsRate.toFixed(1)}%
- Number of Transactions: ${summary.transactionCount}

TOP SPENDING CATEGORIES:
${topSpendingCategories.map(([cat, amount]) => `- ${cat}: $${amount.toLocaleString()} (${((amount/summary.totalExpenses)*100).toFixed(1)}%)`).join('\n')}

BUDGET STATUS:
${budgets.length > 0 ? budgets.map(b => `- ${b.categoryName}: $${b.spent.toLocaleString()}/$${b.budgetAmount.toLocaleString()} (${b.remaining >= 0 ? 'under' : 'over'} budget by $${Math.abs(b.remaining).toLocaleString()}) - ${b.period || 'monthly'}`).join('\n') : '- No budgets set'}

FINANCIAL GOALS:
${goals.length > 0 ? goals.map(g => `- ${g.name}: $${g.currentAmount.toLocaleString()}/$${g.targetAmount.toLocaleString()} (${((g.currentAmount/g.targetAmount)*100).toFixed(0)}% complete) - Target: ${g.targetDate}`).join('\n') : '- No goals set'}

TRANSACTION ANALYSIS:
- Total Transactions: ${transactions.length}
- Income Transactions: ${incomeTransactions.length}
- Expense Transactions: ${expenseTransactions.length}
- Recurring Transactions: ${recurringTransactions.length}
- Categorized Transactions: ${categorizedCount}/${transactions.length} (${transactions.length > 0 ? ((categorizedCount/transactions.length)*100).toFixed(0) : 0}%)
- Most Active Category: ${Array.from(transactionFrequency.entries()).sort((a,b) => b[1] - a[1])[0]?.[0]} (${Array.from(transactionFrequency.entries()).sort((a,b) => b[1] - a[1])[0]?.[1]} transactions)

IDENTIFIED FINANCIAL SCENARIOS:
${scenarios.length > 0 ? scenarios.join('\n') : '- No specific scenarios identified this month'}

RECENT TRANSACTIONS (last 8):
${transactions.slice(0, 8).map(t => `- ${t.date}: ${t.description} - $${t.amount.toLocaleString()} (${t.categoryName || 'Uncategorized'})${t.recurring ? ' [Recurring]' : ''}`).join('\n')}

CONTEXTUAL ANALYSIS REQUIREMENTS:
1. Address specific scenarios identified above with targeted, data-driven advice
2. For budget overruns: Analyze transaction patterns and suggest specific reduction strategies
3. For goal progress: Calculate required monthly contributions and suggest optimization
4. For savings rate issues: Provide concrete steps with dollar targets based on their income
5. For spending patterns: Identify specific categories and transaction behaviors to modify
6. For income irregularities: Recommend buffer strategies based on their variability patterns
7. For positive improvements: Reinforce successful behaviors and suggest expansion strategies
8. Use their actual transaction data, amounts, and patterns in all recommendations
9. Provide specific dollar amounts, percentages, and realistic timeframes
10. Make every tip immediately actionable with clear, measurable next steps

Return 2-4 contextual tips in JSON format, prioritizing scenario-based insights:
{
  "tips": [
    {
      "id": "tip_1",
      "title": "Scenario-specific actionable title",
      "description": "Detailed description addressing specific scenarios with concrete steps and amounts",
      "category": "spending|saving|budgeting|income",
      "priority": "high|medium|low",
      "actionable": true
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert financial advisor who provides personalized, contextual recommendations based on real user financial data. Always return valid JSON with actionable tips."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1200,
      temperature: 0.3 // Moderate creativity for personalized recommendations
    });

    const responseText = response.choices[0].message.content || '{}';
    console.log('[contextual-tips] OpenAI response received:', responseText.substring(0, 200));
    
    const aiResponse = JSON.parse(responseText);
    
    // Ensure proper data structure
    const tips = Array.isArray(aiResponse.tips) 
      ? aiResponse.tips.map((tip: any, index: number) => ({
          id: tip.id || `tip_${Date.now()}_${index}`,
          title: tip.title || 'Financial Tip',
          description: tip.description || 'No description available',
          category: ['spending', 'saving', 'budgeting', 'income'].includes(tip.category) ? tip.category : 'budgeting',
          priority: ['high', 'medium', 'low'].includes(tip.priority) ? tip.priority : 'medium',
          actionable: Boolean(tip.actionable)
        }))
      : [];

    console.log('[contextual-tips] Generated tips count:', tips.length);
    return { tips };

  } catch (error) {
    console.error('Error generating contextual financial tips:', error);
    console.error('OpenAI Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      status: error.status
    });
    return {
      tips: [{
        id: 'fallback_tip',
        title: 'Track Your Progress',
        description: 'Continue monitoring your financial transactions to identify spending patterns and optimization opportunities.',
        category: 'budgeting',
        priority: 'medium',
        actionable: true
      }]
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
    // Note: Cache now handled by unified cache system via routes
    if (financialData.timestamp) {
      console.log('Bypassing cache for fresh AI financial tips');
    }
    const { 
      totalIncome = 0, 
      totalExpenses = 0, 
      transactionsByCategory = [], 
      recentTransactions = [] 
    } = financialData || {};

    // Validate and prepare the financial summary
    const netBalance = totalIncome - totalExpenses;
    const transactionCount = Array.isArray(recentTransactions) ? recentTransactions.length : 0;
    
    // Return basic tip if no meaningful data
    if (transactionCount === 0 && totalIncome === 0 && totalExpenses === 0) {
      console.log('No financial data provided - returning basic tip');
      return [{
        title: 'Start Your Financial Journey',
        description: 'Begin by tracking your income and expenses to get personalized financial insights.',
        category: 'budgeting',
        priority: 'high',
        actionable: true
      }];
    }

    // Build summary with safe data access
    const categoryAnalysis = Array.isArray(transactionsByCategory) && transactionsByCategory.length > 0 
      ? transactionsByCategory.map(cat => `- ${cat.categoryName || 'Unknown'}: $${cat.amount || 0} (${cat.type || 'expense'})`).join('\n')
      : '- No category data available';

    const recentAnalysis = transactionCount > 0 
      ? recentTransactions.slice(0, 10).map(t => `- ${t.description || 'Unknown'}: $${t.amount || 0} (${new Date(t.date || Date.now()).toLocaleDateString()})`).join('\n')
      : '- No recent transactions available';

    const incomeCount = transactionCount > 0 ? recentTransactions.filter(t => t.type === 'income').length : 0;
    const expenseCount = transactionCount > 0 ? recentTransactions.filter(t => t.type === 'expense').length : 0;
    const avgTransaction = transactionCount > 0 ? (totalIncome + totalExpenses) / transactionCount : 0;

    const summary = `Financial Summary:
- Monthly Income: $${totalIncome}
- Monthly Expenses: $${totalExpenses}
- Net Balance: $${netBalance} ${netBalance < 0 ? '(DEFICIT)' : '(SURPLUS)'}
- Transaction Count: ${transactionCount}

Spending by Category:
${categoryAnalysis}

Recent Transaction Analysis:
${recentAnalysis}

Transaction Pattern Analysis:
- Average transaction size: $${avgTransaction.toFixed(2)}
- Income transactions: ${incomeCount}
- Expense transactions: ${expenseCount}
- Date range: ${transactionCount > 0 ? new Date(Math.min(...recentTransactions.map(t => new Date(t.date || Date.now()).getTime()))).toLocaleDateString() : 'No data'} to ${transactionCount > 0 ? new Date(Math.max(...recentTransactions.map(t => new Date(t.date || Date.now()).getTime()))).toLocaleDateString() : 'No data'}

Generate 4 independent box analyses with exact mathematical calculations.`;

    // Direct OpenAI call (no recursion - this IS the AI processor)
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

    const result = JSON.parse(response.choices[0].message.content || '{}');

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

    // Note: Cache now handled by unified cache system via routes
    // Success logging removed for production

    return processedTips as any; // Type assertion for deployment
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
    // No caching in Fly.io - caching handled by main application
    const expenseTransactions = transactions.filter(t => t.type === 'expense');

    if (expenseTransactions.length === 0) {
      return [];
    }

    // Optimize data processing - limit to 10 most recent transactions
    const recentTransactions = expenseTransactions.slice(0, 10);
    const totalAmount = recentTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use faster model for spending insights
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

${recentTransactions.map(t => 
  `- ${t.description}: $${t.amount} (${t.categoryName || 'Uncategorized'}) on ${t.date}`
).join('\n')}

Total transactions: ${recentTransactions.length}
Date range: ${recentTransactions[recentTransactions.length - 1]?.date} to ${recentTransactions[0]?.date}

Generate financial insights based on this spending data.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 600 // Slightly higher for complex analysis
    });

    const result = JSON.parse(response.choices[0].message.content || '{"insights": []}');
    const insights = Array.isArray(result) ? result : result.insights;

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

    // Cache handled by unified cache system via /execute-gpt-task endpoint

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
    // No caching in Fly.io - caching handled by main application

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
      factors: result.factors,
      icon: result.icon || 'Shield',
      aiAnalysis: {
        personalizedFactors: result.aiAnalysis?.personalizedFactors,
        riskAssessment: result.aiAnalysis?.riskAssessment,
        recommendations: result.aiAnalysis?.recommendations,
        confidence: Math.max(0, Math.min(1, result.aiAnalysis?.confidence))
      }
    };

    // Cache handled by unified cache system via /execute-gpt-task endpoint

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
    categoryName: string;
  }>,
  budgets: Array<{ categoryName: string; amount: string; }> = []
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

    // Note: Cache now handled by unified cache system via routes

    // Prepare comprehensive financial data for AI analysis
    const monthlyData = new Map();
    const categoryTotals = new Map();

    transactions.forEach(t => {
      const month = t.date.slice(0, 7);
      const category = t.categoryName || 'Other';
      const amount = parseFloat(t.amount);

      if (!monthlyData.has(month)) {
        monthlyData.set(month, { income: 0, expenses: 0, categories: new Map() });
      }

      const monthData = monthlyData.get(month);
      if (t.type === 'income') {
        monthData.income += amount;
      } else {
        monthData.expenses += amount;
        const catAmount = monthData.categories.get(category);
        monthData.categories.set(category, catAmount + amount);
      }

      const totalAmount = categoryTotals.get(category);
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
          .map(([cat, amount]) => ({ categoryName: cat, amount }))
      })).sort((a, b) => a.month.localeCompare(b.month)),
      categoryTotals: Array.from(categoryTotals.entries()).map(([cat, amount]) => ({ categoryName: cat, amount })),
      budgets: budgets.map(b => ({ categoryName: b.categoryName || 'Other', budgetAmount: parseFloat(b.amount) }))
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
      categoryPredictions: result.categoryPredictions,
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

    // Note: Cache now handled by unified cache system via routes
    // Success logging removed for production

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

export async function generateExpensePredictions(transactions: Array<{
  id: number;
  amount: string;
  description: string;
  date: string;
  type: string;
  categoryName?: string;
  recurring?: boolean;
}>): Promise<ExpensePrediction> {
  try {
    // Return empty predictions for insufficient data
    if (!transactions || transactions.length < 5) {
      return {
        categoryPredictions: [],
        monthlyPredictions: []
      };
    }

    // Filter expense transactions only and limit to last 12 months for efficiency
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const expenseTransactions = transactions
      .filter(t => t.type === 'expense' && new Date(t.date) >= oneYearAgo)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-100); // Limit to last 100 transactions for token efficiency

    if (expenseTransactions.length < 3) {
      return {
        categoryPredictions: [],
        monthlyPredictions: []
      };
    }

    // Note: Cache now handled by unified cache system via routes

    // Analyze spending patterns by month and category
    const monthlyData = new Map<string, Map<string, number>>();
    const categoryTotals = new Map<string, { total: number, count: number, recurring: number }>();

    expenseTransactions.forEach(t => {
      const month = t.date.slice(0, 7); // YYYY-MM format
      const category = t.categoryName || 'Other';
      const amount = Math.abs(parseFloat(t.amount));

      // Track monthly spending by category
      if (!monthlyData.has(month)) {
        monthlyData.set(month, new Map());
      }
      const monthData = monthlyData.get(month)!;
      monthData.set(category, monthData.get(category) + amount);

      // Track category statistics
      if (!categoryTotals.has(category)) {
        categoryTotals.set(category, { total: 0, count: 0, recurring: 0 });
      }
      const catData = categoryTotals.get(category)!;
      catData.total += amount;
      catData.count += 1;
      if (t.recurring) catData.recurring += 1;
    });

    // Prepare data for AI analysis
    const analysisData = {
      totalTransactions: expenseTransactions.length,
      timeSpan: `${expenseTransactions[0].date.slice(0, 7)} to ${expenseTransactions[expenseTransactions.length - 1].date.slice(0, 7)}`,
      monthlyBreakdown: Array.from(monthlyData.entries()).map(([month, categories]) => ({
        month,
        totalSpent: Array.from(categories.values()).reduce((sum, amount) => sum + amount, 0),
        categories: Array.from(categories.entries()).map(([cat, amount]) => ({ category: cat, amount }))
      })),
      categoryAnalysis: Array.from(categoryTotals.entries()).map(([category, data]) => ({
        category,
        totalSpent: data.total,
        averagePerTransaction: data.total / data.count,
        transactionCount: data.count,
        recurringTransactions: data.recurring,
        recurringPercentage: (data.recurring / data.count * 100).toFixed(1)
      })),
      recentTransactions: expenseTransactions.slice(-20).map(t => ({
        date: t.date.slice(0, 10),
        description: t.description,
        amount: Math.abs(parseFloat(t.amount)),
        category: t.categoryName || 'Other',
        recurring: t.recurring || false
      }))
    };

    const prompt = `Analyze this detailed expense data and generate accurate predictions for future spending patterns.

EXPENSE ANALYSIS DATA:
${JSON.stringify(analysisData, null, 2)}

REQUIREMENTS:
1. Identify spending trends, seasonal patterns, and recurring expenses
2. Calculate realistic predictions based on historical data
3. Assess confidence levels based on data consistency and patterns
4. Consider factors like spending volatility, growth trends, and recurring expenses

RESPONSE FORMAT (JSON):
{
  "categoryPredictions": [
    {
      "category": "Food & Dining",
      "currentMonth": 450.00,
      "predictedNext": 475.00,
      "confidence": 0.85,
      "trend": "increasing",
      "factors": ["Seasonal increase", "Recent dining out trend", "Grocery price inflation"]
    }
  ],
  "monthlyPredictions": [
    {
      "month": "2025-07",
      "predicted": 2150.00,
      "confidence": 0.80,
      "breakdown": [
        { "category": "Food & Dining", "amount": 475.00 },
        { "category": "Transportation", "amount": 320.00 }
      ]
    },
    {
      "month": "2025-08",
      "predicted": 2200.00,
      "confidence": 0.75,
      "breakdown": [
        { "category": "Food & Dining", "amount": 480.00 },
        { "category": "Transportation", "amount": 330.00 }
      ]
    },
    {
      "month": "2025-09",
      "predicted": 2100.00,
      "confidence": 0.70,
      "breakdown": [
        { "category": "Food & Dining", "amount": 460.00 },
        { "category": "Transportation", "amount": 310.00 }
      ]
    }
  ]
}

ANALYSIS GUIDELINES:
- Use actual spending patterns to predict future amounts
- Factor in recurring expenses for higher confidence
- Consider trend direction (increasing/decreasing/stable)
- Provide realistic confidence levels (0.6-0.95 range)
- Include next 3-6 months in monthly predictions
- Always include "factors" array for each category prediction
- Explain prediction factors clearly
- Account for seasonal variations if detectable
- Ensure all numeric values are provided (no null/undefined)`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an advanced financial forecasting AI specializing in expense prediction analysis. You analyze spending patterns, identify trends, and generate accurate predictions based on historical transaction data. Focus on realistic, data-driven predictions with appropriate confidence levels."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.2 // Low temperature for consistent financial predictions
    });

    const aiResponse = JSON.parse(response.choices[0].message.content || '{}');

    // Ensure all required fields are present with proper data types
    const categoryPredictions = Array.isArray(aiResponse.categoryPredictions) 
      ? aiResponse.categoryPredictions.map(pred => ({
          category: pred.category || 'Unknown',
          currentMonth: Number(pred.currentMonth),
          predictedNext: Number(pred.predictedNext),
          confidence: Number(pred.confidence),
          trend: pred.trend || 'stable',
          factors: Array.isArray(pred.factors) ? pred.factors : ['No specific factors identified']
        }))
      : [];

    const monthlyPredictions = Array.isArray(aiResponse.monthlyPredictions)
      ? aiResponse.monthlyPredictions.map(month => ({
          month: month.month || 'Unknown',
          predicted: Number(month.predicted),
          confidence: Number(month.confidence),
          breakdown: Array.isArray(month.breakdown) ? month.breakdown : []
        }))
      : [];

    const finalResult = {
      categoryPredictions,
      monthlyPredictions
    };

    // Note: Cache now handled by unified cache system via routes
    // Success logging removed for production

    return finalResult;

  } catch (error) {
    console.error('Error generating expense predictions:', error);
    return {
      categoryPredictions: [],
      monthlyPredictions: []
    };
  }
}

export async function generateDailyRecommendations(financialData: {
  transactions: Array<{
    id: number;
    amount: string;
    description: string;
    date: string;
    type: 'income' | 'expense';
    categoryName?: string;
  }>;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netAmount: number;
  };
  budgets: Array<{
    id: number;
    name: string;
    amount: string;
    categoryName: string;
    period: string;
  }>;
}) {
  try {
    // Production: minimal logging only

    // Note: Cache now handled by unified cache system via routes
    // Production: minimal logging only

    // Limit data to last 3 months and 100 transactions for efficiency
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);



    const recentTransactions = financialData.transactions
      .filter(t => new Date(t.date) >= threeMonthsAgo)
      .slice(0, 100);

    // Production: minimal logging only

    // Calculate spending patterns
    const categorySpending = new Map();
    const dailySpending = new Map();

    recentTransactions.forEach(t => {
      if (t.type === 'expense') {
        const amount = parseFloat(t.amount);
        const categoryName = t.categoryName || 'Other';
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
- Total Income: $${(financialData.summary?.totalIncome || 0).toFixed(2)}
- Total Expenses: $${(financialData.summary?.totalExpenses || 0).toFixed(2)}
- Net Amount: $${(financialData.summary?.netAmount || 0).toFixed(2)}
- Recent Transactions: ${recentTransactions.length}
- Average Daily Spending: $${avgDailySpending.toFixed(2)}

Top Spending Categories:
${topCategories.map(([cat, amount]) => `- ${cat}: $${amount.toFixed(2)}`).join('\n')}

Budget Information:
${financialData.budgets.map(b => `- ${b.name}: $${b.amount} (${b.period})`).join('\n')}

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert financial advisor who provides personalized, actionable recommendations based on real user data. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.3 // Moderate creativity for personalized recommendations
    });

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
          confidence: Number(insight.confidence),
          timeframe: insight.timeframe || 'Recent activity'
        }))
      : [];

    const result = {
      recommendations,
      insights
    };

    // Note: Cache now handled by unified cache system via routes
    // Success logging removed for production

    return result;

  } catch (error) {
    console.error('Error generating daily recommendations:', error);
    return {
      recommendations: [],
      insights: []
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

    // No caching in Fly.io - caching handled by main application

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

    // Ultra-optimize for speed - minimal data processing
    const savingsRate = summary.totalIncome > 0 ? ((summary.totalIncome - summary.totalExpenses) / summary.totalIncome * 100) : 0;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Calculate financial health score (0-100). Return JSON: {"score": number, "trend": "improving/stable/declining", "category": "excellent/good/fair/poor", "insights": ["max 2 insights"], "achievements": ["max 1"], "warnings": ["max 1"]}`
        },
        {
          role: "user",
          content: `Income: $${summary.totalIncome}, Expenses: $${summary.totalExpenses}, Savings: ${savingsRate.toFixed(1)}%
Transactions: ${recentTransactions.length}
Budgets: ${budgets.length}

Calculate health score quickly.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 300
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
    // No caching in Fly.io - handled by main application

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-processor', model: 'gpt-4o' });
});

// Unified AI endpoint - stateless OpenAI processing only (no caching)
app.post("/execute-gpt-task", async (req, res) => {
  const { task, userId, payload } = req.body;

  if (!task || !userId || !payload) {
    return res.status(400).json({ error: 'Missing required fields: task, userId, payload' });
  }

  try {
    let result;

    switch (task) {
      case "contextual-tips":
        // Validate and fix payload structure for contextual tips
        const contextualPayload = {
          summary: payload.summary || { totalIncome: 0, totalExpenses: 0, netBalance: 0 },
          transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
          budgets: Array.isArray(payload.budgets) ? payload.budgets : [],
          goals: Array.isArray(payload.goals) ? payload.goals : [],
          selectedMonth: payload.selectedMonth || 'Current Month'
        };
        
        // Generate summary from transactions if missing or incomplete
        if (!payload.summary || payload.summary.totalIncome === undefined) {
          const validTransactions = contextualPayload.transactions;
          const totalIncome = validTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
          const totalExpenses = validTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
          contextualPayload.summary = {
            totalIncome,
            totalExpenses,
            netBalance: totalIncome - totalExpenses,
            transactionCount: validTransactions.length
          };
          console.log('Contextual tips: Generated summary from transactions', contextualPayload.summary);
        }
        
        result = await generateContextualFinancialTips(contextualPayload);
        break;
      
      case "financial-tips":
        result = await generateFinancialTips(payload);
        break;

      case "daily-recommendations":
        // Fix payload structure for daily recommendations
        const dailyPayload = {
          summary: payload.summary || { totalIncome: 0, totalExpenses: 0, netBalance: 0 },
          transactions: payload.transactions,
          budgets: payload.budgets,
          categories: payload.categories || {}
        };
        console.log('Daily recommendations: Fixed payload structure', Object.keys(dailyPayload));
        result = await generateDailyRecommendations(dailyPayload);
        break;

      case "expense-predictions":
        result = await generateExpensePredictions(payload.transactions || []);
        break;

      case "financial-health-score":
        // Add defensive checks for payload structure
        console.log('Financial health: Payload received:', JSON.stringify(payload, null, 2));
        if (!payload.transactions || !Array.isArray(payload.transactions)) {
          console.error('Financial health: Invalid transactions array');
          result = {
            score: 50,
            trend: 'stable',
            category: 'fair',
            insights: ['Unable to analyze - insufficient transaction data'],
            achievements: [],
            warnings: ['Please add more transaction data for accurate analysis']
          };
        } else {
          result = await generateAIFinancialHealthScore(payload);
        }
        break;

      case "spending-insights":
        result = await generateSpendingInsights(payload.transactions);
        break;

      case "trend-predictions":
        result = await generateTrendPredictions(payload.transactions, payload.budgets);
        break;

      default:
        return res.status(400).json({ error: `Unknown task: ${task}` });
    }

    // Task completion logging removed for production
    res.json(result);
  } catch (error: any) {
    console.error(`Error processing ${task}:`, error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Legacy endpoints for backward compatibility
app.post('/generate-financial-tip', async (req, res) => {
  try {
    const result = await generateFinancialTips(req.body);
    res.json(result);
  } catch (error) {
    console.error('Legacy financial tip error:', error);
    res.status(500).json({ error: 'Financial tip generation failed' });
  }
});

app.post('/generate-daily-recommendation', async (req, res) => {
  try {
    const result = await generateDailyRecommendations(req.body);
    res.json(result);
  } catch (error) {
    console.error('Legacy daily recommendation error:', error);
    res.status(500).json({ error: 'Daily recommendation generation failed' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`AI Processor server running on port ${port}`);
});