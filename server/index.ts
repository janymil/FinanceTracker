import { log as logger } from './logger';
import './zodInspect';
import { config } from "dotenv";
import { clerkWebhookHandler } from "./clerkWebhook";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

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
    logger.info('Development environment: Using .env.local overrides');
  }
}

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { Pool as PgPool } from "pg";
import * as pathModule from "path";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { cookieConsentMiddleware } from "./cookieMiddleware.js";
import { renderPageForCrawler } from './ssr.js';
import { countryBlockingMiddleware, loadBlockedCountries } from "./middleware/countryBlocking.js";
import { isStaticAssetPath } from "./clerkAuth.js";
import { runWithRequestId } from "./requestContext.js";
import { checkEncryptionKey } from "./encryptionDiagnostics.js";
import { reportServerError } from './errorGuard/report.js';
import { verifyEmailTransport } from './emailService.js';
import { POOL_SETTINGS, sslFor, closePool } from './db.js';

import "./batch-processor.js"; // Initialize batch processing system
import { startRecurringScheduler } from "./recurringProcessor.js";
import { startReminderScheduler } from "./reminderNotifier.js";
// Imported for its side effect only in the past: the singleton existed, the settings screen read
// "automatic backups: on", and nothing ever created one because this module was never loaded.
import { backupScheduler } from "./backupScheduler.js";

const app = express();

// Response headers are deliberately NOT patched here.
//
// This file used to wrap `res.setHeader` / `res.writeHead` to swallow "Cannot set headers after
// they are sent". The wrapping made a real bug (a route setting a header after the body had gone
// out) into a silently dropped header: the response looked fine and nothing was logged, because
// the `headersSent` branch returned `this` without even a message. Node's throw is the diagnosis,
// and a resulting 5xx is captured by the `res.on('finish')` listener in server/routes/index.ts and
// reported through Error Guard — so patching only hid evidence.
//
// `tests/unit/responseHeaders.test.ts` fails if the patch comes back.


// Register Clerk webhooks with raw body parser BEFORE any other middleware
app.use('/api/clerk-webhooks', express.raw({ type: 'application/json' }));
// Stripe signs the exact bytes it sends, so its webhook also needs the raw body.
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
// Signature-checked in every environment; see server/clerkWebhook.ts.
app.post('/api/clerk-webhooks', clerkWebhookHandler);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));

// A body larger than the limit is answered as JSON with a sentence a person can act on.
// Express answered with its own HTML page, so a big import showed a raw English parser error.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    logger.warn('[body] Request body over the limit', { path: req.path, limit: '5mb' });
    return res.status(413).json({
      error: 'The file is too large to send in one request',
      message: 'Split the file into smaller parts and try again.',
      code: 'payload_too_large',
    });
  }
  return next(err);
});
app.use(cookieParser());

// Behind Caddy + Cloudflare: without this, req.ip is the proxy's address (so rate
// limits would hit everybody at once) and `secure` cookies are dropped.
app.set('trust proxy', 1);
app.disable('x-powered-by');

/**
 * One id per request, on the response and in every log line about it.
 *
 * Without it a support report ("it failed around 4:06") cannot be matched to the request that
 * failed: the access log has no user and no id, and the error record has no way back to either.
 * An id from the edge is reused when one arrives, so our line and Cloudflare's can be tied
 * together for the same request.
 */
app.use((req, res, next) => {
  const incoming = req.header('x-request-id') || req.header('cf-ray');
  const id =
    typeof incoming === 'string' && incoming.trim()
      ? incoming.trim().slice(0, 64)
      : randomUUID();
  (req as any).requestId = id;
  if (!res.headersSent) res.setHeader('X-Request-Id', id);
  // Carried through every await below, so an outbound call to the PDF or AI service can send the
  // same id and one search covers all three logs.
  runWithRequestId(id, next);
});

const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProduction) {
    // A guessable secret would let anyone forge an admin session cookie.
    throw new Error('SESSION_SECRET must be set in production.');
  }
  logger.error(
    '[SESSION] SESSION_SECRET is missing — falling back to an insecure development default. ' +
    'Set SESSION_SECRET in .env and restart.'
  );
}

