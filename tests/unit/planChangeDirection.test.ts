import { beforeAll, describe, expect, it, vi } from 'vitest';

// The route module reaches the database through `storage`. A pure decision like the one under
// test does not need it, and mocking it keeps this file free of a database import.
vi.mock('../../server/storage', () => ({ storage: {} }));

let planChangeDirection: typeof import('../../server/routes/stripeRoutes')['planChangeDirection'];

beforeAll(async () => {
  ({ planChangeDirection } = await import('../../server/routes/stripeRoutes'));
});

/**
 * Which way a plan change goes decides whether money moves *now*.
 *
 * A downgrade mistaken for an upgrade charges the customer a second time for days they have
 * already paid for; an upgrade mistaken for a downgrade leaves them on the cheaper plan while
 * being billed the higher price. Neither is recoverable by a support reply, so the rule is pinned
 * here, away from Stripe.
 */
const user = (plan: string, billingInterval = 'monthly') => ({ plan, billingInterval } as any);

describe('plan changes', () => {
  it('treats a higher plan as an upgrade', () => {
    expect(planChangeDirection(user('standard'), 'premium')).toBe('upgrade');
    expect(planChangeDirection(user('standard'), 'standard-yearly')).toBe('upgrade');
    expect(planChangeDirection(user('standard', 'yearly'), 'premium-yearly')).toBe('upgrade');
  });

  it('treats a lower plan as a downgrade', () => {
    expect(planChangeDirection(user('premium'), 'standard')).toBe('downgrade');
    expect(planChangeDirection(user('premium', 'yearly'), 'premium')).toBe('downgrade');
    expect(planChangeDirection(user('premium'), 'standard-yearly')).toBe('downgrade');
  });

  it('recognises the plan the account already has', () => {
    expect(planChangeDirection(user('premium'), 'premium')).toBe('same');
    expect(planChangeDirection(user('standard', 'yearly'), 'standard-yearly')).toBe('same');
  });

  it('grants, never removes, when the recorded plan is not a paid one', () => {
    // A manually granted or free plan is unknown to the order list. Treating it as an upgrade is
    // the safe direction: it applies the new plan at once instead of ending something paid for.
    expect(planChangeDirection(user('free'), 'standard')).toBe('upgrade');
    expect(planChangeDirection(user('legacy-gift'), 'premium')).toBe('upgrade');
  });

  it('refuses a plan it does not know', () => {
    expect(planChangeDirection(user('premium'), 'platinum')).toBe('unknown');
    expect(planChangeDirection(user('premium'), '')).toBe('unknown');
  });
});
