import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Clerk must be mounted before any route module registers.
 *
 * It used to be mounted inside registerAuthRoutes, which runs after registerMobileUploadRoutes.
 * Express runs handlers in registration order, so `isAuthenticated` on the QR-upload routes ran
 * before `req.auth` existed, threw, and answered 401 — the feature could never work. The unit
 * test that covered it replaced this module with a stub, so nothing failed.
 *
 * Two guards here: the wiring order in routes/index.ts, and the diagnostic that names the fault
 * if the order is ever broken again.
 */
vi.mock('../../server/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const ROOT = path.resolve(__dirname, '..', '..');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { isAuthenticated } = await import('../../server/clerkAuth');
  // No Clerk gate is mounted on purpose: this is the shape of the bug.
  const app = express();
  app.get('/probe', isAuthenticated, (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('the auth gate', () => {
  it('names the real fault when Clerk was never mounted', async () => {
    const response = await fetch(`${baseUrl}/probe`);
    expect(response.status).toBe(503);
    const body: any = await response.json();
    expect(body.code).toBe('auth_not_mounted');
  });

  it('is installed before the first route module in routes/index.ts', () => {
    const text = fs.readFileSync(path.join(ROOT, 'server/routes/index.ts'), 'utf8');

    const setupAt = text.indexOf('setupClerkAuth(app)');
    expect(setupAt, 'routes/index.ts no longer mounts Clerk itself').toBeGreaterThan(-1);

    const routeModules = Array.from(text.matchAll(/^\s*register\w+Routes\(app\);/gm))
      .map((match) => match.index ?? -1)
      .filter((index) => index > -1);

    expect(routeModules.length, 'no route modules found in routes/index.ts').toBeGreaterThan(0);
    expect(setupAt).toBeLessThan(Math.min(...routeModules));
  });

  it('is not mounted a second time inside a route module', () => {
    const authRoutes = fs.readFileSync(path.join(ROOT, 'server/routes/authRoutes.ts'), 'utf8');
    expect(authRoutes).not.toMatch(/setupClerkAuth\(/);
  });
});

describe('isStaticAssetPath', () => {
  it.each([
    ['/assets/index-abc123.css', true],
    ['/logo.png', true],
    ['/favicon.ico', true],
    ['/fonts/inter.woff2', true],
    ['/api/auth/user', false],
    ['/api/courses/progress', false],
    // The regression that started this: a dotted *value* is not a file extension.
    ['/api/learning/merchant/amazon.com', false],
    ['/api/collaborative-goals/12', false],
  ])('%s → %s', async (requestPath, expected) => {
    const { isStaticAssetPath } = await import('../../server/clerkAuth');
    expect(isStaticAssetPath(requestPath)).toBe(expected);
  });
});
