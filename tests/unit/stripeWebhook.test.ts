import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import Stripe from 'stripe';

/**
 * The Stripe webhook decides who gets a paid plan, so these tests pin the three things that
 * must never regress: unsigned or forged events are refused, a genuinely signed event is
 * applied once, and an unpaid checkout never upgrades anyone.
 */
const SECRET = 'whsec_test_secret_for_unit_tests';

/**
 * The storage mock is stateful on purpose: the webhook's de-duplication and its payment
 * failure log now live in the database, so a mock that always answers "first time" would
 * hide exactly the bug these tests exist to catch.
 */
const mocks = vi.hoisted(() => {
  const claimed = new Set<string>();
  const failures: Array<Record<string, any>> = [];
  return {
    claimed,
    failures,
    storage: {
      updateUserPlan: vi.fn(async () => ({})),
      updateUserStripeInfo: vi.fn(async () => ({})),
      getUser: vi.fn(async () => ({})),
      getUserByStripeCustomerId: vi.fn(async () => null),
      // de-duplication
      claimWebhookEvent: vi.fn(async (event: { key: string }) => {
        if (claimed.has(event.key)) return false;
        claimed.add(event.key);
        return true;
      }),
      releaseWebhookEvent: vi.fn(async (_source: string, key: string) => {
        claimed.delete(key);
      }),
      pruneWebhookEvents: vi.fn(async () => undefined),
      // payment failures
      getPaymentFailureByInvoice: vi.fn(async (invoiceId: string) => {
        return failures.find((row) => row.stripeInvoiceId === invoiceId) ?? null;
      }),
      createPaymentFailure: vi.fn(async (failure: Record<string, any>) => {
        const row = { id: failures.length + 1, ...failure };
        failures.push(row);
        return row;
      }),
      updatePaymentFailureAttempt: vi.fn(async (id: number, attemptCount: number) => {
        const row = failures.find((entry) => entry.id === id);
        if (row) row.attemptCount = attemptCount;
      }),
      setUserGracePeriod: vi.fn(async () => ({})),
      clearUserGracePeriod: vi.fn(async () => ({})),
      getPaymentFailures: vi.fn(async () => []),
      resolvePaymentFailure: vi.fn(async () => undefined),
    },
  };
});

const storage = mocks.storage;

vi.mock('../../server/storage', () => ({ storage }));
vi.mock('../../server/clerkAuth', () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  getUserId: () => 'user_1',
}));
vi.mock('../../server/billingRegion', () => ({
  regionForRequest: () => ({ country: 'US', gateway: 'stripe', currency: 'usd' }),
}));

let server: Server;
let baseUrl: string;
let stripeGateway: { cancelSubscription: (subscriptionId: string) => Promise<void> };
const signer = new Stripe('sk_test_unit');

function signedHeader(payload: string): string {
  return signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
}

/** Any event shape; only the fields the handler under test reads are filled in. */
function eventOf(id: string, type: string, object: Record<string, unknown>): string {
  return JSON.stringify({ id, object: 'event', type, data: { object } });
}

function checkoutEvent(id: string, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        object: 'checkout.session',
        payment_status: 'paid',
        customer: 'cus_1',
        subscription: 'sub_1',
        metadata: { userId: 'user_9', plan: 'premium' },
        ...overrides,
      },
    },
  });
}

