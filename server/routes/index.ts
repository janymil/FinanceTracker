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
import { reportHttpServerError } from "../errorGuard/report.js";
import { registerErrorGuardRoutes } from "../errorGuard/routes.js";
import { normalizeRoute } from "@shared/errorGuard/fingerprint";
import { registerStripeRoutes } from "./stripeRoutes";
import { setCookieConsent } from "../cookieMiddleware";
import { registerMobileUploadRoutes } from "./mobileUploadRoutes";
import { registerImportRoutes } from "./importRoutes";
import { handleContactForm } from "../contact";
import { registerRedeemRoutes } from "./redeemRoutes";
import { registerClerkWebhookRoutes } from "./clerkWebhooks.js";
import { registerPDFRoutes } from "./pdfRoutes.js";
import demoRoutes from "../demoRoutes.js";
import courseRoutes from "../courseRoutes.js";
import { DataEncryption } from "../encryption.js";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

import { registerTTSRoutes } from "./ttsRoutes.js";
import { registerLearningRoutes } from "./learningRoutes.js";
import { registerVoiceRoutes } from "./voiceRoutes.js";
import groqVoiceRoutes from "./groqVoiceRoutes.js";
import mistralVoiceRoutes from "./mistralVoiceRoutes.js";
import mistralTestRoutes from "./mistralTestRoutes.js";
// Contextual financial tips routes moved to aiRoutes.ts

export async function registerRoutes(app: Express): Promise<Server> {
  // Server-side HTTP outcome capture (blueprint 07 §17.2): a 5xx that no `catch` reported
  // still reaches this listener, so API-only callers are not invisible. Registered before
  // any route, because `finish` only fires for responses that went through here.
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      if (res.statusCode < 500) return;
      const route = normalizeRoute(String(req.originalUrl || '').split('?')[0]);
      if (!route || route.startsWith('/api/telemetry')) return;
      reportHttpServerError({
        method: req.method,
        route,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    next();
  });

  // Cookie consent middleware
  app.post('/api/cookie-consent', setCookieConsent);

  // Contact form endpoint
  app.post('/api/contact', handleContactForm);

  // System status endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Deep health check for synthetic monitoring: also verifies the database round-trip.
  // Deliberately returns no error details — the reason is logged, not published.
  app.get('/api/health/deep', async (_req, res) => {
    const startedAt = Date.now();
    try {
      await db.execute(sql`select 1`);
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        checks: { database: { status: 'ok', latencyMs: Date.now() - startedAt } },
      });
    } catch (error) {
      console.error('[health] deep check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'error', latencyMs: Date.now() - startedAt },
        },
      });
    }
  });
  
  app.get('/api/encryption-status', (req, res) => {
    const status = DataEncryption.getEncryptionStatus();
    res.json(status);
  });

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
  registerImportRoutes(app);
  registerStripeRoutes(app);
  registerRedeemRoutes(app);

  // Receipt upload endpoint
  app.post('/api/upload-receipt', uploadReceiptHandler);
  registerAIRoutes(app);
  registerAdminRoutes(app);
  // Error Guard: public ingest + /api/admin/watch/* (blueprint 07).
  registerErrorGuardRoutes(app);
  registerPDFRoutes(app);

  registerTTSRoutes(app);
  registerLearningRoutes(app);
  registerVoiceRoutes(app);
  
  // Groq voice processing routes
  app.use('/api/voice-groq', groqVoiceRoutes);
  
  // Mistral voice processing routes (better accuracy)
  app.use('/api/voice-mistral', mistralVoiceRoutes);
  
  // Mistral test routes (no auth required) - development only, they call a paid API
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/mistral-test', mistralTestRoutes);
  }
  
  // Demo routes for interactive video features
  app.use('/api/demo', demoRoutes);
  
  // Course routes for financial literacy mini-courses
  app.use('/api/courses', courseRoutes);
  
  // Contextual financial tips routes moved to aiRoutes.ts

  // Register Clerk webhooks after other routes to avoid middleware conflicts
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