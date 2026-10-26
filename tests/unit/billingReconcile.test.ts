import { beforeAll, describe, expect, it, vi } from 'vitest';

// The script reaches the database through `storage` and the providers through their modules. The
// rule under test is pure, so everything around it is stubbed and no network or database is used.
vi.mock('../../server/storage', () => ({ storage: {} }));
vi.mock('../../server/errorGuard/jobs', () => ({ withJobRun: vi.fn() }));
vi.mock('../../server/mercadopago', () => ({ getPreapproval: vi.fn(), isMercadoPagoConfigured: () => false }));

let planKeyFor: typeof import('../../scripts/billing-reconcile')['planKeyFor'];

beforeAll(async () => {
  ({ planKeyFor } = await import('../../scripts/billing-reconcile'));
});

/**
 * Which plan an account row implies.
 *
 * The reconciliation compares this against the price the provider says the customer is on. A
 * wrong answer here has two costly shapes: a paying customer reported as drift, or a real
 * disagreement reported as agreement.
 */
describe('planKeyFor', () => {
  it('maps the four paid combinations', () => {
    expect(planKeyFor('standard', 'monthly')).toBe('standard');
    expect(planKeyFor('standard', 'yearly')).toBe('standard-yearly');
    expect(planKeyFor('premium', 'monthly')).toBe('premium');
    expect(planKeyFor('premium', 'yearly')).toBe('premium-yearly');
  });

  it('treats a free account as no paid key', () => {
    expect(planKeyFor('free', 'monthly')).toBe('');
    expect(planKeyFor('free', 'yearly')).toBe('');
  });

  it('ignores an unknown plan rather than inventing a key', () => {
    // A plan granted by hand must not look like a subscription the provider would recognise.
    expect(planKeyFor('legacy-gift', 'monthly')).toBe('');
  });

  it('assumes monthly when the interval is missing', () => {
    expect(planKeyFor('premium', null)).toBe('premium');
  });
});
