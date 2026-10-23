import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  calculateFinancialSummary,
  expenseChangeSincePreviousMonth,
  filterByDateRange,
  getMonthBounds,
  getMonthKey,
  groupByCategory,
  groupTransactionsByMonth,
  isDateInRange,
  normalizeTransactionType,
  percentChange,
  pickTopExpenseCategory,
  sumAmountsByCategoryName,
  sumAmountsByMonthKey,
  sumTransactionAmounts,
  sumTransactionAmountsByType,
  sumTransactionAmountsByTypeInCents,
  type TransactionLike,
} from '../../shared/calculations';

interface Fixture {
  meta: Record<string, unknown>;
  transactions: TransactionLike[];
  expected: {
    march: {
      range: { start: string; end: string };
      totalIncomeInCents: number;
      totalExpensesInCents: number;
      netBalanceInCents: number;
      netIncomeInCents: number;
      refundsInCents: number;
      incomeTransactionCount: number;
      expenseTransactionCount: number;
      totalTransactionCount: number;
      ignoredTransactionCount: number;
      topExpenseCategory: { categoryName: string; amountInCents: number; transactionCount: number };
      savingsRateInBasisPoints: number;
      expensesByCategory: Array<{ categoryName: string; amountInCents: number; transactionCount: number }>;
    };
    fullDataset: {
      totalIncomeInCents: number;
      totalExpensesInCents: number;
      netBalanceInCents: number;
      incomeTransactionCount: number;
      expenseTransactionCount: number;
    };
    months: Array<{
      monthKey: string;
      incomeInCents: number;
      expensesInCents: number;
      netInCents: number;
      transactionCount: number;
    }>;
    expenseChangeFebToMarPercent: number;
  };
}

const fixture: Fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/transactions-march-2026.sk.json', import.meta.url)), 'utf8'),
);

const marchRows = () =>
  filterByDateRange(fixture.transactions, fixture.expected.march.range.start, fixture.expected.march.range.end);

const expenseRows = (rows: TransactionLike[]) =>
  rows.filter((row) => normalizeTransactionType(row.type) === 'expense');

const asComparable = (rows: Array<{ categoryName: string; amountInCents: number; transactionCount: number }>) =>
  rows.map((row) => ({
    categoryName: row.categoryName,
    amountInCents: row.amountInCents,
    transactionCount: row.transactionCount,
  }));

describe('fixture integrity', () => {
  it('has the documented shape: 15 expenses, 3 incomes, 1 refund, 2 February rows', () => {
    const march = marchRows();
    expect(expenseRows(march)).toHaveLength(15);
    expect(march.filter((row) => row.type === 'income')).toHaveLength(4); // 3 incomes + 1 refund
    expect(march.filter((row) => row.parentTransactionId)).toHaveLength(1);

    const february = fixture.transactions.filter((row) => getMonthKey(row.date) === '2026-02');
    expect(february).toHaveLength(2);
    expect(fixture.transactions).toHaveLength(21);
  });
});

