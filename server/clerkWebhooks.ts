import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { Webhook } from "svix";

export function registerClerkWebhooks(app: Express) {
  // Clerk webhook endpoint for user profile updates
  app.post('/api/clerk-webhooks', async (req: Request, res: Response) => {
    try {
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('CLERK_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      // Verify webhook signature
      const wh = new Webhook(webhookSecret);
      const payload = wh.verify(JSON.stringify(req.body), {
        'svix-id': req.headers['svix-id'] as string,
        'svix-timestamp': req.headers['svix-timestamp'] as string,
        'svix-signature': req.headers['svix-signature'] as string,
      }) as any;

      const eventType = payload.type;
      const userData = payload.data;

      console.log(`Received Clerk webhook: ${eventType} for user ${userData.id}`);

      // Handle user profile updates
      if (eventType === 'user.updated') {
        await storage.updateUser(userData.id, {
          email: userData.email_addresses?.[0]?.email_address || '',
          firstName: userData.first_name || '',
          lastName: userData.last_name || '',
          profileImageUrl: userData.image_url || null
        });
        
        console.log(`Auto-synced user profile: ${userData.id}`);
      }

      // Handle new user creation
      if (eventType === 'user.created') {
        const existingUser = await storage.getUser(userData.id);
        if (!existingUser) {
          await storage.upsertUser({
            id: userData.id,
            email: userData.email_addresses?.[0]?.email_address || '',
            firstName: userData.first_name || '',
            lastName: userData.last_name || '',
            profileImageUrl: userData.image_url || null,
            plan: 'free'
          });
          
          console.log(`Created new user from webhook: ${userData.id}`);
        }
      }

      res.status(200).json({ received: true });

    } catch (error) {
      console.error('Clerk webhook error:', error);
      res.status(400).json({ error: 'Invalid webhook' });
    }
  });
}