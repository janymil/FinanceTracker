/**
 * Error Guard smoke test — proves the storage layer really works against your database.
 *
 * TypeScript cannot verify an ON CONFLICT statement, so this script inserts one problem,
 * reads it back, checks the counters, and deletes it again. It is safe to run any time:
 * it touches only rows whose title contains "Error Guard smoke test".
 *
 * Usage:
 *   npx tsx scripts/error-guard-smoke.ts            # verify (fails if tables are missing)
 *   npx tsx scripts/error-guard-smoke.ts --create   # create the 4 tables, then verify
 *
 * `--create` is idempotent and creates *only* the error-guard tables, so you can use it
 * without running an interactive `drizzle-kit push` against a drifted database.
 */
import 'dotenv/config';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../server/db.js';
import { errorEvents, errorGroups, errorRollups } from '@shared/schema';
import {
  enqueue,
  flush,
  getAggregatorStats,
  resetAggregatorForTests,
} from '../server/errorGuard/aggregator.js';
import { databaseSummary, listGroups } from '../server/errorGuard/store.js';

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS "error_groups" (
  "id" varchar(32) PRIMARY KEY NOT NULL,
  "kind" varchar(24) NOT NULL,
  "source" varchar(12) DEFAULT 'client' NOT NULL,
  "title" varchar(240) NOT NULL,
  "message" text NOT NULL,
  "route" varchar(200),
  "release" varchar(64),
  "platform" varchar(32),
  "severity" varchar(12) DEFAULT 'error' NOT NULL,
  "status" varchar(12) DEFAULT 'open' NOT NULL,
  "money_path" boolean DEFAULT false NOT NULL,
  "event_count" integer DEFAULT 0 NOT NULL,
  "session_count" integer DEFAULT 0 NOT NULL,
  "first_seen" timestamp DEFAULT now() NOT NULL,
  "last_seen" timestamp DEFAULT now() NOT NULL,
  "ai_status" varchar(16) DEFAULT 'pending' NOT NULL,
  "ai_analysis" jsonb,
  "ai_model" varchar(64),
  "ai_updated_at" timestamp
);
CREATE INDEX IF NOT EXISTS "IDX_error_groups_status" ON "error_groups" ("status","last_seen");
CREATE INDEX IF NOT EXISTS "IDX_error_groups_severity" ON "error_groups" ("severity");

CREATE TABLE IF NOT EXISTS "error_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" varchar(32) NOT NULL,
  "occurred_at" timestamp NOT NULL,
  "source" varchar(12) DEFAULT 'client' NOT NULL,
  "release" varchar(64),
  "route" varchar(200),
  "status" integer,
  "duration_ms" integer,
  "request_id" varchar(80),
  "message" text NOT NULL,
  "stack" text,
  "context" jsonb,
  "breadcrumbs" jsonb
);
CREATE INDEX IF NOT EXISTS "IDX_error_events_group" ON "error_events" ("group_id","occurred_at");

CREATE TABLE IF NOT EXISTS "error_rollups" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" varchar(32) NOT NULL,
  "bucket" timestamp NOT NULL,
  "count" integer DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_error_rollups_group_bucket" ON "error_rollups" ("group_id","bucket");

CREATE TABLE IF NOT EXISTS "job_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "job_name" varchar(64) NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp,
  "status" varchar(12) DEFAULT 'running' NOT NULL,
  "error_code" varchar(120),
  "duration_ms" integer
);
CREATE INDEX IF NOT EXISTS "IDX_job_runs_name_started" ON "job_runs" ("job_name","started_at");
`;

const results: Array<{ ok: boolean; label: string }> = [];

function check(ok: boolean, label: string): void {
  results.push({ ok, label });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}`);
}

async function tablesExist(): Promise<boolean> {
  try {
    await db.execute(sql`select 1 from ${errorGroups} limit 1`);
    return true;
  } catch {
    return false;
  }
}

