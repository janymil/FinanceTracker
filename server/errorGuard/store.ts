/**
 * Error Guard storage.
 *
 * Deliberately dumb: every function is one short query or one upsert, because this code
 * runs on the path that reports failures in the first place. If it starts doing joins or
 * transactions, a sick database becomes a sick error reporter.
 */
import { desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { errorEvents, errorGroups, errorRollups, jobRuns } from '@shared/schema';
import type {
  GuardAnalysis,
  GuardEvent,
  GuardGroup,
  GuardJobRun,
  GuardSeverity,
  GuardStatus,
} from '@shared/errorGuard/types';

/** What the aggregator hands to the writer. Already fingerprinted and scrubbed. */
export interface GroupSnapshot {
  id: string;
  kind: string;
  source: string;
  title: string;
  message: string;
  route: string | null;
  release: string | null;
  platform: string | null;
  severity: GuardSeverity;
  moneyPath: boolean;
  count: number;
  sessionCount: number;
  firstSeen: Date;
  lastSeen: Date;
  samples: GuardEvent[];
}

/** Hourly bucket, so a storm turns into one row per hour instead of thousands. */
export function hourBucket(at: Date): Date {
  const ms = 3_600_000;
  return new Date(Math.floor(at.getTime() / ms) * ms);
}

function toGroup(row: typeof errorGroups.$inferSelect): GuardGroup {
  return {
    id: row.id,
    kind: row.kind as GuardGroup['kind'],
    source: row.source as GuardGroup['source'],
    title: row.title,
    message: row.message,
    route: row.route,
    release: row.release,
    severity: row.severity as GuardSeverity,
    status: row.status as GuardStatus,
    moneyPath: row.moneyPath,
    eventCount: row.eventCount,
    sessionCount: row.sessionCount,
    firstSeen: row.firstSeen.toISOString(),
    lastSeen: row.lastSeen.toISOString(),
    aiStatus: row.aiStatus as GuardGroup['aiStatus'],
    aiAnalysis: (row.aiAnalysis as GuardAnalysis | null) ?? null,
    aiModel: row.aiModel,
    aiUpdatedAt: row.aiUpdatedAt ? row.aiUpdatedAt.toISOString() : null,
  };
}

/** Two samples per flush per group: enough to read a stack, not enough to fill a disk. */
const MAX_SAMPLES_PER_FLUSH = 2;

/**
 * Write one buffered batch. Sequential on purpose — no transaction, because a partial
 * write of a *diagnostic* is acceptable and a stuck transaction is not.
 */
export async function writeBatch(groups: GroupSnapshot[]): Promise<void> {
  for (const snapshot of groups) {
    if (snapshot.count <= 0) continue;

    await db
      .insert(errorGroups)
      .values({
        id: snapshot.id,
        kind: snapshot.kind,
        source: snapshot.source,
        title: snapshot.title,
        message: snapshot.message,
        route: snapshot.route,
        release: snapshot.release,
        platform: snapshot.platform,
        severity: snapshot.severity,
        moneyPath: snapshot.moneyPath,
        eventCount: snapshot.count,
        sessionCount: snapshot.sessionCount,
        firstSeen: snapshot.firstSeen,
        lastSeen: snapshot.lastSeen,
      })
      .onConflictDoUpdate({
        target: errorGroups.id,
        set: {
          eventCount: sql`${errorGroups.eventCount} + ${snapshot.count}`,
          sessionCount: sql`${errorGroups.sessionCount} + ${snapshot.sessionCount}`,
          firstSeen: sql`least(${errorGroups.firstSeen}, ${snapshot.firstSeen})`,
          lastSeen: sql`greatest(${errorGroups.lastSeen}, ${snapshot.lastSeen})`,
          // Never downgrade a critical problem because a later batch was quieter.
          severity: sql`case when ${errorGroups.severity} = 'critical' then 'critical' else ${snapshot.severity} end`,
          // A resolved problem that happens again is open again; an ignored one stays ignored.
          status: sql`case when ${errorGroups.status} = 'resolved' then 'open' else ${errorGroups.status} end`,
          moneyPath: sql`${errorGroups.moneyPath} or ${snapshot.moneyPath}`,
          route: sql`coalesce(${errorGroups.route}, ${snapshot.route})`,
          release: sql`coalesce(${errorGroups.release}, ${snapshot.release})`,
        },
      });

    await db
      .insert(errorRollups)
      .values({
        groupId: snapshot.id,
        bucket: hourBucket(snapshot.lastSeen),
        count: snapshot.count,
      })
      .onConflictDoUpdate({
        target: [errorRollups.groupId, errorRollups.bucket],
        set: { count: sql`${errorRollups.count} + ${snapshot.count}` },
      });

    const samples = snapshot.samples.slice(0, MAX_SAMPLES_PER_FLUSH);
    if (samples.length > 0) {
      await db.insert(errorEvents).values(
        samples.map((sample) => ({
          groupId: snapshot.id,
          occurredAt: sample.occurredAt ? new Date(sample.occurredAt) : snapshot.lastSeen,
          source: sample.source ?? snapshot.source,
          release: sample.release ?? snapshot.release,
          route: sample.route ?? snapshot.route,
          status: sample.status ?? null,
          durationMs: sample.durationMs ?? null,
          requestId: sample.requestId ?? null,
          message: sample.message,
          stack: sample.stack ?? null,
          context: sample.context ?? null,
          breadcrumbs: sample.breadcrumbs ?? null,
        })),
      );
    }
  }
}

/** Worst first, newest second — the order the admin panel shows by default. */
export async function listGroups(status: GuardStatus = 'open', limit = 50): Promise<GuardGroup[]> {
  const rows = await db
    .select()
    .from(errorGroups)
    .where(eq(errorGroups.status, status))
    .orderBy(
      sql`case ${errorGroups.severity} when 'critical' then 0 when 'error' then 1 when 'warning' then 2 else 3 end`,
      desc(errorGroups.lastSeen),
    )
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map(toGroup);
}

export async function getGroup(id: string): Promise<GuardGroup | null> {
  const rows = await db.select().from(errorGroups).where(eq(errorGroups.id, id)).limit(1);
  return rows.length > 0 ? toGroup(rows[0]) : null;
}

export interface GuardSample {
  id: number;
  occurredAt: string;
  source: string;
  release: string | null;
  route: string | null;
  status: number | null;
  durationMs: number | null;
  requestId: string | null;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  breadcrumbs: unknown;
}

export async function getSamples(groupId: string, limit = 10): Promise<GuardSample[]> {
  const rows = await db
    .select()
    .from(errorEvents)
    .where(eq(errorEvents.groupId, groupId))
    .orderBy(desc(errorEvents.occurredAt))
    .limit(Math.min(Math.max(limit, 1), 50));

  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    source: row.source,
    release: row.release,
    route: row.route,
    status: row.status,
    durationMs: row.durationMs,
    requestId: row.requestId,
    message: row.message,
    stack: row.stack,
    context: (row.context as Record<string, unknown> | null) ?? null,
    breadcrumbs: row.breadcrumbs ?? null,
  }));
}

