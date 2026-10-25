/**
 * Checks that every plan the app sells has a Stripe price reference that resolves to an
 * active price with the amount and interval `shared/pricing.ts` promises.
 *
 *   npm run check:stripe-prices                                 # live/prod `.env`
 *   STRIPE_SECRET_KEY=rk_test_... npm run check:stripe-prices   # rehearse in the sandbox
 *   npm run check:stripe-prices -- --json
 *
 * Read-only: it calls `products.retrieve`, `prices.retrieve` and `prices.list` and never
 * writes to Stripe. Exit code 0 = every plan is sellable, 1 = at least one plan would fail
 * at `/api/create-checkout-session` (missing env var, wrong interval, wrong amount).
 *
 * The table it reads is `shared/stripePriceEnv.ts` — the same one the route uses, so this
 * cannot drift from what the server actually charges.
 */
import 'dotenv/config';
import Stripe from 'stripe';
import { PLAN_PRICES, formatMoney, type BillingCurrency } from '../shared/pricing';
import {
  PRICE_ENV_KEYS,
  configuredReference,
  planAndInterval,
  type StripePlanKey,
} from '../shared/stripePriceEnv';

type Verdict = 'ok' | 'no-env' | 'unresolved' | 'wrong-currency' | 'wrong-interval' | 'wrong-amount';

interface PlanCheck {
  plan: StripePlanKey;
  currency: BillingCurrency;
  envKey: string | null;
  reference: string | null;
  priceId: string | null;
  amount: number | null;
  expectedAmount: number;
  interval: string | null;
  expectedInterval: 'month' | 'year';
  verdict: Verdict;
  reason: string;
}

const CURRENCIES: BillingCurrency[] = ['usd', 'pen'];
const PLANS: StripePlanKey[] = ['standard', 'standard-yearly', 'premium', 'premium-yearly'];

function expectedInterval(plan: StripePlanKey): 'month' | 'year' {
  return planAndInterval(plan).interval === 'yearly' ? 'year' : 'month';
}

function expectedAmount(plan: StripePlanKey, currency: BillingCurrency): number {
  const { plan: base, interval } = planAndInterval(plan);
  return PLAN_PRICES[base][currency][interval];
}

/** Stripe key prefix -> which environment the script is talking to. Never prints the key. */
function keyMode(key: string): string {
  if (/^(sk|rk)_live_/.test(key)) return 'live';
  if (/^(sk|rk)_test_/.test(key)) return 'test';
  return 'unknown';
}

/** Same resolution rule as `resolvePriceId()` in `server/routes/stripeRoutes.ts`. */
async function resolvePriceId(stripe: Stripe, reference: string): Promise<string | null> {
  if (reference.startsWith('price_')) return reference;
  if (!reference.startsWith('prod_')) return null;

  const product = await stripe.products.retrieve(reference, { expand: ['default_price'] });
  const defaultPrice = product.default_price;
  if (defaultPrice) return typeof defaultPrice === 'string' ? defaultPrice : defaultPrice.id;

  const prices = await stripe.prices.list({ product: reference, active: true, limit: 1 });
  return prices.data[0]?.id ?? null;
}

async function checkPlan(
  stripe: Stripe,
  plan: StripePlanKey,
  currency: BillingCurrency,
): Promise<PlanCheck> {
  const expected = expectedAmount(plan, currency);
  const intervalWanted = expectedInterval(plan);
  const configured = configuredReference(plan, currency);
  const base: PlanCheck = {
    plan,
    currency,
    envKey: configured?.key ?? null,
    reference: configured?.value ?? null,
    priceId: null,
    amount: null,
    expectedAmount: expected,
    interval: null,
    expectedInterval: intervalWanted,
    verdict: 'ok',
    reason: '',
  };

  if (!configured) {
    return {
      ...base,
      verdict: 'no-env',
      reason: `no env var set (${PRICE_ENV_KEYS[currency][plan].join(' | ')})`,
    };
  }

  const priceId = await resolvePriceId(stripe, configured.value);
  if (!priceId) {
    return { ...base, verdict: 'unresolved', reason: `${configured.value} is not a price or product id` };
  }

  const price = await stripe.prices.retrieve(priceId);
  const amount = typeof price.unit_amount === 'number' ? price.unit_amount / 100 : null;
  const row: PlanCheck = { ...base, priceId, amount, interval: price.recurring?.interval ?? null };

  if (price.currency !== currency) {
    return { ...row, verdict: 'wrong-currency', reason: `price is ${price.currency}, expected ${currency}` };
  }
  if (!price.active) {
    return { ...row, verdict: 'unresolved', reason: `price ${priceId} is inactive` };
  }
  if (row.interval !== intervalWanted) {
    return {
      ...row,
      verdict: 'wrong-interval',
      reason: `bills every ${row.interval ?? 'n/a'}, expected ${intervalWanted}`,
    };
  }
  if (amount === null || Math.round(amount * 100) !== Math.round(expected * 100)) {
    const actual = amount === null ? 'no amount' : formatMoney(amount, currency);
    return {
      ...row,
      verdict: 'wrong-amount',
      reason: `${actual}, expected ${formatMoney(expected, currency)}`,
    };
  }
  return row;
}

function printTable(rows: PlanCheck[], mode: string): void {
  const header = ['plan', 'cur', 'env var', 'reference', 'price', 'interval', 'amount', 'result'];
  const body = rows.map((row) => [
    row.plan,
    row.currency,
    row.envKey ?? '-',
    row.reference ?? '-',
    row.priceId ?? '-',
    `${row.interval ?? '-'} (want ${row.expectedInterval})`,
    row.amount === null
      ? `- (want ${formatMoney(row.expectedAmount, row.currency)})`
      : formatMoney(row.amount, row.currency),
    row.verdict === 'ok' ? 'ok' : `FAIL ${row.verdict}: ${row.reason}`,
  ]);

  const widths = header.map((title, index) =>
    Math.max(title.length, ...body.map((cells) => cells[index].length)),
  );
  const line = (cells: string[]) =>
    cells.map((cell, index) => cell.padEnd(widths[index])).join('  ').trimEnd();

  console.log(`Stripe key mode: ${mode}`);
  console.log('');
  console.log(line(header));
  console.log(line(widths.map((width) => '-'.repeat(width))));
  body.forEach((cells) => console.log(line(cells)));
}

async function main(): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set — nothing to check.');
    process.exit(1);
  }

  const stripe = new Stripe(key);
  const mode = keyMode(key);
  const rows: PlanCheck[] = [];
  for (const currency of CURRENCIES) {
    for (const plan of PLANS) rows.push(await checkPlan(stripe, plan, currency));
  }

  const failures = rows.filter((row) => row.verdict !== 'ok');

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ mode, failures: failures.length, rows }, null, 2));
  } else {
    printTable(rows, mode);
    console.log('');
    if (failures.length === 0) {
      console.log(`All ${rows.length} plan prices match shared/pricing.ts.`);
    } else {
      console.log(`${failures.length} of ${rows.length} plans would fail at checkout.`);
      console.log('Point the env vars at `price_…` ids (preferred) and re-run this check.');
    }
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('check:stripe-prices failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
