/**
 * Sentry verification button — Sentry's "Break the world" snippet, adapted for this app.
 *
 * Renders ONLY in development. A button that throws on purpose must never ship to users of
 * a finance app, so `import.meta.env.DEV` guards it (production bundles tree-shake it out
 * of the UI; the import stays but renders `null`).
 *
 * How to use:
 *   1. npm run dev
 *   2. open any page, click "Break the world"
 *   3. Sentry → Issues → `This is your first error!`
 *
 * Note: `Sentry.logger` is not exported by @sentry/react@11.8.0, so the log call from the
 * original snippet is guarded — it becomes a no-op today and works if the SDK adds it.
 */
import * as Sentry from '@sentry/react';
import { Button } from '@/components/ui/button';

type SentryWithLogger = typeof Sentry & {
  logger?: { info?: (message: string, data?: Record<string, unknown>) => void };
};

export function SentryTestButton() {
  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-2 left-2 z-50 opacity-50 hover:opacity-100 transition-opacity">
      <Button
        size="sm"
        variant="outline"
        data-testid="sentry-test-button"
        onClick={() => {
          (Sentry as SentryWithLogger).logger?.info?.('User triggered test error', {
            action: 'test_error_button_click',
          });
          throw new Error('This is your first error!');
        }}
      >
        Break the world (Sentry test)
      </Button>
    </div>
  );
}