describe('calculateFinancialSummary — March 2026 golden dataset', () => {
  it('matches every hand-computed total to the cent', () => {
    const summary = calculateFinancialSummary(marchRows());
    const expected = fixture.expected.march;

    expect(summary.totalIncomeInCents).toBe(expected.totalIncomeInCents);
    expect(summary.totalExpensesInCents).toBe(expected.totalExpensesInCents);
    expect(summary.netBalanceInCents).toBe(expected.netBalanceInCents);
    expect(summary.netIncomeInCents).toBe(expected.netIncomeInCents);
    expect(summary.refundsInCents).toBe(expected.refundsInCents);
  });

  it('exposes the same numbers as plain amounts for backwards compatibility', () => {
    const summary = calculateFinancialSummary(marchRows());
    expect(summary.totalIncome).toBe(3499.99);
    expect(summary.totalExpenses).toBe(1286.08);
    expect(summary.netBalance).toBe(2213.91);
  });

  it('counts transactions of each type', () => {
    const summary = calculateFinancialSummary(marchRows());
    expect(summary.incomeTransactionCount).toBe(fixture.expected.march.incomeTransactionCount);
    expect(summary.expenseTransactionCount).toBe(fixture.expected.march.expenseTransactionCount);
    expect(summary.totalTransactionCount).toBe(fixture.expected.march.totalTransactionCount);
    expect(summary.ignoredTransactionCount).toBe(fixture.expected.march.ignoredTransactionCount);
  });

  it('breaks expenses down per category, biggest first', () => {
    const summary = calculateFinancialSummary(marchRows());
    expect(asComparable(summary.expensesByCategory)).toEqual(fixture.expected.march.expensesByCategory);
    expect(summary.expensesByCategory.map((row) => row.categoryName)).toEqual([
      'Bývanie',
      'Nákup',
      'Potraviny',
      'Doprava',
      'Dary',
      'Stravovanie',
      'Zábava',
      'Zdravie',
      'Predplatné',
    ]);
  });

  it('picks the top expense category', () => {
    const summary = calculateFinancialSummary(marchRows());
    expect(summary.topExpenseCategory).toMatchObject(fixture.expected.march.topExpenseCategory);
  });

  it('reports refunds separately: in totalIncome, out of netIncome', () => {
    const summary = calculateFinancialSummary(marchRows());
    // App behaviour kept: the refund lands in totalIncome ...
    expect(summary.totalIncomeInCents).toBe(325000 + 24999);
    // ... but netIncome tells the honest story.
    expect(summary.netIncomeInCents).toBe(325000);
    expect(summary.refundsInCents).toBe(24999);
  });

  it('computes the savings rate in basis points', () => {
    const summary = calculateFinancialSummary(marchRows());
    expect(summary.savingsRateInBasisPoints).toBe(fixture.expected.march.savingsRateInBasisPoints);
    expect(summary.savingsRate).toBeCloseTo(0.6043, 4);
  });

  it('includes rows on the first and last millisecond of the month', () => {
    const bounds = getMonthBounds('2026-03');
    expect(marchRows().some((row) => row.id === 4)).toBe(true); // 2026-03-01T00:10
    expect(marchRows().some((row) => row.id === 15)).toBe(true); // 2026-03-31T23:50
    expect(isDateInRange(bounds.startDate, bounds.startDate, bounds.endDate)).toBe(true);
    expect(isDateInRange(bounds.endDate, bounds.startDate, bounds.endDate)).toBe(true);
    expect(isDateInRange(new Date(2026, 3, 1, 0, 0, 0, 1), bounds.startDate, bounds.endDate)).toBe(false);
  });

  it('excludes the February rows from the March range', () => {
    const marchIds = marchRows().map((row) => row.id);
    expect(marchIds).not.toContain(19);
    expect(marchIds).not.toContain(20);
  });

  it('summarises the whole dataset when no range filter is applied', () => {
    const summary = calculateFinancialSummary(fixture.transactions);
    expect(summary.totalIncomeInCents).toBe(fixture.expected.fullDataset.totalIncomeInCents);
    expect(summary.totalExpensesInCents).toBe(fixture.expected.fullDataset.totalExpensesInCents);
    expect(summary.netBalanceInCents).toBe(fixture.expected.fullDataset.netBalanceInCents);
    expect(summary.incomeTransactionCount).toBe(fixture.expected.fullDataset.incomeTransactionCount);
    expect(summary.expenseTransactionCount).toBe(fixture.expected.fullDataset.expenseTransactionCount);
  });
});

