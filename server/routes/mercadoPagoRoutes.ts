import { log } from '../logger';
import type { Express, Request, Response } from 'express';
import { isAuthenticated, getUserId } from '../clerkAuth';
import { storage } from '../storage';
import {
  MercadoPagoError,
  cancelPreapproval,
  createPreapproval,
  findPreapprovalForUser,
  getAuthorizedPayment,
  getPreapproval,
  isMercadoPagoConfigured,
  listPreapprovalsForUser,
  updatePreapprovalAmount,
  verifyWebhookSignature,
} from '../mercadopago';
import {
  PLAN_PRICES,
  changeDirection,
  parsePlanKey,
  planKey,
  planWeight,
  type BillingInterval,
  type PlanChangeDirection,
  type PlanId,
} from '../../shared/pricing';
import { chargeReference, findUserByPreapproval, periodEnd, recordBillingDocument } from '../billingDocuments';


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

/** Soles, in cents: the same number the price page quoted for this plan and interval. */
function amountInCents(plan: PlanId, interval: BillingInterval): number {
  return Math.round(PLAN_PRICES[plan].pen[interval] * 100);
}

function dateFrom(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  await storage.updateUser(userId, {
    mpPreapprovalId: preapprovalId,
    /*
     * The subscription is live again, so the end date of a period that was *cancelled* no
     * longer applies. Leaving it behind meant the grace sweep downgraded a customer who had
     * just re-subscribed, on the old cancellation date.
     */
    paidUntil: null,
    pendingPlan: null,
    pendingInterval: null,
    pendingChangeAt: null,
  } as any);
  log.info(`[MercadoPago] ${userId} activated ${plan} (${interval}) via preapproval ${preapprovalId}`);

  // Two pending authorisations can both be completed — pressing "subscribe" twice creates
  // two, and both are payable. One subscription per person: end the others.
  await cancelOtherPreapprovals(userId, preapprovalId);

  // A paying customer gets a document for their money. Queued, not issued: facturas are made
  // by hand in SUNAT, and this row is the queue. The reference carries the period, so the first
  // payment being reported twice does not become two documents.
  const startedAt = new Date();
  await recordBillingDocument({
    userId,
    plan,
    interval,
    currency: 'pen',
    provider: 'mercadopago',
    providerReference: chargeReference(preapprovalId, startedAt),
    periodStart: startedAt,
  });
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

  /*
   * Days already paid for are not refundable, so they are not withdrawable either.
   *
   * MercadoPago has no "cancel at period end": ending the preapproval is the only way to stop
   * future charges, and it takes effect immediately even though the customer has paid to the end
   * of the month. The cancellation route writes `paidUntil` from the preapproval's next payment
   * date before it cancels, so this path — reached by the `cancelled` notification — keeps the
   * plan and lets the grace processor end it on the right day.
   */
  if (user.paidUntil && user.paidUntil.getTime() > Date.now()) {
    if (!keepId) {
      await storage.updateUser(userId, { mpPreapprovalId: null });
    }
    log.info(
      `[MercadoPago] ${userId} keeps the paid plan until ${user.paidUntil.toISOString()} ` +
        `(preapproval ${preapprovalId} no longer active)`,
    );
    return;
  }

  await storage.updateUserPlan(userId, 'free', 'monthly');
  // A paused subscription is still the one that will resume and charge, so its id stays:
  // dropping it would leave the customer unable to cancel from their own profile.
  if (!keepId) {
    await storage.updateUser(userId, { mpPreapprovalId: null });
  }
  log.info(`[MercadoPago] ${userId} downgraded to free (preapproval ${preapprovalId} is no longer active)`);
}


/**
 * Moves a live Peruvian subscription to another plan **without ending it**.
 *
 * MercadoPago fixes the frequency when the subscription is created, so this only works while the
 * interval stays the same; monthly -> yearly needs a fresh authorisation and is handled by the
 * route below. What this buys:
 *
 *  - an upgrade charges the new amount from the next charge and grants the plan at once. Nobody
 *    is cut off, and nothing is charged twice for days already paid for;
 *  - a downgrade lowers the amount on the subscription immediately (so the next charge really is
 *    the cheaper price) but the plan itself moves on that charge date, not today — taking away
 *    access that has been paid for is not allowed.
 *
 * Returns false when the change cannot be made in place, and the caller falls back to replacing
 * the subscription.
 */
