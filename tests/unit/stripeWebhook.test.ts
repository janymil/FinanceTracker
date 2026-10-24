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

const storage = vi.hoisted(() => ({
  updateUserPlan: vi.fn(async () => ({})),
  updateUserStripeInfo: vi.fn(async () => ({})),
  getUser: vi.fn(async () => ({})),
  getUserByStripeCustomerId: vi.fn(async () => null),
}));

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
const signer = new Stripe('sk_test_unit');

function signedHeader(payload: string): string {
  return signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
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

  const { registerStripeRoutes } = await import('../../server/routes/stripeRoutes');
  const app = express();
  // Same order as server/index.ts: the raw body first, JSON for everything else.
  app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  registerStripeRoutes(app);

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
});
