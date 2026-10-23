/**
 * Scrubbing for error reports (blueprint 07 §7).
 *
 * This runs *before* anything is buffered, on the client and on the server, and again
 * before an AI prompt is built. `shared/piiScrubber.ts` owns the patterns; this module
 * owns the limits, because an error report is metadata, not evidence: a 200 KB stack is
 * a liability, and a request body must never arrive here at all.
 */
import { scrubString, scrubValue } from '../piiScrubber';
import { normalizeRoute } from './fingerprint';
import type { GuardBreadcrumb, GuardEvent } from './types';

export const LIMITS = {
  message: 500,
  stack: 6_000,
  contextBytes: 2_000,
  breadcrumbs: 20,
  breadcrumbLabel: 120,
  name: 120,
  release: 64,
  requestId: 80,
} as const;

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function scrubBreadcrumbs(breadcrumbs: GuardBreadcrumb[] | undefined): GuardBreadcrumb[] | undefined {
  if (!Array.isArray(breadcrumbs) || breadcrumbs.length === 0) return undefined;
  return breadcrumbs.slice(-LIMITS.breadcrumbs).map((crumb) => ({
    type: crumb.type,
    label: clip(scrubString(String(crumb.label ?? '')), LIMITS.breadcrumbLabel),
    ...(typeof crumb.at === 'number' && Number.isFinite(crumb.at) ? { at: crumb.at } : {}),
  }));
}

/** Scrub one event in place-safe fashion (returns a new object). */
export function scrubGuardEvent(event: GuardEvent, now: number = Date.now()): GuardEvent {
  const occurredAt = event.occurredAt && !Number.isNaN(Date.parse(event.occurredAt))
    ? new Date(event.occurredAt).toISOString()
    : new Date(now).toISOString();

  let context: Record<string, unknown> | undefined;
  if (event.context && typeof event.context === 'object') {
    const scrubbed = scrubValue(event.context) as Record<string, unknown>;
    try {
      const serialized = JSON.stringify(scrubbed);
      context = serialized.length > LIMITS.contextBytes
        ? { truncated: true, sizeBytes: serialized.length }
        : scrubbed;
    } catch {
      context = { truncated: true, reason: 'unserializable' };
    }
  }

  return {
    kind: event.kind,
    message: clip(scrubString(String(event.message ?? '')), LIMITS.message),
    ...(event.name ? { name: clip(scrubString(String(event.name)), LIMITS.name) } : {}),
    ...(event.stack ? { stack: clip(scrubString(String(event.stack)), LIMITS.stack) } : {}),
    ...(event.route ? { route: normalizeRoute(scrubString(String(event.route))) } : {}),
    ...(event.method ? { method: String(event.method).toUpperCase().slice(0, 10) } : {}),
    ...(typeof event.status === 'number' ? { status: Math.trunc(event.status) } : {}),
    ...(typeof event.durationMs === 'number' && Number.isFinite(event.durationMs)
      ? { durationMs: Math.max(0, Math.trunc(event.durationMs)) }
      : {}),
    ...(event.requestId ? { requestId: clip(scrubString(String(event.requestId)), LIMITS.requestId) } : {}),
    ...(event.release ? { release: clip(String(event.release), LIMITS.release) } : {}),
    ...(event.source ? { source: event.source } : {}),
    ...(event.platform ? { platform: clip(String(event.platform), 32) } : {}),
    ...(event.moneyPath === true ? { moneyPath: true } : {}),
    ...(event.severity ? { severity: event.severity } : {}),
    ...(context ? { context } : {}),
    ...(scrubBreadcrumbs(event.breadcrumbs) ? { breadcrumbs: scrubBreadcrumbs(event.breadcrumbs) } : {}),
    ...(typeof event.count === 'number' && event.count > 1 ? { count: Math.min(Math.trunc(event.count), 10_000) } : {}),
    occurredAt,
  };
}
