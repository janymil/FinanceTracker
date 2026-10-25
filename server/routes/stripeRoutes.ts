import { log } from '../logger';
import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { regionForRequest } from "../billingRegion";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

type PlanKey = 'standard' | 'standard-yearly' | 'premium' | 'premium-yearly';
type BillingCurrency = 'usd' | 'pen';

function resolveCurrency(value: unknown): BillingCurrency {
  return String(value ?? '').toLowerCase() === 'pen' ? 'pen' : 'usd';
}

/** Body value wins; otherwise the page language header decides (es -> soles). */
function currencyForRequest(req: Request): BillingCurrency {
  const explicit = (req.body as { currency?: unknown } | undefined)?.currency;
  if (explicit !== undefined) return resolveCurrency(explicit);
  const language = req.header('x-user-language') || '';
  return language.toLowerCase().startsWith('es') ? 'pen' : 'usd';
}

const processedEvents = new Map<string, number>();
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

/** True if this Stripe event id was already handled; otherwise records it. */
function alreadyProcessed(eventId: string): boolean {
  const now = Date.now();
  Array.from(processedEvents.entries()).forEach(([id, at]) => {
    if (now - at > EVENT_TTL_MS) processedEvents.delete(id);
  });
  if (processedEvents.has(eventId)) return true;
  processedEvents.set(eventId, now);
  return false;
}

function forgetEvent(eventId: string): void {
  processedEvents.delete(eventId);
}

