/**
 * Money invariants (blueprint 07 §18).
 *
 * The failure class that matters most in a finance app throws nothing: a total that is off
 * by a cent, an import that yields zero rows, a receipt parsed without an amount. These
 * functions turn "should always be true" into a checkable list of violations.
 *
 * Pure, isomorphic and side-effect free: the caller decides what to do (report, log, throw).
 * Money is handled in integer cents, like `shared/money.ts`.
 */

export interface InvariantViolation {
  /** Stable machine code, e.g. `summary.balance_mismatch`. */
  code: string;
  expected: number | string | null;
  actual: number | string | null;
}

/**
 * Money is integer cents, so "close enough" does not exist: a one-cent difference is a bug.
 * The comparison is exact on purpose (blueprint 07 §18).
 */
const TOLERANCE = 0;

export interface SummaryInvariantInput {
  totalIncomeInCents: number;
  totalExpensesInCents: number;
  netBalanceInCents: number;
  /** `transactionsByCategory` as storage returns it. */
  categories?: Array<{ amountInCents?: number | null; type?: string | null }>;
  savingsRate?: number | null;
}

export function checkSummary(input: SummaryInvariantInput): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  const expectedBalance = input.totalIncomeInCents - input.totalExpensesInCents;
  if (Math.abs(expectedBalance - input.netBalanceInCents) > TOLERANCE) {
    violations.push({
      code: 'summary.balance_mismatch',
      expected: expectedBalance,
      actual: input.netBalanceInCents,
    });
  }

  if (Array.isArray(input.categories) && input.categories.length > 0) {
    const categoryTotal = input.categories
      .filter((entry) => entry.type === undefined || entry.type === 'expense')
      .reduce((sum, entry) => sum + Number(entry.amountInCents ?? 0), 0);
    if (Math.abs(categoryTotal - input.totalExpensesInCents) > TOLERANCE) {
      violations.push({
        code: 'summary.categories_mismatch',
        expected: input.totalExpensesInCents,
        actual: categoryTotal,
      });
    }
  }

  if (typeof input.savingsRate === 'number' && Number.isFinite(input.savingsRate)) {
    if (input.savingsRate < -100 || input.savingsRate > 100) {
      violations.push({
        code: 'summary.savings_rate_out_of_range',
        expected: 'between -100 and 100',
        actual: input.savingsRate,
      });
    }
  }

  return violations;
}

export interface ImportInvariantInput {
  /** Length of the extracted text; a non-empty document must produce rows. */
  textLength: number;
  parsedCount: number;
  importedCount: number;
  duplicateCount: number;
  /** Rows the validator rejected — they still came out of the parser. */
  invalidCount?: number;
  rows: Array<{ date?: string | Date | null; amountCents?: number | null }>;
}

export function checkImport(input: ImportInvariantInput): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (input.textLength > 200 && input.parsedCount === 0) {
    violations.push({
      code: 'import.no_rows_from_text',
      expected: 'at least 1 row',
      actual: 0,
    });
  }

  const accounted = input.importedCount + input.duplicateCount + (input.invalidCount ?? 0);
  if (accounted !== input.parsedCount) {
    violations.push({
      code: 'import.duplicate_accounting',
      expected: input.parsedCount,
      actual: accounted,
    });
  }

  input.rows.forEach((row, index) => {
    if (row.amountCents == null || row.amountCents === 0) {
      violations.push({
        code: 'import.row_amount_zero',
        expected: 'non-zero amount',
        actual: `${index}:${row.amountCents ?? 'null'}`,
      });
    }
    if (row.date != null) {
      const parsed = row.date instanceof Date ? row.date : new Date(row.date);
      if (Number.isNaN(parsed.getTime())) {
        violations.push({
          code: 'import.row_date_unparseable',
          expected: 'parseable date',
          actual: `${index}:${String(row.date).slice(0, 24)}`,
        });
      }
    }
  });

  return violations;
}

export interface ReceiptDraftInvariantInput {
  /** Amount in major units as parsed from the receipt (e.g. 12.5). */
  amount: number | null | undefined;
  date?: string | Date | null;
  vendor?: string | null;
  now?: number;
}

export function checkReceiptDraft(input: ReceiptDraftInvariantInput): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (input.amount != null && !(input.amount > 0)) {
    violations.push({
      code: 'receipt.amount_not_positive',
      expected: '> 0',
      actual: input.amount,
    });
  }

  if (input.date != null) {
    const parsed = input.date instanceof Date ? input.date : new Date(input.date);
    if (Number.isNaN(parsed.getTime())) {
      violations.push({
        code: 'receipt.date_unparseable',
        expected: 'parseable date',
        actual: String(input.date).slice(0, 24),
      });
    } else if (parsed.getTime() > (input.now ?? Date.now()) + 86_400_000) {
      violations.push({
        code: 'receipt.date_in_future',
        expected: 'today or earlier',
        actual: parsed.toISOString().slice(0, 10),
      });
    }
  }

  if (input.vendor != null && String(input.vendor).length > 100) {
    violations.push({
      code: 'receipt.vendor_too_long',
      expected: '<= 100 characters',
      actual: String(input.vendor).length,
    });
  }

  return violations;
}

export interface VoiceDraftInvariantInput {
  needsReview: boolean;
  amount?: number | null;
}

export function checkVoiceDraft(input: VoiceDraftInvariantInput): InvariantViolation[] {
  if (input.needsReview) return [];
  if (input.amount == null) {
    return [{ code: 'voice.confident_without_amount', expected: 'an amount', actual: null }];
  }
  return [];
}

export interface BudgetInvariantInput {
  amountInCents: number;
  spentInCents: number;
  remainingInCents: number;
}

export function checkBudget(input: BudgetInvariantInput): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (input.spentInCents < 0) {
    violations.push({ code: 'budget.spent_negative', expected: '>= 0', actual: input.spentInCents });
  }

  const expectedRemaining = input.amountInCents - input.spentInCents;
  if (Math.abs(expectedRemaining - input.remainingInCents) > TOLERANCE) {
    violations.push({
      code: 'budget.remaining_mismatch',
      expected: expectedRemaining,
      actual: input.remainingInCents,
    });
  }

  return violations;
}

/** `%PDF-` header, sane size, and a currency symbol that is not a whole sentence. */
export function checkPdf(bytes: Uint8Array | Buffer, currencySymbol?: string | null): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (bytes.length < 1_000) {
    violations.push({ code: 'pdf.too_small', expected: '>= 1000 bytes', actual: bytes.length });
  }

  // Isomorphic on purpose: no Buffer, because `shared/` is also bundled for the browser.
  const header = Array.from(bytes.slice(0, 5))
    .map((byte) => String.fromCharCode(byte))
    .join('');
  if (header !== '%PDF-') {
    violations.push({ code: 'pdf.bad_header', expected: '%PDF-', actual: header.slice(0, 5) });
  }

  if (currencySymbol != null && (currencySymbol.length === 0 || currencySymbol.length > 5)) {
    violations.push({
      code: 'pdf.currency_symbol_invalid',
      expected: '1..5 characters',
      actual: currencySymbol.slice(0, 10),
    });
  }

  return violations;
}
