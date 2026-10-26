#!/usr/bin/env node
/**
 * Kaptia — does what the customer pays for match what the account has?
 *
 * Every other billing path is event-driven: a notice arrives, the plan changes. That works until a
 * notice does not arrive. Stripe retries for three days and MercadoPago for hours; past that the
 * provider is certain and we are not, and nobody finds out. The two failures are symmetrical and
 * both real:
 *
 *   - a paying customer sits on `free` and cannot use what they were charged for;
 *   - a cancelled customer keeps a paid plan, and nothing charges them again.
 *
 * This asks the providers directly and compares the answer with what is recorded. It is
 * **report-only** unless `--apply` is given, because silently rewriting somebody's plan from a
 * script is exactly the kind of change that needs a human deciding it is safe.
 *
 * Usage:
 *   npm run billing:reconcile                  # read-only report, exit 1 when it finds drift
 *   npm run billing:reconcile -- --json        # one JSON line
 *   npm run billing:reconcile -- --apply       # correct the account rows
 *
 * Exit codes: 0 = agreement (or every correction applied), 1 = drift found or a provider failed,
 * 2 = bad usage or no provider configured.
 */
import 'dotenv/config';
import Stripe from 'stripe';
import { storage } from '../server/storage.js';
import { withJobRun } from '../server/errorGuard/jobs.js';
import {
  PRICE_ENV_KEYS,
  type StripeBillingCurrency,
  type StripePlanKey,
} from '../shared/stripePriceEnv.js';
import { getPreapproval, isMercadoPagoConfigured } from '../server/mercadopago.js';

export const JOB_NAME = 'billing-reconcile';

export interface Drift {
  userId: string;
  /** What the provider says the account is paying for right now. */
  providerPlan: string;
  /** What our own row says. */
  recordedPlan: string;
  source: 'stripe' | 'mercadopago';
  detail: string;
}

const PLAN_BY_KEY: Record<StripePlanKey, { plan: string; interval: string }> = {
  standard: { plan: 'standard', interval: 'monthly' },
  'standard-yearly': { plan: 'standard', interval: 'yearly' },
  premium: { plan: 'premium', interval: 'monthly' },
  'premium-yearly': { plan: 'premium', interval: 'yearly' },
};

/** The plan key an account row implies, in the same vocabulary as the price keys. */
export function planKeyFor(plan: string | null, interval: string | null): string {
  const base = plan === 'premium' ? 'premium' : plan === 'standard' ? 'standard' : '';
  if (!base) return '';
  return interval === 'yearly' ? `${base}-yearly` : base;
}

/**
 * Price ids this environment sells, resolved the way checkout resolves them — so a `prod_…`
 * reference and a `price_…` reference both land on the id a subscription actually carries.
 */
