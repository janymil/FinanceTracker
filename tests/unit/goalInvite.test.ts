import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { resetRateLimits } from '../../server/middleware/rateLimit';

/**
 * Inviting someone to a shared goal.
 *
 * The invite used to add an existing account to the goal immediately and answer
 * `existingUser: true/false`. That meant a goal gained a member who never agreed, and the
 * inviter could ask the form whether any address belongs to a customer. Now the invite only
 * sends the link; joining is the recipient's decision, and the answer never varies.
 */
const getUserByEmail = vi.hoisted(() => vi.fn());
const joinCollaborativeGoal = vi.hoisted(() => vi.fn());
const getGoalParticipant = vi.hoisted(() => vi.fn());
const sendGoalInvitationEmail = vi.hoisted(() => vi.fn(async (_params: any) => true));

vi.mock('../../server/clerkAuth', () => ({
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
  getUserId: () => 'owner',
}));
vi.mock('../../server/storage', () => ({
  storage: {
    getCollaborativeGoal: vi.fn(async () => ({
      id: 1,
      createdBy: 'owner',
      joinCode: 'code-1',
      name: 'Trip to Cusco',
      description: 'Flights and hotel',
      targetAmount: '1500.00',
      targetDate: new Date('2026-12-01'),
    })),
    getUser: vi.fn(async () => ({ firstName: 'Olga', lastName: 'Owner' })),
    getUserByEmail,
    getGoalParticipant,
    joinCollaborativeGoal,
  },
}));
vi.mock('../../server/emailService', () => ({ sendGoalInvitationEmail }));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { registerCollaborativeGoalRoutes } = await import('../../server/routes/collaborativeGoalRoutes');
  const app = express();
  app.use(express.json());
  registerCollaborativeGoalRoutes(app as any);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  resetRateLimits();
  getUserByEmail.mockReset();
  getGoalParticipant.mockReset();
  joinCollaborativeGoal.mockReset();
  sendGoalInvitationEmail.mockClear();
});

async function invite(email: string) {
  const response = await fetch(`${baseUrl}/api/collaborative-goals/1/invite`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const json: any = await response.json();
  return { status: response.status, json };
}

describe('POST /api/collaborative-goals/:id/invite', () => {
  it('does not add an existing account to the goal without consent', async () => {
    getUserByEmail.mockResolvedValue({ id: 'friend', firstName: 'Fay', lastName: 'Friend' });
    getGoalParticipant.mockResolvedValue(undefined);

    const { status, json } = await invite('friend@example.com');

    expect(status).toBe(200);
    expect(json.emailSent).toBe(true);
    expect(joinCollaborativeGoal).not.toHaveBeenCalled();
    expect(sendGoalInvitationEmail).toHaveBeenCalledTimes(1);
    // The link is what lets them choose to join.
    expect(sendGoalInvitationEmail.mock.calls[0][0].goalUrl).toContain('code=code-1');
  });

  it('answers the same way whether the address has an account or not', async () => {
    getUserByEmail.mockResolvedValue({ id: 'friend', firstName: 'Fay', lastName: 'Friend' });
    getGoalParticipant.mockResolvedValue(undefined);
    const known = await invite('friend@example.com');

    getUserByEmail.mockResolvedValue(undefined);
    const unknown = await invite('stranger@example.com');

    expect(known.json).toEqual(unknown.json);
    expect(known.json).not.toHaveProperty('existingUser');
  });

  it('sends nothing to someone already in the goal, and still answers success', async () => {
    getUserByEmail.mockResolvedValue({ id: 'friend', firstName: 'Fay', lastName: 'Friend' });
    getGoalParticipant.mockResolvedValue({ goalId: 1, userId: 'friend', status: 'active' });

    const { status, json } = await invite('friend@example.com');

    expect(status).toBe(200);
    expect(json).toEqual({ success: true, emailSent: false });
    expect(sendGoalInvitationEmail).not.toHaveBeenCalled();
    expect(joinCollaborativeGoal).not.toHaveBeenCalled();
  });
});
