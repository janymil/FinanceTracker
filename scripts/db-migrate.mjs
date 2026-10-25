#!/usr/bin/env node
/**
 * Kaptia — apply the reviewed SQL files in `migrations/` in order, or stamp a database
 * that was built before this system existed.
 *
 *   node scripts/db-migrate.mjs                 # development (DATABASE_URL)
 *   node scripts/db-migrate.mjs --prod          # production (DATABASE_URL_PROD)
 *   node scripts/db-migrate.mjs --url <url>     # an explicit database (CI)
 *   node scripts/db-migrate.mjs --baseline --prod
 *
 *   npm run db:migrate
 *   npm run db:migrate:prod
 *   npm run db:baseline:prod
 *
 * Normal mode applies every migration the database has not recorded yet, using Drizzle's
 * own migrator, so the bookkeeping table (`drizzle.__drizzle_migrations`) is exactly what
 * `drizzle-kit` expects.
 *
 * `--baseline` writes NO schema. It is for a database that already matches the code (this
 * repository's production database, when the baseline was introduced). It refuses to stamp
 * unless `scripts/db-schema-drift.ts` reports that the database really has everything the
 * code expects — so a half-migrated database can never be marked "up to date".
 */
import { config } from 'dotenv';
config({ path: '.env' });
if (!process.env.DATABASE_URL_TEST) {
  config({ path: '.env.test', override: true });
}
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'migrations');
const JOURNAL = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');
const SCHEMA = 'drizzle';
const TABLE = '__drizzle_migrations';

function resolveUrl() {
  const explicit = process.argv.indexOf('--url');
  if (explicit !== -1 && process.argv[explicit + 1]) {
    return { label: 'explicit --url', url: process.argv[explicit + 1] };
  }
  const prod = process.argv.includes('--prod');
  const test = process.argv.includes('--test');
  const name = prod ? 'DATABASE_URL_PROD' : test ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
  const url = process.env[name];
  if (!url) {
    console.error(`[db:migrate] ${name} is not set.`);
    process.exit(1);
  }
  return { label: prod ? 'production' : test ? 'test' : 'development', url };
}

function journalEntries() {
  if (!fs.existsSync(JOURNAL)) {
    console.error(`[db:migrate] no ${path.relative(process.cwd(), JOURNAL)} — is this the repo root?`);
    process.exit(1);
  }
  const journal = JSON.parse(fs.readFileSync(JOURNAL, 'utf8'));
  return journal.entries ?? [];
}

function hashOf(tag) {
  const file = path.join(MIGRATIONS_FOLDER, `${tag}.sql`);
  if (!fs.existsSync(file)) {
    console.error(`[db:migrate] journal lists ${tag} but ${path.relative(process.cwd(), file)} is missing.`);
    process.exit(1);
  }
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function makeClient(url) {
  return new pg.Client({
    connectionString: url,
    ssl: /neon\.tech|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 120_000,
  });
}

/** Runs the read-only drift check against this exact database. Throws when it fails. */
function assertDatabaseMatchesCode(url, label) {
  console.log(`[db:migrate] checking ${label} against shared/schema.ts before stamping…`);
  try {
    execFileSync('npx', ['tsx', 'scripts/db-schema-drift.ts'], {
      stdio: 'inherit',
      // The URL travels through the environment, never as an argument, so it cannot show up
      // in `ps` for another user on the machine.
      env: { ...process.env, DATABASE_URL: url, DB_DRIFT_LABEL: label },
    });
  } catch {
    console.error('[db:migrate] refusing to stamp: the database does not match the code.');
    process.exit(1);
  }
}

async function baseline(url, label) {
  const entries = journalEntries();
  const last = entries[entries.length - 1];
  if (!last) {
    console.error('[db:migrate] the journal is empty — nothing to stamp.');
    process.exit(1);
  }

  assertDatabaseMatchesCode(url, label);

  const client = makeClient(url);
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.${TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
  );
  const existing = await client.query(
    `select hash, created_at from ${SCHEMA}.${TABLE} order by created_at desc limit 1`,
  );
  const already = existing.rows[0];
  if (already && Number(already.created_at) >= last.when) {
    await client.end();
    console.log(`[db:migrate] ${label} is already stamped at ${last.tag} — nothing to do.`);
    return;
  }
  await client.query(`insert into ${SCHEMA}.${TABLE} (hash, created_at) values ($1, $2)`, [
    hashOf(last.tag),
    last.when,
  ]);
  await client.end();
  console.log(`[db:migrate] ${label} stamped as already at ${last.tag} (no schema was changed).`);
}

async function applyPending(url, label) {
  const client = makeClient(url);
  await client.connect();
  const db = drizzle(client);
  const countRecorded = async () =>
    (await client.query(`select count(*)::int as n from ${SCHEMA}.${TABLE}`).catch(() => ({ rows: [{ n: 0 }] })))
      .rows[0].n;
  const before = await countRecorded();
  console.log(`[db:migrate] applying pending migrations to ${label}…`);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const after = await countRecorded();
  await client.end();
  const applied = after - before;
  console.log(
    applied === 0
      ? `[db:migrate] ${label} was already up to date — ${after} migration(s) recorded.`
      : `[db:migrate] done — ${applied} new migration(s) applied to ${label}; ${after} recorded in total.`,
  );
}

const { label, url } = resolveUrl();
try {
  if (process.argv.includes('--baseline')) await baseline(url, label);
  else await applyPending(url, label);
} catch (error) {
  console.error(`[db:migrate] failed: ${error?.message ?? error}`);
  process.exit(1);
}
