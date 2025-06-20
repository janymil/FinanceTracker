import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { storage } from './storage';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error('CLERK_WEBHOOK_SECRET is required');
}

interface WebhookEvent {
  type: string;
  data: any;
}

export async function handleClerkWebhook(req: Request, res: Response) {
  // Respond immediately to prevent timeout
  res.status(200).json({ received: true });

  try {
    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('Missing svix headers');
      return;
    }

    const body = JSON.stringify(req.body);
    const wh = new Webhook(webhookSecret);

    let evt: any;

    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return;
    }

    // Process webhook asynchronously
    await processWebhookEvent(evt);

  } catch (error) {
    console.error('Webhook processing error:', error);
  }
}

async function processWebhookEvent(evt: WebhookEvent) {
  const { type, data } = evt;

  try {
    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      default:
        console.log(`Unhandled webhook event type: ${type}`);
    }
  } catch (error) {
    console.error(`Error processing ${type} webhook:`, error);
  }
}

async function handleUserCreated(userData: any) {
  try {
    const userId = userData.id;
    const email = userData.email_addresses?.[0]?.email_address || null;
    const firstName = userData.first_name || null;
    const lastName = userData.last_name || null;
    const profileImageUrl = userData.image_url || null;

    // Check if user already exists
    const existingUser = await storage.getUser(userId);
    if (existingUser) {
      console.log(`User ${userId} already exists, skipping creation`);
      return;
    }

    // Create new user
    await storage.createUser({
      id: userId,
      email,
      firstName,
      lastName,
      profileImageUrl,
      plan: 'free',
      stripeCustomerId: null,
      billingInterval: null
    });

    console.log(`Created user ${userId} via webhook`);
  } catch (error) {
    console.error('Error creating user via webhook:', error);
  }
}

async function handleUserUpdated(userData: any) {
  try {
    const userId = userData.id;
    const email = userData.email_addresses?.[0]?.email_address || null;
    const firstName = userData.first_name || null;
    const lastName = userData.last_name || null;
    const profileImageUrl = userData.image_url || null;

    // Get existing user
    const existingUser = await storage.getUser(userId);
    if (!existingUser) {
      console.log(`User ${userId} not found, creating new user`);
      await handleUserCreated(userData);
      return;
    }

    // Check if any data changed
    const hasChanges = 
      existingUser.email !== email ||
      existingUser.firstName !== firstName ||
      existingUser.lastName !== lastName ||
      existingUser.profileImageUrl !== profileImageUrl;

    if (!hasChanges) {
      console.log(`No changes detected for user ${userId}`);
      return;
    }

    // Update user data
    await storage.updateUser(userId, {
      email,
      firstName,
      lastName,
      profileImageUrl
    });

    console.log(`Updated user ${userId} via webhook`);
  } catch (error) {
    console.error('Error updating user via webhook:', error);
  }
}

async function handleUserDeleted(userData: any) {
  try {
    const userId = userData.id;
    
    // Note: We might want to soft-delete or archive user data instead
    // For now, we'll just log the deletion event
    console.log(`User ${userId} deleted in Clerk - consider data cleanup`);
    
    // Optionally implement user data cleanup here
    // await storage.deleteUser(userId);
  } catch (error) {
    console.error('Error handling user deletion via webhook:', error);
  }
}