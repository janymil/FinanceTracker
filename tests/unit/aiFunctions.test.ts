import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every AI function of server/openai.ts, driven with canned model replies (no network, no
 * keys, no database). Each one is shown a good answer, a wrong-shaped answer, prose instead of
 * JSON, and a provider failure, and must never turn a broken reply into something that looks
 * real, cache a failure, show English to a Slovak screen, or send data to anything but the
 * routed client.
 */
const create = vi.hoisted(() => vi.fn());
const cache = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock('../../lib/aiProvider', () => ({
  AI_MODELS: { default: 'gpt-6-luna', voice: 'mistral-small-latest', generation: 'gpt-6-luna', parsing: 'gpt-6-luna', classification: 'gpt-6-luna' },
  createRoutedClient: () => ({ chat: { completions: { create } } }),
}));

vi.mock('../../lib/unifiedAICache', () => ({
  UnifiedAICache: class {
    constructor(public functionKey: string, public userId: string, public month?: string) {}
    get = (input: unknown) => cache.get(this.functionKey, input);
    set = (input: unknown, output: unknown, isError?: boolean, ttl?: number) =>
      cache.set(this.functionKey, input, output, isError, ttl);
  },
}));

import {
  PROSE_RULES,
  categorizeExpense,
  categorizeExpenseWithUserCategories,
  categorizeIncomeWithUserCategories,
  generateAIFinancialHealthScore,
  generateContextualFinancialTips,
  generateDailyRecommendations,
  generateExpensePredictions,
  generateFinancialTips,
  generateSpendingInsights,
  generateTrendPredictions,
  normalizeForecast,
  parseBankStatement,
  toCategoryChoice,
  voiceExtraction,
  withProseRules,
} from '../../server/openai';

const fetchMock = vi.fn();

const reply = (value: unknown) => ({ choices: [{ message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }] });
const systemOf = (call = 0) => create.mock.calls[call][0].messages.find((m: any) => m.role === 'system').content as string;
const userOf = (call = 0) => create.mock.calls[call][0].messages.find((m: any) => m.role === 'user').content as string;

