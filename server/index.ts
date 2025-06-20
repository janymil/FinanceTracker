import { config } from "dotenv";
config(); // Load environment variables

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import * as pathModule from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { cookieConsentMiddleware } from "./cookieMiddleware";
import { renderPageForCrawler } from './ssr';
import "./batch-processor"; // Initialize batch processing system

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Configure session middleware for admin authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'admin-session-secret-fallback',
  resave: true, // Force session save
  saveUninitialized: true, // Create session for all requests
  cookie: {
    secure: false, // Allow HTTP in all environments for admin sessions
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  name: 'admin.session.id' // Unique session name for admin
}));

app.use(cookieConsentMiddleware);

// HTTPS redirect middleware for production
app.use((req, res, next) => {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.header('host')}${req.url}`);
  }
  next();
});

// Serve static mascot images
app.use('/uploads', express.static('uploads'));

// Serve specific SEO files
app.get('/sitemap.xml', (req, res) => {
  res.sendFile(pathModule.resolve(process.cwd(), 'public/sitemap.xml'));
});

app.get('/robots.txt', (req, res) => {
  res.sendFile(pathModule.resolve(process.cwd(), 'public/robots.txt'));
});

// SSR for crawlers - serve rendered HTML to search engines
function isCrawler(userAgent: string): boolean {
  return /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|chatgpt-user|gptbot|ccbot|anthropic|claude-bot|perplexitybot|meta-externalagent|semrushbot|ahrefsbot|mj12bot|dotbot/i.test(userAgent);
}

// SSR routes for SEO - only serve to crawlers
const seoRoutes = ['/', '/pricing', '/help', '/contact'];

seoRoutes.forEach(route => {
  app.get(route, (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    
    if (isCrawler(userAgent)) {
      const html = renderPageForCrawler(route);
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }
    
    next(); // Continue to React app for human users
  });
});


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