describe('edge cases', () => {
  it('returns zeros (not NaN) for an empty period', () => {
    const summary = calculateFinancialSummary([]);
    expect(summary.totalIncomeInCents).toBe(0);
    expect(summary.totalExpensesInCents).toBe(0);
    expect(summary.netBalanceInCents).toBe(0);
    expect(summary.totalTransactionCount).toBe(0);
    expect(summary.topExpenseCategory).toBeNull();
    expect(summary.savingsRate).toBeNull();
    expect(summary.transactionsByCategory).toEqual([]);
  });

  it('returns null savingsRate instead of Infinity when there is no income', () => {
    const summary = calculateFinancialSummary([
      { amount: '10.00', type: 'expense', date: '2026-03-05T10:00:00', categoryName: 'Potraviny' },
    ]);
    expect(summary.savingsRate).toBeNull();
    expect(summary.savingsRateInBasisPoints).toBeNull();
    expect(summary.netBalanceInCents).toBe(-1000);
  });

  it('ignores unknown transaction types but counts them', () => {
    const rows: TransactionLike[] = [
      { amount: '10.00', type: 'expense', date: '2026-03-05T10:00:00', categoryName: 'Potraviny' },
      { amount: '99.00', type: 'transfer', date: '2026-03-06T10:00:00', categoryName: 'Interné' },
      { amount: '1.00', type: '', date: '2026-03-07T10:00:00', categoryName: 'Interné' },
    ];
    const summary = calculateFinancialSummary(rows);
    expect(summary.totalExpensesInCents).toBe(1000);
    expect(summary.ignoredTransactionCount).toBe(2);
  });

  it('maps a missing category name to "Uncategorized"', () => {
    const summary = calculateFinancialSummary([
      { amount: '5.00', type: 'expense', date: '2026-03-05T10:00:00', categoryName: null },
    ]);
    expect(summary.expensesByCategory[0].categoryName).toBe('Uncategorized');
  });

  it('treats amount-less rows as zero instead of crashing', () => {
    const summary = calculateFinancialSummary([
      { amount: null, type: 'expense', date: '2026-03-05T10:00:00', categoryName: 'Neznáme' },
    ]);
    expect(summary.totalExpensesInCents).toBe(0);
    expect(summary.expenseTransactionCount).toBe(1);
  });

  it('is locale agnostic: category names are passed through, never translated', () => {
    const englishRows: TransactionLike[] = [
      { amount: '100.00', type: 'expense', date: '2026-03-02T10:00:00', categoryName: 'Groceries' },
      { amount: '40.00', type: 'expense', date: '2026-03-03T10:00:00', categoryName: 'Transport' },
    ];
    expect(calculateFinancialSummary(englishRows).topExpenseCategory?.categoryName).toBe('Groceries');
    expect(calculateFinancialSummary(marchRows()).topExpenseCategory?.categoryName).toBe('Bývanie');
  });

  it('buckets UTC timestamps (production shape) into the right local month', () => {
    const series = groupTransactionsByMonth([
      { amount: '10.00', type: 'expense', date: '2026-03-15T12:00:00.000Z', categoryName: 'Potraviny' },
      { amount: '20.00', type: 'expense', date: '2026-04-15T12:00:00.000Z', categoryName: 'Potraviny' },
    ]);
    expect(series.map((bucket) => bucket.monthKey)).toEqual(['2026-03', '2026-04']);
  });

  it('rejects an invalid date instead of producing a bogus bucket', () => {
    expect(() => getMonthKey('not-a-date')).toThrow(RangeError);
    expect(() => getMonthBounds('2026-13')).toThrow(RangeError);
    expect(() => getMonthBounds('2026/03')).toThrow(RangeError);
  });
});

