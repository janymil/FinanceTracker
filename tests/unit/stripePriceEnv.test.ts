import { describe, expect, it } from 'vitest';
import {
  PRICE_ENV_KEYS,
  configuredReference,
  planAndInterval,
  readConfiguredReference,
} from '../../shared/stripePriceEnv';

/**
 * The checkout route only charges a plan whose reference it can read, and the price check
 * script reads the same table, so the fallback order and trimming rules are pinned here.
 */
describe('stripe price env table', () => {
  it('prefers the USD-specific key over the legacy name', () => {
    const env = {
      STRIPE_STANDARD_MONTHLY_USD_PRICE_ID: 'price_usd',
      STRIPE_STANDARD_MONTHLY_PRICE_ID: 'price_legacy',
    };
    expect(configuredReference('standard', 'usd', env)).toEqual({
      key: 'STRIPE_STANDARD_MONTHLY_USD_PRICE_ID',
      value: 'price_usd',
    });
  });

  it('falls back to the legacy key when the specific one is blank', () => {
    const env = {
      STRIPE_STANDARD_MONTHLY_USD_PRICE_ID: '   ',
      STRIPE_STANDARD_MONTHLY_PRICE_ID: 'price_legacy',
    };
    expect(readConfiguredReference('standard', 'usd', env)).toBe('price_legacy');
  });

  it('trims whitespace and surrounding quotes', () => {
    const env = { STRIPE_PREMIUM_YEARLY_PEN_PRICE_ID: '  "price_pen"  ' };
    expect(readConfiguredReference('premium-yearly', 'pen', env)).toBe('price_pen');
  });

  it('returns undefined when no key is set', () => {
    expect(configuredReference('premium', 'usd', {})).toBeUndefined();
  });

  it('maps every plan key to a plan and interval', () => {
    expect(planAndInterval('standard')).toEqual({ plan: 'standard', interval: 'monthly' });
    expect(planAndInterval('standard-yearly')).toEqual({ plan: 'standard', interval: 'yearly' });
    expect(planAndInterval('premium')).toEqual({ plan: 'premium', interval: 'monthly' });
    expect(planAndInterval('premium-yearly')).toEqual({ plan: 'premium', interval: 'yearly' });
  });

  it('names at least one env var for every plan and currency', () => {
    for (const currency of ['usd', 'pen'] as const) {
      for (const plan of ['standard', 'standard-yearly', 'premium', 'premium-yearly'] as const) {
        expect(PRICE_ENV_KEYS[currency][plan].length).toBeGreaterThan(0);
      }
    }
  });
});
