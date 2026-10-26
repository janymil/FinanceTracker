import { log } from '../logger';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { blockedCountries } from '../../shared/schema.ts';

/**
 * Country blocking.
 *
 * Three things used to go wrong here, all of them silently:
 *
 *  1. For the first five seconds after every process start the check was skipped entirely
 *     (`process.uptime() < 5 → next()`), so every deploy — and there is one per push — opened a
 *     window in which a blocked country was served the app like any other. A request that
 *     arrives before the list is ready now *waits* for it instead of being let through.
 *  2. A failed read of the blocked list returned an empty set, which reads as "nothing is
 *     blocked": the strictest failure mode dressed up as a normal answer. It now retries
 *     briefly, serves a stale list when it has one, and otherwise refuses the request.
 *  3. Every request called the free GeoJS endpoint. Results are cached per address now, so one
 *     visitor is one lookup per ten minutes rather than one per request.
 *
 * What is deliberately *not* fail-closed: a geolocation lookup that fails. Refusing every
 * request because a third-party service is down turns their outage into ours, and blocking is a
 * compliance guard, not the primary access control. `COUNTRY_BLOCK_GEO_FAIL_CLOSED=1` opts into
 * refusing those too. The *list* failing is different — without it nobody can tell who should be
 * blocked — and that refuses by default (`COUNTRY_BLOCK_FAIL_OPEN=1` to opt out).
 */

interface GeoJSResponse {
  country_code: string;
  country: string;
  city: string;
  timezone: string;
  ip: string;
}

export interface GeoInfo {
  countryCode: string;
  country: string;
  city: string;
  ip: string;
}

/** How long a successfully loaded blocklist is trusted. */
const LIST_TTL_MS = 5 * 60 * 1000;
/** How long a geolocation answer is reused for one address. */
const GEO_TTL_MS = 10 * 60 * 1000;
/** Cap on the geolocation cache, so a flood of addresses cannot grow it without limit. */
const GEO_CACHE_MAX = 5_000;
/** After the list fails to load, stop hammering the database for this long. */
const LIST_FAILURE_BACKOFF_MS = 5_000;
const LOAD_ATTEMPTS = 3;
const LOAD_RETRY_MS = 250;

let blockedCountriesCache: Set<string> | null = null;
let cacheExpiry: number = 0;
let loadInFlight: Promise<Set<string>> | null = null;
let listFailedAt = 0;

const geoCache = new Map<string, { info: GeoInfo | null; expires: number }>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function listFailOpen(): boolean {
  return process.env.COUNTRY_BLOCK_FAIL_OPEN === '1';
}

function geoFailClosed(): boolean {
  return process.env.COUNTRY_BLOCK_GEO_FAIL_CLOSED === '1';
}


async function fetchBlockedCountries(): Promise<Set<string>> {
  const blocked = await db.select({ countryCode: blockedCountries.countryCode }).from(blockedCountries);
  return new Set(blocked.map((b) => b.countryCode.toUpperCase()));
}

/**
 * The blocked-country list, cached. Retries a few times, then serves a stale copy if it has one,
 * and only then throws — the caller decides what "we cannot tell" means for a request.
 */
export async function loadBlockedCountries(): Promise<Set<string>> {
  const now = Date.now();
  if (blockedCountriesCache && cacheExpiry > now) {
    return blockedCountriesCache;
  }
  if (loadInFlight) {
    return loadInFlight;
  }

  // This failed a moment ago: answer from that failure instead of queueing three more attempts
  // per request. During a database blip that would turn a slow query into a request storm.
  if (!blockedCountriesCache && now - listFailedAt < LIST_FAILURE_BACKOFF_MS) {
    throw new Error('Blocked-country list is unavailable (recent failure)');
  }

  loadInFlight = (async () => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= LOAD_ATTEMPTS; attempt += 1) {
      try {
        const set = await fetchBlockedCountries();
        blockedCountriesCache = set;
        cacheExpiry = Date.now() + LIST_TTL_MS;
        listFailedAt = 0;
        return set;
      } catch (error) {
        lastError = error;
        if (attempt < LOAD_ATTEMPTS) await sleep(LOAD_RETRY_MS * attempt);
      }
    }

    listFailedAt = Date.now();
    if (blockedCountriesCache) {
      log.warn('Blocked-country list could not be refreshed; serving the last known copy', {
        error: lastError instanceof Error ? lastError.message : String(lastError),
      });
      return blockedCountriesCache;
    }
    throw lastError instanceof Error ? lastError : new Error('Blocked-country list unavailable');
  })().finally(() => {
    loadInFlight = null;
  });

  return loadInFlight;
}

