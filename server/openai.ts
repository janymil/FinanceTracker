import { UnifiedAICache } from "../lib/unifiedAICache";
import { getLanguageLabel, normalizeLanguageCode } from "../lib/languageUtils";
import { createRoutedClient, AI_MODELS } from "../lib/aiProvider";
import {
  emptyStateCopy,
  financialTipsFallback,
  healthFallbackCopy,
  isTextInLanguage,
  progressTipFallback,
} from "../shared/aiFallbacks";
import {
  AIResponseError,
  clampConfidence,
  finiteNumber,
  parseModelJson,
  validCategoryId,
} from "../shared/aiResults";

// All model calls go through lib/aiProvider: the ai-processor gateway first, then OpenAI
// directly (DeepSeek/Groq behind it), with JSON fence stripping and real token/cost accounting.
// The prompts in this file are the only copy: the gateway never holds a Kaptia prompt.
const openai = createRoutedClient();

/**
 * House rules for every answer a person reads (tips, insights, scores, forecasts).
 * Not applied to extraction or categorisation, where a merchant may really be a bank.
 */
export const PROSE_RULES = `HOUSE RULES (always apply):
- Kaptia is a personal budgeting tool, not a licensed financial service. Never present yourself as an advisor or adviser.
- Do not recommend investments, loans, credit products or banks, and do not use the words bank, loan, credit, invest or advisor (or their Spanish or Slovak equivalents).
- Amounts are in the person's own currency. Never add a currency symbol or name unless one appears in the data.
- Only describe what the data shows. Never invent amounts, merchants or dates.`;

/** Adds the house rules to the system message (or creates one). Pure, so it can be tested. */
export function withProseRules<T extends { messages?: any[] }>(params: T): T {
  const messages = Array.isArray(params?.messages) ? [...params.messages] : [];
  const index = messages.findIndex((message) => message?.role === 'system' && typeof message.content === 'string');
  if (index >= 0) {
    messages[index] = { ...messages[index], content: `${messages[index].content}\n\n${PROSE_RULES}` };
  } else {
    messages.unshift({ role: 'system', content: PROSE_RULES });
  }
  return { ...params, messages };
}

function generateProse(params: any) {
  return openai.chat.completions.create(withProseRules(params));
}

const DEFAULT_FORECAST: FinancialForecast = {
  nextMonthExpenses: 0,
  expectedSavings: 0,
  budgetVariance: 0,
  confidence: 0,
  keyInsights: [],
  recommendations: [],
  riskFactors: [],
};

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const title = typeof record.title === 'string' ? record.title.trim() : '';
        const body = typeof record.description === 'string' ? record.description.trim() : '';
        return title && body ? `${title}: ${body}` : title || body;
      }
      return '';
    })
    .filter(Boolean);
}

/**
 * The trends page renders every forecast list as plain text, so whatever shape the model used
 * (strings, or {title, description} objects) becomes sentences, and every number is finite.
 */
export function normalizeForecast(raw: unknown): FinancialForecast {
  const forecast = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    ...DEFAULT_FORECAST,
    nextMonthExpenses: finiteNumber(forecast.nextMonthExpenses),
    expectedSavings: finiteNumber(forecast.expectedSavings),
    budgetVariance: finiteNumber(forecast.budgetVariance),
    confidence: clampConfidence(forecast.confidence, 0),
    keyInsights: textList(forecast.keyInsights),
    recommendations: textList(forecast.recommendations),
    riskFactors: textList(forecast.riskFactors),
  };
}

export interface ExpenseCategorizationResult {
  category: string;
  confidence: number;
  reasoning: string;
  /** True when no real answer was produced; callers must not treat the rest as a result. */
  failed?: boolean;
}

export interface UserCategoryChoice {
  categoryId?: number;
  suggestedCategory?: string;
  confidence: number;
  reasoning: string;
  /** True when no real answer was produced; callers must not treat the rest as a result. */
  failed?: boolean;
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
  /** Plain sentences: the trends page renders each one as text. */
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
  /** True when the model could not be reached and the score was computed from savings alone. */
  degraded?: boolean;
}

/**
 * Turns the model's category answer into something safe to act on: the id must be one of the
 * person's own categories (a model can invent ids), and the confidence is always 0..1.
 */
export function toCategoryChoice(
  result: Record<string, any>,
  userCategories: Array<{ id: number; name: string }>,
): UserCategoryChoice {
  const categoryId = validCategoryId(result.categoryId, userCategories);
  const suggested = typeof result.suggestedCategory === 'string' ? result.suggestedCategory.trim() : '';
  const reasoning = typeof result.reasoning === 'string' && result.reasoning ? result.reasoning : 'Unable to determine category';

  if (categoryId === undefined && !suggested) {
    // An id that is not theirs and no name either: nothing usable, so say so.
    return { confidence: 0.1, reasoning, failed: true };
  }
  return {
    categoryId,
    suggestedCategory: categoryId === undefined ? suggested : undefined,
    confidence: clampConfidence(result.confidence),
    reasoning,
  };
}

