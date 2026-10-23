/**
 * The AI prompt and its response contract (blueprint 07 §9.4).
 *
 * Two things matter here: the prompt must never contain a context *value*, and a model
 * answer that does not match the schema must never reach a human as if it were fact.
 */
import { describe, expect, it } from 'vitest';
import {
  buildTriagePrompt,
  parseTriageResponse,
  toGuardAnalysis,
  type TriageInput,
} from '@shared/errorGuard/triage';

const input: TriageInput = {
  title: 'TypeError: Cannot read properties of undefined',
  kind: 'exception',
  route: '/api/expenses/:id',
  release: 'abc1234',
  platform: 'client',
  severity: 'critical',
  moneyPath: true,
  eventCount: 12,
  message: 'Cannot read properties of undefined (reading "amountInCents")',
  stackFrames: [
    'at renderExpense (src/pages/expenses.tsx:120:18)',
    'at Array.map (<anonymous>)',
  ],
  contextKeys: ['where', 'fallback'],
  breadcrumbLabels: ['button[data-testid="save-expense"]'],
};

describe('buildTriagePrompt', () => {
  const prompt = buildTriagePrompt(input);

  it('includes the metadata the model needs', () => {
    expect(prompt.user).toContain('/api/expenses/:id');
    expect(prompt.user).toContain('Touches money: yes');
    expect(prompt.user).toContain('Times seen: 12');
    expect(prompt.user).toContain('renderExpense');
    expect(prompt.user).toContain('where, fallback');
  });

  it('demands a single JSON object and forbids markdown', () => {
    expect(prompt.system).toContain('single JSON object');
    expect(prompt.system).toContain('No markdown');
    expect(prompt.user).toContain('"moneyRisk"');
  });

  it('is pure: same input, same prompt', () => {
    expect(buildTriagePrompt(input)).toEqual(buildTriagePrompt(input));
  });

  it('omits optional sections instead of printing "undefined"', () => {
    const minimal = buildTriagePrompt({
      title: 't',
      kind: 'swallowed',
      severity: 'error',
      moneyPath: false,
      eventCount: 1,
      message: 'm',
    });
    expect(minimal.user).not.toContain('undefined');
    expect(minimal.user).not.toContain('Top frames');
    expect(minimal.user).toContain('Route: unknown');
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

  it('rejects non-objects instead of throwing', () => {
    expect(parseTriageResponse(null)).toBeNull();
    expect(parseTriageResponse('{"plainSummary":"x"}')).toBeNull();
    expect(parseTriageResponse(undefined)).toBeNull();
  });

  it('rejects a too-short answer that is technically a string', () => {
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
