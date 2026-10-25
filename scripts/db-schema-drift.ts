#!/usr/bin/env node
/**
 * Kaptia — read-only comparison of `shared/schema.ts` against a real database.
 *
 * Answers one question before a deploy: "does the database have everything the code
 * expects?" A missing table or column is the failure this catches — it is invisible to
 * typecheck and to unit tests, and it only shows up as a 500 on the screen that uses it.
 *
 * Usage:
 *   npx tsx scripts/db-schema-drift.ts                 # DATABASE_URL (development)
 *   npx tsx scripts/db-schema-drift.ts --prod          # DATABASE_URL_PROD (production)
 *   npx tsx scripts/db-schema-drift.ts --url <url>     # an explicit database
 *
 *   npm run db:drift
 *   npm run db:drift:prod
 *
 * Exit codes: 0 = the database has everything the code expects; 1 = something is missing
 * (or the database could not be reached). Extra tables/columns are reported as notes and
 * do NOT fail: leftovers from a removed feature cannot break a query.
 *
 * Nothing is written: only SELECTs against information_schema.
 */
import 'dotenv/config';
import pg from 'pg';
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import * as schemaModule from '../shared/schema';

type Expected = Map<string, Map<string, { notNull: boolean; dataType: string }>>;

/** Coarse type families. Anything not listed here is not compared (no false alarms). */
const TYPE_FAMILIES: Record<string, string[]> = {
  string: ['text', 'varchar', 'bpchar', 'citext', 'uuid'],
  number: ['int2', 'int4', 'int8', 'numeric', 'float4', 'float8'],
  bigint: ['int8', 'numeric'],
  boolean: ['bool'],
  date: ['date', 'timestamp', 'timestamptz'],
  json: ['json', 'jsonb'],
  array: ['_text', '_varchar', '_int4', '_int8', '_numeric', '_bool', '_jsonb'],
};

function family(dataType: string): string | null {
  for (const [name, members] of Object.entries(TYPE_FAMILIES)) {
    if (members.includes(dataType)) return name;
  }
  return null;
}

function expectedFromSchema(): Expected {
  const expected: Expected = new Map();
  for (const value of Object.values(schemaModule)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value as PgTable);
    const columns = new Map<string, { notNull: boolean; dataType: string }>();
    for (const column of config.columns) {
      columns.set(column.name, { notNull: column.notNull, dataType: column.dataType });
    }
    expected.set(config.name, columns);
  }
  return expected;
}

function resolveUrl(): { label: string; url: string } {
  // `DB_DRIFT_LABEL` lets a caller that already knows the target (scripts/db-migrate.mjs)
  // pass the real name through, so the log cannot claim "development" while reading production.
  const labelOverride = process.env.DB_DRIFT_LABEL;
  const explicit = process.argv.indexOf('--url');
  if (explicit !== -1 && process.argv[explicit + 1]) {
    return { label: labelOverride ?? 'explicit --url', url: process.argv[explicit + 1] };
  }
  const prod = process.argv.includes('--prod');
  const name = prod ? 'DATABASE_URL_PROD' : 'DATABASE_URL';
  const url = process.env[name];
  if (!url) {
    console.error(`[db:drift] ${name} is not set.`);
    process.exit(1);
  }
  return { label: labelOverride ?? (prod ? 'production' : 'development'), url };
}


