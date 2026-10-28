import { describe, expect, it } from 'vitest';
import { matchReceiptYearToText } from '../../shared/receiptExtraction';

/**
 * The year the model gets wrong.
 *
 * A real receipt was printed "05 AGO. 2026"; the extraction returned `2025-08-05`, the expense
 * was saved a year in the past, and the person who had just scanned it reported "it was not
 * saved" — the current month never showed it. The printed text is the ground truth for the
 * year, and only for the year: a different day or month is a different date (a print date, a
 * card expiry) and must stay as the model answered it.
 */

describe('matchReceiptYearToText', () => {
  it('takes the year the receipt prints, when the month is a Spanish word', () => {
    const text = 'DRA. ROXANNA LUZ REYES TELLO\n[address] 2do. Piso\nTel. [phone]\n05 AGO. 2026\nCANCELADO';

    expect(matchReceiptYearToText('2025-08-05', text)).toBe('2026-08-05');
  });

  it.each([
    ['05 AUG 2026', '2025-08-05', '2026-08-05'],
    ['5 de agosto de 2026', '2025-08-05', '2026-08-05'],
    ['05. augusta 2026', '2025-08-05', '2026-08-05'],
    ['05/08/2026', '2025-08-05', '2026-08-05'],
    ['05.08.2026', '2025-08-05', '2026-08-05'],
    ['2026-08-05', '2025-08-05', '2026-08-05'],
  ])('corrects the year from "%s"', (text, modelDate, expected) => {
    expect(matchReceiptYearToText(modelDate, text)).toBe(expected);
  });

  it('leaves the model alone when the text agrees with it', () => {
    expect(matchReceiptYearToText('2026-08-05', '05 AGO. 2026')).toBe('2026-08-05');
  });

  it('leaves the model alone when the text has a different day or month', () => {
    // A print date, a card expiry or a "valid until" is not the purchase date.
    expect(matchReceiptYearToText('2025-08-05', '12 SET. 2026')).toBe('2025-08-05');
    expect(matchReceiptYearToText('2025-08-05', '05 SET. 2026')).toBe('2025-08-05');
  });

  it('leaves the model alone when the text offers two different years', () => {
    const text = '05 AGO. 2026\nReimprimir: 05 AGO. 2027';
    expect(matchReceiptYearToText('2025-08-05', text)).toBe('2025-08-05');
  });

  it('leaves the model alone when the text carries no year for that date', () => {
    expect(matchReceiptYearToText('2025-08-05', 'TOTAL S/ 40.00\nCANCELADO')).toBe('2025-08-05');
  });

  it('ignores a year that is not a valid calendar date', () => {
    expect(matchReceiptYearToText('2025-08-05', '05 AGO. 1899')).toBe('2025-08-05');
  });

  it('never changes a null date, or a date that is not YYYY-MM-DD', () => {
    expect(matchReceiptYearToText(null, '05 AGO. 2026')).toBeNull();
    expect(matchReceiptYearToText('05/08/2025', '05 AGO. 2026')).toBe('05/08/2025');
    expect(matchReceiptYearToText('2025-08-05', '')).toBe('2025-08-05');
  });
});
