/**
 * Everything the dashboard shows about one month, computed in one place.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The dashboard used to assemble its numbers from five requests and several components, each with
 * its own idea of "this month": the summary counted scheduled payments as already spent, the
 * snapshot card re-added the same totals in the browser, and the time zone was whatever the
 * browser happened to be in. The person saw the same income three times and still could not tell
 * how much was left.
 *
 * This module answers the questions the redesigned dashboard asks, from rows the server already
 * has, in the person's own time zone:
 *
 *   - how much is left after the bills that are still to come this month,
 *   - where the money went, against the person's own usual month,
 *   - what needs attention today (a bill due, a budget nearly used, rows without a category,
 *     a goal running out of time),
 *   - the last six months, and the health score with its change since the month before.
 *
 * It is pure: no database, no clock (the caller passes `now`), no AI. Money is integer cents.
 */
import { parseAmountToCents, shareOfTotalInBasisPoints, type AmountInput, type Cents } from './money';
import { UNCATEGORIZED } from './calculations';
import { budgetsForPeriod, calculateFinancialHealth, type FinancialHealth } from './financialHealth';
import { localParts, monthRange, calendarDaysRange } from './timezones';
import { loggingStreak } from './streaks';

export interface OverviewTransaction {
  id?: number;
  amount: AmountInput;
  type: string;
  date: Date | string;
  description?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  isRecurring?: boolean | null;
  parentTransactionId?: number | null;
}

export interface OverviewBudget {
  categoryName?: string | null;
  amount: AmountInput;
  spent?: number | null;
  startDate: Date | string;
  endDate: Date | string;
}

export interface OverviewGoal {
  id: number;
  name: string;
  targetAmount: AmountInput;
  currentAmount: AmountInput;
  targetDate: Date | string;
  status?: string | null;
}

/** A payment the person has said is coming: a recurring rule's next date, or a manual reminder. */
export interface OverviewBill {
  /** `recurring_<id>` or `reminder_<id>`: the client needs to know which ones it can mark as paid. */
  id: string;
  title: string;
  amount: AmountInput;
  dueDate: Date | string;
  source: 'recurring_transaction' | 'expense_reminder';
}

export interface OverviewInput {
  /** The month the dashboard is showing, 1-12. */
  year: number;
  month: number;
  timeZone: string;
  now: Date;
  /**
   * Every transaction from the first day of the trend window (five months before `month`) to the
   * end of `month`. Rows outside that window are ignored, so passing more is harmless.
   */
  transactions: readonly OverviewTransaction[];
  /** Transactions of roughly the last year, for the logging streak. Defaults to `transactions`. */
  streakTransactions?: readonly OverviewTransaction[];
  budgets: readonly OverviewBudget[];
  goals: readonly OverviewGoal[];
  bills: readonly OverviewBill[];
}

export type MonthStatus = 'past' | 'current' | 'future';

export interface CategoryLine {
  name: string;
  color: string | null;
  amountCents: Cents;
  /** Share of the month's spending, in basis points. */
  shareBp: number;
  purchases: number;
  /** Average month over the three months before, or null when there is no history to compare. */
  usualCents: Cents | null;
  /** Rounded percent against `usualCents`; null without a usual month. */
  changePct: number | null;
}

export type AttentionItem =
  | { kind: 'bill'; id: string; title: string; amountCents: Cents; dueDate: string; daysUntil: number; canComplete: boolean }
  | { kind: 'budget'; categoryName: string; spentCents: Cents; limitCents: Cents; percent: number; daysLeft: number }
  | { kind: 'uncategorized'; count: number; amountCents: Cents }
  | { kind: 'goal'; id: number; name: string; remainingCents: Cents; targetDate: string; daysLeft: number };

