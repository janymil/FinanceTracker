import { log } from './logger';
import 'dotenv/config';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

// Determine which database to use based on environment
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isProduction 
  ? process.env.DATABASE_URL_PROD 
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  const missingVar = isProduction ? 'DATABASE_URL_PROD' : 'DATABASE_URL';
  throw new Error(
    `${missingVar} must be set. Did you forget to provision a database?`,
  );
}

/**
 * Limits every connection this process opens, including the session store's own pool.
 *
 * Without a query timeout one slow report keeps its connection until Postgres gives up.
 * The pool only has ten of them, so ten slow queries took the whole app down — every screen
 * waited, and the health check that decides whether a deploy is healthy timed out too.
 * These settings turn "the app is stuck" into "that one request failed, try again".
 */
export const POOL_SETTINGS = {
  /** One Node process serves every request; ten sockets is plenty and keeps Neon happy. */
  max: 10,
  /** Waiting this long for a free connection is already a failure. Answer instead of hanging. */
  connectionTimeoutMillis: 10_000,
  /** Let an idle socket go instead of keeping it open until the network drops it. */
  idleTimeoutMillis: 30_000,
  /** Ceiling for a single statement. Raise DB_STATEMENT_TIMEOUT_MS if a bulk import hits it. */
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 30_000,
} as const;

/**
 * TLS settings for the database connection.
 *
 * Neon requires TLS, but its certificate chain is not verifiable from every host, so
 * verification is off by default — encryption without authentication. That means a party on
 * the network path could impersonate the database, so it must be switchable without a code
 * change: set `DB_TLS_VERIFY=1` once the host trusts the CA (Neon publishes the root cert) and
 * the connection is authenticated as well as encrypted.
 */
export const sslFor = (url: string) =>
  url.includes('neon.tech') ? { rejectUnauthorized: process.env.DB_TLS_VERIFY === '1' } : undefined;

// Initialize database connection based on environment
let pool: NeonPool | PgPool;
let db: ReturnType<typeof neonDrizzle> | ReturnType<typeof pgDrizzle>;

if (isProduction) {
  // Production: Use Neon with WebSocket for serverless
  neonConfig.webSocketConstructor = ws;
  
  const neonPool = new NeonPool({ 
    connectionString: databaseUrl,
    ssl: sslFor(databaseUrl),
    ...POOL_SETTINGS,
  });
  pool = neonPool;
  db = neonDrizzle(neonPool, { schema });
  
  log.info('✅ Connected to Neon production database');
} else {
  // Development: Use standard PostgreSQL connection with SSL support for Neon
  pool = new PgPool({ 
    connectionString: databaseUrl,
    ssl: sslFor(databaseUrl),
    ...POOL_SETTINGS,
  });
  db = pgDrizzle(pool, { schema });
  
  log.info('✅ Connected to Neon development database');
}

/**
 * Closes every socket this process holds. Called on SIGTERM/SIGINT so a reload or a stop
 * hands the connections back instead of leaving the database to time them out.
 */
export async function closePool(): Promise<void> {
  try {
    await pool.end();
  } catch (error: any) {
    log.warn('[db] pool did not close cleanly:', error?.message ?? error);
  }
}

/**
 * Puts a ceiling on every statement, including the ones the Neon driver would otherwise run
 * without one. The WebSocket driver accepts `statement_timeout` in its options but does not
 * apply it (checked against production: `current_setting` came back `0`), so each new
 * connection is told explicitly. node-postgres already honours the pool option; repeating it
 * here is harmless and keeps a single code path for both drivers.
 */
(pool as any).on('connect', (client: any) => {
  client
    .query(`SET statement_timeout = ${Number(POOL_SETTINGS.statement_timeout)}`)
    .catch((error: any) => log.warn('[db] could not set statement_timeout:', error?.message ?? error));
});

/**
 * A dropped idle socket must not take the process down.
 *
 * `pg` (and Neon's WebSocket pool) emit `error` on the pool when a client that is sitting
 * idle is terminated — a network blip, Neon closing an old connection, a host rebooting their
 * edge. With no listener, Node turns that into an `uncaughtException`, and
 * `server/index.ts` correctly exits on one; the app therefore restarted whenever the database
 * dropped an idle socket. Production showed exactly that once:
 *
 *     CRITICAL: Uncaught Exception: Connection terminated unexpectedly
 *       at @neondatabase/serverless/index.mjs:1250
 *
 * The socket is already gone and the pool will open a new one on the next query, so the right
 * answer is to log it and carry on. This does not hide real failures: a query that cannot get
 * a connection still rejects, and that error reaches its own handler.
 */
const onPoolError = (label: string) => (error: unknown) => {
  log.warn(
    `[db] ${label} reported a connection error; the pool will replace the socket:`,
    error instanceof Error ? error.message : String(error),
  );
};

(pool as any).on('error', onPoolError('main pool'));

export { pool, db };
