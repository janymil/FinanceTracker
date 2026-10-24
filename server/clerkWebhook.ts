import type { Request, Response } from 'express';
import { syncCreatedClerkUser } from './clerkUsers';

/**
 * Clerk → database sync (user.created / user.updated / user.deleted).
 *
 * It runs in every environment as long as CLERK_WEBHOOK_SECRET is set, so it can be tested with
 * a tunnel or a signed request in development. The signature is always checked; without a secret
 * the endpoint refuses everything rather than trusting an unsigned request.
 */

interface WebhookStorage {
  getUser(id: string): Promise<any>;
  createUser(user: any): Promise<unknown>;
  updateUser(id: string, data: any): Promise<unknown>;
  deleteUserCompletely(id: string): Promise<unknown>;
}

export interface WebhookDeps {
  loadStorage: () => Promise<WebhookStorage>;
  /** Verifies the raw body and returns the event, or throws. */
  verify: (rawBody: Buffer | string, headers: Record<string, string>, secret: string) => Promise<any>;
}

const isUniqueViolation = (error: any) => error?.code === '23505' || /duplicate key/i.test(error?.message ?? '');

const defaultDeps: WebhookDeps = {
  loadStorage: async () => (await import('./storage')).storage as unknown as WebhookStorage,
  verify: async (rawBody, headers, secret) => {
    const { Webhook } = await import('svix');
    return new Webhook(secret).verify(rawBody, headers);
  },
};

function primary<T extends { id: string }>(list: T[] | undefined, id: string | undefined): T | undefined {
  return list?.find((item) => item.id === id);
}

async function applyUserUpdated(data: any, storage: WebhookStorage): Promise<string> {
  const existing = await storage.getUser(data.id);
  if (!existing) {
    // An update for someone we never stored: treat it as the creation we missed.
    return syncCreatedClerkUser(data, storage);
  }

  const email = primary<any>(data.email_addresses, data.primary_email_address_id)?.email_address;
  const phone = primary<any>(data.phone_numbers, data.primary_phone_number_id)?.phone_number;
  // Only identity fields: copying the whole stored row back could overwrite a setting the person
  // changed a moment ago (currency, time zone, e-mail reminders).
  try {
    await storage.updateUser(data.id, {
      email: email || existing.email,
      firstName: data.first_name || existing.firstName,
      lastName: data.last_name || existing.lastName,
      profileImageUrl: data.image_url || existing.profileImageUrl,
      phone: phone || existing.phone,
    });
    return 'updated';
  } catch (error) {
    // The new e-mail already belongs to another account; Clerk retrying will not change that.
    if (isUniqueViolation(error)) return 'email-belongs-to-another-account';
    throw error;
  }
}

export function createClerkWebhookHandler(deps: WebhookDeps = defaultDeps) {
  return async (req: Request, res: Response) => {
    const reply = (status: number, body: object) => res.status(status).json(body);

    try {
      const secret = process.env.CLERK_WEBHOOK_SECRET;
      if (!secret) {
        console.error('CLERK_WEBHOOK_SECRET is not configured; refusing the Clerk webhook');
        return reply(503, { error: 'Webhook secret not configured' });
      }

      const id = req.get('svix-id');
      const timestamp = req.get('svix-timestamp');
      const signature = req.get('svix-signature');
      if (!id || !timestamp || !signature) {
        return reply(400, { error: 'Missing required svix headers' });
      }
      if (!Buffer.isBuffer(req.body) && typeof req.body !== 'string') {
        // The raw-body parser did not run; verifying a re-serialised body would always fail.
        return reply(400, { error: 'Webhook body must be raw' });
      }

      let event: any;
      try {
        event = await deps.verify(req.body, { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signature }, secret);
      } catch (error) {
        console.error('Webhook verification failed:', (error as Error).message);
        return reply(400, { error: 'Webhook verification failed' });
      }

      const { type, data } = event ?? {};
      if (!data?.id) {
        return reply(400, { error: 'Event has no user' });
      }
      const storage = await deps.loadStorage();

      let outcome = 'ignored';
      switch (type) {
        case 'user.created':
          outcome = await syncCreatedClerkUser(data, storage);
          break;
        case 'user.updated':
          outcome = await applyUserUpdated(data, storage);
          break;
        case 'user.deleted':
          if (await storage.getUser(data.id)) {
            await storage.deleteUserCompletely(data.id);
            outcome = 'deleted';
          } else {
            outcome = 'nothing-to-delete';
          }
          break;
        default:
          outcome = 'unhandled-type';
      }

      console.log(`Clerk webhook ${type} for ${data.id}: ${outcome}`);
      return reply(200, { received: true, outcome });
    } catch (error) {
      console.error('Clerk webhook error:', error);
      return reply(500, { error: 'Internal server error' });
    }
  };
}

export const clerkWebhookHandler = createClerkWebhookHandler();
