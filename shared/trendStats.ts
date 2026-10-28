/**
 * The figures behind the Trends page, computed from the person's own months.
 *
 * Its three headline cards used to be fixed text ("Positive", "Low", "stable patterns") whatever
 * the data said, and "spent per category" added salaries to spending. Everything here is derived:
 *
 *   - direction: is the money kept per month getting better or worse (second half of the closed
 *     months against the first half),
 *   - volatility: how much monthly spending moves (coefficient of variation),
 *   - category trends: the last three closed months against the three before, spending only,
 *   - patterns: everyday spending (recurring payments left out, the rent is not a habit) per
 *     weekday and per part of the month, as an average per day rather than a lifetime total, so
 *     a weekday that occurs more often in the range does not look more expensive.
 *
 * The month in progress is shown but never used to judge a trend: half a month is not a drop.
 */

import { localParts } from './timezones';
import { parseAmountToCents, type Cents } from './money';
import { UNCATEGORIZED } from './calculations';
import { dayKeyIn, daysInMonthOf, isUncategorized, monthKeyOf, shiftMonth, type LedgerTransaction } from './ledger';

export interface TrendMonth {
  key: string;
  incomeCents: Cents;
  expenseCents: Cents;
  netCents: Cents;
  /** The month in progress: shown, never judged. */
  partial: boolean;
}

export type Direction = 'improving' | 'worsening' | 'steady';
export type Volatility = 'low' | 'medium' | 'high';

