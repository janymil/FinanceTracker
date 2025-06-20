import type { Express } from "express";
import { Webhook } from "svix";
import { storage } from "../storage";

export function registerClerkWebhookRoutes(app: Express) {
  // Test endpoint to verify webhook functionality in development
  app.post('/api/test-webhook', async (req, res) => {
    try {
      console.log('Test webhook received:', JSON.stringify(req.body, null, 2));
      
      // Simulate processing a user.created event
      const testUserData = {
        id: 'test_webhook_user_' + Date.now(),
        email_addresses: [{ email_address: 'webhook-test@example.com' }],
        first_name: 'Webhook',
        last_name: 'Test',
        created_at: Date.now()
      };
      
      await storage.createUser({
        id: testUserData.id,
        email: testUserData.email_addresses[0].email_address,
        firstName: testUserData.first_name || null,
        lastName: testUserData.last_name || null,
        plan: 'free'
      });
      
      console.log('Test webhook user created successfully:', testUserData.id);
      res.json({ success: true, message: 'Test webhook processed', userId: testUserData.id });
      return;
    } catch (error) {
      console.error('Test webhook error:', error);
      res.status(500).json({ error: 'Test webhook failed', details: error.message });
      return;
    }
  });

  // Clerk webhook endpoint for production user synchronization
  app.post('/api/clerk-webhooks', async (req, res) => {
    try {
      // Only allow webhooks in production environment
      if (process.env.NODE_ENV !== 'production') {
        res.status(403).send('Webhook disabled in dev');
        return;
      }
      
      // Get the webhook signing secret from environment
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error('CLERK_WEBHOOK_SECRET is not configured');
        res.status(500).json({ error: 'Webhook secret not configured' });
        return;
      }

      // Get headers and body for verification
      const svix_id = req.get('svix-id');
      const svix_timestamp = req.get('svix-timestamp');
      const svix_signature = req.get('svix-signature');

      if (!svix_id || !svix_timestamp || !svix_signature) {
        res.status(400).json({ error: 'Missing required svix headers' });
        return;
      }

      // Create webhook instance for verification
      const wh = new Webhook(webhookSecret);
      let evt;

      try {
        // Verify the webhook payload
        evt = wh.verify(JSON.stringify(req.body), {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature,
        });
      } catch (err) {
        console.error('Webhook verification failed:', err);
        res.status(400).json({ error: 'Webhook verification failed' });
        return;
      }

      // Handle different event types
      const { type, data } = evt as any;
      
      console.log(`Clerk webhook received: ${type} for user ${data.id}`);

      switch (type) {
        case 'user.created':
          await handleUserCreated(data);
          break;
          
        case 'user.updated':
          await handleUserUpdated(data);
          break;
          
        case 'user.deleted':
          console.log('Processing user.deleted webhook for user:', data.id);
          await handleUserDeleted(data);
          break;
          
        case 'email.created':
          console.log('Email created event received:', data);
          break;
          
        case 'sms.created':
          console.log('SMS created event received:', data);
          break;
          
        default:
          console.log(`Unhandled webhook event type: ${type}`);
      }

      res.status(200).json({ received: true });
      
    } catch (error) {
      console.error('Clerk webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

// Handle user creation from Clerk
async function handleUserCreated(userData: any) {
  try {
    const { id, email_addresses, first_name, last_name, image_url, phone_numbers, created_at } = userData;
    
    // Get primary email
    const primaryEmail = email_addresses?.find((email: any) => email.id === userData.primary_email_address_id)?.email_address;
    
    // Get primary phone
    const primaryPhone = phone_numbers?.find((phone: any) => phone.id === userData.primary_phone_number_id)?.phone_number;

    // Create user in our database
    const newUser = {
      id: id, // Clerk user ID
      email: primaryEmail || null,
      firstName: first_name || null,
      lastName: last_name || null,
      profileImageUrl: image_url || null,
      phone: primaryPhone || null,
      plan: 'free', // Default to free plan
      settings: null,
      createdAt: new Date(created_at),
      updatedAt: new Date()
    };

    await storage.createUser(newUser);
    console.log(`User created in database: ${id} (${primaryEmail})`);
    
  } catch (error) {
    console.error('Error creating user from webhook:', error);
    throw error;
  }
}

// Handle user updates from Clerk
async function handleUserUpdated(userData: any) {
  try {
    const { id, email_addresses, first_name, last_name, image_url, phone_numbers, updated_at } = userData;
    
    // Check if user exists in our database
    const existingUser = await storage.getUser(id);
    if (!existingUser) {
      console.log(`User ${id} not found in database, creating from update event`);
      return await handleUserCreated(userData);
    }
    
    // Get primary email
    const primaryEmail = email_addresses?.find((email: any) => email.id === userData.primary_email_address_id)?.email_address;
    
    // Get primary phone
    const primaryPhone = phone_numbers?.find((phone: any) => phone.id === userData.primary_phone_number_id)?.phone_number;

    // Update user data
    const updatedUser = {
      ...existingUser,
      email: primaryEmail || existingUser.email,
      firstName: first_name || existingUser.firstName,
      lastName: last_name || existingUser.lastName,
      profileImageUrl: image_url || existingUser.profileImageUrl,
      phone: primaryPhone || existingUser.phone,
      updatedAt: new Date(updated_at || Date.now())
    };

    await storage.updateUser(id, updatedUser);
    console.log(`User updated in database: ${id} (${primaryEmail})`);
    
  } catch (error) {
    console.error('Error updating user from webhook:', error);
    throw error;
  }
}

// Handle user deletion from Clerk
async function handleUserDeleted(userData: any) {
  try {
    // Clerk sends object ID in deletion webhook, but we need user ID
    // Try both formats to handle the mismatch
    const objectId = userData.id;
    const userId = userData.object === 'user' ? userData.id : null;
    
    console.log(`Attempting to delete user. Object ID: ${objectId}, User ID: ${userId}`);
    
    // First try with the provided ID
    let existingUser = await storage.getUser(objectId);
    let userIdToDelete = objectId;
    
    // If not found, try to find user by email or other identifier
    if (!existingUser && userData.email_addresses?.length > 0) {
      const email = userData.email_addresses[0]?.email_address;
      if (email) {
        // Search for user by email since ID formats might not match
        const allUsers = await storage.getAllUsers();
        existingUser = allUsers.find(u => u.email === email);
        if (existingUser) {
          userIdToDelete = existingUser.id;
          console.log(`Found user by email ${email}: ${userIdToDelete}`);
        }
      }
    }
    
    if (!existingUser) {
      console.log(`User with object ID ${objectId} not found in database, nothing to delete`);
      return;
    }

    // Delete user data completely for GDPR compliance
    await storage.deleteUserCompletely(userIdToDelete);
    console.log(`User deleted from database: ${userIdToDelete}`);
    
  } catch (error) {
    console.error('Error deleting user from webhook:', error);
    throw error;
  }
}