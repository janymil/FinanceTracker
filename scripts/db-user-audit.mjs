#!/usr/bin/env node
/**
 * Kaptia — read-only audit of user data in a PostgreSQL database.
 *
 * Usage:
 *   node scripts/db-user-audit.mjs                # uses DATABASE_URL from .env
 *   DATABASE_URL="postgres://..." node scripts/db-user-audit.mjs
 *
 * Prints every table that references "users" (directly or transitively),
 * row counts, and how many rows are tied to a user.
 */
import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: /neon\.tech|sslmode=require/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
});

const userTablesQuery = `
  SELECT c.conrelid::regclass::text AS table_name,
         EXISTS (
           SELECT 1 FROM pg_attribute a
           WHERE a.attrelid = c.conrelid AND a.attname = 'user_id' AND NOT a.attisdropped
         ) AS has_user_id
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.contype = 'f'
    AND c.confrelid = '"users"'::regclass
    AND n.nspname = 'public'
  ORDER BY 1;
`;

await client.connect();
const { rows: tables } = await client.query(userTablesQuery);
const { rows: userRows } = await client.query('SELECT COUNT(*)::int AS count FROM users');
console.log(`Total users: ${userRows[0].count}\n`);
console.log('Tables with FK -> users:');

for (const { table_name, has_user_id } of tables) {
  const ident = `"${table_name.replace(/"/g, '""')}"`;
  const { rows: total } = await client.query(`SELECT COUNT(*)::int AS count FROM ${ident}`);
  let orphan = '';
  if (has_user_id) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS count FROM ${ident} WHERE user_id IS NULL`,
    );
    orphan = `, user_id IS NULL: ${rows[0].count}`;
  }
  console.log(`  ${table_name.padEnd(34)} rows: ${String(total[0].count).padStart(5)}${orphan}`);
}

// Tables that look user-scoped but have no FK to users
const { rows: loose } = await client.query(`
  SELECT table_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'user_id'
  ORDER BY 1;
`);
const fkNames = new Set(tables.map((t) => t.table_name));
const notFk = loose.filter((r) => !fkNames.has(r.table_name));
if (notFk.length) {
  console.log('\nTables with user_id but no FK to users:');
  for (const { table_name } of notFk) {
    const ident = `"${table_name.replace(/"/g, '""')}"`;
    const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${ident}`);
    const { rows: nulls } = await client.query(
      `SELECT COUNT(*)::int AS count FROM ${ident} WHERE user_id IS NULL`,
    );
    console.log(`  ${table_name.padEnd(34)} rows: ${String(rows[0].count).padStart(5)}, user_id IS NULL: ${nulls[0].count}`);
  }
}

const { rows: allTables } = await client.query(`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
`);
console.log('\nAll public tables: ' + allTables.map((t) => t.tablename).join(', '));

await client.end();
