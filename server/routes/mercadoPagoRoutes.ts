import type { Express, Request, Response } from 'express';
import { isAuthenticated, getUserId } from '../clerkAuth';
import { storage } from '../storage';
import {
  cancelPreapproval,
  createPreapproval,
  findPreapprovalForUser,
  getPreapproval,
  isMercadoPagoConfigured,
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

async function activatePlan(userId: string, plan: PlanId, interval: BillingInterval, preapprovalId: string) {
  const current = await storage.getUser(userId);
  // Stripe stays in charge when it is the one paying for a plan.
  if (current?.stripeSubscriptionId && current.plan !== 'free') return;
  await storage.updateUserPlan(userId, plan, interval);
  await storage.updateUser(userId, { mpPreapprovalId: preapprovalId });
  console.log(`[MercadoPago] ${userId} activated ${plan} (${interval}) via preapproval ${preapprovalId}`);
}

async function deactivatePlan(userId: string, preapprovalId: string) {
  const user = await storage.getUser(userId);
  if (!user) return;
  // A replaced (old) preapproval ending must not downgrade someone already on a new one.
  if (user.mpPreapprovalId && user.mpPreapprovalId !== preapprovalId) return;
  // A Stripe subscription, if any, stays in charge.
  if (user.stripeSubscriptionId) return;
  await storage.updateUserPlan(userId, 'free', 'monthly');
  await storage.updateUser(userId, { mpPreapprovalId: null });
  console.log(`[MercadoPago] ${userId} downgraded to free (preapproval ${preapprovalId} is no longer active)`);
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
      // A second preapproval must never run next to the first: end the old one first.
      if (user.mpPreapprovalId && user.plan !== 'free') {
        await cancelPreapproval(user.mpPreapprovalId);
        // The old plan ends with it; the new plan starts when the new preapproval is
        // authorised. Someone who walks away from the new authorisation is not left on a
        // paid plan that nothing is paying for.
        await deactivatePlan(userId, user.mpPreapprovalId);
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
      console.error('[MercadoPago] Could not create preapproval:', error?.message || error);
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
      console.error('[MercadoPago] Status lookup failed:', error?.message || error);
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
      console.error('[MercadoPago] Cancel failed:', error?.message || error);
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
      console.warn('[MercadoPago] Rejected webhook with an invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (!dataId) return res.status(200).json({ received: true });

    try {
      if (type === 'subscription_preapproval' || type === 'preapproval') {
        const state = await getPreapproval(dataId);
        const userId = state.externalReference;
        if (userId) {
          if (state.status === 'authorized') {
            await activatePlan(userId, state.plan, state.interval, state.id);
          } else if (state.status === 'cancelled' || state.status === 'paused') {
            await deactivatePlan(userId, state.id);
          }
        }
      }
      // `subscription_authorized_payment` events only confirm a recurring charge; the plan
      // is already active, so nothing needs to change.
    } catch (error: any) {
      console.error('[MercadoPago] Webhook handling failed:', error?.message || error);
      return res.status(500).json({ error: 'Webhook handling failed' });
    }

    return res.status(200).json({ received: true });
  });
}