export async function setStatus(id: string, status: GuardStatus): Promise<boolean> {
  const updated = await db
    .update(errorGroups)
    .set({ status })
    .where(eq(errorGroups.id, id))
    .returning({ id: errorGroups.id });
  return updated.length > 0;
}

export async function setAIStatus(id: string, aiStatus: string): Promise<void> {
  await db.update(errorGroups).set({ aiStatus }).where(eq(errorGroups.id, id));
}

export async function saveAnalysis(id: string, analysis: GuardAnalysis, model: string): Promise<void> {
  await db
    .update(errorGroups)
    .set({
      aiStatus: 'done',
      aiAnalysis: analysis,
      aiModel: model,
      aiUpdatedAt: new Date(),
    })
    .where(eq(errorGroups.id, id));
}

export interface DatabaseSummary {
  openProblems: number;
  needAttentionNow: number;
  moneyProblems: number;
  eventsLast24h: number;
  eventsTotal: number;
  lastEventAt: string | null;
}

/** Counts only. No row data leaves the database for the header of the screen. */
export async function databaseSummary(): Promise<DatabaseSummary> {
  const [groupStats] = await db
    .select({
      openProblems: sql<number>`count(*) filter (where ${errorGroups.status} = 'open')::int`,
      needAttentionNow: sql<number>`count(*) filter (where ${errorGroups.status} = 'open' and ${errorGroups.severity} = 'critical')::int`,
      moneyProblems: sql<number>`count(*) filter (where ${errorGroups.status} = 'open' and ${errorGroups.moneyPath})::int`,
      lastSeen: sql<Date | null>`max(${errorGroups.lastSeen})`,
    })
    .from(errorGroups);

  const since = hourBucket(new Date(Date.now() - 24 * 3_600_000));
  const [recent] = await db
    .select({ total: sql<number>`coalesce(sum(${errorRollups.count}), 0)::int` })
    .from(errorRollups)
    .where(gte(errorRollups.bucket, since));

  const [allTime] = await db
    .select({ total: sql<number>`coalesce(sum(${errorRollups.count}), 0)::int` })
    .from(errorRollups);

  return {
    openProblems: Number(groupStats?.openProblems ?? 0),
    needAttentionNow: Number(groupStats?.needAttentionNow ?? 0),
    moneyProblems: Number(groupStats?.moneyProblems ?? 0),
    eventsLast24h: Number(recent?.total ?? 0),
    eventsTotal: Number(allTime?.total ?? 0),
    lastEventAt: groupStats?.lastSeen ? new Date(groupStats.lastSeen).toISOString() : null,
  };
}

