/**
 * Pure financial calculations shared by the API and the UI.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Before this module the same arithmetic lived in two places that could drift:
 *   - server: `storage.getUserFinancialSummary()` (server/storage.ts:972) —
 *     SQL `sum()` glued to Postgres, impossible to unit test;
 *   - client: ~40 inline `parseFloat(...).reduce(...)` calls in pages such as
 *     `transactions.tsx`, `expenses.tsx`, `calendar.tsx`, `trends.tsx`,
 *     `budget.tsx` and `ai-insights.tsx`.
 *
 * CONTRACT (see testing-blueprint/00-testing-strategy.md)
 * -------------------------------------------------
 * 1. Amounts are ALWAYS non-negative; the sign lives in `type`
 *    ('income' | 'expense'). Nothing here calls `Math.abs()` on a value whose
 *    sign is meaningful.
 * 2. A refund is an `income` row with `parentTransactionId` set. It counts into
 *    `totalIncome` (historical app behaviour) but is reported separately
 *    (`refunds*`) and excluded from `netIncome`, so the metric is unambiguous.
 * 3. All sums happen in integer cents; `*InCents` fields are the source of truth
 *    and the plain `number` fields are derived for backwards compatibility.
 * 4. Month buckets use the LOCAL wall clock, matching the charts in the client.
 * 5. Category names are opaque strings — never translated, never parsed here.
 */
import {
  absCents,
  centsToNumber,
  compareCents,
  parseAmountToCents,
  type AmountInput,
  type Cents,
} from './money';

export type TransactionType = 'income' | 'expense';
export type DateInput = Date | string;

/** Structural subset of `transactions` (shared/schema.ts) needed for maths. */
export interface TransactionLike {
  id?: number;
  amount: AmountInput;
  type: string;
  date: DateInput;
  categoryName?: string | null;
  parentTransactionId?: number | null;
}

export const UNCATEGORIZED = 'Uncategorized';

export interface CategoryTotal {
  categoryName: string;
  type: TransactionType;
  amountInCents: Cents;
  amount: number;
  transactionCount: number;
}

export interface FinancialSummary {
  totalIncomeInCents: Cents;
  totalExpensesInCents: Cents;
  netBalanceInCents: Cents;
  netIncomeInCents: Cents;
  refundsInCents: Cents;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  netIncome: number;
  refunds: number;
  incomeTransactionCount: number;
  expenseTransactionCount: number;
  totalTransactionCount: number;
  /** Rows whose `type` is neither 'income' nor 'expense'. */
  ignoredTransactionCount: number;
  transactionsByCategory: CategoryTotal[];
  expensesByCategory: CategoryTotal[];
  topExpenseCategory: CategoryTotal | null;
  /** netIncome / (netIncome - totalExpenses), null when netIncome <= 0. */
  savingsRate: number | null;
  savingsRateInBasisPoints: number | null;
}

export interface MonthlyTotals {
  monthKey: string; // "YYYY-MM" in local time
  incomeInCents: Cents;
  expensesInCents: Cents;
  netInCents: Cents;
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
}

/** Case/whitespace tolerant, but never silently guesses a type. */
export function normalizeTransactionType(type: string | null | undefined): TransactionType | null {
  if (!type) return null;
  const value = type.trim().toLowerCase();
  return value === 'income' || value === 'expense' ? value : null;
}

