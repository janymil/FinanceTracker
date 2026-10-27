import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MercadoPagoError,
  createPreapproval,
  getPreapproval,
  isMercadoPagoConfigured,
  verifyWebhookSignature,
} from '../../server/mercadopago';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

/**
 * The integration cannot be exercised end-to-end without live MercadoPago credentials, so
 * these tests pin down the two things that would silently charge the wrong amount or let a
 * forged webhook through: the request body and the signature check.
 */
describe('MercadoPago preapproval', () => {
  it('reports configuration only when the access token is present', () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    expect(isMercadoPagoConfigured()).toBe(false);
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    expect(isMercadoPagoConfigured()).toBe(true);
  });

  it('creates a PEN, monthly preapproval with the price from the shared catalogue', async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ id: 'pre-123', init_point: 'https://mp/checkout/pre-123' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const created = await createPreapproval({
      userId: 'user_1',
      plan: 'premium',
      interval: 'monthly',
      payerEmail: 'payer@example.com',
      backUrl: 'https://kaptia.app/es/profile?mp=return',
    });

    expect(created).toEqual({ id: 'pre-123', initPoint: 'https://mp/checkout/pre-123' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.external_reference).toBe('user_1');
    expect(body.payer_email).toBe('payer@example.com');
    expect(body.auto_recurring).toMatchObject({
      transaction_amount: 19.9,
      currency_id: 'PEN',
      frequency: 1,
      frequency_type: 'months',
    });
  });

  it('expresses a yearly plan as twelve months, the only form MercadoPago accepts', async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ id: 'pre-9', init_point: 'https://mp/checkout/pre-9' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await createPreapproval({
      userId: 'user_1',
      plan: 'standard',
      interval: 'yearly',
      payerEmail: 'payer@example.com',
      backUrl: 'https://kaptia.app/es/profile?mp=return',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    // `frequency_type: 'years'` is rejected by the API ("valid ones are [days, months]"), so
    // every yearly subscription used to fail with a 502. A year is twelve months.
    expect(body.auto_recurring).toMatchObject({
      transaction_amount: 99.9,
      currency_id: 'PEN',
      frequency: 12,
      frequency_type: 'months',
    });
  });

  it('registers the app webhook on the preapproval so the plan can actually activate', async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ id: 'pre-7', init_point: 'https://mp/checkout/pre-7' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await createPreapproval({
      userId: 'user_1',
      plan: 'standard',
      interval: 'monthly',
      payerEmail: 'payer@example.com',
      backUrl: 'https://kaptia.app/es/profile?mp=return',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).notification_url).toBe(
      'https://kaptia.app/api/mercadopago/webhook',
    );
  });

  it('falls back to APP_URL for the webhook when the return URL is not absolute', async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    process.env.APP_URL = 'https://staging.kaptia.app/';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ id: 'pre-8', init_point: 'https://mp/checkout/pre-8' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await createPreapproval({
      userId: 'user_1',
      plan: 'standard',
      interval: 'monthly',
      payerEmail: 'payer@example.com',
      backUrl: '/es/profile',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).notification_url).toBe(
      'https://staging.kaptia.app/api/mercadopago/webhook',
    );
  });

  it('surfaces MercadoPago errors instead of returning a broken checkout URL', async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'invalid_token' }),
    })));

    await expect(createPreapproval({
      userId: 'user_1',
      plan: 'standard',
      interval: 'monthly',
      payerEmail: 'payer@example.com',
      backUrl: 'https://kaptia.app/es/profile?mp=return',
    })).rejects.toThrow('invalid_token');
  });
});

describe('MercadoPago errors', () => {
  it('keeps the HTTP status so the webhook can tell "unknown id" from an outage', async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: 'Preapproval not found for ID: 123456' }),
    })));

    const failure = getPreapproval('123456');
    await expect(failure).rejects.toBeInstanceOf(MercadoPagoError);
    await expect(failure).rejects.toMatchObject({ status: 404 });
  });

  it('keeps a 5xx status so a real outage still fails loudly', async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ message: 'service unavailable' }),
    })));

    await expect(getPreapproval('pre-1')).rejects.toMatchObject({ status: 503 });
  });
});

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test';
  const dataId = 'pre-123';
  const requestId = 'req-1';
  const ts = '1700000000';

  function sign(manifest: string): string {
    return crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  }

  it('accepts a correctly signed payload', () => {
    const signature = `ts=${ts},v1=${sign(`id:${dataId};request-id:${requestId};ts:${ts};`)}`;
    expect(verifyWebhookSignature({ signatureHeader: signature, requestId, dataId, secret })).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const signature = `ts=${ts},v1=${sign(`id:other;request-id:${requestId};ts:${ts};`)}`;
    expect(verifyWebhookSignature({ signatureHeader: signature, requestId, dataId, secret })).toBe(false);
  });

  it('rejects a malformed header', () => {
    expect(verifyWebhookSignature({ signatureHeader: 'v1=abc', requestId, dataId, secret })).toBe(false);
    expect(verifyWebhookSignature({ signatureHeader: undefined, requestId, dataId, secret })).toBe(false);
  });

  it('only skips verification when no secret is configured', () => {
    expect(verifyWebhookSignature({ signatureHeader: undefined, requestId, dataId, secret: undefined })).toBe(true);
  });
});

describe('verifyWebhookSignature hardening', () => {
  const secret = 'whsec_test';
  const dataId = 'pre-123';
  const requestId = 'req-1';
  const sign = (ts: string) =>
    `ts=${ts},v1=${crypto.createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex')}`;

  it('refuses everything in production when no secret is configured', () => {
    process.env.NODE_ENV = 'production';
    expect(verifyWebhookSignature({ signatureHeader: undefined, requestId, dataId, secret: undefined })).toBe(false);
  });

  it('accepts a fresh signature and rejects an old one (replay)', () => {
    const now = 1_800_000_000_000;
    const fresh = sign(String(now - 60_000));
    const old = sign(String(now - 60 * 60_000));
    expect(verifyWebhookSignature({ signatureHeader: fresh, requestId, dataId, secret, now })).toBe(true);
    expect(verifyWebhookSignature({ signatureHeader: old, requestId, dataId, secret, now })).toBe(false);
  });

  it('reads timestamps in seconds as well as milliseconds', () => {
    const now = 1_800_000_000_000;
    const seconds = sign(String(Math.floor((now - 30_000) / 1000)));
    expect(verifyWebhookSignature({ signatureHeader: seconds, requestId, dataId, secret, now })).toBe(true);
  });
});
