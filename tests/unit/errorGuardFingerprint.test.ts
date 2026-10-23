import { describe, expect, it } from 'vitest';
import {
  fingerprint,
  normalizeMessage,
  normalizeRoute,
  stableHash,
  titleFor,
  topApplicationFrame,
} from '@shared/errorGuard/fingerprint';

const stack = [
  'TypeError: Cannot read properties of undefined (reading "amount")',
  '    at renderExpense (webpack:/app/client/src/pages/expenses.tsx:120:18)',
  '    at Array.map (<anonymous>)',
  '    at Object.react-dom (/app/node_modules/react-dom/index.js:1:1)',
].join('\n');

describe('normalizeMessage', () => {
  it('replaces ids, numbers, quoted values and urls', () => {
    const normalized = normalizeMessage(
      'Failed for user 42 at https://api.example.com/x?token=abc after "3 attempts" on 2026-03-12',
    );
    expect(normalized).toContain(':url');
    expect(normalized).toContain(':str');
    expect(normalized).not.toContain('42');
    expect(normalized).not.toContain('2026');
    expect(normalized).not.toContain('https://');
  });

  it('is stable for the same input and deterministic across calls', () => {
    expect(normalizeMessage('boom 1')).toBe(normalizeMessage('boom 1'));
    expect(stableHash('abc')).toBe(stableHash('abc'));
    expect(stableHash('abc')).toHaveLength(16);
    expect(stableHash('abc')).not.toBe(stableHash('abd'));
  });
});

describe('normalizeRoute', () => {
  it('drops query strings and collapses numeric segments', () => {
    expect(normalizeRoute('/api/expenses/123?from=2026-01-01')).toBe('/api/expenses/:id');
    expect(normalizeRoute('https://app.kaptia.sk/api/income/7/edit#top')).toBe('/api/income/:id/edit');
  });

  it('returns undefined for empty input', () => {
    expect(normalizeRoute(undefined)).toBeUndefined();
    expect(normalizeRoute('')).toBeUndefined();
  });
});

describe('topApplicationFrame', () => {
  it('skips node_modules and anonymous frames and strips line numbers', () => {
    expect(topApplicationFrame(stack)).toBe('renderExpense@pages/expenses.tsx');
  });

  it('handles a stack with only anonymous frames', () => {
    expect(topApplicationFrame('Error\n    at /app/server/x.ts:10:5')).toBe('anonymous@server/x.ts');
  });

  it('returns undefined when there is no stack', () => {
    expect(topApplicationFrame(undefined)).toBeUndefined();
  });
});

describe('fingerprint', () => {
  it('gives the same id to the same failure with different ids, numbers and rows', () => {
    const first = fingerprint({
      kind: 'exception',
      name: 'TypeError',
      message: 'Expense 1234 not found',
      route: '/api/expenses/1234',
      stack,
    });
    const second = fingerprint({
      kind: 'exception',
      name: 'TypeError',
      message: 'Expense 9876 not found',
      route: '/api/expenses/9876',
      stack,
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{16}$/);
  });

  it('keeps different kinds apart, because the fix differs', () => {
    const base = { name: 'Error', message: 'boom', route: '/api/expenses' };
    const swallowed = fingerprint({ ...base, kind: 'swallowed' });
    const crash = fingerprint({ ...base, kind: 'exception' });
    expect(swallowed).not.toBe(crash);
  });

  it('distinguishes genuinely different messages', () => {
    const a = fingerprint({ kind: 'exception', message: 'Cannot read properties of null' });
    const b = fingerprint({ kind: 'exception', message: 'Network request failed' });
    expect(a).not.toBe(b);
  });
});

describe('titleFor', () => {
  it('prefixes the error name and normalises the message', () => {
    expect(titleFor({ kind: 'exception', name: 'TypeError', message: 'x is 42' })).toBe(
      'TypeError: x is :n',
    );
  });

  it('falls back to plain language when there is no message', () => {
    expect(titleFor({ kind: 'invariant', message: '' })).toBe('A money figure did not add up');
  });
});
