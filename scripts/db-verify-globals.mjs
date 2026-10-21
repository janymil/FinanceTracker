#!/usr/bin/env node
/**
 * Kaptia — verify that reference/global data survived the user cleanup.
 *
 * Prints the system categories (categories.user_id IS NULL) and the row counts of
 * every global table. Read-only.
 *
 * Usage:
 *   node scripts/db-verify-globals.mjs            # uses DATABASE_URL
 *   node scripts/db-verify-globals.mjs --prod     # uses DATABASE_URL_PROD
 */
import 'dotenv/config';
import pg from 'pg';

const prod = process.argv.includes('--prod');
const connectionString = prod ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL;
if (!connectionString) {
  console.error(prod ? 'DATABASE_URL_PROD is not set.' : 'DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: /neon\.tech|sslmode=require/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
});

await client.connect();
const url = new URL(connectionString);
console.log(`Database: ${url.hostname}${url.pathname}\n`);

const { rows: cats } = await client.query(
  `SELECT id, name, icon, color, type FROM categories WHERE user_id IS NULL ORDER BY id`,
);
console.log(`System categories (categories.user_id IS NULL): ${cats.length}`);
for (const c of cats) {
  console.log(`  ${String(c.id).padStart(3)}  ${c.name.padEnd(20)} ${c.type.padEnd(8)} ${c.icon.padEnd(18)} ${c.color}`);
}

const { rows: owned } = await client.query(
  `SELECT COUNT(*)::int AS n FROM categories WHERE user_id IS NOT NULL`,
);
console.log(`\nUser-owned categories left: ${owned[0].n}`);

const globals = ['ai_usage_limits', 'blocked_countries', 'merchant_patterns', 'redeem_codes'];
console.log('\nGlobal / reference tables:');
for (const table of globals) {
  const { rows: exists } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  if (!exists.length) {
    console.log(`  ${table.padEnd(20)} (not present)`);
    continue;
  }
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
  console.log(`  ${table.padEnd(20)} ${String(rows[0].n).padStart(6)}`);
}

console.log('\nUser data:');
for (const table of ['users', 'sessions']) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
  console.log(`  ${table.padEnd(20)} ${String(rows[0].n).padStart(6)}`);
}

await client.end();
