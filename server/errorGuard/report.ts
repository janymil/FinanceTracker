/**
 * Server-side failure reporting (blueprint 07 §17.1 / §18).
 *
 * Browser capture cannot see a server catch block. This module is the server's equivalent
 * of `client/src/lib/errorGuard.ts`'s `reportSwallowed`: it pushes an event straight into
 * the aggregator — no HTTP hop, no serialisation, no network failure mode.
 *
 * Rules:
 *  - never throws (it is called from catch blocks);
 *  - never blocks (enqueue is synchronous, the flush is on a timer);
 *  - can be switched off with `ERROR_GUARD_SERVER=off` without touching any call site.
 */
import { enqueue } from './aggregator';
import type { GuardSeverity } from '@shared/errorGuard/types';

function disabled(): boolean {
  return process.env.ERROR_GUARD_SERVER === 'off';
}

function messageOf(error: unknown): { message: string; name?: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, name: error.name, stack: error.stack };
  }
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error).slice(0, 300) };
  } catch {
    return { message: 'Non-serializable error' };
  }
}

/**
 * A caught error that would otherwise be invisible. One line at every swallow point:
 *
 *   catch (error) {
 *     reportSwallowed(error, { where: 'runAI.fallback', fallback: 'local' });
 *     return fallback;
 *   }
 *
 * `where` is a stable code, so the fingerprint groups by call site rather than by message.
 */
export function reportSwallowed(
  error: unknown,
  details: { where: string; fallback?: string; route?: string; moneyPath?: boolean },
): void {
  if (disabled()) return;
  try {
    const info = messageOf(error);
    enqueue([
      {
        kind: 'swallowed',
        message: `${details.where}: ${info.message}`,
        name: info.name,
        stack: info.stack,
        source: 'server',
        route: details.route,
        severity: 'error',
        moneyPath: details.moneyPath,
        context: {
          where: details.where,
          ...(details.fallback ? { fallback: details.fallback } : {}),
        },
      },
    ]);
  } catch {
    /* reporting must never break the caller */
  }
}

/**
 * A money invariant broke. Always `critical` and always flagged as money, because this is
 * the class of failure that matters most and throws nothing.
 */
export function reportInvariant(code: string, details: Record<string, unknown> = {}): void {
  if (disabled()) return;
  try {
    enqueue([
      {
        kind: 'invariant',
        message: `Invariant failed: ${code}`,
        source: 'server',
        severity: 'critical' as GuardSeverity,
        moneyPath: true,
        context: { code, ...details },
      },
    ]);
  } catch {
    /* never throw from an invariant check */
  }
}

/**
 * A 5xx response that no `catch` reported (blueprint 07 §17.2).
 *
 * Client-side capture only sees requests it made. This covers API-only callers: mobile
 * uploads, Clerk/Stripe webhooks, cron scripts. Reported as `http` + status so it groups
 * per route instead of per message.
 */
export function reportHttpServerError(input: {
  method: string;
  route: string;
  status: number;
  durationMs: number;
  /** The request's own id, so the record can be matched to its access-log line. */
  requestId?: string;
}): void {
  if (disabled()) return;
  try {
    enqueue([
      {
        kind: 'http',
        message: `${input.method} ${input.route} returned ${input.status}`,
        source: 'server',
        route: input.route,
        method: input.method,
        status: input.status,
        durationMs: input.durationMs,
        requestId: input.requestId,
        severity: 'error',
      },
    ]);
  } catch {
    /* never throw from the reporter */
  }
}

/** A server-side exception that was already handled (a 500 response, a failed job step). */
export function reportServerError(
  error: unknown,
  details: { where: string; route?: string; moneyPath?: boolean; requestId?: string } = { where: 'server' },
): void {
  if (disabled()) return;
  try {
    const info = messageOf(error);
    enqueue([
      {
        kind: 'exception',
        message: info.message,
        name: info.name,
        stack: info.stack,
        source: 'server',
        route: details.route,
        moneyPath: details.moneyPath,
        // Ties the record to its access-log line, which is the only way back from a support
        // report to the request that failed.
        requestId: details.requestId,
        context: { where: details.where },
      },
    ]);
  } catch {
    /* never throw from the reporter */
  }
}
