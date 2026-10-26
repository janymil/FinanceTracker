/**
 * What the process itself is doing, for the admin screen and for "why is it slow?".
 *
 * The app already answers "is it up" (`/api/health`) and "what went wrong" (Error Guard). The gap
 * was between those two: how long requests wait on the database, whether the event loop is
 * blocked, and how much memory the process holds — the three things that turn a healthy-looking
 * deployment into a slow one.
 */
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { pool } from './db.js';
import { log } from './logger.js';
import { databaseSummary, listJobRuns } from './errorGuard/store.js';
import { RELEASE_ID, PROCESS_STARTED_AT } from './release.js';

/** Sampling starts once, when this module is first imported. */
const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();

export interface RuntimeSnapshot {
  release: string;
  startedAt: string;
  uptimeSeconds: number;
  process: {
    node: string;
    pid: number;
    memoryMb: { rss: number; heapUsed: number; heapTotal: number; external: number };
    eventLoop: { meanMs: number; p99Ms: number; maxMs: number };
  };
  database: {
    total: number;
    idle: number;
    waiting: number;
    max: number;
  };
  jobs: {
    total: number;
    stale: string[];
  };
  errors: {
    openProblems: number;
    moneyProblems: number;
    eventsLast24h: number;
    lastEventAt: string | null;
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

export async function runtimeSnapshot(): Promise<RuntimeSnapshot> {
  // `pg` exposes these on any pool; the Neon pool wraps it. Missing counters read as 0 rather
  // than failing the whole snapshot.
  const anyPool = pool as unknown as {
    totalCount?: number;
    idleCount?: number;
    waitingCount?: number;
    options?: { max?: number };
  };

  let jobs: { total: number; stale: string[] } = { total: 0, stale: [] };
  let errors = { openProblems: 0, moneyProblems: 0, eventsLast24h: 0, lastEventAt: null as string | null };
  try {
    const runs = await listJobRuns();
    jobs = { total: runs.length, stale: runs.filter((run) => run.stale).map((run) => run.jobName) };
    const summary = await databaseSummary();
    errors = {
      openProblems: summary.openProblems,
      moneyProblems: summary.moneyProblems,
      eventsLast24h: summary.eventsLast24h,
      lastEventAt: summary.lastEventAt,
    };
  } catch (error) {
    // A metrics read must never take the endpoint down with it.
    log.warn('[runtime] could not read job or error state:', error instanceof Error ? error.message : error);
  }

  const memory = process.memoryUsage();

  return {
    release: RELEASE_ID,
    startedAt: PROCESS_STARTED_AT,
    uptimeSeconds: Math.round(process.uptime()),
    process: {
      node: process.version,
      pid: process.pid,
      memoryMb: {
        rss: Math.round(memory.rss / 1_048_576),
        heapUsed: Math.round(memory.heapUsed / 1_048_576),
        heapTotal: Math.round(memory.heapTotal / 1_048_576),
        external: Math.round(memory.external / 1_048_576),
      },
      eventLoop: {
        meanMs: round(loopDelay.mean / 1e6),
        p99Ms: round(loopDelay.percentile(99) / 1e6),
        maxMs: round(loopDelay.max / 1e6),
      },
    },
    database: {
      total: anyPool.totalCount ?? 0,
      idle: anyPool.idleCount ?? 0,
      waiting: anyPool.waitingCount ?? 0,
      max: anyPool.options?.max ?? 0,
    },
    jobs,
    errors,
  };
}
