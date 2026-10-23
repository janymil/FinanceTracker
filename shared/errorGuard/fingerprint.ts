/**
 * Fingerprinting — one bug must produce one group, no matter how many times it happens.
 *
 * Pure and isomorphic: no `node:crypto`, because the client needs the same hash and
 * `crypto.subtle` is async. FNV-1a twice with different seeds gives 16 hex characters,
 * which is plenty for grouping and stays stable across runtimes.
 *
 * Rules that keep groups from exploding (blueprint 07 §4):
 *  - ids, uuids, long hex, quoted strings and numbers are replaced by placeholders;
 *  - the top application stack frame is used, without line/column;
 *  - the route is a pattern, not a URL (`/api/expenses/:id`, no query string).
 *
 * Bump `FINGERPRINT_VERSION` when the rules change, so old and new groups do not mix.
 */
import type { GuardEvent, GuardKind } from './types';

export const FINGERPRINT_VERSION = 1;

const URL_RE = /https?:\/\/[^\s"'())]+/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LONG_HEX_RE = /\b[0-9a-f]{16,}\b/gi;
const QUOTED_RE = /'[^']{2,160}'|"[^"]{2,160}"|`[^`]{2,160}`/g;
const NUMBER_RE = /\b\d+(?:[.,]\d+)?\b/g;
const WHITESPACE_RE = /\s+/g;

/** Replace everything variable in a message, leaving its shape. */
export function normalizeMessage(message: string): string {
  return String(message ?? '')
    .replace(URL_RE, ':url')
    .replace(EMAIL_RE, ':email')
    .replace(UUID_RE, ':id')
    .replace(LONG_HEX_RE, ':hex')
    .replace(QUOTED_RE, ':str')
    .replace(NUMBER_RE, ':n')
    .replace(WHITESPACE_RE, ' ')
    .trim()
    .slice(0, 400);
}

/**
 * Turn a URL into a route pattern: no query string, no hash, numeric and uuid
 * segments collapsed. This is what stops `/api/expenses/123` and `/api/expenses/124`
 * from becoming two different problems.
 */
export function normalizeRoute(route: string | undefined): string | undefined {
  if (!route) return undefined;
  let value = String(route).split('#')[0].split('?')[0].trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      /* keep the original string */
    }
  }
  value = value
    .replace(UUID_RE, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f]{16,}(?=\/|$)/gi, '/:id');
  return value.slice(0, 200);
}

/** The first frame that belongs to our own code. Line and column are dropped so
 * editing an unrelated file above does not create a new group.
 */
export function topApplicationFrame(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const lines = String(stack).split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^at\s/.test(trimmed)) continue;
    if (/node_modules|node:internal|<anonymous>|native code/i.test(trimmed)) continue;
    const location = trimmed.match(/\(?([\w./@$-]+\.(?:tsx|ts|jsx|js|mjs|cjs))(?::\d+){0,2}\)?/);
    if (!location) continue;
    const file = location[1].split('/').slice(-2).join('/');
    const fnMatch = trimmed.match(/^at\s+(.+?)\s*(?:\(|$)/);
    const fnRaw = fnMatch ? fnMatch[1].trim() : '';
    // V8 prints `at /path/file.ts:1:2` for anonymous frames — that is not a function name.
    const fn = fnRaw && !/\.(ts|tsx|js|jsx|mjs|cjs)/.test(fnRaw) ? fnRaw : 'anonymous';
    return `${fn}@${file}`;
  }
  return undefined;
}

/** FNV-1a, 32 bits. */
function fnv1a(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Stable 16-hex-character hash. Same input, same output, in every runtime. */
export function stableHash(value: string): string {
  const first = fnv1a(value, 0x811c9dc5).toString(16).padStart(8, '0');
  const second = fnv1a(value, 0x9e3779b1).toString(16).padStart(8, '0');
  return `${first}${second}`;
}

/**
 * The group id. `kind` participates, so the same message reported as a swallowed
 * error and as an uncaught crash stays distinguishable — the fixes differ.
 */
export function fingerprint(event: Pick<GuardEvent, 'kind' | 'name' | 'message' | 'route' | 'stack'>): string {
  const signature = [
    `v${FINGERPRINT_VERSION}`,
    event.kind,
    event.name ?? '',
    normalizeMessage(event.message),
    normalizeRoute(event.route) ?? '',
    topApplicationFrame(event.stack) ?? '',
  ].join('|');
  return stableHash(signature);
}

/** Human title for the admin list: never the raw stack, never a machine string. */
export function titleFor(event: Pick<GuardEvent, 'kind' | 'name' | 'message'>): string {
  const name = event.name && event.name !== 'Error' ? event.name : '';
  const message = normalizeMessage(event.message).slice(0, 160);
  const base = message || name || kindTitleFallback(event.kind);
  return name && !base.startsWith(name) ? `${name}: ${base}`.slice(0, 200) : base;
}

function kindTitleFallback(kind: GuardKind): string {
  switch (kind) {
    case 'invariant':
      return 'A money figure did not add up';
    case 'swallowed':
      return 'A feature failed without telling anyone';
    case 'http':
      return 'A request failed';
    case 'job':
      return 'A scheduled job failed';
    default:
      return 'Something went wrong';
  }
}
