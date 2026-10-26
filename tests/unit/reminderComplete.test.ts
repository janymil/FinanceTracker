import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

/**
 * Editing an expense reminder.
 *
 * The dashboard marks a reminder done with `PUT /api/expense-reminders/:id { isCompleted: true }`.
 * The route never put the verified id into the update object, so storage compared `undefined`
 * with the owner and threw — every completion answered 400. It also spread the body, which
 * overwrote `amount` and `categoryId` with null whenever the payload did not mention them.
 */
const getUser = vi.hoisted(() => vi.fn());
const getUserExpenseReminders = vi.hoisted(() => vi.fn());
const updateExpenseReminder = vi.hoisted(() => vi.fn());

vi.mock('../../server/clerkAuth', () => ({
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
  getUserId: () => 'session_user',
}));
vi.mock('../../server/storage', () => ({
  storage: { getUser, getUserExpenseReminders, updateExpenseReminder },
}));
vi.mock('../../server/realtime', () => ({ notifyDataChange: vi.fn() }));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { registerGoalRoutes } = await import('../../server/routes/goalRoutes');
  const app = express();
  app.use(express.json());
  registerGoalRoutes(app as any);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  getUser.mockReset();
  getUserExpenseReminders.mockReset();
  updateExpenseReminder.mockReset();

  getUser.mockResolvedValue({ id: 'session_user', plan: 'premium' });
  getUserExpenseReminders.mockResolvedValue([
    { id: 7, userId: 'session_user', title: 'Rent', amount: '1200.00', categoryId: 3 },
  ]);
  updateExpenseReminder.mockImplementation(async (id: number, data: any) => ({ id, ...data }));
});

async function put(id: number, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/expense-reminders/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: any = await response.json().catch(() => null);
  return { status: response.status, json };
}

describe('PUT /api/expense-reminders/:id', () => {
  it('marks a reminder done and carries the verified owner into the update', async () => {
    const { status } = await put(7, { isCompleted: true });

    expect(status).toBe(200);
    expect(updateExpenseReminder).toHaveBeenCalledTimes(1);
    const [id, payload] = updateExpenseReminder.mock.calls[0] as [number, Record<string, unknown>];
    expect(id).toBe(7);
    expect(payload).toMatchObject({ userId: 'session_user', isCompleted: true });
  });

  it('does not erase fields the payload never mentioned', async () => {
    await put(7, { isCompleted: true });

    const [, payload] = updateExpenseReminder.mock.calls[0] as [number, Record<string, unknown>];
    expect(payload).not.toHaveProperty('amount');
    expect(payload).not.toHaveProperty('categoryId');
    expect(payload).not.toHaveProperty('dueDate');
  });

  it("refuses someone else's reminder", async () => {
    // The real storage call is scoped to the caller, so another person's row is simply absent.
    getUserExpenseReminders.mockResolvedValue([]);

    const { status } = await put(9, { isCompleted: true });

    expect(status).toBe(403);
    expect(updateExpenseReminder).not.toHaveBeenCalled();
  });

  it('rejects a body with nothing editable', async () => {
    const { status } = await put(7, {});

    expect(status).toBe(400);
    expect(updateExpenseReminder).not.toHaveBeenCalled();
  });
});
