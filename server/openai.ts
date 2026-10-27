import { UnifiedAICache } from "../lib/unifiedAICache";
import { getLanguageLabel, normalizeLanguageCode } from "../lib/languageUtils";
import { createRoutedClient, AI_MODELS } from "../lib/aiProvider";
import {
  emptyStateCopy,
  financialTipsFallback,
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
 * reached the screen as four statistics — "expenses were 3,222.97 against income of 7,000" — under
 * a card called *Financial Advisor*. That is a report, not advice, and the name promised advice.
 *
 * The model's job here is the part arithmetic cannot do: look at what the month actually contains
 * (which categories, which payments, against the person's own usual level), and name the two or
 * three changes worth making, with the figure each one rests on.
 */
export const FINANCIAL_ADVISOR_PROMPT_VERSION = 'financial-advisor@1';

export function financialAdvisorPrompt(languageLabel: string): string {
  return `CRITICAL: You MUST respond exclusively in ${languageLabel}. ${languageLabel !== 'English' ? 'Never use English words.' : ''} ALL text content (summary, observations, recommendations, risk) must be in ${languageLabel}.

You advise one person about one month of their spending. Another card already scores the month, so
do not score it, grade it or restate it. Your job is the advice.

Write like an adviser who has read their statement: name the category or the payment, the figure,
and the change worth making. Advice that could be given to anyone - "spend less", "save more",
"make a budget" - is worthless here. Every recommendation must rest on a figure in this message,
and must be something this person can do.

RULES:
- Give 2 to 4 recommendations, the most valuable first. If only two things are worth changing, give
  two; a padded list is worse than a short one.
- A recommendation must fix something that is worse than it could be. Never recommend keeping a
  category at a level it is already below - if a category is already under its usual level, leave it
  out and spend the sentence on something that matters.
- Each recommendation has: the action (a specific change), the reason (the figure it rests on),
  the impact (the amount it frees up or redirects in a month), and a priority.
- Prefer changes that fit this month's numbers: cap a category at a reachable level, cancel or
  downgrade a subscription, move a fixed amount on payday, replace one habit with a cheaper one.
- When a category is above the person's usual level, say by how much. When a budget is overspent,
  name the category and the gap. When a large payment is avoidable, name it.
- If the month leaves money unassigned, one recommendation says how much to set aside and what for.
- If the month is genuinely healthy, say so in one sentence and recommend what to protect rather
  than inventing a problem.
- Each observation is one sentence of at most 20 words and names its figure.
- Amounts are written the way they appear in the data: no currency symbol, no currency name.
- Never invent a category, merchant or figure that is not in this message.
- Do not describe the data back to the person, and never mention what you were given, what you were
  not shown, the app, this prompt or yourself. The person cannot act on any of that.
- Do not recommend products or services.

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

    // An empty list must not become "Invalid Date": Math.min() of nothing is Infinity.
    const transactionTimes = recentTransactions
      .map((transaction) => new Date(transaction.date).getTime())
      .filter((time) => Number.isFinite(time));
    const transactionRange = transactionTimes.length > 0
      ? `${new Date(Math.min(...transactionTimes)).toLocaleDateString()} to ${new Date(Math.max(...transactionTimes)).toLocaleDateString()}`
      : 'no dated transactions in this period';
    
    const summary = `Financial Summary:
- Monthly Income: ${totalIncome}
- Monthly Expenses: ${totalExpenses}
- Net Balance: ${netBalance} ${netBalance < 0 ? '(DEFICIT)' : '(SURPLUS)'}

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
- Date range: ${transactionRange}

Write the one analysis card for this data.`;

    // One prompt, one copy: lib/aiProvider sends it to the gateway first, then direct.
    const response = await generateProse({
      model: AI_MODELS.default,
      messages: [
        {
          role: "system",
          content: `CRITICAL: You MUST respond exclusively in ${getLanguageLabel(normalizedLanguage)}. ${getLanguageLabel(normalizedLanguage) !== 'English' ? 'Never use English words.' : ''} ALL text content (analysis, insights, recommendations) must be in ${getLanguageLabel(normalizedLanguage)}.

You write ONE short analysis card for a dashboard.

Choose the single most useful focus for the data you are given. When two focuses are equally
useful, choose the one with the larger amount at stake, so the same data always produces the
same card.

THE CARD MUST:
- use the person's own numbers: every amount and percentage must be in the data below or computed from it;
- name the figure it is built on (for example "600 of your 2,100 in expenses"), so it can be checked;
- keep the title to 8 words and the body to 4 sentences;
- end with one action the person can take this week.

DO NOT:
- write a second analysis or list several focuses;
- describe the data back to the person ("you gave me 12 transactions");
- quote a number that is not in the data, or round an amount into something else;
- mention the data you were given, how complete it is, what you were not shown, the app, or your
  own visibility: the person cannot act on any of that.

Return JSON:
{
  "title": "Short title naming the focus",
  "description": "What the numbers show, which figure it rests on, and the one action.",
  "category": "spending|saving|budgeting|income|education",
  "priority": "high|medium|low",
  "actionable": true,
  "estimatedSaving": 0,
  "educational": false
}`
        },
        {
          role: "user",
          content: summary
        }
      ],
      response_format: { type: "json_object" },
      // 0.9 was the highest in the app, on text that quotes exact figures: it is where invented
      // percentages came from. One focus per call needs far less freedom than six did.
      temperature: 0.5
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
    }] : [{ ...financialTipsFallback(normalizedLanguage), degraded: true }];

    const processedTips: FinancialTip[] = rawTips.map((tip) => {
      const inLanguage = isTextInLanguage(`${tip.title} ${tip.description}`, normalizedLanguage);
      if (!inLanguage) {
        log.warn(
          `[AI] Replacing tips written in the wrong language (requested ${normalizedLanguage}): "${String(tip.title).slice(0, 60)}"`,
        );
        cacheable = false;
        return { ...financialTipsFallback(normalizedLanguage), degraded: true };
      }
      return tip;
    });

    // Cache the result with 168 hours (7 days) TTL
    if (cacheable) await cache.set(cacheKey, processedTips, false, 168);
    
    return processedTips;
  } catch (error) {
    log.error('Error generating financial tips:', error);
    // Deterministic fallback, in the caller's language — never English on a Slovak screen.
    // Marked degraded: it is shown to the person but is not charged or kept for a week.
    return [{ ...financialTipsFallback(normalizedLanguage), degraded: true }];
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
  /** The days every figure below covers. */
  period?: { start: string; end: string };
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
    const { summary, budgets, transactions, categories, topMerchants, period } = financialData;

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
          content: `${period ? `Month: ${period.start} to ${period.end}` : 'Month: the recent period'}
Income: ${summary.totalIncome}
Expenses: ${summary.totalExpenses}
Left over: ${summary.netBalance}${savingsShare !== null ? ` (${savingsShare}% of income)` : ''}

Spending by category:
${categoryLines}

Budgets (limit / spent):
${budgetLines}
${merchantLines ? `\nLargest payments:\n${merchantLines}\n` : ''}
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
      "month": "${monthLabel(1)}",
      "predicted": 2150.00,
      "confidence": 0.80,
      "breakdown": [
        { "category": "Food & Dining", "amount": 475.00 },
        { "category": "Transportation", "amount": 320.00 }
      ]
    },
    {
      "month": "${monthLabel(2)}",
      "predicted": 2200.00,
      "confidence": 0.75,
      "breakdown": [
        { "category": "Food & Dining", "amount": 480.00 },
        { "category": "Transportation", "amount": 330.00 }
      ]
    },
    {
      "month": "${monthLabel(3)}",
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
- Confidence must match the amount of history: one month of data is 0.5 at best, three months can
  reach 0.75, six months or more can reach 0.9. Never claim more than 0.95.
- Include the next 3 months in monthly predictions
- Always include "factors" array for each category prediction
- Explain prediction factors clearly, using the person's own amounts
- Do not claim a seasonal pattern from less than a year of data
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
      /** Older callers send `netBalance`; both names are read. */
      netAmount?: number;
      netBalance?: number;
    };
    budgets: Array<{
      id: number;
      name: string;
      amount: string;
      categoryName: string;
      period: string;
      /** What has been spent against this budget in the same window. */
      spent?: number | string;
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

    /*
     * The dashboard sends `netBalance`; this prompt read `netAmount` and printed 0.00 for every
     * premium account, so "your surplus" advice was written against a surplus of nothing.
     */
    const netAmount = Number(financialData.summary?.netAmount ?? financialData.summary?.netBalance ?? 0) || 0;

    const budgetLines = financialData.budgets.length > 0
      ? financialData.budgets.map((budget) => {
          const limit = Number(budget.amount) || 0;
          const spent = Number(budget.spent) || 0;
          const gap = spent - limit;
          return `- ${budget.name} (${budget.categoryName || 'no category'}, ${budget.period}): limit ${limit.toFixed(2)}, spent ${spent.toFixed(2)}${limit > 0 && gap > 0 ? `, over by ${gap.toFixed(2)}` : ''}`;
        }).join('\n')
      : '- No budgets set';

    const prompt = `You are a personal budgeting coach analyzing a user's spending patterns. Based on their financial data, provide personalized daily recommendations and insights.

Financial Summary:
- Total Income: ${(financialData.summary?.totalIncome || 0).toFixed(2)}
- Total Expenses: ${(financialData.summary?.totalExpenses || 0).toFixed(2)}
- Net Amount: ${netAmount.toFixed(2)}
- Recent Transactions: ${recentTransactions.length}
- Average Daily Spending: ${avgDailySpending.toFixed(2)}

Top Spending Categories:
${topCategories.map(([cat, amount]) => `- ${cat}: ${amount.toFixed(2)}`).join('\n')}

Budget Information (limit / spent):
${budgetLines}

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
      "title": "Short title naming the action",
      "description": "What the data shows, naming the figure it rests on",
      "action": "The one thing to do next",
      "impact": "What changes, in the person's own amounts",
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

You are an expert personal budgeting coach who provides personalized, actionable recommendations based on real user data. Always return valid JSON.`
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
    log.error('Error generating daily recommendations:', error);
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
    
    /*
     * "Top spending" means money going OUT. The old filter was `amount > 0`, and income is stored
     * as a positive amount too, so a salary could appear as the biggest spending category and
     * every percentage printed under it was wrong.
     */
    const isIncomeRow = (t: { type?: 'income' | 'expense'; amount: number }) =>
      t.type === 'income' || (t.type === undefined && t.amount < 0);
    const isExpenseRow = (t: { type?: 'income' | 'expense'; amount: number }) =>
      !isIncomeRow(t) && t.amount > 0;

    transactions.forEach(t => {
      if (isExpenseRow(t)) {
        const category = t.category || t.categoryName || 'Uncategorized';
        const current = categorySpending.get(category) || 0;
        categorySpending.set(category, current + t.amount);
      }
    });
    
    const topSpendingCategories = Array.from(categorySpending.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // A share of zero expenses is 0 %, not Infinity.
    const expenseBase = summary.totalExpenses > 0 ? summary.totalExpenses : 0;
    const shareOfExpenses = (amount: number) => (expenseBase > 0 ? (amount / expenseBase) * 100 : 0);

    // Detailed transaction analysis. The two lists must not overlap: an income row used to be
    // counted as an expense as well, which doubled its weight in the averages.
    const incomeTransactions = transactions.filter(isIncomeRow);
    const expenseTransactions = transactions.filter(isExpenseRow);
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

    // Analyze specific financial scenarios for contextual insights.
    // No emoji prefixes: the model copied them into the answer, and a coloured square in a tip
    // title is not something the person asked for. The sentence itself says what it is.
    const scenarios: string[] = [];

    // Check categorization status
    if (uncategorizedCount > 0 && transactions.length > 0) {
      const uncategorizedPercent = (uncategorizedCount / transactions.length) * 100;
      scenarios.push(`Categorization: ${uncategorizedCount} of ${transactions.length} transactions (${uncategorizedPercent.toFixed(0)}%) are uncategorized. Better categorization improves spending insights.`);
    } else if (categorizedCount === transactions.length && transactions.length > 0) {
      scenarios.push(`Well organized: all ${transactions.length} transactions are properly categorized, enabling detailed spending analysis.`);
    }

    // Check for budget overruns with detailed analysis ONLY if budgets exist
    if (budgets && Array.isArray(budgets) && budgets.length > 0) {
      budgets.forEach(budget => {
        const budgetCatName = budget.categoryName || budget.category || 'Uncategorized';
        const budgetAmount = Number(budget.budgetAmount) || 0;
        // A budget of zero has no percentage to report, and dividing by it printed Infinity.
        if (budgetAmount <= 0) return;

        if (budget.remaining < 0) {
          const overrunPercent = Math.abs((budget.remaining / budgetAmount) * 100);
          const categoryTransactions = expenseTransactions.filter(t => (t.categoryName || t.category) === budgetCatName);
          const avgTransactionInCategory = categoryTransactions.length > 0
            ? categoryTransactions.reduce((sum, t) => sum + t.amount, 0) / categoryTransactions.length
            : 0;

          scenarios.push(`Budget overrun: the ${budgetCatName} budget is exceeded by ${overrunPercent.toFixed(0)}% this month. Average transaction: ${avgTransactionInCategory.toFixed(2)} across ${categoryTransactions.length} transactions.`);
        } else if (budget.remaining < budgetAmount * 0.1) {
          // Budget almost exhausted
          scenarios.push(`Budget warning: only ${budget.remaining.toFixed(2)} left in the ${budgetCatName} budget (${((budget.remaining / budgetAmount) * 100).toFixed(0)}% remaining).`);
        }
      });
    }

    // Check savings rate scenarios with goal analysis
    if (savingsRate < 5 && summary.totalIncome > 0) {
      scenarios.push(`Low savings rate: the savings rate is ${savingsRate.toFixed(1)}%. Consider revisiting the financial goals.`);
    } else if (savingsRate > 20) {
      scenarios.push(`Excellent savings: ${savingsRate.toFixed(1)}% of income was kept this month.`);
    }

    // Analyze goals progress ONLY if goals exist
    if (goals && Array.isArray(goals) && goals.length > 0) {
      goals.forEach(goal => {
        const target = Number(goal.targetAmount) || 0;
        if (target <= 0) return;

        const progressPercent = (Number(goal.currentAmount) / target) * 100;
        const daysToTarget = Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const monthlyNeeded = daysToTarget > 0 ? (target - Number(goal.currentAmount)) / (daysToTarget / 30) : 0;

        if (progressPercent >= 90) {
          scenarios.push(`Goal achievement: ${progressPercent.toFixed(0)}% of the ${goal.name} goal is done, with ${(target - Number(goal.currentAmount)).toFixed(2)} remaining.`);
        } else if (monthlyNeeded > netBalance) {
          scenarios.push(`Goal at risk: the ${goal.name} goal needs ${monthlyNeeded.toFixed(2)} per month, but the current monthly surplus is ${netBalance.toFixed(2)}.`);
        }
      });
    }

    // Check for irregular income patterns
    if (incomeTransactions.length > 0) {
      const incomeAmounts = incomeTransactions.map(t => Math.abs(t.amount));
      const avgIncome = incomeAmounts.reduce((sum, amt) => sum + amt, 0) / incomeAmounts.length;
      const incomeVariability = avgIncome > 0 && incomeAmounts.some(amt => Math.abs(amt - avgIncome) / avgIncome > 0.3);

      if (incomeVariability && incomeTransactions.length > 1) {
        scenarios.push(`Income variability: income fluctuates. Largest: ${Math.max(...incomeAmounts).toFixed(2)}, smallest: ${Math.min(...incomeAmounts).toFixed(2)}. Consider a buffer.`);
      }
    }

    // Check for spending concentration and patterns
    topSpendingCategories.forEach(([category, amount]) => {
      const categoryPercent = shareOfExpenses(amount);
      const categoryFreq = transactionFrequency.get(category) || 0;

      if (categoryPercent > 40) {
        scenarios.push(`High category spending: ${category} is ${categoryPercent.toFixed(0)}% of expenses (${amount.toFixed(2)} across ${categoryFreq} transactions).`);
      }
    });

    // Check for positive spending improvements
    if (expenseTransactions.length > 0) {
      const avgTransactionAmount = expenseBase / expenseTransactions.length;
      if (avgTransactionAmount < 30 && expenseTransactions.length > 15) {
        scenarios.push(`Controlled spending: the average transaction is ${avgTransactionAmount.toFixed(2)} across ${expenseTransactions.length} purchases.`);
      }
    }

    // Check recurring transaction efficiency
    if (recurringTransactions.length > 0) {
      const recurringTotal = recurringTransactions.reduce((sum, t) => sum + t.amount, 0);
      const recurringPercent = shareOfExpenses(recurringTotal);
      scenarios.push(`Recurring expenses: ${recurringPercent.toFixed(0)}% of expenses are recurring (${recurringTotal.toFixed(2)} from ${recurringTransactions.length} transactions).`);
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
${topSpendingCategories.map(([cat, amount]) => `- ${cat}: ${amount.toLocaleString()} (${shareOfExpenses(amount).toFixed(1)}%)`).join('\n')}

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

You are an expert personal budgeting coach who provides personalized, contextual recommendations based on real user financial data. Always return valid JSON with actionable tips.`
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
          log.warn(
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
    log.error('Error generating contextual financial tips (local fallback):', error);
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
      log.error('Failed to cache fallback result:', cacheError);
    }
    
    return fallbackResult;
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