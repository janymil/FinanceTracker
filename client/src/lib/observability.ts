/**
 * Client-side error reporting with PII scrubbing.
 *
 * No `VITE_SENTRY_DSN` => no-op (the SDK chunk is never loaded). `sendDefaultPii: false`
 * plus the shared scrubber, because breadcrumbs can contain transaction descriptions
 * typed by the user.
 */
import { scrubBreadcrumb, scrubEvent } from '@shared/piiScrubber';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export async function initClientObservability(): Promise<boolean> {
  const dsn = env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return false;

  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: env.MODE ?? 'development',
      release: env.VITE_SENTRY_RELEASE,
      // Sentry v11: opt out of every automatic PII collector (cookies, headers, bodies,
      // query params, user info). Breadcrumbs are scrubbed separately below.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      tracesSampleRate: Number(env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0') || 0,
      beforeSend(event) {
        return scrubEvent(event as any) as any;
      },
      beforeBreadcrumb(breadcrumb) {
        return scrubBreadcrumb(breadcrumb as any) as any;
      },
    });
    return true;
  } catch (error) {
    // Telemetry must never break the UI.
    console.warn('[observability] Sentry init failed', error);
    return false;
  }
}
