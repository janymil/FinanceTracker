/**
 * Small in-process rate limiter for the expensive, externally-billed endpoints.
 *
 * Why not a dependency: the app runs as a single PM2 process, and these limits only
 * need to stop one client from draining an AI/OCR budget. They are *not* a security
 * boundary — authentication is (see `isAuthenticated` on the same routes).
 *
 * Fixed window per key, bounded map, lazy cleanup. Never throws.
 */
import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Allowed requests per window. */
  max: number;
  /** Stable prefix so different routes keep separate buckets. */
  keyPrefix: string;
  /** Optional human message; defaults to a generic one. */
  message?: string;
  /** When true, the authenticated user id is used instead of the IP. */
  perUser?: boolean;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function prune(now: number): void {
  if (buckets.size < MAX_KEYS) return;
  Array.from(buckets.entries()).forEach(([key, bucket]) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
  // Still full of live buckets: drop the oldest third so memory cannot grow forever.
  if (buckets.size >= MAX_KEYS) {
    let removed = 0;
    for (const key of Array.from(buckets.keys())) {
      buckets.delete(key);
      if (++removed >= Math.floor(MAX_KEYS / 3)) break;
    }
  }
}

function clientKey(req: Request, options: RateLimitOptions): string {
  if (options.perUser) {
    try {
      const auth = typeof (req as any).auth === 'function' ? (req as any).auth() : null;
      if (auth?.userId) return `u:${auth.userId}`;
    } catch {
      /* fall back to the IP */
    }
  }

  // Behind Cloudflare the connection IP is an edge server, and the edge changes between
  // requests — so `req.ip` would give every visitor a different bucket and the limit would
  // not bind. CF-Connecting-IP carries the real visitor. The origin only accepts Cloudflare
  // traffic (ops/cloudflare-origin-firewall), so the header can be trusted here.
  const cfConnectingIp = req.headers?.['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
    return `ip:${cfConnectingIp.trim()}`;
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix } = options;
  const message = options.message ?? 'Too many requests. Please try again in a moment.';

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      const now = Date.now();
      prune(now);

      const key = `${keyPrefix}:${clientKey(req, options)}`;
      const existing = buckets.get(key);

      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(max - 1, 0)));
        return next();
      }

      existing.count += 1;
      const remaining = Math.max(max - existing.count, 0);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(remaining));

      if (existing.count > max) {
        const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ error: message, retryAfterSeconds: retryAfter });
      }

      return next();
    } catch {
      // A broken limiter must never take the API down.
      return next();
    }
  };
}

/** Test helper: clears all buckets so unit tests start from a clean state. */
export function resetRateLimits(): void {
  buckets.clear();
}