export function toDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${JSON.stringify(value)}`);
  }
  return date;
}

/** "2026-03" using the local calendar (same semantics as the UI charts). */
export function getMonthKey(value: DateInput): string {
  const date = toDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Inclusive on both ends — mirrors the SQL `gte` / `lte` used in storage.ts. */
export function isDateInRange(value: DateInput, start: DateInput, end: DateInput): boolean {
  const time = toDate(value).getTime();
  return time >= toDate(start).getTime() && time <= toDate(end).getTime();
}

export function filterByDateRange<T extends TransactionLike>(
  transactions: readonly T[],
  start: DateInput,
  end: DateInput,
): T[] {
  return transactions.filter((transaction) => isDateInRange(transaction.date, start, end));
}

/** First/last millisecond of a "YYYY-MM" bucket, local time. */
export function getMonthBounds(yearMonth: string): { startDate: Date; endDate: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) throw new RangeError(`Invalid month, expected YYYY-MM: ${yearMonth}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new RangeError(`Invalid month: ${yearMonth}`);
  return {
    startDate: new Date(year, month - 1, 1, 0, 0, 0, 0),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

function isRefund(transaction: TransactionLike, type: TransactionType): boolean {
  return type === 'income' && transaction.parentTransactionId !== null && transaction.parentTransactionId !== undefined;
}

function categoryNameOf(transaction: TransactionLike): string {
  const name = (transaction.categoryName ?? '').trim();
  return name === '' ? UNCATEGORIZED : name;
}

function compareCategoryTotals(a: CategoryTotal, b: CategoryTotal): number {
  const byAmount = compareCents(b.amountInCents, a.amountInCents);
  if (byAmount !== 0) return byAmount;
  if (a.categoryName === b.categoryName) return 0;
  return a.categoryName < b.categoryName ? -1 : 1;
}

/**
 * Groups credit/debit totals per category name, exactly like the SQL
 * `groupBy(categories.name, transactions.type)` in storage.ts.
 * Sorted biggest-first, then by name (deterministic, locale-independent).
 */
export function groupByCategory(
  transactions: readonly TransactionLike[],
  options: { type?: TransactionType } = {},
): CategoryTotal[] {
  const buckets = new Map<string, CategoryTotal>();

  for (const transaction of transactions) {
    const type = normalizeTransactionType(transaction.type);
    if (type === null) continue;
    if (options.type && type !== options.type) continue;

    const categoryName = categoryNameOf(transaction);
    const key = `${type}\u0000${categoryName}`;
    const existing = buckets.get(key);
    const cents = absCents(parseAmountToCents(transaction.amount));

    if (existing) {
      existing.amountInCents += cents;
      existing.transactionCount += 1;
    } else {
      buckets.set(key, {
        categoryName,
        type,
        amountInCents: cents,
        amount: 0,
        transactionCount: 1,
      });
    }
  }

  return Array.from(buckets.values())
    .map((total) => ({ ...total, amount: centsToNumber(total.amountInCents) }))
    .sort(compareCategoryTotals);
}

/** Highest-spending expense category, or null when there are no expenses. */
export function pickTopExpenseCategory(breakdown: readonly CategoryTotal[]): CategoryTotal | null {
  const expenses = breakdown.filter((total) => total.type === 'expense');
  if (expenses.length === 0) return null;
  return [...expenses].sort(compareCategoryTotals)[0] ?? null;
}

/**
 * The single source of truth for "how much did I earn / spend in this period".
 * Replaces both the SQL summary post-processing and the inline UI reducers.
 */
export function calculateFinancialSummary(transactions: readonly TransactionLike[]): FinancialSummary {
  let totalIncomeInCents: Cents = 0;
  let totalExpensesInCents: Cents = 0;
  let refundsInCents: Cents = 0;
  let incomeTransactionCount = 0;
  let expenseTransactionCount = 0;
  let ignoredTransactionCount = 0;

  for (const transaction of transactions) {
    const type = normalizeTransactionType(transaction.type);
    if (type === null) {
      ignoredTransactionCount += 1;
      continue;
    }

    const cents = absCents(parseAmountToCents(transaction.amount));

    if (type === 'income') {
      totalIncomeInCents += cents;
      incomeTransactionCount += 1;
      if (isRefund(transaction, type)) refundsInCents += cents;
    } else {
      totalExpensesInCents += cents;
      expenseTransactionCount += 1;
    }
  }

  const netIncomeInCents = totalIncomeInCents - refundsInCents;
  const netBalanceInCents = totalIncomeInCents - totalExpensesInCents;
  const transactionsByCategory = groupByCategory(transactions);

  let savingsRate: number | null = null;
  let savingsRateInBasisPoints: number | null = null;
  if (netIncomeInCents > 0) {
    const saved = netIncomeInCents - totalExpensesInCents;
    savingsRateInBasisPoints = Math.round((saved * 10_000) / netIncomeInCents);
    savingsRate = savingsRateInBasisPoints / 10_000;
  }

  return {
    totalIncomeInCents,
    totalExpensesInCents,
    netBalanceInCents,
    netIncomeInCents,
    refundsInCents,
    totalIncome: centsToNumber(totalIncomeInCents),
    totalExpenses: centsToNumber(totalExpensesInCents),
    netBalance: centsToNumber(netBalanceInCents),
    netIncome: centsToNumber(netIncomeInCents),
    refunds: centsToNumber(refundsInCents),
    incomeTransactionCount,
    expenseTransactionCount,
    totalTransactionCount: incomeTransactionCount + expenseTransactionCount,
    ignoredTransactionCount,
    transactionsByCategory,
    expensesByCategory: transactionsByCategory.filter((total) => total.type === 'expense'),
    topExpenseCategory: pickTopExpenseCategory(transactionsByCategory),
    savingsRate,
    savingsRateInBasisPoints,
  };
}

/**
 * Cash-flow per month, ascending — the data behind the trends/expenses charts.
 * Rows with an unknown `type` are ignored (same rule as the summary).
 */
export function groupTransactionsByMonth(transactions: readonly TransactionLike[]): MonthlyTotals[] {
  const buckets = new Map<string, MonthlyTotals>();

  for (const transaction of transactions) {
    const type = normalizeTransactionType(transaction.type);
    if (type === null) continue;

    const monthKey = getMonthKey(transaction.date);
    let bucket = buckets.get(monthKey);
    if (!bucket) {
      bucket = {
        monthKey,
        incomeInCents: 0,
        expensesInCents: 0,
        netInCents: 0,
        income: 0,
        expenses: 0,
        net: 0,
        transactionCount: 0,
      };
      buckets.set(monthKey, bucket);
    }

    const cents = absCents(parseAmountToCents(transaction.amount));
    if (type === 'income') bucket.incomeInCents += cents;
    else bucket.expensesInCents += cents;
    bucket.transactionCount += 1;
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const netInCents = bucket.incomeInCents - bucket.expensesInCents;
      return {
        monthKey: bucket.monthKey,
        incomeInCents: bucket.incomeInCents,
        expensesInCents: bucket.expensesInCents,
        netInCents,
        income: centsToNumber(bucket.incomeInCents),
        expenses: centsToNumber(bucket.expensesInCents),
        net: centsToNumber(netInCents),
        transactionCount: bucket.transactionCount,
      };
    })
    .sort((a, b) => (a.monthKey === b.monthKey ? 0 : a.monthKey < b.monthKey ? -1 : 1));
}

