/**
 * Error Guard aggregator (blueprint 07 §6).
 *
 * The whole point: **one write per group per flush**, never one write per error. A storm
 * of 10 000 identical failures becomes one UPDATE and one rollup increment, so the error
 * reporter cannot become the incident.
 *
 * Shape: intake → scrub → fingerprint → accumulate in memory → flush to Postgres.
 * The flush path is wrapped in a circuit breaker; when the database is sick, events stay
 * in a bounded buffer and are dropped-with-a-counter rather than retried forever.
 */
import { CircuitBreaker, TokenBucket } from '@shared/errorGuard/throttle';
import { fingerprint, titleFor } from '@shared/errorGuard/fingerprint';
import { assignSeverity, detectMoneyPath, isSelfReport } from '@shared/errorGuard/classify';
import { scrubGuardEvent } from '@shared/errorGuard/scrub';
import type { GuardEvent, GuardSeverity } from '@shared/errorGuard/types';
import { writeBatch, type GroupSnapshot } from './store';

const FLUSH_INTERVAL_MS = Number(process.env.ERROR_GUARD_FLUSH_MS) || 10_000;
/** Hard cap on distinct problems held in memory; a fingerprint bug must not eat the heap. */
const MAX_GROUPS = 500;
/** Samples kept per group per flush — enough to read a stack, not enough to matter. */
const MAX_SAMPLES = 2;
const INTAKE_PER_MINUTE = Number(process.env.ERROR_GUARD_INTAKE_PER_MINUTE) || 240;

interface Accumulator {
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
  sessions: Set<string>;
  firstSeen: Date;
  lastSeen: Date;
  samples: GuardEvent[];
  isNew: boolean;
}

const groups = new Map<string, Accumulator>();
const breaker = new CircuitBreaker(3, 60_000);
const intakeBuckets = new Map<string, TokenBucket>();

let accepted = 0;
let dropped = 0;
let flushFailures = 0;
let consecutiveFailures = 0;
let lastFlushAt: number | null = null;
let lastError: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let flushing = false;
let newGroupHandler: ((groupId: string) => void) | null = null;
let alertHandler: ((groups: GroupSnapshot[]) => Promise<void> | void) | null = null;
/** Groups already offered to triage, so a recurring problem does not spend budget twice. */
const triageSeen = new Set<string>();

/** Wired by the routes module to the triage job (a hook, to avoid an import cycle). */
export function setNewGroupHandler(handler: ((groupId: string) => void) | null): void {
  newGroupHandler = handler;
}

/** Wired by the routes module to the e-mail alerter (blueprint 07 §11). */
export function setAlertHandler(
  handler: ((groups: GroupSnapshot[]) => Promise<void> | void) | null,
): void {
  alertHandler = handler;
}

/** Per-IP intake limiter. A browser that loops on an error cannot flood the endpoint. */
export function isIntakeAllowed(key: string, now: number = Date.now()): boolean {
  const bucketKey = key || 'unknown';
  let bucket = intakeBuckets.get(bucketKey);
  if (!bucket) {
    bucket = new TokenBucket(60, INTAKE_PER_MINUTE / 60, now);
    // Keep the map bounded: a rotating-IP attack must not grow it forever.
    if (intakeBuckets.size > 2_000) intakeBuckets.clear();
    intakeBuckets.set(bucketKey, bucket);
  }
  return bucket.tryTake(1, now);
}

/**
 * Accept a batch. Returns how many events were accepted, and never throws: the caller
 * is an HTTP handler that must answer 204 regardless of what happens in here.
 */
