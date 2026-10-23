import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_THRESHOLD,
  calculateAmountSimilarity,
  calculateDateSimilarity,
  calculateDescriptionSimilarity,
  calculateTransactionSimilarity,
  detectDuplicateTransactions,
  levenshteinDistance,
} from '../../shared/duplicateDetection';

/**
 * Module 10: duplicate detection for bank-statement imports (extracted from
 * `lib/pdfProcessor.ts`). A missed duplicate silently doubles expenses.
 */

const existing = [
  { id: 1, date: '2026-03-12', description: 'LIDL BRATISLAVA', amount: 24.89, type: 'expense' },
  { id: 2, date: '2026-03-14', description: 'ALZA.SK OBJEDNAVKA', amount: 249.99, type: 'expense' },
];

describe('levenshteinDistance', () => {
  it('measures edit distance', () => {
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('calculateDescriptionSimilarity', () => {
  it('is 1 for identical strings, ignoring case and spaces', () => {
    expect(calculateDescriptionSimilarity('Lidl', 'LIDL')).toBe(1);
    expect(calculateDescriptionSimilarity('  lidl  ', 'lidl')).toBe(1);
  });

  it('is 1 for two empty strings', () => {
    expect(calculateDescriptionSimilarity('', '')).toBe(1);
  });

  it('decreases with edit distance', () => {
    expect(calculateDescriptionSimilarity('LIDL BRATISLAVA', 'LIDL BRATISLAVA 2')).toBeGreaterThan(0.85);
    expect(calculateDescriptionSimilarity('LIDL', 'TESCO')).toBeLessThan(0.5);
  });
});

describe('calculateDateSimilarity', () => {
  it('gives 1 for the same day, 0.5 within 3 days, 0 beyond', () => {
    expect(calculateDateSimilarity('2026-03-12', '2026-03-12')).toBe(1);
    expect(calculateDateSimilarity('2026-03-12', '2026-03-13')).toBe(0.5);
    expect(calculateDateSimilarity('2026-03-12', '2026-03-15')).toBe(0.5);
    expect(calculateDateSimilarity('2026-03-12', '2026-03-16')).toBe(0);
  });

  it('returns 0 for invalid dates instead of NaN', () => {
    expect(calculateDateSimilarity('nie je datum', '2026-03-12')).toBe(0);
  });
});

describe('calculateAmountSimilarity', () => {
  it('gives 1 below one cent, 0.8 within 1 %, 0.5 within 5 %', () => {
    expect(calculateAmountSimilarity(24.89, 24.89)).toBe(1);
    expect(calculateAmountSimilarity(24.89, 24.894)).toBe(1);
    expect(calculateAmountSimilarity(100, 100.5)).toBe(0.8);
    expect(calculateAmountSimilarity(100, 104)).toBe(0.5);
    expect(calculateAmountSimilarity(100, 120)).toBe(0);
  });

  it('handles zeros without dividing by zero', () => {
    expect(calculateAmountSimilarity(0, 0)).toBe(1);
    expect(calculateAmountSimilarity(0, 10)).toBe(0);
  });
});

describe('calculateTransactionSimilarity', () => {
  it('is 1 for identical rows (0.4 + 0.35 + 0.2 + 0.05)', () => {
    expect(calculateTransactionSimilarity(existing[0], existing[0])).toBeCloseTo(1, 10);
  });

  it('drops below the threshold when the date is far off', () => {
    const far = { ...existing[0], date: '2026-04-20' };
    expect(calculateTransactionSimilarity(existing[0], far)).toBeLessThan(DUPLICATE_THRESHOLD);
  });
});

describe('detectDuplicateTransactions', () => {
  it('flags a re-imported statement', () => {
    const extracted = [
      { date: '2026-03-12', description: 'LIDL BRATISLAVA', amount: 24.89, type: 'expense' as const },
    ];

    const duplicates = detectDuplicateTransactions(extracted, existing);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].existingTransactions[0].id).toBe(1);
    expect(duplicates[0].similarityScore).toBeCloseTo(1, 10);
    expect(duplicates[0].matchReasons).toEqual([
      'Exact date match',
      'Exact amount match',
      'Very similar description',
    ]);
  });

  it('tolerates small OCR differences in the description', () => {
    const extracted = [
      { date: '2026-03-12', description: 'LIDL BRATISLAV', amount: 24.89, type: 'expense' as const },
    ];
    expect(detectDuplicateTransactions(extracted, existing)).toHaveLength(1);
  });

  it('does not flag a genuinely new transaction', () => {
    const extracted = [
      { date: '2026-03-20', description: 'KAUFLAND', amount: 62.15, type: 'expense' as const },
    ];
    expect(detectDuplicateTransactions(extracted, existing)).toEqual([]);
  });

  it('reports every matching existing row and only the highest score', () => {
    const twice = [
      ...existing,
      { id: 3, date: '2026-03-12', description: 'LIDL BRATISLAVA', amount: 24.89, type: 'expense' },
    ];
    const extracted = [
      { date: '2026-03-12', description: 'LIDL BRATISLAVA', amount: 24.89, type: 'expense' as const },
    ];

    const [match] = detectDuplicateTransactions(extracted, twice);
    expect(match.existingTransactions.map((row) => row.id)).toEqual([1, 3]);
    expect(match.similarityScore).toBeCloseTo(1, 10);
    // Reasons are de-duplicated across both matches.
    expect(match.matchReasons).toHaveLength(3);
  });

  it('returns an empty array when there is nothing to compare', () => {
    expect(detectDuplicateTransactions([], existing)).toEqual([]);
    expect(
      detectDuplicateTransactions(
        [{ date: '2026-03-12', description: 'LIDL', amount: 1, type: 'expense' }],
        [],
      ),
    ).toEqual([]);
  });

  it('flags same date + same amount even with a different description (user confirms)', () => {
    const extracted = [
      { date: '2026-03-12', description: 'XYZ', amount: 24.89, type: 'expense' as const },
    ];
    const [match] = detectDuplicateTransactions(extracted, existing);
    expect(match).toBeDefined();
    expect(match.similarityScore).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });
});