export interface CategoryTrend {
  key: string;
  name: string;
  color: string | null;
  /** Spending per month over the range, oldest first, aligned with `months`. */
  series: Cents[];
  totalCents: Cents;
  /** Average of the last three closed months. */
  recentAverageCents: Cents;
  /** Average of the three closed months before those; null when there were none. */
  priorAverageCents: Cents | null;
  changePct: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface TrendStats {
  months: TrendMonth[];
  closedMonths: number;
  direction: Direction | null;
  /** Average monthly net of the newer half minus the older half. */
  directionDeltaCents: Cents | null;
  bestMonth: TrendMonth | null;
  worstMonth: TrendMonth | null;
  volatility: Volatility | null;
  volatilityPct: number | null;
  averageExpenseCents: Cents | null;
  averageIncomeCents: Cents | null;
  categories: CategoryTrend[];
  /** Average everyday spending per calendar day, Monday first. */
  weekdays: Cents[];
  /** Average everyday spending per day in days 1-10, 11-20 and 21-end. */
  monthThirds: [Cents, Cents, Cents];
  /** Most frequent everyday spending categories with their usual ticket. */
  frequent: { name: string; color: string | null; count: number; averageCents: Cents; totalCents: Cents }[];
}

/** Changes smaller than this share of average spending are "steady" / "flat". */
const STEADY_SHARE = 0.05;
const FLAT_PCT = 5;

function avg(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null;
}

export function buildTrendStats<T extends LedgerTransaction>(
  rows: readonly T[],
  monthCount: number,
  options: { timeZone: string; now?: Date },
): TrendStats {
  const { timeZone } = options;
  const now = options.now ?? new Date();
  const today = localParts(now, timeZone);
  const thisMonth = monthKeyOf(today.year, today.month);
  const keys = Array.from({ length: monthCount }, (_, i) => shiftMonth(thisMonth, i - monthCount + 1));
  const index = new Map(keys.map((k, i) => [k, i]));
  const months: TrendMonth[] = keys.map((key) => ({ key, incomeCents: 0, expenseCents: 0, netCents: 0, partial: key === thisMonth }));

  const categories = new Map<string, { name: string; color: string | null; series: Cents[] }>();
  const weekdayTotals = new Array<number>(7).fill(0);
  const thirdTotals = [0, 0, 0];
  const frequent = new Map<string, { name: string; color: string | null; count: number; totalCents: Cents }>();

  for (const row of rows) {
    const type = row.type === 'income' ? 'income' : row.type === 'expense' ? 'expense' : null;
    if (!type) continue;
    const instant = row.date instanceof Date ? row.date : new Date(row.date);
    if (!Number.isFinite(instant.getTime()) || instant.getTime() > now.getTime()) continue;
    let cents: Cents;
    try {
      cents = Math.abs(parseAmountToCents(row.amount));
    } catch {
      continue;
    }
    const day = dayKeyIn(instant, timeZone);
    const i = index.get(day.slice(0, 7));
    if (i === undefined) continue;

    if (type === 'income') {
      months[i].incomeCents += cents;
      continue;
    }
    months[i].expenseCents += cents;

    const uncategorized = isUncategorized(row.categoryName);
    const key = uncategorized ? 'uncategorized' : row.categoryId != null ? `id:${row.categoryId}` : `name:${row.categoryName}`;
    const cat = categories.get(key) ?? {
      name: uncategorized ? UNCATEGORIZED : (row.categoryName as string),
      color: uncategorized ? null : row.categoryColor ?? null,
      series: new Array<number>(monthCount).fill(0),
    };
    cat.series[i] += cents;
    categories.set(key, cat);

    if (row.isRecurring || row.parentTransactionId) continue;
    const [y, m, d] = day.split('-').map(Number);
    const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
    weekdayTotals[weekday] += cents;
    thirdTotals[d <= 10 ? 0 : d <= 20 ? 1 : 2] += cents;
    const f = frequent.get(key) ?? { name: cat.name, color: cat.color, count: 0, totalCents: 0 };
    f.count += 1;
    f.totalCents += cents;
    frequent.set(key, f);
  }

  for (const month of months) month.netCents = month.incomeCents - month.expenseCents;

  // Judge only closed months that had any activity: months before the person started are not data.
  const firstActive = months.findIndex((m) => m.incomeCents > 0 || m.expenseCents > 0);
  const closed = firstActive < 0 ? [] : months.slice(firstActive).filter((m) => !m.partial);

  // Calendar days lived since the person started recording, by weekday and by part of the month, for the averages.
  const weekdayDays = new Array<number>(7).fill(0);
  const thirdDays = [0, 0, 0];
  for (const key of firstActive < 0 ? [] : keys.slice(firstActive)) {
    const [y, m] = key.split('-').map(Number);
    const last = key === thisMonth ? today.day : daysInMonthOf(key);
    for (let d = 1; d <= last; d += 1) {
      weekdayDays[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7] += 1;
      thirdDays[d <= 10 ? 0 : d <= 20 ? 1 : 2] += 1;
    }
  }

  let direction: Direction | null = null;
  let directionDeltaCents: Cents | null = null;
  if (closed.length >= 2) {
    const half = Math.floor(closed.length / 2);
    const older = avg(closed.slice(0, half).map((m) => m.netCents)) ?? 0;
    const newer = avg(closed.slice(closed.length - half).map((m) => m.netCents)) ?? 0;
    directionDeltaCents = newer - older;
    const scale = Math.max(1, avg(closed.map((m) => m.expenseCents)) ?? 0);
    direction = Math.abs(directionDeltaCents) < scale * STEADY_SHARE
      ? 'steady'
      : directionDeltaCents > 0 ? 'improving' : 'worsening';
  }

  let volatility: Volatility | null = null;
  let volatilityPct: number | null = null;
  const spending = closed.map((m) => m.expenseCents).filter((c) => c > 0);
  if (spending.length >= 3) {
    const mean = spending.reduce((s, c) => s + c, 0) / spending.length;
    const sd = Math.sqrt(spending.reduce((s, c) => s + (c - mean) ** 2, 0) / spending.length);
    volatilityPct = Math.round((sd * 100) / mean);
    volatility = volatilityPct < 15 ? 'low' : volatilityPct < 35 ? 'medium' : 'high';
  }

  const best = closed.length ? closed.reduce((a, b) => (b.netCents > a.netCents ? b : a)) : null;
  const worst = closed.length ? closed.reduce((a, b) => (b.netCents < a.netCents ? b : a)) : null;

  const closedIndexes = months.map((m, i) => (!m.partial ? i : -1)).filter((i) => i >= 0);
  const recentIdx = closedIndexes.slice(-3);
  const priorIdx = closedIndexes.slice(-6, -3);

  const categoryTrends: CategoryTrend[] = Array.from(categories.entries())
    .map(([key, cat]) => {
      const recentAverageCents = avg(recentIdx.map((i) => cat.series[i])) ?? 0;
      const priorValues = priorIdx.map((i) => cat.series[i]);
      const priorAverageCents = priorValues.some((v) => v > 0) ? avg(priorValues) : null;
      const changePct = priorAverageCents && priorAverageCents > 0
        ? Math.round(((recentAverageCents - priorAverageCents) * 100) / priorAverageCents)
        : null;
      return {
        key,
        name: cat.name,
        color: cat.color,
        series: cat.series,
        totalCents: cat.series.reduce((s, c) => s + c, 0),
        recentAverageCents,
        priorAverageCents,
        changePct,
        direction: changePct === null || Math.abs(changePct) < FLAT_PCT ? 'flat' as const : changePct > 0 ? 'up' as const : 'down' as const,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents);

  return {
    months,
    closedMonths: closed.length,
    direction,
    directionDeltaCents,
    bestMonth: best,
    worstMonth: worst,
    volatility,
    volatilityPct,
    averageExpenseCents: avg(closed.map((m) => m.expenseCents)),
    averageIncomeCents: avg(closed.map((m) => m.incomeCents)),
    categories: categoryTrends,
    weekdays: weekdayTotals.map((total, i) => (weekdayDays[i] ? Math.round(total / weekdayDays[i]) : 0)),
    monthThirds: thirdTotals.map((total, i) => (thirdDays[i] ? Math.round(total / thirdDays[i]) : 0)) as [Cents, Cents, Cents],
    frequent: Array.from(frequent.values())
      .map((f) => ({ ...f, averageCents: Math.round(f.totalCents / f.count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  };
}
