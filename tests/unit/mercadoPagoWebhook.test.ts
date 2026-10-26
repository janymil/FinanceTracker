import crypto from 'crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * The MercadoPago webhook decides whether a Peruvian subscriber keeps a paid plan. These
 * tests pin the four things that matter: a signed "authorized" notice activates the plan, a
 * repeat of the same notice changes nothing, a later "cancelled" notice is not swallowed by
 * that repetition, and a failed activation is retried instead of being lost.
 */
const SECRET = 'mp_secret_for_unit_tests';

const mocks = vi.hoisted(() => {
  const claimed = new Set<string>();
  return {
    claimed,
    storage: {
      claimWebhookEvent: vi.fn(async (event: { key: string }) => {
        if (claimed.has(event.key)) return false;
        claimed.add(event.key);
        return true;
      }),
      releaseWebhookEvent: vi.fn(async (_source: string, key: string) => {
        claimed.delete(key);
      }),
      getUser: vi.fn(async () => ({
        id: 'user_1',
        plan: 'free',
        stripeSubscriptionId: null,
        mpPreapprovalId: null,
      })),
      updateUserPlan: vi.fn(async () => ({})),
      updateUser: vi.fn(async () => ({})),
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
  regionForRequest: () => ({ country: 'PE', gateway: 'mercadopago', currency: 'pen' }),
}));

const ORIGINAL_ENV = { ...process.env };

let server: Server;
let baseUrl: string;

/** A preapproval as MercadoPago returns it, reduced to the fields the route reads. */
function preapproval(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'pre-1',
    status,
    external_reference: 'user_1',
    reason: 'Kaptia Premium',
    auto_recurring: { frequency_type: 'months' },
    // MercadoPago sends this on every state change; the duplicate key depends on it.
    last_modified: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function sign(ts: string, dataId = 'pre-1'): string {
  const manifest = `id:${dataId};request-id:req-1;ts:${ts};`;
  return `ts=${ts},v1=${crypto.createHmac('sha256', SECRET).update(manifest).digest('hex')}`;
}

/** Kept from before any stub: the test's own HTTP call must reach the local server. */
const realFetch = globalThis.fetch.bind(globalThis);

async function notify(body: Record<string, unknown>, signature: string) {
  const response = await realFetch(`${baseUrl}/api/mercadopago/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature': signature,
      'x-request-id': 'req-1',
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

function stubPreapproval(payload: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeAll(async () => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';

  const { registerMercadoPagoRoutes } = await import('../../server/routes/mercadoPagoRoutes');
  const app = express();
  app.use(express.json());
  registerMercadoPagoRoutes(app);

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
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
});


describe('POST /api/mercadopago/webhook', () => {
  it('activates the plan when the subscription is authorised', async () => {
    stubPreapproval(preapproval('authorized'));
    const result = await notify(
      { type: 'subscription_preapproval', data: { id: 'pre-1' } },
      sign(String(Date.now())),
    );

    expect(result.status).toBe(200);
    expect(storage.updateUserPlan).toHaveBeenCalledWith('user_1', 'premium', 'monthly');
    expect(storage.updateUser).toHaveBeenCalledWith('user_1', { mpPreapprovalId: 'pre-1' });
  });

  it('applies the same notice once and asks MercadoPago to retry the copy it cannot claim', async () => {
    stubPreapproval(preapproval('authorized'));
    const signature = sign(String(Date.now()));
    const body = { type: 'subscription_preapproval', data: { id: 'pre-1' } };

    const first = await notify(body, signature);
    const second = await notify(body, signature);

    expect(first.status).toBe(200);
    // 500, not 200: an unfinished claim may belong to a delivery that crashed mid-handling,
    // and a 2xx would make MercadoPago stop retrying a notice that was never applied.
    expect(second.status).toBe(500);
    expect(storage.updateUserPlan).toHaveBeenCalledTimes(1);
  });

  it('still applies a later "cancelled" notice for the same subscription', async () => {
    storage.getUser.mockResolvedValue({
      id: 'user_1',
      plan: 'premium',
      stripeSubscriptionId: null,
      mpPreapprovalId: 'pre-1',
    } as any);

    stubPreapproval(preapproval('authorized'));
    await notify(
      { type: 'subscription_preapproval', data: { id: 'pre-1' } },
      sign(String(Date.now())),
    );

    // Same resource id, different state: deduplicating on the id alone would drop this.
    stubPreapproval(preapproval('cancelled'));
    const result = await notify(
      { type: 'subscription_preapproval', data: { id: 'pre-1' } },
      sign(String(Date.now())),
    );

    expect(result.status).toBe(200);
    expect(storage.updateUserPlan).toHaveBeenLastCalledWith('user_1', 'free', 'monthly');
  });

  it('does not downgrade someone who already moved to a newer subscription', async () => {
    storage.getUser.mockResolvedValue({
      id: 'user_1',
      plan: 'premium',
      stripeSubscriptionId: null,
      mpPreapprovalId: 'pre-new',
    } as any);

    stubPreapproval(preapproval('cancelled', { id: 'pre-old' }));
    const result = await notify(
      { type: 'subscription_preapproval', data: { id: 'pre-old' } },
      sign(String(Date.now()), 'pre-old'),
    );

    expect(result.status).toBe(200);
    expect(storage.updateUserPlan).not.toHaveBeenCalled();
  });

  it('refuses a notice with an invalid signature', async () => {
    const fetchMock = stubPreapproval(preapproval('authorized'));
    const result = await notify(
      { type: 'subscription_preapproval', data: { id: 'pre-1' } },
      `ts=${Date.now()},v1=deadbeef`,
    );

    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.updateUserPlan).not.toHaveBeenCalled();
  });

  it('lets MercadoPago retry after a failed activation instead of dropping it', async () => {
    stubPreapproval(preapproval('authorized'));
    storage.updateUserPlan.mockRejectedValueOnce(new Error('database down'));

    const signature = sign(String(Date.now()));
    const body = { type: 'subscription_preapproval', data: { id: 'pre-1' } };

    const failed = await notify(body, signature);
    expect(failed.status).toBe(500);
    expect(mocks.claimed.size).toBe(0);

    const retry = await notify(body, signature);
    expect(retry.status).toBe(200);
    expect(storage.updateUserPlan).toHaveBeenCalledWith('user_1', 'premium', 'monthly');
  });

  it('brings the plan back when a paused subscription is resumed', async () => {
    storage.getUser.mockResolvedValue({
      id: 'user_1',
      plan: 'premium',
      stripeSubscriptionId: null,
      mpPreapprovalId: 'pre-1',
    } as any);

    // Paused: the charge stops, so the plan stops.
    stubPreapproval(preapproval('paused', { last_modified: '2026-02-01T00:00:00.000Z' }));
    await notify(
      { type: 'subscription_preapproval', data: { id: 'pre-1' } },
      sign(String(Date.now())),
    );
    expect(storage.updateUserPlan).toHaveBeenLastCalledWith('user_1', 'free', 'monthly');
    // The id stays on the account (see the test below), so the resume still matches it.
    expect(storage.updateUser).not.toHaveBeenCalledWith('user_1', { mpPreapprovalId: null });

    // Resumed: same id, and "authorized" again — the state the subscription started in.
    // Keying the notice on the status alone dropped this and left a paying customer on free.
    storage.getUser.mockResolvedValue({
      id: 'user_1',
      plan: 'free',
      stripeSubscriptionId: null,
      mpPreapprovalId: 'pre-1',
    } as any);
    stubPreapproval(preapproval('authorized', { last_modified: '2026-03-01T00:00:00.000Z' }));
    const resumed = await notify(
      { type: 'subscription_preapproval', data: { id: 'pre-1' } },
      sign(String(Date.now())),
    );

    expect(resumed.status).toBe(200);
    expect(resumed.json.duplicate).toBeUndefined();
    expect(storage.updateUserPlan).toHaveBeenLastCalledWith('user_1', 'premium', 'monthly');
    expect(storage.updateUser).toHaveBeenCalledWith('user_1', { mpPreapprovalId: 'pre-1' });
  });

  it('keeps a paused subscription on the account so the customer can still cancel it', async () => {
    storage.getUser.mockResolvedValue({
      id: 'user_1',
      plan: 'premium',
      stripeSubscriptionId: null,
      mpPreapprovalId: 'pre-1',
    } as any);
    stubPreapproval(preapproval('paused', { last_modified: '2026-04-01T00:00:00.000Z' }));

    const result = await notify(
      { type: 'subscription_preapproval', data: { id: 'pre-1' } },
      sign(String(Date.now())),
    );

    expect(result.status).toBe(200);
    expect(storage.updateUserPlan).toHaveBeenLastCalledWith('user_1', 'free', 'monthly');
    // Not cleared: the id is the only handle the profile page has on a paused subscription.
    expect(storage.updateUser).not.toHaveBeenCalledWith('user_1', { mpPreapprovalId: null });
  });

  it('ends a second subscription that was left pending when the first is authorised', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: { method?: string }) => {
      const target = String(url);
      if (target.includes('/preapproval/search')) {
        // Two authorisations for the same person: the one being activated, and one left
        // pending by a second click on "subscribe".
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            results: [preapproval('authorized'), preapproval('pending', { id: 'pre-2' })],
          }),
        };
      }
      calls.push(`${init?.method ?? 'GET'} ${target.replace('https://api.mercadopago.com', '')}`);
      return { ok: true, status: 200, text: async () => JSON.stringify(preapproval('authorized')) };
    }));

    const result = await notify(
      { type: 'subscription_preapproval', data: { id: 'pre-1' } },
      sign(String(Date.now())),
    );

    expect(result.status).toBe(200);
    expect(storage.updateUserPlan).toHaveBeenCalledWith('user_1', 'premium', 'monthly');
    // Two payable subscriptions would be two charges for one plan.
    expect(calls).toContain('PUT /preapproval/pre-2');
    expect(calls).not.toContain('PUT /preapproval/pre-1');
  });
});
