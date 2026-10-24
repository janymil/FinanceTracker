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
