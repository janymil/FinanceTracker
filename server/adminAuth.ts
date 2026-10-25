import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/express';
import { log } from './logger';

/**
 * Admin authentication.
 *
 * Two ways in, both re-checked on every admin request:
 *   1. a Clerk user whose public metadata says `role: "admin"` — the preferred path: one
 *      person per login, revocable in the Clerk dashboard, and Clerk MFA applies to it;
 *   2. the legacy shared ADMIN_PASSWORD session, kept only so the panel keeps working
 *      while that password is retired (delete this branch once ADMIN_PASSWORD is gone).
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_ROLE = 'admin';

if (!ADMIN_PASSWORD) {
  log.warn('ADMIN_PASSWORD environment variable is not set - legacy admin login will be disabled until configured.');
}

interface AdminRequest extends Request {
  session: any;
}

/** Constant-time comparison; hashing first makes both inputs the same length. */
function passwordMatches(candidate: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Reads the admin role from Clerk's Backend API rather than from the session token:
 * `publicMetadata` is not part of the default session claim, so relying on
 * `sessionClaims.publicMetadata` would silently fail unless the session-token template is
 * customised. Admin traffic is a handful of requests, so a short cache keeps this cheap;
 * the cost is that a revoked admin keeps access for at most ROLE_CACHE_TTL_MS.
 */
const roleCache = new Map<string, { isAdmin: boolean; checkedAt: number }>();
const ROLE_CACHE_TTL_MS = 60_000;

async function isClerkAdmin(req: Request): Promise<boolean> {
  let userId: string | null = null;
  try {
    userId = (req as any).auth?.()?.userId ?? null;
  } catch {
    return false;
  }
  if (!userId) return false;

  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.checkedAt < ROLE_CACHE_TTL_MS) {
    return cached.isAdmin;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const isAdmin = (user.publicMetadata as Record<string, unknown> | undefined)?.role === ADMIN_ROLE;
    roleCache.set(userId, { isAdmin, checkedAt: Date.now() });
    if (isAdmin) log.info('Admin access granted via Clerk role', { userId });
    return isAdmin;
  } catch (error) {
    // Fail closed: a Clerk outage must never open the admin surface.
    log.error('Admin role lookup failed', { error: (error as Error).message });
    return false;
  }
}

export const adminAuth = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    if (req.session?.isAdminAuthenticated) {
      return next();
    }

    if (await isClerkAdmin(req)) {
      return next();
    }

    return res.status(401).json({ message: 'Admin authentication required' });
  } catch (error) {
    // Express 4 does not catch rejected async middleware, so this must never throw.
    log.error('Admin auth check failed', { error: (error as Error).message });
    return res.status(401).json({ message: 'Admin authentication required' });
  }
};

export const adminLogin = async (req: AdminRequest, res: Response) => {
  const password = req.body?.password;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Password required' });
  }

  if (!ADMIN_PASSWORD || !passwordMatches(password, ADMIN_PASSWORD)) {
    log.warn('Invalid admin login attempt');
    return res.status(401).json({ message: 'Invalid admin password' });
  }

  // A fresh session id on login, so a session id planted before login is worthless.
  const markAuthenticated = () => {
    req.session.isAdminAuthenticated = true;
    return res.json({ message: 'Admin login successful' });
  };

  if (typeof req.session?.regenerate === 'function') {
    return req.session.regenerate((error: unknown) => {
      if (error) {
        log.error('Admin session regenerate failed:', error);
        return res.status(500).json({ message: 'Login failed' });
      }
      return markAuthenticated();
    });
  }

  if (!req.session) {
    req.session = {};
  }
  return markAuthenticated();
};

export const adminLogout = (req: AdminRequest, res: Response) => {
  if (typeof req.session?.destroy === 'function') {
    return req.session.destroy(() => res.json({ message: 'Admin logged out successfully' }));
  }
  if (req.session) {
    req.session.isAdminAuthenticated = false;
  }
  return res.json({ message: 'Admin logged out successfully' });
};