/** Customers are only ever sent back to our own site, never to a caller-supplied origin. */
function appBaseUrl(): string {
  return (process.env.APP_URL || process.env.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
}

const VALID_PLANS = new Set(['free', 'standard', 'standard-yearly', 'premium', 'premium-yearly']);

/**
 * Two price lists: US dollars and Peruvian soles. The page language picks the currency
 * (es -> pen, everything else -> usd); the client also sends it explicitly at checkout.
 *
 * Both entries may be a `price_…` id or a `prod_…` id. Products are resolved to their
 * default price through the API (see `resolvePriceId`), so a product reference keeps
 * working, but an explicit price id is preferred: it is the only way to be certain the
 * interval (month vs year) is the one the page promised.
 */
const PRICE_ENV_KEYS: Record<BillingCurrency, Record<PlanKey, string[]>> = {
  usd: {
    'standard': ['STRIPE_STANDARD_MONTHLY_USD_PRICE_ID', 'STRIPE_STANDARD_MONTHLY_PRICE_ID'],
    'standard-yearly': ['STRIPE_STANDARD_YEARLY_USD_PRICE_ID', 'STRIPE_STANDARD_YEARLY_PRICE_ID'],
    'premium': ['STRIPE_PREMIUM_MONTHLY_USD_PRICE_ID', 'STRIPE_PREMIUM_MONTHLY_PRICE_ID'],
    'premium-yearly': ['STRIPE_PREMIUM_YEARLY_USD_PRICE_ID', 'STRIPE_PREMIUM_YEARLY_PRICE_ID'],
  },
  pen: {
    'standard': ['STRIPE_STANDARD_MONTHLY_PEN_PRICE_ID'],
    'standard-yearly': ['STRIPE_STANDARD_YEARLY_PEN_PRICE_ID'],
    'premium': ['STRIPE_PREMIUM_MONTHLY_PEN_PRICE_ID'],
    'premium-yearly': ['STRIPE_PREMIUM_YEARLY_PEN_PRICE_ID'],
  },
};

function readConfiguredReference(plan: PlanKey, currency: BillingCurrency): string | undefined {
  for (const key of PRICE_ENV_KEYS[currency][plan]) {
    const raw = process.env[key];
    if (!raw) continue;
    const value = raw.trim().replace(/^["']|["']$/g, '');
    if (value) return value;
  }
  return undefined;
}

const resolvedPriceCache = new Map<string, string>();

/** Accepts `price_…` as-is; resolves `prod_…` to the product's price id. */
async function resolvePriceId(reference: string | undefined): Promise<string | undefined> {
  if (!reference) return undefined;
  if (reference.startsWith('price_')) return reference;

  if (!reference.startsWith('prod_') || !stripe) {
    console.warn('[Billing] Unsupported price reference in env:', reference);
    return undefined;
  }

  const cached = resolvedPriceCache.get(reference);
  if (cached) return cached;

  try {
    const product = await stripe.products.retrieve(reference, { expand: ['default_price'] });
    const defaultPrice = product.default_price;
    let priceId =
      typeof defaultPrice === 'string'
        ? defaultPrice
        : defaultPrice && typeof defaultPrice === 'object'
          ? defaultPrice.id
          : undefined;

    if (!priceId) {
      const prices = await stripe.prices.list({ product: reference, active: true, limit: 1 });
      priceId = prices.data[0]?.id;
    }

    if (!priceId) {
      console.warn(`[Billing] Product ${reference} has no active price`);
      return undefined;
    }

    resolvedPriceCache.set(reference, priceId);
    return priceId;
  } catch (error) {
    console.warn(
      `[Billing] Could not resolve a price for ${reference}:`,
      error instanceof Error ? error.message : String(error)
    );
    return undefined;
  }
}

const intervalChecked = new Set<string>();

/**
 * Warns when a plan's price has the wrong recurring interval. The account
 * currently has both "Anual" products priced with `interval: month`, which
 * would bill the yearly amount every month. Never blocks checkout.
 */
async function warnIfIntervalMismatch(plan: PlanKey, priceId: string, currency: BillingCurrency): Promise<void> {
  if (!stripe || intervalChecked.has(priceId)) return;
  intervalChecked.add(priceId);

  try {
    const price = await stripe.prices.retrieve(priceId);
    const actual = price.recurring?.interval;
    const expected = plan.endsWith('-yearly') ? 'year' : 'month';
    if (actual && actual !== expected) {
      console.warn(
        `[Billing] ${plan} uses price ${priceId} with interval "${actual}" but "${expected}" is expected. ` +
        `Fix the price interval in Stripe or point ${PRICE_ENV_KEYS[currency][plan][0]} at a price_… id with the right interval.`
      );
    }
  } catch {
    // The interval check is advisory only.
  }
}

async function getPlanPriceId(plan: string, currency: BillingCurrency): Promise<string | undefined> {
  if (!(plan in PRICE_ENV_KEYS[currency])) return undefined;
  const key = plan as PlanKey;
  const priceId = await resolvePriceId(readConfiguredReference(key, currency));
  if (priceId) await warnIfIntervalMismatch(key, priceId, currency);
  return priceId;
}

// Handle subscription changes (upgrade/downgrade) with proper proration
async function handleSubscriptionChange(user: any, newPlan: string, currency: BillingCurrency, res: Response) {
  if (!stripe) {
    return res.status(503).json({ message: "Payment processing unavailable" });
  }

  try {
    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    
    // Resolve the target plan to a Stripe price id (env may hold prod_ or price_)
    const newPriceId = await getPlanPriceId(newPlan, currency);
    if (!newPriceId) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    // Check if user is trying to switch to the same plan
    const currentPriceId = subscription.items.data[0]?.price.id;
    if (currentPriceId === newPriceId) {
      return res.status(400).json({ error: "You are already subscribed to this plan" });
    }

    const baseUrl = appBaseUrl();

    // For subscription modifications, create a checkout session that will update the existing subscription
    // This properly handles proration and billing
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: user.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{
        price: newPriceId,
        quantity: 1,
      }],
      subscription_data: {
        metadata: {
          plan: newPlan,
          userId: user.id,
          isUpgrade: 'true',
          existingSubscriptionId: user.stripeSubscriptionId
        }
      },
      success_url: `${baseUrl}/api/subscription-success?plan=${newPlan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/subscribe`,
      metadata: {
        plan: newPlan,
        userId: user.id,
        isUpgrade: 'true',
        existingSubscriptionId: user.stripeSubscriptionId
      }
    });

    log.info('Subscription modification session created:', session.id);
    return res.json({ url: session.url });

  } catch (error) {
    console.error('Error updating subscription:', error);
    return res.status(500).json({ error: "Failed to update subscription" });
  }
}

