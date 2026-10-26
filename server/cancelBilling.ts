import Stripe from 'stripe';
import { log } from './logger';
import { MercadoPagoError, cancelPreapproval, isMercadoPagoConfigured } from './mercadopago';

/**
 * Stopping the money before the account goes away.
 *
 * Deleting a person's data without this leaves a live charge and no record to find it by:
 * the customer cannot cancel from an account that no longer exists, and support cannot look
 * them up. Every deletion path — the app's own button, the admin screen, and the identity
 * provider's own "delete account" — has to run through here first.
 */

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export interface BillingSubscriptionIds {
  stripeSubscriptionId?: string | null;
  mpPreapprovalId?: string | null;
}

export interface CancelBillingResult {
  ok: boolean;
  /** What was actually stopped, e.g. `['stripe', 'mercadopago']`. */
  cancelled: string[];
  /** One line per subscription that is still billing. */
  failures: string[];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A subscription that no longer exists is already stopped, not a failure. */
function stripeAlreadyGone(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode;
  const code = (error as { code?: string })?.code;
  return status === 404 || code === 'resource_missing';
}

function mercadoPagoAlreadyGone(error: unknown): boolean {
  return error instanceof MercadoPagoError && error.status === 404;
}

export async function cancelBilling(ids: BillingSubscriptionIds): Promise<CancelBillingResult> {
  const cancelled: string[] = [];
  const failures: string[] = [];

  if (ids.stripeSubscriptionId) {
    if (!stripe) {
      failures.push('stripe: not configured');
    } else {
      try {
        await stripe.subscriptions.cancel(ids.stripeSubscriptionId);
        cancelled.push('stripe');
      } catch (error) {
        if (stripeAlreadyGone(error)) {
          // Cancelled earlier (the app's own cancel route leaves the id behind on purpose).
          cancelled.push('stripe');
        } else {
          failures.push(`stripe: ${messageOf(error)}`);
        }
      }
    }
  }

  if (ids.mpPreapprovalId) {
    if (!isMercadoPagoConfigured()) {
      failures.push('mercadopago: not configured');
    } else {
      try {
        await cancelPreapproval(ids.mpPreapprovalId);
        cancelled.push('mercadopago');
      } catch (error) {
        if (mercadoPagoAlreadyGone(error)) {
          cancelled.push('mercadopago');
        } else {
          failures.push(`mercadopago: ${messageOf(error)}`);
        }
      }
    }
  }

  if (failures.length > 0) {
    log.error('[Billing] Could not stop every subscription:', failures.join('; '));
  } else if (cancelled.length > 0) {
    log.info(`[Billing] Stopped ${cancelled.join(' + ')} before deleting the account`);
  }

  return { ok: failures.length === 0, cancelled, failures };
}
