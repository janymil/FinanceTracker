import { describe, expect, it } from 'vitest';
import {
  applyRegexFallback,
  extractAmountFromText,
  extractDateFromText,
  extractMerchantFromText,
  normalizeReceiptAmount,
  normalizeReceiptDate,
  normalizeReceiptExtraction,
  normalizeReceiptVendor,
  toLegacyExtractedReceipt,
} from '../../shared/receiptExtraction';

/**
 * Module 1 of step 3: the PURE half of receipt extraction.
 * No OpenAI client, no API key, no network — `shared/receiptExtraction` has no SDK imports.
 */

describe('normalizeReceiptAmount', () => {
  it('parses the formats OCR and models actually return', () => {
    expect(normalizeReceiptAmount('24.89')).toBe(2489);
    expect(normalizeReceiptAmount('12,50')).toBe(1250);
    expect(normalizeReceiptAmount('12,50 €')).toBe(1250);
    expect(normalizeReceiptAmount('24,89 EUR')).toBe(2489);       // ISO code stripped
    expect(normalizeReceiptAmount('1.234,56')).toBe(123456);
    expect(normalizeReceiptAmount('1,234.56')).toBe(123456);
    expect(normalizeReceiptAmount(24.89)).toBe(2489);
    expect(normalizeReceiptAmount(60)).toBe(6000);
  });

  it('fixes the old Number() bug on EU-formatted totals', () => {
    // Old code: Number('1.234,56') === NaN -> the amount was silently dropped.
    expect(Number('1.234,56')).toBeNaN();
    expect(normalizeReceiptAmount('1.234,56')).toBe(123456);
  });

  it('treats non-positive and unusable values as "no amount"', () => {
    expect(normalizeReceiptAmount(0)).toBeNull();
    expect(normalizeReceiptAmount('0,00')).toBeNull();
    expect(normalizeReceiptAmount(-5)).toBeNull();
    expect(normalizeReceiptAmount('-5,00')).toBeNull();
    expect(normalizeReceiptAmount(null)).toBeNull();
    expect(normalizeReceiptAmount(undefined)).toBeNull();
    expect(normalizeReceiptAmount('')).toBeNull();
    expect(normalizeReceiptAmount('   ')).toBeNull();
    expect(normalizeReceiptAmount('abc')).toBeNull();
    expect(normalizeReceiptAmount('€')).toBeNull();
    expect(normalizeReceiptAmount(Number.NaN)).toBeNull();
    expect(normalizeReceiptAmount(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('never returns a float', () => {
    for (const value of ['24.89', '1.234,56', 24.89, '12,50 €']) {
      expect(Number.isInteger(normalizeReceiptAmount(value))).toBe(true);
    }
  });
});

describe('normalizeReceiptDate', () => {
  it('passes valid ISO dates through', () => {
    expect(normalizeReceiptDate('2026-03-12')).toBe('2026-03-12');
    expect(normalizeReceiptDate(' 2026-03-12 ')).toBe('2026-03-12');
  });

  it('parses EU numeric formats instead of letting Date() guess US order', () => {
    // V8 reads '12.03.2026' as 3 December 2026 (m/d/y), not 12 March — a silently wrong date.
    // The old implementation did `new Date(dateStr)`, so EU receipts were stored with a
    // wrong month. Explicit parsing is the only safe option.
    expect(new Date('12.03.2026').getMonth()).toBe(11); // December
    expect(normalizeReceiptDate('12.03.2026')).toBe('2026-03-12');

    expect(new Date('1.2.26').getMonth()).toBe(0); // January
    expect(normalizeReceiptDate('1.2.26')).toBe('2026-02-01');

    expect(normalizeReceiptDate('12/03/2026')).toBe('2026-03-12');
    expect(normalizeReceiptDate('12-03-2026')).toBe('2026-03-12');
  });

  it('switches to US order only when the numbers force it', () => {
    expect(normalizeReceiptDate('25/12/2026')).toBe('2026-12-25'); // day > 12 -> EU
    expect(normalizeReceiptDate('12/25/2026')).toBe('2026-12-25'); // day > 12 -> US
    expect(normalizeReceiptDate('03/12/2026')).toBe('2026-12-03'); // ambiguous -> EU default
    expect(normalizeReceiptDate('13.13.2026')).toBeNull();         // impossible either way
  });

  it('rejects impossible calendar dates instead of rolling them over', () => {
    expect(normalizeReceiptDate('31.02.2026')).toBeNull();
    expect(normalizeReceiptDate('2026-13-01')).toBeNull();
    expect(normalizeReceiptDate('2026-00-10')).toBeNull();
    expect(normalizeReceiptDate('00.01.2026')).toBeNull();
  });

  it('handles textual formats and explicit zones', () => {
    expect(normalizeReceiptDate('March 12, 2026')).toBe('2026-03-12');
    expect(normalizeReceiptDate('2026-03-12T00:00:00Z')).toBe('2026-03-12');
  });

  it('returns null for garbage', () => {
    expect(normalizeReceiptDate('')).toBeNull();
    expect(normalizeReceiptDate(null)).toBeNull();
    expect(normalizeReceiptDate(undefined)).toBeNull();
    expect(normalizeReceiptDate('nie je datum')).toBeNull();
  });
});

describe('normalizeReceiptVendor', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeReceiptVendor('  Lidl  ')).toBe('Lidl');
    expect(normalizeReceiptVendor('Lidl\n  Slovakia')).toBe('Lidl Slovakia');
  });

  it('caps at 100 characters', () => {
    expect(normalizeReceiptVendor('a'.repeat(100))).toHaveLength(100);
    expect(normalizeReceiptVendor('a'.repeat(101))).toBeNull();
  });

  it('drops placeholders and empty values', () => {
    expect(normalizeReceiptVendor('')).toBeNull();
    expect(normalizeReceiptVendor('   ')).toBeNull();
    expect(normalizeReceiptVendor('N/A')).toBeNull();
    expect(normalizeReceiptVendor('n/a')).toBeNull();
    expect(normalizeReceiptVendor('unknown')).toBeNull();
    expect(normalizeReceiptVendor(null)).toBeNull();
    expect(normalizeReceiptVendor(undefined)).toBeNull();
  });

  it('coerces non-strings like the original implementation did', () => {
    expect(normalizeReceiptVendor(123)).toBe('123');
  });
});

