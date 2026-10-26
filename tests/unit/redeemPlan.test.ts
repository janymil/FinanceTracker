import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Redeeming a code is a gift, never a downgrade. Someone already paying for Premium who
 * redeems one code used to be moved to Standard while still being charged Premium.
 */
const mocks = vi.hoisted(() => ({
  storage: {
    getUserRedeemedCodes: vi.fn(),
    getUser: vi.fn(),
    getRedeemCode: vi.fn(),
    redeemCode: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock('../../server/storage', () => ({ storage: mocks.storage }));
vi.mock('../../server/clerkAuth', () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  getUserId: () => 'user_1',
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { registerRedeemRoutes } = await import('../../server/routes/redeemRoutes');
  const app = express();
  app.use(express.json());
  // The route reads the Clerk session directly for the user id.
  app.use((req: any, _res, next) => {
    req.auth = () => ({ userId: 'user_1' });
    next();
  });
  registerRedeemRoutes(app);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.storage.getUserRedeemedCodes.mockResolvedValue([]);
  mocks.storage.getUser.mockResolvedValue({ id: 'user_1', plan: 'premium' });
  mocks.storage.getRedeemCode.mockImplementation(async (code: string) => ({ code, redeemed: false }));
  mocks.storage.redeemCode.mockImplementation(async (code: string, userId: string) => ({ code, userId }));
  mocks.storage.updateUser.mockResolvedValue({});
});

async function redeem(codes: string[]) {
  const response = await fetch(`${baseUrl}/api/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ codes }),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

describe('POST /api/redeem', () => {
  it('never moves a paying Premium customer down to Standard', async () => {
    const result = await redeem(['ABC123']);

    expect(result.status).toBe(200);
    expect(mocks.storage.updateUser).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({ plan: 'premium' }),
    );
    expect(result.json.plan).toBe('premium');
  });

  it('still raises a free account to Standard', async () => {
    mocks.storage.getUser.mockResolvedValue({ id: 'user_1', plan: 'free' });

    const result = await redeem(['ABC123']);

    expect(result.status).toBe(200);
    expect(mocks.storage.updateUser).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({ plan: 'standard' }),
    );
  });

  it('raises a Standard customer to Premium with a second code', async () => {
    mocks.storage.getUser.mockResolvedValue({ id: 'user_1', plan: 'standard' });

    const result = await redeem(['ABC123', 'DEF456']);

    expect(result.status).toBe(200);
    expect(mocks.storage.updateUser).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({ plan: 'premium' }),
    );
  });
});
