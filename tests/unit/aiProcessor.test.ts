import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * runAI is the one entry point the routes use. It must pass the person's language to every
 * task, return the failure payload (never throw) when every provider failed, and record a
 * failure as a failure in the usage log even though nothing threw.
 */
const ai = vi.hoisted(() => ({
  categorizeExpense: vi.fn(),
  voiceExtraction: vi.fn(),
  generateContextualFinancialTips: vi.fn(),
  generateFinancialTips: vi.fn(),
  generateDailyRecommendations: vi.fn(),
  generateSpendingInsights: vi.fn(),
  generateAIFinancialHealthScore: vi.fn(),
  generateTrendPredictions: vi.fn(),
  generateExpensePredictions: vi.fn(),
  parseBankStatement: vi.fn(),
}));
const storage = vi.hoisted(() => ({
  canUseAIFunction: vi.fn(),
  recordAIUsage: vi.fn(),
}));
const reportSwallowed = vi.hoisted(() => vi.fn());

vi.mock('../../server/openai.js', () => ai);
vi.mock('../../server/storage.js', () => ({ storage }));
vi.mock('../../server/errorGuard/report.js', () => ({ reportSwallowed }));

import { runAI } from '../../lib/aiProcessor';

beforeEach(() => {
  Object.values(ai).forEach((fn) => fn.mockReset().mockResolvedValue({ ok: true }));
  storage.canUseAIFunction.mockReset().mockResolvedValue({ allowed: true });
  storage.recordAIUsage.mockReset().mockResolvedValue(undefined);
  reportSwallowed.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

const payload = { language: 'sk-sk', transactions: [{ id: 1 }], budgets: [{ categoryName: 'Food', amount: '10' }] };

describe('runAI passes the language to every task', () => {
  it.each([
    ['financial-tips', 'generateFinancialTips', 2],
    ['contextual-tips', 'generateContextualFinancialTips', 2],
    ['daily-recommendations', 'generateDailyRecommendations', 2],
    ['spending-insights', 'generateSpendingInsights', 2],
    ['financial-health-score', 'generateAIFinancialHealthScore', 1],
    ['expense-predictions', 'generateExpensePredictions', 2],
    ['parseBankStatement', 'parseBankStatement', 1],
  ])('%s -> %s', async (task, fn, languageIndex) => {
    await runAI(task, 'user_1', { ...payload, text: 'statement' }, 'premium');
    const args = (ai as any)[fn].mock.calls[0];
    expect(args[languageIndex]).toBe('sk-sk');
  });

  it('trend-predictions gets transactions, budgets and then the language', async () => {
    await runAI('trend-predictions', 'user_1', payload, 'premium');
    expect(ai.generateTrendPredictions).toHaveBeenCalledWith('user_1', payload.transactions, payload.budgets, 'sk-sk');
  });

  it('categorizeExpense gets the language and the person\'s own context', async () => {
    await runAI('categorizeExpense', 'user_1', {
      description: 'Migros', amount: 12, language: 'es-pe', userTransactions: [1], userCategories: [2],
    }, 'premium');
    expect(ai.categorizeExpense).toHaveBeenCalledWith('Migros', 12, 'es-pe', [1], [2]);
  });

  it('defaults to English only when no language was sent', async () => {
    await runAI('spending-insights', 'user_1', { transactions: [] }, 'premium');
    expect(ai.generateSpendingInsights.mock.calls[0][2]).toBe('en-us');
  });
});

describe('runAI failure handling', () => {
  it('returns the failure payload instead of throwing, and reports the swallow', async () => {
    ai.generateSpendingInsights.mockRejectedValueOnce(new Error('all providers failed'));
    const result = await runAI('spending-insights', 'user_1', payload, 'premium');

    expect(result).toEqual({
      error: 'AI service temporarily unavailable',
      message: 'Unable to process request at this time',
    });
    expect(reportSwallowed).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ where: 'runAI', route: '/ai/spending-insights' }),
    );
  });

  it('answers an unknown task with the failure payload rather than guessing', async () => {
    const result = await runAI('make-coffee', 'user_1', payload, 'premium');
    expect((result as any).error).toBeTruthy();
  });

  it('records a failure as an error row, with the reason', async () => {
    ai.generateTrendPredictions.mockRejectedValueOnce(new Error('boom'));
    await runAI('trend-predictions', 'user_1', payload, 'premium');

    expect(storage.recordAIUsage).toHaveBeenCalledTimes(1);
    expect(storage.recordAIUsage.mock.calls[0][0]).toMatchObject({
      functionName: 'trend-predictions', status: 'error', errorMessage: 'AI service temporarily unavailable',
    });
  });

  it('records a success as a success', async () => {
    await runAI('trend-predictions', 'user_1', payload, 'premium');
    expect(storage.recordAIUsage.mock.calls[0][0]).toMatchObject({ status: 'success', errorMessage: null });
  });

  it('refuses before any model call once the allowance for the function is used up', async () => {
    storage.canUseAIFunction.mockResolvedValueOnce({ allowed: false, reason: 'Monthly limit reached' });
    await expect(runAI('trend-predictions', 'user_1', payload, 'standard')).rejects.toThrow('Monthly limit reached');
    expect(ai.generateTrendPredictions).not.toHaveBeenCalled();
  });

  it('a failing usage log never breaks the answer', async () => {
    storage.recordAIUsage.mockRejectedValueOnce(new Error('db down'));
    const result = await runAI('trend-predictions', 'user_1', payload, 'premium');
    expect(result).toEqual({ ok: true });
  });
});
