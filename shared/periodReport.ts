/**
 * A report for any stretch of calendar days, compared with the stretch before it.
 *
 * The Reports page used to ask the server for a summary of one period and filter the history in
 * the browser for another, with the browser's clock, so the cards and the chart could disagree.
 * This reads both periods from the same rows, in the account's time zone, in integer cents.
 * Rows dated after now are left out of every total and counted separately: a bill still to come
 * is not money spent yet.
 */

import { localParts } from './timezones';
import { parseAmountToCents, shareOfTotalInBasisPoints, type Cents } from './money';
import { UNCATEGORIZED } from './calculations';
import { dayKeyIn, isUncategorized, monthKeyOf, shiftMonth, type LedgerTransaction } from './ledger';

export type ReportPreset = 'month' | 'last_month' | 'quarter' | 'year' | 'last_12_months' | 'custom';

export interface DayRange {
  /** "2026-10-01", inclusive */
  start: string;
  /** "2026-10-31", inclusive */
  end: string;
}

export interface ReportCategory {
  key: string;
  name: string;
  color: string | null;
  icon: string | null;
  cents: Cents;
  count: number;
  shareBp: number;
  previousCents: Cents;
  /** Rounded percent against the previous period; null when it had none. */
  changePct: number | null;
}

export interface ReportMonth {
  key: string;
  incomeCents: Cents;
  expenseCents: Cents;
  netCents: Cents;
  savingsRateBp: number | null;
}

export interface PeriodReport<T> {
  range: DayRange;
  previousRange: DayRange;
  incomeCents: Cents;
  expenseCents: Cents;
  netCents: Cents;
  incomeCount: number;
  expenseCount: number;
  /** Share of income kept; null without income. */
  savingsRateBp: number | null;
  previous: { incomeCents: Cents; expenseCents: Cents; netCents: Cents; hasData: boolean };
  incomeChangePct: number | null;
  expenseChangePct: number | null;
  expenseCategories: ReportCategory[];
  incomeCategories: ReportCategory[];
  months: ReportMonth[];
  largestExpenses: T[];
  /** Spending per day lived in the period so far; null before the period started. */
  dailyExpenseCents: Cents | null;
  scheduledExpenseCents: Cents;
}

const pad = (n: number) => String(n).padStart(2, '0');

function dayFromUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function utcOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function lastDayOf(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return dayFromUtc(Date.UTC(y, m, 0));
}

/** The period a preset means today in the zone, and the one it is compared with. */
export function presetRanges(preset: Exclude<ReportPreset, 'custom'>, now: Date, timeZone: string): { range: DayRange; previous: DayRange } {
  const today = localParts(now, timeZone);
  const thisMonth = monthKeyOf(today.year, today.month);
  const span = (fromMonth: string, months: number): DayRange => ({
    start: `${fromMonth}-01`,
    end: lastDayOf(shiftMonth(fromMonth, months - 1)),
  });

  switch (preset) {
    case 'month':
      return { range: span(thisMonth, 1), previous: span(shiftMonth(thisMonth, -1), 1) };
    case 'last_month':
      return { range: span(shiftMonth(thisMonth, -1), 1), previous: span(shiftMonth(thisMonth, -2), 1) };
    case 'quarter': {
      const first = monthKeyOf(today.year, today.month - ((today.month - 1) % 3));
      return { range: span(first, 3), previous: span(shiftMonth(first, -3), 3) };
    }
    case 'year':
      return { range: span(`${today.year}-01`, 12), previous: span(`${today.year - 1}-01`, 12) };
    case 'last_12_months': {
      const first = shiftMonth(thisMonth, -11);
      return { range: span(first, 12), previous: span(shiftMonth(first, -12), 12) };
    }
  }
}

/** The same number of days immediately before a custom range. */
export function previousOf(range: DayRange): DayRange {
  const length = Math.round((utcOf(range.end) - utcOf(range.start)) / 86_400_000) + 1;
  const end = utcOf(range.start) - 86_400_000;
  return { start: dayFromUtc(end - (length - 1) * 86_400_000), end: dayFromUtc(end) };
}

function pct(current: Cents, previous: Cents): number | null {
  return previous > 0 ? Math.round(((current - previous) * 100) / previous) : null;
}

function rate(income: Cents, expense: Cents): number | null {
  return income > 0 ? Math.round(((income - expense) * 10_000) / income) : null;
}

