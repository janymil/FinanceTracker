import { Express } from 'express';
import { handleClerkWebhook } from '../clerkWebhooks';

export function registerClerkWebhookRoutes(app: Express): void {
  // Clerk webhook endpoint for user synchronization
  app.post('/api/clerk-webhooks', handleClerkWebhook);
}