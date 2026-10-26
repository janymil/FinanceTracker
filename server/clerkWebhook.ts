import { log } from './logger';
import type { Request, Response } from 'express';
import { syncCreatedClerkUser } from './clerkUsers';
import { isUniqueViolation } from './dbErrors';
import {
  cancelBilling as cancelBillingForUser,
  type BillingSubscriptionIds,
  type CancelBillingResult,
} from './cancelBilling';

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
  /** Stored objects (receipts, mascots, backups). Optional so a test can stub the row delete. */
  deleteFiles?: (id: string) => Promise<unknown>;
}

export interface WebhookDeps {
  loadStorage: () => Promise<WebhookStorage>;
  /** Verifies the raw body and returns the event, or throws. */
  verify: (rawBody: Buffer | string, headers: Record<string, string>, secret: string) => Promise<any>;
  /**
   * Stops every subscription that bills the person before their account is deleted.
   * Optional so a test can inject a stub and never reach a payment provider.
   */
  cancelBilling?: (ids: BillingSubscriptionIds) => Promise<CancelBillingResult>;
}


const defaultDeps: WebhookDeps = {
  // Explicit methods, not a spread: the storage object is a class instance, so its methods live
  // on the prototype and a spread would hand the webhook an object with none of them.
  loadStorage: async () => {
    const { storage } = await import('./storage');
    const { deleteUserFiles } = await import('./userFiles');
    return {
      getUser: (id: string) => storage.getUser(id),
      createUser: (user: unknown) => storage.createUser(user as never),
      updateUser: (id: string, data: unknown) => storage.updateUser(id, data as never),
      deleteUserCompletely: (id: string) => storage.deleteUserCompletely(id),
      deleteFiles: deleteUserFiles,
    };
  },
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
        log.error('CLERK_WEBHOOK_SECRET is not configured; refusing the Clerk webhook');
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
        log.error('Webhook verification failed:', (error as Error).message);
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
        case 'user.deleted': {
          const existing = await storage.getUser(data.id);
          if (!existing) {
            outcome = 'nothing-to-delete';
            break;
          }
          // Deleting the login is a cancellation, whoever pressed the button: the person
          // cannot sign in afterwards, so a charge left running could never be stopped by
          // them. Stop the money first; if that fails, answer 5xx and let Clerk retry
          // instead of erasing the only record that identifies them.
          const stopBilling = deps.cancelBilling ?? cancelBillingForUser;
          const billing = await stopBilling({
            stripeSubscriptionId: (existing as { stripeSubscriptionId?: string | null }).stripeSubscriptionId,
            mpPreapprovalId: (existing as { mpPreapprovalId?: string | null }).mpPreapprovalId,
          });
          if (!billing.ok) {
            log.error(
              `Clerk user.deleted for ${data.id}: could not stop billing (${billing.failures.join('; ')}); nothing deleted`,
            );
            return reply(500, { error: 'Could not stop the subscription; nothing was deleted' });
          }
          await storage.deleteUserCompletely(data.id);
          // Same reason as the in-app button: the rows are erased here, so this is the last
          // moment anything still knows which photos and backups belonged to this person.
          if (storage.deleteFiles) {
            try {
              await storage.deleteFiles(data.id);
            } catch (error) {
              log.error(`Clerk user.deleted for ${data.id}: stored files could not be removed`, error);
            }
          }
          outcome = 'deleted';
          break;
        }
        default:
          outcome = 'unhandled-type';
      }

      log.info(`Clerk webhook ${type} for ${data.id}: ${outcome}`);
      return reply(200, { received: true, outcome });
    } catch (error) {
      log.error('Clerk webhook error:', error);
      return reply(500, { error: 'Internal server error' });
    }
  };
}

export const clerkWebhookHandler = createClerkWebhookHandler();
