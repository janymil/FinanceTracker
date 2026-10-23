import { describe, expect, it } from 'vitest';
import {
  checkBudget,
  checkImport,
  checkPdf,
  checkReceiptDraft,
  checkSummary,
  checkVoiceDraft,
} from '@shared/invariants';

function pdfBytes(header: string, size = 2_000): Uint8Array {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < header.length; i++) bytes[i] = header.charCodeAt(i);
  return bytes;
}

describe('checkSummary', () => {
  it('accepts a consistent summary', () => {
    expect(
      checkSummary({
        totalIncomeInCents: 500_00,
        totalExpensesInCents: 300_00,
        netBalanceInCents: 200_00,
        categories: [
          { amountInCents: 200_00, type: 'expense' },
          { amountInCents: 100_00, type: 'expense' },
          { amountInCents: 500_00, type: 'income' },
        ],
        savingsRate: 40,
      }),
    ).toEqual([]);
  });

  it('catches a balance that does not add up', () => {
    const violations = checkSummary({
      totalIncomeInCents: 500_00,
      totalExpensesInCents: 300_00,
      netBalanceInCents: 199_99,
    });
    expect(violations).toEqual([
      { code: 'summary.balance_mismatch', expected: 200_00, actual: 199_99 },
    ]);
  });

  it('catches categories that do not sum to the expense total', () => {
    const violations = checkSummary({
      totalIncomeInCents: 0,
      totalExpensesInCents: 300_00,
      netBalanceInCents: -300_00,
      categories: [{ amountInCents: 299_00, type: 'expense' }],
    });
    expect(violations.map((v) => v.code)).toEqual(['summary.categories_mismatch']);
  });

  it('flags a one-cent drift, because cents are integers', () => {
    const violations = checkSummary({
      totalIncomeInCents: 100,
      totalExpensesInCents: 300_00,
      netBalanceInCents: 100 - 300_00 + 1,
      categories: [
        { amountInCents: 300_00, type: 'expense' },
        { amountInCents: 99_99, type: 'income' },
      ],
    });
    expect(violations.map((v) => v.code)).toEqual(['summary.balance_mismatch']);
  });

  it('ignores income when summing categories', () => {
    expect(
      checkSummary({
        totalIncomeInCents: 500_00,
        totalExpensesInCents: 300_00,
        netBalanceInCents: 200_00,
        categories: [
          { amountInCents: 300_00, type: 'expense' },
          { amountInCents: 500_00, type: 'income' },
        ],
      }),
    ).toEqual([]);
  });

  it('flags an impossible savings rate', () => {
    const violations = checkSummary({
      totalIncomeInCents: 100,
      totalExpensesInCents: 0,
      netBalanceInCents: 100,
      savingsRate: 140,
    });
    expect(violations.map((v) => v.code)).toContain('summary.savings_rate_out_of_range');
  });
});

describe('checkImport', () => {
  const base = {
    textLength: 5_000,
    parsedCount: 10,
    importedCount: 8,
    duplicateCount: 2,
    rows: [{ date: '2026-03-01', amountCents: 1_234 }],
  };

  it('accepts a normal import', () => {
    expect(checkImport(base)).toEqual([]);
  });

  it('flags an empty result from a non-empty document', () => {
    const violations = checkImport({ ...base, parsedCount: 0, importedCount: 0, duplicateCount: 0, rows: [] });
    expect(violations.map((v) => v.code)).toEqual(['import.no_rows_from_text']);
  });

  it('flags duplicate accounting that loses rows', () => {
    const violations = checkImport({ ...base, importedCount: 7 });
    expect(violations.map((v) => v.code)).toEqual(['import.duplicate_accounting']);
  });

  it('counts rejected rows as parsed but not imported', () => {
    expect(checkImport({ ...base, parsedCount: 12, invalidCount: 2 })).toEqual([]);
  });

  it('flags a zero amount and an unparseable date', () => {
    const violations = checkImport({
      ...base,
      rows: [
        { date: '2026-03-01', amountCents: 0 },
        { date: 'not-a-date', amountCents: 500 },
      ],
    });
    expect(violations.map((v) => v.code)).toEqual([
      'import.row_amount_zero',
      'import.row_date_unparseable',
    ]);
  });
});

describe('checkReceiptDraft', () => {
  const now = Date.parse('2026-03-12T10:00:00.000Z');

  it('accepts a plausible receipt', () => {
    expect(checkReceiptDraft({ amount: 12.5, date: '2026-03-11', vendor: 'Tesco', now })).toEqual([]);
  });

  it('allows a missing amount but rejects a non-positive one', () => {
    expect(checkReceiptDraft({ amount: null, now })).toEqual([]);
    expect(checkReceiptDraft({ amount: 0, now }).map((v) => v.code)).toEqual([
      'receipt.amount_not_positive',
    ]);
    expect(checkReceiptDraft({ amount: -3, now }).map((v) => v.code)).toEqual([
      'receipt.amount_not_positive',
    ]);
  });

  it('rejects a date in the future and an unparseable one', () => {
    expect(checkReceiptDraft({ amount: 1, date: '2026-04-01', now }).map((v) => v.code)).toEqual([
      'receipt.date_in_future',
    ]);
    expect(checkReceiptDraft({ amount: 1, date: 'garbage', now }).map((v) => v.code)).toEqual([
      'receipt.date_unparseable',
    ]);
  });
});

describe('checkVoiceDraft', () => {
  it('only requires an amount when the parser claims confidence', () => {
    expect(checkVoiceDraft({ needsReview: true, amount: null })).toEqual([]);
    expect(checkVoiceDraft({ needsReview: false, amount: 12 })).toEqual([]);
    expect(checkVoiceDraft({ needsReview: false, amount: null }).map((v) => v.code)).toEqual([
      'voice.confident_without_amount',
    ]);
  });
});

describe('checkBudget', () => {
  it('accepts a consistent budget and catches a wrong remainder', () => {
    expect(
      checkBudget({ amountInCents: 30_000, spentInCents: 10_000, remainingInCents: 20_000 }),
    ).toEqual([]);
    expect(
      checkBudget({ amountInCents: 30_000, spentInCents: 10_000, remainingInCents: 19_000 }).map(
        (v) => v.code,
      ),
    ).toEqual(['budget.remaining_mismatch']);
  });

  it('flags negative spending', () => {
    expect(
      checkBudget({ amountInCents: 30_000, spentInCents: -1, remainingInCents: 30_001 }).map(
        (v) => v.code,
      ),
    ).toEqual(['budget.spent_negative']);
  });
});

describe('checkPdf', () => {
  it('accepts a real PDF', () => {
    expect(checkPdf(pdfBytes('%PDF-1.7'), '€')).toEqual([]);
  });

  it('rejects a wrong header, a tiny file and a nonsense currency symbol', () => {
    expect(checkPdf(pdfBytes('<html'), '€').map((v) => v.code)).toEqual(['pdf.bad_header']);
    expect(checkPdf(pdfBytes('%PDF-', 500), '€').map((v) => v.code)).toEqual(['pdf.too_small']);
    expect(checkPdf(pdfBytes('%PDF-1.7'), 'EUR — euro').map((v) => v.code)).toEqual([
      'pdf.currency_symbol_invalid',
    ]);
  });
});
