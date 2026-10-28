import { UnifiedAICache } from "../lib/unifiedAICache";
import { getLanguageLabel, normalizeLanguageCode } from "../lib/languageUtils";
import { createRoutedClient, AI_MODELS } from "../lib/aiProvider";
import {
  emptyStateCopy,
} from "../shared/aiFallbacks";
import {
  AIResponseError,
  clampConfidence,
  finiteNumber,
  parseModelJson,
  validCategoryId,
} from "../shared/aiResults";
import { log } from './logger';

// All model calls go through lib/aiProvider: the ai-processor gateway first, then OpenAI
// directly (DeepSeek/Groq behind it), with JSON fence stripping and real token/cost accounting.
// The prompts in this file are the only copy: the gateway never holds a Kaptia prompt.
const openai = createRoutedClient();

/**
 * A yyyy-MM label, `offset` months from today, for the JSON examples inside prompts.
 *
 * The examples used to name fixed months (2025-01, 2025-07): a model copying the shape can
 * copy the year too, and a forecast for a year that has already passed is worse than no
 * forecast. The examples now always show the months the answer should cover.
 */
function monthLabel(offset: number): string {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * House rules for every answer a person reads (tips, insights, scores, forecasts).
 * Not applied to extraction or categorisation, where a merchant may really be a bank.
 */
export const PROSE_RULES = `HOUSE RULES (always apply):
- Kaptia is a personal budgeting tool, not a licensed financial service. Never present yourself as an advisor or adviser.
- Do not recommend investments, loans, credit products or banks, and do not use the words bank, loan, credit, invest or advisor (or their Spanish or Slovak equivalents).
- Amounts are in the person's own currency. Never add a currency symbol or name unless one appears in the data.
- Every percentage is computed from the data. If the data cannot support a comparison, do not make one.
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

/**
 * The adviser prompt.
 *
 * WHY IT IS NOT A SCORING PROMPT ANY MORE
 * ---------------------------------------
 * This function was built as a score generator: four weighted factors, one sentence each, plus a
 * risk line. The app now computes the score itself (`shared/financialHealth`), so what was left
 * reached the screen as four statistics - "expenses were 3,222.97 against income of 7,000" - under
 * a card called *Financial Advisor*. That is a report, not advice, and the name promised advice.
 *
 * WHY THIS IS THE ONLY ADVICE PROMPT
 * ----------------------------------
 * Three other panels also asked a model for advice (contextual tips, daily recommendations, the
 * premium "tip" card). Each had a fragment of the picture and none had the whole: budgets without
 * spend, goals without categories, a month without the person's own history. They have been
 * removed, and what was worth keeping from them is here: the scenario analysis and the goal pace
 * from the tips, the "one focus, every figure checkable" discipline from the tip card, and the
 * action/reason/impact shape. This is a Premium feature, so the answer is expected to be a plan,
 * not a paragraph.
 */
export const FINANCIAL_ADVISOR_PROMPT_VERSION = 'financial-advisor@2';

export function financialAdvisorPrompt(languageLabel: string): string {
  return `CRITICAL: You MUST respond exclusively in ${languageLabel}. ${languageLabel !== 'English' ? 'Never use English words.' : ''} ALL text content (summary, observations, recommendations, risk) must be in ${languageLabel}.

You are the financial adviser inside a personal finance app. You are the one place this person is
given advice, and it is a paid feature: the answer must be worth paying for.

You receive one month of their money as facts the app has already computed: income, expenses, every
spending category with its share and the person's own three-month average, every budget with its
limit and what has been spent against it, their savings goals with the pace each one needs to be
met, and their recurring payments. Do not re-derive those numbers and do not read them back. Use
them to decide what this person should change.

WHAT SEPARATES ADVICE FROM A REPORT
- A report says "you spent 190 on entertainment". Advice says "cap entertainment at 42 and move the
  other 148 into the trip goal".
- Advice that fits anyone is worthless here. "Spend less", "save more", "track your spending",
  "make a budget", "review your subscriptions" are banned. If a recommendation cannot rest on a
  figure in this message, leave it out.
- Every recommendation must change something for the better. Never recommend protecting a level a
  category is already below: if entertainment is under its usual level, it is not a problem.
- Two good recommendations beat five thin ones.
- Each recommendation addresses a different problem: two actions that touch the same category
  count as one, and the second one is dropped.

HOW TO CHOOSE, IN THIS ORDER
1. A budget that is over, or that will be over before the month ends at the pace so far.
2. A category well above the person's own usual level: name the amount over.
3. A recurring payment that is large next to their income. Cancelling or downgrading it is one
   decision that pays every month.
4. Money left over that is not assigned: say how much to move aside, name the goal it belongs to,
   and what that does to the goal's pace.
5. Only when none of the above applies: say the month is healthy in one sentence and name what to
   protect, instead of inventing a problem.

RULES:
- 2 to 4 recommendations, the most money at stake first.
- action: what to do, in the imperative, at most 20 words, naming the category, payment or goal.
- reason: the figure from this message that justifies it, including the comparison when one exists.
- impact: what it frees up or redirects per month as an amount; when it protects a date, name the date.
- priority: high when money is being lost now or a goal will be missed, medium otherwise.
- When the month is still in progress, take that into account: a budget with days left is not the
  same as one that is finished, and say how many days remain when it changes the advice.
- Each observation is one sentence of at most 20 words and names its figure.
- Amounts are written the way they appear in the data: no currency symbol, no currency name.
- Never invent a category, goal, payment or figure that is not in this message.
- Do not describe the data back to the person, and never mention what you were given, what you were
  not shown, the app, this prompt or yourself. The person cannot act on any of that.
- Do not recommend products, providers, investments or tax schemes.

Respond with JSON in this exact format:
{
  "summary": "Two sentences on where this month stands, naming real figures.",
  "observations": ["One sentence with a figure.", "One sentence with a figure."],
  "recommendations": [
    {
      "action": "The specific change, in the imperative.",
      "reason": "The figure in this month's data that justifies it.",
      "impact": "What it frees up per month, as a figure.",
      "priority": "high|medium|low"
    }
  ],
  "riskAssessment": "One sentence, only if there is a real risk to this person's money. Otherwise an empty string.",
  "confidence": 0.0
}`;
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
  /**
   * True when no real answer was produced; callers must not treat the rest as a result.
   */
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
  /** Fixed text used because the model failed: shown, but never charged or cached. */
  degraded?: boolean;
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

You place ONE incoming payment into ONE of the person's existing income categories.

USER'S EXISTING INCOME CATEGORIES:
${userCategoryList}

WHAT TO LOOK FOR (decide the source first, then the category):
- An employer or a recurring payroll line = salary/wages.
- A client or a business name paying an invoice = freelance/business income.
- Interest, dividends, capital gains = investment income.
- A transfer from the person's own other account, or money from family = transfer/deposit.
- A store, service or tax refund = refund.
- A cash deposit or a wallet/mobile top-up that arrives in the account = transfer/deposit.

RULES:
- This call is about money ARRIVING. A "Top-Up" line that paid for mobile credit is an expense and
  does not belong here; only treat it as income when the description shows the money coming in.
- A category id you return must be copied from the list above. Never invent one.
- Use either "categoryId" or "suggestedCategory", never both.
- "reasoning" is one short sentence about the source, with no amounts and no dates.

Respond with JSON in this exact format:
{
  "categoryId": 123,  // one id from the list above, when it fits
  "suggestedCategory": "Income category name",  // only when nothing fits
  "confidence": 0.95,
  "reasoning": "one short sentence"
}`
        },
        {
          role: "user",
          content: `Income Description: "${description}"
Amount: +${amount}

This movement is money arriving in the account. Identify the source, then choose the category:
- An amount with the person's own name or their other account = transfer between own accounts.
- A company name paid on a regular day of the month = salary.
- A one-off company name with an invoice reference = client payment.
- A short line containing "interest", "dividend" or "refund" = follow that word.

Only answer from the description. If the source cannot be identified, use the closest existing
category and lower the confidence instead of guessing a specific one.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    return toCategoryChoice(parseModelJson(response.choices[0].message.content), userCategories);
  } catch (error) {
    log.error('Error categorizing income with user categories:', error);
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

You place ONE card transaction into ONE of the person's existing categories.

USER'S EXISTING CATEGORIES:
${userCategoryList}

HOW TO DECIDE (in this order):
1. Merchant first. Read the merchant name in the description and decide what the business is: a supermarket chain is groceries, a fuel station is transport, a streaming service is entertainment, a phone or internet bill is bills/utilities, an ATM line is cash.
2. Then pick ONE category from the list above whose meaning fits that business type. Prefer the more specific category over a general one.
3. Be consistent: the same merchant must always land in the same category. If the merchant name suggests a person (a surname), decide from the context words around it rather than assuming a restaurant.
4. Only when nothing above fits, suggest ONE new short category name (1-2 words, same language) in "suggestedCategory".

RULES:
- A category id you return must be copied from the list above. Never invent one.
- Use either "categoryId" or "suggestedCategory", never both.
- Keep the merchant name as it is printed; only the category name follows the app language.
- "reasoning" is one short sentence about the business type, with no amounts and no dates.

Respond with JSON in this exact format:
{
  "categoryId": 123,  // one id from the list above, when it fits
  "suggestedCategory": "New category name",  // only when nothing fits
  "confidence": 0.95,
  "reasoning": "one short sentence"
}`
        },
        {
          role: "user",
          content: `Transaction Description: "${description}"
Amount: ${amount}

Decide in three steps:
1. What business is behind this merchant name?
2. Which of the categories above means that business?
3. If none of them does, what is one short name for the missing category?

Some merchants are ambiguous, so use the words around the name, not just the name:
- a surname alone is not automatically a restaurant (it can be a repairman, a doctor, a landlord);
- "Top-Up" can be a mobile credit purchase (a bill) or money added to an account (a transfer) -
  read the rest of the description to tell which.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    return toCategoryChoice(parseModelJson(response.choices[0].message.content), userCategories);
  } catch (error) {
    log.error('Error categorizing expense with user categories:', error);
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

Answer in four short steps, one line each:
1. What business is behind this merchant name?
2. Is this merchant already in the person's merchant patterns above? If yes, the same category must be used.
3. Which existing category fits best? If none fits, what is one short name for a new one?
4. How confident are you, and what in the description would change your mind?

The merchant patterns above are the only history available in this conversation. Do not claim to
have looked at transactions that are not listed, and do not state how many times a merchant was
used unless it appears there.`
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
    log.error('Error categorizing expense (fallback):', error);
    return {
      category: 'Other',
      confidence: 0.1,
      reasoning: 'Error occurred during categorization',
      failed: true,
    };
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

You write short insight cards about one person's spending.

Write 2 to 4 insights. Each one must be true of the transactions listed in this message:
- every amount and percentage is computed from those rows, never estimated and never taken from a
  typical month;
- a comparison ("up 40 % this month") is only allowed when both sides of it are in the rows you
  were given. If they are not, describe what is there instead;
- when the rows are only a sample of a longer list, say so in the insight rather than implying it
  is everything.

Each insight has:
- a unique id
- type: warning, suggestion, achievement or trend
- a title of at most 8 words and a body of at most 3 sentences
- impact: high, medium or low
- the category and the amount it is about, when that makes it clearer
- one recommendation the person can act on, and whether it is actionable

Return ONE JSON object that contains an "insights" array (never a bare array, never prose):
{
  "insights": [
    {
      "id": "insight_1",
      "type": "warning",
      "title": "Short title",
      "description": "What the rows show, naming the figure it rests on.",
      "impact": "high",
      "category": "Category name from the rows",
      "amount": 0,
      "recommendation": "One action",
      "actionable": true
    }
  ]
}`
        },
        {
          role: "user",
          content: `Expense rows${expenseTransactions.length > 20
            ? ` (these are the 20 most recent of ${expenseTransactions.length}; the others are not in this message)`
            : ` (all ${expenseTransactions.length} of them)`}:

${expenseTransactions.slice(0, 20).map(t => 
  `- ${t.description}: ${t.amount} (${t.categoryName || 'Uncategorized'}) on ${t.date}`
).join('\n')}

Date range of the rows above: ${expenseTransactions[Math.min(20, expenseTransactions.length) - 1]?.date} to ${expenseTransactions[0]?.date}

Write the insights from these rows only.`
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
    log.error('Error generating spending insights:', error);
    throw error;
  }
}

export async function generateAIFinancialHealthScore(financialData: {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
  };
  budgets: Array<{ categoryName?: string | null; amount: string | number; spent?: number | string }>;
  transactions: Array<{
    description: string;
    amount: number;
    date: string;
    categoryName: string;
    type: string;
  }>;
  /**
   * One line per spending category, with the person's own usual level beside it, so the advice can
   * say "twice your usual" instead of only naming a total.
   */
  categories?: Array<{
    name: string;
    amount: number;
    share: number;
    purchases: number;
    average: number;
    previousAverage?: number | null;
  }>;
  /** The largest single payments of the month, for advice about a specific charge. */
  topMerchants?: Array<{ description: string; amount: number; count: number }>;
  /** The person's own savings goals, with the pace each one needs. */
  goals?: Array<{
    name: string;
    target: number;
    saved: number;
    remaining: number;
    progress: number;
    monthsLeft: number | null;
    monthlyNeeded: number | null;
  }>;
  /** Payments the person flagged as repeating: the cheapest money to free up. */
  recurring?: Array<{ description: string; amount: number; count: number }>;
  /** The days every figure below covers, and whether the month is over. */
  period?: { start: string; end: string; status?: string; daysLeft?: number };
}, language: string = 'en-us'): Promise<{
  /**
   * Not produced by the model any more: `shared/financialHealth` scores the month and the caller
   * owns that number. Kept in the shape so the older endpoint still answers with one object.
   */
  score: number;
  status: string;
  color: string;
  category: 'excellent' | 'good' | 'fair' | 'poor';
  factors: Array<{ name: string; score: number; max: number; status: string; aiInsight?: string }>;
  icon: string;
  aiAnalysis: {
    /** The month in two sentences, from the model. */
    summary: string;
    /** Sentences about the money, each resting on a figure. */
    personalizedFactors: string[];
    riskAssessment: string;
    /** The advice itself: what to change, why, and what it frees up. */
    recommendations: Array<{
      action: string;
      reason: string;
      impact: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    confidence: number;
  };
}> {
  try {
    const { summary, budgets, transactions, categories, topMerchants, goals, recurring, period } = financialData;

    const savingsShare = summary.totalIncome > 0
      ? Math.round((summary.netBalance / summary.totalIncome) * 100)
      : null;

    const categoryLines = (categories ?? []).length > 0
      ? (categories ?? []).map((category) => {
          const usual = typeof category.previousAverage === 'number' && category.previousAverage > 0
            ? `, usually ${category.previousAverage.toFixed(2)}`
            : '';
          return `- ${category.name}: ${category.amount.toFixed(2)} (${category.share.toFixed(1)}% of expenses), ${category.purchases} payment(s), average ${category.average.toFixed(2)}${usual}`;
        }).join('\n')
      : '- no categorised expenses in this period';

    const budgetLines = budgets.length > 0
      ? budgets.map((budget) => {
          const spent = Number(budget.spent ?? 0);
          const limit = Number(budget.amount ?? 0);
          const gap = spent - limit;
          const verdict = limit > 0 && gap > 0 ? `, over by ${gap.toFixed(2)}` : '';
          return `- ${budget.categoryName || 'Uncategorized'}: limit ${limit.toFixed(2)}, spent ${spent.toFixed(2)}${verdict}`;
        }).join('\n')
      : 'none set';

    const merchantLines = (topMerchants ?? [])
      .map((merchant) => `- ${merchant.description}: ${merchant.amount.toFixed(2)}${merchant.count > 1 ? ` over ${merchant.count} payments` : ''}`)
      .join('\n');

    /*
     * Goals and recurring payments, as facts with their arithmetic done.
     *
     * A goal with no pace is a wish: "3,000 for the trip" says nothing about whether it will be
     * reached. The pace is computed on the server, so the advice can say "move 300 into the trip and
     * it lands in six months" instead of "consider saving".
     */
    const goalLines = (goals ?? [])
      .map((goal) => {
        const pace = goal.monthlyNeeded !== null
          ? `, needs ${goal.monthlyNeeded.toFixed(2)} a month for ${goal.monthsLeft} more month(s)`
          : ', no target date';
        return `- ${goal.name}: ${goal.saved.toFixed(2)} of ${goal.target.toFixed(2)} (${goal.progress}%), ${goal.remaining.toFixed(2)} left${pace}`;
      })
      .join('\n');

    const recurringLines = (recurring ?? [])
      .map((payment) => `- ${payment.description}: ${payment.amount.toFixed(2)}${payment.count > 1 ? ` over ${payment.count} payments` : ''}`)
      .join('\n');

    const recentLines = transactions
      .slice(0, 25)
      .map(t => `- ${t.description}: ${t.amount} (${t.categoryName}) on ${t.date.split('T')[0]}`)
      .join('\n');

    const response = await generateProse({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: financialAdvisorPrompt(getLanguageLabel(language))
        },
        {
          role: "user",
          content: `${period ? `Month: ${period.start} to ${period.end}${period.status ? ` (${period.status}${period.daysLeft ? `, ${period.daysLeft} day(s) left` : ''})` : ''}` : 'Month: the recent period'}
Income: ${summary.totalIncome}
Expenses: ${summary.totalExpenses}
Left over: ${summary.netBalance}${savingsShare !== null ? ` (${savingsShare}% of income)` : ''}

Spending by category:
${categoryLines}

Budgets (limit / spent):
${budgetLines}

Savings goals (saved of target, and the pace each one needs):
${goalLines || 'none set'}
${merchantLines ? `\nLargest payments:\n${merchantLines}\n` : ''}${recurringLines ? `\nRecurring payments (the person flagged these as repeating):\n${recurringLines}\n` : ''}
Recent payments:
${recentLines || '- none'}

Write this month's advice.`
        }
      ],
      response_format: { type: "json_object" },
      // Advice that quotes exact figures still needs constraining, but a little more freedom than a
      // scorecard: the change worth recommending is not always the largest category.
      temperature: 0.4
    });

    const result = parseModelJson(response.choices[0].message.content);

    /*
     * No score is read from the reply any more. The app scores the month
     * (`shared/financialHealth`) so the badge on this panel and the score card beside it are the
     * same number; a model's own total would only be a second opinion nobody can check.
     *
     * What is read is the advice, and a reply without any is a failed reply: an empty advice panel
     * under a card called "Financial Advisor" is worse than an error the caller can retry.
     */
    const analysis = result.aiAnalysis && typeof result.aiAnalysis === 'object' ? result.aiAnalysis : {};
    const rawRecommendations = Array.isArray(result.recommendations)
      ? result.recommendations
      : Array.isArray(analysis.recommendations)
        ? analysis.recommendations
        : [];

    const recommendations = rawRecommendations
      .map((rec: any) => (typeof rec === 'string'
        ? { action: rec.trim(), reason: '', impact: '', priority: 'medium' as const }
        : {
            action: String(rec?.action || rec?.title || '').trim(),
            reason: String(rec?.reason || rec?.because || '').trim(),
            impact: String(rec?.impact || rec?.saving || '').trim(),
            priority: (rec?.priority === 'high' || rec?.priority === 'low' ? rec.priority : 'medium') as 'high' | 'medium' | 'low',
          }))
      .filter((rec: { action: string }) => rec.action.length > 0);

    if (recommendations.length === 0) {
      throw new AIResponseError('The advice reply had no recommendations');
    }

    return {
      // The caller owns the number; these fields keep the older response shape intact.
      score: 0,
      status: '',
      color: '',
      category: 'fair',
      factors: [],
      icon: 'Shield',
      aiAnalysis: {
        summary: typeof result.summary === 'string' ? result.summary.trim() : '',
        personalizedFactors: (() => {
          const observations = textList(result.observations);
          return observations.length > 0 ? observations : textList(analysis.personalizedFactors);
        })(),
        riskAssessment: typeof result.riskAssessment === 'string' ? result.riskAssessment.trim() : '',
        recommendations,
        confidence: Math.max(0, Math.min(1, Number(result.confidence ?? analysis.confidence ?? 0.7)))
      }
    };
  } catch (error) {
    // No invented example: the caller reports the failure and nothing is cached.
    log.error('Error generating financial advice:', error);
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
        {"month": "${monthLabel(0)}", "predicted": 0, "confidence": 0.9}
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

Analysis requirements:
- Predict only from the monthly rows in the data: the person's own averages, their own trend and
  their own repeated (recurring) expenses.
- If the data covers fewer than three months, do not invent a trend: return an empty
  categoryPredictions list and say in keyInsights that more months are needed.
- At most the five largest categories by amount. Do not flatten a one-off purchase into a monthly
  trend, but do not drop it from the totals either.
- Confidence reflects how much history is behind the number, not how sure the wording sounds.
- Do not mention inflation, interest rates, the economy or world events: none of that is in the
  data, and a personal budget cannot act on it.
- Every amount in the answer is a number from the data, or a value computed from it.`;

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
      // A 3-month forecast per category does not fit in 2000 tokens once there are several
      // categories; the reply used to be cut mid-string and the card came back empty.
      max_tokens: 3000,
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
    log.error('Error generating trend predictions:', error);
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

    /*
     * The reply has a token budget, and the old prompt asked for more than fits in it.
     *
     * It wanted one entry per category, each with three explanation strings, plus three monthly rows
     * that each carried a per-category breakdown. With fourteen categories that is roughly 1,600
     * tokens of JSON against a 1,500-token limit, so the answer was cut mid-string and every call
     * ended as "the model reply was not valid JSON" - which the customer saw as "Failed to generate
     * predictions". The breakdown was never rendered by the card either.
     *
     * What it asks for now is what the card shows: at most eight categories, two short factors each,
     * and three monthly totals.
     */
    const prompt = `Analyze this expense data and predict future spending.

EXPENSE ANALYSIS DATA:
${JSON.stringify(analysisData, null, 2)}

WHAT TO RETURN:
- At most 8 categories: the largest by amount. Skip categories that are a trivial share of spending.
- Exactly 3 monthly totals, in the order shown.
- Every amount is computed from the data above, never invented. When there is too little history the
  confidence is low; the amount is never guessed.

RESPONSE FORMAT (JSON):
{
  "categoryPredictions": [
    {
      "category": "Food & Dining",
      "currentMonth": 450.00,
      "predictedNext": 475.00,
      "confidence": 0.85,
      "trend": "increasing",
      "factors": ["Two months of higher spending", "Recurring payment counted"]
    }
  ],
  "monthlyPredictions": [
    { "month": "${monthLabel(1)}", "predicted": 2150.00, "confidence": 0.80 }
  ]
}

GUIDELINES:
- Use the person's own patterns: their averages, their own trend, their recurring expenses.
- Confidence must match the history: one month is 0.5 at best, three months 0.75, six months or more
  0.9. Never above 0.95.
- At most 2 factors per category, each under 12 words.
- Do not claim a seasonal pattern from less than a year of data.
- Do not describe the data back to the person, and never mention what you were given or what you were
  not shown.
- Every numeric value must be present (no null).`;

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
      // The same lesson the trend forecast learned: eight categories with factors plus three monthly
      // rows does not fit in 1,500 tokens, and a reply cut at the limit is not a transient error the
      // caller can retry - it fails every time until the budget is fixed.
      max_tokens: 3000,
      temperature: 0.2 // Low temperature for consistent financial predictions
    });

    /*
     * When a reply cannot be read, record how it broke: a reply cut at the token limit and a reply
     * written as prose need different fixes, and the length is the difference between them. The
     * content itself is never logged - it holds the person's categories and amounts.
     */
    let aiResponse;
    try {
      aiResponse = parseModelJson(response.choices[0].message.content);
    } catch (parseError) {
      log.error('Expense predictions: unreadable reply', {
        finishReason: response.choices[0].finish_reason,
        characters: (response.choices[0].message.content || '').length,
      });
      throw parseError;
    }
    
    // Ensure all required fields are present with proper data types
    // Confidence cannot exceed what the history supports: the prompt asks for that, and this cap
    // enforces it, so a single month of data never looks like a 0.9 prediction.
    const monthsOfHistory = monthlyData.size;
    const confidenceCap = monthsOfHistory >= 6 ? 0.95 : monthsOfHistory >= 3 ? 0.8 : 0.6;

    const categoryPredictions = Array.isArray(aiResponse.categoryPredictions) 
      ? aiResponse.categoryPredictions
      .filter((pred: any) => pred && typeof pred.category === 'string' && pred.category.trim())
      .map((pred: any) => ({
          category: pred.category,
          currentMonth: Number(pred.currentMonth) || 0,
          predictedNext: Number(pred.predictedNext) || 0,
          confidence: Math.min(Number(pred.confidence) || 0.5, confidenceCap),
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
          confidence: Math.min(Number(month.confidence) || 0.5, confidenceCap),
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
    log.error('Error generating expense predictions:', error);
    throw error;
  }
}




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
    log.error('Voice extraction error (openai.ts fallback):', error);
    throw new Error('Failed to extract voice transaction data');
  }
}

export async function parseBankStatement(text: string, language: string = 'en-us'): Promise<{ transactions: any[] }> {
  const languageLabel = getLanguageLabel(language);

  try {
    // SECURITY: Never cache bank statement data - process fresh every time

    /*
     * The one prompt that turns a person's real bank history into rows in the app.
     *
     * What the old version got wrong, and this one fixes:
     *  - it asked for descriptions "in <app language>", so a Slovak user saw translated
     *    merchant names and the same shop appeared under two names in reports;
     *  - it never mentioned the things every real statement has: an entry split over two
     *    lines, separate debit/credit columns, a running balance column that is not a
     *    movement, repeated page headers, and minus signs written at the end ("12,50-");
     *  - "extract 100 % and miss nothing" is a wish the model cannot check, so it now has
     *    to count its own rows and report the count (below), which the caller verifies.
     */
    const bankStatementPrompt = `You are an expert financial data extraction system for bank statements.
Your job: turn the statement text into one row per real money movement.

APP LANGUAGE: ${languageLabel}. This is the language of the app the rows are shown in. It must NOT change
the wording of descriptions: a merchant is copied as it is printed on the statement, in whatever
language the statement uses.

MANDATORY JSON OUTPUT FORMAT:
{
  "count": 0,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Payee or merchant exactly as printed",
      "amount": 123.45,
      "type": "income" or "expense",
      "confidence": 0.95,
      "rawText": "Original text from statement"
    }
  ]
}

