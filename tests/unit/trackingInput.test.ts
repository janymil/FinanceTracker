import { describe, expect, it } from 'vitest';
import {
  cleanPositiveAmount,
  cleanNonNegativeAmount,
  cleanDateValue,
  cleanText,
  cleanId,
  neutralizeSpreadsheetCell,
  csvField,
} from '@shared/trackingInput';

describe('cleanPositiveAmount', () => {
  it('accepts numbers and numeric strings and rounds to cents', () => {
    expect(cleanPositiveAmount(12.5)).toBe('12.50');
    expect(cleanPositiveAmount('1200')).toBe('1200.00');
    expect(cleanPositiveAmount(0.1 + 0.2)).toBe('0.30');
    expect(cleanPositiveAmount(' 7.999 ')).toBe('8.00');
  });

  it('rejects zero, negatives, junk and out-of-range values', () => {
    for (const bad of [0, '0', -5, '-5', 'abc', '12abc', NaN, Infinity, '', null, undefined, {}, [], true, 1e12, '0.001']) {
      expect(cleanPositiveAmount(bad)).toBeNull();
    }
  });
});

describe('cleanNonNegativeAmount', () => {
  it('lets goal progress be zero', () => {
    expect(cleanNonNegativeAmount(0)).toBe('0.00');
    expect(cleanNonNegativeAmount('0')).toBe('0.00');
    expect(cleanNonNegativeAmount(250)).toBe('250.00');
    expect(cleanNonNegativeAmount(-1)).toBeNull();
  });
});

describe('cleanDateValue', () => {
  it('parses real dates and refuses everything else', () => {
    expect(cleanDateValue('2026-10-31')?.toISOString()).toBe('2026-10-31T00:00:00.000Z');
    expect(cleanDateValue('not a date')).toBeNull();
    expect(cleanDateValue('')).toBeNull();
    expect(cleanDateValue(undefined)).toBeNull();
    expect(cleanDateValue({})).toBeNull();
  });
});

describe('cleanText and cleanId', () => {
  it('trims text and enforces the length limit', () => {
    expect(cleanText('  Rent ', 10)).toBe('Rent');
    expect(cleanText('   ', 10)).toBeNull();
    expect(cleanText('x'.repeat(11), 10)).toBeNull();
    expect(cleanText(42, 10)).toBeNull();
  });

  it('accepts only positive integer ids', () => {
    expect(cleanId('12')).toBe(12);
    expect(cleanId(7)).toBe(7);
    for (const bad of ['0', '-1', '1.5', '12abc', '', 'abc', null, undefined, '99999999999']) {
      expect(cleanId(bad)).toBeNull();
    }
  });
});

describe('spreadsheet safety', () => {
  it('defuses cells a spreadsheet would run as a formula', () => {
    expect(neutralizeSpreadsheetCell('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(neutralizeSpreadsheetCell('+1 555')).toBe(`'+1 555`);
    expect(neutralizeSpreadsheetCell('-cmd')).toBe(`'-cmd`);
    expect(neutralizeSpreadsheetCell('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(neutralizeSpreadsheetCell('Groceries')).toBe('Groceries');
    expect(neutralizeSpreadsheetCell(null)).toBe('');
  });

  it('quotes CSV fields and doubles inner quotes', () => {
    expect(csvField('Coffee, "large"')).toBe('"Coffee, ""large"""');
    expect(csvField('=1+1')).toBe(`"'=1+1"`);
    expect(csvField(undefined)).toBe('""');
  });
});
