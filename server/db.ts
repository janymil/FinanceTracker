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
 * TLS settings for the database connection. Verification stays off for Neon endpoints exactly
 * as it was before this file got pool limits: turning it on can stop the app from booting, so
 * it belongs in its own change with a deploy and a rollback plan.
 */
export const sslFor = (url: string) =>
  url.includes('neon.tech') ? { rejectUnauthorized: false } : undefined;

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

export { pool, db };
