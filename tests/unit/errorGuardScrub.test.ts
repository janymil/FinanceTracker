/**
 * Leak canary for the Error Guard (blueprint 07 §13): no personal or financial
 * identifier may survive scrubbing. This test is the gate, not a suggestion.
 */
import { describe, expect, it } from 'vitest';
import { LIMITS, scrubGuardEvent } from '@shared/errorGuard/scrub';
import type { GuardEvent } from '@shared/errorGuard/types';

const NOW = Date.parse('2026-03-12T10:00:00.000Z');

const event: GuardEvent = {
  kind: 'exception',
  message:
    'Failed for jan@example.com with card 4242 4242 4242 4242 and IBAN SK31 1200 0000 1987 4263 7541',
  stack: 'Error: boom\n    at renderExpense (/app/client/src/pages/expenses.tsx:12:4)',
  route: '/api/expenses/42?token=supersecrettoken',
  context: {
    email: 'jan@example.com',
    password: 'hunter2',
    amount: 1234,
    detail: 'call 0912 345 678 or +421 903 123 456',
  },
  breadcrumbs: [{ type: 'click', label: 'button[data-testid="save"] jan@example.com' }],
  sessionRef: 'abc12345',
};

describe('scrubGuardEvent', () => {
  it('removes every forbidden identifier', () => {
    const serialized = JSON.stringify(scrubGuardEvent(event, NOW));
    const forbidden = [
      'jan@example.com',
      '4242 4242 4242 4242',
      'SK31 1200 0000 1987 4263 7541',
      'supersecrettoken',
      'hunter2',
      '0912 345 678',
      '+421 903 123 456',
    ];
    for (const value of forbidden) {
      expect(serialized).not.toContain(value);
    }
  });

  it('strips the query string from the route but keeps the pattern', () => {
    const scrubbed = scrubGuardEvent(event, NOW);
    expect(scrubbed.route).toBe('/api/expenses/:id');
  });

  it('keeps numbers that are needed for debugging', () => {
    const scrubbed = scrubGuardEvent(event, NOW);
    expect(scrubbed.context?.amount).toBe(1234);
  });

  it('never persists the session reference', () => {
    const scrubbed = scrubGuardEvent(event, NOW);
    expect(scrubbed.sessionRef).toBeUndefined();
    expect(JSON.stringify(scrubbed)).not.toContain('abc12345');
  });

  it('clips a huge stack and marks a huge context instead of storing it', () => {
    const huge = scrubGuardEvent(
      {
        kind: 'exception',
        message: 'x',
        stack: `Error\n${'    at fn (/app/server/x.ts:1:1)\n'.repeat(500)}`,
        context: { blob: 'y'.repeat(5_000) },
      },
      NOW,
    );
    expect(huge.stack!.length).toBeLessThanOrEqual(LIMITS.stack);
    expect(huge.context).toEqual({ truncated: true, sizeBytes: expect.any(Number) });
  });

  it('defaults occurredAt to a valid ISO timestamp', () => {
    const scrubbed = scrubGuardEvent({ kind: 'exception', message: 'x' }, NOW);
    expect(scrubbed.occurredAt).toBe('2026-03-12T10:00:00.000Z');
  });

  it('clips a long breadcrumb label', () => {
    const scrubbed = scrubGuardEvent(
      { kind: 'exception', message: 'x', breadcrumbs: [{ type: 'click', label: 'z'.repeat(500) }] },
      NOW,
    );
    expect(scrubbed.breadcrumbs?.[0].label.length).toBeLessThanOrEqual(LIMITS.breadcrumbLabel);
  });
});
