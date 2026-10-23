import { describe, expect, it } from 'vitest';
import { describeHealth, evaluateHealth } from '../../shared/healthcheck';

/**
 * Module 8 of step 6: the synthetic monitor's decision rules, kept pure so they are
 * testable without a running server.
 */

const healthy = { httpStatus: 200, body: { status: 'ok' }, latencyMs: 120, maxLatencyMs: 2000 };

describe('evaluateHealth', () => {
  it('accepts a healthy service', () => {
    expect(evaluateHealth(healthy)).toEqual({
      ok: true,
      problems: [],
      latencyMs: 120,
      status: 'ok',
    });
  });

  it('rejects a non-2xx status', () => {
    const result = evaluateHealth({ ...healthy, httpStatus: 503 });
    expect(result.ok).toBe(false);
    expect(result.problems).toContain('HTTP 503');
  });

  it('rejects a missing or non-object body', () => {
    for (const body of [null, 'ok', 42, ['ok']]) {
      const result = evaluateHealth({ ...healthy, body });
      expect(result.ok).toBe(false);
    }
  });

  it('rejects an unhealthy status string', () => {
    for (const status of ['error', 'down', 'failed', 'UNHEALTHY']) {
      expect(evaluateHealth({ ...healthy, body: { status } }).ok).toBe(false);
    }
  });

  it('rejects a failing sub-check (database probe)', () => {
    const result = evaluateHealth({
      ...healthy,
      body: { status: 'ok', checks: { database: { status: 'error' } } },
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('database');
  });

  it('accepts healthy sub-checks', () => {
    const result = evaluateHealth({
      ...healthy,
      body: { status: 'ok', checks: { database: { status: 'ok', latencyMs: 8 } } },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects latency over budget but accepts exactly at the limit', () => {
    expect(evaluateHealth({ ...healthy, latencyMs: 2001 }).ok).toBe(false);
    expect(evaluateHealth({ ...healthy, latencyMs: 2000 }).ok).toBe(true);
  });

  it('rejects an invalid latency measurement', () => {
    expect(evaluateHealth({ ...healthy, latencyMs: -1 }).ok).toBe(false);
    expect(evaluateHealth({ ...healthy, latencyMs: Number.NaN }).ok).toBe(false);
  });

  it('reports the status it saw', () => {
    expect(evaluateHealth({ ...healthy, body: { status: 'degraded' } }).status).toBe('degraded');
    expect(evaluateHealth({ ...healthy, body: {} }).status).toBeNull();
  });
});

describe('describeHealth', () => {
  it('formats a one-line OK summary', () => {
    const line = describeHealth('https://kaptia.app/api/health', evaluateHealth(healthy));
    expect(line).toContain('OK https://kaptia.app/api/health');
    expect(line).toContain('120ms');
  });

  it('formats a one-line failure summary with the reasons', () => {
    const evaluation = evaluateHealth({ ...healthy, httpStatus: 500, body: { status: 'error' } });
    const line = describeHealth('https://kaptia.app/api/health', evaluation);
    expect(line).toContain('FAIL');
    expect(line).toContain('HTTP 500');
  });
});