describe('UI wrappers (cent-exact replacements for parseFloat reducers)', () => {
  it('sums an already-filtered list', () => {
    expect(sumTransactionAmounts(fixture.transactions)).toBe(5341.07);
  });

  it('filters by type inside the helper', () => {
    expect(sumTransactionAmountsByType(marchRows(), 'income')).toBe(3499.99);
    expect(sumTransactionAmountsByType(marchRows(), 'expense')).toBe(1286.08);
    expect(sumTransactionAmountsByTypeInCents(marchRows(), 'expense')).toBe(128608);
  });

  it('ignores unknown types instead of producing NaN', () => {
    const rows: TransactionLike[] = [
      { amount: '10.00', type: 'expense', date: '2026-03-01T10:00:00', categoryName: 'A' },
      { amount: '10.00', type: 'transfer', date: '2026-03-01T10:00:00', categoryName: 'B' },
    ];
    expect(sumTransactionAmountsByType(rows, 'expense')).toBe(10);
    expect(sumTransactionAmountsByType(rows, 'income')).toBe(0);
  });

  it('returns category names with cent-exact amounts, biggest first', () => {
    const [top] = sumAmountsByCategoryName(marchRows(), { type: 'expense' });
    expect(top).toEqual({ name: 'Bývanie', amount: 648.5, amountInCents: 64850, transactionCount: 3 });
  });

  it('builds single-amount month buckets', () => {
    expect(sumAmountsByMonthKey(fixture.transactions)).toEqual([
      { monthKey: '2026-02', amountInCents: 55500, amount: 555 },
      { monthKey: '2026-03', amountInCents: 478607, amount: 4786.07 },
    ]);
  });
});

describe('groupTransactionsByMonth', () => {
  it('builds the February -> March cash-flow series', () => {
    const series = groupTransactionsByMonth(fixture.transactions);
    expect(series.map((bucket) => bucket.monthKey)).toEqual(['2026-02', '2026-03']);
    expect(
      series.map((bucket) => ({
        monthKey: bucket.monthKey,
        incomeInCents: bucket.incomeInCents,
        expensesInCents: bucket.expensesInCents,
        netInCents: bucket.netInCents,
        transactionCount: bucket.transactionCount,
      })),
    ).toEqual(fixture.expected.months);
  });

  it('computes month-over-month expense change', () => {
    const series = groupTransactionsByMonth(fixture.transactions);
    expect(expenseChangeSincePreviousMonth(series)).toBe(fixture.expected.expenseChangeFebToMarPercent);
  });

  it('returns no change for a single month', () => {
    const series = groupTransactionsByMonth(marchRows());
    expect(series).toHaveLength(1);
    expect(expenseChangeSincePreviousMonth(series)).toBeNull();
  });
});

describe('percentChange', () => {
  it('returns null instead of Infinity on a zero base', () => {
    expect(percentChange(0, 5000)).toBeNull();
  });

  it('handles growth, decline and flat periods', () => {
    expect(percentChange(100000, 125000)).toBe(25);
    expect(percentChange(100000, 75000)).toBe(-25);
    expect(percentChange(100000, 100000)).toBe(0);
  });

  it('rounds to 2 decimals', () => {
    expect(percentChange(30000, 40000)).toBe(33.33);
  });
});

describe('groupByCategory / pickTopExpenseCategory', () => {
  it('splits income and expense buckets for the same name', () => {
    const rows: TransactionLike[] = [
      { amount: '10.00', type: 'expense', date: '2026-03-01T10:00:00', categoryName: 'Bonus' },
      { amount: '50.00', type: 'income', date: '2026-03-02T10:00:00', categoryName: 'Bonus' },
    ];
    const totals = groupByCategory(rows);
    expect(totals).toHaveLength(2);
    expect(totals.find((row) => row.type === 'income')?.amountInCents).toBe(5000);
    expect(totals.find((row) => row.type === 'expense')?.amountInCents).toBe(1000);
  });

  it('filters by type when asked', () => {
    const totals = groupByCategory(fixture.transactions, { type: 'income' });
    expect(totals.map((row) => row.categoryName).sort()).toEqual([
      'Dividendy',
      'Freelance',
      'Mzda',
      'Predaj',
      'Refundácie',
    ]);
  });

  it('orders ties by name so the output is deterministic', () => {
    const rows: TransactionLike[] = [
      { amount: '10.00', type: 'expense', date: '2026-03-01T10:00:00', categoryName: 'Zebra' },
      { amount: '10.00', type: 'expense', date: '2026-03-02T10:00:00', categoryName: 'Alfa' },
    ];
    expect(groupByCategory(rows).map((row) => row.categoryName)).toEqual(['Alfa', 'Zebra']);
  });

  it('returns null when there are no expenses', () => {
    expect(pickTopExpenseCategory([])).toBeNull();
  });
});
