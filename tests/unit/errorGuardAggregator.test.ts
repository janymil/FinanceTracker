/**
 * Storm test (blueprint 07 §13, M1 acceptance criterion).
 *
 * The only question that matters: does 5 000 identical failures become **one** database
 * write? The store is mocked so this stays a pure unit test — no Postgres, no network.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { writeBatchMock } = vi.hoisted(() => ({ writeBatchMock: vi.fn() }));

vi.mock('../../server/errorGuard/store', () => ({
  writeBatch: writeBatchMock,
}));

import {
  enqueue,
  flush,
  getAggregatorStats,
  isIntakeAllowed,
  resetAggregatorForTests,
  setNewGroupHandler,
} from '../../server/errorGuard/aggregator';
import type { GuardEvent } from '@shared/errorGuard/types';

beforeEach(() => {
  resetAggregatorForTests();
  writeBatchMock.mockReset();
  writeBatchMock.mockResolvedValue(undefined);
});

describe('aggregator storm behaviour', () => {
  it('turns 5 000 identical failures into one group and one write', async () => {
    for (let i = 0; i < 5_000; i++) {
      enqueue(
        [
          {
            kind: 'http',
            message: `GET /api/expenses/${i} returned 500`,
            route: `/api/expenses/${i}`,
            method: 'GET',
            status: 500,
          },
        ],
        1_000,
      );
    }

    const beforeFlush = getAggregatorStats();
    expect(beforeFlush.bufferedGroups).toBe(1);
    expect(beforeFlush.accepted).toBe(5_000);

    await flush(1_000);

    expect(writeBatchMock).toHaveBeenCalledTimes(1);
    const batch = writeBatchMock.mock.calls[0][0] as Array<{
      count: number;
      moneyPath: boolean;
      severity: string;
      samples: GuardEvent[];
    }>;
    expect(batch).toHaveLength(1);
    expect(batch[0].count).toBe(5_000);
    expect(batch[0].moneyPath).toBe(true);
    expect(batch[0].samples.length).toBeLessThanOrEqual(2);
    expect(getAggregatorStats().bufferedGroups).toBe(0);
  });

  it('never writes when nothing was buffered', async () => {
    await flush(1_000);
    expect(writeBatchMock).not.toHaveBeenCalled();
  });

  it('refuses to report on its own endpoints', () => {
    enqueue([{ kind: 'http', message: 'x', route: '/api/telemetry/errors' }], 1_000);
    const stats = getAggregatorStats();
    expect(stats.accepted).toBe(0);
    expect(stats.bufferedGroups).toBe(0);
    expect(stats.dropped).toBe(1);
  });

  it('keeps the buffer and counts the failure when the write path is down', async () => {
    writeBatchMock.mockRejectedValueOnce(new Error('database is down'));
    enqueue([{ kind: 'exception', message: 'boom' }], 1_000);

    await flush(1_000);

    const stats = getAggregatorStats();
    expect(stats.flushFailures).toBe(1);
    expect(stats.bufferedGroups).toBe(1);
    expect(stats.lastError).toContain('database is down');
  });

  it('offers a group to triage once, not on every recurrence', async () => {
    const seen: string[] = [];
    setNewGroupHandler((groupId) => seen.push(groupId));

    enqueue([{ kind: 'exception', message: 'boom', name: 'TypeError' }], 1_000);
    await flush(1_000);
    enqueue([{ kind: 'exception', message: 'boom', name: 'TypeError' }], 2_000);
    await flush(2_000);

    expect(seen).toHaveLength(1);
    expect(writeBatchMock).toHaveBeenCalledTimes(2);
  });

  it('escalates severity to critical when a later batch touches money', async () => {
    enqueue([{ kind: 'exception', message: 'failed', route: '/api/profile' }], 1_000);
    await flush(1_000);
    enqueue([{ kind: 'exception', message: 'failed', route: '/api/expenses' }], 2_000);
    await flush(2_000);

    // Different routes produce different groups, so the second batch is simply critical.
    const secondBatch = writeBatchMock.mock.calls[1][0] as Array<{ severity: string }>;
    expect(secondBatch[0].severity).toBe('critical');
  });
});

describe('intake limiter', () => {
  it('allows a burst and then refuses', () => {
    const key = 'ip-1';
    let allowed = 0;
    for (let i = 0; i < 100; i++) {
      if (isIntakeAllowed(key, 1_000)) allowed += 1;
    }
    expect(allowed).toBe(60);
    expect(isIntakeAllowed(key, 1_000)).toBe(false);
    expect(isIntakeAllowed(key, 60_000)).toBe(true);
  });

  it('keeps buckets per key', () => {
    for (let i = 0; i < 60; i++) isIntakeAllowed('ip-2', 1_000);
    expect(isIntakeAllowed('ip-2', 1_000)).toBe(false);
    expect(isIntakeAllowed('ip-3', 1_000)).toBe(true);
  });
});
