/**
 * Client-side error reporting (Sentry) with PII scrubbing.
 *
 * Initialised synchronously and as early as possible: `main.tsx` calls this before
 * `createRoot(...).render(...)`, so errors thrown during the first render are captured.
 *
 * PRIVACY — this app handles financial data:
 * - `dataCollection` turns off automatic collectors (user info, cookies, headers, bodies,
 *   query params).
 * - `beforeSend` / `beforeBreadcrumb` redact e-mails, IBANs, card numbers, phones and
 *   sensitive field names (see shared/piiScrubber.ts).
 * - Session Replay runs with text/media/inputs masked. Do not disable masking here: a
 *   replay is a video of the screen, and the screen shows transactions.
 */
import * as Sentry from '@sentry/react';
import { scrubBreadcrumb, scrubEvent } from '@shared/piiScrubber';

const env = import.meta.env as unknown as Record<string, string | undefined>;

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

let initialised = false;

export function initClientObservability(): boolean {
  if (initialised) return true;

  const dsn = env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return false;

  try {
    Sentry.init({
      dsn,
      environment: env.MODE ?? 'development',
      release: env.VITE_SENTRY_RELEASE,
      // Never let the SDK collect PII on its own.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      integrations: [
        Sentry.replayIntegration({
          // Mandatory for this app: no text, no media, no input values in replays.
          maskAllText: true,
          maskAllInputs: true,
          blockAllMedia: true,
        }),
      ],
      // A session replay is a screen recording — keep the sample rate low by default.
      replaysSessionSampleRate: numberFromEnv(env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE, 0.1),
      replaysOnErrorSampleRate: numberFromEnv(env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE, 1.0),
      tracesSampleRate: numberFromEnv(env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0),
      beforeSend(event) {
        return scrubEvent(event as any) as any;
      },
      beforeBreadcrumb(breadcrumb) {
        return scrubBreadcrumb(breadcrumb as any) as any;
      },
    });

    initialised = true;
    return true;
  } catch (error) {
    // Telemetry must never break the UI.
    console.warn('[observability] Sentry init failed', error);
    return false;
  }
}

/** Correlates events with a user without sending an e-mail or name. */
export function setObservabilityUser(userId: string | null | undefined): void {
  if (!initialised) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

export function captureClientException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialised) return;
  Sentry.captureException(error, context ? { extra: scrubEvent({ extra: context } as any).extra as any } : undefined);
}

