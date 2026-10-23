import { describe, expect, it } from 'vitest';
import {
  PLAN_PRICES,
  amountFor,
  currencyForLanguage,
  formatMoney,
  monthlyEquivalent,
  normalizeCurrency,
  planKey,
  yearlySaving,
} from '../../shared/pricing';

/**
 * These tests exist for one reason: the page must never show a number that Stripe will
 * not charge. The values below are copied from the live Stripe price list (usd + pen);
 * if Stripe changes, this test is the reminder to update both sides together.
 */
describe('pricing catalog', () => {
  it('matches the live Stripe amounts', () => {
    expect(PLAN_PRICES.standard.usd).toEqual({ monthly: 4.99, yearly: 49.9 });
    expect(PLAN_PRICES.standard.pen).toEqual({ monthly: 9.9, yearly: 99.9 });
    expect(PLAN_PRICES.premium.usd).toEqual({ monthly: 9.9, yearly: 99.9 });
    expect(PLAN_PRICES.premium.pen).toEqual({ monthly: 19.9, yearly: 199.9 });
  });

  it('gives Peru soles and everybody else dollars', () => {
    expect(currencyForLanguage('es')).toBe('pen');
    expect(currencyForLanguage('es-pe')).toBe('pen');
    expect(currencyForLanguage('ES')).toBe('pen');
    expect(currencyForLanguage('sk')).toBe('usd');
    expect(currencyForLanguage('en-us')).toBe('usd');
    expect(currencyForLanguage(undefined)).toBe('usd');
    expect(currencyForLanguage(null)).toBe('usd');
  });

  it('accepts only the two supported currencies from a request', () => {
    expect(normalizeCurrency('pen')).toBe('pen');
    expect(normalizeCurrency('USD')).toBe('usd');
    expect(normalizeCurrency('eur')).toBeUndefined();
    expect(normalizeCurrency(undefined)).toBeUndefined();
  });

  it('builds the plan key used by the API', () => {
    expect(planKey('standard', 'monthly')).toBe('standard');
    expect(planKey('standard', 'yearly')).toBe('standard-yearly');
    expect(planKey('premium', 'yearly')).toBe('premium-yearly');
  });

  it('calculates the yearly saving in exact cents, not floats', () => {
    expect(yearlySaving('standard', 'usd')).toBe(9.98);
    expect(yearlySaving('premium', 'usd')).toBe(18.9);
    expect(yearlySaving('standard', 'pen')).toBe(18.9);
    expect(yearlySaving('premium', 'pen')).toBe(38.9);
  });

  it('shows a monthly equivalent of the yearly price', () => {
    expect(monthlyEquivalent('standard', 'usd')).toBe(4.16);
    expect(monthlyEquivalent('premium', 'pen')).toBe(16.66);
  });

  it('formats money with the right symbol for each market', () => {
    expect(formatMoney(amountFor('standard', 'monthly', 'usd'), 'usd')).toContain('$');
    expect(formatMoney(amountFor('standard', 'monthly', 'usd'), 'usd')).toContain('4.99');
    expect(formatMoney(amountFor('standard', 'monthly', 'pen'), 'pen')).toContain('9.90');
  });
});