export function buildPeriodReport<T extends LedgerTransaction>(
  rows: readonly T[],
  range: DayRange,
  previousRange: DayRange,
  options: { timeZone: string; now?: Date },
): PeriodReport<T> {
  const { timeZone } = options;
  const now = options.now ?? new Date();
  const todayKey = dayKeyIn(now, timeZone);

  let incomeCents = 0;
  let expenseCents = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let scheduledExpenseCents = 0;
  const previous = { incomeCents: 0, expenseCents: 0, netCents: 0, hasData: false };
  const categories = { income: new Map<string, ReportCategory>(), expense: new Map<string, ReportCategory>() };
  const previousByCategory = { income: new Map<string, Cents>(), expense: new Map<string, Cents>() };
  const months = new Map<string, ReportMonth>();
  const expenses: T[] = [];

  // Every month the range touches gets a line, empty ones included: a gap is information.
  for (let key = range.start.slice(0, 7); key <= range.end.slice(0, 7); key = shiftMonth(key, 1)) {
    months.set(key, { key, incomeCents: 0, expenseCents: 0, netCents: 0, savingsRateBp: null });
  }

  for (const row of rows) {
    const type = row.type === 'income' ? 'income' : row.type === 'expense' ? 'expense' : null;
    if (!type) continue;
    const instant = row.date instanceof Date ? row.date : new Date(row.date);
    if (!Number.isFinite(instant.getTime())) continue;
    let cents: Cents;
    try {
      cents = Math.abs(parseAmountToCents(row.amount));
    } catch {
      continue;
    }
    const day = dayKeyIn(instant, timeZone);
    const scheduled = instant.getTime() > now.getTime();
    const key = isUncategorized(row.categoryName)
      ? 'uncategorized'
      : row.categoryId != null ? `id:${row.categoryId}` : `name:${row.categoryName}`;

    if (day >= previousRange.start && day <= previousRange.end && !scheduled) {
      previous.hasData = true;
      if (type === 'income') previous.incomeCents += cents;
      else previous.expenseCents += cents;
      const map = previousByCategory[type];
      map.set(key, (map.get(key) ?? 0) + cents);
      continue;
    }

    if (day < range.start || day > range.end) continue;
    if (scheduled) {
      if (type === 'expense') scheduledExpenseCents += cents;
      continue;
    }

    const month = months.get(day.slice(0, 7));
    if (type === 'income') {
      incomeCents += cents;
      incomeCount += 1;
      if (month) month.incomeCents += cents;
    } else {
      expenseCents += cents;
      expenseCount += 1;
      expenses.push(row);
      if (month) month.expenseCents += cents;
    }

    const map = categories[type];
    const stat = map.get(key) ?? {
      key,
      name: key === 'uncategorized' ? UNCATEGORIZED : (row.categoryName as string),
      color: key === 'uncategorized' ? null : row.categoryColor ?? null,
      icon: key === 'uncategorized' ? null : row.categoryIcon ?? null,
      cents: 0,
      count: 0,
      shareBp: 0,
      previousCents: 0,
      changePct: null,
    };
    stat.cents += cents;
    stat.count += 1;
    map.set(key, stat);
  }

  previous.netCents = previous.incomeCents - previous.expenseCents;

  const finish = (type: 'income' | 'expense', total: Cents) =>
    Array.from(categories[type].values())
      .map((stat) => {
        stat.shareBp = shareOfTotalInBasisPoints(stat.cents, total);
        stat.previousCents = previousByCategory[type].get(stat.key) ?? 0;
        stat.changePct = pct(stat.cents, stat.previousCents);
        return stat;
      })
      .sort((a, b) => b.cents - a.cents);

  const lastLived = todayKey < range.end ? todayKey : range.end;
  const daysLived = lastLived < range.start
    ? 0
    : Math.round((utcOf(lastLived) - utcOf(range.start)) / 86_400_000) + 1;

  return {
    range,
    previousRange,
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    incomeCount,
    expenseCount,
    savingsRateBp: rate(incomeCents, expenseCents),
    previous,
    incomeChangePct: previous.hasData ? pct(incomeCents, previous.incomeCents) : null,
    expenseChangePct: previous.hasData ? pct(expenseCents, previous.expenseCents) : null,
    expenseCategories: finish('expense', expenseCents),
    incomeCategories: finish('income', incomeCents),
    months: Array.from(months.values()).map((m) => ({
      ...m,
      netCents: m.incomeCents - m.expenseCents,
      savingsRateBp: rate(m.incomeCents, m.expenseCents),
    })),
    largestExpenses: expenses
      .sort((a, b) => Math.abs(parseAmountToCents(b.amount)) - Math.abs(parseAmountToCents(a.amount)))
      .slice(0, 5),
    dailyExpenseCents: daysLived > 0 ? Math.round(expenseCents / daysLived) : null,
    scheduledExpenseCents,
  };
}
