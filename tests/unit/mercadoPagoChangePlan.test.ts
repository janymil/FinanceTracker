import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Changing a Peruvian plan must never be a cancel-then-buy.
 *
 * The old sequence cancelled the subscription the customer was on, dropped them to free, and only
 * then created a new one — so a monthly customer asking for premium lost access while they were
 * authorising it, and the days already paid for were simply gone. These tests pin the three
 * movements that are allowed, and the one that is not (spending nothing on a plan you already have).
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
// The tax-document queue writes to the database; what it does has its own tests. Kept inert here
// so this file is about the subscription only.
vi.mock('../../server/billingDocuments', () => ({
  recordBillingDocument: vi.fn(async () => null),
  findUserByPreapproval: vi.fn(async () => null),
  chargeReference: (reference: string, at: Date) =>
    `${reference}#${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`,
  periodEnd: (start: Date, interval: string) => {
    const end = new Date(start.getTime());
    if (interval === 'yearly') end.setUTCFullYear(end.getUTCFullYear() + 1);
    else end.setUTCMonth(end.getUTCMonth() + 1);
    return end;
  },
}));

const ORIGINAL_ENV = { ...process.env };
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
  mocks.storage.updateUser.mockResolvedValue({});
  mocks.storage.updateUserPlan.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
});

const NEXT_CHARGE = '2026-11-15T00:00:00.000Z';

/** Stubs MercadoPago and records every call, with the body that was sent. */
function stubMercadoPago() {
  const calls: Array<{ method: string; path: string; body?: any }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: { method?: string; body?: string }) => {
      const path = String(url).replace('https://api.mercadopago.com', '');
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({ method, path, body });

      let payload: Record<string, unknown> = {};
      if (method === 'GET' && path.startsWith('/preapproval/')) {
        payload = {
          id: 'pre-old',
          status: 'authorized',
          external_reference: 'user_1',
          reason: 'Kaptia standard',
          next_payment_date: NEXT_CHARGE,
          auto_recurring: { frequency: 1, frequency_type: 'months' },
        };
      } else if (method === 'PUT' && path.startsWith('/preapproval/')) {
        payload = { id: 'pre-old', status: 'authorized' };
      } else if (method === 'POST' && path === '/preapproval') {
        payload = { id: 'pre-new', init_point: 'https://www.mercadopago.com.pe/checkout/pre-new' };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    }),
  );
  return calls;
}

function setUser(overrides: Record<string, unknown> = {}) {
  mocks.storage.getUser.mockResolvedValue({
    id: 'user_1',
    email: 'ana@example.com',
    plan: 'standard',
    billingInterval: 'monthly',
    stripeSubscriptionId: null,
    mpPreapprovalId: 'pre-old',
    paidUntil: null,
    pendingPlan: null,
    ...overrides,
  });
}

async function subscribe(plan: string, interval: string) {
  const response = await realFetch(`${baseUrl}/api/mercadopago/subscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan, interval }),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

describe('POST /api/mercadopago/subscribe as a plan change', () => {
  it('upgrades standard monthly to premium monthly in place: new amount, same subscription', async () => {
    setUser();
    const calls = stubMercadoPago();

    const result = await subscribe('premium', 'monthly');

    expect(result.status).toBe(200);
    expect(result.json.changed).toBe(true);
    expect(result.json.direction).toBe('upgrade');

    // One write to the provider: the amount. No cancellation, no second subscription.
    expect(calls).toEqual([
      {
        method: 'PUT',
        path: '/preapproval/pre-old',
        body: { auto_recurring: { transaction_amount: 19.9, currency_id: 'PEN' } },
      },
    ]);
    expect(mocks.storage.updateUserPlan).toHaveBeenCalledWith('user_1', 'premium', 'monthly');
    expect(mocks.storage.updateUser).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({ pendingPlan: null }),
    );
  });

  it('moves a monthly plan to the yearly price of the same tier without cutting access', async () => {
    setUser();
    const calls = stubMercadoPago();

    const result = await subscribe('standard', 'yearly');

    expect(result.status).toBe(200);
    expect(result.json.preapproval_id).toBe('pre-new');

    // The paid period is read first, then the old subscription is cancelled, then a new one is
    // created: the interval cannot be changed on an existing preapproval.
    expect(calls.map((call) => call.method)).toEqual(['GET', 'PUT', 'POST']);
    // Nobody is dropped to free while the new authorisation is pending.
    expect(mocks.storage.updateUserPlan).not.toHaveBeenCalled();
    expect(mocks.storage.updateUser).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({ mpPreapprovalId: 'pre-new', paidUntil: new Date(NEXT_CHARGE) }),
    );
  });

  it('schedules a downgrade at the next charge instead of removing access now', async () => {
    setUser({ plan: 'premium' });
    const calls = stubMercadoPago();

    const result = await subscribe('standard', 'monthly');

    expect(result.status).toBe(200);
    expect(result.json.direction).toBe('downgrade');
    // The amount drops now, so the next charge is already the cheaper price…
    expect(calls[0]).toEqual({
      method: 'PUT',
      path: '/preapproval/pre-old',
      body: { auto_recurring: { transaction_amount: 9.9, currency_id: 'PEN' } },
    });
    // …but the plan moves on that charge date, not today.
    expect(mocks.storage.updateUserPlan).not.toHaveBeenCalled();
    expect(mocks.storage.updateUser).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({
        pendingPlan: 'standard',
        pendingInterval: 'monthly',
        pendingChangeAt: new Date(NEXT_CHARGE),
      }),
    );
  });

  it('refuses to sell the plan the customer already pays for', async () => {
    setUser();
    const calls = stubMercadoPago();

    const result = await subscribe('standard', 'monthly');

    expect(result.status).toBe(409);
    expect(result.json.code).toBe('already_subscribed');
    expect(calls).toEqual([]);
  });

  it('never creates a second subscription when the customer pays by card elsewhere', async () => {
    setUser({ stripeSubscriptionId: 'sub_123', mpPreapprovalId: null });
    const calls = stubMercadoPago();

    const result = await subscribe('premium', 'monthly');

    expect(result.status).toBe(409);
    expect(calls).toEqual([]);
  });
});

