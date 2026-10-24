import { describe, expect, it, vi } from 'vitest';

// The module imports storage and the model code for its defaults; the tests inject their own.
vi.mock('../../server/storage', () => ({ storage: {} }));
vi.mock('../../server/openai', () => ({ categorizeExpenseWithUserCategories: vi.fn() }));
vi.mock('../../server/clerkAuth', () => ({ getUserId: () => undefined }));

import {
  AUTO_APPLY_CONFIDENCE,
  autoCategorizeTransaction,
  type AutoCategorizeDeps,
} from '../../server/autoCategorize';

const categories = [
  { id: 1, name: 'Groceries', type: 'expense' },
  { id: 2, name: 'Salary', type: 'income' },
  { id: 3, name: 'Transport', type: 'expense' },
];

const expense = { id: 50, description: 'Migros', amount: '23.40', type: 'expense', categoryId: null };

function deps(overrides: Partial<AutoCategorizeDeps> = {}): AutoCategorizeDeps & Record<string, any> {
  return {
    checkAccess: vi.fn().mockResolvedValue({ userId: 'u1', plan: 'premium', aiEnabled: true, allowed: true }),
    getCategories: vi.fn().mockResolvedValue(categories),
    categorize: vi.fn().mockResolvedValue({ categoryId: 1, confidence: 0.9, reasoning: 'grocery chain' }),
    applyCategory: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe('autoCategorizeTransaction', () => {
  it('applies a confident answer that is one of the person\'s own categories', async () => {
    const d = deps();
    const outcome = await autoCategorizeTransaction(expense, 'u1', 'es-pe', d);

    expect(outcome).toEqual({ applied: true, categoryId: 1, confidence: 0.9 });
    expect(d.applyCategory).toHaveBeenCalledWith(50, 'u1', 1);
  });

  it('shows the model only expense categories, with the amount as a number and the person\'s language', async () => {
    const d = deps();
    await autoCategorizeTransaction(expense, 'u1', 'sk-sk', d);

    const [description, amount, shown, language] = (d.categorize as any).mock.calls[0];
    expect(description).toBe('Migros');
    expect(amount).toBe(23.4);
    expect(shown.map((c: any) => c.name)).toEqual(['Groceries', 'Transport']);
    expect(language).toBe('sk-sk');
  });

  it('does nothing, and calls no AI, when the account switched AI off', async () => {
    const d = deps({
      checkAccess: vi.fn().mockResolvedValue({ userId: 'u1', plan: 'premium', aiEnabled: false, allowed: false, code: 'ai_disabled' }),
    });
    const outcome = await autoCategorizeTransaction(expense, 'u1', 'en-us', d);

    expect(outcome).toEqual({ applied: false, reason: 'ai-denied' });
    expect(d.categorize).not.toHaveBeenCalled();
    expect(d.getCategories).not.toHaveBeenCalled();
  });

  it.each(['standard', 'free'])('is a Premium feature: %s accounts are left alone', async (plan) => {
    const d = deps({
      checkAccess: vi.fn().mockResolvedValue({ userId: 'u1', plan, aiEnabled: true, allowed: plan !== 'free', code: plan === 'free' ? 'plan_required' : undefined }),
    });
    const outcome = await autoCategorizeTransaction(expense, 'u1', 'en-us', d);

    expect(outcome.applied).toBe(false);
    expect(d.categorize).not.toHaveBeenCalled();
  });

  it('skips income, and anything the person already categorised, without checking access', async () => {
    const d = deps();
    expect(await autoCategorizeTransaction({ ...expense, type: 'income' }, 'u1', 'en-us', d)).toEqual({ applied: false, reason: 'not-eligible' });
    expect(await autoCategorizeTransaction({ ...expense, categoryId: 4 }, 'u1', 'en-us', d)).toEqual({ applied: false, reason: 'not-eligible' });
    expect(d.checkAccess).not.toHaveBeenCalled();
  });

  it('does not guess when the person has no expense categories', async () => {
    const d = deps({ getCategories: vi.fn().mockResolvedValue([categories[1]]) });
    expect(await autoCategorizeTransaction(expense, 'u1', 'en-us', d)).toEqual({ applied: false, reason: 'no-categories' });
    expect(d.categorize).not.toHaveBeenCalled();
  });

  it('leaves a failed answer alone', async () => {
    const d = deps({ categorize: vi.fn().mockResolvedValue({ confidence: 0.1, reasoning: 'x', failed: true }) });
    expect(await autoCategorizeTransaction(expense, 'u1', 'en-us', d)).toEqual({ applied: false, reason: 'no-answer' });
    expect(d.applyCategory).not.toHaveBeenCalled();
  });

  it('leaves a suggestion without a category id alone (a new name is for the person to confirm)', async () => {
    const d = deps({ categorize: vi.fn().mockResolvedValue({ suggestedCategory: 'Pets', confidence: 0.95, reasoning: 'x' }) });
    expect(await autoCategorizeTransaction(expense, 'u1', 'en-us', d)).toEqual({ applied: false, reason: 'no-answer' });
    expect(d.applyCategory).not.toHaveBeenCalled();
  });

  it('leaves a low-confidence answer alone, and applies one exactly at the threshold', async () => {
    const low = deps({ categorize: vi.fn().mockResolvedValue({ categoryId: 1, confidence: AUTO_APPLY_CONFIDENCE - 0.01, reasoning: 'x' }) });
    expect(await autoCategorizeTransaction(expense, 'u1', 'en-us', low)).toEqual({ applied: false, reason: 'low-confidence' });
    expect(low.applyCategory).not.toHaveBeenCalled();

    const edge = deps({ categorize: vi.fn().mockResolvedValue({ categoryId: 3, confidence: AUTO_APPLY_CONFIDENCE, reasoning: 'x' }) });
    expect((await autoCategorizeTransaction(expense, 'u1', 'en-us', edge)).applied).toBe(true);
  });
});
