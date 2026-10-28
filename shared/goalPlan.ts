/**
 * Where a savings goal stands and what it takes to finish on time.
 *
 * Shared by the dashboard's goals card and the Goals page so the two never disagree about "how
 * much per month" or "behind". A goal stores a calendar day as its target ("2026-12-31" arrives as
 * midnight UTC), so the day is read in UTC and compared with today in the person's own zone.
 *
 * Pace compares the money saved with the money a straight line from the day the goal was created
 * to its target day would have by now: a goal at 40% halfway through is behind, one at 60% ahead.
 */

import { localParts } from './timezones';
import { parseAmountToCents, type AmountInput, type Cents } from './money';

export interface GoalPlanInput {
  targetAmount: AmountInput;
  currentAmount: AmountInput;
  targetDate: string | Date;
  createdAt?: string | Date | null;
}

export type GoalPace = 'reached' | 'overdue' | 'ahead' | 'on_track' | 'behind';

export interface GoalPlan {
  savedCents: Cents;
  targetCents: Cents;
  remainingCents: Cents;
  /** 0-100, floored, capped at 100. */
  percent: number;
  /** "2026-12-31" */
  targetDay: string;
  /** Whole days from today to the target day (negative once it has passed). */
  daysLeft: number;
  /** Calendar months still available, the current one counted while the target day is ahead in it. */
  monthsLeft: number;
  /** What to put aside each month to arrive on time; null when reached, overdue or out of months. */
  monthlyNeededCents: Cents | null;
  reached: boolean;
  overdue: boolean;
  pace: GoalPace;
  /** What a steady saver would have by today; null without a creation date. */
  expectedCents: Cents | null;
}

const DAY_MS = 86_400_000;
/** Within this band of the straight line a goal is "on track", not ahead or behind. */
const PACE_TOLERANCE = 0.1;

function utcDay(value: string | Date): Date {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function safeCents(value: AmountInput): Cents {
  try {
    return parseAmountToCents(value ?? 0);
  } catch {
    return 0;
  }
}

export function planGoal(goal: GoalPlanInput, now: Date, timeZone: string): GoalPlan {
  const targetCents = safeCents(goal.targetAmount);
  const savedCents = Math.max(0, safeCents(goal.currentAmount));
  const target = utcDay(goal.targetDate);
  const today = localParts(now, timeZone);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);

  const reached = targetCents > 0 && savedCents >= targetCents;
  const daysLeft = Math.round((target.getTime() - todayUtc) / DAY_MS);
  const overdue = !reached && daysLeft < 0;
  const monthsLeft = (target.getUTCFullYear() - today.year) * 12 + (target.getUTCMonth() + 1 - today.month)
    + (target.getUTCDate() >= today.day ? 1 : 0);
  const remainingCents = Math.max(0, targetCents - savedCents);
  const monthlyNeededCents = reached || overdue || monthsLeft <= 0 ? null : Math.ceil(remainingCents / monthsLeft);

  let expectedCents: Cents | null = null;
  if (goal.createdAt) {
    const created = utcDay(goal.createdAt).getTime();
    const span = target.getTime() - created;
    if (Number.isFinite(created) && span > 0) {
      const fraction = Math.min(1, Math.max(0, (todayUtc - created) / span));
      expectedCents = Math.round(targetCents * fraction);
    }
  }

  let pace: GoalPace;
  if (reached) pace = 'reached';
  else if (overdue) pace = 'overdue';
  else if (expectedCents === null || expectedCents === 0) pace = 'on_track';
  else if (savedCents >= expectedCents * (1 + PACE_TOLERANCE)) pace = 'ahead';
  else if (savedCents >= expectedCents * (1 - PACE_TOLERANCE)) pace = 'on_track';
  else pace = 'behind';

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    savedCents,
    targetCents,
    remainingCents,
    percent: targetCents > 0 ? Math.min(100, Math.floor((savedCents * 100) / targetCents)) : 0,
    targetDay: `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`,
    daysLeft,
    monthsLeft,
    monthlyNeededCents,
    reached,
    overdue,
    pace,
    expectedCents,
  };
}
