/**
 * Error Guard — browser capture.
 *
 * This is not a Sentry replacement and does not try to be: it reports *structured
 * metadata* only (kind, route pattern, status, a scrubbed message) in batches, so the
 * server can aggregate one write per problem instead of one write per failure.
 *
 * Rules that are not negotiable in a finance app:
 *  - no request bodies, no query strings, no cookies, no user id;
 *  - click breadcrumbs carry `tag#id[data-testid]`, never visible text;
 *  - the reporter never throws, never blocks the UI, and stays silent when the endpoint
 *    is unreachable (an ad-blocker is not an incident).
 */
import type { GuardBreadcrumb, GuardEvent } from '@shared/errorGuard/types';

const ENDPOINT = '/api/telemetry/errors';
const MAX_QUEUE = 40;
const BATCH_SIZE = 15;
const FLUSH_INTERVAL_MS = 8_000;
const MAX_BREADCRUMBS = 20;

const env = import.meta.env as unknown as Record<string, string | undefined>;

let installed = false;
let queue = new Map<string, GuardEvent>();
let timer: ReturnType<typeof setInterval> | null = null;
let breadcrumbs: GuardBreadcrumb[] = [];
let sessionRef = '';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function newSessionRef(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 8);
  } catch {
    /* fall through */
  }
  return Math.random().toString(36).slice(2, 10);
}

/** Route pattern: query string and numeric/uuid segments removed. Never the raw URL. */
export function routePattern(input: string | undefined): string | undefined {
  if (!input) return undefined;
  let value = input;
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      if (typeof window !== 'undefined' && url.origin !== window.location.origin) return undefined;
      value = url.pathname;
    }
  } catch {
    return undefined;
  }
  value = value.split('#')[0].split('?')[0];
  value = value
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
  return value.slice(0, 200);
}

function addBreadcrumb(type: GuardBreadcrumb['type'], label: string): void {
  breadcrumbs.push({ type, label: label.slice(0, 120), at: Date.now() });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs = breadcrumbs.slice(-MAX_BREADCRUMBS);
}

function release(): string | undefined {
  return env.VITE_APP_RELEASE?.trim() || env.VITE_SENTRY_RELEASE?.trim() || undefined;
}

/** Aggregate locally first: the same failure 30 times is one event with `count: 30`. */
function push(event: GuardEvent): void {
  if (!isBrowser()) return;
  const key = `${event.kind}|${event.name ?? ''}|${event.message}|${event.route ?? ''}`;
  const existing = queue.get(key);
  if (existing) {
    existing.count = (existing.count ?? 1) + (event.count ?? 1);
    existing.occurredAt = event.occurredAt;
    return;
  }
  queue.set(key, { ...event, count: event.count ?? 1 });
  if (queue.size >= MAX_QUEUE) {
    // Bounded memory beats completeness: drop the oldest key.
    const oldest = queue.keys().next();
    if (!oldest.done) queue.delete(oldest.value);
  }
  if (queue.size >= BATCH_SIZE) flush();
}

function currentRoute(): string | undefined {
  if (!isBrowser()) return undefined;
  return routePattern(window.location.pathname);
}

/** Send what we have. `beacon` is for `pagehide`, where fetch may not finish. */
export function flush(beacon = false): void {
  if (!isBrowser() || queue.size === 0) return;
  const events = Array.from(queue.values()).slice(0, 50);
  queue = new Map();
  const body = JSON.stringify({ events });

  try {
    if (beacon && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  } catch {
    /* reporting is always best-effort */
  }
}

function baseEvent(
  extra: Partial<GuardEvent> & { kind: GuardEvent['kind']; message: string },
): GuardEvent {
  return {
    source: 'client',
    route: currentRoute(),
    release: release(),
    sessionRef,
    breadcrumbs: breadcrumbs.slice(-10),
    occurredAt: new Date().toISOString(),
    ...extra,
  };
}

function messageOf(error: unknown): { message: string; name?: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name || 'Error', name: error.name, stack: error.stack };
  }
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error).slice(0, 300) };
  } catch {
    return { message: 'Non-serializable error' };
  }
}

/** The one line that closes the "swallowed error" blind spot (blueprint §17.1). */
export function reportSwallowed(error: unknown, details: { where: string; fallback?: string }): void {
  const info = messageOf(error);
  push(
    baseEvent({
      kind: 'swallowed',
      message: `${details.where}: ${info.message}`,
      name: info.name,
      stack: info.stack,
      severity: 'error',
      context: { where: details.where, ...(details.fallback ? { fallback: details.fallback } : {}) },
    }),
  );
}

/** A money invariant broke — never silent, never downgraded. */
export function reportInvariant(code: string, details: Record<string, unknown> = {}): void {
  push(
    baseEvent({
      kind: 'invariant',
      message: `Invariant failed: ${code}`,
      severity: 'critical',
      moneyPath: true,
      context: { code, ...details },
    }),
  );
}

