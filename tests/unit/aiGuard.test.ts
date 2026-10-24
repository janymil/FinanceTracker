import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * The gate every AI route sits behind: sign-in, the account off-switch, the free plan, and the
 * per-person ceiling on what AI may cost.
 */
const getUser = vi.hoisted(() => vi.fn());

vi.mock('../../server/storage', () => ({ storage: { getUser } }));
// The test names the caller in a header, so one server can play several people.
vi.mock('../../server/clerkAuth', () => ({
  getUserId: (req: any) => req.headers['x-test-user'] || undefined,
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  process.env.AI_RATE_PER_MIN = '3';
  process.env.AI_RATE_PER_HOUR = '5';
  const { aiGuard } = await import('../../server/aiAccess');
  const { resetRateLimits } = await import('../../server/middleware/rateLimit');
  resetRateLimits();

  const app = express();
  app.post('/ai', aiGuard(), (req: any, res) => res.json({ ok: true, aiUser: req.aiUser }));
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  delete process.env.AI_RATE_PER_MIN;
  delete process.env.AI_RATE_PER_HOUR;
});

beforeEach(async () => {
  getUser.mockReset();
  const { resetRateLimits } = await import('../../server/middleware/rateLimit');
  resetRateLimits();
});

const call = async (user?: string) => {
  const response = await fetch(`${baseUrl}/ai`, {
    method: 'POST',
    headers: user ? { 'x-test-user': user } : {},
  });
  return { status: response.status, json: await response.json(), headers: response.headers };
};

describe('aiGuard', () => {
  it('refuses a caller who is not signed in', async () => {
    const { status, json } = await call();
    expect(status).toBe(401);
    expect(json.code).toBe('unauthenticated');
  });

  it('refuses the free plan before any AI runs', async () => {
    getUser.mockResolvedValue({ id: 'u1', plan: 'free', aiEnabled: true });
    const { status, json } = await call('u1');
    expect(status).toBe(403);
    expect(json.code).toBe('plan_required');
  });

  it('refuses a paid account that switched AI off', async () => {
    getUser.mockResolvedValue({ id: 'u1', plan: 'premium', aiEnabled: false });
    const { status, json } = await call('u1');
    expect(status).toBe(403);
    expect(json.code).toBe('ai_disabled');
  });

  it('lets a paid account with AI on through and names the caller for the route', async () => {
    getUser.mockResolvedValue({ id: 'u1', plan: 'standard', aiEnabled: true });
    const { status, json } = await call('u1');
    expect(status).toBe(200);
    expect(json.aiUser).toEqual({ id: 'u1', plan: 'standard' });
  });

  it('stops a burst: the 4th call in a minute is a 429 with a stable code', async () => {
    getUser.mockResolvedValue({ id: 'u1', plan: 'premium', aiEnabled: true });
    for (let i = 0; i < 3; i += 1) expect((await call('u1')).status).toBe(200);

    const blocked = await call('u1');
    expect(blocked.status).toBe(429);
    expect(blocked.json.code).toBe('ai_rate_limited');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('counts each person separately', async () => {
    getUser.mockResolvedValue({ id: 'x', plan: 'premium', aiEnabled: true });
    for (let i = 0; i < 3; i += 1) await call('a');
    expect((await call('a')).status).toBe(429);
    expect((await call('b')).status).toBe(200);
  });

  it('does not spend a person\'s allowance on requests the gate refused', async () => {
    getUser.mockResolvedValue({ id: 'u1', plan: 'free', aiEnabled: true });
    for (let i = 0; i < 10; i += 1) expect((await call('u1')).status).toBe(403);

    getUser.mockResolvedValue({ id: 'u1', plan: 'premium', aiEnabled: true });
    expect((await call('u1')).status).toBe(200);
  });
});