export async function categorizeIncomeWithUserCategories(
  description: string,
  amount: number,
  userCategories: Array<{id: number, name: string, type: string}>,
  language: string = 'en-us'
): Promise<UserCategoryChoice> {
  const normalizedLanguage = normalizeLanguageCode(language);
  try {
    const userCategoryList = userCategories.map(cat => `- ${cat.name} (ID: ${cat.id})`).join('\n');
    
    const response = await openai.chat.completions.create({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content must be in ${getLanguageLabel(normalizedLanguage)}.

You are an expert financial categorization system for INCOME transactions. Your job is to provide CONSISTENT categorization for money coming into accounts.

USER'S EXISTING INCOME CATEGORIES:
${userCategoryList}

INCOME PATTERN RECOGNITION:
💰 SALARY/WAGES: Regular employment income, payroll deposits
💼 FREELANCE/BUSINESS: Client payments, business income, consulting fees
🎯 INVESTMENTS: Dividends, interest payments, capital gains
🎁 TRANSFERS: Money transfers from other accounts, family transfers  
📱 TOP-UP DEPOSITS: Mobile account recharges, wallet deposits (incoming money)
🏦 REFUNDS: Store refunds, service refunds, tax refunds
💸 OTHER INCOME: Miscellaneous income sources

INCOME CATEGORIZATION LOGIC:
1. Analyze the source/description of the incoming money
2. Match to appropriate income category based on source type
3. "Top-Up by *6612" = someone adding money to your account = Income/Transfer
4. Regular employer names = Salary/Wages
5. Client/business names = Freelance/Business income
6. Bank interest/dividends = Investment income

Respond with JSON in this exact format:
{
  "categoryId": 123,  // Use this if transaction matches an existing category
  "suggestedCategory": "Income Category Name",  // Use this only if no existing category fits
  "confidence": 0.95,
  "reasoning": "Brief explanation of income source analysis"
}

IMPORTANT: Use either "categoryId" OR "suggestedCategory", never both.`
        },
        {
          role: "user",
          content: `Income Description: "${description}"
Amount: +${amount}

INCOME ANALYSIS:
1. This is money COMING INTO the account (positive income)
2. Identify the source of this income
3. Match to appropriate income category

Examples:
- "Top-Up by *6612" = Someone depositing money → Transfer/Deposit income
- "ACME CORP PAYROLL" = Employer payment → Salary/Wages
- "FREELANCE CLIENT ABC" = Client payment → Freelance/Business income

Analyze this income transaction:`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    return toCategoryChoice(parseModelJson(response.choices[0].message.content), userCategories);
  } catch (error) {
    console.error('Error categorizing income with user categories:', error);
    return {
      suggestedCategory: 'Income',
      confidence: 0.1,
      reasoning: 'Error occurred during income categorization',
      failed: true,
    };
  }
}

export async function categorizeExpenseWithUserCategories(
  description: string, 
  amount: number, 
  userCategories: Array<{id: number, name: string, type: string}>,
  language: string = 'en-us'
): Promise<UserCategoryChoice> {
  const normalizedLanguage = normalizeLanguageCode(language);
  try {
    const userCategoryList = userCategories.map(cat => `- ${cat.name} (ID: ${cat.id})`).join('\n');

    const response = await openai.chat.completions.create({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content must be in ${getLanguageLabel(normalizedLanguage)}.

You are an expert financial categorization system with comprehensive merchant database knowledge. Your job is to provide CONSISTENT, INTELLIGENT categorization by analyzing merchant patterns and business types.

USER'S EXISTING CATEGORIES:
${userCategoryList}

CONSISTENCY RULES - CRITICAL:
- ALWAYS categorize the same merchant the same way (Luigi Acampora should ALWAYS get the same category)
- Analyze the merchant name first, then context clues
- Use business pattern recognition for consistency

MERCHANT PATTERN RECOGNITION:
🍕 RESTAURANTS & DINING: 
- Personal names (Luigi Acampora, Mario's, Giuseppe's) = Restaurant/Dining
- Chain restaurants (McDonald's, Starbucks, KFC, Burger King)
- Words: "Restaurant", "Cafe", "Pizza", "Bar", "Bistro"

🛒 GROCERY & FOOD STORES:
- Migros, Coop, ALDI, Lidl, Walmart, Target, Kroger, Whole Foods
- Words: "Market", "Supermarket", "Grocery", "Food"

🚗 TRANSPORTATION:
- Gas stations: Shell, BP, Exxon, Chevron, Mobil
- Transport: Uber, Lyft, taxi, parking, metro, bus
- Words: "Gas", "Fuel", "Transport", "Parking"

💻 BUSINESS/PROFESSIONAL:
- Tech services: Replit, OpenAI, Hostinger, Bunny.net, GitHub
- Office supplies, professional services, software subscriptions

🎯 RETAIL/SHOPPING:
- Department stores: Amazon, Casa Ideas, Plaza Norte, Target (non-food)
- Clothing, electronics, general retail

📱 BILLS & UTILITIES:
- Internet, phone, electricity, water, gas bills
- yallo.ch (Swiss mobile), Swisscom, utility companies

🎬 ENTERTAINMENT:
- Streaming: Netflix, Spotify, SoundCloud, Apple Music
- Gaming, movies, concerts, entertainment venues

💳 CASH/ATM:
- ATM withdrawals, cash transactions
- Keywords: "Cash withdrawal", "ATM", "Withdrawal"

SMART CATEGORIZATION LOGIC:
1. Extract merchant name from description
2. Check if merchant fits known patterns
3. Match business type to user's existing categories
4. If multiple categories could fit, choose the most specific/appropriate one
5. Suggest new category only if no existing category makes sense

CONSISTENCY EXAMPLES:
- "Luigi Acampora" → ALWAYS Restaurant (personal name pattern)
- "Migros" → ALWAYS Grocery/Food (known Swiss grocery chain)
- "Replit" → ALWAYS Business/Professional (development platform)
- "Cash withdrawal" → ALWAYS Cash/ATM category

Respond with JSON in this exact format:
{
  "categoryId": 123,  // Use this if transaction matches an existing category
  "suggestedCategory": "New Category Name",  // Use this only if no existing category fits
  "confidence": 0.95,
  "reasoning": "Brief explanation of merchant analysis and category choice"
}

IMPORTANT: Use either "categoryId" OR "suggestedCategory", never both.`
        },
        {
          role: "user",
          content: `Transaction Description: "${description}"
Amount: ${amount}

DETAILED ANALYSIS REQUIRED:
1. Extract the merchant name from the description
2. Identify the business type using pattern recognition
3. Find the best matching existing category
4. Ensure consistency - same merchant = same category always

Merchant Analysis Examples:
- "Luigi Acampora" = Personal name → Restaurant business
- "Migros" = Swiss grocery chain → Food/Grocery business  
- "Top-Up by *6612" = Mobile top-up → Telecommunications/Bills business
- "Replit" = Development platform → Business/Professional service

Analyze this transaction and provide consistent categorization:`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    return toCategoryChoice(parseModelJson(response.choices[0].message.content), userCategories);
  } catch (error) {
    console.error('Error categorizing expense with user categories:', error);
    return {
      suggestedCategory: 'Other',
      confidence: 0.1,
      reasoning: 'Error occurred during categorization',
      failed: true,
    };
  }
}

export async function categorizeExpense(
  description: string, 
  amount: number, 
  language: string = 'en-us',
  userTransactions: any[] = [],
  userCategories: any[] = []
): Promise<ExpenseCategorizationResult> {
  const normalizedLanguage = normalizeLanguageCode(language);
  try {
    // Analyze user's existing transaction patterns for personalization
    const userCategoriesSet = new Set();
    const merchantPatterns = new Map();
    
    // Extract user's categories and merchant patterns
    userTransactions.forEach(transaction => {
      if (transaction.category && transaction.category !== 'Uncategorized') {
        userCategoriesSet.add(transaction.category);
        
        // Build merchant pattern recognition
        const merchant = transaction.description.toLowerCase();
        if (!merchantPatterns.has(merchant)) {
          merchantPatterns.set(merchant, transaction.category);
        }
      }
    });

    // Build personalized context
    const userCategoriesList = Array.from(userCategoriesSet);
    const merchantExamples = Array.from(merchantPatterns.entries())
      .slice(0, 10) // Limit to avoid token overflow
      .map(([merchant, category]) => `"${merchant}" → ${category}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content (category, reasoning) must be in ${getLanguageLabel(normalizedLanguage)}.

You are an intelligent financial categorization system. Follow this simple, logical process:

STEP 1: CHECK USER'S HISTORY
- Look through the user's previous transactions
- If you find this exact merchant before, use the SAME category they used
- Be consistent with the user's past choices

STEP 2: RESEARCH THE MERCHANT (only if not found in history)
- What type of business is this merchant?
- What do they sell or provide?
- Examples: Migros = Swiss supermarket, Replit = coding platform, ALDI = grocery store

STEP 3: MATCH TO CATEGORY
- Match the merchant's business type to user's existing categories
- If no exact match, pick the closest logical category
- Only suggest "Other" if the merchant is truly unclear

${userCategoriesList.length > 0 ? `
USER'S EXISTING CATEGORIES: ${userCategoriesList.join(', ')}

USER'S MERCHANT PATTERNS:
${merchantExamples}
` : ''}

CATEGORIZATION EXAMPLES:
- Grocery stores (Migros, ALDI, Coop) → Food/Groceries category
- Tech services (Replit, GitHub) → Business/Technology category
- Gas stations → Transportation category
- Restaurants → Food/Dining category
- Phone/Internet bills → Bills/Utilities category

Be practical and logical. Don't overthink it.

Respond with JSON:
{
  "category": "category_name",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this category fits"
}`
        },
        {
          role: "user",
          content: `TRANSACTION TO ANALYZE:
Description: "${description}"
Amount: ${amount}

REQUIRED ANALYSIS STEPS:

1. USER DATA SEARCH: Search through my transaction history. Have I used this merchant before?
   - If YES: What category did I assign? How many times? Be specific.
   - If NO: State "No previous transactions found for this merchant"

2. MERCHANT RESEARCH: Research this merchant using your knowledge base:
   - What is the full business name and what do they do?
   - What industry/sector do they operate in?
   - What products or services do they provide?
   - Are there multiple businesses with similar names?

3. CATEGORY ANALYSIS: Based on your research:
   - Does this merchant logically fit into any of my existing categories?
   - Consider semantic similarity (Food/Groceries, Tech/Software, etc.)
   - If no good fit exists, what new category would be most appropriate?

4. CONFIDENCE RATING: Rate your confidence and explain why

Provide detailed analysis for each step - this is for premium users who expect thorough research.
3. Which category best matches their business nature?
4. Have I used similar merchants before? (check patterns above)

Use your intelligence to categorize correctly.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const result = parseModelJson(response.choices[0].message.content);

    return {
      category: typeof result.category === 'string' && result.category.trim() ? result.category.trim() : 'Other',
      confidence: clampConfidence(result.confidence),
      reasoning: typeof result.reasoning === 'string' && result.reasoning ? result.reasoning : 'Unable to determine category'
    };
  } catch (error) {
    console.error('Error categorizing expense (fallback):', error);
    return {
      category: 'Other',
      confidence: 0.1,
      reasoning: 'Error occurred during categorization',
      failed: true,
    };
  }
}

export async function generateFinancialTips(
  userId: string,
  financialData: {
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
  },
  language: string = 'en-us'
): Promise<FinancialTip[]> {
  const normalizedLanguage = normalizeLanguageCode(language);
  try {
    // Initialize UnifiedAICache with 168 hours (7 days) TTL
    const cache = new UnifiedAICache('financial-tips', userId);
    const cacheKey = { ...financialData, language: normalizedLanguage };

    // Check cache first (unless bypassing with timestamp)
    if (!financialData.timestamp) {
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult) {

        return cachedResult;
      }
    } else {

    }
    const { totalIncome, totalExpenses, transactionsByCategory, recentTransactions } = financialData;

    // Prepare the financial summary for the model
    const netBalance = totalIncome - totalExpenses;
    const transactionCount = recentTransactions.length;
    
    const summary = `Financial Summary:
- Monthly Income: ${totalIncome}
- Monthly Expenses: ${totalExpenses}
- Net Balance: ${netBalance} ${netBalance < 0 ? '(DEFICIT)' : '(SURPLUS)'}
- Transaction Count: ${transactionCount}
- Raw Transactions Retrieved: ${recentTransactions.length}

Spending by Category:
${transactionsByCategory.filter(cat => cat.type === 'expense').map(cat => 
  `- ${cat.categoryName}: ${cat.amount} (${((cat.amount / totalExpenses) * 100).toFixed(1)}% of expenses)`
).join('\n')}

Income by Category:
${transactionsByCategory.filter(cat => cat.type === 'income').map(cat => 
  `- ${cat.categoryName}: ${cat.amount} (${((cat.amount / totalIncome) * 100).toFixed(1)}% of income)`
).join('\n')}

Recent Transactions (last 10):
${recentTransactions.slice(0, 10).map(t => 
  `- ${t.description}: ${t.amount} (${t.categoryName || 'Uncategorized'}) [${t.type}] on ${new Date(t.date).toLocaleDateString()}`
).join('\n')}

Transaction Pattern Analysis:
- Average transaction size: ${((totalIncome + totalExpenses) / Math.max(transactionCount, 1)).toFixed(2)}
- Income transactions: ${recentTransactions.filter(t => t.type === 'income').length}
- Expense transactions: ${recentTransactions.filter(t => t.type === 'expense').length}
- Date range: ${new Date(Math.min(...recentTransactions.map(t => new Date(t.date).getTime()))).toLocaleDateString()} to ${new Date(Math.max(...recentTransactions.map(t => new Date(t.date).getTime()))).toLocaleDateString()}

Generate 4 independent box analyses with exact mathematical calculations.`;

    // One prompt, one copy: lib/aiProvider sends it to the gateway first, then direct.
    const response = await generateProse({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content (analysis, insights, recommendations) must be in ${getLanguageLabel(normalizedLanguage)}.

You are an AI Financial Analyst providing premium-level insights. Your analysis must demonstrate these EXACT capabilities that users pay for:

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
- Long-term saving habits analysis
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

    const result = parseModelJson(response.choices[0].message.content);

    // Handle comprehensive analysis response. A model that answers in the wrong language
    // is not shown to the user: the localised fallback takes its place, and the drift is
    // reported so it can be fixed in the prompt rather than silently shipped.
    // Only a real model answer is worth keeping for a week; a stand-in is rebuilt every time.
    let cacheable = Boolean(result.title && result.description);
    const rawTips: FinancialTip[] = result.title && result.description ? [{
      title: result.title,
      description: result.description,
      category: result.category || 'comprehensive',
      priority: result.priority || 'high',
      actionable: Boolean(result.actionable),
      estimatedSaving: result.estimatedSaving || undefined,
      educational: Boolean(result.educational)
    }] : [financialTipsFallback(normalizedLanguage)];

    const processedTips: FinancialTip[] = rawTips.map((tip) => {
      const inLanguage = isTextInLanguage(`${tip.title} ${tip.description}`, normalizedLanguage);
      if (!inLanguage) {
        console.warn(
          `[AI] Replacing tips written in the wrong language (requested ${normalizedLanguage}): "${String(tip.title).slice(0, 60)}"`,
        );
        cacheable = false;
        return financialTipsFallback(normalizedLanguage);
      }
      return tip;
    });

    // Cache the result with 168 hours (7 days) TTL
    if (cacheable) await cache.set(cacheKey, processedTips, false, 168);
    
    return processedTips;
  } catch (error) {
    console.error('Error generating financial tips:', error);
    // Deterministic fallback, in the caller's language — never English on a Slovak screen.
    return [financialTipsFallback(normalizedLanguage)];
  }
}

export async function generateSpendingInsights(
  userId: string,
  transactions: Array<{
    description: string;
    amount: number;
    date: string;
    categoryName?: string;
    type: string;
  }>,
  language: string = 'en-us'
): Promise<Array<{
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
  const normalizedLanguage = normalizeLanguageCode(language);
  try {
    // Initialize UnifiedAICache with 72 hours TTL
    const cache = new UnifiedAICache('spending-insights', userId);
    const inputData = { transactions, language: normalizedLanguage };

    // Check cache first
    const cachedResult = await cache.get(inputData);
    if (cachedResult) {
      return cachedResult;
    }

    const expenseTransactions = transactions.filter(t => t.type === 'expense');

    if (expenseTransactions.length === 0) {
      return [];
    }

    const response = await generateProse({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content (title, description, category, recommendation) must be in ${getLanguageLabel(normalizedLanguage)}.

You are a financial analysis expert. Analyze spending transactions to identify patterns, trends, and insights.

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
  `- ${t.description}: ${t.amount} (${t.categoryName || 'Uncategorized'}) on ${t.date}`
).join('\n')}

Total transactions: ${expenseTransactions.length}
Date range: ${expenseTransactions[expenseTransactions.length - 1]?.date} to ${expenseTransactions[0]?.date}

Generate financial insights based on this spending data.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const result = parseModelJson(response.choices[0].message.content);
    const insights = Array.isArray(result) ? result : (Array.isArray(result.insights) ? result.insights : []);

    // An insight without a title or a body is not shown; no English placeholder takes its place.
    const processedInsights = insights
      .filter((insight: any) => insight
        && typeof insight.title === 'string' && insight.title.trim()
        && typeof insight.description === 'string' && insight.description.trim())
      .map((insight: any, index: number) => ({
      id: insight.id || `ai_insight_${index}`,
      type: ['warning', 'suggestion', 'achievement', 'trend'].includes(insight.type) ? insight.type : 'suggestion',
      title: insight.title,
      description: insight.description,
      impact: ['high', 'medium', 'low'].includes(insight.impact) ? insight.impact : 'medium',
      category: insight.category || undefined,
      amount: insight.amount || undefined,
      recommendation: insight.recommendation || undefined,
      actionable: Boolean(insight.actionable)
    }));

    // Cache the result with 72 hours TTL
    await cache.set(inputData, processedInsights, false, 72);
    
    return processedInsights;
  } catch (error) {
    // A provider failure is not "no insights": let the caller report it and cache nothing.
    console.error('Error generating spending insights:', error);
    throw error;
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
}, language: string = 'en-us'): Promise<{
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
    recommendations: Array<{
      action: string;
      impact: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    confidence: number;
  };
}> {
  try {
    const { summary, budgets, transactions, useAdvancedFactors } = financialData;
    
    // Create hash for caching
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    // Cache system removed
    // Cache system removed - direct processing only

    const response = await generateProse({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(language)}. ${getLanguageLabel(language) !== 'English' ? 'Never use English words.' : ''} ALL text content (status, factors, aiInsight, recommendations) must be in ${getLanguageLabel(language)}.

You are an advanced financial health AI that calculates personalized financial health scores using sophisticated analysis beyond traditional metrics.

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
- Income: ${summary.totalIncome}
- Expenses: ${summary.totalExpenses}
- Net Balance: ${summary.netBalance}

Transaction History (${transactions.length} transactions):
${transactions.slice(0, 20).map(t => 
  `- ${t.description}: ${t.amount} (${t.categoryName}) on ${t.date.split('T')[0]}`
).join('\n')}

Budgets: ${budgets.length} active budgets
Advanced Analysis: ${useAdvancedFactors ? 'Enabled' : 'Standard'}

Provide an AI-powered financial health score that adapts to this user's specific situation and spending patterns.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const result = parseModelJson(response.choices[0].message.content);
    // A reply with no score is a failed reply, not a score of 50.
    if (!Number.isFinite(Number(result.score))) {
      throw new AIResponseError('The health score reply had no score');
    }

    // Ensure score is properly bounded
    const score = Math.max(0, Math.min(100, Number(result.score)));
    
    // Determine category based on score (this ensures consistency)
    let category: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
    if (score >= 90) {
      category = 'excellent';
    } else if (score >= 70) {
      category = 'good';
    } else if (score >= 40) {
      category = 'fair';
    } else {
      category = 'poor';
    }
    
    const processedResult = {
      score,
      status: result.status || 'Fair',
      color: result.color || 'yellow',
      category, // Add the calculated category
      factors: result.factors || [],
      icon: result.icon || 'Shield',
      aiAnalysis: {
        personalizedFactors: result.aiAnalysis?.personalizedFactors || [],
        riskAssessment: result.aiAnalysis?.riskAssessment || '',
        recommendations: Array.isArray(result.aiAnalysis?.recommendations)
          ? result.aiAnalysis.recommendations.map((rec: any) => ({
              action: rec.action || rec.title || '',
              impact: rec.impact || rec.description || '',
              priority: rec.priority || 'medium'
            }))
          : [],
        confidence: Math.max(0, Math.min(1, result.aiAnalysis?.confidence || 0.7))
      }
    };

    // Cache the result in unified cache system
    // Cache system removed
    
    return processedResult;
  } catch (error) {
    // No invented "score 50": the caller reports the failure and nothing is cached.
    console.error('Error generating AI financial health score:', error);
    throw error;
  }
}

export async function generateTrendPredictions(
  userId: string,
  transactions: Array<{
    id: number;
    amount: string;
    description: string;
    date: string;
    type: string;
    categoryName: string;
  }>,
  budgets: Array<{ categoryName: string; amount: string; }> = [],
  language: string = 'en-us'
): Promise<{
  categoryPredictions: TrendPrediction[];
  financialForecast: FinancialForecast;
}> {
  const normalizedLanguage = normalizeLanguageCode(language);
  try {
    // Return zeros for empty data instead of AI-generated examples
    if (!transactions || transactions.length === 0) {
      const copy = emptyStateCopy(normalizedLanguage);
      return {
        categoryPredictions: [],
        financialForecast: {
          ...DEFAULT_FORECAST,
          keyInsights: [copy.forecastInsight],
          recommendations: [`${copy.forecastTitle}: ${copy.forecastDescription}`],
        }
      };
    }

    // Initialize UnifiedAICache with 48 hours TTL
    const cache = new UnifiedAICache('trend-predictions', userId);
    const inputData = { transactions, budgets, language: normalizedLanguage };

    // Check cache first
    const cachedResult = await cache.get(inputData);
    if (cachedResult) {
      return cachedResult;
    }

    // Prepare comprehensive financial data for AI analysis
    const monthlyData = new Map<string, { income: number; expenses: number; categories: Map<string, number> }>();
    const categoryTotals = new Map<string, number>();

    transactions.forEach(t => {
      const month = t.date.slice(0, 7);
      const category = t.categoryName || 'Other';
      const amount = parseFloat(t.amount);

      if (!monthlyData.has(month)) {
        monthlyData.set(month, { income: 0, expenses: 0, categories: new Map() });
      }

      const monthData = monthlyData.get(month);
      if (!monthData) return;

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
      budgets: budgets.map(b => ({ category: b.categoryName || 'Other', budgetAmount: parseFloat(b.amount) }))
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

    const response = await generateProse({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content (predictions, insights, analysis) must be in ${getLanguageLabel(normalizedLanguage)}.

You are an advanced financial forecasting AI that analyzes spending patterns and predicts future financial trends with high accuracy. Use sophisticated pattern recognition and statistical analysis to provide reliable predictions.`
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

    const result = parseModelJson(response.choices[0].message.content);

    const predictions = {
      categoryPredictions: Array.isArray(result.categoryPredictions) ? result.categoryPredictions : [],
      financialForecast: normalizeForecast(result.financialForecast),
    };

    // Cache the result with 48 hours TTL
    await cache.set(inputData, predictions, false, 48);
    
    return predictions;

  } catch (error) {
    // A provider failure is not "an empty forecast": let the caller report it and cache nothing.
    console.error('Error generating trend predictions:', error);
    throw error;
  }
}



export async function generateExpensePredictions(
  userId: string,
  transactions: Array<{
    id: number;
    amount: string;
    description: string;
    date: string;
    type: string;
    categoryName?: string;
    recurring?: boolean;
  }>,
  language: string = 'en-us'
): Promise<ExpensePrediction> {
  const normalizedLanguage = normalizeLanguageCode(language);
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

    // Initialize UnifiedAICache with 48 hours TTL
    const cache = new UnifiedAICache('expense-predictions', userId);
    const cacheInput = {
      language: normalizedLanguage,
      transactions: expenseTransactions.map(t => ({
        id: t.id,
        amount: t.amount,
        description: t.description,
        date: t.date,
        type: t.type,
        categoryName: t.categoryName,
        recurring: t.recurring
      }))
    };

    // Check cache first
    const cachedResult = await cache.get(cacheInput);
    if (cachedResult) {
      return cachedResult;
    }

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
      monthData.set(category, (monthData.get(category) || 0) + amount);
      
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

    const response = await generateProse({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content (predictions, analysis, insights) must be in ${getLanguageLabel(normalizedLanguage)}.

You are an advanced financial forecasting AI specializing in expense prediction analysis. You analyze spending patterns, identify trends, and generate accurate predictions based on historical transaction data. Focus on realistic, data-driven predictions with appropriate confidence levels.`
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

    const aiResponse = parseModelJson(response.choices[0].message.content);
    
    // Ensure all required fields are present with proper data types
    const categoryPredictions = Array.isArray(aiResponse.categoryPredictions) 
      ? aiResponse.categoryPredictions
      .filter((pred: any) => pred && typeof pred.category === 'string' && pred.category.trim())
      .map((pred: any) => ({
          category: pred.category,
          currentMonth: Number(pred.currentMonth) || 0,
          predictedNext: Number(pred.predictedNext) || 0,
          confidence: Number(pred.confidence) || 0.5,
          trend: pred.trend || 'stable',
          factors: Array.isArray(pred.factors) ? pred.factors : []
        }))
      : [];

    const monthlyPredictions = Array.isArray(aiResponse.monthlyPredictions)
      ? aiResponse.monthlyPredictions
      .filter((month: any) => month && typeof month.month === 'string' && month.month.trim())
      .map((month: any) => ({
          month: month.month,
          predicted: Number(month.predicted) || 0,
          confidence: Number(month.confidence) || 0.5,
          breakdown: Array.isArray(month.breakdown) ? month.breakdown : []
        }))
      : [];
    
    const finalResult = {
      categoryPredictions,
      monthlyPredictions
    };

    // Cache the result with 48 hours TTL
    await cache.set(cacheInput, finalResult, false, 48);
    
    return finalResult;

  } catch (error) {
    // A provider failure is not "no predictions": let the caller report it and cache nothing.
    console.error('Error generating expense predictions:', error);
    throw error;
  }
}

export async function generateDailyRecommendations(
  userId: string,
  financialData: {
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
  },
  language: string = 'en-us'
) {
  const normalizedLanguage = normalizeLanguageCode(language);
  try {
    // Initialize UnifiedAICache with 24 hours TTL
    const cache = new UnifiedAICache('daily-recommendations', userId);

    // Check cache first with language-aware key
    const cacheKey = { ...financialData, language: normalizedLanguage };
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }


    // Limit data to last 3 months and 100 transactions for efficiency
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const recentTransactions = financialData.transactions
      .filter(t => new Date(t.date) >= threeMonthsAgo)
      .slice(0, 100);

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

    const prompt = `You are a personal budgeting coach analyzing a user's spending patterns. Based on their financial data, provide personalized daily recommendations and insights.

Financial Summary:
- Total Income: ${(financialData.summary?.totalIncome || 0).toFixed(2)}
- Total Expenses: ${(financialData.summary?.totalExpenses || 0).toFixed(2)}
- Net Amount: ${(financialData.summary?.netAmount || 0).toFixed(2)}
- Recent Transactions: ${recentTransactions.length}
- Average Daily Spending: ${avgDailySpending.toFixed(2)}

Top Spending Categories:
${topCategories.map(([cat, amount]) => `- ${cat}: ${amount.toFixed(2)}`).join('\n')}

Budget Information:
${financialData.budgets.map(b => `- ${b.name}: ${b.amount} (${b.period})`).join('\n')}

Recent Transaction Sample:
${recentTransactions.slice(0, 10).map(t => 
  `- ${t.date}: ${t.type} ${t.amount} - ${t.description}`
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

    const response = await generateProse({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content (recommendations, insights, descriptions) must be in ${getLanguageLabel(normalizedLanguage)}.

You are an expert financial advisor who provides personalized, actionable recommendations based on real user data. Always return valid JSON.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      // 1000 tokens truncated the JSON mid-string ("Unterminated string"), which the
      // caller turned into an empty card. The prompt asks for tasks + insights + impact,
      // so give it room and keep the shape small.
      max_tokens: 2500,
      temperature: 0.3 // Moderate creativity for personalized recommendations
    });

    const aiResponse = parseModelJson(response.choices[0].message.content);
    
    // Ensure proper data structure
    const recommendations = Array.isArray(aiResponse.recommendations) 
      ? aiResponse.recommendations
      .filter((rec: any) => rec && typeof rec.title === 'string' && rec.title.trim())
      .map((rec: any, index: number) => ({
          id: rec.id || `rec-${index + 1}`,
          type: rec.type || 'general',
          priority: rec.priority || 'medium',
          title: rec.title,
          description: rec.description || '',
          action: rec.action || '',
          impact: rec.impact || '',
          timeToComplete: rec.timeToComplete || ''
        }))
      : [];

    const insights = Array.isArray(aiResponse.insights)
      ? aiResponse.insights
      .filter((insight: any) => insight && typeof insight.insight === 'string' && insight.insight.trim())
      .map((insight: any, index: number) => ({
          id: insight.id || `insight-${index + 1}`,
          insight: insight.insight,
          basedOn: insight.basedOn || '',
          confidence: Number(insight.confidence) || 0.7,
          timeframe: insight.timeframe || ''
        }))
      : [];

    const result = {
      recommendations,
      insights
    };

    // Cache the result with 24 hours TTL and language key
    await cache.set(cacheKey, result, false, 24);
    
    return result;

  } catch (error) {
    // A provider failure is not "no recommendations": let the caller report it and cache nothing.
    console.error('Error generating daily recommendations:', error);
    throw error;
  }
}

export async function generateContextualFinancialTips(
  userId: string,
  data: {
    summary: {
      totalIncome: number;
      totalExpenses: number;
      netBalance: number;
      transactionCount: number;
    };
    transactions: Array<{
      description: string;
      amount: number;
      category: string;
      categoryName?: string;
      date: string;
      type?: 'income' | 'expense';
      recurring?: boolean;
    }>;
    budgets: Array<{
      category: string;
      categoryName?: string;
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
  },
  language: string = 'en-us'
): Promise<{ tips: Array<{
  id: string;
  title: string;
  description: string;
  category: 'spending' | 'saving' | 'budgeting' | 'income';
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}> }> {
  const normalizedLanguage = normalizeLanguageCode(language);
  const { summary, transactions, budgets, goals = [], selectedMonth } = data;
  
  // Initialize UnifiedAICache with 72 hours TTL
  const cache = new UnifiedAICache('contextual-tips', userId, selectedMonth);
  
  try {

    // Check cache first with language-aware key
    const cacheKey = { ...data, language: normalizedLanguage };
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    // Return basic tip if no meaningful data
    if (transactions.length === 0 && summary.totalIncome === 0 && summary.totalExpenses === 0) {
      return {
        tips: [{
          id: 'basic_tip',
          title: emptyStateCopy(normalizedLanguage).firstTipTitle,
          description: emptyStateCopy(normalizedLanguage).firstTipDescription,
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
      if (t.amount > 0) {
        const category = t.category || t.categoryName || 'Uncategorized';
        const current = categorySpending.get(category) || 0;
        categorySpending.set(category, current + t.amount);
      }
    });
    
    const topSpendingCategories = Array.from(categorySpending.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Detailed transaction analysis
    const incomeTransactions = transactions.filter(t => t.type === 'income' || t.amount < 0);
    const expenseTransactions = transactions.filter(t => t.type === 'expense' || t.amount > 0);
    const recurringTransactions = transactions.filter(t => t.recurring);
    
    // Calculate transaction patterns
    const transactionFrequency = new Map();
    const dailySpending = new Map();
    
    expenseTransactions.forEach(t => {
      const day = new Date(t.date).getDate();
      const category = t.category || t.categoryName || 'Uncategorized';
      dailySpending.set(day, (dailySpending.get(day) || 0) + t.amount);
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
    
    // Check for budget overruns with detailed analysis ONLY if budgets exist
    if (budgets && Array.isArray(budgets) && budgets.length > 0) {
      budgets.forEach(budget => {
        const budgetCatName = budget.categoryName || budget.category || 'Uncategorized';
        if (budget.remaining < 0) {
          const overrunPercent = Math.abs((budget.remaining / budget.budgetAmount) * 100);
          const categoryTransactions = expenseTransactions.filter(t => t.categoryName === budgetCatName);
          const avgTransactionInCategory = categoryTransactions.length > 0 ? 
            categoryTransactions.reduce((sum, t) => sum + t.amount, 0) / categoryTransactions.length : 0;
          
          scenarios.push(`🟥 Budget overrun: You've exceeded your ${budgetCatName} budget by ${overrunPercent.toFixed(0)}% this month. Average transaction: ${avgTransactionInCategory.toFixed(2)}, Total transactions: ${categoryTransactions.length}`);
        } else if (budget.remaining < budget.budgetAmount * 0.1) {
          // Budget almost exhausted
          scenarios.push(`🟨 Budget warning: Only ${budget.remaining.toFixed(2)} remaining in your ${budgetCatName} budget (${((budget.remaining/budget.budgetAmount)*100).toFixed(0)}% left).`);
        }
      });
    }
    
    // Check savings rate scenarios with goal analysis
    if (savingsRate < 5 && summary.totalIncome > 0) {
      scenarios.push(`🟨 Low savings rate: Your savings rate is ${savingsRate.toFixed(1)}%. Consider revisiting your financial goals.`);
    } else if (savingsRate > 20) {
      scenarios.push(`🟩 Excellent savings: Great job! You're saving ${savingsRate.toFixed(1)}% of your income this month.`);
    }
    
    // Analyze goals progress ONLY if goals exist
    if (goals && Array.isArray(goals) && goals.length > 0) {
      goals.forEach(goal => {
        const progressPercent = (goal.currentAmount / goal.targetAmount) * 100;
        const daysToTarget = Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const monthlyNeeded = daysToTarget > 0 ? (goal.targetAmount - goal.currentAmount) / (daysToTarget / 30) : 0;
        
        if (progressPercent >= 90) {
          scenarios.push(`🟩 Goal achievement: You're ${progressPercent.toFixed(0)}% towards your ${goal.name} goal! Only ${(goal.targetAmount - goal.currentAmount).toFixed(2)} remaining.`);
        } else if (monthlyNeeded > netBalance) {
          scenarios.push(`🟨 Goal at risk: Your ${goal.name} goal needs ${monthlyNeeded.toFixed(2)}/month, but current monthly surplus is ${netBalance.toFixed(2)}.`);
        }
      });
    }
    
    // Check for irregular income patterns
    if (incomeTransactions.length > 0) {
      const incomeAmounts = incomeTransactions.map(t => Math.abs(t.amount));
      const avgIncome = incomeAmounts.reduce((sum, amt) => sum + amt, 0) / incomeAmounts.length;
      const incomeVariability = incomeAmounts.some(amt => Math.abs(amt - avgIncome) / avgIncome > 0.3);
      
      if (incomeVariability && incomeTransactions.length > 1) {
        scenarios.push(`🟦 Income variability: Your income shows fluctuation. Largest: ${Math.max(...incomeAmounts).toFixed(2)}, Smallest: ${Math.min(...incomeAmounts).toFixed(2)}. Consider setting aside a buffer.`);
      }
    }
    
    // Check for spending concentration and patterns
    topSpendingCategories.forEach(([category, amount]) => {
      const categoryPercent = (amount / summary.totalExpenses) * 100;
      const categoryFreq = transactionFrequency.get(category) || 0;
      
      if (categoryPercent > 40) {
        scenarios.push(`🟨 High category spending: ${category} represents ${categoryPercent.toFixed(0)}% of expenses (${amount.toFixed(2)} across ${categoryFreq} transactions).`);
      }
    });
    
    // Check for positive spending improvements
    if (expenseTransactions.length > 0) {
      const avgTransactionAmount = summary.totalExpenses / expenseTransactions.length;
      if (avgTransactionAmount < 30 && expenseTransactions.length > 15) {
        scenarios.push(`🟩 Controlled spending: Great job! You're averaging ${avgTransactionAmount.toFixed(2)} per transaction, showing mindful spending habits.`);
      }
    }
    
    // Check recurring transaction efficiency
    if (recurringTransactions.length > 0) {
      const recurringTotal = recurringTransactions.reduce((sum, t) => sum + t.amount, 0);
      const recurringPercent = (recurringTotal / summary.totalExpenses) * 100;
      scenarios.push(`🟦 Recurring expenses: ${recurringPercent.toFixed(0)}% of expenses are recurring (${recurringTotal.toFixed(2)} from ${recurringTransactions.length} transactions).`);
    }

    // Build detailed prompt with scenario analysis
    const prompt = `You are an expert personal budgeting coach analyzing a user's financial data for ${selectedMonth}. Provide 2-4 specific, actionable financial tips based on their actual data and identified scenarios.

FINANCIAL OVERVIEW:
- Total Income: ${summary.totalIncome.toLocaleString()}
- Total Expenses: ${summary.totalExpenses.toLocaleString()}
- Net Balance: ${netBalance.toLocaleString()}
- Savings Rate: ${savingsRate.toFixed(1)}%
- Number of Transactions: ${summary.transactionCount}

TOP SPENDING CATEGORIES:
${topSpendingCategories.map(([cat, amount]) => `- ${cat}: ${amount.toLocaleString()} (${((amount/summary.totalExpenses)*100).toFixed(1)}%)`).join('\n')}

BUDGET STATUS:
${budgets.length > 0 ? budgets.map((b: any) => `- ${b.categoryName || b.category || 'Uncategorized'}: ${b.spent.toLocaleString()}/${b.budgetAmount.toLocaleString()} (${b.remaining >= 0 ? 'under' : 'over'} budget by ${Math.abs(b.remaining).toLocaleString()}) - ${b.period || 'monthly'}`).join('\n') : '- No budgets set'}

FINANCIAL GOALS:
${goals.length > 0 ? goals.map(g => `- ${g.name}: ${g.currentAmount.toLocaleString()}/${g.targetAmount.toLocaleString()} (${((g.currentAmount/g.targetAmount)*100).toFixed(0)}% complete) - Target: ${g.targetDate}`).join('\n') : '- No goals set'}

TRANSACTION ANALYSIS:
- Total Transactions: ${transactions.length}
- Income Transactions: ${incomeTransactions.length}
- Expense Transactions: ${expenseTransactions.length}
- Recurring Transactions: ${recurringTransactions.length}
- Categorized Transactions: ${categorizedCount}/${transactions.length} (${transactions.length > 0 ? ((categorizedCount/transactions.length)*100).toFixed(0) : 0}%)
- Most Active Category: ${Array.from(transactionFrequency.entries()).sort((a,b) => b[1] - a[1])[0]?.[0] || 'None'} (${Array.from(transactionFrequency.entries()).sort((a,b) => b[1] - a[1])[0]?.[1] || 0} transactions)

IDENTIFIED FINANCIAL SCENARIOS:
${scenarios.length > 0 ? scenarios.join('\n') : '- No specific scenarios identified this month'}

RECENT TRANSACTIONS (last 8):
${transactions.slice(0, 8).map(t => `- ${t.date}: ${t.description} - ${t.amount.toLocaleString()} (${t.categoryName || 'Uncategorized'})${t.recurring ? ' [Recurring]' : ''}`).join('\n')}

CONTEXTUAL ANALYSIS REQUIREMENTS:
1. Address specific scenarios identified above with targeted, data-driven advice
2. For budget overruns: ONLY if budgets exist - Analyze transaction patterns and suggest specific reduction strategies
3. For goal progress: ONLY if goals exist - Calculate required monthly contributions and suggest optimization
4. For savings rate issues: Provide concrete steps with dollar targets based on their income
5. For spending patterns: Identify specific categories and transaction behaviors to modify
6. For income irregularities: Recommend buffer strategies based on their variability patterns
7. For positive improvements: Reinforce successful behaviors and suggest expansion strategies
8. Use their actual transaction data, amounts, and patterns in all recommendations
9. Provide specific dollar amounts, percentages, and realistic timeframes
10. Make every tip immediately actionable with clear, measurable next steps

CRITICAL: If no budgets are set, DO NOT mention budget overruns, budget comparisons, or budget-related advice. If no goals are set, DO NOT mention goal progress or goal-related recommendations. Focus only on spending patterns, categorization, and general financial health based on actual transaction data.

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

    const response = await generateProse({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content (tips, titles, descriptions) must be in ${getLanguageLabel(normalizedLanguage)}.

You are an expert financial advisor who provides personalized, contextual recommendations based on real user financial data. Always return valid JSON with actionable tips.`
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

    const aiResponse = parseModelJson(response.choices[0].message.content);
    
    // Ensure proper data structure. Every tip must be in the requested language; a tip
    // that is not (or a missing description, which used to default to English) is
    // replaced by the localised fallback instead of being shown to the user.
    const fallbackTip = progressTipFallback(normalizedLanguage);
    const rawTips = Array.isArray(aiResponse.tips) ? aiResponse.tips : [];
    const tips = rawTips
      .map((tip: any, index: number) => ({
        id: tip.id || `tip_${Date.now()}_${index}`,
        title: String(tip.title || ''),
        description: String(tip.description || ''),
        category: ['spending', 'saving', 'budgeting', 'income'].includes(tip.category) ? tip.category : 'budgeting',
        priority: ['high', 'medium', 'low'].includes(tip.priority) ? tip.priority : 'medium',
        actionable: Boolean(tip.actionable),
      }))
      .filter((tip: any) => {
        const ok =
          tip.title &&
          tip.description &&
          isTextInLanguage(`${tip.title} ${tip.description}`, normalizedLanguage);
        if (!ok) {
          console.warn(
            `[AI] Dropping a contextual tip written in the wrong language (requested ${normalizedLanguage}): "${String(tip.title).slice(0, 60)}"`,
          );
        }
        return ok;
      });

    if (tips.length === 0) {
      tips.push({ id: 'fallback_tip', ...fallbackTip });
    }


    
    // Cache the result for 72 hours with language key
    await cache.set(cacheKey, { tips }, false, 72);
    
    return { tips };

  } catch (error) {
    console.error('Error generating contextual financial tips (local fallback):', error);
    type ContextualTip = {
      id: string;
      title: string;
      description: string;
      category: 'spending' | 'saving' | 'budgeting' | 'income';
      priority: 'high' | 'medium' | 'low';
      actionable: boolean;
    };
    const fallbackResult: { tips: ContextualTip[] } = {
      tips: [{
        id: 'fallback_tip',
        ...progressTipFallback(normalizedLanguage),
      }]
    };
    
    // Cache even the fallback result to prevent repeated failures
    try {
      await cache.set(data, fallbackResult, true, 72);
    } catch (cacheError) {
      console.error('Failed to cache fallback result:', cacheError);
    }
    
    return fallbackResult;
  }
}

export async function generateFinancialHealthScore(
  userId: string,
  financialData: {
    transactions: Array<{
      id: number;
      amount: string;
      description: string;
      date: string;
      type: string;
      categoryName: string;
    }>;
    budgets: Array<{
      categoryName: string;
      amount: string;
      spent: number;
    }>;
    summary: {
      totalIncome: number;
      totalExpenses: number;
      netBalance: number;
    };
  },
  language: string = 'en-us'
): Promise<FinancialHealthData> {
  const normalizedLanguage = normalizeLanguageCode(language);
  try {
    const { transactions, budgets, summary } = financialData;
    
    // Initialize UnifiedAICache with 24 hours TTL
    const cache = new UnifiedAICache('financial-health-score', userId);
    
    // Create a more stable hash that focuses on significant financial changes
    // Exclude transaction IDs and exact timestamps to reduce cache misses
    const stableData = {
      language: normalizedLanguage,
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
    
    // Check cache first
    const cachedResult = await cache.get(stableData);
    if (cachedResult) {
      return cachedResult;
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

    const response = await generateProse({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content (status, factors, aiInsight, recommendations) must be in ${getLanguageLabel(normalizedLanguage)}.

You are an advanced financial health AI that calculates personalized financial health scores using sophisticated analysis beyond traditional metrics.

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
- Income: ${summary.totalIncome}
- Expenses: ${summary.totalExpenses}
- Net Balance: ${summary.netBalance}

Transaction History (${recentTransactions.length} transactions):
${recentTransactions.slice(0, 20).map(t => 
  `- ${t.description}: ${t.amount} (${t.categoryName}) on ${t.date.split('T')[0]}`
).join('\n')}

Budgets: ${budgets.length} active budgets

Provide an AI-powered financial health score that adapts to this user's specific situation and spending patterns.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const result = parseModelJson(response.choices[0].message.content);
    // A reply with no score is a failed reply, not a score of 50.
    if (!Number.isFinite(Number(result.score))) {
      throw new AIResponseError('The health score reply had no score');
    }

    const processedResult = {
      score: Math.max(0, Math.min(100, Number(result.score))),
      status: result.status || 'Fair',
      color: result.color || 'yellow',
      factors: result.factors || [],
      icon: result.icon || 'Shield',
      aiAnalysis: {
        personalizedFactors: result.aiAnalysis?.personalizedFactors || [],
        riskAssessment: result.aiAnalysis?.riskAssessment || '',
        recommendations: result.aiAnalysis?.recommendations || [],
        confidence: Math.max(0, Math.min(1, result.aiAnalysis?.confidence || 0.7))
      }
    };

    // Convert to frontend-expected format
    const healthData: FinancialHealthData = {
      score: processedResult.score,
      trend: 'stable', // Default trend
      category: processedResult.status.toLowerCase() === 'excellent' ? 'excellent' :
                processedResult.status.toLowerCase() === 'good' ? 'good' :
                processedResult.status.toLowerCase() === 'fair' ? 'fair' : 'poor',
      insights: Array.isArray(processedResult.aiAnalysis?.personalizedFactors) ? processedResult.aiAnalysis.personalizedFactors : [],
      achievements: Array.isArray(processedResult.factors) ? processedResult.factors.filter((f: any) => f.status === 'good').map((f: any) => f.aiInsight).filter(Boolean) : [],
      warnings: Array.isArray(processedResult.aiAnalysis?.recommendations) ? processedResult.aiAnalysis.recommendations : []
    };

    // Cache the result with 24 hours TTL
    await cache.set(stableData, healthData, false, 24);
    
    return healthData;
  } catch (error) {
    console.error('Error generating financial health score:', error);
    
    // Return fallback data based on simple calculations
    const { summary } = financialData;
    const savingsRate = summary.totalIncome > 0 ? 
      (summary.totalIncome - summary.totalExpenses) / summary.totalIncome : 0;
    
    let score = 50;
    let category: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
    
    const healthCopy = healthFallbackCopy(normalizedLanguage);

    // Use proper score-based thresholds for category determination
    if (savingsRate > 0.2) {
      score = 92; // Set to 92 for excellent savings rate
      category = 'excellent';
    } else if (savingsRate > 0.1) {
      score = 75;
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
      insights: [healthCopy.unavailable],
      achievements: summary.netBalance > 0 ? [healthCopy.positiveBalance] : [],
      warnings: summary.netBalance < 0 ? [healthCopy.expensesExceedIncome] : [],
      degraded: true,
    };
  }
}

/**
 * Parse bank statement text and extract transactions using AI - Server Fallback
 * This function mirrors the external AI processor for when external service is unavailable
 */
export async function voiceExtraction(
  userId: string,
  payload: { prompt: string; language?: string },
  plan: string = 'free'
): Promise<string> {
  const prompt = payload.prompt;
  const language = payload.language || 'en-us';
  const normalizedLanguage = normalizeLanguageCode(language);
  try {
    // Mistral first (fast, cheap), then the shared fallback chain. Everything goes through
    // lib/aiProvider, so the gateway and the anonymiser see it like every other call.
    const response = await openai.chat.completions.create({
      model: AI_MODELS.voice,
      messages: [
        {
          role: "system",
          content: `You are a JSON extraction AI. Respond ONLY with valid JSON. No explanations, no markdown, no code blocks.
CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)} for all text fields (vendor, description, categoryName, ambiguities, followUpQuestions).`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 500
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Voice extraction error (openai.ts fallback):', error);
    throw new Error('Failed to extract voice transaction data');
  }
}

export async function parseBankStatement(text: string, language: string = 'en-us'): Promise<{ transactions: any[] }> {
  const languageLabel = getLanguageLabel(language);

  try {
    // SECURITY: Never cache bank statement data - process fresh every time

    const bankStatementPrompt = `You are an expert financial data extraction system specialized in bank statement analysis. 

CRITICAL MISSION: Extract ALL transactions with 100% accuracy from bank statement text.
CRITICAL: You MUST respond exclusively in ${languageLabel}. ${languageLabel !== 'English' ? 'Never use English words.' : ''}

MANDATORY JSON OUTPUT FORMAT:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Transaction description in ${languageLabel}",
      "amount": 123.45,
      "type": "income" or "expense",
      "confidence": 0.95,
      "rawText": "Original text from statement",
      "detectedFormat": "Format type detected"
    }
  ]
}

EXTRACTION RULES:
1. Date Formats: Support DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, and text dates
2. Amount Detection: Handle various currency symbols (€, $, £, Kč) and number formats
3. Transaction Types: income (deposits, transfers in, salary) vs expense (payments, transfers out, fees)
4. Description: Clean merchant/payee names, remove bank codes
5. Confidence: 0.9+ for clear transactions, 0.7-0.9 for moderate clarity, <0.7 for unclear
6. Skip: Header/footer text, account summaries, balance information

CRITICAL QUALITY STANDARDS:
- Zero missed transactions
- 100% accurate date parsing
- Correct positive/negative amount handling
- Clean, readable descriptions in ${languageLabel}
- High confidence scores for clear data

Respond ONLY with valid JSON. No explanations or additional text.`;

    const response = await openai.chat.completions.create({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: bankStatementPrompt
        },
        {
          role: "user",
          content: `Please analyze this bank statement text and extract all transactions:\n\n${text}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = parseModelJson(response.choices[0].message.content);
    
    if (result.transactions && Array.isArray(result.transactions)) {
      const formattedResult = {
        transactions: result.transactions.map((tx: any) => ({
          date: tx.date || '',
          description: tx.description || '',
          amount: parseFloat(tx.amount) || 0,
          type: tx.type || 'expense',
          confidence: tx.confidence || 0.8,
          rawText: tx.rawText || '',
          detectedFormat: tx.detectedFormat || 'unknown',
          category: null // Will be filled by categorization
        }))
      };

      // SECURITY: Never cache bank statement results - return immediately
      return formattedResult;
    }

    return { transactions: [] };

  } catch (error) {
    console.error('Bank statement parsing error (server fallback):', error);
    throw new Error('Failed to parse bank statement transactions');
  }
}