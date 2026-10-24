import { addDays, addMonths, addWeeks, addYears } from "date-fns";

/**
 * Pure recurrence rules. Occurrences are anchored to the start date (start + k * step),
 * never chained from the previous one, so "monthly from the 31st" gives Jan 31, Feb 28,
 * Mar 31 instead of drifting to the 28th forever.
 */
export type RecurrenceFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

export const RECURRENCE_FREQUENCIES: RecurrenceFrequency[] = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
];

export function isRecurrenceFrequency(value: unknown): value is RecurrenceFrequency {
  return typeof value === "string" && (RECURRENCE_FREQUENCIES as string[]).includes(value);
}

/** The k-th occurrence (k = 0 is the start date itself). */
export function occurrenceAt(start: Date, frequency: RecurrenceFrequency, k: number): Date {
  switch (frequency) {
    case "daily":
      return addDays(start, k);
    case "weekly":
      return addWeeks(start, k);
    case "biweekly":
      return addWeeks(start, k * 2);
    case "monthly":
      return addMonths(start, k);
    case "quarterly":
      return addMonths(start, k * 3);
    case "yearly":
      return addYears(start, k);
  }
}

export interface DueOptions {
  start: Date;
  frequency: RecurrenceFrequency;
  /** The last occurrence that already exists (the start date for a brand-new rule). */
  lastProcessed: Date | null;
  endDate?: Date | null;
  now: Date;
  /** Safety cap per run, so a long-idle rule cannot flood an account. */
  maxPerRun?: number;
}

/**
 * Occurrences that should exist by `now` but do not yet: strictly after `lastProcessed`,
 * on or before `now`, and not after `endDate`. Oldest first.
 */
export function dueOccurrences({
  start,
  frequency,
  lastProcessed,
  endDate,
  now,
  maxPerRun = 60,
}: DueOptions): Date[] {
  const after = (lastProcessed ?? new Date(start.getTime() - 1)).getTime();
  const limit = Math.min(now.getTime(), endDate ? endDate.getTime() : Number.POSITIVE_INFINITY);

  const due: Date[] = [];
  // 10_000 steps is far beyond any real rule and guarantees the loop ends.
  for (let k = 1; k < 10_000 && due.length < maxPerRun; k++) {
    const date = occurrenceAt(start, frequency, k);
    const time = date.getTime();
    if (time > limit) break;
    if (time > after) due.push(date);
  }
  return due;
}
