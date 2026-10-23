/**
 * Server-side error reporting (Sentry) with mandatory PII scrubbing.
 *
 * - No `SENTRY_DSN` => a complete no-op: the SDK is not even imported, so local dev and
 *   CI stay fast and nothing leaves the machine.
 * - `sendDefaultPii: false` + `beforeSend`/`beforeBreadcrumb` scrubbers, because the app
 *   logs voice transcripts and financial summaries (see shared/piiScrubber.ts).
 * - `setupExpressErrorHandler` must be attached AFTER routes and BEFORE the custom
 *   error handler, otherwise the error never reaches Sentry.
 */
import { scrubBreadcrumb, scrubEvent, scrubValue } from '../shared/piiScrubber';

type SentryModule = typeof import('@sentry/node');

let sentry: SentryModule | null = null;

export function isObservabilityEnabled(): boolean {
  return sentry !== null;
}

/** Initialises Sentry when SENTRY_DSN is configured. Returns whether it activated. */
export async function initServerObservability(): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    console.log('[observability] SENTRY_DSN not set — error reporting disabled.');
    return false;
  }

  try {
    const mod = await import('@sentry/node');
    mod.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      release: process.env.SENTRY_RELEASE,
      // Sentry v11: opt out of every automatic PII collector. On top of this, the
      // beforeSend/beforeBreadcrumb scrubbers remove what free text still carries.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0') || 0,
      beforeSend(event) {
        return scrubEvent(event as any) as any;
      },
      beforeBreadcrumb(breadcrumb) {
        return scrubBreadcrumb(breadcrumb as any) as any;
      },
    });
    sentry = mod;
    console.log(`[observability] Sentry enabled (${process.env.NODE_ENV ?? 'development'}).`);
    return true;
  } catch (error) {
    // A broken telemetry SDK must never take the app down.
    console.error('[observability] Sentry init failed:', error);
    return false;
  }
}

/** Registers Sentry's Express error handler. No-op when disabled. */
export function attachSentryErrorHandler(app: unknown): void {
  if (!sentry) return;
  sentry.setupExpressErrorHandler(app as any);
}

/** Reports an exception with scrubbed context. No-op when disabled. */
export function captureServerException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!sentry) return;
  try {
    sentry.captureException(error, context ? { extra: scrubValue(context) as any } : undefined);
  } catch (reportingError) {
    console.error('[observability] failed to capture exception:', reportingError);
  }
}
