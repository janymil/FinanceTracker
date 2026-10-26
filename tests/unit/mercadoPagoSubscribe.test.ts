import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Starting a subscription must never leave two of them payable. Pressing "subscribe" twice
 * used to create a second *pending* authorisation next to the first, and both could be
 * completed — two charges for one plan.
 */
const mocks = vi.hoisted(() => ({
  storage: {
    getUser: vi.fn(),
    updateUserPlan: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock('../../server/storage', () => ({ storage: mocks.storage }));
vi.mock('../../server/clerkAuth', () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  getUserId: () => 'user_1',
}));
vi.mock('../../server/billingRegion', () => ({
  regionForRequest: () => ({ country: 'PE', gateway: 'mercadopago', currency: 'pen' }),
}));

const ORIGINAL_ENV = { ...process.env };

/** Kept from before any stub: the test's own HTTP call must reach the local server. */
const realFetch = globalThis.fetch.bind(globalThis);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
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
  mocks.storage.getUser.mockResolvedValue({
    id: 'user_1',
    email: 'ana@example.com',
    plan: 'free',
    stripeSubscriptionId: null,
    mpPreapprovalId: 'pre-old',
  });
  mocks.storage.updateUser.mockResolvedValue({});
  mocks.storage.updateUserPlan.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
});

/** Stubs MercadoPago: records each call, answers a cancel or a create. */
function stubMercadoPago(calls: Array<{ method: string; path: string }>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: { method?: string }) => {
    const path = String(url).replace('https://api.mercadopago.com', '');
    calls.push({ method: init?.method ?? 'GET', path });
    const body =
      init?.method === 'POST'
        ? { id: 'pre-new', init_point: 'https://www.mercadopago.com.pe/checkout/pre-new' }
        : { id: 'pre-old', status: 'cancelled' };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  }));
}

async function subscribe(plan = 'premium', interval = 'monthly') {
  const response = await realFetch(`${baseUrl}/api/mercadopago/subscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan, interval }),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

describe('POST /api/mercadopago/subscribe', () => {
  it('ends the previous subscription, even a pending one, before creating another', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    stubMercadoPago(calls);

    const result = await subscribe();

    expect(result.status).toBe(200);
    expect(result.json.preapproval_id).toBe('pre-new');
    // The old one is cancelled first: a pending authorisation from an earlier tab would
    // otherwise still be payable.
    expect(calls).toEqual([
      { method: 'PUT', path: '/preapproval/pre-old' },
      { method: 'POST', path: '/preapproval' },
    ]);
    expect(mocks.storage.updateUser).toHaveBeenCalledWith('user_1', { mpPreapprovalId: 'pre-new' });
  });

  it('does not downgrade someone who is not paying yet', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    stubMercadoPago(calls);

    await subscribe();

    // plan was 'free': there is no paid access to take away while the new one is authorised.
    expect(mocks.storage.updateUserPlan).not.toHaveBeenCalled();
  });

  it('creates nothing when the old subscription cannot be cancelled', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: { method?: string }) => {
      const path = String(url).replace('https://api.mercadopago.com', '');
      calls.push({ method: init?.method ?? 'GET', path });
      if (init?.method === 'PUT') {
        return { ok: false, status: 500, text: async () => JSON.stringify({ message: 'provider down' }) };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'pre-new', init_point: 'https://www.mercadopago.com.pe/checkout/pre-new' }),
      };
    }));

    const result = await subscribe();

    // The old one may still charge, so a second one must not exist.
    expect(result.status).toBe(502);
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    expect(mocks.storage.updateUser).not.toHaveBeenCalled();
  });
});
