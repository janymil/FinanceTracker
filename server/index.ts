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
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
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
  // Security headers for all requests
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HTTPS Security headers for production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Production CSP with comprehensive CAPTCHA support
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    // Scripts: All possible CAPTCHA domains and services
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com https://*.clerk.com https://*.clerk.dev https://*.accounts.dev https://clerk.finanzerpro.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://recaptcha.net https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://recaptcha.google.com https://google.com/recaptcha/ https://gstatic.com/recaptcha/ https://apis.google.com https://ssl.gstatic.com https://hcaptcha.com https://*.hcaptcha.com https://assets.hcaptcha.com https://js.hcaptcha.com https://api.hcaptcha.com https://newassets.hcaptcha.com https://*.replit.dev https://*.replit.app blob:",
    // Styles: All CAPTCHA styling sources
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.com https://*.clerk.dev https://clerk.finanzerpro.com https://www.gstatic.com https://gstatic.com https://ssl.gstatic.com https://hcaptcha.com https://*.hcaptcha.com https://assets.hcaptcha.com https://newassets.hcaptcha.com https://*.replit.dev https://*.replit.app",
    // Images: All HTTPS for CAPTCHA images
    "img-src 'self' data: blob: https://*",
    // Fonts: All Google and CAPTCHA fonts
    "font-src 'self' https://fonts.gstatic.com https://gstatic.com https://ssl.gstatic.com https://*.clerk.com https://*.clerk.dev data:",
    // Connections: All CAPTCHA API endpoints
    "connect-src 'self' https://api.openai.com https://*.stripe.com https://*.clerk.com https://*.clerk.dev https://*.accounts.dev https://clerk.finanzerpro.com https://*.finanzerpro.com https://www.google-analytics.com https://www.googletagmanager.com https://*.bunny.net https://la.storage.bunnycdn.com https://www.google.com https://google.com https://www.gstatic.com https://gstatic.com https://ssl.gstatic.com https://www.recaptcha.net https://recaptcha.net https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://recaptcha.google.com https://google.com/recaptcha/ https://gstatic.com/recaptcha/ https://apis.google.com https://hcaptcha.com https://*.hcaptcha.com https://api.hcaptcha.com https://assets.hcaptcha.com https://js.hcaptcha.com https://newassets.hcaptcha.com https://*.replit.dev https://*.replit.app wss: ws:",
    // Frames: All CAPTCHA iframe sources
    "frame-src https://js.stripe.com https://checkout.stripe.com https://*.clerk.com https://*.clerk.dev https://clerk.finanzerpro.com https://www.google.com https://google.com https://www.gstatic.com https://gstatic.com https://ssl.gstatic.com https://www.recaptcha.net https://recaptcha.net https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://recaptcha.google.com https://google.com/recaptcha/ https://gstatic.com/recaptcha/ https://apis.google.com https://hcaptcha.com https://*.hcaptcha.com https://api.hcaptcha.com https://assets.hcaptcha.com https://js.hcaptcha.com https://newassets.hcaptcha.com",
    // Workers: All service workers
    "worker-src 'self' blob:",
    // Security: Prevent embedding
    "frame-ancestors 'none'"
  ].join('; '));
  
  // Additional security for admin and auth endpoints
  if (req.path.startsWith('/api/admin-analytics') || req.path.includes('auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Admin-Portal', 'FinanzerPro-Official');
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
