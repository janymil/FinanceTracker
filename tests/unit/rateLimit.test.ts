import { beforeEach, describe, expect, it } from 'vitest';
import { rateLimit, resetRateLimits } from '../../server/middleware/rateLimit';

function request(ip: string, userId?: string) {
  return {
    ip,
    socket: { remoteAddress: ip },
    auth: () => (userId ? { userId } : null),
  } as any;
}

function response() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
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
  return res;
}

describe('rateLimit', () => {
  beforeEach(() => resetRateLimits());

  it('allows requests up to the limit and then answers 429', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2, keyPrefix: 'test' });
    const ip = '10.0.0.1';

    const first = response();
    let nextCalls = 0;
    limiter(request(ip), first, () => { nextCalls += 1; });

    const second = response();
    limiter(request(ip), second, () => { nextCalls += 1; });

    const third = response();
    limiter(request(ip), third, () => { nextCalls += 1; });

    expect(nextCalls).toBe(2);
    expect(third.statusCode).toBe(429);
    expect(third.headers['Retry-After']).toBeDefined();
  });

  it('keeps separate buckets per client', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: 'test-ip' });
    const a = response();
    const b = response();
    let allowed = 0;

    limiter(request('10.0.0.1'), a, () => { allowed += 1; });
    limiter(request('10.0.0.2'), b, () => { allowed += 1; });

    expect(allowed).toBe(2);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
  });

  it('separates users when perUser is on', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: 'test-user', perUser: true });
    const sharedIp = '10.0.0.9';

    const userAFirst = response();
    const userASecond = response();
    const userBFirst = response();

    limiter(request(sharedIp, 'user_a'), userAFirst, () => undefined);
    limiter(request(sharedIp, 'user_a'), userASecond, () => undefined);
    limiter(request(sharedIp, 'user_b'), userBFirst, () => undefined);

    expect(userAFirst.statusCode).toBe(200);
    expect(userASecond.statusCode).toBe(429);
    expect(userBFirst.statusCode).toBe(200);
  });

  it('prefers the real visitor address behind Cloudflare', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: 'test-cf' });
    const visitor = '203.0.113.7';

    const first = response();
    limiter(
      { ...request('10.0.0.5'), headers: { 'cf-connecting-ip': visitor } } as any,
      first,
      () => undefined
    );

    const second = response();
    limiter(
      { ...request('10.0.0.6'), headers: { 'cf-connecting-ip': visitor } } as any,
      second,
      () => undefined
    );

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
  });

  it('starts counting again after the window', async () => {
    const limiter = rateLimit({ windowMs: 50, max: 1, keyPrefix: 'test-window' });
    const first = response();
    limiter(request('10.0.0.3'), first, () => undefined);

    const blocked = response();
    limiter(request('10.0.0.3'), blocked, () => undefined);
    expect(blocked.statusCode).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 70));

    const afterWindow = response();
    limiter(request('10.0.0.3'), afterWindow, () => undefined);
    expect(afterWindow.statusCode).toBe(200);
  });
});