/**
 * Percentage change, rounded to 2 decimals.
 * `null` when the base is zero — never Infinity, never NaN.
 */
export function percentChange(previousInCents: Cents, currentInCents: Cents): number | null {
  if (previousInCents === 0) return null;
  const delta = currentInCents - previousInCents;
  return Math.round((delta * 10_000) / Math.abs(previousInCents)) / 100;
}

/** Month-over-month expense change from a monthly series (last two buckets). */
export function expenseChangeSincePreviousMonth(series: readonly MonthlyTotals[]): number | null {
  if (series.length < 2) return null;
  const previous = series[series.length - 2];
  const current = series[series.length - 1];
  return percentChange(previous.expensesInCents, current.expensesInCents);
}

/* ------------------------------------------------------------------------- *
 * Thin wrappers for UI call sites.
 *
 * These replace the `parseFloat(t.amount)` + `reduce` pattern that used to be
 * copy-pasted in ~40 components. They return plain numbers (what charts want)
 * but sum in integer cents internally, so the displayed totals cannot drift.
 * Unknown `type` values are ignored, exactly like calculateFinancialSummary.
 * ------------------------------------------------------------------------- */

/** Sum of |amount| over an already-filtered list, in cents. */
export function sumTransactionAmountsInCents(transactions: readonly TransactionLike[]): Cents {
  let total = 0;
  for (const transaction of transactions) {
    total += absCents(parseAmountToCents(transaction.amount));
  }
  return total;
}

/** Sum of |amount| over an already-filtered list, as a plain number. */
export function sumTransactionAmounts(transactions: readonly TransactionLike[]): number {
  return centsToNumber(sumTransactionAmountsInCents(transactions));
}

export function sumTransactionAmountsByTypeInCents(
  transactions: readonly TransactionLike[],
  type: TransactionType,
): Cents {
  let total = 0;
  for (const transaction of transactions) {
    if (normalizeTransactionType(transaction.type) !== type) continue;
    total += absCents(parseAmountToCents(transaction.amount));
  }
  return total;
}

export function sumTransactionAmountsByType(
  transactions: readonly TransactionLike[],
  type: TransactionType,
): number {
  return centsToNumber(sumTransactionAmountsByTypeInCents(transactions, type));
}

export interface NamedAmount {
  name: string;
  amount: number;
  amountInCents: Cents;
  transactionCount: number;
}

/** Category-name totals for an already-filtered list (e.g. only expenses). */
export function sumAmountsByCategoryName(
  transactions: readonly TransactionLike[],
  options: { type?: TransactionType } = {},
): NamedAmount[] {
  return groupByCategory(transactions, options).map((total) => ({
    name: total.categoryName,
    amount: total.amount,
    amountInCents: total.amountInCents,
    transactionCount: total.transactionCount,
  }));
}

/** Single-amount month buckets ("YYYY-MM", local time), ascending. */
export interface MonthlyAmount {
  monthKey: string;
  amountInCents: Cents;
  amount: number;
}

export function sumAmountsByMonthKey(transactions: readonly TransactionLike[]): MonthlyAmount[] {
  const buckets = new Map<string, Cents>();

  for (const transaction of transactions) {
    if (normalizeTransactionType(transaction.type) === null) continue;
    const monthKey = getMonthKey(transaction.date);
    buckets.set(monthKey, (buckets.get(monthKey) ?? 0) + absCents(parseAmountToCents(transaction.amount)));
  }

  return Array.from(buckets.entries())
    .map(([monthKey, amountInCents]) => ({
      monthKey,
      amountInCents,
      amount: centsToNumber(amountInCents),
    }))
    .sort((a, b) => (a.monthKey === b.monthKey ? 0 : a.monthKey < b.monthKey ? -1 : 1));
}