export interface JobRunInput {
  jobName: string;
  status: 'ok' | 'failed' | 'running';
  errorCode?: string | null;
  startedAt?: Date;
  finishedAt?: Date | null;
  durationMs?: number | null;
}

export async function recordJobRun(input: JobRunInput): Promise<void> {
  await db.insert(jobRuns).values({
    jobName: input.jobName.slice(0, 64),
    status: input.status,
    errorCode: input.errorCode ? input.errorCode.slice(0, 120) : null,
    startedAt: input.startedAt ?? new Date(),
    finishedAt: input.finishedAt ?? (input.status === 'running' ? null : new Date()),
    durationMs: input.durationMs ?? null,
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Latest run per job, plus a self-tuning "is it late?" flag: the expected interval is
 * derived from the job's own history, so a new job is never falsely red and a vanished
 * cron is caught without a hard-coded registry.
 */
export async function listJobRuns(now: number = Date.now()): Promise<GuardJobRun[]> {
  const rows = await db.select().from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(200);

  const byName = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byName.get(row.jobName) ?? [];
    list.push(row);
    byName.set(row.jobName, list);
  }

  const result: GuardJobRun[] = [];
  Array.from(byName.entries()).forEach(([jobName, runs]) => {
    const latest = runs[0];
    const gaps: number[] = [];
    for (let i = 1; i < runs.length && gaps.length < 5; i++) {
      const gap = runs[i - 1].startedAt.getTime() - runs[i].startedAt.getTime();
      if (gap > 0) gaps.push(gap);
    }
    const expected = median(gaps);
    const age = now - latest.startedAt.getTime();
    const stale = latest.status !== 'running' && expected > 0 && age > Math.max(expected * 1.5, 15 * 60_000);

    result.push({
      jobName,
      startedAt: latest.startedAt.toISOString(),
      finishedAt: latest.finishedAt ? latest.finishedAt.toISOString() : null,
      status: latest.status as GuardJobRun['status'],
      errorCode: latest.errorCode,
      durationMs: latest.durationMs,
      stale,
    });
  });

  return result.sort((a, b) => Number(b.stale) - Number(a.stale) || a.jobName.localeCompare(b.jobName));
}

/** Retention: rollups stay (they are tiny), evidence goes after 30 days. */
export async function pruneOldEvents(olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const deleted = await db
    .delete(errorEvents)
    .where(sql`${errorEvents.occurredAt} < ${cutoff}`)
    .returning({ id: errorEvents.id });
  return deleted.length;
}
