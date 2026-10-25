import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { resetRateLimits } from '../../server/middleware/rateLimit';

/**
 * What the QR upload status route exposes.
 *
 * The phone that takes the photo has no login — the unguessable session id is its
 * credential, and that is deliberate. The page that *reads* the result is the signed-in
 * desktop app, so reading is authenticated and bound to the account that created the
 * session, the one-hour lifetime holds on reads too (an expired receipt must not stay
 * readable until the next session happens to be created), and the body is never cacheable.
 */
vi.mock('../../server/clerkAuth', () => ({
  isAuthenticated: (req: any, res: any, next: () => void) => {
    if (typeof req.headers.authorization === 'string') return next();
    return res.status(401).json({ message: 'Authentication required' });
  },
  getUserId: (req: any) => {
    const header = req.headers.authorization;
    return typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : null;
  },
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { registerMobileUploadRoutes } = await import('../../server/routes/mobileUploadRoutes');
  const app = express();
  app.use(express.json());
  registerMobileUploadRoutes(app);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

async function call(path: string, userId?: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: userId ? { authorization: `Bearer ${userId}` } : {},
  });
}

/** Creates a session the way the desktop modal does: as a signed-in person. */
async function createSession(userId: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/mobile-upload/create-session`, {
    method: 'POST',
    headers: { authorization: `Bearer ${userId}`, 'content-type': 'application/json' },
    body: '{}',
  });
  expect(response.status).toBe(200);
  const { sessionId } = (await response.json()) as { sessionId: string };
  expect(typeof sessionId).toBe('string');
  return sessionId;
}

describe('GET /api/mobile-upload/status/:sessionId', () => {
  it('refuses a caller with no login, even when the session id is correct', async () => {
    const sessionId = await createSession('user_owner');

    const response = await call(`/api/mobile-upload/status/${sessionId}`);

    expect(response.status).toBe(401);
    const body: any = await response.json();
    expect(body.data).toBeUndefined();
  });

  it('answers the account that created the session, and forbids caching it', async () => {
    const sessionId = await createSession('user_owner');

    const response = await call(`/api/mobile-upload/status/${sessionId}`, 'user_owner');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body: any = await response.json();
    expect(body.status).toBe('pending');
  });

  it("hides another account's session behind a 404 without destroying it", async () => {
    const sessionId = await createSession('user_owner');

    expect((await call(`/api/mobile-upload/status/${sessionId}`, 'someone_else')).status).toBe(404);

    // The 404 is not a deletion: the owner still gets their session.
    expect((await call(`/api/mobile-upload/status/${sessionId}`, 'user_owner')).status).toBe(200);
  });

  it('answers 404 for an id that was never issued', async () => {
    expect((await call('/api/mobile-upload/status/00000000-0000-4000-8000-000000000000', 'user_owner')).status).toBe(404);
  });

  it('expires after an hour, even for the owner', async () => {
    const sessionId = await createSession('user_owner');
    const path = `/api/mobile-upload/status/${sessionId}`;

    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000));

      expect((await call(path, 'user_owner')).status).toBe(404);
      // The read that noticed the expiry also removed it.
      expect((await call(path, 'user_owner')).status).toBe(404);
    } finally {
      vi.useRealTimers();
    }
  });
});
