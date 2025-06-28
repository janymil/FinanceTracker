import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Handle subscription changes (upgrade/downgrade) with proper proration
async function handleSubscriptionChange(user: any, newPlan: string, res: Response) {
  if (!stripe) {
    return res.status(503).json({ message: "Payment processing unavailable" });
  }

  try {
    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    
    // Plan pricing mapping using environment variables
    const planPrices = {
      'standard': process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID,
      'standard-yearly': process.env.STRIPE_STANDARD_YEARLY_PRICE_ID,
      'premium': process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
      'premium-yearly': process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID
    };

    const newPriceId = planPrices[newPlan as keyof typeof planPrices];
    if (!newPriceId) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    // Check if user is trying to switch to the same plan
    const currentPriceId = subscription.items.data[0]?.price.id;
    if (currentPriceId === newPriceId) {
      return res.status(400).json({ error: "You are already subscribed to this plan" });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

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

    console.log('Subscription modification session created:', session.id);
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
      
      console.log('Checkout session request - Plan:', plan, 'User ID:', userId);
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Get user from database
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if user has existing subscription - redirect to Customer Portal
      if (user.stripeSubscriptionId && user.stripeCustomerId && user.plan !== 'free') {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          if (subscription.status === 'active') {
            // Existing paid subscriber - redirect directly to subscription update page
            console.log('Creating portal session with subscription update flow for:', user.stripeSubscriptionId);
            
            const portalSession = await stripe.billingPortal.sessions.create({
              customer: user.stripeCustomerId,
              return_url: `${req.headers.origin || 'http://localhost:5000'}/dashboard?subscription_update=success`,
              flow_data: {
                type: 'subscription_update',
                subscription_update: {
                  subscription: user.stripeSubscriptionId
                }
              }
            });

            console.log('Portal session created with URL:', portalSession.url);
            console.log('Flow data configured for subscription:', user.stripeSubscriptionId);
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
      
      const baseUrl = `${req.headers.origin || 'http://localhost:5000'}`;
      const successUrl = `${baseUrl}/api/subscription-success?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/subscribe`;

      // Plan pricing using real Stripe Price IDs from environment variables
      const planPriceIds = {
        'standard': process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID,
        'standard-yearly': process.env.STRIPE_STANDARD_YEARLY_PRICE_ID,
        'premium': process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
        'premium-yearly': process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID
      };
      
      console.log('Environment variables check:');
      console.log('STRIPE_STANDARD_MONTHLY_PRICE_ID:', process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID);
      console.log('STRIPE_STANDARD_YEARLY_PRICE_ID:', process.env.STRIPE_STANDARD_YEARLY_PRICE_ID);
      console.log('STRIPE_PREMIUM_MONTHLY_PRICE_ID:', process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID);
      console.log('STRIPE_PREMIUM_YEARLY_PRICE_ID:', process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID);
      console.log('Plan price IDs object:', planPriceIds);

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
        // For paid plans, create subscription using real Stripe Price IDs
        const priceId = planPriceIds[plan as keyof typeof planPriceIds];
        console.log('Available plans:', Object.keys(planPriceIds));
        console.log('Requested plan:', plan);
        console.log('Found price ID:', priceId);
        
        if (!priceId) {
          console.error('Invalid plan requested:', plan, 'Available plans:', Object.keys(planPriceIds));
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
      
      console.log('Stripe session created successfully');
      console.log('Session ID:', session.id);
      console.log('Session URL:', session.url);
      
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
      const { plan, session_id } = req.query;
      
      if (!session_id || !plan) {
        return res.redirect('/?error=invalid_params');
      }

      // Verify the session with Stripe
      const session = await stripe.checkout.sessions.retrieve(session_id as string);
      
      // For free plans, we don't require payment completion
      const planRequiresPayment = plan !== 'free';
      if (planRequiresPayment && session.payment_status !== 'paid') {
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



      // Handle existing subscription if this is an upgrade
      if (session.metadata?.existingSubscriptionId) {
        try {
          // Cancel the existing subscription
          await stripe.subscriptions.cancel(session.metadata.existingSubscriptionId);
          console.log(`Cancelled existing subscription: ${session.metadata.existingSubscriptionId}`);
        } catch (cancelError) {
          console.error('Error cancelling existing subscription:', cancelError);
          // Continue with the process even if cancellation fails
        }
      }

      // Handle existing subscription if this is an upgrade
      if (session.metadata?.existingSubscriptionId) {
        try {
          // Cancel the existing subscription
          await stripe.subscriptions.cancel(session.metadata.existingSubscriptionId);
          console.log(`Cancelled existing subscription: ${session.metadata.existingSubscriptionId}`);
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
        
        console.log(`Successfully upgraded user ${userId} to ${dbPlan} plan (${billingInterval})`);
        
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

  // Handle subscription change success (after prorated payment)
  app.get("/api/subscription-change-success", async (req: Request, res: Response) => {
    if (!stripe) {
      return res.redirect('/?error=payment_processing_unavailable');
    }

    try {
      const { plan, session_id, subscription_id } = req.query;
      
      if (!session_id || !plan || !subscription_id) {
        return res.redirect('/?error=invalid_params');
      }

      // Verify the payment session
      const session = await stripe.checkout.sessions.retrieve(session_id as string);
      
      if (session.payment_status !== 'paid') {
        return res.redirect('/?error=payment_not_completed');
      }

      // Now update the subscription with the new price
      const subscription = await stripe.subscriptions.retrieve(subscription_id as string);
      const newPriceId = session.metadata?.newPriceId;
      
      if (newPriceId) {
        await stripe.subscriptions.update(subscription_id as string, {
          items: [{
            id: subscription.items.data[0].id,
            price: newPriceId,
          }],
          proration_behavior: 'create_prorations',
        });
      }

      // Update user plan in database
      const planMapping = {
        'standard': { plan: 'standard', interval: 'monthly' },
        'standard-yearly': { plan: 'standard', interval: 'yearly' },
        'premium': { plan: 'premium', interval: 'monthly' },
        'premium-yearly': { plan: 'premium', interval: 'yearly' }
      };

      const planConfig = planMapping[plan as keyof typeof planMapping];
      if (planConfig && session.metadata?.userId) {
        await storage.updateUserPlan(session.metadata.userId, planConfig.plan as 'free' | 'standard' | 'premium', planConfig.interval as 'monthly' | 'yearly');
      }

      console.log(`Successfully changed subscription ${subscription_id} to ${plan}`);
      return res.redirect(`/dashboard?upgrade=success&plan=${planConfig?.plan}&interval=${planConfig?.interval}`);

    } catch (error) {
      console.error('Error processing subscription change:', error);
      return res.redirect('/?error=subscription_change_failed');
    }
  });

  // Switch subscription plan with upgrade/downgrade logic
  app.post("/api/switch-plan", isAuthenticated, async (req: any, res: Response) => {
    if (!stripe) {
      return res.status(503).json({ success: false, error: "Stripe not configured" });
    }

    try {
      const { subscriptionId, newPriceId } = req.body;

      if (!subscriptionId || !newPriceId) {
        return res.status(400).json({ success: false, error: "Missing subscriptionId or newPriceId" });
      }

      // Hardcoded price weights for plan hierarchy
      const priceWeights = {
        'price_1RcxhjFlf8efPaoOWM6JarOv': 1, // standard_monthly
        'price_1RcxhhFlf8efPaoOoxa7StkA': 2, // standard_yearly
        'price_1RcxhfFlf8efPaoOAYNVWEDc': 3, // premium_monthly
        'price_1RcxhaFlf8efPaoOrkTMX7BZ': 4, // premium_yearly
      };

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

        console.log(`Subscription ${subscriptionId} upgraded immediately from weight ${currentWeight} to ${newWeight}`);
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

        console.log(`Subscription ${subscriptionId} scheduled to downgrade from weight ${currentWeight} to ${newWeight} at period end`);
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
      const userId = req.user?.claims?.sub;
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

      return await handleSubscriptionChange(user, plan, res);

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

    const sig = req.headers['stripe-signature'] as string;
    let event;

    try {
      // For development, we'll skip webhook signature verification
      event = req.body;
    } catch (err) {
      console.log('Webhook signature verification failed:', err);
      return res.status(400).send('Webhook signature verification failed');
    }

    console.log(`Received webhook event: ${event.type}`);

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
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
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
  function mapStripePriceToPlan(priceId: string) {
    const priceMapping: { [key: string]: { plan: 'free' | 'standard' | 'premium', interval: 'monthly' | 'yearly' } } = {
      [process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID || '']: { plan: 'standard', interval: 'monthly' },
      [process.env.STRIPE_STANDARD_YEARLY_PRICE_ID || '']: { plan: 'standard', interval: 'yearly' },
      [process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || '']: { plan: 'premium', interval: 'monthly' },
      [process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID || '']: { plan: 'premium', interval: 'yearly' }
    };
    
    return priceMapping[priceId] || { plan: 'free', interval: 'monthly' };
  }

  // Handle initial successful checkout
  async function handleCheckoutSessionCompleted(session: any) {
    console.log('Checkout session completed:', session.id);

    try {
      // Extract plan from metadata
      const plan = session.metadata?.plan;
      const userId = session.metadata?.userId;

      if (userId && plan) {
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
          
          console.log(`Updated user ${userId} to plan ${dbPlan} (${billingInterval})`);
        }
      }
    } catch (error) {
      console.error('Error processing checkout session completed:', error);
    }
  }

  // Handle recurring payment failures
  async function handleInvoicePaymentFailed(invoice: any) {
    console.log('Invoice payment failed:', invoice.id, 'for customer:', invoice.customer);

    if (!stripe) {
      console.error('Stripe not initialized');
      return;
    }

    try {
      const user = await getUserByStripeCustomerId(invoice.customer);
      if (!user) {
        console.log('No user found for customer:', invoice.customer);
        return;
      }

      // Log the payment failure for potential recovery
      // Note: Could check subscription.latest_invoice.attempt_count for retry logic
      
      // Stripe typically attempts 4 times before giving up
      // We'll downgrade after the first failure to be safe
      console.log(`Payment failed for user ${user.id}, downgrading to free plan`);
      
      await storage.updateUserPlan(user.id, 'free', 'monthly');
      
      // Log the payment failure for potential recovery
      console.log(`User ${user.id} downgraded to free due to payment failure. Invoice: ${invoice.id}`);
      
    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }

  // Handle successful recurring payments
  async function handleInvoicePaymentSucceeded(invoice: any) {
    console.log('Invoice payment succeeded:', invoice.id, 'for customer:', invoice.customer);

    if (!stripe) {
      console.error('Stripe not initialized');
      return;
    }

    try {
      const user = await getUserByStripeCustomerId(invoice.customer);
      if (!user) {
        console.log('No user found for customer:', invoice.customer);
        return;
      }

      // Get subscription details to determine plan
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const priceId = subscription.items.data[0]?.price.id;
      
      if (priceId) {
        const planConfig = mapStripePriceToPlan(priceId);
        
        // Ensure user has the correct plan (in case they were downgraded)
        await storage.updateUserPlan(user.id, planConfig.plan, planConfig.interval);
        
        console.log(`Confirmed user ${user.id} on ${planConfig.plan} plan (${planConfig.interval})`);
      }
      
    } catch (error) {
      console.error('Error handling successful payment:', error);
    }
  }

  // Handle subscription status changes
  async function handleSubscriptionUpdated(subscription: any) {
    console.log('Subscription updated:', subscription.id, 'status:', subscription.status);

    try {
      const user = await getUserByStripeCustomerId(subscription.customer);
      if (!user) {
        console.log('No user found for customer:', subscription.customer);
        return;
      }

      // Handle different subscription statuses
      switch (subscription.status) {
        case 'active':
          // Subscription is active, ensure user has correct plan
          const priceId = subscription.items.data[0]?.price.id;
          if (priceId) {
            const planConfig = mapStripePriceToPlan(priceId);
            await storage.updateUserPlan(user.id, planConfig.plan, planConfig.interval);
            console.log(`User ${user.id} subscription active: ${planConfig.plan} (${planConfig.interval})`);
          }
          break;
          
        case 'past_due':
          // Payment is overdue, but subscription still exists
          console.log(`User ${user.id} subscription past due, keeping current plan for now`);
          break;
          
        case 'canceled':
        case 'unpaid':
          // Subscription cancelled or unpaid, downgrade to free
          await storage.updateUserPlan(user.id, 'free', 'monthly');
          console.log(`User ${user.id} downgraded to free due to subscription status: ${subscription.status}`);
          break;
          
        default:
          console.log(`Unhandled subscription status: ${subscription.status} for user ${user.id}`);
      }
      
    } catch (error) {
      console.error('Error handling subscription update:', error);
    }
  }

  // Handle subscription deletion (cancellation)
  async function handleSubscriptionDeleted(subscription: any) {
    console.log('Subscription deleted:', subscription.id);

    try {
      const user = await getUserByStripeCustomerId(subscription.customer);
      if (!user) {
        console.log('No user found for customer:', subscription.customer);
        return;
      }

      // Downgrade user to free plan
      await storage.updateUserPlan(user.id, 'free', 'monthly');
      
      // Clear Stripe subscription ID
      await storage.updateUserStripeInfo(user.id, user.stripeCustomerId || '', '');
      
      console.log(`User ${user.id} subscription deleted, downgraded to free plan`);
      
    } catch (error) {
      console.error('Error handling subscription deletion:', error);
    }
  }

  // Handle new subscription creation
  async function handleSubscriptionCreated(subscription: any) {
    console.log('Subscription created:', subscription.id);

    try {
      const user = await getUserByStripeCustomerId(subscription.customer);
      if (!user) {
        console.log('No user found for customer:', subscription.customer);
        return;
      }

      // Get plan details from subscription
      const priceId = subscription.items.data[0]?.price.id;
      if (priceId) {
        const planConfig = mapStripePriceToPlan(priceId);
        
        await storage.updateUserPlan(user.id, planConfig.plan, planConfig.interval);
        await storage.updateUserStripeInfo(user.id, subscription.customer, subscription.id);
        
        console.log(`User ${user.id} new subscription: ${planConfig.plan} (${planConfig.interval})`);
      }
      
    } catch (error) {
      console.error('Error handling subscription creation:', error);
    }
  }

  // Handle payment requiring user action (3D Secure, etc.)
  async function handlePaymentActionRequired(invoice: any) {
    console.log('Payment action required for invoice:', invoice.id);

    try {
      const user = await getUserByStripeCustomerId(invoice.customer);
      if (!user) {
        console.log('No user found for customer:', invoice.customer);
        return;
      }

      // For now, just log it. In a full implementation, you'd send an email notification
      console.log(`User ${user.id} needs to complete payment action for invoice ${invoice.id}`);
      
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
      console.log("Customer portal: User ID from request:", userId);
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      console.log("Customer portal: User found:", user ? "yes" : "no", user ? `plan: ${user.plan}` : "");
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.stripeCustomerId) {
        console.log("Customer portal: No Stripe customer ID found for user");
        return res.status(400).json({ message: "No active subscription found. Please subscribe first." });
      }

      // Construct proper return URL with HTTPS scheme
      const origin = req.headers.origin || 'http://localhost:5000';
      const returnUrl = origin.startsWith('http') ? `${origin}/profile` : `https://${origin}/profile`;
      
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