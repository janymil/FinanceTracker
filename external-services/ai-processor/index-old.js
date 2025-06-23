"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const openai_1 = __importDefault(require("openai"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = parseInt(process.env.PORT || '3000', 10);
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ai-processor' });
});
app.post('/generate-financial-tip', async (req, res) => {
    try {
        const { summary } = req.body;
        if (!summary || typeof summary !== 'string') {
            return res.status(400).json({
                error: 'Invalid request: summary field (string) is required'
            });
        }
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
        res.json({ tip: result });
    }
    catch (error) {
        console.error('OpenAI API Error:', error);
        if (error instanceof Error && 'status' in error) {
            return res.status(error.status).json({
                error: error.message || 'OpenAI API error',
                type: error.type || 'api_error'
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.post('/generate-daily-recommendation', async (req, res) => {
    try {
        const { summary, transactions, budgets, categories } = req.body;
        if (!transactions || !Array.isArray(transactions)) {
            return res.status(400).json({
                error: 'Invalid request: transactions array is required'
            });
        }
        if (transactions.length < 3) {
            return res.json({
                recommendations: [],
                insights: [],
                message: "Add at least 3 transactions to get personalized daily recommendations"
            });
        }
        console.log('FLY.IO EXTERNAL SERVICE: Generating new daily recommendations with OpenAI GPT-4o');
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const recentTransactions = transactions
            .filter(t => new Date(t.date) >= threeMonthsAgo)
            .slice(0, 100);
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
${recentTransactions.slice(0, 10).map(t => `- ${t.date}: ${t.type} $${t.amount} - ${t.description}`).join('\n')}

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
            model: "gpt-4o",
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
            temperature: 0.3
        });
        const aiResponse = JSON.parse(response.choices[0].message.content || '{}');
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
        res.json(result);
    }
    catch (error) {
        console.error('OpenAI API Error:', error);
        if (error instanceof Error && 'status' in error) {
            return res.status(error.status).json({
                error: error.message || 'OpenAI API error',
                type: error.type || 'api_error'
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.listen(port, '0.0.0.0', () => {
    console.log(`AI Processor service running on port ${port}`);
});
