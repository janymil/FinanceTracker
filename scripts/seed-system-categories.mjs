#!/usr/bin/env node
/**
 * Kaptia — put the standard categories into a database that does not have them.
 *
 * `migrations/0005_seed_system_categories.sql` is the single source of truth and runs on every
 * `db:migrate`. This script is for the databases migrations will never touch again:
 *
 *   - production, which was seeded by hand years before this repository had migrations and is
 *     only ever stamped (`--baseline`), never replayed;
 *   - a restored copy that came back without the rows, before anyone points the app at it.
 *
 * It runs that same SQL file, which is idempotent, so it can be run twice without creating
 * duplicates. Read-only with `--dry-run`.
 *
 * Usage:
 *   node scripts/seed-system-categories.mjs             # DATABASE_URL
 *   node scripts/seed-system-categories.mjs --prod      # DATABASE_URL_PROD
 *   node scripts/seed-system-categories.mjs --url postgres://…
 *   node scripts/seed-system-categories.mjs --dry-run
 *
 * Exit codes: 0 = the three types are all present afterwards, 1 = something is still missing.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');
const prod = process.argv.includes('--prod');
const explicit = process.argv.indexOf('--url');
const connectionString = explicit !== -1
  ? process.argv[explicit + 1]
  : prod
    ? process.env.DATABASE_URL_PROD
    : process.env.DATABASE_URL;

if (!connectionString) {
  console.error(prod ? 'DATABASE_URL_PROD is not set.' : 'DATABASE_URL is not set.');
  process.exit(1);
}

const SQL_FILE = path.resolve(process.cwd(), 'migrations', '0005_seed_system_categories.sql');
if (!fs.existsSync(SQL_FILE)) {
  console.error(`Missing ${path.relative(process.cwd(), SQL_FILE)} — is this the repo root?`);
  process.exit(1);
}

// Drizzle's statement marker is a comment; pg does not need it.
const sql = fs
  .readFileSync(SQL_FILE, 'utf8')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('-->'))
  .join('\n');

const client = new pg.Client({
  connectionString,
  ssl: /neon\.tech|sslmode=require/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
});

const countsByType = async () => {
  const { rows } = await client.query(
    `SELECT type, COUNT(*)::int AS n
       FROM categories
      WHERE user_id IS NULL
      GROUP BY type
      ORDER BY type`,
  );
  return Object.fromEntries(rows.map((row) => [row.type, row.n]));
};

await client.connect();
const url = new URL(connectionString);
console.log(`Database: ${url.hostname}${url.pathname}`);
console.log(`Mode: ${dryRun ? 'dry run (nothing written)' : 'apply'}\n`);

const before = await countsByType();
console.log(`System categories before: ${Object.values(before).reduce((a, b) => a + b, 0)}`);
for (const [type, n] of Object.entries(before)) console.log(`  ${type.padEnd(8)} ${n}`);

if (dryRun) {
  console.log('\nDry run: no rows written. Re-run without --dry-run to apply.');
  await client.end();
  process.exit(0);
}

await client.query(sql);

const after = await countsByType();
console.log(`\nSystem categories after: ${Object.values(after).reduce((a, b) => a + b, 0)}`);
for (const [type, n] of Object.entries(after)) console.log(`  ${type.padEnd(8)} ${n}`);

await client.end();

// The goal rows are the ones whose absence blocks goal creation, so they are checked by name.
const missing = ['expense', 'income', 'goal'].filter((type) => !after[type]);
if (missing.length > 0) {
  console.error(`\nStill missing categories of type: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('\nEvery type is present. A goal can now be created.');
