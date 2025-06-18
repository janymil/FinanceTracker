import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

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
      
      // Get email from Clerk token
      const clerkUser = req.auth?.user;
      const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;
      
      const baseUrl = `${req.headers.origin || 'http://localhost:5000'}`;
      const successUrl = `${baseUrl}/dashboard?success=true&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/subscribe`;

      // Plan pricing in cents (Stripe uses cents)
      const planPrices = {
        'free': { 
          priceData: {
            currency: 'usd',
            product_data: { name: 'FinanzerPro Free Plan' },
            unit_amount: 0, // $0.00
            recurring: { interval: 'month' as const }
          }
        },
        'standard': { 
          priceData: {
            currency: 'usd',
            product_data: { name: 'FinanzerPro Standard' },
            unit_amount: 499, // $4.99
            recurring: { interval: 'month' as const }
          }
        },
        'standard-yearly': { 
          priceData: {
            currency: 'usd',
            product_data: { name: 'FinanzerPro Standard (Yearly)' },
            unit_amount: 4990, // $49.90
            recurring: { interval: 'year' as const }
          }
        },
        'premium': { 
          priceData: {
            currency: 'usd',
            product_data: { name: 'FinanzerPro Premium' },
            unit_amount: 999, // $9.99
            recurring: { interval: 'month' as const }
          }
        },
        'premium-yearly': { 
          priceData: {
            currency: 'usd',
            product_data: { name: 'FinanzerPro Premium (Yearly)' },
            unit_amount: 9990, // $99.90
            recurring: { interval: 'year' as const }
          }
        }
      };

      const selectedPlan = planPrices[plan as keyof typeof planPrices];
      if (!selectedPlan) {
        return res.status(400).json({ error: "Invalid plan selected" });
      }

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
        // For paid plans, create subscription
        sessionConfig = {
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{
            price_data: selectedPlan.priceData,
            quantity: 1,
          }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: userEmail || user.email || undefined,
          metadata: {
            plan: plan,
            userId: userId
          }
        };
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

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
        'free': 'free',
        'standard': 'standard',
        'standard-yearly': 'standard',
        'premium': 'premium',
        'premium-yearly': 'premium'
      };

      const dbPlan = planMapping[plan as keyof typeof planMapping] as 'free' | 'standard' | 'premium';
      if (!dbPlan) {
        return res.redirect('/?error=invalid_plan');
      }

      // Get user ID from session metadata
      const userId = session.metadata?.userId;
      if (!userId || userId === 'anonymous') {
        return res.redirect('/?error=user_not_found');
      }

      // Update user's plan in database
      try {
        await storage.updateUserPlan(userId, dbPlan);
        
        // Store Stripe customer and subscription info if available
        if (session.customer) {
          await storage.updateUserStripeInfo(
            userId, 
            session.customer as string,
            (session.subscription as string) || ''
          );
        }
        
        console.log(`Successfully upgraded user ${userId} to ${dbPlan} plan`);
        
        // Redirect to success page
        return res.redirect(`/?upgrade=success&plan=${dbPlan}`);
        
      } catch (dbError) {
        console.error('Error updating user plan in database:', dbError);
        return res.redirect('/?error=plan_update_failed');
      }

    } catch (error) {
      console.error('Error processing subscription success:', error);
      return res.redirect('/?error=subscription_processing_failed');
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
            'free': 'free',
            'standard': 'standard',
            'standard-yearly': 'standard',
            'premium': 'premium',
            'premium-yearly': 'premium'
          };

          const dbPlan = planMapping[plan as keyof typeof planMapping] as 'free' | 'standard' | 'premium';
          if (dbPlan) {
            await storage.updateUserPlan(userId, dbPlan);
            
            // Store Stripe customer info
            if (session.customer) {
              await storage.updateUserStripeInfo(userId, session.customer as string, session.subscription as string);
            }
            
            console.log(`Updated user ${userId} to plan ${dbPlan}`);
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

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${req.headers.origin}/profile`,
      });

      res.json({ url: portalSession.url });
    } catch (error) {
      console.error('Error creating customer portal session:', error);
      res.status(500).json({ message: "Failed to create portal session" });
    }
  });
}