function summarize(): void {
  const failed = results.filter((entry) => !entry.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
}

async function main(): Promise<void> {
  if (process.argv.includes('--create')) {
    console.log('Creating error-guard tables (idempotent)…');
    await db.execute(sql.raw(CREATE_TABLES_SQL));
  }

  if (!(await tablesExist())) {
    console.error(
      'error_groups is missing. Re-run with --create, or apply the DDL from drizzle-kit push.',
    );
    process.exit(1);
    return;
  }

  resetAggregatorForTests();
  const marker = `Error Guard smoke test ${Date.now()}`;

  console.log('\n1. Ingest three identical failures through the aggregator');
  for (let i = 0; i < 3; i++) {
    enqueue(
      [
        {
          kind: 'http',
          message: `${marker} — GET /api/expenses/${1000 + i} returned 500`,
          route: `/api/expenses/${1000 + i}`,
          method: 'GET',
          status: 500,
          source: 'server',
        },
      ],
      Date.now(),
    );
  }
  const buffered = getAggregatorStats();
  check(buffered.bufferedGroups === 1, `three failures collapsed into 1 group (got ${buffered.bufferedGroups})`);
  check(buffered.accepted === 3, `accepted counter is 3 (got ${buffered.accepted})`);

  console.log('\n2. Flush to the database (exercises the upserts)');
  await flush();
  const afterFlush = getAggregatorStats();
  check(
    afterFlush.flushFailures === 0,
    `flush succeeded (failures: ${afterFlush.flushFailures}, error: ${afterFlush.lastError ?? 'none'})`,
  );
  check(afterFlush.bufferedGroups === 0, 'buffer is empty after flush');

  console.log('\n3. Read it back');
  const groups = await listGroups('open', 200);
  const group = groups.find((entry) => entry.title.includes('Error Guard smoke test'));
  check(Boolean(group), 'the problem is visible to the admin list');
  if (!group) {
    summarize();
    return;
  }
  check(group.eventCount === 3, `event count is 3 (got ${group.eventCount})`);
  check(group.moneyPath, 'detected as touching money (route /api/expenses)');
  check(group.severity === 'critical', `severity escalated to critical (got ${group.severity})`);

  console.log('\n4. Counts and rollups');
  const summary = await databaseSummary();
  check(summary.openProblems >= 1, `open problems counted (${summary.openProblems})`);
  check(summary.eventsLast24h >= 3, `events in the last 24h counted from rollups (${summary.eventsLast24h})`);

  if (process.argv.includes('--ai')) {
    console.log('\n4b. AI explanation (one real call, costs ~$0.0002)');
    const { analyzeGroup, isTriageEnabled } = await import('../server/errorGuard/triage.js');
    if (!isTriageEnabled()) {
      console.log('  SKIP  no AI provider key configured, or ERROR_GUARD_AI=off');
    } else {
      const outcome = await analyzeGroup(group.id);
      check(outcome.ok, `analysis returned (${outcome.ok ? outcome.model : outcome.reason})`);
      const { getGroup } = await import('../server/errorGuard/store.js');
      const refreshed = await getGroup(group.id);
      const analysis = refreshed?.aiAnalysis ?? null;
      check(Boolean(analysis), 'analysis stored on the group');
      if (analysis) {
        check(analysis.confidence >= 0 && analysis.confidence <= 1, 'confidence is within 0..1');
        check(analysis.moneyRisk !== undefined, `money risk classified as "${analysis.moneyRisk}"`);
        console.log(`  Summary it wrote: ${analysis.plainSummary}`);
      }
    }
  }

  console.log('\n5. Clean up');
  await db.delete(errorEvents).where(eq(errorEvents.groupId, group.id));
  await db.delete(errorRollups).where(eq(errorRollups.groupId, group.id));
  await db.delete(errorGroups).where(eq(errorGroups.id, group.id));
  const remaining = await db.select().from(errorGroups).where(inArray(errorGroups.id, [group.id]));
  check(remaining.length === 0, 'smoke-test rows removed');

  summarize();
}

void main().catch((error) => {
  console.error('Smoke test crashed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
