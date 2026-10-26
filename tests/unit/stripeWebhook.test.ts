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
let stripeGateway: {
  cancelSubscription: (subscriptionId: string) => Promise<void>;
  endSubscriptionAtPeriodEnd: (subscriptionId: string) => Promise<any>;
  upgradeSubscription: (subscriptionId: string, itemId: string, priceId: string) => Promise<any>;
  scheduleDowngrade: (subscriptionId: string, currentPriceId: string, newPriceId: string, periodEnd: number) => Promise<any>;
  retrieveSubscription: (subscriptionId: string) => Promise<{ id: string; status: string }>;
  retrieveCheckoutSession: (sessionId: string) => Promise<any>;
};
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
  // Every checkout handler now asks Stripe whether the subscription is still live. A test
  // must never make that call, so it answers "active" unless the test says otherwise.
  vi.spyOn(stripeGateway, 'retrieveSubscription').mockResolvedValue({ id: 'sub_1', status: 'active' });
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

  it('applies the same event only once, and asks Stripe to retry the copy it cannot claim', async () => {
    const payload = checkoutEvent('evt_5');
    const first = await post(payload, signedHeader(payload));
    const second = await post(payload, signedHeader(payload));
    expect(first.status).toBe(200);
    // 500, not 200: an unfinished claim may belong to a delivery that crashed mid-handling,
    // and answering 2xx would tell Stripe to stop asking. The retry is applied once the
    // claim's lease expires.
    expect(second.status).toBe(500);
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

  /**
   * The success page is a URL the browser keeps forever. Opening it again must not be a
   * second purchase: the payment stays "paid" after a cancellation or a refund, so the
   * subscription is what decides whether the plan is still earned.
   */
  describe('the checkout success page', () => {
    const paidSession = (overrides: Record<string, unknown> = {}) => ({
      id: 'cs_test_1',
      status: 'complete',
      payment_status: 'paid',
      customer: 'cus_1',
      subscription: 'sub_1',
      metadata: { userId: 'user_9', plan: 'premium' },
      ...overrides,
    });

    async function visit(): Promise<Response> {
      return fetch(`${baseUrl}/api/subscription-success?session_id=cs_test_1`, { redirect: 'manual' });
    }

    it('grants the plan when the subscription behind the session is live', async () => {
      vi.spyOn(stripeGateway, 'retrieveCheckoutSession').mockResolvedValue(paidSession());
      vi.spyOn(stripeGateway, 'retrieveSubscription').mockResolvedValue({ id: 'sub_1', status: 'active' });

      const response = await visit();

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('upgrade=success');
      expect(storage.updateUserPlan).toHaveBeenCalledWith('user_9', 'premium', 'monthly');
      expect(storage.updateUserStripeInfo).toHaveBeenCalledWith('user_9', 'cus_1', 'sub_1');
    });

    it('refuses an old link whose subscription was cancelled or refunded', async () => {
      vi.spyOn(stripeGateway, 'retrieveCheckoutSession').mockResolvedValue(paidSession());
      vi.spyOn(stripeGateway, 'retrieveSubscription').mockResolvedValue({ id: 'sub_1', status: 'canceled' });

      const response = await visit();

      expect(response.headers.get('location')).toContain('subscription_not_active');
      expect(storage.updateUserPlan).not.toHaveBeenCalled();
      // A dead subscription id must not be written back: it would block the next purchase.
      expect(storage.updateUserStripeInfo).not.toHaveBeenCalled();
    });

    it('refuses when the subscription cannot be confirmed', async () => {
      vi.spyOn(stripeGateway, 'retrieveCheckoutSession').mockResolvedValue(paidSession());
      vi.spyOn(stripeGateway, 'retrieveSubscription').mockRejectedValue(new Error('stripe is down'));

      const response = await visit();

      expect(response.headers.get('location')).toContain('subscription_check_failed');
      expect(storage.updateUserPlan).not.toHaveBeenCalled();
    });

    it('refuses a session that was never paid', async () => {
      vi.spyOn(stripeGateway, 'retrieveCheckoutSession').mockResolvedValue(paidSession({ payment_status: 'unpaid' }));

      const response = await visit();

      expect(response.headers.get('location')).toContain('payment_not_completed');
      expect(storage.updateUserPlan).not.toHaveBeenCalled();
    });

    it('does not cancel anything when an old-style success URL is opened or replayed', async () => {
      // A plan change now updates the subscription the customer already has, so there is no
      // second subscription to end. This URL stays valid forever, so it must not be a way to
      // cancel somebody's subscription by opening a link — and it used to be exactly that.
      const cancel = vi.spyOn(stripeGateway, 'cancelSubscription').mockResolvedValue(undefined);
      vi.spyOn(stripeGateway, 'retrieveCheckoutSession').mockResolvedValue(
        paidSession({
          subscription: 'sub_new',
          metadata: { userId: 'user_9', plan: 'premium', existingSubscriptionId: 'sub_old' },
        }),
      );
      vi.spyOn(stripeGateway, 'retrieveSubscription').mockResolvedValue({ id: 'sub_new', status: 'active' });

      await visit();

      expect(cancel).not.toHaveBeenCalled();
      // The plan itself is still applied: that is what the page is for.
      expect(storage.updateUserPlan).toHaveBeenCalledWith('user_9', 'premium', 'monthly');
    });
  });

  describe('an upgrade', () => {
    it('cancels the subscription it replaced even if the browser never comes back', async () => {
      const cancel = vi.spyOn(stripeGateway, 'cancelSubscription').mockResolvedValue(undefined);

      const payload = checkoutEvent('evt_up1', {
        metadata: { userId: 'user_9', plan: 'premium', existingSubscriptionId: 'sub_old' },
      });
      const result = await post(payload, signedHeader(payload));

      expect(result.status).toBe(200);
      // Closing the tab after paying used to leave both subscriptions billing.
      expect(cancel).toHaveBeenCalledWith('sub_old');
      expect(storage.updateUserPlan).toHaveBeenCalledWith('user_9', 'premium', 'monthly');
    });
  });

  describe('POST /api/cancel-subscription', () => {
  const cancelRequest = () =>
    fetch(`${baseUrl}/api/cancel-subscription`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

  it('stops the renewal and keeps the period the customer paid for', async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 10 * 24 * 60 * 60;
    vi.mocked(storage.getUser).mockResolvedValueOnce({
      id: 'user_1',
      plan: 'premium',
      stripeSubscriptionId: 'sub_1',
    } as any);
    const atPeriodEnd = vi
      .spyOn(stripeGateway, 'endSubscriptionAtPeriodEnd')
      .mockResolvedValue({ id: 'sub_1', cancel_at_period_end: true, current_period_end: periodEnd });
    const immediate = vi.spyOn(stripeGateway, 'cancelSubscription');

    const response = await cancelRequest();
    const body = await response.json();

    // `cancel()` ends the subscription at once, which takes away days the customer paid for.
    expect(immediate).not.toHaveBeenCalled();
    expect(atPeriodEnd).toHaveBeenCalledWith('sub_1');
    // The plan is untouched here; `customer.subscription.deleted` moves them to free at period end.
    expect(storage.updateUserPlan).not.toHaveBeenCalled();
    expect(new Date(body.accessUntil).getTime()).toBe(periodEnd * 1000);
  });

  it('says nothing was cancelled when Stripe refuses', async () => {
    vi.mocked(storage.getUser).mockResolvedValueOnce({
      id: 'user_1',
      plan: 'premium',
      stripeSubscriptionId: 'sub_1',
    } as any);
    vi.spyOn(stripeGateway, 'endSubscriptionAtPeriodEnd').mockRejectedValue(new Error('stripe down'));

    const response = await cancelRequest();

    expect(response.status).toBe(502);
    expect(storage.updateUserPlan).not.toHaveBeenCalled();
  });

  it('does not pretend a MercadoPago subscriber cancelled a card subscription', async () => {
    // Answering 200 here would tell somebody in Peru they had cancelled while the preapproval
    // kept charging them.
    vi.mocked(storage.getUser).mockResolvedValueOnce({ id: 'user_1', plan: 'premium' } as any);

    const response = await cancelRequest();

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('no_stripe_subscription');
  });
});

describe('a resent checkout notice', () => {
    it('does not revive a subscription that has since been cancelled', async () => {
      vi.spyOn(stripeGateway, 'retrieveSubscription').mockResolvedValue({ id: 'sub_1', status: 'canceled' });

      const payload = checkoutEvent('evt_old1');
      const result = await post(payload, signedHeader(payload));

      expect(result.status).toBe(200);
      expect(storage.updateUserPlan).not.toHaveBeenCalled();
      expect(storage.updateUserStripeInfo).not.toHaveBeenCalled();
    });
  });

  describe('a subscription event that arrives out of order', () => {
    it('cannot change the plan of a subscription the person has replaced', async () => {
      storage.getUserByStripeCustomerId.mockResolvedValue({
        id: 'user_10',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_new',
        plan: 'premium',
      } as any);
      const retrieve = vi
        .spyOn(stripeGateway, 'retrieveSubscription')
        .mockResolvedValue({ id: 'sub_old', status: 'active' });

      const payload = eventOf('evt_u1', 'customer.subscription.updated', {
        id: 'sub_old',
        object: 'subscription',
        customer: 'cus_1',
        status: 'active',
        items: { data: [{ price: { id: 'price_x' } }] },
      });
      const result = await post(payload, signedHeader(payload));

      expect(result.status).toBe(200);
      expect(retrieve).not.toHaveBeenCalled();
      expect(storage.updateUserPlan).not.toHaveBeenCalled();
    });

    it('asks Stripe whether an "active" notice is still true before granting anything', async () => {
      storage.getUserByStripeCustomerId.mockResolvedValue({
        id: 'user_10',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: null,
        plan: 'free',
      } as any);
      const retrieve = vi
        .spyOn(stripeGateway, 'retrieveSubscription')
        .mockResolvedValue({ id: 'sub_9', status: 'canceled' });

      const payload = eventOf('evt_u2', 'customer.subscription.updated', {
        id: 'sub_9',
        object: 'subscription',
        customer: 'cus_1',
        status: 'active',
        items: { data: [{ price: { id: 'price_x' } }] },
      });
      const result = await post(payload, signedHeader(payload));

      expect(result.status).toBe(200);
      expect(retrieve).toHaveBeenCalledWith('sub_9');
      expect(storage.updateUserPlan).not.toHaveBeenCalled();
    });
  });
});
