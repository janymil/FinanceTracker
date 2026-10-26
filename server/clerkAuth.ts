import { log } from './logger';
import { clerkMiddleware, requireAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

export const setupClerkAuth = (app: any) => {
  const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;

  // Loud, actionable validation: a publishable key in CLERK_SECRET_KEY makes every
  // protected API request return 401, which users experience as "empty/broken dashboard".
  if (!secretKey) {
    log.error(
      '[AUTH] CLERK_SECRET_KEY is missing. Every authenticated API request will return 401.\n' +
      '       Fix: add CLERK_SECRET_KEY=sk_test_... (or sk_live_...) from Clerk Dashboard -> Configure -> API Keys.'
    );
  } else if (!secretKey.startsWith('sk_') || secretKey.includes('REPLACE_WITH')) {
    log.error(
      '[AUTH] CLERK_SECRET_KEY is INVALID - it must be a real secret key starting with "sk_test_" or "sk_live_" (current value: "' +
      'hidden").\n' +
      '       Fix: Clerk Dashboard -> Configure -> API Keys -> copy the Secret key into .env as CLERK_SECRET_KEY=sk_... .\n' +
      '       Until this is fixed every authenticated request is rejected with 401 and dashboards render without data.'
    );
  }
  if (publishableKey && !publishableKey.startsWith('pk_')) {
    log.error('[AUTH] CLERK_PUBLISHABLE_KEY looks invalid - it must start with "pk_test_" or "pk_live_".');
  }

  log.info('Setting up Clerk middleware:', {
    publishableKeyPresent: Boolean(publishableKey),
    secretKeyPresent: Boolean(secretKey),
  });
  
  // Create single Clerk middleware instance
  const clerkHandler = clerkMiddleware({
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  // Add Clerk middleware only for routes that need authentication
  app.use(function clerkAuthGate(req: any, res: any, next: any) {
    // Skip Clerk middleware for Vite internal requests, static assets, webhooks, and public SEO routes
    if (
      req.path.startsWith('/@') ||
      req.path.startsWith('/src/') ||
      req.path.startsWith('/node_modules/') ||
      req.path.startsWith('/uploads/') ||
      req.path.startsWith('/api/clerk-webhooks') ||
      req.path.startsWith('/api/stripe-webhook') ||
      isStaticAssetPath(req.path) ||
      req.path === '/robots.txt' ||
      req.path === '/sitemap.xml'
    ) {
      return next();
    }

    return clerkHandler(req, res, next);
  });
};

/**
 * A path is a static file only when its last segment ends in an asset extension.
 *
 * This used to be `req.path.includes('.')`, which also skipped every route whose path carried
 * a dotted value — `/api/learning/merchant/amazon.com` arrived with no `req.auth` and a
 * signed-in caller was answered 401. A merchant name is not a stylesheet.
 */
const STATIC_FILE_EXTENSION =
  /\.(?:css|js|mjs|cjs|map|json|webmanifest|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|txt|xml|php|html?)$/i;

export const isStaticAssetPath = (requestPath: string): boolean =>
  STATIC_FILE_EXTENSION.test(requestPath);

// Middleware to require authentication
export const isAuthenticated = (req: any, res: Response, next: NextFunction) => {
  try {
    // `req.auth` missing means Clerk was never mounted ahead of this route. That is a wiring
    // bug, not an anonymous visitor: answering 401 turns a whole feature into "sign in again"
    // and hides the real cause (the QR upload lived like that in production).
    if (typeof req.auth !== 'function') {
      log.error(
        '[AUTH] Clerk middleware is not mounted before this route, so no request can be authenticated. ' +
          'Mount setupClerkAuth(app) before registering routes.'
      );
      return res.status(503).json({ message: 'Authentication is not available', code: 'auth_not_mounted' });
    }

    // Use req.auth() as a function (new Clerk API)
    const auth = req.auth();
    
    // Check if user is authenticated via Clerk
    if (!auth || !auth.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    next();
  } catch (error) {
    log.error('Authentication error:', error);
    // If this is a user deletion scenario, return 401 instead of 500
    if ((error as Error).message?.includes('User not found') || (error as Error).message?.includes('deleted')) {
      return res.status(401).json({ message: 'User account no longer exists' });
    }
    res.status(401).json({ message: 'Authentication failed' });
  }
};

// Helper to get user ID from Clerk
export const getUserId = (req: any): string | null => {
  try {
    const auth = req.auth();
    return auth?.userId || null;
  } catch (error) {
    return null;
  }
};

// Helper to get user ID and throw if not authenticated (for use after isAuthenticated middleware)
export const requireUserId = (req: any): string => {
  const userId = getUserId(req);
  if (!userId) {
    throw new Error('User ID not found after authentication');
  }
  return userId;
};