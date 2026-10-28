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
  generateExpensePredictions,
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
    create.mockResolvedValue(reply({ recommendations: [{ action: 'Cap food at 500', reason: 'Food reached 620', impact: 'Frees 120', priority: 'high' }] }));
    await generateAIFinancialHealthScore({
      summary: { totalIncome: 3000, totalExpenses: 2100, netBalance: 900 },
      budgets: [],
      transactions: [],
    }, 'en-us');
    expect(systemOf()).toContain('HOUSE RULES');
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

  /*
   * The reply used to be cut off: one entry per category with three factors each, plus three monthly
   * rows carrying a per-category breakdown, did not fit in 1,500 tokens. Every call then failed as
   * "the model reply was not valid JSON" and the card said "Failed to generate predictions".
   */
  it('asks for an answer that fits its token budget', async () => {
    create.mockResolvedValueOnce(reply({
      categoryPredictions: [
        { category: 'Food', currentMonth: 100, predictedNext: 110, confidence: 0.7, trend: 'increasing', factors: ['x'] },
      ],
      monthlyPredictions: [{ month: '2026-11', predicted: 110, confidence: 0.7 }],
    }));
    await generateExpensePredictions('u', txs(), 'en-us');

    const request = create.mock.calls[0][0];
    expect(request.max_tokens).toBeGreaterThanOrEqual(3000);
    expect(userOf()).toContain('At most 8 categories');
    // The per-month breakdown was never rendered by the card; asking for it only spent tokens.
    expect(userOf()).not.toContain('"breakdown"');
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
  focus: {
    title: 'Food is 120 over its budget',
    body: 'Food reached 620 against a limit of 500. Your own average for this category is 400, so this month is a spike, not a new normal. Cap food at 500 and the month closes even.',
    estimatedSaving: 120,
  },
  summary: 'You spent 2000 of 3000 and kept 1000. Food took 620.',
  observations: [
    { title: 'Food over its usual level', body: 'Food reached 620, above your usual 400.' },
    'Groceries took 31% of everything you spent.',
  ],
  recommendations: [
    {
      title: 'Cap food at 500',
      action: 'Cap food at 500 a month',
      reason: 'Food reached 620, 120 over the budget',
      impact: 'Frees 120 a month',
      priority: 'high',
      timeToComplete: 'this week',
    },
  ],
  riskAssessment: 'Food is the only budget over its limit.',
  confidence: 0.8,
};

describe('generateAIFinancialHealthScore (the adviser)', () => {
  it('returns the four parts the card shows: focus, summary, observations, actions', async () => {
    create.mockResolvedValueOnce(reply(advice));
    const result = await generateAIFinancialHealthScore(healthInput(), 'en-us');

    expect(result.aiAnalysis.focus).toEqual({
      title: 'Food is 120 over its budget',
      body: expect.stringContaining('620'),
      estimatedSaving: 120,
    });
    expect(result.aiAnalysis.summary).toContain('620');
    expect(result.aiAnalysis.observations).toEqual([
      { title: 'Food over its usual level', body: 'Food reached 620, above your usual 400.' },
      { title: '', body: 'Groceries took 31% of everything you spent.' },
    ]);
    expect(result.aiAnalysis.recommendations).toEqual([
      {
        title: 'Cap food at 500',
        action: 'Cap food at 500 a month',
        reason: 'Food reached 620, 120 over the budget',
        impact: 'Frees 120 a month',
        priority: 'high',
        timeToComplete: 'this week',
      },
    ]);
    // The flat list stays for callers that only want the sentences.
    expect(result.aiAnalysis.personalizedFactors).toEqual([
      'Food reached 620, above your usual 400.',
      'Groceries took 31% of everything you spent.',
    ]);
  });

  it('does not ask the model to score the month: the app owns that number', async () => {
    create.mockResolvedValueOnce(reply(advice));
    const result = await generateAIFinancialHealthScore(healthInput(), 'en-us');

    expect(result.score).toBe(0);
    // The prompt tells the model it is the adviser, not the scorekeeper, and that the figures are
    // given to it rather than derived by it.
    expect(systemOf()).toMatch(/the only place\s+this person is\s+given advice/i);
    expect(systemOf()).not.toMatch(/four factors|max \d+/i);
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
      { title: '', action: 'Cancel the unused gym membership', reason: '', impact: '', priority: 'medium', timeToComplete: '' },
    ]);
  });

  it('signs the money it would free up only when the reply states one', async () => {
    create.mockResolvedValueOnce(reply({
      focus: { title: 'Something', body: 'A body with 120 in it.', estimatedSaving: 0 },
      recommendations: [{ action: 'Do a thing' }],
    }));
    const result = await generateAIFinancialHealthScore(healthInput(), 'en-us');

    // Zero and "not stated" are different claims: a 0 here would read as "this saves you nothing".
    expect(result.aiAnalysis.focus.estimatedSaving).toBeNull();
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
