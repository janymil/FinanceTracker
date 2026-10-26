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
import { registerMercadoPagoRoutes } from "./mercadoPagoRoutes";
import { registerBillingRegionRoute } from "../billingRegion";
import { setCookieConsent } from "../cookieMiddleware";
import { registerMobileUploadRoutes } from "./mobileUploadRoutes";
import { registerImportRoutes } from "./importRoutes";
import { handleContactForm } from "../contact";
import { registerComplaintRoutes } from "../complaints";
import { registerRedeemRoutes } from "./redeemRoutes";
import { registerPDFRoutes } from "./pdfRoutes.js";
import demoRoutes from "../demoRoutes.js";
import courseRoutes from "../courseRoutes.js";
import { DataEncryption } from "../encryption.js";
import { getEmailTransportStatus } from "../emailService.js";
import { isAuthenticated, setupClerkAuth } from "../clerkAuth.js";
import { getUserId as currentUserId } from "../clerkAuth.js";
import { cloudStorage } from "../cloudStorage.js";
import { aiGuard } from "../aiAccess.js";
import { checkAiGateway } from "../aiGatewayHealth";
import { rateLimit } from "../middleware/rateLimit.js";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

import { registerTTSRoutes } from "./ttsRoutes.js";
import { registerVoiceRoutes } from "./voiceRoutes.js";
import groqVoiceRoutes from "./groqVoiceRoutes.js";
import mistralVoiceRoutes from "./mistralVoiceRoutes.js";
import { log } from '../logger';
import { RELEASE_ID, PROCESS_STARTED_AT } from '../release';
// Contextual financial tips routes moved to aiRoutes.ts

export async function registerRoutes(app: Express): Promise<Server> {
  // Clerk must be mounted before any route module registers, so `req.auth` exists in every
  // handler that asks for it. It used to be mounted inside registerAuthRoutes, which runs
  // *after* registerMobileUploadRoutes — so the QR upload answered 401 on every request and
  // a unit test that mocked this module hid it. `tests/unit/authMountOrder.test.ts` guards it.
  setupClerkAuth(app);

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

  // Libro de Reclamaciones (Peru consumer law)
  registerComplaintRoutes(app);

  // Contact form endpoint — public by design, so it gets a tight per-IP limit.
  app.post(
    '/api/contact',
    rateLimit({ windowMs: 10 * 60 * 1000, max: 5, keyPrefix: 'contact' }),
    handleContactForm
  );

  // System status endpoints
  app.get('/api/health', (req, res) => {
    // `release` answers "is the thing I deployed the thing that is running?" — the question the
    // old response could not answer. It is a build stamp, not a secret.
    res.json({
      status: 'ok',
      release: RELEASE_ID,
      startedAt: PROCESS_STARTED_AT,
      timestamp: new Date().toISOString(),
    });
  });

  // Deep health check for synthetic monitoring: also verifies the database round-trip.
  // Deliberately returns no error details — the reason is logged, not published.
  app.get('/api/health/deep', async (_req, res) => {
    const startedAt = Date.now();
    try {
      await db.execute(sql`select 1`);
      // Email state is exposed as a status only: no host, no account, no error text.
      const email = getEmailTransportStatus();
      // The AI gateway is allowed to be down (calls fall back to the providers), so it can
      // only ever read "degraded"; it never turns the whole check red.
      const ai = await checkAiGateway();
      res.json({
        status: 'ok',
        release: RELEASE_ID,
        startedAt: PROCESS_STARTED_AT,
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'ok', latencyMs: Date.now() - startedAt },
          email: { status: email.status === 'failed' ? 'error' : email.status === 'unconfigured' ? 'disabled' : 'ok' },
          ai: { status: ai },
        },
      });
    } catch (error) {
      log.error('[health] deep check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'error', latencyMs: Date.now() - startedAt },
        },
      });
    }
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
  registerBillingRegionRoute(app);
  registerStripeRoutes(app);
  // Peru pays in soles through MercadoPago; USD keeps going through Stripe.
  registerMercadoPagoRoutes(app);
  registerRedeemRoutes(app);

  // Receipt upload endpoint — OCR and AI run per file, so it needs both a login and a cap.
  app.post(
    '/api/upload-receipt',
    isAuthenticated,
    rateLimit({ windowMs: 60 * 60 * 1000, max: 60, keyPrefix: 'receipt', perUser: true }),
    uploadReceiptHandler
  );
  // Receipt photos, owner only.
  //
  // New uploads live under `receipts/<userId>/<random>.<ext>` and are returned as this path
  // instead of the bucket's permanent public link. The owner check is the session, not the path:
  // another account's id in the URL answers 404, and the file name is validated so it cannot walk
  // out of its folder. Rows stored before this change keep their old public link and still render.
  app.get('/api/receipts/:ownerId/:file', isAuthenticated, async (req: any, res) => {
    const viewerId = currentUserId(req);
    const { ownerId, file } = req.params;
    if (!viewerId || ownerId !== viewerId) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!/^[A-Za-z0-9_-]{1,80}\.[A-Za-z0-9]{1,8}$/.test(String(file))) {
      return res.status(404).json({ error: 'Not found' });
    }
    try {
      const { data, contentType } = await cloudStorage.downloadBuffer(`receipts/${ownerId}/${file}`);
      res.set({
        'Content-Type': contentType || 'image/jpeg',
        'Content-Length': String(data.length),
        // Private: a shared browser or an intermediary must not keep someone's receipt.
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      });
      return res.send(data);
    } catch (error) {
      // A missing object and a storage outage look the same to the caller on purpose.
      log.info('[receipts] Stored image could not be read', {
        owner: String(ownerId).slice(0, 12),
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(404).json({ error: 'Not found' });
    }
  });

  registerAIRoutes(app);
  registerAdminRoutes(app);
  // Error Guard: public ingest + /api/admin/watch/* (blueprint 07).
  registerErrorGuardRoutes(app);
  registerPDFRoutes(app);

  registerTTSRoutes(app);
  registerVoiceRoutes(app);
  
  // Groq voice processing routes — paid per request and previously open to anyone.
  app.use(
    '/api/voice-groq',
    isAuthenticated,
    aiGuard(),
    rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: 'voice-groq', perUser: true }),
    groqVoiceRoutes
  );
  
  // Mistral voice processing routes (better accuracy) — same protection.
  app.use(
    '/api/voice-mistral',
    isAuthenticated,
    aiGuard(),
    rateLimit({ windowMs: 10 * 60 * 1000, max: 30, keyPrefix: 'voice-mistral', perUser: true }),
    mistralVoiceRoutes
  );
  
  // Demo routes (video-production tooling) are not served in production.
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/demo', demoRoutes);
  }
  
  // Course routes for financial literacy mini-courses
  app.use('/api/courses', courseRoutes);
  
  // Contextual financial tips routes moved to aiRoutes.ts

  // The Clerk webhook lives in server/index.ts: it needs the raw body before any parser.

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