export function enqueue(raw: GuardEvent[], now: number = Date.now()): number {
  let acceptedNow = 0;

  for (const rawEvent of raw) {
    const event = scrubGuardEvent(rawEvent, now);
    if (isSelfReport(event.route)) {
      dropped += 1;
      continue;
    }

    const count = Math.max(1, Math.min(event.count ?? 1, 10_000));
    const id = fingerprint(event);
    const existing = groups.get(id);

    if (!existing && groups.size >= MAX_GROUPS) {
      dropped += count;
      continue;
    }

    const moneyPath = detectMoneyPath(event);
    const severity = assignSeverity(event.kind, moneyPath, event.status, event.severity);
    const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date(now);

    if (existing) {
      existing.count += count;
      if (occurredAt > existing.lastSeen) existing.lastSeen = occurredAt;
      if (occurredAt < existing.firstSeen) existing.firstSeen = occurredAt;
      if (event.sessionRef) existing.sessions.add(event.sessionRef);
      // Critical must win over a quieter later batch.
      if (severity === 'critical') existing.severity = 'critical';
      existing.moneyPath = existing.moneyPath || moneyPath;
      if (existing.samples.length < MAX_SAMPLES) existing.samples.push(event);
    } else {
      groups.set(id, {
        id,
        kind: event.kind,
        source: event.source ?? 'client',
        title: titleFor(event),
        message: event.message,
        route: event.route ?? null,
        release: event.release ?? null,
        platform: event.platform ?? null,
        severity,
        moneyPath,
        count,
        sessions: new Set(event.sessionRef ? [event.sessionRef] : []),
        firstSeen: occurredAt,
        lastSeen: occurredAt,
        samples: [event],
        isNew: true,
      });
    }

    accepted += count;
    acceptedNow += count;
  }

  return acceptedNow;
}

function toSnapshot(group: Accumulator): GroupSnapshot {
  return {
    id: group.id,
    kind: group.kind,
    source: group.source,
    title: group.title,
    message: group.message,
    route: group.route,
    release: group.release,
    platform: group.platform,
    severity: group.severity,
    moneyPath: group.moneyPath,
    count: group.count,
    sessionCount: group.sessions.size,
    firstSeen: group.firstSeen,
    lastSeen: group.lastSeen,
    samples: group.samples,
  };
}

/**
 * Write the buffer. Safe to call concurrently: a second call is a no-op, and a failure
 * leaves the data in memory for the next attempt (bounded by MAX_GROUPS).
 */
export async function flush(now: number = Date.now()): Promise<void> {
  if (flushing || groups.size === 0) return;
  if (!breaker.canAttempt(now)) return;

  flushing = true;
  const snapshots = Array.from(groups.values()).map(toSnapshot);
  const newGroupIds = Array.from(groups.values())
    .filter((group) => group.isNew && !triageSeen.has(group.id))
    .map((group) => group.id);

  try {
    await writeBatch(snapshots);
    breaker.recordSuccess();
    groups.clear();
    consecutiveFailures = 0;
    lastFlushAt = now;
    lastError = null;

    if (newGroupHandler) {
      for (const groupId of newGroupIds) {
        triageSeen.add(groupId);
        if (triageSeen.size > 1_000) triageSeen.clear();
        try {
          newGroupHandler(groupId);
        } catch {
          /* triage must never break the flush */
        }
      }
    }

    if (alertHandler) {
      try {
        void Promise.resolve(alertHandler(snapshots)).catch(() => undefined);
      } catch {
        /* alerting must never break the flush */
      }
    }
  } catch (error: unknown) {
    flushFailures += 1;
    consecutiveFailures += 1;
    breaker.recordFailure(now);
    lastError = error instanceof Error ? error.message.slice(0, 200) : 'unknown flush error';
    console.error('[errorGuard] flush failed:', lastError);
    // After ten consecutive failures, stop holding memory hostage: drop the buffer and
    // count it. Losing diagnostics is acceptable; an OOM in the app is not.
    if (consecutiveFailures >= 10) {
      dropped += Array.from(groups.values()).reduce((sum, group) => sum + group.count, 0);
      groups.clear();
      consecutiveFailures = 0;
    }
  } finally {
    flushing = false;
  }
}

export interface AggregatorStats {
  accepted: number;
  dropped: number;
  flushFailures: number;
  bufferedGroups: number;
  lastFlushAt: string | null;
  lastError: string | null;
  writePathOpen: boolean;
}

export function getAggregatorStats(): AggregatorStats {
  return {
    accepted,
    dropped,
    flushFailures,
    bufferedGroups: groups.size,
    lastFlushAt: lastFlushAt ? new Date(lastFlushAt).toISOString() : null,
    lastError,
    writePathOpen: !breaker.isOpen,
  };
}

/** Start the periodic flush. Idempotent; the timer never keeps the process alive. */
export function startErrorGuard(): void {
  if (timer) return;
  timer = setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopErrorGuard(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

/** Test helper: reset in-memory state without touching the database. */
export function resetAggregatorForTests(): void {
  groups.clear();
  intakeBuckets.clear();
  triageSeen.clear();
  accepted = 0;
  dropped = 0;
  flushFailures = 0;
  consecutiveFailures = 0;
  lastFlushAt = null;
  lastError = null;
  newGroupHandler = null;
  alertHandler = null;
}
