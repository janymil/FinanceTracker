import { describe, expect, it } from 'vitest';
import { assignSeverity, detectMoneyPath, isSelfReport, compareSeverity } from '@shared/errorGuard/classify';

describe('detectMoneyPath', () => {
  it('flags money routes', () => {
    for (const route of [
      '/api/expenses',
      '/api/expenses/:id',
      '/api/financial-summary',
      '/api/budget/2026-03',
      '/api/transactions',
      '/api/export/pdf',
      '/api/import/bank-statement',
      '/api/upload-receipt',
    ]) {
      expect(detectMoneyPath({ kind: 'http', route, message: 'boom' })).toBe(true);
    }
  });

  it('does not flag unrelated routes', () => {
    for (const route of ['/api/profile', '/api/auth/user', '/api/courses', '/api/contact']) {
      expect(detectMoneyPath({ kind: 'http', route, message: 'boom' })).toBe(false);
    }
  });

  it('flags money words even when the route is uninformative', () => {
    expect(detectMoneyPath({ kind: 'exception', message: 'Cannot read amount of undefined' })).toBe(true);
    expect(detectMoneyPath({ kind: 'exception', message: 'zostatok chýba' })).toBe(true);
  });

  it('treats every invariant as money, and honours an explicit flag', () => {
    expect(detectMoneyPath({ kind: 'invariant', message: 'balance' })).toBe(true);
    expect(detectMoneyPath({ kind: 'exception', message: 'x', moneyPath: true })).toBe(true);
  });
});

describe('assignSeverity', () => {
  it('never downgrades money or invariants', () => {
    expect(assignSeverity('exception', true)).toBe('critical');
    expect(assignSeverity('invariant', false)).toBe('critical');
    expect(assignSeverity('job', false)).toBe('critical');
  });

  it('maps swallowed errors to error and HTTP by status', () => {
    expect(assignSeverity('swallowed', false)).toBe('error');
    expect(assignSeverity('http', false, 503)).toBe('error');
    expect(assignSeverity('http', false, 404)).toBe('warning');
  });

  it('lets the caller force a severity', () => {
    expect(assignSeverity('http', false, 500, 'info')).toBe('info');
  });
});

describe('isSelfReport', () => {
  it('refuses to report on its own endpoints', () => {
    expect(isSelfReport('/api/telemetry/errors')).toBe(true);
    expect(isSelfReport('/api/admin/watch/groups')).toBe(true);
    expect(isSelfReport('/api/expenses')).toBe(false);
    expect(isSelfReport(undefined)).toBe(false);
  });
});

describe('compareSeverity', () => {
  it('sorts the worst first', () => {
    const sorted = (['info', 'warning', 'critical', 'error'] as const)
      .slice()
      .sort(compareSeverity);
    expect(sorted).toEqual(['critical', 'error', 'warning', 'info']);
  });
});
