import type { Express } from "express";
import type { Server } from "http";
import { createServer } from "http";
import { registerAuthRoutes } from "./authRoutes";
import { registerUserRoutes } from "./userRoutes";
import { registerTransactionRoutes } from "./transactionRoutes";
import { registerBudgetRoutes } from "./budgetRoutes";
import { registerGoalRoutes } from "./goalRoutes";
import { registerRealtimeRoutes } from "./realtimeRoutes";
import { registerExportRoutes } from "./exportRoutes";
import { uploadReceiptHandler } from '../uploadReceipt';
import { registerAIRoutes } from "./aiRoutes";
import { registerAdminRoutes } from "./adminRoutes";
import { setCookieConsent } from "../cookieMiddleware";

export async function registerRoutes(app: Express): Promise<Server> {
  // Cookie consent middleware
  app.post('/api/cookie-consent', setCookieConsent);

  // Register all route modules
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerTransactionRoutes(app);
  registerBudgetRoutes(app);
  registerGoalRoutes(app);
  registerRealtimeRoutes(app);
  registerExportRoutes(app);

  // Receipt upload endpoint
  app.post('/api/upload-receipt', uploadReceiptHandler);
  registerAIRoutes(app);
  registerAdminRoutes(app);

  const server = createServer(app);
  return server;
}