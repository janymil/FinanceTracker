import { describe, expect, it } from 'vitest';
import {
  MAX_ABS_CENTS,
  absCents,
  centsToDecimalString,
  centsToNumber,
  isValidAmount,
  parseAmountToCents,
  percentOrZero,
  roundToCents,
  shareOfTotalInBasisPoints,
  sumAmountsToCents,
} from '../../shared/money';

describe('parseAmountToCents — DB/API formats', () => {
  it('parses Postgres decimal(12,2) strings exactly', () => {
    expect(parseAmountToCents('84.30')).toBe(8430);
    expect(parseAmountToCents('1420.50')).toBe(142050);
    expect(parseAmountToCents('0.00')).toBe(0);
    expect(parseAmountToCents('9999999999.99')).toBe(MAX_ABS_CENTS);
  });

  it('parses numbers and single-decimal strings', () => {
    expect(parseAmountToCents(84.3)).toBe(8430);
    expect(parseAmountToCents('84.3')).toBe(8430);
    expect(parseAmountToCents('7')).toBe(700);
  });

  it('parses human / OCR / voice formats', () => {
    expect(parseAmountToCents('12,50')).toBe(1250);
    expect(parseAmountToCents('12,50 €')).toBe(1250);
    expect(parseAmountToCents(' 1 234,56 ')).toBe(123456);
    expect(parseAmountToCents('1.234,56')).toBe(123456);
    expect(parseAmountToCents('1,234.56')).toBe(123456);
    expect(parseAmountToCents('1.234.567')).toBe(123456700);
    expect(parseAmountToCents('1,234,567')).toBe(123456700);
  });

  it('keeps the sign', () => {
    expect(parseAmountToCents('-84.30')).toBe(-8430);
    expect(parseAmountToCents('-12,50 €')).toBe(-1250);
    expect(parseAmountToCents('+5.00')).toBe(500);
  });

  it('treats null / undefined / empty string as "no amount"', () => {
    expect(parseAmountToCents(null)).toBe(0);
    expect(parseAmountToCents(undefined)).toBe(0);
    expect(parseAmountToCents('')).toBe(0);
    expect(parseAmountToCents('   ')).toBe(0);
  });

  it('rounds half away from zero (commercial rounding)', () => {
    expect(parseAmountToCents('1.005')).toBe(101);
    expect(parseAmountToCents('2.675')).toBe(268);
    expect(parseAmountToCents('-2.675')).toBe(-268);
    expect(parseAmountToCents('0.004')).toBe(0);
    expect(parseAmountToCents('0.999')).toBe(100);
  });

  it('rejects garbage instead of silently returning NaN', () => {
    expect(() => parseAmountToCents('abc')).toThrow(RangeError);
    expect(() => parseAmountToCents('12.3.4')).toThrow(RangeError);
    expect(() => parseAmountToCents('€')).toThrow(RangeError);
    expect(() => parseAmountToCents(Number.NaN)).toThrow(RangeError);
    expect(() => parseAmountToCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('enforces the decimal(12,2) range', () => {
    expect(() => parseAmountToCents('10000000000.00')).toThrow(RangeError);
    expect(() => parseAmountToCents(1e13)).toThrow(RangeError);
  });
});

describe('sumAmountsToCents — the float-drift antidote', () => {
  it('sums cents exactly where parseFloat drifts', () => {
    // Classic binary float demo: 0.1 + 0.2 !== 0.3
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumAmountsToCents(['0.10', '0.20'])).toBe(30);

    // 100 rows of 0.07 must be exactly 7.00
    const rows = Array.from({ length: 100 }, () => '0.07');
    expect(sumAmountsToCents(rows)).toBe(700);
    expect(centsToNumber(sumAmountsToCents(rows))).toBe(7);
  });

  it('matches the hand-computed March fixture totals', () => {
    expect(sumAmountsToCents(['84.30', '62.15', '249.99', '60.00', '12.40'])).toBe(46884);
  });

  it('accepts mixed inputs in one pass', () => {
    expect(sumAmountsToCents(['1.10', 2.2, null, undefined, '3,30'])).toBe(660);
  });
});

describe('conversion helpers', () => {
  it('formats cents back to a decimal string', () => {
    expect(centsToDecimalString(8430)).toBe('84.30');
    expect(centsToDecimalString(5)).toBe('0.05');
    expect(centsToDecimalString(0)).toBe('0.00');
    expect(centsToDecimalString(-123456)).toBe('-1234.56');
  });

  it('round-trips every fixture amount', () => {
    const amounts = ['0.00', '4.50', '84.30', '1286.08', '9999999999.99'];
    for (const amount of amounts) {
      expect(centsToDecimalString(parseAmountToCents(amount))).toBe(amount);
    }
  });

  it('roundToCents delegates to the same rounding rule', () => {
    expect(roundToCents(2.675)).toBe(268);
    expect(roundToCents(-2.675)).toBe(-268);
    expect(roundToCents(0.1 + 0.2)).toBe(30);
  });

  it('absCents keeps integer cents', () => {
    expect(absCents(-8430)).toBe(8430);
    expect(absCents(8430)).toBe(8430);
  });

  it('refuses non-integer cents', () => {
    expect(() => centsToDecimalString(12.5)).toThrow(RangeError);
    expect(() => centsToNumber(0.1)).toThrow(RangeError);
  });
});

describe('shares and percentages', () => {
  it('computes basis points without floats', () => {
    // Bývanie 648.50 of 1286.08 = 50.42 %  (64850 * 10000 / 128608 = 5042.36 bp)
    expect(shareOfTotalInBasisPoints(64850, 128608)).toBe(5042);
    expect(shareOfTotalInBasisPoints(0, 128608)).toBe(0);
  });

  it('returns 0 instead of NaN/Infinity when total is zero', () => {
    expect(shareOfTotalInBasisPoints(100, 0)).toBe(0);
  });

  it('percentOrZero normalises nullable percentages', () => {
    expect(percentOrZero(12.345)).toBe(12.35);
    expect(percentOrZero(null)).toBe(0);
  });
});

describe('isValidAmount', () => {
  it('accepts parseable values and rejects the rest', () => {
    expect(isValidAmount('84.30')).toBe(true);
    expect(isValidAmount(84.3)).toBe(true);
    expect(isValidAmount('12,50 €')).toBe(true);
    expect(isValidAmount('')).toBe(false);
    expect(isValidAmount('abc')).toBe(false);
    expect(isValidAmount(null)).toBe(false);
  });
});
