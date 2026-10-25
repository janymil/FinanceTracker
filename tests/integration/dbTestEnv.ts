import { config } from 'dotenv';
import { describe } from 'vitest';

// Realistic defaults from .env, then the test database. `.env.test` is only consulted when
// DATABASE_URL_TEST is absent or empty, so an exported value always wins.
config({ path: '.env' });
if (!process.env.DATABASE_URL_TEST) {
  config({ path: '.env.test', override: true });
}

/**
 * Shared setup for the suites that need a REAL Postgres (`tests/integration`).
 *
 * `DATABASE_URL_TEST` is read from `.env.test` (git-ignored) when it is not already in the
 * environment, so `npm run test:integration` works without sourcing anything by hand.
 *
 * `REQUIRE_DB_TESTS=1` — set by CI and by `scripts/deploy.sh` — turns a missing variable
 * into a failure instead of a skip. A release must never go green because the database
 * tests quietly did not run; that is the whole point of running them.
 *
 * Never point `DATABASE_URL_TEST` at production: these tests create and delete accounts.
 */
const testUrl = process.env.DATABASE_URL_TEST;

if (!testUrl && process.env.REQUIRE_DB_TESTS === '1') {
  throw new Error(
    '[integration] DATABASE_URL_TEST is required when REQUIRE_DB_TESTS=1 — ' +
      'refusing to report success without running the database tests.',
  );
}

if (!testUrl) {
  console.warn('[integration] DATABASE_URL_TEST is not set — real-database tests skipped.');
}

export const databaseTestUrl: string | undefined = testUrl;
export const describeDb = testUrl ? describe : describe.skip;
