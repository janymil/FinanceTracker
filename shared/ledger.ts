/**
 * One month of transactions, read the way the Transactions, Income and Expenses pages show it.
 *
 * The pages used to filter the whole history in the browser with the browser's own clock and
 * floating-point sums, each a little differently, and print every total as "$" + toFixed(2). This
 * is the single place that answers "what happened in this month" for them:
 *
 *   - rows are put in the month and the day the person lived them, in the account's time zone
 *     (the same rule as the dashboard, `shared/dashboardOverview`),
 *   - money is integer cents,
 *   - a row dated later than now is "scheduled": it belongs to the month but is not spent yet,
 *   - "usual" is the person's own average of the months before, never a fixed benchmark.
 *
 * It is pure: rows, a month and a clock in, numbers out. Rows keep their own type `T`, so a page
 * can open the edit form straight from a grouped day.
 */

import { localParts } from './timezones';
import { parseAmountToCents, shareOfTotalInBasisPoints, type Cents } from './money';
import { UNCATEGORIZED } from './calculations';

export interface LedgerTransaction {
  id: number;
  amount: string | number;
  type: string;
  date: string | Date;
  description?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  isRecurring?: boolean | null;
  parentTransactionId?: number | null;
}

export type MonthStatus = 'past' | 'current' | 'future';

export interface MonthClock {
  key: string;
  status: MonthStatus;
  daysInMonth: number;
  /** Days lived in the month, today included (the whole month once it is over, 0 before it). */
  daysElapsed: number;
  /** Days after today until the month ends (0 for a closed month). */
  daysLeft: number;
}

export interface LedgerDay<T> {
  key: string;
  incomeCents: Cents;
  expenseCents: Cents;
  /** Dated after now: a bill or a salary still to come. */
  scheduled: boolean;
  rows: T[];
}

export interface CategoryStat {
  key: string;
  categoryId: number | null;
  name: string;
  color: string | null;
  icon: string | null;
  cents: Cents;
  /** The part that is not fixed (not repeating): what a daily pace can be read from. */
  everydayCents: Cents;
  count: number;
  shareBp: number;
  /** The person's average for this category over the months before that had it; null without one. */
  usualCents: Cents | null;
  /** Rounded percent against `usualCents`. */
  changePct: number | null;
}

export interface Payee {
  name: string;
  cents: Cents;
  count: number;
}

export interface HistoryMonth {
  key: string;
  incomeCents: Cents;
  expenseCents: Cents;
}

export interface MonthLedger<T> {
  clock: MonthClock;
  /** Paid or received so far (scheduled rows excluded). */
  incomeCents: Cents;
  incomeCount: number;
  expenseCents: Cents;
  expenseCount: number;
  netCents: Cents;
  scheduledIncomeCents: Cents;
  scheduledExpenseCents: Cents;
  scheduledCount: number;
  /** Every row of the month, newest day first; scheduled days are flagged. */
  days: LedgerDay<T>[];
  expenseCategories: CategoryStat[];
  incomeCategories: CategoryStat[];
  uncategorizedCount: number;
  uncategorizedCents: Cents;
  /** Marked as repeating, or paid under the same name for about the same amount in two of the three months before. */
  recurringExpenseCents: Cents;
  everydayExpenseCents: Cents;
  recurringIncomeCents: Cents;
  oneOffIncomeCents: Cents;
  /** Where the money went, by what the person typed ("Lidl", "Uber"), largest first. */
  payees: Payee[];
  largestExpenses: T[];
  /** Everyday spending (not recurring) per day lived so far; null before any day was lived. */
  dailyAverageCents: Cents | null;
  /** Spent by the same day of the previous month; null for a closed or future month. */
  samePointLastMonthCents: Cents | null;
  /** Average spending of the three months before that had spending; null without them. */
  usualExpenseCents: Cents | null;
  /** Average income of the six months before that had income; null without them. */
  usualIncomeCents: Cents | null;
  /** Spent + still scheduled + everyday pace for the days left; current month from day 5 only. */
  projectedExpenseCents: Cents | null;
  /** Six months ending with this one, oldest first. */
  history: HistoryMonth[];
  /** How much monthly income moved over `history` (coefficient of variation, %); null under 3 months. */
  incomeVariationPct: number | null;
}

/** Before this day of the month a pace is one or two purchases, not a projection. */
export const PROJECTION_FROM_DAY = 5;
/** A payment counts as the same monthly one when its amount is within this share of before. */
const REPEAT_TOLERANCE = 0.1;
const DAY_MS = 86_400_000;

export function monthKeyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  return monthKeyOf(Math.floor(index / 12), (index % 12) + 1);
}