describe('normalizeReceiptExtraction', () => {
  it('produces a cent-exact draft from a realistic model reply', () => {
    const draft = normalizeReceiptExtraction(
      { amount: '1.234,56', date: '12.03.2026', vendor: ' Alza ' },
      { provider: 'openai', model: 'gpt-6-luna' },
    );

    expect(draft.amountInCents).toBe(123456);
    expect(draft.date).toBe('2026-03-12');
    expect(draft.vendor).toBe('Alza');
    expect(draft.provider).toBe('openai');
    expect(draft.model).toBe('gpt-6-luna');
    expect(draft.error).toBeUndefined();
  });

  it('keeps the raw reply for debugging', () => {
    const raw = { amount: 24.89, date: '2026-03-12', vendor: 'Lidl' };
    expect(normalizeReceiptExtraction(raw).raw).toBe(raw);
  });

  it('returns an empty draft for non-object replies instead of throwing', () => {
    const draft = normalizeReceiptExtraction('```json not json at all');
    expect(draft.amountInCents).toBeNull();
    expect(draft.date).toBeNull();
    expect(draft.vendor).toBeNull();
    expect(draft.raw).toBe('```json not json at all');
  });

  it('returns an empty draft for arrays and empty objects', () => {
    expect(normalizeReceiptExtraction([]).amountInCents).toBeNull();
    expect(normalizeReceiptExtraction({})).toMatchObject({
      amountInCents: null,
      date: null,
      vendor: null,
    });
  });

  it('partially fills a draft when only some fields are usable', () => {
    const draft = normalizeReceiptExtraction({ amount: 'n/a', date: '2026-03-12', vendor: null });
    expect(draft.amountInCents).toBeNull();
    expect(draft.date).toBe('2026-03-12');
    expect(draft.vendor).toBeNull();
  });
});

describe('toLegacyExtractedReceipt', () => {
  it('restores the historical wire shape and omits nulls', () => {
    expect(
      toLegacyExtractedReceipt(
        normalizeReceiptExtraction({ amount: 24.89, date: '2026-03-12', vendor: 'Lidl' }),
      ),
    ).toEqual({ amount: 24.89, date: '2026-03-12', vendor: 'Lidl' });

    expect(toLegacyExtractedReceipt(normalizeReceiptExtraction({}))).toEqual({});
  });
});

describe('regex fallbacks (unwired by default)', () => {
  const ocrText = ['Lidl Slovakia', 'Datum: 12.03.2026', 'Mlieko 1,20 €', 'SPOLU 24,89 €'].join('\n');

  it('picks the last currency-marked number as the total', () => {
    expect(extractAmountFromText(ocrText)).toBe('24,89 €');
  });

  it('falls back to a "total/sum/celkom/spolu" keyword', () => {
    expect(extractAmountFromText('Celkom: 12,50')).toBe('12,50');
    expect(extractAmountFromText('Total 5.00')).toBe('5.00');
    expect(extractAmountFromText('ziadna suma')).toBeNull();
  });

  it('reads the merchant header and the first date token', () => {
    expect(extractMerchantFromText(ocrText)).toBe('Lidl Slovakia');
    expect(extractDateFromText(ocrText)).toBe('12.03.2026');
  });

  it('fills only the missing fields and normalizes them', () => {
    const filled = applyRegexFallback({}, ocrText);
    expect(filled).toEqual({ amount: 24.89, date: '2026-03-12', vendor: 'Lidl Slovakia' });

    const partial = applyRegexFallback({ amount: 999 }, ocrText);
    expect(partial.amount).toBe(999);          // model value wins
    expect(partial.date).toBe('2026-03-12');   // missing field filled
  });
});