beforeEach(() => {
  create.mockReset();
  cache.get.mockReset().mockResolvedValue(null);
  cache.set.mockReset().mockResolvedValue(undefined);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

const today = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const categories = [
  { id: 1, name: 'Groceries', type: 'expense' },
  { id: 2, name: 'Transport', type: 'expense' },
];

/* ------------------------------------------------------------------ categorisation */

describe('category choice from the model', () => {
  it('accepts one of the person\'s own categories', () => {
    expect(toCategoryChoice({ categoryId: 1, confidence: 0.9, reasoning: 'ok' }, categories))
      .toEqual({ categoryId: 1, suggestedCategory: undefined, confidence: 0.9, reasoning: 'ok' });
  });

  it('rejects an id the model invented', () => {
    expect(toCategoryChoice({ categoryId: 999, confidence: 0.99, reasoning: 'x' }, categories))
      .toMatchObject({ failed: true, confidence: 0.1 });
  });

  it('keeps a new-category suggestion when the id is not theirs', () => {
    expect(toCategoryChoice({ categoryId: 999, suggestedCategory: ' Pets ', confidence: 0.8 }, categories))
      .toMatchObject({ categoryId: undefined, suggestedCategory: 'Pets', confidence: 0.8 });
  });

  it('prefers the id when the model gives both', () => {
    expect(toCategoryChoice({ categoryId: 2, suggestedCategory: 'Cars', confidence: 0.8 }, categories))
      .toMatchObject({ categoryId: 2, suggestedCategory: undefined });
  });

  it('turns a nonsense confidence into 0.5 and clamps a large one', () => {
    expect(toCategoryChoice({ categoryId: 1, confidence: 'very' }, categories).confidence).toBe(0.5);
    expect(toCategoryChoice({ categoryId: 1, confidence: 4 }, categories).confidence).toBe(1);
  });
});

describe('categorizeExpenseWithUserCategories', () => {
  it('returns the person\'s category, asks in their language, and sends the amount without a currency sign', async () => {
    create.mockResolvedValueOnce(reply({ categoryId: 1, confidence: 0.92, reasoning: 'supermercado' }));
    const result = await categorizeExpenseWithUserCategories('Metro', 31.5, categories, 'es-pe');

    expect(result).toMatchObject({ categoryId: 1, confidence: 0.92 });
    expect(result.failed).toBeUndefined();
    expect(systemOf()).toContain('Spanish');
    expect(systemOf()).toContain('Groceries (ID: 1)');
    expect(userOf()).toContain('Amount: 31.5');
    expect(userOf()).not.toMatch(/\$\d/);
  });

  it.each([
    ['prose', 'I think it is groceries.'],
    ['an empty reply', ''],
    ['an array', '[1,2]'],
    ['an id that is not theirs', { categoryId: 404, confidence: 1 }],
  ])('marks %s as failed instead of inventing an answer', async (_name, bad) => {
    create.mockResolvedValueOnce(reply(bad));
    expect(await categorizeExpenseWithUserCategories('Metro', 5, categories)).toMatchObject({ failed: true, confidence: 0.1 });
  });

  it('marks a provider failure as failed', async () => {
    create.mockRejectedValueOnce(new Error('503'));
    expect(await categorizeExpenseWithUserCategories('Metro', 5, categories)).toMatchObject({ failed: true });
  });

  it('is not given the prose house rules: a merchant may really be a bank', async () => {
    create.mockResolvedValueOnce(reply({ categoryId: 1, confidence: 0.9 }));
    await categorizeExpenseWithUserCategories('Credit Suisse fee', 5, categories);
    expect(systemOf()).not.toContain('HOUSE RULES');
  });
});

describe('categorizeIncomeWithUserCategories', () => {
  it('validates the id the same way and marks failures', async () => {
    create.mockResolvedValueOnce(reply({ categoryId: 2, confidence: 0.9 }));
    expect(await categorizeIncomeWithUserCategories('Payroll', 1000, categories)).toMatchObject({ categoryId: 2 });

    create.mockResolvedValueOnce(reply({ categoryId: 77, confidence: 0.9 }));
    expect(await categorizeIncomeWithUserCategories('Payroll', 1000, categories)).toMatchObject({ failed: true });

    create.mockRejectedValueOnce(new Error('down'));
    expect(await categorizeIncomeWithUserCategories('Payroll', 1000, categories)).toMatchObject({ failed: true });
  });
});

describe('categorizeExpense', () => {
  it('returns a trimmed category and a clamped confidence', async () => {
    create.mockResolvedValueOnce(reply({ category: ' Food ', confidence: 3, reasoning: 'restaurant' }));
    expect(await categorizeExpense('Pizza', 12)).toMatchObject({ category: 'Food', confidence: 1, reasoning: 'restaurant' });
  });

  it('falls back to "Other" for a reply with no usable category, without claiming it failed', async () => {
    create.mockResolvedValueOnce(reply({ category: 42, confidence: 0.6 }));
    expect(await categorizeExpense('Pizza', 12)).toMatchObject({ category: 'Other', confidence: 0.6 });
  });

  it.each(['not json', ''])('flags a broken reply (%j) as failed so no caller treats "Other 0.1" as a result', async (bad) => {
    create.mockResolvedValueOnce(reply(bad));
    expect(await categorizeExpense('Pizza', 12)).toMatchObject({ category: 'Other', confidence: 0.1, failed: true });
  });
});

/* ------------------------------------------------------------------ house rules */

describe('prose house rules', () => {
  it('adds the rules to the system message and leaves the input untouched', () => {
    const input = { model: 'm', messages: [{ role: 'system', content: 'BASE' }, { role: 'user', content: 'hi' }] };
    const output = withProseRules(input);

    expect(output.messages[0].content).toBe(`BASE\n\n${PROSE_RULES}`);
    expect(output.messages[1]).toEqual(input.messages[1]);
    expect(input.messages[0].content).toBe('BASE');
    expect(output.model).toBe('m');
  });

  it('creates a system message when there is none', () => {
    const output = withProseRules({ messages: [{ role: 'user', content: 'hi' }] });
    expect(output.messages[0]).toEqual({ role: 'system', content: PROSE_RULES });
    expect(output.messages).toHaveLength(2);
  });

  it('forbids the words a licensed service would use, and the currency sign', () => {
    expect(PROSE_RULES).toMatch(/not a licensed financial service/);
    expect(PROSE_RULES).toMatch(/bank, loan, credit, invest or advisor/);
    expect(PROSE_RULES).toMatch(/Never add a currency symbol/);
  });

  it('is applied to everything a person reads', async () => {
    create.mockResolvedValue(reply({ title: 'T', description: 'a long enough description for the check', category: 'saving' }));
    await generateFinancialTips('u', tipsInput());
    expect(systemOf()).toContain('HOUSE RULES');
  });
});

/* ------------------------------------------------------------------ tips */

const tipsInput = () => ({
  totalIncome: 3000,
  totalExpenses: 2100,
  transactionsByCategory: [{ categoryName: 'Food', amount: 600, type: 'expense' }],
  recentTransactions: [{ description: 'Migros', amount: 40, date: daysAgo(1), categoryName: 'Food', type: 'expense' }],
});

describe('generateFinancialTips', () => {
  it('sends the prompt through the routed client and never calls any other service', async () => {
    create.mockResolvedValueOnce(reply({
      title: 'Prehľad výdavkov',
      description: 'Vaše výdavky na potraviny sú v tomto mesiaci vyššie, a to je možné znížiť pre vaše ciele.',
      category: 'spending', priority: 'high', actionable: true,
    }));
    await generateFinancialTips('u', tipsInput(), 'sk-sk');

    expect(create).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('puts the language in the cache key, so switching language never returns the old text', async () => {
    create.mockImplementation(async (params: any) => {
      const slovak = params.messages[0].content.includes('exclusively in Slovak');
      return reply(slovak
        ? { title: 'Znížte výdavky', description: 'Vaše výdavky na potraviny sú vysoké, a môžete ušetriť peniaze pre svoje ciele.', category: 'saving' }
        : { title: 'Reduce gastos', description: 'Tus gastos de comida son altos, y puedes ahorrar dinero para tus metas.', category: 'saving' });
    });
    await generateFinancialTips('u', tipsInput(), 'es-pe');
    await generateFinancialTips('u', tipsInput(), 'sk-sk');

    const keys = cache.get.mock.calls.map((call) => (call[1] as any).language);
    expect(keys).toEqual(['es-pe', 'sk-sk']);
    expect((cache.set.mock.calls[0][1] as any).language).toBe('es-pe');
  });

  it('returns a cached answer without asking the model', async () => {
    cache.get.mockResolvedValueOnce([{ title: 'cached' }]);
    expect(await generateFinancialTips('u', tipsInput(), 'en-us')).toEqual([{ title: 'cached' }]);
    expect(create).not.toHaveBeenCalled();
  });

  it('replaces a tip written in the wrong language with the Slovak fallback', async () => {
    create.mockResolvedValueOnce(reply({
      title: 'Track Your Expenses',
      description: 'You should track the expenses and the budget of your money with this app and that plan.',
      category: 'budgeting',
    }));
    const [tip] = await generateFinancialTips('u', tipsInput(), 'sk-sk');
    expect(tip.title).toBe('Sledujte svoje výdavky');
  });

  it.each([['a provider failure', () => create.mockRejectedValueOnce(new Error('down'))],
    ['prose', () => create.mockResolvedValueOnce(reply('here are some tips'))],
    ['JSON without a title', () => create.mockResolvedValueOnce(reply({ note: 'x' }))],
  ])('answers %s with the localised fallback and caches nothing', async (_name, arrange) => {
    arrange();
    const [tip] = await generateFinancialTips('u', tipsInput(), 'es-pe');
    expect(tip.title).toBe('Registra tus gastos');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('copes with no transactions at all (no NaN in the prompt)', async () => {
    create.mockResolvedValueOnce(reply({ title: 'T', description: 'D', category: 'saving' }));
    await generateFinancialTips('u', { ...tipsInput(), recentTransactions: [] }, 'en-us');
    expect(userOf()).not.toMatch(/NaN|Infinity/);
  });
});

/* ------------------------------------------------------------------ insights */

const expenseTxs = () => [
  { description: 'Migros', amount: 40, date: daysAgo(2), categoryName: 'Food', type: 'expense' },
  { description: 'Shell', amount: 60, date: daysAgo(3), categoryName: 'Transport', type: 'expense' },
];

describe('generateSpendingInsights', () => {
  it('asks in the person\'s language and keys the cache on it', async () => {
    create.mockResolvedValueOnce(reply({ insights: [{ id: 'i1', type: 'warning', title: 'Alto', description: 'Gastas mucho', impact: 'high', actionable: true }] }));
    await generateSpendingInsights('u', expenseTxs(), 'es-pe');

    expect(systemOf()).toContain('Spanish');
    expect((cache.get.mock.calls[0][1] as any).language).toBe('es-pe');
    expect(userOf()).not.toMatch(/\$\d/);
  });

  it('says out loud when the model is only shown a sample of the rows', async () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      description: `Shop ${index}`, amount: 10, date: daysAgo(index + 1), categoryName: 'Food', type: 'expense',
    }));
    create.mockResolvedValueOnce(reply({ insights: [] }));

    await generateSpendingInsights('u', many, 'en-us');

    // "Your spending rose 40 %" cannot be computed from a sample that is not labelled as one.
    expect(userOf()).toContain('20 most recent of 30');
  });

  it('accepts a bare array and drops items with no title or no description, with no English placeholder', async () => {
    create.mockResolvedValueOnce(reply([
      { id: 'a', type: 'trend', title: 'Good', description: 'Fine', impact: 'low' },
      { id: 'b', type: 'trend', title: '', description: 'No title' },
      { id: 'c', type: 'trend', title: 'No body' },
      null,
    ]));
    const insights = await generateSpendingInsights('u', expenseTxs(), 'en-us');
    expect(insights.map((i) => i.id)).toEqual(['a']);
  });

  it('repairs an unknown type and impact but keeps the insight', async () => {
    create.mockResolvedValueOnce(reply({ insights: [{ title: 'T', description: 'D', type: 'weird', impact: 'huge' }] }));
    const [insight] = await generateSpendingInsights('u', expenseTxs(), 'en-us');
    expect(insight).toMatchObject({ type: 'suggestion', impact: 'medium', actionable: false });
  });

  it('returns an empty list for no expenses without calling the model', async () => {
    expect(await generateSpendingInsights('u', [{ description: 'Pay', amount: 1, date: today(), type: 'income' }], 'en-us')).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('throws on a provider failure and caches nothing: "no insights" and "AI is down" are different things', async () => {
    create.mockRejectedValueOnce(new Error('503'));
    await expect(generateSpendingInsights('u', expenseTxs(), 'en-us')).rejects.toThrow('503');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('throws on prose rather than returning an empty list', async () => {
    create.mockResolvedValueOnce(reply('Your spending looks fine.'));
    await expect(generateSpendingInsights('u', expenseTxs(), 'en-us')).rejects.toThrow(/JSON/);
  });
});

/* ------------------------------------------------------------------ trend predictions */

describe('normalizeForecast', () => {
  it('turns strings and {title, description} objects into plain sentences', () => {
    const forecast = normalizeForecast({
      nextMonthExpenses: 1200, expectedSavings: '300', budgetVariance: 'n/a', confidence: 7,
      keyInsights: ['one', '', 5, { title: 'Two', description: 'second' }],
      recommendations: [{ title: 'Only title' }, { description: 'Only body' }, 'plain'],
      riskFactors: 'not a list',
    });
    expect(forecast).toEqual({
      nextMonthExpenses: 1200, expectedSavings: 300, budgetVariance: 0, confidence: 1,
      keyInsights: ['one', 'Two: second'],
      recommendations: ['Only title', 'Only body', 'plain'],
      riskFactors: [],
    });
  });

  it.each([undefined, null, 'x', 7, []])('survives %j', (junk) => {
    expect(normalizeForecast(junk)).toMatchObject({ nextMonthExpenses: 0, keyInsights: [], recommendations: [], riskFactors: [] });
  });
});

describe('generateTrendPredictions', () => {
  const txs = () => [{ id: 1, amount: '40', description: 'Migros', date: daysAgo(10).slice(0, 10), type: 'expense', categoryName: 'Food' }];

  it.each([
    ['en-us', 'Start tracking your expenses'],
    ['es-pe', 'Empieza a registrar tus gastos'],
    ['sk-sk', 'Začnite sledovať svoje výdavky'],
  ])('with no data says so in %s, and as plain text the page can render', async (language, expected) => {
    const result = await generateTrendPredictions('u', [], [], language);
    expect(result.financialForecast.recommendations[0]).toContain(expected);
    expect(typeof result.financialForecast.recommendations[0]).toBe('string');
    expect(result.categoryPredictions).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('normalises what the model sends and caches it under the person\'s language', async () => {
    create.mockResolvedValueOnce(reply({
      categoryPredictions: [{ category: 'Food', predictedAmount: 100 }],
      financialForecast: { nextMonthExpenses: 900, keyInsights: ['x'], recommendations: [{ title: 'Cook', description: 'at home' }] },
    }));
    const result = await generateTrendPredictions('u', txs(), [], 'sk-sk');

    expect(result.financialForecast.recommendations).toEqual(['Cook: at home']);
    expect(result.financialForecast.nextMonthExpenses).toBe(900);
    expect((cache.get.mock.calls[0][1] as any).language).toBe('sk-sk');
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(systemOf()).toContain('Slovak');
  });

  it('survives a reply with no forecast at all', async () => {
    create.mockResolvedValueOnce(reply({}));
    const result = await generateTrendPredictions('u', txs(), [], 'en-us');
    expect(result.categoryPredictions).toEqual([]);
    expect(result.financialForecast.nextMonthExpenses).toBe(0);
  });

  it('throws on a provider failure and caches nothing', async () => {
    create.mockRejectedValueOnce(new Error('503'));
    await expect(generateTrendPredictions('u', txs(), [], 'en-us')).rejects.toThrow('503');
    expect(cache.set).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ expense predictions */

describe('generateExpensePredictions', () => {
  const txs = () => Array.from({ length: 6 }, (_, i) => ({
    id: i, amount: '25', description: `Shop ${i}`, date: daysAgo(i + 1), type: 'expense', categoryName: 'Food',
  }));

  it('needs enough history and says nothing otherwise, without a model call', async () => {
    expect(await generateExpensePredictions('u', txs().slice(0, 3), 'en-us')).toEqual({ categoryPredictions: [], monthlyPredictions: [] });
    expect(create).not.toHaveBeenCalled();
  });

  it('drops predictions with no category or month instead of printing "Unknown"', async () => {
    create.mockResolvedValueOnce(reply({
      categoryPredictions: [
        { category: 'Food', currentMonth: 100, predictedNext: 110, confidence: 0.7, trend: 'increasing', factors: ['x'] },
        { currentMonth: 1 },
      ],
      monthlyPredictions: [{ month: '2026-11', predicted: 300, breakdown: [] }, { predicted: 5 }],
    }));
    const result = await generateExpensePredictions('u', txs(), 'es-pe');

    expect(result.categoryPredictions.map((p) => p.category)).toEqual(['Food']);
    expect(result.monthlyPredictions.map((m) => m.month)).toEqual(['2026-11']);
    expect(JSON.stringify(result)).not.toContain('Unknown');
    expect(JSON.stringify(result)).not.toContain('No specific factors');
  });

  it('does not let one month of history look like a confident prediction', async () => {
    create.mockResolvedValueOnce(reply({
      categoryPredictions: [{ category: 'Food', currentMonth: 100, predictedNext: 110, confidence: 0.95, trend: 'increasing', factors: [] }],
      monthlyPredictions: [{ month: '2026-11', predicted: 300, confidence: 0.95, breakdown: [] }],
    }));

    // txs() spans six days: one month of history, so the cap is 0.6 whatever the model claims.
    const result = await generateExpensePredictions('u', txs(), 'en-us');

    expect(result.categoryPredictions[0].confidence).toBe(0.6);
    expect(result.monthlyPredictions[0].confidence).toBe(0.6);
  });

  it('keys the cache on the language and asks in it', async () => {
    create.mockResolvedValueOnce(reply({ categoryPredictions: [], monthlyPredictions: [] }));
    await generateExpensePredictions('u', txs(), 'sk-sk');
    expect((cache.get.mock.calls[0][1] as any).language).toBe('sk-sk');
    expect(systemOf()).toContain('Slovak');
  });

  it('throws on a provider failure and caches nothing', async () => {
    create.mockRejectedValueOnce(new Error('503'));
    await expect(generateExpensePredictions('u', txs(), 'en-us')).rejects.toThrow('503');
    expect(cache.set).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ daily recommendations */

describe('generateDailyRecommendations', () => {
  const data = (): Parameters<typeof generateDailyRecommendations>[1] => ({
    transactions: [{ id: 1, amount: '12', description: 'Lunch', date: daysAgo(1), type: 'expense' as const, categoryName: 'Food' }],
    summary: { totalIncome: 1000, totalExpenses: 400, netAmount: 600 },
    budgets: [{ id: 1, name: 'Food', amount: '300', categoryName: 'Food', period: 'monthly' }],
  });

  it('keeps real items, drops the ones with no title or text, and invents no English placeholder', async () => {
    create.mockResolvedValueOnce(reply({
      recommendations: [
        { id: 'r1', title: 'Cocina en casa', description: 'Ahorra', action: 'Planifica', impact: 'Alto' },
        { description: 'no title' },
      ],
      insights: [{ insight: 'Gastas más los viernes', confidence: 0.8 }, { basedOn: 'x' }],
    }));
    const result = await generateDailyRecommendations('u', data(), 'es-pe');

    expect(result.recommendations).toHaveLength(1);
    expect(result.insights).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/Financial Task|Take action|Positive financial impact|10 minutes|Transaction analysis|Recent activity/);
  });

  it('keys the cache on the language', async () => {
    create.mockResolvedValueOnce(reply({ recommendations: [], insights: [] }));
    await generateDailyRecommendations('u', data(), 'sk-sk');
    expect((cache.get.mock.calls[0][1] as any).language).toBe('sk-sk');
  });

  it('describes the model as a budgeting coach, never as an advisor', async () => {
    create.mockResolvedValueOnce(reply({ recommendations: [], insights: [] }));
    await generateDailyRecommendations('u', data(), 'en-us');
    expect(userOf()).not.toMatch(/financial advisor/i);
  });

  it('shows how much of each budget is already spent, and the gap when it is over', async () => {
    create.mockResolvedValueOnce(reply({ recommendations: [], insights: [] }));
    const withSpending = data();
    withSpending.budgets = [{ id: 1, name: 'Food', amount: '300', categoryName: 'Food', period: 'monthly', spent: 320 }];
    await generateDailyRecommendations('u', withSpending, 'en-us');

    expect(userOf()).toContain('limit 300.00, spent 320.00, over by 20.00');
  });

  it('reads the net figure whether the caller sends netBalance or netAmount', async () => {
    create.mockResolvedValueOnce(reply({ recommendations: [], insights: [] }));
    // The dashboard sends `netBalance`; this line used to read "Net Amount: 0.00".
    await generateDailyRecommendations('u', {
      ...data(),
      summary: { totalIncome: 1000, totalExpenses: 400, netBalance: 600 },
    }, 'en-us');

    expect(userOf()).toContain('Net Amount: 600.00');
  });

  it('throws on a provider failure and caches nothing', async () => {
    create.mockRejectedValueOnce(new Error('503'));
    await expect(generateDailyRecommendations('u', data(), 'en-us')).rejects.toThrow('503');
    expect(cache.set).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ financial advice */

const healthInput = () => ({
  summary: { totalIncome: 3000, totalExpenses: 2000, netBalance: 1000 },
  budgets: [{ categoryName: 'Food', amount: '500', spent: 620 }],
  transactions: [{ description: 'Migros', amount: 40, date: daysAgo(1), categoryName: 'Food', type: 'expense' }],
  categories: [
    { name: 'Food', amount: 620, share: 31, purchases: 8, average: 77.5, previousAverage: 400 },
  ],
  topMerchants: [{ description: 'Migros', amount: 120, count: 3 }],
  period: { start: '2026-10-01', end: '2026-10-31' },
});

const advice = {
  summary: 'You spent 2000 of 3000 and kept 1000. Food took 620.',
  observations: ['Food reached 620, above your usual 400.'],
  recommendations: [
    {
      action: 'Cap food at 500 a month',
      reason: 'Food reached 620, 120 over the budget',
      impact: 'Frees 120 a month',
      priority: 'high',
    },
  ],
  riskAssessment: 'Food is the only budget over its limit.',
  confidence: 0.8,
};

describe('generateAIFinancialHealthScore (the adviser)', () => {
  it('returns advice as actions, each carrying the figure behind it', async () => {
    create.mockResolvedValueOnce(reply(advice));
    const result = await generateAIFinancialHealthScore(healthInput(), 'en-us');

    expect(result.aiAnalysis.recommendations).toEqual([
      { action: 'Cap food at 500 a month', reason: 'Food reached 620, 120 over the budget', impact: 'Frees 120 a month', priority: 'high' },
    ]);
    expect(result.aiAnalysis.personalizedFactors).toEqual(['Food reached 620, above your usual 400.']);
    expect(result.aiAnalysis.summary).toContain('620');
  });

  it('does not ask the model to score the month: the app owns that number', async () => {
    create.mockResolvedValueOnce(reply(advice));
    const result = await generateAIFinancialHealthScore(healthInput(), 'en-us');

    expect(result.score).toBe(0);
    expect(systemOf()).toMatch(/do not score it/i);
    expect(systemOf()).not.toMatch(/maxima|four factors/i);
  });

  it('sends the categories, the budgets over their limit and the person\'s usual level', async () => {
    create.mockResolvedValueOnce(reply(advice));
    await generateAIFinancialHealthScore(healthInput(), 'en-us');

    const user = userOf();
    expect(user).toContain('Food: 620.00 (31.0% of expenses), 8 payment(s), average 77.50, usually 400.00');
    expect(user).toContain('Food: limit 500.00, spent 620.00, over by 120.00');
    expect(user).toContain('Migros: 120.00 over 3 payments');
  });

  it('keeps a bare string recommendation instead of dropping it', async () => {
    create.mockResolvedValueOnce(reply({ recommendations: ['Cancel the unused gym membership'] }));
    const result = await generateAIFinancialHealthScore(healthInput(), 'en-us');

    expect(result.aiAnalysis.recommendations).toEqual([
      { action: 'Cancel the unused gym membership', reason: '', impact: '', priority: 'medium' },
    ]);
  });

  it('treats a reply with no advice as a failure, not as an empty adviser', async () => {
    create.mockResolvedValueOnce(reply({ summary: 'Everything looks fine.' }));
    await expect(generateAIFinancialHealthScore(healthInput(), 'en-us')).rejects.toThrow(/no recommendations/);
  });

  it.each([['prose', 'You are doing great'], ['a failure', new Error('503')]])('throws on %s', async (_name, bad) => {
    if (bad instanceof Error) create.mockRejectedValueOnce(bad);
    else create.mockResolvedValueOnce(reply(bad));
    await expect(generateAIFinancialHealthScore(healthInput(), 'en-us')).rejects.toBeTruthy();
  });

  it('asks for the advice in the person\'s own language', async () => {
    create.mockResolvedValueOnce(reply(advice));
    await generateAIFinancialHealthScore(healthInput(), 'sk-sk');
    expect(systemOf()).toMatch(/slovak/i);
  });
});

/* ------------------------------------------------------------------ contextual tips */

describe('generateContextualFinancialTips', () => {
  const emptyData = () => ({
    summary: { totalIncome: 0, totalExpenses: 0, netBalance: 0, transactionCount: 0 },
    transactions: [],
    budgets: [],
    selectedMonth: 'October 2026',
  });

  it.each([
    ['sk-sk', 'Začnite svoju finančnú cestu'],
    ['es-pe', 'Empieza tu camino financiero'],
    ['en-us', 'Start Your Financial Journey'],
  ])('with no data gives the first tip in %s, without asking the model', async (language, title) => {
    const result = await generateContextualFinancialTips('u', emptyData(), language);
    expect(result.tips[0].title).toBe(title);
    expect(create).not.toHaveBeenCalled();
  });

  it('never lists income among the top spending categories', async () => {
    create.mockResolvedValueOnce(reply({ tips: [{ title: 'T', description: 'D', category: 'spending', priority: 'high', actionable: true }] }));

    await generateContextualFinancialTips('u', {
      summary: { totalIncome: 3000, totalExpenses: 500, netBalance: 2500, transactionCount: 2 },
      transactions: [
        { description: 'Salary', amount: 3000, category: 'Salary', date: daysAgo(2), type: 'income' as const },
        { description: 'Migros', amount: 500, category: 'Food', date: daysAgo(1), type: 'expense' as const },
      ],
      budgets: [],
      selectedMonth: 'October 2026',
    }, 'en-us');

    // The spending section runs until the budget section; a salary must not appear in it.
    const spendingSection = userOf().split('BUDGET STATUS')[0];
    expect(spendingSection).toContain('Food');
    expect(spendingSection).not.toContain('Salary');
  });

  it('on a provider failure answers with the localised progress tip and stores it as a failure', async () => {
    create.mockRejectedValueOnce(new Error('503'));
    const data = { ...emptyData(), summary: { totalIncome: 100, totalExpenses: 50, netBalance: 50, transactionCount: 2 },
      transactions: [{ description: 'x', amount: 5, category: 'Food', date: daysAgo(1), type: 'expense' as const }] };
    const result = await generateContextualFinancialTips('u', data, 'sk-sk');

    expect(result.tips[0].title).toBe('Sledujte svoj pokrok');
    const [, , , isError, ttl] = cache.set.mock.calls[0];
    expect([isError, ttl]).toEqual([true, 72]);
  });
});

/* ------------------------------------------------------------------ voice and statements */

describe('voiceExtraction', () => {
  it('uses the routed client with the voice model, not a private connection', async () => {
    create.mockResolvedValueOnce(reply('{"amount":"5.80"}'));
    const out = await voiceExtraction('u', { prompt: 'cinco ochenta de pan', language: 'es-pe' });

    expect(out).toBe('{"amount":"5.80"}');
    expect(create.mock.calls[0][0].model).toBe('mistral-small-latest');
    expect(systemOf()).toContain('Spanish');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws a clear error on a provider failure', async () => {
    create.mockRejectedValueOnce(new Error('503'));
    await expect(voiceExtraction('u', { prompt: 'x' })).rejects.toThrow('Failed to extract voice transaction data');
  });
});

describe('parseBankStatement', () => {
  it('maps transactions and fills defaults only for the optional fields', async () => {
    create.mockResolvedValueOnce(reply({ transactions: [{ date: '2026-10-01', description: 'Coop', amount: '-12.5' }] }));
    const { transactions } = await parseBankStatement('statement text', 'en-us');
    expect(transactions[0]).toMatchObject({ date: '2026-10-01', description: 'Coop', amount: -12.5, type: 'expense', category: null });
  });

  it('returns nothing for a reply without a transactions list', async () => {
    create.mockResolvedValueOnce(reply({ rows: [] }));
    expect(await parseBankStatement('x', 'en-us')).toEqual({ transactions: [] });
  });

  it.each([['prose', 'Here you go'], ['a failure', new Error('503')]])('throws on %s, so an import never "succeeds" empty', async (_name, bad) => {
    if (bad instanceof Error) create.mockRejectedValueOnce(bad);
    else create.mockResolvedValueOnce(reply(bad));
    await expect(parseBankStatement('x', 'en-us')).rejects.toThrow('Failed to parse bank statement transactions');
  });

  it('never caches a statement', async () => {
    create.mockResolvedValueOnce(reply({ transactions: [] }));
    await parseBankStatement('x', 'en-us');
    expect(cache.set).not.toHaveBeenCalled();
  });
});