async function main() {
  const expected = expectedFromSchema();
  const { label, url } = resolveUrl();

  const client = new pg.Client({
    connectionString: url,
    ssl: /neon\.tech|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 20_000,
  });

  let actualTables: string[];
  let actualColumns: Array<{ table_name: string; column_name: string; is_nullable: string; udt_name: string }>;

  try {
    await client.connect();
    actualTables = (
      await client.query<{ table_name: string }>(
        `select table_name from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE'`,
      )
    ).rows.map((row) => row.table_name);
    actualColumns = (
      await client.query<{ table_name: string; column_name: string; is_nullable: string; udt_name: string }>(
        `select table_name, column_name, is_nullable, udt_name
           from information_schema.columns
          where table_schema = 'public'`,
      )
    ).rows;
  } catch (error: any) {
    console.error(`[db:drift] could not read ${label} database: ${error.message}`);
    await client.end().catch(() => undefined);
    process.exit(1);
  }

  await client.end().catch(() => undefined);

  const presentColumns = new Map<string, Map<string, { nullable: boolean; udt: string }>>();
  for (const row of actualColumns) {
    if (!presentColumns.has(row.table_name)) presentColumns.set(row.table_name, new Map());
    presentColumns.get(row.table_name)!.set(row.column_name, {
      nullable: row.is_nullable === 'YES',
      udt: row.udt_name,
    });
  }

  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  const typeMismatches: string[] = [];
  const nullMismatches: string[] = [];

  for (const [tableName, columns] of Array.from(expected)) {
    const actual = presentColumns.get(tableName);
    if (!actual) {
      missingTables.push(tableName);
      continue;
    }
    for (const [columnName, column] of Array.from(columns)) {
      const found = actual.get(columnName);
      if (!found) {
        missingColumns.push(`${tableName}.${columnName}`);
        continue;
      }
      const wantFamily = family(column.dataType);
      const gotFamily = family(found.udt);
      if (wantFamily && gotFamily && wantFamily !== gotFamily) {
        typeMismatches.push(`${tableName}.${columnName}: code says ${column.dataType}, database has ${found.udt}`);
      }
      // Code sends values for its own NOT NULL columns, so "database allows null" is harmless.
      // "Code allows null but the database does not" means an insert without that value fails.
      if (!column.notNull && !found.nullable) {
        nullMismatches.push(`${tableName}.${columnName}: code allows null, database is NOT NULL`);
      }
    }
  }

  const knownTables = new Set(expected.keys());
  const extraTables = actualTables.filter((table) => !knownTables.has(table)).sort();
  const extraColumns: string[] = [];
  for (const [tableName, columns] of Array.from(presentColumns)) {
    const known = expected.get(tableName);
    if (!known) continue;
    for (const columnName of Array.from(columns.keys())) {
      if (!known.has(columnName)) extraColumns.push(`${tableName}.${columnName}`);
    }
  }

  console.log(`[db:drift] ${label}: code expects ${expected.size} tables, database has ${actualTables.length}`);

  if (missingTables.length) {
    console.error(`[db:drift] MISSING TABLES (${missingTables.length}): ${missingTables.sort().join(', ')}`);
  }
  if (missingColumns.length) {
    console.error(`[db:drift] MISSING COLUMNS (${missingColumns.length}): ${missingColumns.sort().join(', ')}`);
  }
  if (typeMismatches.length) {
    console.warn(`[db:drift] TYPE MISMATCH (${typeMismatches.length}):`);
    for (const line of typeMismatches.slice(0, 20)) console.warn(`  - ${line}`);
  }
  if (nullMismatches.length) {
    console.warn(`[db:drift] NULLABILITY (${nullMismatches.length}):`);
    for (const line of nullMismatches.slice(0, 20)) console.warn(`  - ${line}`);
  }
  if (extraTables.length) {
    console.warn(`[db:drift] note — tables in the database that the code no longer declares: ${extraTables.join(', ')}`);
  }
  if (extraColumns.length) {
    const shown = extraColumns.sort().slice(0, 20);
    console.warn(
      `[db:drift] note — ${extraColumns.length} column(s) the code no longer declares: ${shown.join(', ')}${extraColumns.length > shown.length ? ', …' : ''}`,
    );
  }

  const blocking = missingTables.length + missingColumns.length;
  if (blocking > 0) {
    console.error('[db:drift] FAILED — the deployed code would query something this database does not have.');
    process.exit(1);
  }

  console.log('[db:drift] ok — every table and column the code expects is present.');
}

main().catch((error) => {
  console.error('[db:drift] unexpected failure:', error?.message ?? error);
  process.exit(1);
});
