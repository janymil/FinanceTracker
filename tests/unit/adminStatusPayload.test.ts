import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * The payload `GET /api/admin-analytics/auth-status` really sends.
 *
 * `tests/unit/adminAuth.test.ts` mounts a stand-in for this route, so it pins the decision but
 * would stay green if this handler stopped reporting the password door at all. This file mounts
 * the real `registerAdminRoutes` and reads the real answer, which is what the panel obeys.
 *
 * No database is touched: the route only asks the admin gate, and the session stub stands in for
 * express-session.
 */
process.env.DATABASE_URL ??= 'postgresql://ci:ci@127.0.0.1:5432/dummy';
process.env.ADMIN_PASSWORD = 'unit-test-shared-password';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { registerAdminRoutes } = await import('../../server/routes/adminRoutes');
  const app = express();
  app.use((req: any, _res, next) => {
    req.session = {};
    req.auth = () => ({ userId: null });
    next();
  });
  registerAdminRoutes(app);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const original = { nodeEnv: process.env.NODE_ENV, allow: process.env.ALLOW_LEGACY_ADMIN_PASSWORD };

afterEach(() => {
  process.env.NODE_ENV = original.nodeEnv;
  if (original.allow === undefined) delete process.env.ALLOW_LEGACY_ADMIN_PASSWORD;
  else process.env.ALLOW_LEGACY_ADMIN_PASSWORD = original.allow;
});

async function statusPayload() {
  const response = await fetch(`${baseUrl}/api/admin-analytics/auth-status`);
  expect(response.status).toBe(200);
  return response.json();
}

describe('the auth-status the admin panel renders from', () => {
  it('tells the panel the password door is shut in production, so no form is drawn', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_LEGACY_ADMIN_PASSWORD;

    await expect(statusPayload()).resolves.toEqual({
      authenticated: false,
      passwordLoginEnabled: false,
    });
  });

  it('offers the form outside production', async () => {
    process.env.NODE_ENV = 'development';

    await expect(statusPayload()).resolves.toEqual({
      authenticated: false,
      passwordLoginEnabled: true,
    });
  });

  it('offers it in production only when the operator re-opened it deliberately', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_LEGACY_ADMIN_PASSWORD = '1';

    await expect(statusPayload()).resolves.toEqual({
      authenticated: false,
      passwordLoginEnabled: true,
    });
  });
});
