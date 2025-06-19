import { config } from "dotenv";
config(); // Load environment variables

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { cookieConsentMiddleware } from "./cookieMiddleware";
import { landingPageSSR, helpPageSSR, pricingPageSSR, contactPageSSR, privacyPageSSR, termsPageSSR, cookiePolicySSR } from "./ssr";
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
  
  // Content Security Policy to establish legitimacy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.finanzerpro.com https://replit.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://clerk.finanzerpro.com https://api.openai.com",
    "worker-src 'self' blob:",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
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
  res.sendFile(path.resolve('public/sitemap.xml'));
});

app.get('/robots.txt', (req, res) => {
  res.sendFile(path.resolve('public/robots.txt'));
});

// Serve static SEO files
app.use(express.static('public'));

// Enhanced crawler detection function
function isCrawlerRequest(req: Request): boolean {
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  const referer = req.get('Referer') || '';
  
  // Log all requests for debugging crawler access
  console.log(`[CRAWLER DEBUG] ${req.method} ${req.path}`);
  console.log(`User-Agent: ${userAgent}`);
  console.log(`Accept: ${req.get('Accept')}`);
  console.log(`Referer: ${referer}`);
  console.log(`Headers count: ${Object.keys(req.headers).length}`);
  console.log('---');
  
  // Comprehensive crawler detection patterns
  const crawlerPatterns = [
    // Search engines
    /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i, /yandexbot/i,
    // Social media crawlers
    /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i, /whatsapp/i, /telegrambot/i,
    // AI crawlers - expanded patterns
    /chatgpt-user/i, /gptbot/i, /ccbot/i, /anthropic/i, /claude/i,
    /perplexity/i, /perplexitybot/i, /gemini/i, /bard/i, /openai/i,
    /meta-externalagent/i, /meta-externalfetcher/i,
    // Generic patterns (removed /bot/i as it's too broad)
    /crawler/i, /spider/i, /crawling/i, /scraper/i, /fetch/i,
    // SEO tools
    /semrushbot/i, /ahrefsbot/i, /mj12bot/i, /dotbot/i, /screaming.frog/i
  ];
  
  // Check user agent patterns
  const isBot = crawlerPatterns.some(pattern => pattern.test(userAgent));
  
  // Additional fallback: serve SSR for any request with minimal headers (likely a bot)
  const hasMinimalHeaders = Object.keys(req.headers).length <= 6;
  const hasBasicAccept = !req.get('Accept') || req.get('Accept') === '*/*' || req.get('Accept')?.includes('text/html');
  const noJavaScriptHeaders = !req.get('Sec-Fetch-Site') && !req.get('Sec-Fetch-Mode');
  
  const isCrawler = isBot || (hasMinimalHeaders && hasBasicAccept && noJavaScriptHeaders);
  
  if (isCrawler) {
    console.log(`[CRAWLER DETECTED] Serving SSR for: ${userAgent}`);
  }
  
  return isCrawler;
}

// Server-side rendered routes for crawlers
app.get('/', (req, res, next) => {
  if (isCrawlerRequest(req)) {
    return landingPageSSR(req, res);
  }
  next();
});

app.get('/help', (req, res, next) => {
  if (isCrawlerRequest(req)) {
    return helpPageSSR(req, res);
  }
  next();
});

app.get('/pricing', (req, res, next) => {
  if (isCrawlerRequest(req)) {
    return pricingPageSSR(req, res);
  }
  next();
});

app.get('/contact', (req, res, next) => {
  if (isCrawlerRequest(req)) {
    return contactPageSSR(req, res);
  }
  next();
});

app.get('/privacy-policy', (req, res, next) => {
  if (isCrawlerRequest(req)) {
    return privacyPageSSR(req, res);
  }
  next();
});

app.get('/terms-of-service', (req, res, next) => {
  if (isCrawlerRequest(req)) {
    return termsPageSSR(req, res);
  }
  next();
});

app.get('/cookie-policy', (req, res, next) => {
  if (isCrawlerRequest(req)) {
    return cookiePolicySSR(req, res);
  }
  next();
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
