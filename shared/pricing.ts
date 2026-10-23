/**
 * One price list for the whole app.
 *
 * The numbers below mirror the *live* Stripe prices (usd and pen). Stripe remains the
 * authority for charging; this file exists so the price shown on the page is the price
 * that will be charged, and so the page can be translated without touching amounts.
 *
 * Currency rule: the language the visitor is browsing decides it — Spanish pages quote
 * soles (the Peru market), everything else quotes US dollars. A user can change language
 * in the footer, which changes the currency with it.
 */
export type PlanId = 'standard' | 'premium';
export type BillingInterval = 'monthly' | 'yearly';
export type BillingCurrency = 'usd' | 'pen';

export interface PlanAmounts {
  monthly: number;
  yearly: number;
}

export const PLAN_PRICES: Record<PlanId, Record<BillingCurrency, PlanAmounts>> = {
  standard: {
    usd: { monthly: 4.99, yearly: 49.9 },
    pen: { monthly: 9.9, yearly: 99.9 },
  },
  premium: {
    usd: { monthly: 9.9, yearly: 99.9 },
    pen: { monthly: 19.9, yearly: 199.9 },
  },
};

/** `standard` + `yearly` -> `standard-yearly` (the key the API and metadata use). */
export function planKey(plan: PlanId, interval: BillingInterval): string {
  return interval === 'yearly' ? `${plan}-yearly` : plan;
}

/** Language (`sk`, `en`, `es`, `es-pe`, …) -> billing currency. */
export function currencyForLanguage(language: string | undefined | null): BillingCurrency {
  return String(language ?? '').toLowerCase().startsWith('es') ? 'pen' : 'usd';
}

export function normalizeCurrency(value: unknown): BillingCurrency | undefined {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'usd' || raw === 'pen') return raw;
  return undefined;
}

export function amountFor(plan: PlanId, interval: BillingInterval, currency: BillingCurrency): number {
  return PLAN_PRICES[plan][currency][interval];
}

/** Amount saved per year compared with paying monthly. */
export function yearlySaving(plan: PlanId, currency: BillingCurrency): number {
  const { monthly, yearly } = PLAN_PRICES[plan][currency];
  return Math.round((monthly * 12 - yearly) * 100) / 100;
}

/** Monthly equivalent of the yearly price, for the "≈ x / month" hint. */
export function monthlyEquivalent(plan: PlanId, currency: BillingCurrency): number {
  return Math.round((PLAN_PRICES[plan][currency].yearly / 12) * 100) / 100;
}

const LOCALE_BY_CURRENCY: Record<BillingCurrency, string> = {
  usd: 'en-US',
  pen: 'es-PE',
};

/** Locale-aware money label: `$4.99`, `S/ 9.90`. */
export function formatMoney(amount: number, currency: BillingCurrency): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
