import type { Express } from "express";
import type { Server } from "http";
import { createServer } from "http";
import { registerAuthRoutes } from "./authRoutes";
import { registerUserRoutes } from "./userRoutes";
import { registerTransactionRoutes } from "./transactionRoutes";
import { registerBudgetRoutes } from "./budgetRoutes";
import { registerGoalRoutes } from "./goalRoutes";
import { registerCollaborativeGoalRoutes } from "./collaborativeGoalRoutes";
import { registerRealtimeRoutes } from "./realtimeRoutes";
import { registerExportRoutes } from "./exportRoutes";
import { uploadReceiptHandler } from '../uploadReceipt';
import { registerAIRoutes } from "./aiRoutes";
import { registerAdminRoutes } from "./adminRoutes";
import { registerStripeRoutes } from "./stripeRoutes";
import { setCookieConsent } from "../cookieMiddleware";
import { registerMobileUploadRoutes } from "./mobileUploadRoutes";
import { handleContactForm } from "../contact";
import { registerRedeemRoutes } from "./redeemRoutes";
import { registerClerkWebhookRoutes } from "./clerkWebhookRoutes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Cookie consent middleware
  app.post('/api/cookie-consent', setCookieConsent);
  
  // Contact form endpoint
  app.post('/api/contact', handleContactForm);

  // Register all route modules
  registerMobileUploadRoutes(app);
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerTransactionRoutes(app);
  registerBudgetRoutes(app);
  registerGoalRoutes(app);
  registerCollaborativeGoalRoutes(app);
  registerRealtimeRoutes(app);
  registerExportRoutes(app);
  registerStripeRoutes(app);
  registerRedeemRoutes(app);

  // Receipt upload endpoint
  app.post('/api/upload-receipt', uploadReceiptHandler);
  registerAIRoutes(app);
  registerAdminRoutes(app);
  
  // Register Clerk webhooks last to avoid middleware conflicts
  registerClerkWebhookRoutes(app);

  // Production fix: Handle mobile upload client-side routing
  // This ensures mobile-upload/:sessionId routes serve the React app in production
  if (app.get("env") === "production") {
    const path = await import('path');
    app.get('/mobile-upload/:sessionId', (req, res) => {
      const distPath = path.resolve(process.cwd(), "dist/public");
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const server = createServer(app);
  return server;
}