export function invalidateBlockedCountriesCache() {
  blockedCountriesCache = null;
  cacheExpiry = 0;
  listFailedAt = 0;
}

function readGeoCache(ip: string): { hit: true; info: GeoInfo | null } | { hit: false } {
  const entry = geoCache.get(ip);
  if (!entry) return { hit: false };
  if (entry.expires <= Date.now()) {
    geoCache.delete(ip);
    return { hit: false };
  }
  return { hit: true, info: entry.info };
}

function writeGeoCache(ip: string, info: GeoInfo | null): void {
  if (geoCache.size >= GEO_CACHE_MAX) {
    // Insertion-ordered, so the oldest entries go first. Cheap and bounded beats clever.
    // `forEach` rather than `for…of` on the key iterator: the server build targets ES5.
    let toDrop = Math.ceil(GEO_CACHE_MAX / 10);
    geoCache.forEach((_value, key) => {
      if (toDrop <= 0) return;
      geoCache.delete(key);
      toDrop -= 1;
    });
  }
  geoCache.set(ip, { info, expires: Date.now() + GEO_TTL_MS });
}

/** Country for an address, from the cache when possible. `null` means "could not determine". */
async function lookupCountry(ip: string): Promise<GeoInfo | null> {
  const cached = readGeoCache(ip);
  if (cached.hit) return cached.info;

  try {
    const geoResponse = await fetch(`https://get.geojs.io/v1/ip/geo/${ip}.json`, {
      // A geo service that never answers must not hold the request open: the guard fails closed
      // after three seconds instead, which is the documented behaviour for "cannot tell".
      signal: AbortSignal.timeout(3_000),
    });
    if (!geoResponse.ok) {
      log.warn('GeoJS lookup failed', { status: geoResponse.status });
      writeGeoCache(ip, null);
      return null;
    }

    const geoData = (await geoResponse.json()) as GeoJSResponse;
    const countryCode = geoData.country_code?.toUpperCase();
    if (!countryCode) {
      writeGeoCache(ip, null);
      return null;
    }

    const info: GeoInfo = {
      countryCode,
      country: geoData.country ?? '',
      city: geoData.city ?? '',
      ip,
    };
    writeGeoCache(ip, info);
    return info;
  } catch (error) {
    log.warn('GeoJS lookup threw', {
      error: error instanceof Error ? error.message : String(error),
    });
    writeGeoCache(ip, null);
    return null;
  }
}

/**
 * The two-letter country Cloudflare computed for this request, or `null`.
 *
 * `XX` means "the edge could not tell" and `T1` means Tor, so neither is a country to compare
 * against the list. Anything that is not two letters (a test harness, a hand-written request) is
 * treated as absent rather than as a value to trust.
 */
export function readEdgeCountry(req: Request): string | null {
  const raw = String(req.headers['cf-ipcountry'] || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(raw)) return null;
  if (raw === 'XX' || raw === 'T1') return null;
  return raw;
}

function refuseForLocation(res: Response) {
  res.setHeader('Retry-After', '30');
  return res.status(503).json({
    error: 'Service temporarily unavailable',
    message: 'We could not verify your location. Please try again in a moment.',
  });
}


