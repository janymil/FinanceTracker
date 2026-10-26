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

/**
 * Whether the shared password may open the console at all.
 *
 * It is a single secret with no second step, and the admin surface can read and delete every
 * customer's records, so production refuses it unless the operator writes the risk down:
 * `ALLOW_LEGACY_ADMIN_PASSWORD=1`. Development keeps it, because the Clerk test instance
 * usually has no admin role on a fresh account.
 */
function legacyPasswordAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_LEGACY_ADMIN_PASSWORD === '1';
}

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
const roleCache = new Map<string, { isAdmin: boolean; checkedAt: number; twoFactor: boolean }>();
const ROLE_CACHE_TTL_MS = 60_000;

/**
 * Whether an admin sign-in must carry a second factor.
 *
 * Enforcement is on in production by default and off elsewhere, because a developer who has not
 * enrolled in the test Clerk instance should not be locked out of their own machine. The switch
 * is `ADMIN_REQUIRE_2FA`: `1` always enforces, `0` never does, anything else follows
 * `NODE_ENV`.
 *
 * The legacy `ADMIN_PASSWORD` door cannot be protected this way — it is a shared secret with no
 * second step — so it is a deliberate 2FA bypass and is announced at boot.
 */
function requiresSecondFactor(): boolean {
  const flag = (process.env.ADMIN_REQUIRE_2FA ?? 'auto').toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(flag)) return false;
  if (['1', 'true', 'on', 'yes'].includes(flag)) return true;
  return process.env.NODE_ENV === 'production';
}

if (process.env.ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
  if (legacyPasswordAllowed()) {
    log.warn(
      'ADMIN_PASSWORD is set and ALLOW_LEGACY_ADMIN_PASSWORD=1: the shared-password admin door ' +
        'is OPEN with no second factor. Remove both once every admin signs in through Clerk.',
    );
  } else {
    log.warn(
      'ADMIN_PASSWORD is set but IGNORED in production: the shared password is refused, and ' +
        'admins must sign in through Clerk with a second factor. Set ALLOW_LEGACY_ADMIN_PASSWORD=1 ' +
        'only to re-open the old door deliberately.',
    );
  }
}

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
    return cached.isAdmin && (!requiresSecondFactor() || cached.twoFactor);
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const isAdmin = (user.publicMetadata as Record<string, unknown> | undefined)?.role === ADMIN_ROLE;
    const twoFactor = Boolean(user.twoFactorEnabled);
    roleCache.set(userId, { isAdmin, checkedAt: Date.now(), twoFactor });

    if (!isAdmin) return false;

    if (requiresSecondFactor() && !twoFactor) {
      // Refused, not warned: an admin console can read every customer's records, and a stolen
      // password is the whole threat model this check exists for.
      log.warn(
        'Admin access refused: this Clerk account has no second factor enrolled. Enroll it in ' +
          'Clerk (or set ADMIN_REQUIRE_2FA=0 to accept the risk in writing).',
        { userId },
      );
      return false;
    }

    log.info('Admin access granted via Clerk role', { userId, secondFactor: twoFactor });
    return true;
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

  if (!legacyPasswordAllowed()) {
    log.warn(
      'Admin password login refused: production requires the Clerk admin account with a second ' +
        'factor. Set ALLOW_LEGACY_ADMIN_PASSWORD=1 to re-open the shared-password door.',
    );
    return res.status(401).json({
      message: 'Password sign-in is disabled. Sign in with your admin account.',
      code: 'legacy_password_disabled',
    });
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