export interface GoalLine {
  id: number;
  name: string;
  savedCents: Cents;
  targetCents: Cents;
  /** 0-100, rounded down so "100%" means really reached. */
  percent: number;
  targetDate: string;
  /** What it takes per month from now to reach the target on time; null once reached or overdue. */
  monthlyNeededCents: Cents | null;
  reached: boolean;
  overdue: boolean;
}

export interface TrendMonth {
  /** yyyy-MM */
  key: string;
  incomeCents: Cents;
  expensesCents: Cents;
}

export interface DashboardOverview {
  month: { key: string; status: MonthStatus; day: number; daysInMonth: number; daysLeft: number };
  totals: {
    incomeCents: Cents;
    incomeCount: number;
    /** Paid so far: for the current month, rows dated up to now; for a past month, all of them. */
    spentCents: Cents;
    spentCount: number;
    /** Scheduled payments dated later this month plus recurring payments due before it ends. */
    upcomingCents: Cents;
    upcomingCount: number;
    /** income - spent - upcoming. Negative means the month is short. */
    leftCents: Cents;
    /** left / income in basis points; null without income. */
    leftShareBp: number | null;
  };
  /** The average share of income kept over the three months before; null without history. */
  usualKeptShareBp: number | null;
  previous: { key: string; expensesCents: Cents; keptCents: Cents; hasData: boolean };
  /** Current month only, once a few days have passed: where the month ends at this pace. */
  forecast: { spentCents: Cents; keptCents: Cents } | null;
  categories: CategoryLine[];
  uncategorized: { count: number; amountCents: Cents };
  health: FinancialHealth;
  previousHealthScore: number | null;
  trend: TrendMonth[];
  attention: AttentionItem[];
  goals: GoalLine[];
  streak: { current: number; loggedToday: boolean };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Before this day of the month a pace is one or two purchases, not a forecast. */
const FORECAST_FROM_DAY = 5;
/** A budget at or above this share of its limit is worth a look. */
const BUDGET_WARNING_BP = 8_500;
/** Bills due within this many days are shown. */
const BILL_WINDOW_DAYS = 7;
/** Goals whose target date is this close and that are not reached yet are shown. */
const GOAL_WINDOW_DAYS = 45;

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function toInstant(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function dayKey(instant: Date, timeZone: string): string {
  const { year, month, day } = localParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isUncategorized(name: string | null | undefined): boolean {
  return !name || name === UNCATEGORIZED;
}

/** Whole calendar days from today to `instant` in the zone (0 = today, negative = past). */
function daysFromToday(instant: Date, now: Date, timeZone: string): number {
  const a = localParts(now, timeZone);
  const b = localParts(instant, timeZone);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

interface MonthBucket {
  incomeCents: Cents;
  incomeCount: number;
  expensesCents: Cents;
  hasRows: boolean;
}

export function buildDashboardOverview(input: OverviewInput): DashboardOverview {
  const { year, month, timeZone, now } = input;
  const key = monthKey(year, month);
  const range = monthRange(year, month, timeZone);
  const today = localParts(now, timeZone);
  const currentKey = monthKey(today.year, today.month);
  const status: MonthStatus = key === currentKey ? 'current' : key < currentKey ? 'past' : 'future';
  const daysInMonth = localParts(range.end, timeZone).day;
  const day = status === 'current' ? today.day : status === 'past' ? daysInMonth : 0;
  const daysLeft = status === 'current' ? daysInMonth - today.day : status === 'future' ? daysInMonth : 0;

  // Six months of income and spending, ending with the month on screen.
  const trendKeys: string[] = [];
  for (let back = 5; back >= 0; back--) {
    const m = shiftMonth(year, month, -back);
    trendKeys.push(monthKey(m.year, m.month));
  }
  const buckets = new Map<string, MonthBucket>(
    trendKeys.map((k) => [k, { incomeCents: 0, incomeCount: 0, expensesCents: 0, hasRows: false }]),
  );

  let spentCents = 0;
  let spentCount = 0;
  let upcomingCents = 0;
  let upcomingCount = 0;
  let variableSpentCents = 0;
  let monthIncomeAll = 0;
  let monthExpensesAll = 0;
  const byCategory = new Map<string, { amountCents: Cents; purchases: number; color: string | null }>();
  const uncategorized = { count: 0, amountCents: 0 };
  // Per category, per month, for the three months before: the person's own usual month.
  const usualMonths = new Set(
    [1, 2, 3].map((back) => {
      const m = shiftMonth(year, month, -back);
      return monthKey(m.year, m.month);
    }),
  );
  const history = new Map<string, Map<string, Cents>>();

  for (const row of input.transactions) {
    const type = row.type === 'income' ? 'income' : row.type === 'expense' ? 'expense' : null;
    if (!type) continue;
    const instant = toInstant(row.date);
    if (!Number.isFinite(instant.getTime())) continue;
    const parts = localParts(instant, timeZone);
    const rowKey = monthKey(parts.year, parts.month);
    const cents = Math.abs(parseAmountToCents(row.amount));
    const inFuture = instant.getTime() > now.getTime();

    const bucket = buckets.get(rowKey);
    if (bucket && !inFuture) {
      bucket.hasRows = true;
      if (type === 'income') {
        bucket.incomeCents += cents;
        bucket.incomeCount += 1;
      } else {
        bucket.expensesCents += cents;
      }
    }

    if (type === 'expense' && usualMonths.has(rowKey) && !isUncategorized(row.categoryName)) {
      const name = row.categoryName as string;
      const perMonth = history.get(name) ?? new Map<string, Cents>();
      perMonth.set(rowKey, (perMonth.get(rowKey) ?? 0) + cents);
      history.set(name, perMonth);
    }

    if (rowKey !== key) continue;

    // The month on screen. The score uses every row the person dated in the month (the same
    // numbers the adviser is given); the money card separates what is paid from what is coming.
    if (type === 'income') {
      monthIncomeAll += cents;
      continue;
    }
    monthExpensesAll += cents;
    if (inFuture) {
      upcomingCents += cents;
      upcomingCount += 1;
      continue;
    }
    spentCents += cents;
    spentCount += 1;
    if (!row.isRecurring && !row.parentTransactionId) variableSpentCents += cents;

    if (isUncategorized(row.categoryName)) {
      uncategorized.count += 1;
      uncategorized.amountCents += cents;
      continue;
    }
    const name = row.categoryName as string;
    const entry = byCategory.get(name) ?? { amountCents: 0, purchases: 0, color: row.categoryColor ?? null };
    entry.amountCents += cents;
    entry.purchases += 1;
    byCategory.set(name, entry);
  }

  // Recurring payments that have no row yet. Scheduled rows are already counted above; a manual
  // reminder is not money until the person records it, so it is shown but not subtracted.
  if (status === 'current') {
    for (const bill of input.bills) {
      if (bill.source !== 'recurring_transaction') continue;
      const due = toInstant(bill.dueDate);
      if (due.getTime() <= now.getTime() || due.getTime() > range.end.getTime()) continue;
      upcomingCents += Math.abs(parseAmountToCents(bill.amount));
      upcomingCount += 1;
    }
  }

  const current = buckets.get(key)!;
  // Income dated later this month (a salary on the 30th) still belongs to this month's plan.
  const incomeCents = status === 'past' ? current.incomeCents : monthIncomeAll;
  const incomeCount = status === 'past'
    ? current.incomeCount
    : input.transactions.filter((row) => {
        if (row.type !== 'income') return false;
        const p = localParts(toInstant(row.date), timeZone);
        return monthKey(p.year, p.month) === key;
      }).length;
  const leftCents = incomeCents - spentCents - upcomingCents;

  const keptShares = Array.from(usualMonths)
    .map((k) => buckets.get(k))
    .filter((b): b is MonthBucket => !!b && b.hasRows && b.incomeCents > 0)
    .map((b) => ((b.incomeCents - b.expensesCents) * 10_000) / b.incomeCents);
  const usualKeptShareBp = keptShares.length
    ? Math.round(keptShares.reduce((sum, share) => sum + share, 0) / keptShares.length)
    : null;

  const prev = shiftMonth(year, month, -1);
  const prevKey = monthKey(prev.year, prev.month);
  const prevBucket = buckets.get(prevKey)!;

  let forecast: DashboardOverview['forecast'] = null;
  if (status === 'current' && today.day >= FORECAST_FROM_DAY && daysLeft > 0) {
    const pace = Math.round(variableSpentCents / today.day);
    const projectedSpent = spentCents + upcomingCents + pace * daysLeft;
    forecast = { spentCents: projectedSpent, keptCents: incomeCents - projectedSpent };
  }

  const categories: CategoryLine[] = Array.from(byCategory.entries())
    .map(([name, entry]) => {
      const months = history.get(name);
      const usualCents = months && months.size > 0
        ? Math.round(Array.from(months.values()).reduce((sum, c) => sum + c, 0) / months.size)
        : null;
      return {
        name,
        color: entry.color,
        amountCents: entry.amountCents,
        shareBp: shareOfTotalInBasisPoints(entry.amountCents, spentCents),
        purchases: entry.purchases,
        usualCents,
        changePct: usualCents && usualCents > 0
          ? Math.round(((entry.amountCents - usualCents) * 100) / usualCents)
          : null,
      };
    })
    .sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name));

  const healthFor = (y: number, m: number, income: Cents, expenses: Cents): FinancialHealth => {
    const r = monthRange(y, m, timeZone);
    const budgetTotal = budgetsForPeriod(input.budgets, r.start, r.end)
      .reduce((sum, budget) => sum + parseAmountToCents(budget.amount), 0);
    return calculateFinancialHealth({
      totalIncome: income / 100,
      totalExpenses: expenses / 100,
      budgetTotal: budgetTotal / 100,
    });
  };
  const health = healthFor(year, month, monthIncomeAll, monthExpensesAll);
  const previousHealthScore = prevBucket.hasRows
    ? healthFor(prev.year, prev.month, prevBucket.incomeCents, prevBucket.expensesCents).score
    : null;

  // What needs the person today. It is about today, so it only appears on the current month.
  const attention: AttentionItem[] = [];
  if (status === 'current') {
    const bills = input.bills
      .map((bill) => ({ bill, due: toInstant(bill.dueDate) }))
      .filter(({ due }) => {
        const days = daysFromToday(due, now, timeZone);
        return days >= 0 && days <= BILL_WINDOW_DAYS;
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime());
    for (const { bill, due } of bills) {
      attention.push({
        kind: 'bill',
        id: bill.id,
        title: bill.title,
        amountCents: Math.abs(parseAmountToCents(bill.amount)),
        dueDate: dayKey(due, timeZone),
        daysUntil: daysFromToday(due, now, timeZone),
        canComplete: bill.source === 'expense_reminder',
      });
    }

    for (const budget of input.budgets) {
      if (!budget.categoryName) continue;
      const period = calendarDaysRange(toInstant(budget.startDate), toInstant(budget.endDate), timeZone);
      if (now < period.start || now > period.end) continue;
      const limitCents = parseAmountToCents(budget.amount);
      if (limitCents <= 0) continue;
      const budgetSpent = parseAmountToCents(budget.spent ?? 0);
      const usedBp = Math.round((budgetSpent * 10_000) / limitCents);
      if (usedBp < BUDGET_WARNING_BP) continue;
      attention.push({
        kind: 'budget',
        categoryName: budget.categoryName,
        spentCents: budgetSpent,
        limitCents,
        percent: Math.floor(usedBp / 100),
        daysLeft: Math.max(0, daysFromToday(period.end, now, timeZone)),
      });
    }
  }

  if (status === 'current' && uncategorized.count > 0) {
    attention.push({ kind: 'uncategorized', count: uncategorized.count, amountCents: uncategorized.amountCents });
  }

  const goals: GoalLine[] = input.goals
    .filter((goal) => !goal.status || goal.status === 'active')
    .map((goal) => {
      const targetCents = parseAmountToCents(goal.targetAmount);
      const savedCents = parseAmountToCents(goal.currentAmount);
      const target = toInstant(goal.targetDate);
      // Goals store a calendar day; read it as one, not as an instant in the person's zone.
      const targetDay = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`;
      const reached = targetCents > 0 && savedCents >= targetCents;
      const daysLeft = Math.round(
        (Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
          - Date.UTC(today.year, today.month - 1, today.day)) / DAY_MS,
      );
      const overdue = !reached && daysLeft < 0;
      const monthsLeft = (target.getUTCFullYear() - today.year) * 12 + (target.getUTCMonth() + 1 - today.month)
        + (target.getUTCDate() >= today.day ? 1 : 0);
      const remaining = Math.max(0, targetCents - savedCents);
      return {
        id: goal.id,
        name: goal.name,
        savedCents,
        targetCents,
        percent: targetCents > 0 ? Math.min(100, Math.floor((savedCents * 100) / targetCents)) : 0,
        targetDate: targetDay,
        monthlyNeededCents: reached || overdue || monthsLeft <= 0 ? null : Math.ceil(remaining / monthsLeft),
        reached,
        overdue,
        _daysLeft: daysLeft,
      };
    })
    .sort((a, b) => Number(a.reached) - Number(b.reached) || a._daysLeft - b._daysLeft)
    .map(({ _daysLeft, ...goal }) => {
      if (status === 'current' && !goal.reached && _daysLeft <= GOAL_WINDOW_DAYS) {
        attention.push({
          kind: 'goal',
          id: goal.id,
          name: goal.name,
          remainingCents: goal.targetCents - goal.savedCents,
          targetDate: goal.targetDate,
          daysLeft: _daysLeft,
        });
      }
      return goal;
    });

  const streakRows = input.streakTransactions ?? input.transactions;
  const streak = loggingStreak(
    streakRows
      .map((row) => toInstant(row.date))
      .filter((instant) => Number.isFinite(instant.getTime()) && instant.getTime() <= now.getTime())
      .map((instant) => dayKey(instant, timeZone)),
    dayKey(now, timeZone),
  );

  return {
    month: { key, status, day, daysInMonth, daysLeft },
    totals: {
      incomeCents,
      incomeCount,
      spentCents,
      spentCount,
      upcomingCents,
      upcomingCount,
      leftCents,
      leftShareBp: incomeCents > 0 ? Math.round((leftCents * 10_000) / incomeCents) : null,
    },
    usualKeptShareBp,
    previous: {
      key: prevKey,
      expensesCents: prevBucket.expensesCents,
      keptCents: prevBucket.incomeCents - prevBucket.expensesCents,
      hasData: prevBucket.hasRows,
    },
    forecast,
    categories,
    uncategorized,
    health,
    previousHealthScore,
    trend: trendKeys.map((k) => {
      const b = buckets.get(k)!;
      return { key: k, incomeCents: b.incomeCents, expensesCents: b.expensesCents };
    }),
    attention,
    goals,
    streak: { current: streak.current, loggedToday: streak.loggedToday },
  };
}

/** The window of rows `buildDashboardOverview` reads for a month: five months before it to its end. */
export function overviewWindow(year: number, month: number, timeZone: string): { start: Date; end: Date } {
  const first = shiftMonth(year, month, -5);
  return { start: monthRange(first.year, first.month, timeZone).start, end: monthRange(year, month, timeZone).end };
}

/** "2026-10" -> { year, month }, or null for anything that is not a real month. */
export function parseMonthParam(raw: unknown): { year: number; month: number } | null {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}
