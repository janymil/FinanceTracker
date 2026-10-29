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

/**
 * The four paid plan keys, cheapest first.
 *
 * This order is the only thing that decides whether a plan change is an upgrade or a
 * downgrade, and both payment providers read it. Two copies of this list would eventually
 * disagree, and the side that disagrees gives away a plan or charges twice.
 */
export type PlanKey = 'standard' | 'standard-yearly' | 'premium' | 'premium-yearly';

export const PLAN_KEY_ORDER: readonly PlanKey[] = [
  'standard',
  'standard-yearly',
  'premium',
  'premium-yearly',
];

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === 'string' && (PLAN_KEY_ORDER as readonly string[]).includes(value);
}

/** `standard-yearly` -> `{ plan: 'standard', interval: 'yearly' }`; null when unknown. */
export function parsePlanKey(value: unknown): { plan: PlanId; interval: BillingInterval } | null {
  if (!isPlanKey(value)) return null;
  const yearly = value.endsWith('-yearly');
  return {
    plan: (yearly ? value.slice(0, -'-yearly'.length) : value) as PlanId,
    interval: yearly ? 'yearly' : 'monthly',
  };
}

/** 1..4, cheapest first; null when the pair is not a paid plan (free, legacy grants). */
export function planWeight(plan: string, interval: string | null | undefined): number | null {
  const key = interval === 'yearly' ? `${plan}-yearly` : plan;
  const index = PLAN_KEY_ORDER.indexOf(key as PlanKey);
  return index === -1 ? null : index + 1;
}

/**
 * Everything wrong with a provider price for a plan, as a list of plain statements.
 *
 * The interval and the amount are the two facts that decide a bill, and both have been wrong in
 * this account at once: "Standard Anual: S/ 99.90" pointed at a *monthly* S/ 99.90. A yearly
 * buyer would have been charged the annual amount every month. Pure so it can be tested without
 * a provider, and shared so Stripe and MercadoPago cannot disagree about what "correct" means.
 */
export function priceProblems(
  price: { amountCents: number | null; interval: string | null; currency: string },
  planKeyValue: unknown,
  currency: BillingCurrency,
): string[] {
  const parsed = parsePlanKey(planKeyValue);
  if (!parsed) return [`${String(planKeyValue)} is not a plan this app sells`];

  const expectedCents = Math.round(PLAN_PRICES[parsed.plan][currency][parsed.interval] * 100);
  const expectedInterval = parsed.interval === 'yearly' ? 'year' : 'month';
  const problems: string[] = [];

  if (price.currency.toLowerCase() !== currency) {
    problems.push(`currency is ${price.currency}, expected ${currency}`);
  }
  if (price.interval !== expectedInterval) {
    problems.push(`billed every ${price.interval ?? '?'}, expected every ${expectedInterval}`);
  }
  if (price.amountCents !== null && price.amountCents !== expectedCents) {
    problems.push(`amount is ${price.amountCents / 100}, expected ${expectedCents / 100}`);
  }

  return problems;
}

export type PlanChangeDirection = 'upgrade' | 'downgrade' | 'same' | 'unknown';

/**
 * Which way a plan change goes, from what the account is recorded as paying for.
 *
 * `upgrade` means "the customer is now entitled to more than they paid for" — it applies at
 * once and may be charged immediately. `downgrade` must never remove access before the paid
 * period ends. An account on `free` (or a manually granted plan) is not in the list, so any
 * paid target is an upgrade: granting early is recoverable, taking away paid access is not.
 */
export function changeDirection(
  current: { plan: string; billingInterval?: string | null },
  target: unknown
): PlanChangeDirection {
  if (!isPlanKey(target)) return 'unknown';
  const currentWeight = planWeight(current.plan, current.billingInterval);
  const targetWeight = planWeight(parsePlanKey(target)!.plan, parsePlanKey(target)!.interval);
  if (targetWeight === null) return 'unknown';
  if (currentWeight === null) return 'upgrade';
  if (targetWeight === currentWeight) return 'same';
  return targetWeight > currentWeight ? 'upgrade' : 'downgrade';
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
