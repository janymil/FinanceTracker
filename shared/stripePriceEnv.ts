/**
 * Which env var holds the Stripe price reference for each plan.
 *
 * Lives in `shared/` so the server (checkout + subscription changes) and
 * `scripts/check-stripe-prices.ts` read the same table: a plan can only be sold if its
 * reference resolves to an active price with the amount and interval the page promised.
 *
 * A reference may be a `price_…` id (preferred — it pins the interval) or a `prod_…` id,
 * which the server resolves through the product's default price.
 */
export type StripePlanKey = 'standard' | 'standard-yearly' | 'premium' | 'premium-yearly';
export type StripeBillingCurrency = 'usd' | 'pen';

export const PRICE_ENV_KEYS: Record<StripeBillingCurrency, Record<StripePlanKey, string[]>> = {
  usd: {
    'standard': ['STRIPE_STANDARD_MONTHLY_USD_PRICE_ID', 'STRIPE_STANDARD_MONTHLY_PRICE_ID'],
    'standard-yearly': ['STRIPE_STANDARD_YEARLY_USD_PRICE_ID', 'STRIPE_STANDARD_YEARLY_PRICE_ID'],
    'premium': ['STRIPE_PREMIUM_MONTHLY_USD_PRICE_ID', 'STRIPE_PREMIUM_MONTHLY_PRICE_ID'],
    'premium-yearly': ['STRIPE_PREMIUM_YEARLY_USD_PRICE_ID', 'STRIPE_PREMIUM_YEARLY_PRICE_ID'],
  },
  pen: {
    'standard': ['STRIPE_STANDARD_MONTHLY_PEN_PRICE_ID'],
    'standard-yearly': ['STRIPE_STANDARD_YEARLY_PEN_PRICE_ID'],
    'premium': ['STRIPE_PREMIUM_MONTHLY_PEN_PRICE_ID'],
    'premium-yearly': ['STRIPE_PREMIUM_YEARLY_PEN_PRICE_ID'],
  },
};

export interface ConfiguredReference {
  /** The env var that supplied the value (the first one that is set). */
  key: string;
  /** The reference itself, without surrounding quotes. */
  value: string;
}

/** First non-empty reference for a plan, quotes trimmed. */
export function configuredReference(
  plan: StripePlanKey,
  currency: StripeBillingCurrency,
  env: NodeJS.ProcessEnv = process.env,
): ConfiguredReference | undefined {
  for (const key of PRICE_ENV_KEYS[currency][plan]) {
    const raw = env[key];
    if (!raw) continue;
    const value = raw.trim().replace(/^["']|["']$/g, '');
    if (value) return { key, value };
  }
  return undefined;
}

/** Just the reference; `undefined` when the plan has no env var set. */
export function readConfiguredReference(
  plan: StripePlanKey,
  currency: StripeBillingCurrency,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return configuredReference(plan, currency, env)?.value;
}

/** `standard-yearly` -> `standard` + `yearly`; `premium` -> `premium` + `monthly`. */
export function planAndInterval(plan: StripePlanKey): {
  plan: 'standard' | 'premium';
  interval: 'monthly' | 'yearly';
} {
  const yearly = plan.endsWith('-yearly');
  return {
    plan: (yearly ? plan.slice(0, -'-yearly'.length) : plan) as 'standard' | 'premium',
    interval: yearly ? 'yearly' : 'monthly',
  };
}
