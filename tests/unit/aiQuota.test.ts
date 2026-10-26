import { describe, expect, it } from 'vitest';
import {
  AI_QUOTAS,
  actionsFor,
  dayStart,
  monthStart,
  nextResetAt,
  quotaForPlan,
  quotaState,
  weightFor,
} from '../../shared/aiQuota';

/**
 * The AI allowance a customer sees must be the one the server enforces. These are the rules
 * behind both numbers, so the meter and the gate can never drift apart.
 */
describe('AI quota rules', () => {
  it('counts an expensive function as more than one action', () => {
    expect(weightFor('categorizeExpense')).toBe(1);
    expect(weightFor('receipt-extraction')).toBe(3);
    expect(weightFor('a feature nobody has written yet')).toBe(1);
    expect(weightFor('tts')).toBe(1);
    expect(weightFor('voice-entry')).toBe(2);
    expect(weightFor('mascot-image')).toBe(3);
    expect(weightFor('parseBankStatement')).toBe(3);

    expect(
      actionsFor([
        { functionName: 'receipt-extraction', calls: 2 }, // 6
        { functionName: 'financial-tips', calls: 3 }, // 3
      ]),
    ).toBe(9);
  });

  it('treats an unknown plan as no AI at all', () => {
    expect(quotaForPlan('platinum')).toEqual(AI_QUOTAS.free);
    expect(quotaForPlan(undefined).monthlyActions).toBe(0);
    expect(quotaForPlan(null).monthlyActions).toBe(0);
  });

  it('resets on the first day of the next month', () => {
    const now = new Date(2026, 9, 25, 17, 30); // 25 Oct 2026, local time
    expect(monthStart(now).getMonth()).toBe(9);
    expect(monthStart(now).getDate()).toBe(1);
    expect(dayStart(now).getDate()).toBe(25);

    const reset = nextResetAt(now);
    expect(reset.getMonth()).toBe(10);
    expect(reset.getDate()).toBe(1);
  });

  it('is ok below 80%, warns from 80%, and blocks at the limit', () => {
    const base = { plan: 'standard', dailyUsed: 0 };
    expect(quotaState({ ...base, monthlyUsed: 10 }).state).toBe('ok');
    expect(quotaState({ ...base, monthlyUsed: 239 }).state).toBe('ok');
    expect(quotaState({ ...base, monthlyUsed: 240 }).state).toBe('warning');
    expect(quotaState({ ...base, monthlyUsed: 300 }).state).toBe('blocked');
    expect(quotaState({ ...base, monthlyUsed: 299 }).monthlyRemaining).toBe(1);
  });

  it('stops one person from spending the whole month in a day', () => {
    const state = quotaState({ plan: 'premium', monthlyUsed: 5, dailyUsed: 100 });
    expect(state.dailyLimit).toBe(100);
    expect(state.dailyRemaining).toBe(0);
    expect(state.state).toBe('blocked');
  });

  it('reports the free plan as blocked with no limit, so the app can offer the upgrade', () => {
    const state = quotaState({ plan: 'free', monthlyUsed: 0, dailyUsed: 0 });
    expect(state.monthlyLimit).toBe(0);
    expect(state.monthlyRemaining).toBe(0);
    expect(state.state).toBe('blocked');
  });

  it('never reports more remaining than the plan includes', () => {
    const state = quotaState({ plan: 'standard', monthlyUsed: 400, dailyUsed: 0 });
    expect(state.monthlyRemaining).toBe(0);
    expect(state.usedRatio).toBe(1);
  });
});