export function daysInMonthOf(key: string): number {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toInstant(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** The calendar day ("2026-10-05") an instant falls on in the zone. */
export function dayKeyIn(value: string | Date, timeZone: string): string {
  const { year, month, day } = localParts(toInstant(value), timeZone);
  return `${monthKeyOf(year, month)}-${String(day).padStart(2, '0')}`;
}

export function monthKeyIn(value: string | Date, timeZone: string): string {
  return dayKeyIn(value, timeZone).slice(0, 7);
}

export function isUncategorized(name: string | null | undefined): boolean {
  return !name || name === UNCATEGORIZED;
}

export function monthClock(key: string, now: Date, timeZone: string): MonthClock {
  const today = localParts(now, timeZone);
  const todayKey = monthKeyOf(today.year, today.month);
  const daysInMonth = daysInMonthOf(key);
  if (key < todayKey) return { key, status: 'past', daysInMonth, daysElapsed: daysInMonth, daysLeft: 0 };
  if (key > todayKey) return { key, status: 'future', daysInMonth, daysElapsed: 0, daysLeft: daysInMonth };
  return { key, status: 'current', daysInMonth, daysElapsed: today.day, daysLeft: daysInMonth - today.day };
}

/**
 * A label for grouping "LIDL 0423 Bratislava" and "Lidl" together: lower case, digits and
 * punctuation dropped, the first three words kept.
 */
export function payeeKey(description: string | null | undefined): string {
  return (description ?? '')
    .toLocaleLowerCase()
    .replace(/[0-9#*_.,;:!?/\\()[\]{}"'`+-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
}

function categoryKey(row: LedgerTransaction): string {
  if (row.categoryId != null) return `id:${row.categoryId}`;
  return `name:${row.categoryName ?? ''}`;
}

function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
}

export function buildMonthLedger<T extends LedgerTransaction>(
  rows: readonly T[],
  key: string,
  options: { timeZone: string; now?: Date },
): MonthLedger<T> {
  const { timeZone } = options;
  const now = options.now ?? new Date();
  const clock = monthClock(key, now, timeZone);
  const todayKey = dayKeyIn(now, timeZone);

  const historyKeys = [5, 4, 3, 2, 1, 0].map((back) => shiftMonth(key, -back));
  const history = new Map<string, HistoryMonth>(historyKeys.map((k) => [k, { key: k, incomeCents: 0, expenseCents: 0 }]));
  const usualSpendMonths = new Set([1, 2, 3].map((back) => shiftMonth(key, -back)));
  const usualIncomeMonths = new Set([1, 2, 3, 4, 5, 6].map((back) => shiftMonth(key, -back)));
  const monthTotals = new Map<string, { income: Cents; expense: Cents }>();
  const prevKey = shiftMonth(key, -1);
  let samePointLastMonth = 0;

  // Category spending per month before this one: the person's own usual month.
  const categoryHistory = new Map<string, Map<string, Cents>>();

  const days = new Map<string, LedgerDay<T>>();
  const expenseByCategory = new Map<string, CategoryStat>();
  const incomeByCategory = new Map<string, CategoryStat>();
  const payees = new Map<string, Payee & { latest: number }>();
  const monthExpenses: T[] = [];

  let incomeCents = 0;
  let incomeCount = 0;
  let expenseCents = 0;
  let expenseCount = 0;
  let scheduledIncomeCents = 0;
  let scheduledExpenseCents = 0;
  let scheduledCount = 0;
  let uncategorizedCount = 0;
  let uncategorizedCents = 0;
  let recurringExpenseCents = 0;
  let recurringIncomeCents = 0;

  // What the person paid or received under the same name in each of the three months before.
  // Rent typed by hand every month is fixed spending even if it was never marked as repeating.
  const priorByPayee = new Map<string, Map<string, Cents[]>>();
  for (const row of rows) {
    if (row.type !== 'income' && row.type !== 'expense') continue;
    const label = payeeKey(row.description);
    if (!label) continue;
    const instant = toInstant(row.date);
    if (!Number.isFinite(instant.getTime())) continue;
    const month = dayKeyIn(instant, timeZone).slice(0, 7);
    if (!usualSpendMonths.has(month)) continue;
    let cents: Cents;
    try {
      cents = Math.abs(parseAmountToCents(row.amount));
    } catch {
      continue;
    }
    const k = `${row.type}:${label}`;
    const perMonth = priorByPayee.get(k) ?? new Map<string, Cents[]>();
    perMonth.set(month, [...(perMonth.get(month) ?? []), cents]);
    priorByPayee.set(k, perMonth);
  }
  const repeatsMonthly = (row: LedgerTransaction, cents: Cents): boolean => {
    const perMonth = priorByPayee.get(`${row.type}:${payeeKey(row.description)}`);
    if (!perMonth) return false;
    let months = 0;
    for (const amounts of Array.from(perMonth.values())) {
      if (amounts.some((a) => Math.abs(a - cents) <= cents * REPEAT_TOLERANCE)) months += 1;
    }
    return months >= 2;
  };

  for (const row of rows) {
    const type = row.type === 'income' ? 'income' : row.type === 'expense' ? 'expense' : null;
    if (!type) continue;
    const instant = toInstant(row.date);
    if (!Number.isFinite(instant.getTime())) continue;
    let cents: Cents;
    try {
      cents = Math.abs(parseAmountToCents(row.amount));
    } catch {
      continue;
    }
    const rowDay = dayKeyIn(instant, timeZone);
    const rowMonth = rowDay.slice(0, 7);
    const scheduled = instant.getTime() > now.getTime();

    if (!scheduled) {
      const totals = monthTotals.get(rowMonth) ?? { income: 0, expense: 0 };
      if (type === 'income') totals.income += cents;
      else totals.expense += cents;
      monthTotals.set(rowMonth, totals);

      const bucket = history.get(rowMonth);
      if (bucket) {
        if (type === 'income') bucket.incomeCents += cents;
        else bucket.expenseCents += cents;
      }

      if (type === 'expense' && usualSpendMonths.has(rowMonth) && !isUncategorized(row.categoryName)) {
        const perMonth = categoryHistory.get(categoryKey(row)) ?? new Map<string, Cents>();
        perMonth.set(rowMonth, (perMonth.get(rowMonth) ?? 0) + cents);
        categoryHistory.set(categoryKey(row), perMonth);
      }

      if (type === 'expense' && rowMonth === prevKey && clock.status === 'current'
        && Number(rowDay.slice(8)) <= clock.daysElapsed) {
        samePointLastMonth += cents;
      }
    }

    if (rowMonth !== key) continue;

    const day = days.get(rowDay) ?? { key: rowDay, incomeCents: 0, expenseCents: 0, scheduled: rowDay > todayKey, rows: [] };
    day.rows.push(row);
    if (type === 'income') day.incomeCents += cents;
    else day.expenseCents += cents;
    days.set(rowDay, day);

    if (scheduled) {
      scheduledCount += 1;
      if (type === 'income') scheduledIncomeCents += cents;
      else scheduledExpenseCents += cents;
      continue;
    }

    const recurring = Boolean(row.isRecurring || row.parentTransactionId) || repeatsMonthly(row, cents);
    if (type === 'income') {
      incomeCents += cents;
      incomeCount += 1;
      if (recurring) recurringIncomeCents += cents;
    } else {
      expenseCents += cents;
      expenseCount += 1;
      monthExpenses.push(row);
      if (recurring) recurringExpenseCents += cents;
      if (isUncategorized(row.categoryName)) {
        uncategorizedCount += 1;
        uncategorizedCents += cents;
      }
      const label = payeeKey(row.description);
      if (label) {
        const entry = payees.get(label) ?? { name: (row.description ?? '').trim(), cents: 0, count: 0, latest: 0 };
        entry.cents += cents;
        entry.count += 1;
        // The name shown is the most recent spelling the person typed.
        if (instant.getTime() >= entry.latest) {
          entry.latest = instant.getTime();
          entry.name = (row.description ?? '').trim();
        }
        payees.set(label, entry);
      }
    }

    const target = type === 'income' ? incomeByCategory : expenseByCategory;
    const uncategorized = isUncategorized(row.categoryName);
    const k = uncategorized ? 'uncategorized' : categoryKey(row);
    const stat = target.get(k) ?? {
      key: k,
      categoryId: uncategorized ? null : row.categoryId ?? null,
      name: uncategorized ? UNCATEGORIZED : (row.categoryName as string),
      color: uncategorized ? null : row.categoryColor ?? null,
      icon: uncategorized ? null : row.categoryIcon ?? null,
      cents: 0,
      everydayCents: 0,
      count: 0,
      shareBp: 0,
      usualCents: null,
      changePct: null,
    };
    stat.cents += cents;
    if (!recurring) stat.everydayCents += cents;
    stat.count += 1;
    target.set(k, stat);
  }

  const finishCategories = (map: Map<string, CategoryStat>, total: Cents, withUsual: boolean) =>
    Array.from(map.values())
      .map((stat) => {
        stat.shareBp = shareOfTotalInBasisPoints(stat.cents, total);
        if (withUsual && stat.key !== 'uncategorized') {
          const months = categoryHistory.get(stat.key);
          stat.usualCents = months && months.size > 0 ? average(Array.from(months.values())) : null;
          stat.changePct = stat.usualCents && stat.usualCents > 0
            ? Math.round(((stat.cents - stat.usualCents) * 100) / stat.usualCents)
            : null;
        }
        return stat;
      })
      .sort((a, b) => b.cents - a.cents);

  const sortedDays = Array.from(days.values())
    .map((day) => ({
      ...day,
      rows: day.rows.sort((a, b) =>
        toInstant(b.date).getTime() - toInstant(a.date).getTime() || b.id - a.id),
    }))
    .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));

  const everydayExpenseCents = expenseCents - recurringExpenseCents;
  const dailyAverageCents = clock.daysElapsed > 0 ? Math.round(everydayExpenseCents / clock.daysElapsed) : null;

  const usualExpenseCents = average(
    Array.from(usualSpendMonths).map((k) => monthTotals.get(k)?.expense ?? 0).filter((c) => c > 0),
  );
  const usualIncomeCents = average(
    Array.from(usualIncomeMonths).map((k) => monthTotals.get(k)?.income ?? 0).filter((c) => c > 0),
  );

  let projectedExpenseCents: Cents | null = null;
  if (clock.status === 'current' && clock.daysElapsed >= PROJECTION_FROM_DAY && dailyAverageCents !== null) {
    projectedExpenseCents = expenseCents + scheduledExpenseCents + dailyAverageCents * clock.daysLeft;
  }

  const historyList = historyKeys.map((k) => history.get(k)!);
  // Only months the person was already recording count: an empty first month is not "income fell".
  const incomeMonths = historyList.filter((m) => m.key !== key || clock.status === 'past').map((m) => m.incomeCents).filter((c) => c > 0);
  let incomeVariationPct: number | null = null;
  if (incomeMonths.length >= 3) {
    const mean = incomeMonths.reduce((s, c) => s + c, 0) / incomeMonths.length;
    const variance = incomeMonths.reduce((s, c) => s + (c - mean) ** 2, 0) / incomeMonths.length;
    incomeVariationPct = mean > 0 ? Math.round((Math.sqrt(variance) * 100) / mean) : null;
  }

  return {
    clock,
    incomeCents,
    incomeCount,
    expenseCents,
    expenseCount,
    netCents: incomeCents - expenseCents,
    scheduledIncomeCents,
    scheduledExpenseCents,
    scheduledCount,
    days: sortedDays,
    expenseCategories: finishCategories(expenseByCategory, expenseCents, true),
    incomeCategories: finishCategories(incomeByCategory, incomeCents, false),
    uncategorizedCount,
    uncategorizedCents,
    recurringExpenseCents,
    everydayExpenseCents,
    recurringIncomeCents,
    oneOffIncomeCents: incomeCents - recurringIncomeCents,
    payees: Array.from(payees.values())
      .map(({ latest: _latest, ...payee }) => payee)
      .sort((a, b) => b.cents - a.cents || b.count - a.count),
    largestExpenses: monthExpenses
      .slice()
      .sort((a, b) => Math.abs(parseAmountToCents(b.amount)) - Math.abs(parseAmountToCents(a.amount)))
      .slice(0, 3),
    dailyAverageCents,
    samePointLastMonthCents: clock.status === 'current' ? samePointLastMonth : null,
    usualExpenseCents,
    usualIncomeCents,
    projectedExpenseCents,
    history: historyList,
    incomeVariationPct,
  };
}

/** Whole days from today to a calendar day key in the zone (0 = today, negative = past). */
export function daysUntil(dayKey: string, now: Date, timeZone: string): number {
  const today = localParts(now, timeZone);
  const [y, m, d] = dayKey.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.year, today.month - 1, today.day)) / DAY_MS);
}