async function priceIdToPlanKey(stripe: Stripe | null): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const currency of Object.keys(PRICE_ENV_KEYS) as StripeBillingCurrency[]) {
    for (const key of Object.keys(PRICE_ENV_KEYS[currency]) as StripePlanKey[]) {
      for (const envKey of PRICE_ENV_KEYS[currency][key]) {
        const reference = (process.env[envKey] ?? '').replace(/['"]/g, '').trim();
        if (!reference) continue;
        if (reference.startsWith('price_')) {
          map.set(reference, key);
          break;
        }
        if (reference.startsWith('prod_') && stripe) {
          try {
            const product = await stripe.products.retrieve(reference, { expand: ['default_price'] });
            const price = product.default_price;
            const id = typeof price === 'string' ? price : price?.id;
            if (id) {
              map.set(id, key);
              break;
            }
          } catch {
            // A product this account cannot read is not drift: checkout would fail loudly.
          }
        }
      }
    }
  }
  return map;
}

/**
 * Compare every account against what the provider says, and return the disagreements.
 *
 * `apply` corrects the account rows; without it this only reports. Nothing here writes when the
 * provider could not be read: an unreadable subscription is reported, not "fixed" to free.
 */
export async function reconcile(options: { apply: boolean }): Promise<{ drift: Drift[]; checked: number }> {
  const drift: Drift[] = [];
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  const users = await storage.getAllUsers();

  if (stripe) {
    const priceMap = await priceIdToPlanKey(stripe);
    const live = await liveStripeSubscriptions(stripe);

    for (const user of users) {
      const subscription = user.stripeCustomerId ? live.get(user.stripeCustomerId) : undefined;
      const recorded = planKeyFor(user.plan, user.billingInterval);

      if (!subscription) {
        // Only a paid account that *had* a card subscription is drift. A plan granted by a
        // redemption code has no subscription and is not a disagreement with the provider.
        if (user.plan !== 'free' && user.stripeCustomerId) {
          drift.push({
            userId: user.id,
            providerPlan: 'none',
            recordedPlan: recorded || user.plan,
            source: 'stripe',
            detail: 'no live card subscription, but the account is on a paid plan',
          });
          if (options.apply) await storage.updateUserPlan(user.id, 'free', 'monthly');
        }
        continue;
      }

      const priceId = subscription.items?.data?.[0]?.price?.id;
      const expected = (priceId && priceMap.get(priceId)) || '';
      if (!expected) {
        drift.push({
          userId: user.id,
          providerPlan: `unknown price ${priceId ?? '(none)'}`,
          recordedPlan: recorded || user.plan,
          source: 'stripe',
          detail: 'the subscription is on a price this environment does not sell',
        });
        continue;
      }

      if (expected !== recorded) {
        drift.push({
          userId: user.id,
          providerPlan: expected,
          recordedPlan: recorded || user.plan,
          source: 'stripe',
          detail: `subscription ${subscription.id} is ${subscription.status}`,
        });
        if (options.apply) {
          const target = PLAN_BY_KEY[expected as StripePlanKey];
          await storage.updateUserPlan(
            user.id,
            target.plan as 'free' | 'standard' | 'premium',
            target.interval as 'monthly' | 'yearly',
          );
        }
      }
    }
  }

  // Soles: a preapproval that is no longer authorised cannot be paying for anything.
  if (isMercadoPagoConfigured()) {
    for (const user of users) {
      if (!user.mpPreapprovalId || user.plan === 'free') continue;
      try {
        const state = await getPreapproval(user.mpPreapprovalId);
        if (state.status === 'authorized') continue;
        drift.push({
          userId: user.id,
          providerPlan: state.status,
          recordedPlan: planKeyFor(user.plan, user.billingInterval) || user.plan,
          source: 'mercadopago',
          detail: `preapproval ${state.id} is ${state.status}`,
        });
        if (options.apply) await storage.updateUserPlan(user.id, 'free', 'monthly');
      } catch (error) {
        // A provider that cannot answer is a failed check, not drift — and never a reason to
        // take a paid plan away.
        drift.push({
          userId: user.id,
          providerPlan: '(unreadable)',
          recordedPlan: planKeyFor(user.plan, user.billingInterval) || user.plan,
          source: 'mercadopago',
          detail: `could not read ${user.mpPreapprovalId}: ${(error as Error).message}`,
        });
      }
    }
  }

  return { drift, checked: users.length };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const json = argv.includes('--json');
  const apply = argv.includes('--apply');
  const unknown = argv.filter((arg) => !['--json', '--apply'].includes(arg));
  if (unknown.length > 0) {
    console.error(`[billing:reconcile] unknown argument(s): ${unknown.join(' ')}`);
    return 2;
  }
  if (!process.env.STRIPE_SECRET_KEY && !isMercadoPagoConfigured()) {
    console.error('[billing:reconcile] neither payment provider is configured; nothing to compare.');
    return 2;
  }

  let result: { drift: Drift[]; checked: number } | null = null;
  await withJobRun(JOB_NAME, async () => {
    result = await reconcile({ apply });
  });

  if (!result) {
    // withJobRun swallowed a failure and recorded it; the exit code must still say so.
    console.error('[billing:reconcile] the run failed; see the job record');
    return 1;
  }

  const { drift, checked } = result as { drift: Drift[]; checked: number };

  if (json) {
    console.log(JSON.stringify({ checked, drift, applied: apply }));
  } else {
    console.log(`[billing:reconcile] accounts checked ${checked}`);
    if (drift.length === 0) {
      console.log('[billing:reconcile] every account matches what the provider says');
    } else {
      for (const row of drift) {
        console.log(
          `  ${row.source.padEnd(12)} ${row.userId}  recorded=${row.recordedPlan}  provider=${row.providerPlan}  — ${row.detail}`,
        );
      }
      console.log(
        apply
          ? `[billing:reconcile] corrected ${drift.length} account(s)`
          : `[billing:reconcile] ${drift.length} account(s) disagree; re-run with --apply to correct them`,
      );
    }
  }

  return drift.length === 0 || apply ? 0 : 1;
}

// Only when invoked directly, so the module can be imported by a test.
if (process.argv[1] && /billing-reconcile/.test(process.argv[1])) {
  void main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('[billing:reconcile] failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

async function liveStripeSubscriptions(stripe: Stripe): Promise<Map<string, any>> {
  const byCustomer = new Map<string, any>();
  let startingAfter: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const batch = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const subscription of batch.data as any[]) {
      if (!['active', 'trialing', 'past_due'].includes(subscription.status)) continue;
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      if (!customerId) continue;
      // A customer can hold more than one; the newest wins, which is what the notice would apply.
      const existing = byCustomer.get(customerId);
      if (!existing || (subscription.created ?? 0) > (existing.created ?? 0)) {
        byCustomer.set(customerId, subscription);
      }
    }
    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = (batch.data[batch.data.length - 1] as any)?.id;
    if (!startingAfter) break;
  }
  return byCustomer;
}

