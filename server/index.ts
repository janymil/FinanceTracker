import { config } from "dotenv";
import path from "path";
import fs from "fs";

// Force load .env.local in development to override system environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
  console.log('Development environment: Using .env.local for Clerk keys');
} else {
  config(); // Load .env as fallback for production
  console.log('Production environment: Using system environment variables');
}

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

// Global middleware to prevent header conflicts
app.use((req, res, next) => {
  // Override res.setHeader to prevent conflicts
  const originalSetHeader = res.setHeader;
  res.setHeader = function(name, value) {
    if (!this.headersSent && !this.finished) {
      try {
        return originalSetHeader.call(this, name, value);
      } catch (error: any) {
        console.error(`Header conflict prevented for ${name}:`, error.message);
        return this;
      }
    }
    return this;
  };
  
  // Override res.writeHead to prevent conflicts
  const originalWriteHead = res.writeHead;
  res.writeHead = function(statusCode, headers) {
    if (!this.headersSent && !this.finished) {
      try {
        return originalWriteHead.call(this, statusCode, headers as any);
      } catch (error: any) {
        console.error(`WriteHead conflict prevented:`, error.message);
        return this;
      }
    }
    return this;
  };
  
  next();
});

// Disabled Clerk webhooks - users are auto-created via authentication flow
app.post('/api/clerk-webhooks', async (req, res) => {
  console.log('Clerk webhook disabled - users auto-created during authentication');
  res.status(200).json({ message: 'Webhook disabled - using auth flow instead' });
});

// Webhook handlers removed - users auto-created during authentication

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

// Security headers middleware to prevent phishing detection
app.use((req, res, next) => {
  // Skip all header setting for webhook routes to prevent conflicts
  if (req.path === '/api/clerk-webhooks') {
    return next();
  }
  
  // Only set headers if response hasn't been sent yet
  if (!res.headersSent && !res.finished) {
    try {
      // Security headers for all requests
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // HTTPS Security headers for production
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }
    } catch (error) {
      console.error('Error setting security headers:', error);
    }
  }
  
  // CSP headers temporarily removed to isolate header conflict issue
  // TODO: Re-implement CSP after resolving header conflicts
  
  // Additional security for admin and auth endpoints only
  if (!res.headersSent && !res.finished) {
    try {
      if (req.path.startsWith('/api/admin-analytics') || req.path.includes('auth')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Admin-Portal', 'FinanzerPro-Official');
      }
    } catch (error) {
      console.error('Error setting admin headers:', error);
    }
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
