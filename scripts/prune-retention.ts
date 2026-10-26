#!/usr/bin/env node
/**
 * Retention that is a mechanism, not a paragraph.
 *
 * The public privacy policy states how long each kind of record is kept. Until this existed, only
 * error evidence was actually deleted (`scripts/error-guard-prune.ts`); AI usage, the AI cache,
 * finished job records and expired sessions grew without limit, so the policy described an
 * intention rather than what happened.
 *
 * Windows, matching the published table:
 *   ai_usage      400 days   a year of cost reporting plus the month in progress
 *   ai_cache       90 days   and anything already past its own expiry, whatever its age
 *   job_runs       90 days   "did the cron run" needs weeks, not quarters
 *   sessions        1 day    rows past their expiry; the cookie is already dead
 *
 * Usage:
 *   npm run prune:retention                 # delete
 *   npm run prune:retention -- --dry-run    # count only
 *   npm run prune:retention -- --ai-usage-days=200
 *
 * Exit codes: 0 = done, 1 = a failure, 2 = bad usage.
 */
import 'dotenv/config';
import { and, isNotNull, lt, sql } from 'drizzle-orm';
import { db } from '../server/db.js';
import { aiCache, aiUsage, jobRuns, sessions } from '../shared/schema.js';

export interface RetentionWindows {
  aiUsageDays: number;
  aiCacheDays: number;
  jobRunDays: number;
  sessionDays: number;
}

export const DEFAULT_WINDOWS: RetentionWindows = {
  aiUsageDays: 400,
  aiCacheDays: 90,
  jobRunDays: 90,
  sessionDays: 1,
};

function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function parseWindows(argv: string[]): RetentionWindows | { error: string } {
  const windows = { ...DEFAULT_WINDOWS };
  for (const arg of argv) {
    const match = /^--(ai-usage|ai-cache|job-run|session)-days=(-?\d+(?:\.\d+)?)$/.exec(arg);
    if (!match) continue;
    const value = Number(match[2]);
    if (!Number.isFinite(value) || value < 1) return { error: `invalid window: ${arg}` };
    if (match[1] === 'ai-usage') windows.aiUsageDays = value;
    if (match[1] === 'ai-cache') windows.aiCacheDays = value;
    if (match[1] === 'job-run') windows.jobRunDays = value;
    if (match[1] === 'session') windows.sessionDays = value;
  }
  return windows;
}

async function countThenDelete(
  dryRun: boolean,
  countQuery: Promise<Array<{ n: number }>>,
  deleteRun: () => Promise<unknown>,
): Promise<number> {
  const [row] = await countQuery;
  const count = Number(row?.n ?? 0);
  if (dryRun || count === 0) return count;
  await deleteRun();
  return count;
}

/** One pass. Every count is what *would* be deleted when `dryRun` is set. */
export async function pruneRetention(
  windows: RetentionWindows = DEFAULT_WINDOWS,
  options: { dryRun?: boolean; now?: Date } = {},
): Promise<Record<string, number>> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;

  const usageCutoff = daysAgo(windows.aiUsageDays, now);
  const cacheCutoff = daysAgo(windows.aiCacheDays, now);
  const jobCutoff = daysAgo(windows.jobRunDays, now);
  const sessionCutoff = daysAgo(windows.sessionDays, now);

  // An AI cache row is dead when its own expiry has passed, whatever its age: the window is a
  // backstop for rows that were written without one.
  const cacheIsDead = sql`((${aiCache.expiresAt} is not null and ${aiCache.expiresAt} < now()) or ${aiCache.createdAt} < ${cacheCutoff})`;

  return {
    ai_usage: await countThenDelete(
      dryRun,
      db.select({ n: sql<number>`count(*)::int` }).from(aiUsage).where(lt(aiUsage.createdAt, usageCutoff)),
      () => db.delete(aiUsage).where(lt(aiUsage.createdAt, usageCutoff)),
    ),
    ai_cache: await countThenDelete(
      dryRun,
      db.select({ n: sql<number>`count(*)::int` }).from(aiCache).where(cacheIsDead),
      () => db.delete(aiCache).where(cacheIsDead),
    ),
    job_runs: await countThenDelete(
      dryRun,
      db.select({ n: sql<number>`count(*)::int` }).from(jobRuns).where(lt(jobRuns.startedAt, jobCutoff)),
      () => db.delete(jobRuns).where(lt(jobRuns.startedAt, jobCutoff)),
    ),
    sessions: await countThenDelete(
      dryRun,
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(sessions)
        .where(and(isNotNull(sessions.expire), lt(sessions.expire, sessionCutoff))),
      () => db.delete(sessions).where(and(isNotNull(sessions.expire), lt(sessions.expire, sessionCutoff))),
    ),
  };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const unknown = argv.filter(
    (arg) =>
      arg !== '--dry-run' &&
      !/^--(ai-usage|ai-cache|job-run|session)-days=/.test(arg),
  );
  if (unknown.length > 0) {
    console.error(`[prune:retention] unknown argument(s): ${unknown.join(' ')}`);
    return 2;
  }
  const windows = parseWindows(argv);
  if ('error' in windows) {
    console.error(`[prune:retention] ${windows.error}`);
    return 2;
  }

  const result = await pruneRetention(windows, { dryRun });
  const verb = dryRun ? 'would delete' : 'deleted';
  for (const [table, count] of Object.entries(result)) {
    console.log(`[prune:retention] ${verb} ${count} row(s) from ${table}`);
  }
  return 0;
}

if (process.argv[1] && /prune-retention/.test(process.argv[1])) {
  void main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('[prune:retention] failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

