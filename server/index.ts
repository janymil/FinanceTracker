import { config } from "dotenv";
import path from "path";
import fs from "fs";

// Always load base .env file first
config({ path: path.resolve(process.cwd(), '.env') });

// In development, allow .env.local to override if present.
// NOTE: `npm run dev` does not set NODE_ENV, so treat anything except explicit
// "production" as development - otherwise local Clerk dev keys are ignored.
if (process.env.NODE_ENV !== 'production') {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    delete process.env.VITE_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    config({ path: envLocalPath, override: true });
    console.log('Development environment: Using .env.local overrides');
  }
}

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import * as pathModule from "path";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { cookieConsentMiddleware } from "./cookieMiddleware.js";
import { renderPageForCrawler } from './ssr.js';
import { countryBlockingMiddleware } from "./middleware/countryBlocking.js";
import { checkEncryptionKey } from "./encryptionDiagnostics.js";
import { reportServerError } from './errorGuard/report.js';
import { verifyEmailTransport } from './emailService.js';

import "./batch-processor.js"; // Initialize batch processing system

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

// Register Clerk webhooks with raw body parser BEFORE any other middleware
app.use('/api/clerk-webhooks', express.raw({ type: 'application/json' }));
app.post('/api/clerk-webhooks', async (req, res) => {
  try {
    // Completely isolated webhook handler - no middleware chain
    if (process.env.NODE_ENV !== 'production') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Webhook disabled in dev' }));
      return;
    }
    
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('CLERK_WEBHOOK_SECRET is not configured');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Webhook secret not configured' }));
      return;
    }

    const svix_id = req.get('svix-id');
    const svix_timestamp = req.get('svix-timestamp');
    const svix_signature = req.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required svix headers' }));
      return;
    }

    // Import Webhook here to avoid circular imports
    const { Webhook } = await import('svix');
    const wh = new Webhook(webhookSecret);
    let evt;

    try {
      evt = wh.verify(req.body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('Webhook verification failed:', err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Webhook verification failed' }));
      return;
    }

    const { type, data } = evt as any;
    console.log(`Clerk webhook received: ${type} for user ${data.id}`);

    // Import storage here to avoid circular imports
    const { storage } = await import('./storage');

    switch (type) {
      case 'user.created':
        await handleUserCreatedInline(data, storage);
        break;
      case 'user.updated':
        await handleUserUpdatedInline(data, storage);
        break;
      case 'user.deleted':
        await handleUserDeletedInline(data, storage);
        break;
      default:
        console.log(`Unhandled webhook event type: ${type}`);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));
    
  } catch (error) {
    console.error('Clerk webhook error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Inline webhook handlers to avoid imports
async function handleUserCreatedInline(userData: any, storage: any) {
  try {
    const { id, email_addresses, first_name, last_name, image_url, phone_numbers, created_at } = userData;
    const primaryEmail = email_addresses?.find((email: any) => email.id === userData.primary_email_address_id)?.email_address;
    const primaryPhone = phone_numbers?.find((phone: any) => phone.id === userData.primary_phone_number_id)?.phone_number;

    const newUser = {
      id: id,
      email: primaryEmail || null,
      firstName: first_name || null,
      lastName: last_name || null,
      profileImageUrl: image_url || null,
      phone: primaryPhone || null,
      plan: 'free',
      settings: null,
      createdAt: new Date(created_at),
      updatedAt: new Date()
    };

    await storage.createUser(newUser);
    console.log(`User created in database: ${id} (${primaryEmail})`);
  } catch (error) {
    console.error('Error creating user from webhook:', error);
    throw error;
  }
}

async function handleUserUpdatedInline(userData: any, storage: any) {
  try {
    const { id, email_addresses, first_name, last_name, image_url, phone_numbers, updated_at } = userData;
    const existingUser = await storage.getUser(id);
    
    if (!existingUser) {
      console.log(`User ${id} not found in database, creating from update event`);
      return await handleUserCreatedInline(userData, storage);
    }
    
    const primaryEmail = email_addresses?.find((email: any) => email.id === userData.primary_email_address_id)?.email_address;
    const primaryPhone = phone_numbers?.find((phone: any) => phone.id === userData.primary_phone_number_id)?.phone_number;

    const updatedUser = {
      ...existingUser,
      email: primaryEmail || existingUser.email,
      firstName: first_name || existingUser.firstName,
      lastName: last_name || existingUser.lastName,
      profileImageUrl: image_url || existingUser.profileImageUrl,
      phone: primaryPhone || existingUser.phone,
      updatedAt: new Date(updated_at || Date.now())
    };

    await storage.updateUser(id, updatedUser);
    console.log(`User updated in database: ${id} (${primaryEmail})`);
  } catch (error) {
    console.error('Error updating user from webhook:', error);
    throw error;
  }
}

async function handleUserDeletedInline(userData: any, storage: any) {
  try {
    const { id } = userData;
    const existingUser = await storage.getUser(id);
    
    if (!existingUser) {
      console.log(`User ${id} not found in database, nothing to delete`);
      return;
    }

    await storage.deleteUserCompletely(id);
    console.log(`User deleted from database: ${id}`);
  } catch (error) {
    console.error('Error deleting user from webhook:', error);
    throw error;
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Behind Caddy + Cloudflare: without this, req.ip is the proxy's address (so rate
// limits would hit everybody at once) and `secure` cookies are dropped.
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error(
    '[SESSION] SESSION_SECRET is missing — falling back to an insecure default. ' +
    'Set SESSION_SECRET in .env and restart.'
  );
}

// Production keeps sessions in Postgres (table: sessions). The default MemoryStore
// both leaks memory and forgets every admin login on each restart.
// `any` on purpose: connect-pg-simple and express-session disagree on the Store
// generic, and the only thing that matters here is that it has `.get/.set/.destroy`.
let sessionStore: any;
if (isProduction) {
  const PgSession = ConnectPgSimple(session);
  const sessionConnectionString = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
  if (sessionConnectionString) {
    sessionStore = new PgSession({
      conObject: {
        connectionString: sessionConnectionString,
        ssl: sessionConnectionString.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
      },
      tableName: 'sessions',
      createTableIfMissing: true,
    });
    console.log('[SESSION] Using the PostgreSQL session store.');
  } else {
    console.error('[SESSION] No database URL available — sessions fall back to memory.');
  }
}

app.use(session({
  store: sessionStore,
  secret: sessionSecret || 'admin-session-secret-fallback',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  name: 'admin.session.id'
}));

app.use(cookieConsentMiddleware);

// Country blocking middleware - must be after session but before routes
// Delay initialization to ensure database is ready
let countryBlockingInitialized = false;
app.use(async (req, res, next) => {
  if (!countryBlockingInitialized) {
    // Skip middleware until server is fully initialized
    const uptime = process.uptime();
    if (uptime < 5) { // Wait 5 seconds for server startup
      return next();
    }
    countryBlockingInitialized = true;
  }
  
  try {
    await countryBlockingMiddleware(req, res, next);
  } catch (error) {
    console.error('Country blocking middleware error:', error);
    next();
  }
});

// HTTPS redirect middleware for production
app.use((req, res, next) => {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.header('host')}${req.url}`);
  }
  next();
});

// Security headers middleware - only for frontend user routes
app.use((req, res, next) => {
  // Skip security headers for webhooks, static assets, and SEO files
  if (req.path.startsWith('/api/clerk-webhooks') ||
      req.path.startsWith('/api/stripe-webhook') ||
      req.path.startsWith('/uploads/') ||
      req.path.includes('.') || // Static files (css, js, images, etc.)
      req.path === '/robots.txt' ||
      req.path === '/sitemap.xml') {
    return next();
  }
  
  // Only set headers if response hasn't been sent yet
  if (!res.headersSent && !res.finished) {
    try {
      // Security headers for frontend user routes
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
  
  // Additional security for admin and auth endpoints only
  if (!res.headersSent && !res.finished) {
    try {
      if (req.path.startsWith('/api/admin-analytics') || req.path.includes('auth')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Admin-Portal', 'Kaptia-Official');
      }
    } catch (error) {
      console.error('Error setting admin headers:', error);
    }
  }
  
  next();
});

// Serve static mascot images
app.use('/uploads', express.static('uploads'));

// Serve audio files with correct MIME type
app.use('/audio', express.static('public/audio', {
  setHeaders: (res, path) => {
    if (path.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
    }
  }
}));

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

// Language detection utility
function extractLanguageFromPath(path: string): { language: string | null; cleanPath: string } {
  const pathSegments = path.split('/').filter(Boolean);
  const supportedLanguages = ['en', 'es', 'sk'];
  
  if (pathSegments.length > 0 && supportedLanguages.includes(pathSegments[0])) {
    const language = pathSegments[0];
    const cleanPath = '/' + pathSegments.slice(1).join('/');
    return { language, cleanPath: cleanPath === '/' ? '/' : cleanPath };
  }
  
  return { language: null, cleanPath: path };
}

// SSR routes for SEO - only serve to crawlers (both root and language-prefixed)
const seoRoutes = ['/', '/pricing', '/help', '/contact', '/auth', '/privacy-policy', '/terms-of-service', '/cookie-policy', '/features'];

// Handle root routes (e.g., /pricing)
seoRoutes.forEach(route => {
  app.get(route, (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    
    if (isCrawler(userAgent)) {
      const html = renderPageForCrawler(route, 'en'); // Default to English for root routes
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }
    
    next(); // Continue to React app for human users
  });
});

// Handle language-prefixed routes (e.g., /es/pricing, /sk/contact)
seoRoutes.forEach(route => {
  app.get(`/:lang(en|es|sk)${route === '/' ? '' : route}`, (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    
    if (isCrawler(userAgent)) {
      const language = req.params.lang;
      const html = renderPageForCrawler(route, language);
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

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Never crash the process for a single failed request; report and answer.
    // Error Guard takes this over from Sentry (blueprint 07): same data, ours only.
    console.error("Unhandled route error:", err);
    reportServerError(err, {
      where: 'express.errorHandler',
      route: String(req.originalUrl || '').split('?')[0],
    });
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Report a field-encryption key mismatch at boot instead of silently rendering
  // ciphertext in the UI (see server/encryptionDiagnostics.ts).
  await checkEncryptionKey();

  // Prove the mail credentials at boot. A wrong SMTP password is otherwise invisible:
  // every sendEmail() failure is caught and logged only to pm2 (see emailService.ts).
  setTimeout(() => {
    void (async () => {
      try {
        const result = await verifyEmailTransport();
        if (result.status === 'failed') {
          console.error(
            `[EMAIL] Transport verification FAILED: ${result.detail}. ` +
            'Contact form, reminders, payment notices and alerts will not be delivered.'
          );
          reportServerError(new Error(`Email transport failed: ${result.detail}`), {
            where: 'email.verify',
          });
        } else if (result.status === 'ok') {
          log(`[EMAIL] Transport verified: ${result.detail}`);
        } else {
          console.warn('[EMAIL] No transport configured — outgoing mail is disabled.');
        }
      } catch (error) {
        console.error('[EMAIL] Transport verification crashed:', error);
      }
    })();
  }, 5000);

  // Defaults to 5000 (the port Replit exposes); override with PORT locally
  const port = Number(process.env.PORT) || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    // reusePort is not supported on Windows (fails with ENOTSUP)
    ...(process.platform === "win32" ? {} : { reusePort: true }),
  }, () => {
    log(`serving on port ${port}`);
  });
})();

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
  reportServerError(err, { where: 'process.uncaughtException' });
});

process.on('unhandledRejection', (reason) => {
  console.error('CRITICAL: Unhandled Rejection:', reason);
  reportServerError(reason, { where: 'process.unhandledRejection' });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