WHAT IS A TRANSACTION:
- Money actually moving in or out: card payments, transfers, standing orders, direct debits,
  cash withdrawals, deposits, salary, fees, interest charged or paid.
- A fee, a charge or interest IS a movement and must be included.

WHAT IS NOT A TRANSACTION (never emit a row for it):
- Opening balance, closing balance, "balance brought forward", "balance carried forward".
- The running balance column next to each row.
- Repeated page headers, column titles, page numbers, account holder name and address.
- Monthly totals, sums, "total debits/credits", interest summaries and footers.

READING RULES:
1. One entry split over two or more lines (payee on one line, amount on the next, or a note
   underneath) is ONE transaction. Join it, do not create two rows.
2. Debit/credit columns: put the amount as a POSITIVE number and let "type" carry the direction.
   "expense" = money left the account (debit, payment, withdrawal, fee, transfer out).
   "income" = money arrived (credit, deposit, salary, transfer in, refund received).
3. Sign conventions to recognise: a trailing minus ("12,50-"), parentheses ("(12,50)"), CR/DR,
   "+"/"-" in front, or a "D"/"C" column. All of them describe direction, nothing else.
4. Amounts: digits only with a dot as the decimal separator and no thousands separator
   ("1.234,56" -> 1234.56). Never include a currency symbol or code in the amount.