// Production keeps sessions in Postgres (table: sessions). The default MemoryStore
// both leaks memory and forgets every admin login on each restart.
// `any` on purpose: connect-pg-simple and express-session disagree on the Store
// generic, and the only thing that matters here is that it has `.get/.set/.destroy`.
let sessionStore: any;
/** Its own pool (see below), kept so shutdown can hand the sockets back. */
let sessionPool: import('pg').Pool | null = null;
if (isProduction) {
  const PgSession = ConnectPgSimple(session);
  const sessionConnectionString = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
  if (sessionConnectionString) {
    // The store gets its own pool instead of the app's, so a session write can never wait
    // behind a slow report. It is created here rather than by connect-pg-simple because an
    // idle socket dropped by the server emits `error` on the pool, and an unhandled `error`
    // event is an uncaught exception — which this app exits on. Same fault as `server/db.ts`.
    sessionPool = new PgPool({
      connectionString: sessionConnectionString,
      ssl: sslFor(sessionConnectionString),
      ...POOL_SETTINGS,
    });
    sessionPool.on('error', (error: Error) => {
      logger.warn(
        '[SESSION] pool reported a connection error; the pool will replace the socket:',
        error.message,
      );
    });
    sessionStore = new PgSession({
      pool: sessionPool,
      tableName: 'sessions',
      createTableIfMissing: true,
    });
    logger.info('[SESSION] Using the PostgreSQL session store.');
  } else {
    logger.error('[SESSION] No database URL available — sessions fall back to memory.');
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

// Country blocking middleware - must be after session but before routes.
//
// There used to be a `process.uptime() < 5 → next()` guard here "to let the database come up",
// which meant every restart — and `scripts/deploy.sh` restarts on every deploy — served a
// blocked country normally for five seconds. The middleware now waits for the list instead of
// skipping the check, and refuses the request when the list cannot be read.
app.use((req, res, next) => {
  countryBlockingMiddleware(req, res, next).catch((error) => {
    logger.error('Country blocking middleware error:', error);
    if (res.headersSent) return next();
    // Fail closed: an unexpected throw here is a guard failing, not a permission slip.
    res.status(503).json({ error: 'Service temporarily unavailable' });
  });
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
  // Skip security headers for webhooks, static assets, and SEO files.
  //
  // The static-file test used to be `req.path.includes('.')`, which also skipped every route
  // carrying a dotted value — `/api/learning/merchant/amazon.com` was served with no CSP and no
  // nosniff. A merchant name is not a stylesheet. `isStaticAssetPath` asks the same question the
  // Clerk gate asks: does the last segment end in an asset extension?
  if (req.path.startsWith('/api/clerk-webhooks') ||
      req.path.startsWith('/api/stripe-webhook') ||
      req.path.startsWith('/uploads/') ||
      isStaticAssetPath(req.path) ||
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
      res.setHeader('X-XSS-Protection', '0'); // legacy filter is itself an attack surface
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), payment=(self)');
      // Enforced. Lists every third party the app talks to; checked with a browser sweep of the
      // public and signed-in pages in all three languages (no violations). A new third-party
      // script, frame or API host must be added here or the browser will block it.
      res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.kaptia.app https://js.stripe.com https://www.googletagmanager.com https://www.googleadservices.com https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: https:",
        "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.kaptia.app https://api.stripe.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.google.com https://*.doubleclick.net https://*.mercadopago.com",
        "frame-src https://js.stripe.com https://hooks.stripe.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://td.doubleclick.net https://*.mercadopago.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://*.mercadopago.com",
        "frame-ancestors 'none'",
      ].join('; '));
      
      // HTTPS Security headers for production
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }
    } catch (error) {
      logger.error('Error setting security headers:', error);
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
      logger.error('Error setting admin headers:', error);
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

  // Response bodies are not logged: they carry people's financial data.
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms [req ${(req as any).requestId ?? '-'}]`);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Server faults never echo their internal message to the browser.
    const message = status >= 500 ? "Internal Server Error" : (err.message || "Bad request");

    // Never crash the process for a single failed request; report and answer.
    // Error Guard takes this over from Sentry (blueprint 07): same data, ours only.
    logger.error("Unhandled route error:", err);
    reportServerError(err, {
      where: 'express.errorHandler',
      route: String(req.originalUrl || '').split('?')[0],
      requestId: (req as any).requestId,
    });
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // An endpoint that does not exist answers 404 as JSON. Without this the page fallback below
  // answers 200 with the HTML of the home page, so a wrong URL or method looks like success.
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ message: 'Not found' });
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
          logger.error(
            `[EMAIL] Transport verification FAILED: ${result.detail}. ` +
            'Contact form, reminders, payment notices and alerts will not be delivered.'
          );
          reportServerError(new Error(`Email transport failed: ${result.detail}`), {
            where: 'email.verify',
          });
        } else if (result.status === 'ok') {
          log(`[EMAIL] Transport verified: ${result.detail}`);
        } else {
          logger.warn('[EMAIL] No transport configured — outgoing mail is disabled.');
        }
      } catch (error) {
        logger.error('[EMAIL] Transport verification crashed:', error);
      }
    })();
  }, 5000);

  // Defaults to 5000 (the port Replit exposes); override with PORT locally
  const port = Number(process.env.PORT) || 5000;
  // Bind address. Defaults to every interface, which is what a host that publishes the port
  // itself (Replit) needs. This machine sets HOST=127.0.0.1: the reverse proxy is the only
  // intended way in, so a public bind here would expose the app on the host's own address the
  // moment a firewall rule changed. See `ecosystem.config.cjs`.
  const host = process.env.HOST || "0.0.0.0";
  server.listen({
    port,
    host,
    // `reusePort` is deliberately NOT set. SO_REUSEPORT lets a *second* process bind the same
    // port instead of failing, and then the kernel splits connections between them. Nearly
    // everything that must be shared is not: rate-limit buckets, mobile-upload QR sessions and
    // live-update streams all live in one process's memory, so a duplicate instance would
    // enforce half-limits and answer "session not found" to half the QR scans. A port that is
    // already in use must be an error, not a silent second copy.
  }, () => {
    log(`serving on ${host}:${port}`);
    // Warm the blocked-country list at boot. The first request should not be the thing that
    // discovers the database is not answering yet — and because the middleware no longer skips
    // itself for the first five seconds, a cold start would otherwise answer 503 while it waits.
    void loadBlockedCountries().catch((error) => {
      logger.warn('Blocked-country list not available at boot; requests will refuse until it is', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    // Creates the repeats that recurring transactions owe (hourly, idempotent).
    startRecurringScheduler();
    // E-mails bill reminders when their "remind me N days before" moment arrives.
    startReminderScheduler();
    // Automatic backups. The scheduler starts in its constructor and this reference keeps the
    // import from being "unused": that is what happened before — the module was never loaded,
    // so the switch in the app was on and no backup was ever written.
    backupScheduler.getScheduledBackups();
    log('[backup] automatic backup scheduler started');
  });

  // `pm2 reload` sends SIGTERM. Finish what is in flight, hand the database connections
  // back, then exit — otherwise the old process is killed mid-query and its sockets linger
  // until the database times them out.
  // pm2 kills after `kill_timeout` (1.6 s by default); start the app with a longer one
  // (`pm2 start ... --kill-timeout 12000`) if you want the pool closed every time.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`[shutdown] ${signal} received — closing server and database pool`);
    const exit = () => {
      // Both pools, in parallel: the app's and the session store's. A socket left open here is
      // one the database has to time out on its own.
      Promise.allSettled([closePool(), sessionPool ? sessionPool.end() : Promise.resolve()])
        .finally(() => process.exit(0));
    };
    server.close(exit);
    // Keep-alive sockets are idle, not in-flight: releasing them now lets close() finish
    // quickly instead of waiting for the client to give up.
    (server as any).closeIdleConnections?.();
    // A stuck socket must not keep the old process alive forever.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();

process.on('uncaughtException', (err) => {
  logger.error('CRITICAL: Uncaught Exception:', err);
  reportServerError(err, { where: 'process.uncaughtException' });
  // A process that swallows an uncaught exception keeps serving from an unknown state: a request
  // half-finished, a transaction left open, a response object nobody owns. pm2 restarts it in two
  // seconds, which is a known state; staying up is not. The 250 ms gives the report time to leave.
  setTimeout(() => process.exit(1), 250).unref();
});

process.on('unhandledRejection', (reason) => {
  logger.error('CRITICAL: Unhandled Rejection:', reason);
  reportServerError(reason, { where: 'process.unhandledRejection' });
});

