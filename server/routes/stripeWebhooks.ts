import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "../storage";
import { sendPaymentFailureNotification } from "../emailService";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Grace period duration in days
const GRACE_PERIOD_DAYS = 7;

export function setupStripeWebhooks(app: Express): void {
  if (!stripe || !webhookSecret) {
    console.warn("Stripe webhook processing disabled - missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return;
  }

  // Stripe webhook endpoint for payment failure handling
  app.post("/webhooks/stripe", async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      console.error("Missing Stripe signature");
      return res.status(400).send("Missing Stripe signature");
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.constructEvent(req.body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`Processing Stripe webhook: ${event.type}`);

    try {
      switch (event.type) {
        case "invoice.payment_failed":
          await handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_succeeded":
          await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case "customer.subscription.created":
          await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case "invoice.payment_action_required":
          await handlePaymentActionRequired(event.data.object as Stripe.Invoice);
          break;

        case "checkout.session.completed":
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error(`Error processing webhook ${event.type}:`, error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });
}

// Handle payment failures with grace period and notifications
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.log(`Payment failed for invoice: ${invoice.id}`);

  const user = await storage.getUserByStripeCustomerId(invoice.customer as string);
  if (!user) {
    console.error(`User not found for Stripe customer: ${invoice.customer}`);
    return;
  }

  console.log(`Processing payment failure for user: ${user.id}`);

  // Get current failure count and increment
  const currentFailureCount = user.paymentFailureCount || 0;
  const newFailureCount = currentFailureCount + 1;

  // Calculate grace period expiry (7 days from now)
  const graceExpiresAt = new Date();
  graceExpiresAt.setDate(graceExpiresAt.getDate() + GRACE_PERIOD_DAYS);

  // Create payment failure record
  await storage.createPaymentFailure({
    userId: user.id,
    stripeInvoiceId: invoice.id,
    stripeCustomerId: invoice.customer as string,
    failureReason: invoice.last_payment_error?.message || "Payment failed",
    attemptCount: invoice.attempt_count || 1,
    notificationSent: false,
    resolved: false
  });

  // Set user grace period
  await storage.setUserGracePeriod(user.id, graceExpiresAt, newFailureCount);

  // Send email notification
  if (user.email) {
    const notificationSent = await sendPaymentFailureNotification(
      user.email,
      user.firstName || "User",
      invoice.last_payment_error?.message || "Payment method declined",
      graceExpiresAt
    );

    if (notificationSent) {
      console.log(`Payment failure notification sent to: ${user.email}`);
    }
  }

  console.log(`User ${user.id} entered grace period until ${graceExpiresAt.toISOString()}`);
}

// Handle successful payments - clear grace period
async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  console.log(`Payment succeeded for invoice: ${invoice.id}`);

  const user = await storage.getUserByStripeCustomerId(invoice.customer as string);
  if (!user) {
    console.error(`User not found for Stripe customer: ${invoice.customer}`);
    return;
  }

  console.log(`Payment success for user: ${user.id}`);

  // Clear grace period and reset failure count
  await storage.clearUserGracePeriod(user.id);

  // Resolve any pending payment failures
  const failures = await storage.getPaymentFailures(user.id);
  for (const failure of failures) {
    if (!failure.resolved) {
      await storage.resolvePaymentFailure(failure.id);
    }
  }

  console.log(`Grace period cleared for user: ${user.id}`);
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  console.log(`Subscription updated: ${subscription.id}`);

  const user = await storage.getUserByStripeCustomerId(subscription.customer as string);
  if (!user) {
    console.error(`User not found for Stripe customer: ${subscription.customer}`);
    return;
  }

  // Update user plan based on subscription status
  let newPlan = "free";
  
  if (subscription.status === "active" || subscription.status === "trialing") {
    // Determine plan from price ID
    const priceId = subscription.items.data[0]?.price.id;
    if (priceId === process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID || 
        priceId === process.env.STRIPE_STANDARD_YEARLY_PRICE_ID) {
      newPlan = "standard";
    } else if (priceId === process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || 
               priceId === process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID) {
      newPlan = "premium";
    }
  }

  await storage.updateUser(user.id, {
    plan: newPlan,
    stripeSubscriptionId: subscription.id
  });

  console.log(`User ${user.id} plan updated to: ${newPlan}`);
}

// Handle subscription deletion - downgrade to free
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  console.log(`Subscription deleted: ${subscription.id}`);

  const user = await storage.getUserByStripeCustomerId(subscription.customer as string);
  if (!user) {
    console.error(`User not found for Stripe customer: ${subscription.customer}`);
    return;
  }

  // Downgrade to free plan
  await storage.updateUser(user.id, {
    plan: "free",
    stripeSubscriptionId: null
  });

  // Clear grace period
  await storage.clearUserGracePeriod(user.id);

  console.log(`User ${user.id} downgraded to free plan (subscription deleted)`);
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  console.log(`Subscription created: ${subscription.id}`);

  const user = await storage.getUserByStripeCustomerId(subscription.customer as string);
  if (!user) {
    console.error(`User not found for Stripe customer: ${subscription.customer}`);
    return;
  }

  // Update subscription ID
  await storage.updateUser(user.id, {
    stripeSubscriptionId: subscription.id
  });

  console.log(`User ${user.id} subscription ID updated: ${subscription.id}`);
}

// Handle payment action required
async function handlePaymentActionRequired(invoice: Stripe.Invoice): Promise<void> {
  console.log(`Payment action required for invoice: ${invoice.id}`);

  const user = await storage.getUserByStripeCustomerId(invoice.customer as string);
  if (!user) {
    console.error(`User not found for Stripe customer: ${invoice.customer}`);
    return;
  }

  // This could trigger additional notifications or UI updates
  console.log(`User ${user.id} requires payment action for invoice: ${invoice.id}`);
}

// Handle successful checkout completion
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  console.log(`Checkout completed: ${session.id}`);

  if (session.customer && session.subscription) {
    const user = await storage.getUserByStripeCustomerId(session.customer as string);
    if (user) {
      await storage.updateUser(user.id, {
        stripeSubscriptionId: session.subscription as string
      });
      console.log(`User ${user.id} checkout completed - subscription: ${session.subscription}`);
    }
  }
}