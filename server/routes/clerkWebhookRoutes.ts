import type { Express, Request, Response } from "express";
import express from "express";
import crypto from "crypto";
import { storage } from "../storage";

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    [key: string]: any;
  };
}

function verifyClerkWebhook(rawBody: string, signature: string, secret: string): boolean {
  try {
    // Create HMAC SHA256 hash using the webhook secret
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    // Clerk sends signature in format: "sha256=<hash>"
    const receivedSignature = signature.replace('sha256=', '');
    
    // Compare signatures using timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return false;
  }
}

async function handleUserCreated(userData: ClerkWebhookEvent['data']): Promise<void> {
  const email = userData.email_addresses?.[0]?.email_address || `${userData.id}@clerk.user`;
  
  try {
    await storage.upsertUser({
      id: userData.id,
      email: email,
      firstName: userData.first_name,
      lastName: userData.last_name,
      profileImageUrl: userData.image_url,
      plan: 'free',
      billingInterval: 'monthly'
    });
    
    console.log(`User created/updated in database: ${userData.id} (${email})`);
  } catch (error) {
    console.error("Error creating/updating user:", error);
    throw error;
  }
}

async function handleUserUpdated(userData: ClerkWebhookEvent['data']): Promise<void> {
  const email = userData.email_addresses?.[0]?.email_address || `${userData.id}@clerk.user`;
  
  try {
    // Check if user exists
    const existingUser = await storage.getUser(userData.id);
    
    if (existingUser) {
      // Update existing user
      await storage.upsertUser({
        id: userData.id,
        email: email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        profileImageUrl: userData.image_url,
        plan: existingUser.plan, // Preserve existing plan
        billingInterval: existingUser.billingInterval // Preserve existing billing interval
      });
      
      console.log(`User updated in database: ${userData.id} (${email})`);
    } else {
      // Create new user if doesn't exist (fallback)
      await handleUserCreated(userData);
    }
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

export function registerClerkWebhookRoutes(app: Express): void {
  // Add specific middleware for webhook to capture raw body
  app.use('/api/clerk-webhooks', express.raw({ type: 'application/json' }));
  
  app.post('/api/clerk-webhooks', async (req: Request, res: Response) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET environment variable is not set");
      return res.status(500).json({ error: "Webhook configuration error" });
    }

    try {
      // Get raw body as string for signature verification
      const rawBody = req.body.toString('utf8');
      
      // Get the signature from headers (Clerk uses 'clerk-signature' header)
      const signature = req.headers['clerk-signature'] as string;
      
      if (!signature) {
        console.error("Missing clerk-signature header");
        return res.status(401).json({ error: "Missing signature header" });
      }
      
      // Verify webhook signature
      const isValid = verifyClerkWebhook(rawBody, signature, webhookSecret);
      
      if (!isValid) {
        console.error("Invalid webhook signature");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
      
      // Parse the JSON after verification
      const event: ClerkWebhookEvent = JSON.parse(rawBody);
      
      console.log(`Received Clerk webhook: ${event.type} for user ${event.data.id}`);
      
      // Extract user data from webhook payload
      const userData = {
        clerk_id: event.data.id,
        first_name: event.data.first_name,
        last_name: event.data.last_name,
        email_address: event.data.email_addresses?.[0]?.email_address,
        image_url: event.data.image_url
      };
      
      console.log('Extracted user data:', userData);
      
      // Handle different event types
      switch (event.type) {
        case 'user.created':
          await handleUserCreated(event.data);
          break;
          
        case 'user.updated':
          await handleUserUpdated(event.data);
          break;
          
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
          break;
      }
      
      // Return success response
      res.status(200).json({ 
        success: true, 
        message: `Webhook ${event.type} processed successfully`,
        user_id: userData.clerk_id
      });
      
    } catch (error) {
      console.error("Webhook processing error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}