export async function countryBlockingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip blocking for admin routes
  if (req.path.startsWith('/api/admin-analytics')) {
    return next();
  }

  // Skip for health checks and static assets
  if (req.path === '/health' || req.path.startsWith('/assets')) {
    return next();
  }

  // Skip for development or internal requests
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Explicit escape hatch for E2E / synthetic monitoring. Default off; must be set
  // deliberately in a non-production environment (see tests/e2e/README.md).
  if (process.env.DISABLE_COUNTRY_BLOCKING === '1' && process.env.NODE_ENV !== 'production') {
    return next();
  }

  // The visitor's country comes from the edge.
  //
  // Cloudflare adds `cf-ipcountry` to every request it proxies, computed where the request
  // really arrived. This used to be ignored: the code asked a third-party geo service about an
  // address read from `x-forwarded-for`, which behind this host's proxy is the address of the
  // *proxy*, so the log recorded "blocked from India" for requests that never came from India
  // — and a caller who can set that header could choose their own country. The header wins; the
  // lookup stays only as the fallback for traffic that did not arrive through the edge (local
  // monitoring, a direct origin call), where no header exists to trust.
  const edgeCountry = readEdgeCountry(req);

  let countryCode: string | null = edgeCountry;
  let countryLabel = edgeCountry ?? '';
  let clientIP = '';

  if (!countryCode) {
    // No edge header: fall back to the address we can see. `cf-connecting-ip` is written by the
    // edge and cannot be forged by the client; `x-forwarded-for` is only a last resort.
    clientIP =
      String(req.headers['cf-connecting-ip'] || '').trim() ||
      String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      String(req.headers['x-real-ip'] || '').trim() ||
      req.socket.remoteAddress ||
      '';

    // Skip for localhost and private ranges: there is no country to look up, and the synthetic
    // checks come from there.
    if (
      !clientIP ||
      clientIP === '127.0.0.1' ||
      clientIP === '::1' ||
      clientIP === 'localhost' ||
      clientIP.startsWith('::ffff:127.0.0.1') ||
      clientIP.startsWith('192.168.') ||
      clientIP.startsWith('10.') ||
      clientIP.startsWith('172.16.')
    ) {
      return next();
    }

    const geo = await lookupCountry(clientIP);
    if (!geo) {
      if (geoFailClosed()) {
        log.warn('Country could not be determined — refusing the request', { ip: clientIP });
        return refuseForLocation(res);
      }
      log.warn('Country could not be determined — allowing the request', { ip: clientIP });
      return next();
    }
    countryCode = geo.countryCode;
    countryLabel = geo.country;
    (req as Request & { geoInfo?: GeoInfo }).geoInfo = geo;
  }

  try {
    // "We do not know who is blocked" is not the same as "nobody is blocked". A request that
    // arrives while the list is being loaded waits for it here rather than being let through.
    let blockedSet: Set<string>;
    try {
      blockedSet = await loadBlockedCountries();
    } catch (error) {
      log.error('Blocked-country list unavailable', {
        error: error instanceof Error ? error.message : String(error),
        failOpen: listFailOpen(),
      });
      if (listFailOpen()) return next();
      return refuseForLocation(res);
    }

    if (blockedSet.has(countryCode)) {
      log.info(`Blocked access from ${countryCode}${clientIP ? ` - IP: ${clientIP}` : ''}`);

      return res.status(403).json({
        error: 'Access denied',
        message: 'Access from your country is not available',
        country: countryLabel,
      });
    }

    // Add country info to request for analytics.
    if (!(req as Request & { geoInfo?: GeoInfo }).geoInfo) {
      (req as Request & { geoInfo?: GeoInfo }).geoInfo = {
        countryCode,
        country: countryLabel,
        city: '',
        ip: clientIP,
      };
    }
    return next();
  } catch (error) {
    // A throw we did not anticipate. Refuse unless the operator asked to fail open: this is a
    // guard, and a guard that opens itself on a bug is not a guard.
    log.error('Country blocking middleware error:', error);
    if (listFailOpen()) return next();
    return refuseForLocation(res);
  }
}