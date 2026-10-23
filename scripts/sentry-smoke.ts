/**
 * Verifies that Sentry is wired correctly AND that PII scrubbing works.
 *
 *   SENTRY_DSN=https://… npm run sentry:smoke
 *
 * Sends one error with deliberately sensitive fields. Open the Sentry issue and confirm:
 *   - the event arrived (so the DSN + network are right)
 *   - `email` and `description` show `[redacted]`
 *   - `amountInCents` survived (numbers are kept on purpose)
 *
 * Manual tool: never part of CI, never run against production with real user data.
 */
import 'dotenv/config';
import { captureServerException, initServerObservability } from '../server/observability';

async function main(): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();

  if (!dsn) {
    console.error(
      'SENTRY_DSN is not set.\n' +
        'Create a project at sentry.io, copy the DSN, then:\n' +
        '  SENTRY_DSN=https://<key>@oXXXX.ingest.sentry.io/<project> npm run sentry:smoke',
    );
    process.exit(1);
  }

  const enabled = await initServerObservability();
  if (!enabled) {
    console.error('Sentry init failed — check SENTRY_DSN and the network.');
    process.exit(1);
  }

  captureServerException(new Error('Kaptia Sentry smoke test'), {
    email: 'should-be-redacted@example.com',
    description: 'this description must not leave the process',
    transcript: 'kupil som naftu na slovnafte',
    amountInCents: 12345,
    categoryName: 'Potraviny',
  });

  // Give the transport a moment to flush before the process exits.
  const Sentry = await import('@sentry/node');
  const flushed = await Sentry.flush(5000);

  console.log(flushed ? '✅ event sent' : '⚠️ flush timed out — check network access to sentry.io');
  console.log('Open Sentry → Issues and verify: email + description = [redacted], amountInCents = 12345.');
}

main().catch((error) => {
  console.error('sentry smoke failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
