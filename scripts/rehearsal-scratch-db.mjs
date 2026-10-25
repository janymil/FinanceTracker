#!/usr/bin/env node
/**
 * Scratch database for the sandbox rehearsal (docs/stripe-sandbox-rehearsal.md).
 *
 *   export DATABASE_URL="$(node scripts/rehearsal-scratch-db.mjs)"
 *   node scripts/db-migrate.mjs --url "$DATABASE_URL"
 *   REHEARSAL_DROP=1 node scripts/rehearsal-scratch-db.mjs    # when the rehearsal is over
 *
 * Creates (or reuses) one empty database on the same server as DATABASE_URL_PROD and prints
 * its connection string, so a sandbox rehearsal can never write to real customer rows. The
 * only statement it runs against the real server is `CREATE DATABASE` / `DROP DATABASE` for
 * `REHEARSAL_DB_NAME` (default `kaptia_rehearsal`). Never prints credentials.
 */
import { config } from 'dotenv';
config({ path: '.env' });
import pg from 'pg';

const base = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
if (!base) {
  console.error('no database url');
  process.exit(1);
}

const name = process.env.REHEARSAL_DB_NAME || 'kaptia_rehearsal';
const url = new URL(base);
url.pathname = `/${name}`;

const client = new pg.Client({ connectionString: base });
await client.connect();

if (process.env.REHEARSAL_DROP === '1') {
  // A rehearsal server may have left pooled connections open; they would block the drop.
  await client.query(
    `select pg_terminate_backend(pid) from pg_stat_activity
      where datname = $1 and pid <> pg_backend_pid()`,
    [name],
  );
  await client.query(`drop database if exists ${name}`);
  console.error(`dropped ${name}`);
  await client.end();
  process.exit(0);
}

const existing = await client.query('select 1 from pg_database where datname = $1', [name]);
if (existing.rowCount === 0) {
  await client.query(`create database ${name}`);
  console.error(`created ${name}`);
} else {
  console.error(`reusing ${name}`);
}
await client.end();
process.stdout.write(url.toString());
