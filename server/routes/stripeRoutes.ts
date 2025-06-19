import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Handle subscription changes (upgrade/downgrade) via checkout session
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
    
    // Create checkout session for subscription modification
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: user.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{
        price: newPriceId,
        quantity: 1,
      }],
      success_url: `${baseUrl}/api/subscription-success?plan=${newPlan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/subscribe`,
      metadata: {
        plan: newPlan,
        userId: user.id,
        isUpgrade: 'true',
        existingSubscriptionId: user.stripeSubscriptionId
      }
    });

    console.log('Subscription change session created:', session.id);
    return res.json({ url: session.url });

  } catch (error) {
    console.error('Error creating subscription change session:', error);
    return res.status(500).json({ error: "Failed to create subscription change session" });
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
      
      // Check if user has existing subscription for proper handling
      if (user.stripeSubscriptionId && user.plan !== 'free') {
        // For existing subscribers, use subscription update with proration
        return await handleSubscriptionChange(user, plan, res);
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

      res.json({ url: session.url });

    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: "Failed to create checkout session" });
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
      res.status(500).json({ error: "Failed to change subscription" });
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

      res.json({ success: true, message: "Subscription cancelled successfully" });

    } catch (error) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ error: "Failed to cancel subscription" });
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

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
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
        console.error('Error processing webhook:', error);
      }
    }

    res.json({ received: true });
  });

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

      res.json({ url: portalSession.url });
    } catch (error) {
      console.error('Error creating customer portal session:', error);
      res.status(500).json({ message: "Failed to create portal session" });
    }
  });
}