5. Dates: accept DD/MM/YYYY, MM/DD/YYYY (only when the numbers force it), YYYY-MM-DD, dots,
   dashes, and two-digit years (25 -> 2025). Output YYYY-MM-DD always.
   If a row's date is unreadable, use the last readable date above it and set confidence below 0.6.
   Never use today's date as a substitute.
6. Descriptions: copy the payee/merchant text as printed. You may drop trailing reference
   numbers, bank codes and card masks, but never translate, shorten to a category, or "clean up"
   the name into something nicer.
7. Do not invent a row to make a total match, and do not merge two different days into one row.

CONFIDENCE:
- 0.9 and above: date, amount and direction are all unambiguous.
- 0.7 to 0.9: readable but one field needed a judgement (a two-line entry, an unusual date).
- below 0.7: something is genuinely unclear. Include the row anyway rather than dropping it.

SELF-CHECK BEFORE ANSWERING:
- Set "count" to the number of objects you are returning in "transactions".
- Re-read the statement and confirm that every money movement you can see is in the list.
- A line you skipped because it is not a movement does not go in the list and does not count.

Respond ONLY with valid JSON. No explanations and no text outside the JSON object.`;

    const response = await openai.chat.completions.create({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: bankStatementPrompt
        },
        {
          role: "user",
          content: `Extract every money movement from this bank statement text:\n\n${text}`
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

      /*
       * The model's own row count is the cheapest check we have that a statement was not
       * silently halved (a truncated reply, a page it skipped). Counts only: the rows
       * themselves never reach a log line.
       */
      const claimed = Number(result.count);
      if (Number.isFinite(claimed) && claimed > 0 && claimed !== formattedResult.transactions.length) {
        log.warn(
          `[AI] statement parse returned ${formattedResult.transactions.length} rows but counted ${claimed}; the reply may be incomplete`,
        );
      }

      // SECURITY: Never cache bank statement results - return immediately
      return formattedResult;
    }

    return { transactions: [] };

  } catch (error) {
    log.error('Bank statement parsing error (server fallback):', error);
    throw new Error('Failed to parse bank statement transactions');
  }
}