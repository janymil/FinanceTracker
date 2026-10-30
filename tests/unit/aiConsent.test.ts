import { describe, expect, it } from 'vitest';
import { needsAiConsent } from '@shared/aiConsent';

/**
 * Who still owes us an answer about AI.
 *
 * The question is asked once. The only thing that can tell "chose to keep it on" apart from
 * "was never asked" is the timestamp of the answer, because the old default made both look
 * like `aiEnabled: true`. That is why the flag alone must never silence the dialog.
 */
describe('needsAiConsent', () => {
  it('asks an account that has never answered', () => {
    expect(needsAiConsent({ aiEnabled: false, aiConsentDecidedAt: null })).toBe(true);
    expect(needsAiConsent({ aiEnabled: false })).toBe(true);
  });

  it('does not read the old default as an answer', () => {
    expect(needsAiConsent({ aiEnabled: true, aiConsentDecidedAt: null })).toBe(true);
  });

  it('stops asking once the answer is recorded, whichever way it went', () => {
    expect(needsAiConsent({ aiEnabled: true, aiConsentDecidedAt: new Date('2026-10-29T12:00:00Z') })).toBe(false);
    expect(needsAiConsent({ aiEnabled: false, aiConsentDecidedAt: '2026-10-29T12:00:00Z' })).toBe(false);
  });

  it('asks nobody when there is no account to ask', () => {
    expect(needsAiConsent(null)).toBe(false);
    expect(needsAiConsent(undefined)).toBe(false);
  });
});
