import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { Webhook } from 'svix';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createClerkWebhookHandler } from '../../server/clerkWebhook';

/** Clerk's webhook, signed the way Clerk signs it. Works in any environment once a secret is set. */
const SECRET = 'whsec_' + Buffer.from('unit-test-signing-secret-32-bytes!').toString('base64');

const storage = {
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUserCompletely: vi.fn(),
};

let server: Server;
let baseUrl: string;

function signed(payload: object, { at = new Date(), secret = SECRET, id = 'msg_1' } = {}) {
  const body = JSON.stringify(payload);
  const signature = new Webhook(secret).sign(id, at, body);
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': String(Math.floor(at.getTime() / 1000)),
      'svix-signature': signature,
    },
  };
}

async function post(body: string, headers: Record<string, string>) {
  const response = await fetch(`${baseUrl}/api/clerk-webhooks`, { method: 'POST', headers, body });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

const createdEvent = {
  type: 'user.created',
  data: {
    id: 'user_42',
    email_addresses: [{ id: 'e1', email_address: 'ana@example.com' }],
    primary_email_address_id: 'e1',
    first_name: 'Ana',
    last_name: 'Lima',
    created_at: 1_760_000_000_000,
  },
};

beforeAll(() => {
  const app = express();
  app.use('/api/clerk-webhooks', express.raw({ type: 'application/json' }));
  app.post('/api/clerk-webhooks', createClerkWebhookHandler({ loadStorage: async () => storage as any, verify: defaultVerify }));
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

async function defaultVerify(raw: Buffer | string, headers: Record<string, string>, secret: string) {
  return new Webhook(secret).verify(raw, headers);
}

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLERK_WEBHOOK_SECRET = SECRET;
  storage.getUser.mockResolvedValue(undefined);
  storage.createUser.mockResolvedValue({});
  storage.updateUser.mockResolvedValue({});
});

describe('signature and configuration', () => {
  it('refuses everything when no secret is configured (never trusts an unsigned request)', async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;
    const { body, headers } = signed(createdEvent);
    expect((await post(body, headers)).status).toBe(503);
    expect(storage.createUser).not.toHaveBeenCalled();
  });

  it('refuses a request without svix headers', async () => {
    expect((await post(JSON.stringify(createdEvent), { 'content-type': 'application/json' })).status).toBe(400);
  });

  it('refuses a forged signature', async () => {
    const forged = signed(createdEvent, { secret: 'whsec_' + Buffer.from('some-other-secret-entirely-xxxxxx').toString('base64') });
    expect((await post(forged.body, forged.headers)).status).toBe(400);
    expect(storage.createUser).not.toHaveBeenCalled();
  });

  it('refuses a body that was changed after signing', async () => {
    const { headers } = signed(createdEvent);
    const tampered = JSON.stringify({ ...createdEvent, data: { ...createdEvent.data, id: 'user_evil' } });
    expect((await post(tampered, headers)).status).toBe(400);
  });

  it('refuses a replayed old event', async () => {
    const old = signed(createdEvent, { at: new Date(Date.now() - 60 * 60 * 1000) });
    expect((await post(old.body, old.headers)).status).toBe(400);
  });
});

describe('events', () => {
  it('creates the account for user.created', async () => {
    const { body, headers } = signed(createdEvent);
    const response = await post(body, headers);
    expect(response.status).toBe(200);
    expect(response.json.outcome).toBe('created');
    expect(storage.createUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'user_42', email: 'ana@example.com' }));
  });

  it('is idempotent: Clerk delivering the event twice is fine', async () => {
    storage.getUser.mockResolvedValue({ id: 'user_42' });
    const { body, headers } = signed(createdEvent);
    const response = await post(body, headers);
    expect(response.status).toBe(200);
    expect(response.json.outcome).toBe('already-exists');
    expect(storage.createUser).not.toHaveBeenCalled();
  });

  it('updates only identity fields on user.updated, never the person\'s settings', async () => {
    storage.getUser.mockResolvedValue({
      id: 'user_42', email: 'old@example.com', firstName: 'A', lastName: 'B', currency: 'PEN', timezone: 'America/Lima', plan: 'premium',
    });
    const event = { type: 'user.updated', data: { ...createdEvent.data, first_name: 'Ana María' } };
    const { body, headers } = signed(event);
    expect((await post(body, headers)).status).toBe(200);
    const [, patch] = storage.updateUser.mock.calls[0];
    expect(patch).toMatchObject({ email: 'ana@example.com', firstName: 'Ana María' });
    expect(Object.keys(patch).sort()).toEqual(['email', 'firstName', 'lastName', 'phone', 'profileImageUrl']);
  });

  it('treats an update for an unknown person as the creation it missed', async () => {
    const { body, headers } = signed({ type: 'user.updated', data: createdEvent.data });
    const response = await post(body, headers);
    expect(response.json.outcome).toBe('created');
  });

  it('acknowledges an update whose e-mail belongs to another account instead of failing forever', async () => {
    storage.getUser.mockResolvedValue({ id: 'user_42', email: 'old@example.com' });
    storage.updateUser.mockRejectedValue({ code: '23505' });
    const { body, headers } = signed({ type: 'user.updated', data: createdEvent.data });
    const response = await post(body, headers);
    expect(response.status).toBe(200);
    expect(response.json.outcome).toBe('email-belongs-to-another-account');
  });

  it('deletes everything for user.deleted, and shrugs when there is nothing', async () => {
    storage.getUser.mockResolvedValue({ id: 'user_42' });
    let sent = signed({ type: 'user.deleted', data: { id: 'user_42' } });
    expect((await post(sent.body, sent.headers)).json.outcome).toBe('deleted');
    expect(storage.deleteUserCompletely).toHaveBeenCalledWith('user_42');

    storage.getUser.mockResolvedValue(undefined);
    storage.deleteUserCompletely.mockClear();
    sent = signed({ type: 'user.deleted', data: { id: 'user_42' } }, { id: 'msg_2' });
    expect((await post(sent.body, sent.headers)).json.outcome).toBe('nothing-to-delete');
    expect(storage.deleteUserCompletely).not.toHaveBeenCalled();
  });

  it('answers 200 to event types it does not use, so Clerk does not retry them', async () => {
    const { body, headers } = signed({ type: 'session.created', data: { id: 'sess_1' } });
    const response = await post(body, headers);
    expect(response.status).toBe(200);
    expect(response.json.outcome).toBe('unhandled-type');
  });

  it('answers 500 on a real failure so Clerk retries', async () => {
    storage.createUser.mockRejectedValue(new Error('connection lost'));
    const { body, headers } = signed(createdEvent);
    expect((await post(body, headers)).status).toBe(500);
  });
});
