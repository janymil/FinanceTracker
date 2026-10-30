import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/** PUT /api/auth/user: the settings a new person sets in their first minutes. */
const storage = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  countUserTransactions: vi.fn(),
}));

vi.mock('../../server/storage', () => ({ storage }));
vi.mock('../../server/clerkAuth', () => ({
  setupClerkAuth: vi.fn(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  getUserId: () => 'user_1',
}));

let server: Server;
let baseUrl: string;

async function put(body: unknown) {
  const response = await fetch(`${baseUrl}/api/auth/user`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

beforeAll(async () => {
  const { registerAuthRoutes } = await import('../../server/routes/authRoutes');
  const app = express();
  app.use(express.json());
  registerAuthRoutes(app);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  storage.getUser.mockResolvedValue({ id: 'user_1', currency: null });
  storage.updateUser.mockImplementation(async (_id: string, data: unknown) => ({ id: 'user_1', ...(data as object) }));
  storage.countUserTransactions.mockResolvedValue(0);
});

describe('time zone', () => {
  it('saves a valid IANA zone', async () => {
    const response = await put({ timezone: 'America/Lima' });
    expect(response.status).toBe(200);
    expect(storage.updateUser).toHaveBeenCalledWith('user_1', { timezone: 'America/Lima' });
  });

  it('refuses names that are not time zones', async () => {
    for (const timezone of ['Mars/Olympus', 'UTC-5', '', 42, null]) {
      expect((await put({ timezone })).status).toBe(400);
    }
    expect(storage.updateUser).not.toHaveBeenCalled();
  });
});

describe('currency', () => {
  it('lets a new person pick their first currency', async () => {
    expect((await put({ currency: 'PEN' })).status).toBe(200);
    expect(storage.updateUser).toHaveBeenCalledWith('user_1', { currency: 'PEN' });
  });

  it('refuses to switch currency once there are transactions', async () => {
    storage.getUser.mockResolvedValue({ id: 'user_1', currency: 'PEN' });
    storage.countUserTransactions.mockResolvedValue(12);
    const response = await put({ currency: 'USD' });
    expect(response.status).toBe(409);
    expect(storage.updateUser).not.toHaveBeenCalled();
  });

  it('allows the same currency again and a change while the account is still empty', async () => {
    storage.getUser.mockResolvedValue({ id: 'user_1', currency: 'PEN' });
    storage.countUserTransactions.mockResolvedValue(12);
    expect((await put({ currency: 'PEN' })).status).toBe(200);
    storage.countUserTransactions.mockResolvedValue(0);
    expect((await put({ currency: 'USD' })).status).toBe(200);
  });

  it('refuses an unsupported currency', async () => {
    expect((await put({ currency: 'XXX' })).status).toBe(400);
  });
});

describe('other settings', () => {
  it('saves the e-mail reminder switch and refuses fields it does not own', async () => {
    expect((await put({ emailNotifications: false })).status).toBe(200);
    expect(storage.updateUser).toHaveBeenCalledWith('user_1', { emailNotifications: false });
    storage.updateUser.mockClear();
    expect((await put({ plan: 'premium' })).status).toBe(400);
    expect(storage.updateUser).not.toHaveBeenCalled();
  });
});

describe('AI consent', () => {
  // The AI question is asked once, at signup. It is only "once" if the answer is recorded, and
  // only an answer if the server says when it was given — a body could carry either a setting
  // with no date (asked again tomorrow) or a date the client invented (no evidence at all).
  it('records the choice and when it was made', async () => {
    expect((await put({ aiEnabled: true })).status).toBe(200);
    const [, data] = storage.updateUser.mock.calls[0];
    expect(data).toMatchObject({ aiEnabled: true });
    expect(data.aiConsentDecidedAt).toBeInstanceOf(Date);
  });

  it('records a refusal too, so the question is not asked again on the next visit', async () => {
    expect((await put({ aiEnabled: false })).status).toBe(200);
    const [, data] = storage.updateUser.mock.calls[0];
    expect(data).toMatchObject({ aiEnabled: false });
    expect(data.aiConsentDecidedAt).toBeInstanceOf(Date);
  });

  it('does not take the timestamp from the request body', async () => {
    expect((await put({ aiConsentDecidedAt: '1999-01-01T00:00:00.000Z' })).status).toBe(400);
    expect(storage.updateUser).not.toHaveBeenCalled();

    await put({ aiEnabled: true, aiConsentDecidedAt: '1999-01-01T00:00:00.000Z' });
    const [, data] = storage.updateUser.mock.calls[0];
    expect((data.aiConsentDecidedAt as Date).getUTCFullYear()).toBeGreaterThan(2020);
  });
});