async function changePlanInPlace(
  user: { id: string; plan: string; billingInterval?: string | null; mpPreapprovalId?: string | null },
  plan: PlanId,
  interval: BillingInterval,
  direction: PlanChangeDirection,
): Promise<boolean> {
  const preapprovalId = user.mpPreapprovalId;
  if (!preapprovalId) return false;
  if (direction === 'unknown' || direction === 'same') return false;
  if ((user.billingInterval ?? 'monthly') !== interval) return false;

  await updatePreapprovalAmount(preapprovalId, PLAN_PRICES[plan].pen[interval]);

  if (direction === 'upgrade') {
    await storage.updateUserPlan(user.id, plan, interval);
    await storage.updateUser(user.id, {
      pendingPlan: null,
      pendingInterval: null,
      pendingChangeAt: null,
    } as any);
    log.info(`[MercadoPago] ${user.id} upgraded to ${plan}/${interval} in place (${preapprovalId})`);
    return true;
  }

  // Downgrade: the plan moves on the charge this new amount belongs to.
  let effectiveAt: Date | null = null;
  try {
    effectiveAt = dateFrom((await getPreapproval(preapprovalId)).nextPaymentDate);
  } catch (error) {
    log.warn(
      `[MercadoPago] Could not read the next charge date of ${preapprovalId}:`,
      messageOf(error),
    );
  }

  await storage.updateUser(user.id, {
    pendingPlan: plan,
    pendingInterval: interval,
    pendingChangeAt: effectiveAt ?? periodEnd(new Date(), interval),
  } as any);
  log.info(
    `[MercadoPago] ${user.id} scheduled a downgrade to ${plan}/${interval} for ` +
      `${(effectiveAt ?? periodEnd(new Date(), interval)).toISOString()}`,
  );
  return true;
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

    // MercadoPago is offered in every country now: the account is Peruvian, so it charges
    // soles, and that is exactly what a Peruvian customer abroad needs. The region is no
    // longer read here — Stripe is the restricted side, and it is enforced in its own route.
    if (!user.email) {
      return res.status(400).json({ error: 'Add an e-mail address to your account before subscribing' });
    }


    const targetKey = planKey(plan, interval);
    const direction: PlanChangeDirection = changeDirection(
      { plan: user.plan, billingInterval: user.billingInterval },
      targetKey,
    );

    if (direction === 'same' && user.plan !== 'free') {
      return res.status(409).json({
        error: 'You are already on this plan.',
        code: 'already_subscribed',
        plan,
        interval,
      });
    }

    try {
      /*
       * First: can this be done on the subscription the customer already has?
       *
       * Same interval (standard -> premium, or premium -> standard) is an amount change, so it
       * costs the payer nothing extra to ask, keeps the card and the charge history, and never
       * leaves a window where the account is on no plan at all.
       */
      if (user.mpPreapprovalId && user.plan !== 'free') {
        const changed = await changePlanInPlace(user, plan, interval, direction);
        if (changed) {
          return res.json({
            changed: true,
            plan,
            interval,
            direction,
            message:
              direction === 'upgrade'
                ? 'Your plan has been upgraded. The new price applies from your next charge.'
                : 'Your plan change is scheduled for your next charge date.',
          });
        }
      }

      /*
       * Otherwise the subscription has to be replaced — a different interval, or a first payment.
       *
       * A second preapproval must never run next to the first: end the old one first. That
       * includes a *pending* one — the payer could still authorise it from an earlier tab, and
       * two authorised subscriptions mean two charges for one plan.
       *
       * But ending it must not end the paid period. MercadoPago keeps no record of the days it
       * already charged for, so the next charge date is read *before* the cancellation and kept
       * in `paidUntil`: whoever walks away from the new authorisation keeps what they paid for,
       * and whoever completes it is switched over with no gap.
       */
      let paidUntil: Date | null = null;
      if (user.mpPreapprovalId) {
        if (user.plan !== 'free') {
          try {
            paidUntil = dateFrom((await getPreapproval(user.mpPreapprovalId)).nextPaymentDate);
          } catch (error) {
            log.warn(
              `[MercadoPago] Could not read the paid period of ${user.mpPreapprovalId} before replacing it:`,
              messageOf(error),
            );
          }
        }

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
      }

      const created = await createPreapproval({
        userId,
        plan,
        interval,
        payerEmail: user.email,
        backUrl: `${baseUrl(req)}/es/profile?mp=return`,
      });

      await storage.updateUser(userId, {
        mpPreapprovalId: created.id,
        // Only a paid account has something to protect; a free one has no paid days to keep.
        ...(user.plan !== 'free' && paidUntil ? { paidUntil } : {}),
        pendingPlan: null,
        pendingInterval: null,
        pendingChangeAt: null,
      } as any);

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
      return res.status(400).json({ error: 'No MercadoPago subscription found', code: 'no_mp_subscription' });
    }

    /*
     * How far the money already reaches.
     *
     * Cancelling the preapproval is immediate and irreversible, so the date has to be read
     * *before* it — afterwards MercadoPago stops reporting a next payment, and there would be
     * nothing left to say how many days the customer has paid for. Best effort: if the lookup
     * fails, the previous behaviour (end it now) is what remains, and it is logged.
     */
    let paidUntil: Date | null = null;
    try {
      const state = await getPreapproval(user.mpPreapprovalId);
      if (state.nextPaymentDate) {
        const next = new Date(state.nextPaymentDate);
        if (!Number.isNaN(next.getTime()) && next.getTime() > Date.now()) {
          paidUntil = next;
        }
      }
    } catch (error) {
      log.warn(
        `[MercadoPago] Could not read the paid period of ${user.mpPreapprovalId} before cancelling:`,
        messageOf(error),
      );
    }

    // Written first, so the `cancelled` notification (which may arrive before this request
    // returns) finds it and keeps the plan instead of downgrading immediately.
    if (paidUntil) {
      await storage.updateUser(userId, { paidUntil });
    }

    try {
      await cancelPreapproval(user.mpPreapprovalId);
    } catch (error: any) {
      // Nothing was cancelled, so nothing may change.
      if (paidUntil) {
        await storage.updateUser(userId, { paidUntil: null }).catch(() => undefined);
      }
      log.error('[MercadoPago] Cancel failed:', error?.message || error);
      return res.status(502).json({ error: 'MercadoPago is unavailable' });
    }

    if (paidUntil) {
      log.info(`[MercadoPago] ${userId} cancelled; plan kept until ${paidUntil.toISOString()}`);
      return res.json({
        success: true,
        message: 'Subscription cancelled. You keep access until the end of the period you paid for.',
        accessEndsAt: paidUntil.toISOString(),
      });
    }

    // No date to stand on: end it now, as before.
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
      } else if (type === 'subscription_authorized_payment') {
        /*
         * A recurring charge happened: this is the only notification that carries money.
         *
         * Ignoring it left the app blind between "subscribed" and "cancelled": no record of the
         * renewal, nothing to invoice from, and a downgrade the customer had asked for waiting
         * on a date that nothing was watching. The id in the payload belongs to the *charge*, so
         * the subscription is resolved first, and the account from the subscription.
         */
        const claimKey = `payment:${dataId}`;
        const firstDelivery = await storage.claimWebhookEvent({
          source: 'mercadopago',
          key: claimKey,
          type,
        });
        if (!firstDelivery) {
          log.info(`[MercadoPago] ${claimKey} is claimed elsewhere; asking for a retry`);
          return res.status(500).json({ error: 'Event is being handled', retry: true });
        }

        try {
          const payment = await getAuthorizedPayment(dataId);
          const user = payment.preapprovalId
            ? await findUserByPreapproval(payment.preapprovalId)
            : null;

          if (user) {
            const chargedAt = dateFrom(payment.dateCreated) ?? new Date();
            // The charge that a scheduled downgrade was waiting for has arrived: apply it, so
            // the account matches what was just charged from now on. A change whose date has not
            // come yet stays pending — and the document must name the plan that was actually
            // charged, not the one still waiting.
            const pendingDue = Boolean(
              user.pendingPlan && user.pendingChangeAt && user.pendingChangeAt.getTime() <= chargedAt.getTime(),
            );
            const plan = (pendingDue && user.pendingPlan ? user.pendingPlan : user.plan) as PlanId;
            const interval = (
              pendingDue && user.pendingInterval
                ? user.pendingInterval
                : (user.billingInterval as BillingInterval | null) ?? 'monthly'
            ) as BillingInterval;

            if (pendingDue) {
              await storage.updateUserPlan(user.id, plan, interval);
              await storage.updateUser(user.id, {
                pendingPlan: null,
                pendingInterval: null,
                pendingChangeAt: null,
              } as any);
              log.info(`[MercadoPago] ${user.id} moved to the scheduled ${plan}/${interval} at renewal`);
            }

            await recordBillingDocument({
              userId: user.id,
              plan,
              interval,
              currency: 'pen',
              provider: 'mercadopago',
              providerReference: chargeReference(String(payment.preapprovalId), chargedAt),
              periodStart: chargedAt,
              amountCents: payment.amount !== null ? Math.round(payment.amount * 100) : undefined,
            });
          } else {
            log.info(`[MercadoPago] Charge ${dataId} belongs to no known subscription; ignored`);
          }
        } catch (error) {
          await storage.releaseWebhookEvent('mercadopago', claimKey).catch(() => undefined);
          throw error;
        }
      }
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

