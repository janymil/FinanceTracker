import { describe, expect, it } from 'vitest';
import {
  changeDirection,
  parsePlanKey,
  planKey,
  planWeight,
  priceProblems,
  PLAN_KEY_ORDER,
} from '../../shared/pricing';

/**
 * The rules that decide what a customer is charged, kept away from both payment providers.
 *
 * Every bug this file pins down has already cost money once:
 *  - a yearly plan sold on a monthly price (charged every month, forever);
 *  - a monthly plan mistaken for a downgrade when it was an upgrade (access granted late, or
 *    charged twice for the same days);
 *  - a plan the list did not know being treated as a downgrade (paid access taken away).
 */
describe('plan keys', () => {
  it('has exactly the four paid plans, cheapest first', () => {
    expect(PLAN_KEY_ORDER).toEqual(['standard', 'standard-yearly', 'premium', 'premium-yearly']);
    expect(planWeight('standard', 'monthly')).toBe(1);
    expect(planWeight('premium', 'yearly')).toBe(4);
    expect(planWeight('free', 'monthly')).toBeNull();
  });

  it('maps a key back to plan and interval', () => {
    expect(parsePlanKey('premium-yearly')).toEqual({ plan: 'premium', interval: 'yearly' });
    expect(parsePlanKey('standard')).toEqual({ plan: 'standard', interval: 'monthly' });
    expect(parsePlanKey('platinum')).toBeNull();
    expect(parsePlanKey('')).toBeNull();
    expect(planKey('premium', 'yearly')).toBe('premium-yearly');
  });
});

describe('change direction — the customer’s own rules', () => {
  const account = (plan: string, billingInterval = 'monthly') => ({ plan, billingInterval });

  it('lets a monthly plan move to premium', () => {
    expect(changeDirection(account('standard'), 'premium')).toBe('upgrade');
  });

  it('lets a monthly plan move to standard yearly', () => {
    expect(changeDirection(account('standard'), 'standard-yearly')).toBe('upgrade');
  });

  it('lets premium monthly move to premium yearly', () => {
    expect(changeDirection(account('premium'), 'premium-yearly')).toBe('upgrade');
  });

  it('calls a step down a downgrade, never an upgrade', () => {
    expect(changeDirection(account('premium'), 'standard')).toBe('downgrade');
    expect(changeDirection(account('premium', 'yearly'), 'premium')).toBe('downgrade');
    expect(changeDirection(account('premium'), 'standard-yearly')).toBe('downgrade');
  });

  it('recognises the plan the account already has', () => {
    expect(changeDirection(account('premium'), 'premium')).toBe('same');
    expect(changeDirection(account('standard', 'yearly'), 'standard-yearly')).toBe('same');
  });

  it('grants, never removes, when the recorded plan is not a paid one', () => {
    expect(changeDirection(account('free'), 'standard')).toBe('upgrade');
    expect(changeDirection(account('legacy-gift'), 'premium')).toBe('upgrade');
  });

  it('refuses a plan it does not know', () => {
    expect(changeDirection(account('premium'), 'platinum')).toBe('unknown');
    expect(changeDirection(account('premium'), '')).toBe('unknown');
  });
});

describe('price problems — a yearly plan can never sit on a monthly price', () => {
  it('accepts the four correct prices', () => {
    expect(priceProblems({ amountCents: 499, interval: 'month', currency: 'usd' }, 'standard', 'usd')).toEqual([]);
    expect(priceProblems({ amountCents: 4990, interval: 'year', currency: 'usd' }, 'standard-yearly', 'usd')).toEqual([]);
    expect(priceProblems({ amountCents: 1990, interval: 'month', currency: 'pen' }, 'premium', 'pen')).toEqual([]);
    expect(priceProblems({ amountCents: 19990, interval: 'year', currency: 'pen' }, 'premium-yearly', 'pen')).toEqual([]);
  });

  it('rejects the live misconfiguration: annual product, monthly S/ 99.90 price', () => {
    const problems = priceProblems(
      { amountCents: 9990, interval: 'month', currency: 'pen' },
      'standard-yearly',
      'pen',
    );
    expect(problems.join(' | ')).toContain('billed every month, expected every year');
  });

  it('rejects the right interval with the wrong amount', () => {
    const problems = priceProblems(
      { amountCents: 19990, interval: 'month', currency: 'pen' },
      'standard',
      'pen',
    );
    expect(problems.join(' | ')).toContain('amount is 199.9, expected 9.9');
  });

  it('rejects a price in the other currency', () => {
    const problems = priceProblems(
      { amountCents: 999, interval: 'year', currency: 'usd' },
      'standard-yearly',
      'pen',
    );
    expect(problems.join(' | ')).toContain('currency is usd, expected pen');
  });

  it('rejects a plan key it does not sell', () => {
    expect(priceProblems({ amountCents: 100, interval: 'month', currency: 'pen' }, 'gold', 'pen')).toHaveLength(1);
  });
});
