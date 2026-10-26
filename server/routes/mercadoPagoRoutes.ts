import { log } from '../logger';
import type { Express, Request, Response } from 'express';
import { isAuthenticated, getUserId } from '../clerkAuth';
import { storage } from '../storage';
import {
  MercadoPagoError,
  cancelPreapproval,
  createPreapproval,
  findPreapprovalForUser,
  getPreapproval,
  isMercadoPagoConfigured,
  listPreapprovalsForUser,
  verifyWebhookSignature,
} from '../mercadopago';
import { regionForRequest } from '../billingRegion';
import type { BillingInterval, PlanId } from '../../shared/pricing';

const PAID_PLANS: PlanId[] = ['standard', 'premium'];
const INTERVALS: BillingInterval[] = ['monthly', 'yearly'];

function baseUrl(req: Request): string {
  const configured = process.env.APP_URL || process.env.UPTIME_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return 'https://kaptia.app';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function activatePlan(userId: string, plan: PlanId, interval: BillingInterval, preapprovalId: string) {
  const current = await storage.getUser(userId);

  // Stripe stays in charge when it is the one paying for a plan. A Peruvian subscription
  // authorised on top of it would be a second charge for the same access, so it is ended
  // here instead of being left to bill quietly.
  if (current?.stripeSubscriptionId && current.plan !== 'free') {
    log.warn(
      `[MercadoPago] ${userId} already pays with Stripe; cancelling preapproval ${preapprovalId}`,
    );
    await cancelQuietly(preapprovalId, 'Stripe is already paying for this plan');
    return;
  }

  await storage.updateUserPlan(userId, plan, interval);
  await storage.updateUser(userId, { mpPreapprovalId: preapprovalId });
  log.info(`[MercadoPago] ${userId} activated ${plan} (${interval}) via preapproval ${preapprovalId}`);

  // Two pending authorisations can both be completed — pressing "subscribe" twice creates
  // two, and both are payable. One subscription per person: end the others.
  await cancelOtherPreapprovals(userId, preapprovalId);
}

/** Ends a preapproval without failing the caller: the caller already has the outcome it needs. */
async function cancelQuietly(preapprovalId: string, reason: string): Promise<void> {
  try {
    await cancelPreapproval(preapprovalId);
    log.info(`[MercadoPago] Cancelled preapproval ${preapprovalId} (${reason})`);
  } catch (error) {
    log.error(`[MercadoPago] Could not cancel preapproval ${preapprovalId} (${reason}):`, messageOf(error));
  }
}

/** Every *other* live-or-pending preapproval for this person, ended. */
async function cancelOtherPreapprovals(userId: string, keepId: string): Promise<void> {
  try {
    const others = await listPreapprovalsForUser(userId);
    for (const other of others) {
      if (other.id === keepId) continue;
      if (other.status !== 'authorized' && other.status !== 'pending') continue;
      await cancelQuietly(other.id, `another subscription of ${userId} is active`);
    }
  } catch (error) {
    // Listing is a safety net, not the activation itself: never fail a paid plan over it.
    log.info('[MercadoPago] Could not list other subscriptions:', messageOf(error));
  }
}

async function deactivatePlan(
  userId: string,
  preapprovalId: string,
  { keepId = false }: { keepId?: boolean } = {},
) {
  const user = await storage.getUser(userId);
  if (!user) return;
  // A replaced (old) preapproval ending must not downgrade someone already on a new one.
  if (user.mpPreapprovalId && user.mpPreapprovalId !== preapprovalId) return;
  // A Stripe subscription, if any, stays in charge.
  if (user.stripeSubscriptionId) return;
  await storage.updateUserPlan(userId, 'free', 'monthly');
  // A paused subscription is still the one that will resume and charge, so its id stays:
  // dropping it would leave the customer unable to cancel from their own profile.
  if (!keepId) {
    await storage.updateUser(userId, { mpPreapprovalId: null });
  }
  log.info(`[MercadoPago] ${userId} downgraded to free (preapproval ${preapprovalId} is no longer active)`);
}


export function registerMercadoPagoRoutes(app: Express) {
  /** Starts a Peruvian subscription. Returns the MercadoPago authorisation URL. */
  app.post('/api/mercadopago/subscribe', isAuthenticated, async (req: any, res: Response) => {
    if (!isMercadoPagoConfigured()) {
      return res.status(503).json({
        error: 'Card payments in Peru are being activated. Please try again later.',
        code: 'mp_not_configured',
      });
    }

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const plan = String(req.body?.plan ?? '').toLowerCase() as PlanId;
    const interval = String(req.body?.interval ?? 'monthly').toLowerCase() as BillingInterval;

    if (!PAID_PLANS.includes(plan) || !INTERVALS.includes(interval)) {
      return res.status(400).json({ error: 'Invalid plan or interval' });
    }

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // One paid subscription at a time: a Stripe subscriber must cancel it first.
    if (user.stripeSubscriptionId && user.plan !== 'free') {
      return res.status(409).json({
        error: 'You already have an active card subscription. Cancel it before switching.',
        code: 'already_subscribed',
      });
    }

    // MercadoPago charges soles, so it is only for Peru. The id is saved before the payer
    // authorises, so only a *paid* plan counts as an existing MercadoPago subscriber who
    // may change plan from anywhere.
    const region = regionForRequest(req);
    const activeMercadoPagoSubscriber = Boolean(user.mpPreapprovalId) && user.plan !== 'free';
    if (!activeMercadoPagoSubscriber && region.gateway !== 'mercadopago') {
      return res.status(403).json({
        error: 'MercadoPago is only available in Peru.',
        code: 'wrong_gateway',
        gateway: region.gateway,
      });
    }
    if (!user.email) {
      return res.status(400).json({ error: 'Add an e-mail address to your account before subscribing' });
    }

    try {
      // A second preapproval must never run next to the first: end the old one first. That
      // includes a *pending* one — the payer could still authorise it from an earlier tab,
      // and two authorised subscriptions mean two charges for one plan.
      if (user.mpPreapprovalId) {
        try {
          await cancelPreapproval(user.mpPreapprovalId);
        } catch (error) {
          // An id MercadoPago no longer knows (already cancelled) is fine; anything else
          // means the old subscription may still charge, so no new one is created.
          const alreadyGone = error instanceof MercadoPagoError && error.status === 404;
          if (!alreadyGone) {
            log.error(`[MercadoPago] Could not cancel ${user.mpPreapprovalId} before replacing it:`, messageOf(error));
            return res.status(502).json({ error: 'MercadoPago is unavailable. Please try again.' });
          }
        }
        // The old plan ends with it; the new plan starts when the new preapproval is
        // authorised. Someone who walks away from the new authorisation is not left on a
        // paid plan that nothing is paying for.
        if (user.plan !== 'free') {
          await deactivatePlan(userId, user.mpPreapprovalId);
        }
      }

      const created = await createPreapproval({
        userId,
        plan,
        interval,
        payerEmail: user.email,
        backUrl: `${baseUrl(req)}/es/profile?mp=return`,
      });

      await storage.updateUser(userId, { mpPreapprovalId: created.id });

      return res.json({ init_point: created.initPoint, preapproval_id: created.id });
    } catch (error: any) {
      log.error('[MercadoPago] Could not create preapproval:', error?.message || error);
      return res.status(502).json({ error: 'MercadoPago is unavailable. Please try again.' });
    }
  });

  /**
   * Fallback for the return trip: the webhook is the primary path, but if it is late the
   * profile page can ask MercadoPago directly.
   */
  app.get('/api/mercadopago/status', isAuthenticated, async (req: any, res: Response) => {
    if (!isMercadoPagoConfigured()) {
      return res.status(503).json({ error: 'MercadoPago is not configured', code: 'mp_not_configured' });
    }

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    try {
      const state = await findPreapprovalForUser(userId);
      if (!state) return res.json({ status: 'none', plan: null });

      if (state.status === 'authorized') {
        await activatePlan(userId, state.plan, state.interval, state.id);
      }

      return res.json({ status: state.status, plan: state.plan, interval: state.interval });
    } catch (error: any) {
      log.error('[MercadoPago] Status lookup failed:', error?.message || error);
      return res.status(502).json({ error: 'MercadoPago is unavailable' });
    }
  });

  /** Cancels the Peruvian subscription (used by the profile page). */
  app.post('/api/mercadopago/cancel', isAuthenticated, async (req: any, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const user = await storage.getUser(userId);
    if (!user?.mpPreapprovalId) {
      return res.status(400).json({ error: 'No MercadoPago subscription found' });
    }

    try {
      await cancelPreapproval(user.mpPreapprovalId);
    } catch (error: any) {
      log.error('[MercadoPago] Cancel failed:', error?.message || error);
      return res.status(502).json({ error: 'MercadoPago is unavailable' });
    }

    await deactivatePlan(userId, user.mpPreapprovalId);
    return res.json({ success: true });
  });

  /**
   * MercadoPago webhook. Always answers 200 once the event is understood: a non-2xx makes
   * MercadoPago retry for hours.
   */
  app.post('/api/mercadopago/webhook', async (req: Request, res: Response) => {
    const dataId = String(
      (req.body?.data?.id as string | undefined) ??
      (req.query['data.id'] as string | undefined) ??
      (req.query.id as string | undefined) ??
      '',
    );
    const type = String(req.body?.type ?? req.query.topic ?? '');

    if (!verifyWebhookSignature({
      signatureHeader: req.headers['x-signature'] as string | undefined,
      requestId: req.headers['x-request-id'] as string | undefined,
      dataId,
      secret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
      now: Date.now(),
    })) {
      log.warn('[MercadoPago] Rejected webhook with an invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (!dataId) return res.status(200).json({ received: true });

    try {
      if (type === 'subscription_preapproval' || type === 'preapproval') {
        const state = await getPreapproval(dataId);

        // Deduplicated on "<id>:<status>:<last-modified>", never on the id alone.
        // MercadoPago sends the same resource id for every state of the same subscription, so
        // a key of just the id would swallow the later "cancelled" notice and leave the
        // customer on a paid plan they no longer pay for. The status alone is not enough
        // either: pausing and then resuming returns to "authorized", and keying on the status
        // would drop the resume — the plan would stay free while the charges resumed.
        const eventKey = `${state.id}:${state.status}:${state.lastModified ?? ''}`;
        const firstDelivery = await storage.claimWebhookEvent({
          source: 'mercadopago',
          key: eventKey,
          type,
        });
        if (!firstDelivery) {
          // Not "duplicate": the claim may belong to a delivery that crashed mid-handling,
          // and answering 2xx would tell MercadoPago to stop retrying — the event would be
          // lost. A retry after the lease expires applies it. Every handler here sets an
          // absolute state, so applying a finished event twice changes nothing.
          log.info(`[MercadoPago] ${eventKey} is claimed elsewhere; asking for a retry`);
          return res.status(500).json({ error: 'Event is being handled', retry: true });
        }

        const userId = state.externalReference;
        try {
          if (userId) {
            if (state.status === 'authorized') {
              await activatePlan(userId, state.plan, state.interval, state.id);
            } else if (state.status === 'cancelled' || state.status === 'paused') {
              // Paused keeps the id: it is the subscription that may still resume and charge.
              await deactivatePlan(userId, state.id, { keepId: state.status === 'paused' });
            }
          }
        } catch (error) {
          // Free the claim, otherwise MercadoPago's retry would be answered as "being
          // handled" and the plan would only come back once the claim's lease expired.
          await storage.releaseWebhookEvent('mercadopago', eventKey).catch(() => undefined);
          throw error;
        }
      }
      // `subscription_authorized_payment` events only confirm a recurring charge; the plan
      // is already active, so nothing needs to change.
    } catch (error: any) {
      // The dashboard's "test notification" button sends a fixed payload with data.id
      // "123456", and a preapproval deleted before its last event can 404 as well. Neither
      // is a server fault: acknowledge with 200 so MercadoPago stops retrying and the URL
      // validates. A real outage (401, 5xx, network) still answers 500 and is retried.
      if (error instanceof MercadoPagoError && error.status === 404) {
        log.info(`[MercadoPago] Ignored notification for unknown preapproval ${dataId}`);
        return res.status(200).json({ received: true, ignored: true });
      }
      log.error('[MercadoPago] Webhook handling failed:', error?.message || error);
      return res.status(500).json({ error: 'Webhook handling failed' });
    }

    return res.status(200).json({ received: true });
  });
}

