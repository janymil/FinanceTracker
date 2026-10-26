import { afterEach, describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  rateLimit,
  resetRateLimits,
  setRateLimitCapacityForTests,
} from '../../server/middleware/rateLimit';

/**
 * The limiter's map is bounded, and when it is full the oldest keys are dropped. The admin login
 * lockout is the oldest key there is, so a flood of unrelated traffic used to delete it and the
 * lockout reset itself. `protectFromEviction` is the fix; these tests pin both halves: a
 * protected bucket survives, and eviction still happens for everything else.
 */
function makeRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

type Middleware = (req: Request, res: any, next: () => void) => void;

/** Runs the middleware once and reports whether it passed the request on. */
function run(middleware: Middleware, req: Partial<Request>): Promise<{ passed: boolean; res: any }> {
  return new Promise((resolve) => {
    const res = makeRes();
    let settled = false;
    const finish = (passed: boolean) => {
      if (settled) return;
      settled = true;
      resolve({ passed, res });
    };

    middleware(req as Request, res, () => finish(true));
    // A blocked request never calls next(); settle on the microtask queue after it returned.
    queueMicrotask(() => finish(false));
  });
}

const request = (ip: string): Partial<Request> => ({
  path: '/probe',
  headers: {},
  ip,
});

afterEach(() => {
  resetRateLimits();
});

describe('rate-limit eviction', () => {
  it('still evicts an ordinary bucket when the map is full', async () => {
    setRateLimitCapacityForTests(3);

    const limited = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: 'ordinary' });
    expect((await run(limited, request('10.0.0.1'))).passed).toBe(true);
    expect((await run(limited, request('10.0.0.1'))).passed).toBe(false);

    // Two other clients fill the map past its capacity.
    const other = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'other' });
    await run(other, request('10.0.0.2'));
    await run(other, request('10.0.0.3'));

    // The oldest key was dropped, so this client is counted afresh — the behaviour that made
    // the admin lockout resettable.
    expect((await run(limited, request('10.0.0.1'))).passed).toBe(true);
  });

  it('keeps a protected bucket through the same flood', async () => {
    setRateLimitCapacityForTests(3);

    const lockout = rateLimit({
      windowMs: 60_000,
      max: 1,
      keyPrefix: 'admin-login-global',
      keyFn: () => 'global',
      protectFromEviction: true,
    });
    const login = request('10.0.0.1');

    expect((await run(lockout, login)).passed).toBe(true);
    expect((await run(lockout, login)).passed).toBe(false);

    const other = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'other' });
    await run(other, request('10.0.0.2'));
    await run(other, request('10.0.0.3'));
    await run(other, request('10.0.0.4'));

    // Still locked: the lockout outlived the keys that would have evicted it.
    expect((await run(lockout, login)).passed).toBe(false);
  });

  it('lets a protected bucket expire normally', async () => {
    setRateLimitCapacityForTests(10);

    const lockout = rateLimit({
      windowMs: 1,
      max: 1,
      keyPrefix: 'admin-login-global',
      keyFn: () => 'global',
      protectFromEviction: true,
    });
    const login = request('10.0.0.1');

    expect((await run(lockout, login)).passed).toBe(true);
    expect((await run(lockout, login)).passed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 5));

    // Protection is against eviction, not against the window ending.
    expect((await run(lockout, login)).passed).toBe(true);
  });
});
