import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

/**
 * Country blocking guards a compliance rule, so the failure modes matter more than the happy
 * path. The version this replaced:
 *
 *   • skipped the check for the first 5 seconds after every process start;
 *   • returned an empty set when the blocked-country list could not be read — "nothing is
 *     blocked" — which is the failure mode a blocked visitor would choose;
 *   • called GeoJS on every request.
 *
 * These tests pin the current behaviour: no startup grace window, refuse when the list is
 * unknown, and one geolocation lookup per address.
 */
const state = vi.hoisted(() => ({
  rows: [] as Array<{ countryCode: string }>,
  throwOnList: false,
}));

vi.mock('../../server/db.js', () => ({
  db: {
    select: () => ({
      from: async () => {
        if (state.throwOnList) throw new Error('database unavailable');
        return state.rows;
      },
    }),
  },
}));

type MiddlewareModule = typeof import('../../server/middleware/countryBlocking');

async function load(): Promise<MiddlewareModule> {
  vi.resetModules();
  return import('../../server/middleware/countryBlocking');
}

function geoResponse(countryCode: string | null, country = 'Peru') {
  return {
    ok: true,
    status: 200,
    json: async () => ({ country_code: countryCode, country, city: 'Lima', ip: '203.0.113.9' }),
  } as unknown as Response;
}

function failingGeo() {
  return { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
}

interface Harness {
  req: Request;
  res: Response & { statusCode?: number; body?: unknown; headers: Record<string, string> };
  next: NextFunction;
  nextCalls: () => number;
}

function harness(ip = '203.0.113.9', path = '/api/transactions'): Harness {
  const req = {
    path,
    headers: { 'x-forwarded-for': ip },
    socket: { remoteAddress: ip },
  } as unknown as Request;

  const headers: Record<string, string> = {};
  let statusCode: number | undefined;
  let body: unknown;

  const res = {
    headersSent: false,
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    },
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (payload: unknown) => {
      body = payload;
      return res;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    headers,
  } as unknown as Harness['res'];

  let calls = 0;
  const next = (() => {
    calls += 1;
  }) as unknown as NextFunction;

  return { req, res, next, nextCalls: () => calls };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  state.rows = [];
  state.throwOnList = false;
  process.env.NODE_ENV = 'production';
  delete process.env.DISABLE_COUNTRY_BLOCKING;
  delete process.env.COUNTRY_BLOCK_FAIL_OPEN;
  delete process.env.COUNTRY_BLOCK_GEO_FAIL_CLOSED;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.resetModules();
});


describe('countryBlockingMiddleware — the blocked list', () => {
  it('refuses a visitor from a blocked country', async () => {
    state.rows = [{ countryCode: 'ru' }];
    vi.stubGlobal('fetch', vi.fn(async () => geoResponse('RU', 'Russia')));

    const { countryBlockingMiddleware } = await load();
    const { req, res, next, nextCalls } = harness();

    await countryBlockingMiddleware(req, res, next);

    expect(nextCalls()).toBe(0);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ error: 'Access denied', country: 'Russia' });
  });

  it('lets an allowed country through and records where it came from', async () => {
    state.rows = [{ countryCode: 'RU' }];
    vi.stubGlobal('fetch', vi.fn(async () => geoResponse('PE')));

    const { countryBlockingMiddleware } = await load();
    const { req, res, next, nextCalls } = harness();

    await countryBlockingMiddleware(req, res, next);

    expect(nextCalls()).toBe(1);
    expect((req as unknown as { geoInfo?: { countryCode: string } }).geoInfo?.countryCode).toBe('PE');
  });

  it('refuses on the very first request after a restart (the 5-second window is gone)', async () => {
    // Nothing warms the cache first: this is the first call this process ever makes.
    state.rows = [{ countryCode: 'RU' }];
    vi.stubGlobal('fetch', vi.fn(async () => geoResponse('RU')));

    const { countryBlockingMiddleware } = await load();
    const { req, res, next, nextCalls } = harness();

    await countryBlockingMiddleware(req, res, next);

    expect(nextCalls()).toBe(0);
    expect(res.statusCode).toBe(403);
  });

  it('refuses when the list cannot be read — "unknown" is not "nothing is blocked"', async () => {
    state.throwOnList = true;
    vi.stubGlobal('fetch', vi.fn(async () => geoResponse('PE')));

    const { countryBlockingMiddleware } = await load();
    const { req, res, next, nextCalls } = harness();

    await countryBlockingMiddleware(req, res, next);

    expect(nextCalls()).toBe(0);
    expect(res.statusCode).toBe(503);
    expect(res.headers['Retry-After']).toBe('30');
  });

  it('can be told to fail open, for an operator who prefers availability', async () => {
    state.throwOnList = true;
    process.env.COUNTRY_BLOCK_FAIL_OPEN = '1';
    vi.stubGlobal('fetch', vi.fn(async () => geoResponse('PE')));

    const { countryBlockingMiddleware } = await load();
    const { req, res, next, nextCalls } = harness();

    await countryBlockingMiddleware(req, res, next);

    expect(nextCalls()).toBe(1);
    expect(res.statusCode).toBeUndefined();
  });

describe('countryBlockingMiddleware — geolocation', () => {
  it('allows the request when GeoJS is down, and says so in the log', async () => {
    state.rows = [{ countryCode: 'RU' }];
    vi.stubGlobal('fetch', vi.fn(async () => failingGeo()));

    const { countryBlockingMiddleware } = await load();
    const { req, res, next, nextCalls } = harness();

    await countryBlockingMiddleware(req, res, next);

    expect(nextCalls()).toBe(1);
    expect(res.statusCode).toBeUndefined();
  });

  it('refuses when GeoJS is down and the operator asked for strictness', async () => {
    process.env.COUNTRY_BLOCK_GEO_FAIL_CLOSED = '1';
    vi.stubGlobal('fetch', vi.fn(async () => failingGeo()));

    const { countryBlockingMiddleware } = await load();
    const { req, res, next, nextCalls } = harness();

    await countryBlockingMiddleware(req, res, next);

    expect(nextCalls()).toBe(0);
    expect(res.statusCode).toBe(503);
  });

  it('looks one address up once, not once per request', async () => {
    state.rows = [{ countryCode: 'RU' }];
    const fetchMock = vi.fn(async () => geoResponse('PE'));
    vi.stubGlobal('fetch', fetchMock);

    const { countryBlockingMiddleware } = await load();

    for (let i = 0; i < 5; i += 1) {
      const { req, res, next } = harness('203.0.113.9');
      await countryBlockingMiddleware(req, res, next);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches a failed lookup too, so an outage is not one call per visitor', async () => {
    const fetchMock = vi.fn(async () => failingGeo());
    vi.stubGlobal('fetch', fetchMock);

    const { countryBlockingMiddleware } = await load();

    for (let i = 0; i < 3; i += 1) {
      const { req, res, next } = harness('198.51.100.7');
      await countryBlockingMiddleware(req, res, next);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('countryBlockingMiddleware — what it deliberately skips', () => {
  it('never geolocates the health check or localhost', async () => {
    const fetchMock = vi.fn(async () => geoResponse('PE'));
    vi.stubGlobal('fetch', fetchMock);

    const { countryBlockingMiddleware } = await load();

    const health = harness('203.0.113.9', '/health');
    await countryBlockingMiddleware(health.req, health.res, health.next);
    const local = harness('127.0.0.1');
    await countryBlockingMiddleware(local.req, local.res, local.next);

    expect(health.nextCalls()).toBe(1);
    expect(local.nextCalls()).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

});
