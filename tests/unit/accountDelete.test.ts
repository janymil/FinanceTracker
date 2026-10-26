import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Deleting an account must stop the money first. A customer who can no longer sign in cannot
 * cancel a subscription, and once the record is gone nobody can look them up.
 */
const mocks = vi.hoisted(() => ({
  storage: {
    getUser: vi.fn(),
    deleteUserCompletely: vi.fn(),
  },
  cancelBilling: vi.fn(),
  deleteClerkUser: vi.fn(),
}));

vi.mock('../../server/storage', () => ({ storage: mocks.storage }));
// The error reporter imports the real pool; a unit test must not open a connection.
vi.mock('../../server/db', () => ({ db: {}, POOL_SETTINGS: {} }));
vi.mock('../../server/cancelBilling', () => ({ cancelBilling: mocks.cancelBilling }));
vi.mock('@clerk/express', () => ({
  clerkClient: { users: { deleteUser: mocks.deleteClerkUser } },
}));
vi.mock('../../server/clerkAuth', () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  getUserId: () => 'user_1',
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { registerUserRoutes } = await import('../../server/routes/userRoutes');
  const app = express();
  app.use(express.json());
  registerUserRoutes(app);

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
  mocks.storage.getUser.mockResolvedValue({
    id: 'user_1',
    stripeSubscriptionId: 'sub_1',
    mpPreapprovalId: 'pre-1',
  });
  mocks.storage.deleteUserCompletely.mockResolvedValue(undefined);
  mocks.cancelBilling.mockResolvedValue({ ok: true, cancelled: ['stripe', 'mercadopago'], failures: [] });
  mocks.deleteClerkUser.mockResolvedValue(undefined);
});

async function deleteAccount(confirmation = 'DELETE') {
  const response = await fetch(`${baseUrl}/api/account/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirmation }),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

describe('POST /api/account/delete', () => {
  it('stops both billing providers before deleting anything', async () => {
    const result = await deleteAccount();

    expect(result.status).toBe(200);
    expect(mocks.cancelBilling).toHaveBeenCalledWith({
      stripeSubscriptionId: 'sub_1',
      mpPreapprovalId: 'pre-1',
    });
    expect(mocks.cancelBilling.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storage.deleteUserCompletely.mock.invocationCallOrder[0],
    );
    expect(mocks.storage.deleteUserCompletely).toHaveBeenCalledWith('user_1');
  });

  it('refuses to delete when a subscription could not be stopped', async () => {
    mocks.cancelBilling.mockResolvedValueOnce({
      ok: false,
      cancelled: ['stripe'],
      failures: ['mercadopago: unavailable'],
    });

    const result = await deleteAccount();

    expect(result.status).toBe(409);
    expect(mocks.storage.deleteUserCompletely).not.toHaveBeenCalled();
    expect(mocks.deleteClerkUser).not.toHaveBeenCalled();
  });

  it('still requires the typed confirmation', async () => {
    const result = await deleteAccount('yes');

    expect(result.status).toBe(400);
    expect(mocks.cancelBilling).not.toHaveBeenCalled();
  });
});
