/**
 * The triage contract: what leaves the web app, and what it will accept back.
 *
 * The prompt itself lives in the AI processor (`errorGuardTriage.ts`), so there is nothing
 * to test here about wording — only that the payload carries metadata and never data, and
 * that a malformed model answer cannot reach a human.
 */
import { describe, expect, it } from 'vitest';
import {
  TRIAGE_PATH,
  buildTriagePayload,
  parseTriageResponse,
  toGuardAnalysis,
  type TriageSample,
} from '@shared/errorGuard/triage';
import type { GuardGroup } from '@shared/errorGuard/types';

const group: GuardGroup = {
  id: 'abc123',
  kind: 'exception',
  source: 'client',
  title: 'TypeError: Cannot read properties of undefined',
  message: 'Cannot read properties of undefined (reading "amountInCents")',
  route: '/api/expenses/:id',
  release: 'release-42',
  severity: 'critical',
  status: 'open',
  moneyPath: true,
  eventCount: 12,
  sessionCount: 3,
  firstSeen: '2026-03-12T09:00:00.000Z',
  lastSeen: '2026-03-12T10:00:00.000Z',
  aiStatus: 'pending',
  aiAnalysis: null,
  aiModel: null,
  aiUpdatedAt: null,
};

const sample: TriageSample = {
  stack: [
    'Error: boom',
    '    at renderExpense (src/pages/expenses.tsx:120:18)',
    '    at map (src/pages/expenses.tsx:140:10)',
    '    at each (src/lib/each.ts:10:1)',
    '    at run (src/lib/run.ts:20:1)',
    '    at go (src/lib/go.ts:30:1)',
    '    at sixth (src/lib/sixth.ts:40:1)',
  ].join('\n'),
  context: {
    where: 'renderExpense',
    amountInCents: 1234,
    email: 'should-never-leave@example.com',
  },
  breadcrumbs: Array.from({ length: 12 }, (_, index) => ({ label: `click-${index}` })),
};

describe('buildTriagePayload', () => {
  const payload = buildTriagePayload(group, [sample]);

  it('carries the metadata the processor needs', () => {
    expect(payload.title).toBe(group.title);
    expect(payload.route).toBe('/api/expenses/:id');
    expect(payload.release).toBe('release-42');
    expect(payload.moneyPath).toBe(true);
    expect(payload.eventCount).toBe(12);
    expect(payload.severity).toBe('critical');
  });

  it('sends context KEY NAMES, never their values', () => {
    expect(payload.contextKeys).toEqual(['where', 'amountInCents', 'email']);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('should-never-leave@example.com');
    expect(serialized).not.toContain('1234');
  });

  it('limits stack frames and breadcrumbs', () => {
    expect(payload.stackFrames).toHaveLength(5);
    expect(payload.stackFrames?.[0]).toContain('renderExpense');
    expect(payload.breadcrumbLabels).toHaveLength(8);
    expect(payload.breadcrumbLabels?.[7]).toBe('click-11');
  });

  it('omits empty optional sections instead of sending empty arrays', () => {
    const bare = buildTriagePayload({ ...group, route: null, release: null }, []);
    expect(bare.stackFrames).toBeUndefined();
    expect(bare.contextKeys).toBeUndefined();
    expect(bare.breadcrumbLabels).toBeUndefined();
    expect(bare.route).toBeNull();
  });

  it('truncates a long message', () => {
    const long = buildTriagePayload({ ...group, message: 'x'.repeat(2_000) }, []);
    expect(long.message).toHaveLength(500);
  });

  it('never throws on a malformed sample', () => {
    expect(() =>
      buildTriagePayload(group, [
        { stack: null, context: null, breadcrumbs: 'not-an-array' } as unknown as TriageSample,
      ]),
    ).not.toThrow();
  });
});

describe('the processor endpoint', () => {
  it('is the path mounted by registerErrorGuardTriage', () => {
    expect(TRIAGE_PATH).toBe('/error-triage');
  });
});

describe('parseTriageResponse', () => {
  const valid = {
    plainSummary: 'A number the screen expected was missing.',
    likelyCause: 'The expense row had no amount, so the code read a property of undefined.',
    whereToLook: 'client/src/pages/expenses.tsx around the render function',
    userImpact: 'The expense list does not open for that month.',
    moneyRisk: 'possible',
    severity: 'critical',
    confidence: 0.72,
    suggestedFix: 'Guard the amount field before formatting it and show the row without a total.',
  };

  it('accepts a valid analysis', () => {
    expect(parseTriageResponse(valid)).toEqual(valid);
  });

  it('rejects a missing field, a bad enum and an out-of-range confidence', () => {
    expect(parseTriageResponse({ ...valid, plainSummary: undefined })).toBeNull();
    expect(parseTriageResponse({ ...valid, moneyRisk: 'maybe' })).toBeNull();
    expect(parseTriageResponse({ ...valid, confidence: 1.5 })).toBeNull();
  });

  it('rejects non-objects and short answers instead of throwing', () => {
    expect(parseTriageResponse(null)).toBeNull();
    expect(parseTriageResponse('{"plainSummary":"x"}')).toBeNull();
    expect(parseTriageResponse(undefined)).toBeNull();
    expect(parseTriageResponse({ ...valid, plainSummary: 'oops' })).toBeNull();
  });
});

describe('toGuardAnalysis', () => {
  it('maps the response onto the stored shape without losing fields', () => {
    const parsed = parseTriageResponse({
      plainSummary: 'A number the screen expected was missing.',
      likelyCause: 'The amount was undefined.',
      whereToLook: 'expenses.tsx',
      userImpact: 'The list does not open.',
      moneyRisk: 'likely',
      severity: 'error',
      confidence: 0.5,
      suggestedFix: 'Guard the amount before formatting.',
    })!;

    expect(toGuardAnalysis(parsed)).toEqual({
      plainSummary: parsed.plainSummary,
      likelyCause: parsed.likelyCause,
      whereToLook: parsed.whereToLook,
      userImpact: parsed.userImpact,
      moneyRisk: 'likely',
      severity: 'error',
      confidence: 0.5,
      suggestedFix: parsed.suggestedFix,
    });
  });
});
