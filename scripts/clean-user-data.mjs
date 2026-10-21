#!/usr/bin/env node
/**
 * Kaptia — erase all user data from a PostgreSQL database.
 *
 * Deletes every row that belongs to a user (directly or transitively), all
 * existing sessions, and finally the users themselves. Global/reference data is
 * preserved:
 *   - categories with user_id IS NULL (system defaults)
 *   - redeem_codes that were never redeemed
 *   - blocked_countries, ai_usage_limits, merchant_patterns (global)
 *
 * Redeemed AppSumo codes are released (redeemed=false, user_id=NULL) instead of
 * being deleted, so the inventory stays consistent.
 *
 * Usage:
 *   node scripts/clean-user-data.mjs                     # dry run on DATABASE_URL
 *   node scripts/clean-user-data.mjs --confirm           # execute
 *   node scripts/clean-user-data.mjs --url "postgres://..." [--confirm]
 *   node scripts/clean-user-data.mjs --confirm --no-backup
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const noBackup = args.includes('--no-backup');
const prod = args.includes('--prod');
const urlFlagIndex = args.indexOf('--url');
const connectionString =
  urlFlagIndex !== -1
    ? args[urlFlagIndex + 1]
    : prod
      ? process.env.DATABASE_URL_PROD
      : process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    prod
      ? 'DATABASE_URL_PROD is not set. Put the production Neon connection string in .env first.'
      : 'No database URL. Set DATABASE_URL or pass --url "postgres://..."',
  );
  process.exit(1);
}

// Tables whose rows are 100% user-owned. Children first, users last.
const PURGE_TABLES = [
  'goal_messages',
  'goal_contributions',
  'challenge_activities',
  'milestone_achievements',
  'collaborative_goal_participants',
  'collaborative_goals',
  'friendships',
  'transactions',
  'merchant_learning',
  'budgets',
  'expense_reminders',
  'recurring_transactions',
  'goals',
  'payment_failures',
  'ai_cache',
  'ai_usage',
  'ai_user_overrides',
  'backup_settings',
  'course_progress',
  'user_achievements',
  'learning_stats',
  'financial_mascots',
  'import_logs',
];

function makeClient(url) {
  return new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 15000,
    ssl: /neon\.tech|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
}

const client = makeClient(connectionString);

function redact(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username}@${u.hostname}${u.pathname}`;
  } catch {
    return '<unparseable url>';
  }
}

async function tableExists(name) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [name],
  );
  return rows.length > 0;
}

async function count(table, where = '') {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS c FROM "${table}" ${where}`);
  return rows[0].c;
}

await client.connect();
console.log(`Database: ${redact(connectionString)}`);
console.log(`Mode    : ${confirm ? 'EXECUTE (destructive)' : 'DRY RUN (no changes)'}\n`);

const present = [];
for (const table of [...PURGE_TABLES, 'categories', 'redeem_codes', 'sessions', 'users']) {
  if (await tableExists(table)) present.push(table);
}
const missing = PURGE_TABLES.filter((t) => !present.includes(t));

const before = {};
for (const table of present) before[table] = await count(table);
before['categories(global)'] = await count('categories', 'WHERE user_id IS NULL');
before['categories(user)'] = await count('categories', 'WHERE user_id IS NOT NULL');
before['redeem_codes(unused)'] = await count('redeem_codes', 'WHERE user_id IS NULL');
before['redeem_codes(used)'] = await count('redeem_codes', 'WHERE user_id IS NOT NULL');

console.log('Current state:');
for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(26)} ${String(v).padStart(6)}`);
if (missing.length) console.log(`  (skipped, not present: ${missing.join(', ')})`);

const userTableTotal = present
  .filter((t) => t !== 'users' && t !== 'sessions')
  .reduce((sum, t) => sum + (before[t] || 0), 0);

if (!confirm) {
  console.log(`\nWould delete ${before.users} users and clear user data in ${present.length - 1} tables.`);
  console.log('Re-run with --confirm to execute.');
  await client.end();
  process.exit(0);
}

// ---- Backup ---------------------------------------------------------------
if (!noBackup) {
  const dir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `user-data-backup-${stamp}.json`);
  console.log(`\nBacking up rows to ${path.relative(process.cwd(), file)} ...`);

  const dump = {};
  for (const table of [...PURGE_TABLES, 'users', 'sessions'].filter((t) => present.includes(t))) {
    const { rows } = await client.query(
      `SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM "${table}" t`,
    );
    dump[table] = rows[0].data;
  }
  const { rows: cats } = await client.query(
    `SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM categories t WHERE user_id IS NOT NULL`,
  );
  dump['categories(owned)'] = cats[0].data;
  const { rows: codes } = await client.query(
    `SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM redeem_codes t WHERE user_id IS NOT NULL`,
  );
  dump['redeem_codes(used)'] = codes[0].data;

  fs.writeFileSync(
    file,
    JSON.stringify(
      { createdAt: new Date().toISOString(), database: redact(connectionString), tables: dump },
      null,
      2,
    ),
  );
  console.log(`Backup written (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
}

// ---- Delete (single transaction) -----------------------------------------
const trx = makeClient(connectionString);
await trx.connect();
const deleted = {};

try {
  await trx.query('BEGIN');

  // Release redeemed codes that point at users we are about to delete.
  const released = await trx.query(
    `UPDATE redeem_codes SET redeemed = false, user_id = NULL, redeemed_at = NULL WHERE user_id IS NOT NULL`,
  );
  deleted['redeem_codes(reset)'] = released.rowCount;

  for (const table of PURGE_TABLES) {
    if (!present.includes(table)) continue;
    const res = await trx.query(`DELETE FROM "${table}"`);
    deleted[table] = res.rowCount;
  }

  const ownedCats = await trx.query(`DELETE FROM categories WHERE user_id IS NOT NULL`);
  deleted['categories(owned)'] = ownedCats.rowCount;

  const sessions = await trx.query('DELETE FROM sessions');
  deleted['sessions'] = sessions.rowCount;

  const users = await trx.query('DELETE FROM users');
  deleted['users'] = users.rowCount;

  // Fresh serial ids for the fully purged tables.
  for (const table of PURGE_TABLES) {
    if (!present.includes(table)) continue;
    const { rows } = await trx.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [
      `public.${table}`,
    ]);
    if (rows[0]?.seq) await trx.query('SELECT setval($1, 1, false)', [rows[0].seq]);
  }

  await trx.query('COMMIT');
} catch (err) {
  await trx.query('ROLLBACK');
  console.error('\n❌ Cleanup failed, transaction rolled back. No data was changed.');
  console.error(err);
  await trx.end();
  await client.end();
  process.exit(1);
}
await trx.end();

console.log('\nDeleted rows:');
for (const [k, v] of Object.entries(deleted)) {
  if (v) console.log(`  ${k.padEnd(32)} ${String(v).padStart(6)}`);
}

// ---- Verify ---------------------------------------------------------------
const after = {};
for (const table of present) after[table] = await count(table);
after['categories(global)'] = await count('categories', 'WHERE user_id IS NULL');

console.log('\nAfter cleanup:');
for (const [k, v] of Object.entries(after)) console.log(`  ${k.padEnd(26)} ${String(v).padStart(6)}`);

const leftover = present.filter(
  (t) => t !== 'categories' && t !== 'redeem_codes' && after[t] !== 0,
);
const ok =
  after.users === 0 &&
  after['categories(global)'] === before['categories(global)'] &&
  leftover.length === 0;

console.log(
  `\nCleared ${userTableTotal} user-owned rows; ${before['redeem_codes(unused)']} unused redeem codes and ` +
    `${after['categories(global)']} global categories preserved.`,
);
console.log(
  ok
    ? '✅ Cleanup verified: database contains no user data.'
    : `❌ Leftover rows in: ${leftover.join(', ')}`,
);

await client.end();
process.exit(ok ? 0 : 1);

