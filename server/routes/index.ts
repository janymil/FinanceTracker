import type { Express } from "express";
import type { Server } from "http";
import { createServer } from "http";
import { registerAuthRoutes } from "./authRoutes";
import { registerUserRoutes } from "./userRoutes";
import { registerTransactionRoutes } from "./transactionRoutes";
import { registerBudgetRoutes } from "./budgetRoutes";
import { registerGoalRoutes } from "./goalRoutes";
import { registerAIRoutes } from "./aiRoutes";
import { registerExportRoutes } from "./exportRoutes";
import { registerAdminRoutes } from "./adminRoutes";
import { registerRealtimeRoutes } from "./realtimeRoutes";
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
  registerAIRoutes(app);
  registerExportRoutes(app);
  registerAdminRoutes(app);
  registerRealtimeRoutes(app);

  const server = createServer(app);
  return server;
}