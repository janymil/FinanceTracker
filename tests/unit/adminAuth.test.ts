import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Read once, when `server/adminAuth` is imported below.
process.env.ADMIN_PASSWORD = 'unit-test-shared-password';

beforeAll(async () => {
  const { adminAuth, adminLogin, isAdminRequest } = await import('../../server/adminAuth');
  const app = express();
  // Stand-ins for express-session and clerkMiddleware, which the test app does not mount.
  app.use((req: any, _res, next) => {
    req.session = req.headers['x-legacy-admin'] === '1' ? { isAdminAuthenticated: true } : {};
    req.auth = () => ({ userId: req.headers['x-user'] ?? null });
    next();
  });
  app.use(express.json());
  app.post('/admin/login', adminLogin);
  app.get('/admin', adminAuth, (_req, res) => res.json({ ok: true }));
  // The shape `/api/admin-analytics/auth-status` answers with.
  app.get('/admin/status', async (req: any, res) =>
    res.json({ authenticated: await isAdminRequest(req) }),
  );
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

async function status(headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}/admin/status`, { headers });
  return response.json();
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

describe('the shared admin password', () => {
  const PASSWORD = 'unit-test-shared-password';

  function login(password: string) {
    return fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  }

  const original = { nodeEnv: process.env.NODE_ENV, allow: process.env.ALLOW_LEGACY_ADMIN_PASSWORD };

  afterEach(() => {
    process.env.NODE_ENV = original.nodeEnv;
    if (original.allow === undefined) delete process.env.ALLOW_LEGACY_ADMIN_PASSWORD;
    else process.env.ALLOW_LEGACY_ADMIN_PASSWORD = original.allow;
  });

  it('works in development, where a fresh Clerk test account has no admin role', async () => {
    process.env.NODE_ENV = 'development';

    expect((await login(PASSWORD)).status).toBe(200);
  });

  it('is refused in production even when the password is correct', async () => {
    // One shared secret with no second factor, guarding an area that can read and delete every
    // customer's records. Production must not open it by accident.
    process.env.NODE_ENV = 'production';

    const response = await login(PASSWORD);

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('legacy_password_disabled');
  });

  it('opens again only when the operator writes the risk down', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_LEGACY_ADMIN_PASSWORD = '1';

    expect((await login(PASSWORD)).status).toBe(200);
  });

  it('still refuses the wrong password in development', async () => {
    process.env.NODE_ENV = 'development';

    expect((await login('not-the-password')).status).toBe(401);
  });
});

describe('adminAuth — the second factor', () => {
  afterEach(() => {
    delete process.env.ADMIN_REQUIRE_2FA;
  });

  it('refuses an admin account with no second factor when it is required', async () => {
    process.env.ADMIN_REQUIRE_2FA = '1';
    getUser.mockResolvedValueOnce({ publicMetadata: { role: 'admin' }, twoFactorEnabled: false });

    expect((await call({ 'x-user': 'user_admin_no_2fa' })).status).toBe(401);
  });

  it('accepts an admin account that has one enrolled', async () => {
    process.env.ADMIN_REQUIRE_2FA = '1';
    getUser.mockResolvedValueOnce({ publicMetadata: { role: 'admin' }, twoFactorEnabled: true });

    expect((await call({ 'x-user': 'user_admin_with_2fa' })).status).toBe(200);
  });

  it('keeps the second-factor answer in the cache, not just the role', async () => {
    process.env.ADMIN_REQUIRE_2FA = '1';
    getUser.mockResolvedValueOnce({ publicMetadata: { role: 'admin' }, twoFactorEnabled: false });

    // Two calls, one lookup: the cached decision must not lose the 2FA result and let the
    // second request through.
    expect((await call({ 'x-user': 'user_admin_cached' })).status).toBe(401);
    expect((await call({ 'x-user': 'user_admin_cached' })).status).toBe(401);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('can be turned off, for an operator who accepts the risk in writing', async () => {
    process.env.ADMIN_REQUIRE_2FA = '0';
    getUser.mockResolvedValueOnce({ publicMetadata: { role: 'admin' }, twoFactorEnabled: false });

    expect((await call({ 'x-user': 'user_admin_risk' })).status).toBe(200);
  });

  it('is not enforced outside production by default, so a developer is not locked out', async () => {
    getUser.mockResolvedValueOnce({ publicMetadata: { role: 'admin' }, twoFactorEnabled: false });

    expect((await call({ 'x-user': 'user_admin_dev' })).status).toBe(200);
  });

  it('never asks the legacy password session for a second factor', async () => {
    process.env.ADMIN_REQUIRE_2FA = '1';

    expect((await call({ 'x-legacy-admin': '1' })).status).toBe(200);
  });
});

/**
 * The status endpoint the panel asks before it renders anything.
 *
 * It used to report only the password session, so a Clerk admin was let through every admin
 * API and still shown the password form — the panel could never open for them. These tests
 * pin the rule: the login screen must answer with whatever the guard would decide.
 */
describe('isAdminRequest — the answer the login screen shows', () => {
  it('reports a Clerk admin as authenticated, so the password form never renders', async () => {
    getUser.mockResolvedValueOnce({ publicMetadata: { role: 'admin' }, twoFactorEnabled: false });

    expect(await status({ 'x-user': 'user_status_admin' })).toEqual({ authenticated: true });
  });

  it('reports the legacy password session as authenticated without asking Clerk', async () => {
    expect(await status({ 'x-legacy-admin': '1' })).toEqual({ authenticated: true });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('reports a signed-in user without the admin role as not authenticated', async () => {
    getUser.mockResolvedValueOnce({ publicMetadata: { role: 'user' } });

    expect(await status({ 'x-user': 'user_status_plain' })).toEqual({ authenticated: false });
  });

  it('reports an anonymous visitor as not authenticated without asking Clerk', async () => {
    expect(await status()).toEqual({ authenticated: false });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('agrees with the guard: an admin refused by the second-factor rule is not shown as authenticated', async () => {
    process.env.ADMIN_REQUIRE_2FA = '1';
    getUser.mockResolvedValueOnce({ publicMetadata: { role: 'admin' }, twoFactorEnabled: false });

    // Same account, both doors: the status must not promise access the guard will refuse.
    expect(await status({ 'x-user': 'user_status_no_2fa' })).toEqual({ authenticated: false });
    expect((await call({ 'x-user': 'user_status_no_2fa' })).status).toBe(401);

    delete process.env.ADMIN_REQUIRE_2FA;
  });
});