async function post(body: string, signature?: string) {
  const response = await fetch(`${baseUrl}/api/stripe-webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(signature ? { 'stripe-signature': signature } : {}) },
    body,
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;

  const routes = await import('../../server/routes/stripeRoutes');
  stripeGateway = routes.stripeGateway;
  const app = express();
  // Same order as server/index.ts: the raw body first, JSON for everything else.
  app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  routes.registerStripeRoutes(app);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claimed.clear();
  mocks.failures.length = 0;
});

describe('POST /api/stripe-webhook', () => {
  it('refuses an event with no signature', async () => {
    const result = await post(checkoutEvent('evt_1'));
    expect(result.status).toBe(400);
    expect(storage.updateUserPlan).not.toHaveBeenCalled();
  });

  it('refuses a forged event signed with the wrong secret', async () => {
    const payload = checkoutEvent('evt_2');
    const forged = signer.webhooks.generateTestHeaderString({ payload, secret: 'whsec_attacker' });
    const result = await post(payload, forged);
    expect(result.status).toBe(400);
    expect(storage.updateUserPlan).not.toHaveBeenCalled();
  });

  it('refuses a payload that was changed after signing', async () => {
    const payload = checkoutEvent('evt_3');
    const signature = signedHeader(payload);
    const tampered = payload.replace('"premium"', '"premium-yearly"');
    const result = await post(tampered, signature);
    expect(result.status).toBe(400);
    expect(storage.updateUserPlan).not.toHaveBeenCalled();
  });

  it('applies a genuinely signed paid checkout', async () => {
    const payload = checkoutEvent('evt_4');
    const result = await post(payload, signedHeader(payload));
    expect(result.status).toBe(200);
    expect(storage.updateUserPlan).toHaveBeenCalledWith('user_9', 'premium', 'monthly');
    expect(storage.updateUserStripeInfo).toHaveBeenCalledWith('user_9', 'cus_1', 'sub_1');
  });

  it('applies the same event only once when Stripe retries it', async () => {
    const payload = checkoutEvent('evt_5');
    const first = await post(payload, signedHeader(payload));
    const second = await post(payload, signedHeader(payload));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.json.duplicate).toBe(true);
    expect(storage.updateUserPlan).toHaveBeenCalledTimes(1);
  });

  it('does not upgrade anyone for a checkout that was not paid', async () => {
    const payload = checkoutEvent('evt_6', { payment_status: 'unpaid' });
    const result = await post(payload, signedHeader(payload));
    expect(result.status).toBe(200);
    expect(storage.updateUserPlan).not.toHaveBeenCalled();
  });

  it('answers 500 (so Stripe retries) when applying the event fails', async () => {
    storage.updateUserPlan.mockRejectedValueOnce(new Error('database down'));
    const payload = checkoutEvent('evt_7');
    const result = await post(payload, signedHeader(payload));
    expect(result.status).toBe(500);

    // The failed event is not remembered as processed, so the retry is applied.
    storage.updateUserPlan.mockResolvedValueOnce({});
    const retry = await post(payload, signedHeader(payload));
    expect(retry.status).toBe(200);
    expect(storage.updateUserPlan).toHaveBeenCalledTimes(2);
  });

  describe('a failed payment', () => {
    const failureEvent = (eventId: string, invoiceId: string, attemptCount = 1) =>
      eventOf(eventId, 'invoice.payment_failed', {
        id: invoiceId,
        object: 'invoice',
        customer: 'cus_1',
        attempt_count: attemptCount,
        last_payment_error: { message: 'card declined' },
      });

    beforeEach(() => {
      // No e-mail address on purpose: the notification must never be attempted in a test.
      storage.getUserByStripeCustomerId.mockResolvedValue({
        id: 'user_7',
        email: null,
        paymentFailureCount: 0,
      } as any);
    });

    it('gives a grace period instead of downgrading straight away', async () => {
      const payload = failureEvent('evt_f1', 'in_1');
      const result = await post(payload, signedHeader(payload));

      expect(result.status).toBe(200);
      expect(storage.createPaymentFailure).toHaveBeenCalledTimes(1);
      expect(storage.setUserGracePeriod).toHaveBeenCalledWith('user_7', expect.any(Date), 1);
      expect(storage.updateUserPlan).not.toHaveBeenCalled();
    });

    it('counts one invoice once, even when it arrives as two different events', async () => {
      const first = failureEvent('evt_f2a', 'in_2');
      await post(first, signedHeader(first));

      // A resend with a different event id: the de-duplication cannot catch this one, so
      // the invoice id is what must keep the failure count honest.
      const second = failureEvent('evt_f2b', 'in_2');
      const result = await post(second, signedHeader(second));

      expect(result.status).toBe(200);
      expect(storage.createPaymentFailure).toHaveBeenCalledTimes(1);
      expect(storage.setUserGracePeriod).toHaveBeenCalledTimes(1);
    });

    it('counts a real retry of the charge as a new attempt, without a second notice', async () => {
      const first = failureEvent('evt_f3a', 'in_3', 1);
      await post(first, signedHeader(first));

      const retry = failureEvent('evt_f3b', 'in_3', 2);
      const result = await post(retry, signedHeader(retry));

      expect(result.status).toBe(200);
      expect(storage.createPaymentFailure).toHaveBeenCalledTimes(1);
      expect(storage.updatePaymentFailureAttempt).toHaveBeenCalledWith(1, 2, 'card declined');
      expect(storage.setUserGracePeriod).toHaveBeenLastCalledWith('user_7', expect.any(Date), 2);
    });
  });

  describe('a subscription that ends', () => {
    it('downgrades to free and forgets the subscription id', async () => {
      storage.getUserByStripeCustomerId.mockResolvedValue({
        id: 'user_8',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        plan: 'standard',
      } as any);

      const payload = eventOf('evt_d1', 'customer.subscription.deleted', {
        id: 'sub_1',
        object: 'subscription',
        customer: 'cus_1',
        status: 'canceled',
      });
      const result = await post(payload, signedHeader(payload));

      expect(result.status).toBe(200);
      expect(storage.updateUserPlan).toHaveBeenCalledWith('user_8', 'free', 'monthly');
      expect(storage.updateUserStripeInfo).toHaveBeenCalledWith('user_8', 'cus_1', '');
    });

    it('does not downgrade when an old subscription is deleted after an upgrade', async () => {
      storage.getUserByStripeCustomerId.mockResolvedValue({
        id: 'user_8',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_new',
        plan: 'premium',
      } as any);

      const payload = eventOf('evt_d2', 'customer.subscription.deleted', {
        id: 'sub_old',
        object: 'subscription',
        customer: 'cus_1',
        status: 'canceled',
      });
      const result = await post(payload, signedHeader(payload));

      expect(result.status).toBe(200);
      expect(storage.updateUserPlan).not.toHaveBeenCalled();
    });

    it('ignores a paid invoice that is not tied to a subscription instead of failing', async () => {
      storage.getUserByStripeCustomerId.mockResolvedValue({
        id: 'user_8',
        stripeCustomerId: 'cus_1',
      } as any);

      const payload = eventOf('evt_p1', 'invoice.payment_succeeded', {
        id: 'in_9',
        object: 'invoice',
        customer: 'cus_1',
        subscription: null,
      });
      const result = await post(payload, signedHeader(payload));

      expect(result.status).toBe(200);
      expect(storage.updateUserPlan).not.toHaveBeenCalled();
    });
  });

  describe('a refund', () => {
    const refundEvent = (eventId: string, fields: Record<string, unknown> = {}) =>
      eventOf(eventId, 'charge.refunded', {
        id: 'ch_1',
        object: 'charge',
        customer: 'cus_1',
        amount: 4990,
        amount_refunded: 4990,
        refunded: true,
        ...fields,
      });

    it('cancels the subscription and returns the account to free', async () => {
      const cancel = vi.spyOn(stripeGateway, 'cancelSubscription').mockResolvedValue(undefined);
      storage.getUserByStripeCustomerId.mockResolvedValue({
        id: 'user_9',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_9',
        plan: 'standard',
      } as any);

      const payload = refundEvent('evt_r1');
      const result = await post(payload, signedHeader(payload));

      expect(result.status).toBe(200);
      expect(cancel).toHaveBeenCalledWith('sub_9');
      expect(storage.updateUserPlan).toHaveBeenCalledWith('user_9', 'free', 'monthly');
      expect(storage.updateUserStripeInfo).toHaveBeenCalledWith('user_9', 'cus_1', '');
    });

    it('still ends the plan when the subscription cannot be cancelled', async () => {
      vi.spyOn(stripeGateway, 'cancelSubscription').mockRejectedValue(new Error('already canceled'));
      storage.getUserByStripeCustomerId.mockResolvedValue({
        id: 'user_9',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_9',
        plan: 'standard',
      } as any);

      const payload = refundEvent('evt_r2');
      const result = await post(payload, signedHeader(payload));

      // The money went back, so the access goes back — even if Stripe refused the cancel.
      expect(result.status).toBe(200);
      expect(storage.updateUserPlan).toHaveBeenCalledWith('user_9', 'free', 'monthly');
    });

    it('leaves the plan alone for a partial refund', async () => {
      const cancel = vi.spyOn(stripeGateway, 'cancelSubscription').mockResolvedValue(undefined);
      storage.getUserByStripeCustomerId.mockResolvedValue({
        id: 'user_9',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_9',
        plan: 'standard',
      } as any);

      const payload = refundEvent('evt_r3', { amount_refunded: 1000, refunded: false });
      const result = await post(payload, signedHeader(payload));

      expect(result.status).toBe(200);
      expect(cancel).not.toHaveBeenCalled();
      expect(storage.updateUserPlan).not.toHaveBeenCalled();
    });
  });
});