/**
 * Rows grouped by the day they happened in the zone, newest day first, with each day's totals.
 * Used where the rows are not one month (a search across every month).
 */
export function groupByDay<T extends LedgerTransaction>(
  rows: readonly T[],
  options: { timeZone: string; now?: Date },
): LedgerDay<T>[] {
  const now = options.now ?? new Date();
  const todayKey = dayKeyIn(now, options.timeZone);
  const days = new Map<string, LedgerDay<T>>();
  for (const row of rows) {
    const instant = toInstant(row.date);
    if (!Number.isFinite(instant.getTime())) continue;
    let cents: Cents;
    try {
      cents = Math.abs(parseAmountToCents(row.amount));
    } catch {
      continue;
    }
    const key = dayKeyIn(instant, options.timeZone);
    const day = days.get(key) ?? { key, incomeCents: 0, expenseCents: 0, scheduled: key > todayKey, rows: [] };
    day.rows.push(row);
    if (row.type === 'income') day.incomeCents += cents;
    else if (row.type === 'expense') day.expenseCents += cents;
    days.set(key, day);
  }
  return Array.from(days.values())
    .map((day) => ({
      ...day,
      rows: day.rows.sort((a, b) => toInstant(b.date).getTime() - toInstant(a.date).getTime() || b.id - a.id),
    }))
    .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}