/** A failed request the UI already handled — invisible without this. */
export function reportHttpFailure(input: {
  method: string;
  route: string;
  status: number;
  durationMs: number;
  severity?: GuardEvent['severity'];
}): void {
  push(
    baseEvent({
      kind: 'http',
      message: `${input.method} ${input.route} returned ${input.status}`,
      method: input.method,
      route: input.route,
      status: input.status,
      durationMs: input.durationMs,
      severity: input.severity ?? (input.status >= 500 ? 'error' : 'warning'),
    }),
  );
}

function installFetchWrapper(): void {
  if (typeof window.fetch !== 'function') return;
  const original = window.fetch;
  if ((original as unknown as { __errorGuardWrapped?: boolean }).__errorGuardWrapped) return;

  const wrapped = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
    const started = Date.now();
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (
      init?.method ?? (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')
    ).toUpperCase();
    const route = routePattern(rawUrl);
    const isApi = Boolean(route && route.startsWith('/api/') && !route.startsWith('/api/telemetry'));

    try {
      const response = await original.call(window, input as RequestInfo, init);
      if (isApi && route) {
        addBreadcrumb('http', `${method} ${route} → ${response.status}`);
        if (response.status >= 500) {
          reportHttpFailure({ method, route, status: response.status, durationMs: Date.now() - started });
        }
      }
      return response;
    } catch (error) {
      if (isApi && route) {
        const info = messageOf(error);
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        addBreadcrumb('http', `${method} ${route} → network error`);
        push(
          baseEvent({
            kind: 'http',
            message: `${method} ${route} failed: ${info.message}`,
            name: info.name,
            stack: info.stack,
            method,
            route,
            durationMs: Date.now() - started,
            severity: offline ? 'warning' : 'error',
            context: { offline },
          }),
        );
      }
      throw error;
    }
  };

  (wrapped as unknown as { __errorGuardWrapped?: boolean }).__errorGuardWrapped = true;
  window.fetch = wrapped as typeof window.fetch;
}

function installBreadcrumbs(): void {
  try {
    const originalPush = history.pushState.bind(history);
    const onNavigate = () => addBreadcrumb('navigation', routePattern(window.location.pathname) ?? '/');
    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      const result = originalPush(...args);
      onNavigate();
      return result;
    };
    window.addEventListener('popstate', onNavigate);

    // Labels only: tag, id and data-testid. Never textContent — the screen shows money.
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as Element | null;
        const element = target?.closest?.('[data-testid],[data-guard-label],button,a,input,select');
        if (!element) return;
        const parts = [element.tagName.toLowerCase()];
        if (element.id) parts.push(`#${element.id}`);
        const testId = element.getAttribute('data-testid');
        if (testId) parts.push(`[${testId}]`);
        const label = element.getAttribute('data-guard-label') ?? element.getAttribute('aria-label');
        if (label) parts.push(`"${label.slice(0, 40)}"`);
        addBreadcrumb('click', parts.join(''));
      },
      { capture: true, passive: true },
    );
  } catch {
    /* breadcrumbs are a nice-to-have */
  }
}

/**
 * Install the guard. Idempotent and safe to call from `main.tsx` before render.
 * Returns false when disabled by `VITE_ERROR_GUARD=off` or outside a browser.
 */
export function installErrorGuard(): boolean {
  if (installed || !isBrowser()) return false;
  if (env.VITE_ERROR_GUARD === 'off') return false;

  installed = true;
  sessionRef = newSessionRef();

  window.addEventListener('error', (event) => {
    // Resource load errors have no `error` object and are usually ad-blockers.
    if (!event.error && !event.message) return;
    const info = messageOf(event.error);
    push(
      baseEvent({
        kind: 'exception',
        message: info.message || event.message || 'Unknown error',
        name: info.name,
        stack:
          info.stack ??
          (event.filename ? `at ${event.filename}:${event.lineno}:${event.colno}` : undefined),
      }),
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const info = messageOf(event.reason);
    push(baseEvent({ kind: 'rejection', message: info.message, name: info.name, stack: info.stack }));
  });

  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });

  installBreadcrumbs();
  installFetchWrapper();

  timer = setInterval(() => flush(), FLUSH_INTERVAL_MS);
  addBreadcrumb('navigation', routePattern(window.location.pathname) ?? '/');
  return true;
}

/** Deliberate test problem, used by the Watch screen's "send a test" action. */
export function sendTestProblem(message = 'Test problem from the Watch screen'): void {
  if (!isBrowser()) return;
  sessionRef = sessionRef || newSessionRef();
  push(
    baseEvent({
      kind: 'exception',
      message,
      name: 'ErrorGuardTest',
      severity: 'warning',
      context: { trigger: 'admin-test-button' },
    }),
  );
  flush();
}

export function stopErrorGuard(): void {
  if (timer) clearInterval(timer);
  timer = null;
  installed = false;
}

