import { describe, expect, it } from 'vitest';
import { annotateEmptyReason } from '../../shared/dailyRecommendations';

/**
 * The screen used to say "Add at least 3 transactions" to a customer who had hundreds —
 * the AI simply returned nothing. Two situations, two messages.
 */
describe('annotateEmptyReason', () => {
  it('says nothing when there is something to show', () => {
    const result = annotateEmptyReason(
      { recommendations: [{ id: 'a' }], insights: [] },
      { transactionCount: 40, totalExpenses: 500 },
    );
    expect(result.reason).toBeNull();
  });

  it('explains a thin account', () => {
    expect(annotateEmptyReason({ recommendations: [], insights: [] }, { transactionCount: 1 }).reason).toBe(
      'not_enough_data',
    );
    expect(
      annotateEmptyReason({}, { transactionCount: 3, totalIncome: 0, totalExpenses: 0 }).reason,
    ).toBe('not_enough_data');
  });

  it('explains "no suggestions today" when the data was there', () => {
    expect(
      annotateEmptyReason({ recommendations: [], insights: [] }, { transactionCount: 12, totalExpenses: 980 }).reason,
    ).toBe('no_suggestions');
  });

  it('normalises missing arrays so the client never maps undefined', () => {
    const result = annotateEmptyReason(null, { transactionCount: 0 });
    expect(result.recommendations).toEqual([]);
    expect(result.insights).toEqual([]);
    expect(result.reason).toBe('not_enough_data');
  });
});
