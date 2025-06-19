import { config } from "dotenv";
config(); // Load environment variables

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { cookieConsentMiddleware } from "./cookieMiddleware";
// Removed SSR imports
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

// Debug endpoint to test file paths
app.get('/debug-paths', (req, res) => {
  const fs = require('fs');
  const debugInfo = {
    cwd: process.cwd(),
    dirname: __dirname,
    nodeEnv: process.env.NODE_ENV,
    files: {
      'public/features.html': fs.existsSync(path.resolve(process.cwd(), 'public/features.html')),
      'features.html': fs.existsSync(path.resolve(process.cwd(), 'features.html')),
      '../public/features.html': fs.existsSync(path.resolve(__dirname, '..', 'public/features.html')),
      './public/features.html': fs.existsSync(path.resolve(__dirname, 'public/features.html'))
    },
    resolvedPaths: {
      'public/features.html': path.resolve(process.cwd(), 'public/features.html'),
      '../public/features.html': path.resolve(__dirname, '..', 'public/features.html'),
      './public/features.html': path.resolve(__dirname, 'public/features.html')
    }
  };
  res.json(debugInfo);
});

// Safe file serving with comprehensive debugging
function safeSendFile(res: Response, filePath: string, next: NextFunction) {
  console.log(`[DEBUG] Starting safeSendFile for: ${filePath}`);
  console.log(`[DEBUG] Current working directory: ${process.cwd()}`);
  console.log(`[DEBUG] __dirname: ${__dirname}`);
  
  try {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    console.log(`[STATIC FILE] Attempting to serve: ${resolvedPath}`);
    
    // Check if file exists before serving
    const fs = require('fs');
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[STATIC FILE] File not found: ${resolvedPath}`);
      console.log(`[DEBUG] Checking alternative paths...`);
      
      // Try alternative paths
      const altPath1 = path.resolve(__dirname, '..', filePath);
      const altPath2 = path.resolve(__dirname, filePath);
      console.log(`[DEBUG] Alternative path 1: ${altPath1} (exists: ${fs.existsSync(altPath1)})`);
      console.log(`[DEBUG] Alternative path 2: ${altPath2} (exists: ${fs.existsSync(altPath2)})`);
      
      return next(); // Let React handle the route
    }
    
    console.log(`[STATIC FILE] File exists, serving: ${resolvedPath}`);
    res.sendFile(resolvedPath, (err) => {
      if (err) {
        console.error(`[STATIC FILE] Error serving ${filePath}:`, err.message);
        console.error(`[STATIC FILE] Error code:`, (err as any).code);
        console.error(`[STATIC FILE] Error status:`, (err as any).status);
        console.error(`[STATIC FILE] Full error:`, err);
        return next(); // Fallback to React app instead of 500
      }
      console.log(`[STATIC FILE] Successfully served: ${filePath}`);
    });
  } catch (error) {
    console.error(`[STATIC FILE] Critical error in safeSendFile:`, error);
    next();
  }
}

// Serve static files only for actual web crawlers (not browsers)
function isCrawler(userAgent: string): boolean {
  return /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|chatgpt-user|gptbot|ccbot|anthropic|claude-bot|perplexitybot|meta-externalagent|semrushbot|ahrefsbot|mj12bot|dotbot/i.test(userAgent);
}

// Centralized crawler route handler with comprehensive error handling
const crawlerRoutes = [
  { path: '/', file: 'public/index.html' },
  { path: '/pricing', file: 'public/pricing.html' },
  { path: '/help', file: 'public/features.html' },
  { path: '/contact', file: 'public/about.html' }
];

crawlerRoutes.forEach(({ path, file }) => {
  app.get(path, (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    console.log(`[ROUTE ${path}] User-Agent: ${userAgent.substring(0, 50)}...`);
    console.log(`[ROUTE ${path}] Full request URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    console.log(`[ROUTE ${path}] Request method: ${req.method}`);
    console.log(`[ROUTE ${path}] Request headers:`, JSON.stringify(req.headers, null, 2));
    
    if (isCrawler(userAgent)) {
      console.log(`[ROUTE ${path}] Crawler detected, serving static file: ${file}`);
      
      // Fix for /help route - use absolute path resolution
      if (path === '/help') {
        console.log(`[HELP DEBUG] Serving static HTML for /help to crawler`);
        try {
          const helpFilePath = path.resolve(process.cwd(), 'public/features.html');
          console.log(`[HELP DEBUG] Resolved path: ${helpFilePath}`);
          return res.sendFile(helpFilePath, (err) => {
            if (err) {
              console.error(`[HELP DEBUG] Error serving features.html:`, err);
              // Fallback to index.html if features.html fails
              const fallbackPath = path.resolve(process.cwd(), 'public/index.html');
              return res.sendFile(fallbackPath);
            }
            console.log(`[HELP DEBUG] Successfully served features.html`);
          });
        } catch (error) {
          console.error(`[HELP DEBUG] Critical error:`, error);
          return next();
        }
      }
      
      return safeSendFile(res, file, next);
    }
    
    console.log(`[ROUTE ${path}] Human user, passing to React app`);
    next();
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