export function registerStripeRoutes(app: Express) {
  // Create Stripe Checkout Session
  app.post("/api/create-checkout-session", isAuthenticated, async (req: any, res: Response) => {
    if (!stripe) {
      return res.status(503).json({ message: "Payment processing unavailable. Please contact support." });
    }

    try {
      const { plan } = req.body;
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Stripe is for dollars only. Peru pays in soles through MercadoPago, so a new
      // Stripe checkout from there is refused (existing Stripe subscribers are untouched).
      const region = regionForRequest(req);
      if (user.mpPreapprovalId && user.plan !== 'free' && !user.stripeSubscriptionId) {
        return res.status(409).json({
          error: "You already have an active MercadoPago subscription. Cancel it before switching.",
          code: 'already_subscribed',
        });
      }
      if (!user.stripeSubscriptionId && region.gateway !== 'stripe') {
        return res.status(403).json({
          error: "Payments from your country go through MercadoPago.",
          code: 'wrong_gateway',
          gateway: region.gateway,
        });
      }
      const currency: BillingCurrency = user.stripeSubscriptionId ? currencyForRequest(req) : 'usd';

      log.info('Checkout session request - Plan:', plan, 'Currency:', currency, 'User ID:', userId);

      // Check if user has existing subscription - redirect to Customer Portal
      if (user.stripeSubscriptionId && user.stripeCustomerId && user.plan !== 'free') {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          if (subscription.status === 'active') {
            // Existing paid subscriber - redirect directly to subscription update page
            log.info('Creating portal session with subscription update flow for:', user.stripeSubscriptionId);
            
            const portalSession = await stripe.billingPortal.sessions.create({
              customer: user.stripeCustomerId,
              return_url: `${appBaseUrl()}/dashboard?subscription_update=success`,
              flow_data: {
                type: 'subscription_update',
                subscription_update: {
                  subscription: user.stripeSubscriptionId
                }
              }
            });

            log.info('Portal session created with URL:', portalSession.url);
            log.info('Flow data configured for subscription:', user.stripeSubscriptionId);
            return res.json({ url: portalSession.url });
          }
        } catch (error) {
          console.error('Error checking existing subscription:', error);
          // Continue to checkout if subscription check fails
        }
      }
      
      // Get email from Clerk token
      const auth = req.auth();
      const userEmail = auth?.sessionClaims?.email;
      
      if (!VALID_PLANS.has(String(plan))) {
        return res.status(400).json({ error: "Invalid plan selected" });
      }
      const baseUrl = appBaseUrl();
      const successUrl = `${baseUrl}/api/subscription-success?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/subscribe`;

      // Plan references come from the environment and are resolved to price ids.
      log.info('Plan price references:', {
        currency,
        standard: readConfiguredReference('standard', currency),
        'standard-yearly': readConfiguredReference('standard-yearly', currency),
        premium: readConfiguredReference('premium', currency),
        'premium-yearly': readConfiguredReference('premium-yearly', currency),
      });

      let sessionConfig: any;

      // Configure checkout based on plan type
      if (plan === 'free') {
        // For free plan, just collect customer info and redirect
        sessionConfig = {
          mode: 'setup',
          payment_method_types: ['card'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          setup_intent_data: {
            metadata: { plan: 'free' }
          },
          metadata: {
            plan: plan,
            userId: userId
          }
        };
      } else {
        // For paid plans, create the subscription with the resolved price id.
        const priceId = await getPlanPriceId(plan, currency);
        log.info('Requested plan:', plan, 'Currency:', currency, '-> price:', priceId);

        if (!priceId) {
          console.error('Invalid plan requested:', plan, 'Currency:', currency, 'Configured plans:', Object.keys(PRICE_ENV_KEYS[currency]));
          return res.status(400).json({ error: "Invalid plan selected" });
        }
        
        sessionConfig = {
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{
            price: priceId,
            quantity: 1,
          }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            plan: plan,
            userId: userId,
            currency: currency,
            isUpgrade: user.stripeSubscriptionId ? 'true' : 'false'
          }
        };
        
        // For existing customers, use customer ID; for new customers, use email
        if (user.stripeCustomerId) {
          sessionConfig.customer = user.stripeCustomerId;
        } else {
          sessionConfig.customer_email = userEmail || user.email || undefined;
        }
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);
      
      log.info('Stripe session created successfully');
      log.info('Session ID:', session.id);
      log.info('Session URL:', session.url);
      
      if (!session.url) {
        console.error('No URL returned from Stripe session');
        return res.status(500).json({ error: "No redirect URL received from Stripe" });
      }

      return res.json({ url: session.url });

    } catch (error) {
      console.error('Error creating checkout session:', error);
      return res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Subscription Success Handler
  app.get("/api/subscription-success", async (req: Request, res: Response) => {
    if (!stripe) {
      return res.redirect('/?error=payment_unavailable');
    }

    try {
      const { session_id } = req.query;

      if (!session_id || typeof session_id !== 'string') {
        return res.redirect('/?error=invalid_params');
      }

      // Verify the session with Stripe. The plan comes from the metadata the server
      // wrote when it created the session, never from the query string.
      const session = await stripe.checkout.sessions.retrieve(session_id);
      const plan = session.metadata?.plan;
      if (!plan) {
        return res.redirect('/?error=invalid_params');
      }

      // For free plans, we don't require payment completion
      const planRequiresPayment = plan !== 'free';
      if (planRequiresPayment && session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        return res.redirect('/?error=payment_not_completed');
      }
      
      // For free plans, check setup completion
      if (plan === 'free' && session.mode === 'setup' && session.status !== 'complete') {
        return res.redirect('/?error=setup_not_completed');
      }

      // Map plan names to database values  
      const planMapping = {
        'free': { plan: 'free', interval: 'monthly' },
        'standard': { plan: 'standard', interval: 'monthly' },
        'standard-yearly': { plan: 'standard', interval: 'yearly' },
        'premium': { plan: 'premium', interval: 'monthly' },
        'premium-yearly': { plan: 'premium', interval: 'yearly' }
      };

      const planConfig = planMapping[plan as keyof typeof planMapping];
      if (!planConfig) {
        return res.redirect('/?error=invalid_plan');
      }

      const { plan: dbPlan, interval: billingInterval } = planConfig;

      // Get user ID from session metadata
      const userId = session.metadata?.userId;
      if (!userId || userId === 'anonymous') {
        return res.redirect('/?error=user_not_found');
      }



      // Handle existing subscription if this is an upgrade (the id was written by our
      // own checkout code, and the new subscription is never the one cancelled).
      if (
        session.metadata?.existingSubscriptionId &&
        session.subscription !== session.metadata.existingSubscriptionId
      ) {
        try {
          // Cancel the existing subscription
          await stripe.subscriptions.cancel(session.metadata.existingSubscriptionId);
          log.info(`Cancelled existing subscription: ${session.metadata.existingSubscriptionId}`);
        } catch (cancelError) {
          console.error('Error cancelling existing subscription:', cancelError);
          // Continue with the process even if cancellation fails
        }
      }

      // Update user's plan in database
      try {
        await storage.updateUserPlan(userId, dbPlan as 'free' | 'standard' | 'premium', billingInterval as 'monthly' | 'yearly');
        
        // Store Stripe customer and subscription info if available
        if (session.customer) {
          await storage.updateUserStripeInfo(
            userId, 
            session.customer as string,
            (session.subscription as string) || ''
          );
        }
        
        log.info(`Successfully upgraded user ${userId} to ${dbPlan} plan (${billingInterval})`);
        
        // Redirect to dashboard with success message
        return res.redirect(`/dashboard?upgrade=success&plan=${dbPlan}&interval=${billingInterval}`);
        
      } catch (dbError) {
        console.error('Error updating user plan in database:', dbError);
        return res.redirect('/?error=plan_update_failed');
      }

    } catch (error) {
      console.error('Error processing subscription success:', error);
      return res.redirect('/?error=subscription_processing_failed');
    }
  });

  // Switch subscription plan with upgrade/downgrade logic
  app.post("/api/switch-plan", isAuthenticated, async (req: any, res: Response) => {
    if (!stripe) {
      return res.status(503).json({ success: false, error: "Stripe not configured" });
    }

    try {
      const { newPriceId } = req.body;
      // Always the caller's own subscription, never an id from the request body.
      const ownUser = await storage.getUser(getUserId(req) as string);
      const subscriptionId = ownUser?.stripeSubscriptionId;

      if (!subscriptionId || !newPriceId) {
        return res.status(400).json({ success: false, error: "No active subscription or missing newPriceId" });
      }

      // Plan hierarchy weights, keyed by the price ids actually in use.
      // Both currencies are resolved: a customer may switch language between visits, and
      // an upgrade must still be recognised whichever price list is attached to them.
      const planKeyOrder: PlanKey[] = ['standard', 'standard-yearly', 'premium', 'premium-yearly'];
      const currencies: BillingCurrency[] = ['usd', 'pen'];
      const resolved = await Promise.all(
        currencies.flatMap((currency) =>
          planKeyOrder.map(async (key) => ({ key, priceId: await getPlanPriceId(key, currency) }))
        )
      );
      const priceWeights: Record<string, number> = {};
      resolved.forEach(({ key, priceId }) => {
        if (priceId) priceWeights[priceId] = planKeyOrder.indexOf(key) + 1;
      });

      // Validate price IDs
      if (!priceWeights[newPriceId as keyof typeof priceWeights]) {
        return res.status(400).json({ success: false, error: "Invalid newPriceId" });
      }

      // Fetch current subscription
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const currentPriceId = subscription.items.data[0]?.price.id;

      if (!currentPriceId || !priceWeights[currentPriceId as keyof typeof priceWeights]) {
        return res.status(400).json({ success: false, error: "Invalid current subscription price" });
      }

      const currentWeight = priceWeights[currentPriceId as keyof typeof priceWeights];
      const newWeight = priceWeights[newPriceId as keyof typeof priceWeights];

      if (newWeight > currentWeight) {
        // UPGRADE: Apply immediately with proration
        await stripe.subscriptions.update(subscriptionId, {
          items: [{
            id: subscription.items.data[0].id,
            price: newPriceId,
          }],
          proration_behavior: 'create_prorations',
        });

        log.info(`Subscription ${subscriptionId} upgraded immediately from weight ${currentWeight} to ${newWeight}`);
        return res.json({ success: true, type: "upgrade" });

      } else {
        // DOWNGRADE: Schedule for end of current billing period
        const schedulePhases = [
          {
            items: [{ price: currentPriceId, quantity: 1 }],
            end_date: (subscription as any).current_period_end,
          },
          {
            items: [{ price: newPriceId, quantity: 1 }],
          },
        ];

        await stripe.subscriptionSchedules.create({
          from_subscription: subscriptionId,
          phases: schedulePhases,
        });

        log.info(`Subscription ${subscriptionId} scheduled to downgrade from weight ${currentWeight} to ${newWeight} at period end`);
        return res.json({ success: true, type: "downgrade" });
      }

    } catch (error: any) {
      console.error('Error switching subscription plan:', error);
      return res.status(500).json({ success: false, error: error.message || "Failed to switch plan" });
    }
  });

  // Get subscription schedule information for pending plan changes
  app.get("/api/subscription-schedule", isAuthenticated, async (req: any, res: Response) => {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.stripeSubscriptionId) {
        return res.json({ hasSchedule: false });
      }

      // Check if there's a subscription schedule for this subscription
      const schedules = await stripe.subscriptionSchedules.list({
        limit: 100
      });

      // Filter schedules for this specific subscription
      const userSchedules = schedules.data.filter(schedule => 
        schedule.subscription === user.stripeSubscriptionId
      );

      if (userSchedules.length === 0) {
        return res.json({ hasSchedule: false });
      }

      const schedule = userSchedules[0];
      const currentPhase = schedule.phases[0];
      const nextPhase = schedule.phases[1];

      if (nextPhase) {
        const currentPlanEnd = new Date(currentPhase.end_date * 1000);
        const newPlanStart = new Date(nextPhase.start_date * 1000);
        
        return res.json({
          hasSchedule: true,
          currentPlanEnds: currentPlanEnd.toISOString(),
          newPlanStarts: newPlanStart.toISOString(),
          currentPlan: currentPhase.items[0].price,
          newPlan: nextPhase.items[0].price
        });
      }

      return res.json({ hasSchedule: false });

    } catch (error: any) {
      console.error('Error fetching subscription schedule:', error);
      return res.status(500).json({ error: "Failed to fetch subscription schedule" });
    }
  });

  // Change Subscription Plan
  app.post("/api/change-subscription", isAuthenticated, async (req: any, res: Response) => {
    if (!stripe) {
      return res.status(503).json({ message: "Payment processing unavailable" });
    }

    try {
      const userId = getUserId(req);
      const { plan } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.stripeSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      return await handleSubscriptionChange(user, plan, currencyForRequest(req), res);

    } catch (error) {
      console.error('Error changing subscription:', error);
      return res.status(500).json({ error: "Failed to change subscription" });
    }
  });

  // Cancel Subscription
  app.post("/api/cancel-subscription", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (user?.stripeSubscriptionId && stripe) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch (stripeError) {
          console.error('Error cancelling subscription in Stripe:', stripeError);
          return res.status(502).json({ error: "We could not cancel the subscription. Nothing was changed." });
        }
      }

      // Reset user to free plan
      await storage.updateUserPlan(userId, 'free');

      return res.json({ success: true, message: "Subscription cancelled successfully" });

    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Stripe Webhook Handler
  app.post('/api/stripe-webhook', async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ message: "Payment processing unavailable" });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Stripe] STRIPE_WEBHOOK_SECRET is not set; refusing to process webhooks.');
      return res.status(503).json({ message: "Webhook not configured" });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig || !Buffer.isBuffer(req.body)) {
      return res.status(400).send('Missing signature');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
    } catch (err) {
      console.warn('Stripe webhook signature verification failed:', err instanceof Error ? err.message : err);
      return res.status(400).send('Webhook signature verification failed');
    }

    if (alreadyProcessed(event.id)) {
      return res.json({ received: true, duplicate: true });
    }

    log.info(`Received webhook event: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object);
          break;
        
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object);
          break;
        
        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event.data.object);
          break;
        
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;
        
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
        
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object);
          break;
        
        case 'invoice.payment_action_required':
          await handlePaymentActionRequired(event.data.object);
          break;
        
        default:
          log.info(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      // Not kept as processed and answered with 500, so Stripe retries the event.
      forgetEvent(event.id);
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }

    return res.json({ received: true });
  });

  // Helper function to get user by Stripe customer ID
  async function getUserByStripeCustomerId(customerId: string) {
    try {
      return await storage.getUserByStripeCustomerId(customerId);
    } catch (error) {
      console.error('Error finding user by Stripe customer ID:', error);
      return null;
    }
  }

  // Helper function to map Stripe price ID to plan details
  // Both price lists (usd and pen) are covered. An unknown price returns null so a
  // paying customer is never downgraded because of a price we do not recognise.
  async function mapStripePriceToPlan(priceId: string) {
    const planDetails: Record<PlanKey, { plan: 'standard' | 'premium', interval: 'monthly' | 'yearly' }> = {
      'standard': { plan: 'standard', interval: 'monthly' },
      'standard-yearly': { plan: 'standard', interval: 'yearly' },
      'premium': { plan: 'premium', interval: 'monthly' },
      'premium-yearly': { plan: 'premium', interval: 'yearly' },
    };

    for (const currency of ['usd', 'pen'] as BillingCurrency[]) {
      for (const key of Object.keys(planDetails) as PlanKey[]) {
        if ((await getPlanPriceId(key, currency)) === priceId) return planDetails[key];
      }
    }

    console.warn(`[Billing] Unknown Stripe price ${priceId}; plan left unchanged`);
    return null;
  }

  // Handle initial successful checkout
  async function handleCheckoutSessionCompleted(session: any) {
    log.info('Checkout session completed:', session.id);

    try {
      // Extract plan from metadata
      const plan = session.metadata?.plan;
      const userId = session.metadata?.userId;
      const settled = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';

      if (userId && plan && settled) {
        // Map plan names to database values  
        const planMapping = {
          'free': { plan: 'free', interval: 'monthly' },
          'standard': { plan: 'standard', interval: 'monthly' },
          'standard-yearly': { plan: 'standard', interval: 'yearly' },
          'premium': { plan: 'premium', interval: 'monthly' },
          'premium-yearly': { plan: 'premium', interval: 'yearly' }
        };

        const planConfig = planMapping[plan as keyof typeof planMapping];
        if (planConfig) {
          const { plan: dbPlan, interval: billingInterval } = planConfig;
          await storage.updateUserPlan(userId, dbPlan as 'free' | 'standard' | 'premium', billingInterval as 'monthly' | 'yearly');
          
          // Store Stripe customer info
          if (session.customer) {
            await storage.updateUserStripeInfo(userId, session.customer as string, session.subscription as string);
          }
          
          log.info(`Updated user ${userId} to plan ${dbPlan} (${billingInterval})`);
        }
      }
    } catch (error) {
      console.error('Error processing checkout session completed:', error);
      throw error;
    }
  }

  // Handle recurring payment failures with grace period
  async function handleInvoicePaymentFailed(invoice: any) {
    log.info('Invoice payment failed:', invoice.id, 'for customer:', invoice.customer);

    if (!stripe) {
      console.error('Stripe not initialized');
      return;
    }

    try {
      const user = await getUserByStripeCustomerId(invoice.customer);
      if (!user) {
        log.info('No user found for customer:', invoice.customer);
        return;
      }

      log.info(`Processing payment failure for user: ${user.id}`);

      // Get current failure count and increment
      const currentFailureCount = user.paymentFailureCount || 0;
      const newFailureCount = currentFailureCount + 1;

      // Calculate grace period expiry (7 days from now)
      const graceExpiresAt = new Date();
      graceExpiresAt.setDate(graceExpiresAt.getDate() + 7);

      // Create payment failure record
      await storage.createPaymentFailure({
        userId: user.id,
        stripeInvoiceId: invoice.id,
        stripeCustomerId: invoice.customer,
        failureReason: invoice.last_payment_error?.message || "Payment failed",
        attemptCount: invoice.attempt_count || 1,
        notificationSent: false,
        resolved: false
      });

      // Set user grace period instead of immediate downgrade
      await storage.setUserGracePeriod(user.id, graceExpiresAt, newFailureCount);

      // Send email notification if email service is available
      if (user.email) {
        try {
          const { sendPaymentFailureNotification } = await import('../emailService');
          const notificationSent = await sendPaymentFailureNotification(
            user.email,
            user.firstName || "User",
            invoice.last_payment_error?.message || "Payment method declined",
            graceExpiresAt
          );

          if (notificationSent) {
            log.info(`Payment failure notification sent to: ${user.email}`);
          }
        } catch (emailError) {
          log.info('Email service not available, skipping notification');
        }
      }

      log.info(`User ${user.id} entered grace period until ${graceExpiresAt.toISOString()}`);
      
    } catch (error) {
      console.error('Error handling payment failure:', error);
      throw error;
    }
  }

  // Handle successful recurring payments - clear grace period
  async function handleInvoicePaymentSucceeded(invoice: any) {
    log.info('Invoice payment succeeded:', invoice.id, 'for customer:', invoice.customer);

    if (!stripe) {
      console.error('Stripe not initialized');
      return;
    }

    try {
      const user = await getUserByStripeCustomerId(invoice.customer);
      if (!user) {
        log.info('No user found for customer:', invoice.customer);
        return;
      }

      log.info(`Payment success for user: ${user.id}`);

      // Get subscription details to determine plan
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const priceId = subscription.items.data[0]?.price.id;
      
      if (priceId) {
        const planConfig = await mapStripePriceToPlan(priceId);

        // Ensure user has the correct plan (in case they were downgraded)
        if (planConfig) {
          await storage.updateUserPlan(user.id, planConfig.plan, planConfig.interval);
          log.info(`Confirmed user ${user.id} on ${planConfig.plan} plan (${planConfig.interval})`);
        }
      }

      // Clear grace period and reset failure count
      await storage.clearUserGracePeriod(user.id);

      // Resolve any pending payment failures
      const failures = await storage.getPaymentFailures(user.id);
      for (const failure of failures) {
        if (!failure.resolved) {
          await storage.resolvePaymentFailure(failure.id);
        }
      }

      log.info(`Grace period cleared for user: ${user.id}`);
      
    } catch (error) {
      console.error('Error handling successful payment:', error);
      throw error;
    }
  }

  // Handle subscription status changes
  async function handleSubscriptionUpdated(subscription: any) {
    log.info('Subscription updated:', subscription.id, 'status:', subscription.status);

    try {
      const user = await getUserByStripeCustomerId(subscription.customer);
      if (!user) {
        log.info('No user found for customer:', subscription.customer);
        return;
      }

      // Handle different subscription statuses
      switch (subscription.status) {
        case 'active':
          // Subscription is active, ensure user has correct plan
          const priceId = subscription.items.data[0]?.price.id;
          if (priceId) {
            const planConfig = await mapStripePriceToPlan(priceId);
            if (planConfig) {
              await storage.updateUserPlan(user.id, planConfig.plan, planConfig.interval);
              log.info(`User ${user.id} subscription active: ${planConfig.plan} (${planConfig.interval})`);
            }
          }
          break;
          
        case 'past_due':
          // Payment is overdue, but subscription still exists
          log.info(`User ${user.id} subscription past due, keeping current plan for now`);
          break;
          
        case 'canceled':
        case 'unpaid':
          if (user.stripeSubscriptionId && user.stripeSubscriptionId !== subscription.id) {
            log.info(`Ignoring ${subscription.status} old subscription ${subscription.id} for user ${user.id}`);
            break;
          }
          // Subscription cancelled or unpaid, downgrade to free
          await storage.updateUserPlan(user.id, 'free', 'monthly');
          log.info(`User ${user.id} downgraded to free due to subscription status: ${subscription.status}`);
          break;
          
        default:
          log.info(`Unhandled subscription status: ${subscription.status} for user ${user.id}`);
      }
      
    } catch (error) {
      console.error('Error handling subscription update:', error);
      throw error;
    }
  }

  // Handle subscription deletion (cancellation)
  async function handleSubscriptionDeleted(subscription: any) {
    log.info('Subscription deleted:', subscription.id);

    try {
      const user = await getUserByStripeCustomerId(subscription.customer);
      if (!user) {
        log.info('No user found for customer:', subscription.customer);
        return;
      }

      // An upgrade cancels the old subscription on purpose. Only the subscription we have
      // stored for this person may end their plan.
      if (user.stripeSubscriptionId && user.stripeSubscriptionId !== subscription.id) {
        log.info(`Ignoring deletion of old subscription ${subscription.id} for user ${user.id}`);
        return;
      }

      // Downgrade user to free plan
      await storage.updateUserPlan(user.id, 'free', 'monthly');
      
      // Clear Stripe subscription ID
      await storage.updateUserStripeInfo(user.id, user.stripeCustomerId || '', '');
      
      log.info(`User ${user.id} subscription deleted, downgraded to free plan`);
      
    } catch (error) {
      console.error('Error handling subscription deletion:', error);
      throw error;
    }
  }

  // Handle new subscription creation
  async function handleSubscriptionCreated(subscription: any) {
    log.info('Subscription created:', subscription.id);

    try {
      const user = await getUserByStripeCustomerId(subscription.customer);
      if (!user) {
        log.info('No user found for customer:', subscription.customer);
        return;
      }

      // Get plan details from subscription
      const priceId = subscription.items.data[0]?.price.id;
      if (priceId) {
        const planConfig = await mapStripePriceToPlan(priceId);

        if (planConfig) {
          await storage.updateUserPlan(user.id, planConfig.plan, planConfig.interval);
          await storage.updateUserStripeInfo(user.id, subscription.customer, subscription.id);
          log.info(`User ${user.id} new subscription: ${planConfig.plan} (${planConfig.interval})`);
        }
      }
      
    } catch (error) {
      console.error('Error handling subscription creation:', error);
      throw error;
    }
  }

  // Handle payment requiring user action (3D Secure, etc.)
  async function handlePaymentActionRequired(invoice: any) {
    log.info('Payment action required for invoice:', invoice.id);

    try {
      const user = await getUserByStripeCustomerId(invoice.customer);
      if (!user) {
        log.info('No user found for customer:', invoice.customer);
        return;
      }

      // For now, just log it. In a full implementation, you'd send an email notification
      log.info(`User ${user.id} needs to complete payment action for invoice ${invoice.id}`);
      
    } catch (error) {
      console.error('Error handling payment action required:', error);
    }
  }

  // Stripe Customer Portal
  app.post('/api/create-customer-portal-session', isAuthenticated, async (req: any, res) => {
    if (!stripe) {
      return res.status(503).json({ message: "Payment processing unavailable. Please contact support." });
    }

    try {
      const userId = getUserId(req);
      log.info("Customer portal: User ID from request:", userId);
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      log.info("Customer portal: User found:", user ? "yes" : "no", user ? `plan: ${user.plan}` : "");
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.stripeCustomerId) {
        log.info("Customer portal: No Stripe customer ID found for user");
        return res.status(400).json({ message: "No active subscription found. Please subscribe first." });
      }

      // Construct proper return URL with HTTPS scheme
      const returnUrl = `${appBaseUrl()}/profile`;
      
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });

      return res.json({ url: portalSession.url });
    } catch (error) {
      console.error('Error creating customer portal session:', error);
      return res.status(500).json({ message: "Failed to create portal session" });
    }
  });
}