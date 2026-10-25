import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * The admin gate.
 *
 * Two doors, and the order matters: the legacy shared-password session keeps working, and a
 * Clerk account whose public metadata says role="admin" is accepted. Everything else gets a
 * 401 — including when Clerk itself is unreachable, because a failed lookup must not turn
 * into an open door.
 */
const getUser = vi.hoisted(() => vi.fn());

vi.mock('@clerk/express', () => ({
  clerkClient: { users: { getUser } },
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { adminAuth } = await import('../../server/adminAuth');
  const app = express();
  // Stand-ins for express-session and clerkMiddleware, which the test app does not mount.
  app.use((req: any, _res, next) => {
    req.session = req.headers['x-legacy-admin'] === '1' ? { isAdminAuthenticated: true } : {};
    req.auth = () => ({ userId: req.headers['x-user'] ?? null });
    next();
  });
  app.get('/admin', adminAuth, (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  getUser.mockReset();
  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

function call(headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/admin`, { headers });
}

describe('adminAuth', () => {
  it('refuses a request with neither a Clerk user nor the legacy session', async () => {
    expect((await call()).status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('accepts a Clerk user whose public metadata says role="admin"', async () => {
    getUser.mockResolvedValueOnce({ publicMetadata: { role: 'admin' } });

    const response = await call({ 'x-user': 'user_admin' });

    expect(response.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith('user_admin');
  });

  it('refuses a signed-in Clerk user without the admin role', async () => {
    getUser.mockResolvedValueOnce({ publicMetadata: { role: 'user' } });

    expect((await call({ 'x-user': 'user_plain' })).status).toBe(401);
  });

  it('refuses a Clerk user with no metadata at all', async () => {
    getUser.mockResolvedValueOnce({ publicMetadata: {} });

    expect((await call({ 'x-user': 'user_empty' })).status).toBe(401);
  });

  it('fails closed when Clerk cannot be reached', async () => {
    getUser.mockRejectedValueOnce(new Error('network down'));

    expect((await call({ 'x-user': 'user_offline' })).status).toBe(401);
  });

  it('still accepts the legacy password session and does not ask Clerk about it', async () => {
    const response = await call({ 'x-legacy-admin': '1' });

    expect(response.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();
  });
});
