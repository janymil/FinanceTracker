#!/usr/bin/env node
/**
 * Kaptia — print the foreign-key graph (public schema) for a PostgreSQL database.
 * Read-only. Used to plan a safe, dependency-ordered cleanup.
 *
 * Usage: node scripts/db-fk-graph.mjs
 */
import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
const client = new pg.Client({
  connectionString,
  ssl: /neon\.tech|sslmode=require/.test(connectionString || '')
    ? { rejectUnauthorized: false }
    : undefined,
});

await client.connect();

const { rows: fks } = await client.query(`
  SELECT
    child.relname  AS child_table,
    parent.relname AS parent_table,
    a.attname      AS child_column,
    pa.attname     AS parent_column,
    c.conname      AS constraint_name,
    c.confdeltype  AS on_delete
  FROM pg_constraint c
  JOIN pg_class child  ON child.oid  = c.conrelid
  JOIN pg_class parent ON parent.oid = c.confrelid
  JOIN pg_namespace n  ON n.oid = child.relnamespace
  JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum = ANY (c.conkey)
  JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = ANY (c.confkey)
  WHERE c.contype = 'f' AND n.nspname = 'public'
  ORDER BY child.relname, parent.relname, a.attname;
`);

console.log('Foreign keys (public schema):');
for (const fk of fks) {
  console.log(
    `  ${fk.child_table}.${fk.child_column} -> ${fk.parent_table}.${fk.parent_column}` +
      `  [${fk.constraint_name}, ON DELETE ${fk.on_delete}]`,
  );
}

const flagged = ['redeem_codes', 'sessions', 'merchant_patterns', 'ai_usage_limits', 'friendships', 'collaborative_goals'];
for (const table of flagged) {
  const { rows: cols } = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  console.log(`\n${table}: ` + cols.map((c) => `${c.column_name}:${c.data_type}${c.is_nullable === 'YES' ? '?' : ''}`).join(', '));
}

await client.end();
