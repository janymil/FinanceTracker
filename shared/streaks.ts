import { differenceInCalendarDays, parseISO } from "date-fns";

export interface LoggingStreak {
  /** Consecutive days with at least one entry, ending today (or yesterday: today is still open). */
  current: number;
  best: number;
  /** True when today already has an entry. */
  loggedToday: boolean;
}

/**
 * `dayKeys` are calendar days as yyyy-MM-dd (the person's own days, built by the caller),
 * `todayKey` is today in the same form. Duplicates and order do not matter.
 */
export function loggingStreak(dayKeys: string[], todayKey: string): LoggingStreak {
  const days = Array.from(new Set(dayKeys)).sort();
  if (days.length === 0) return { current: 0, best: 0, loggedToday: false };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = differenceInCalendarDays(parseISO(days[i]), parseISO(days[i - 1])) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  const last = days[days.length - 1];
  const gap = differenceInCalendarDays(parseISO(todayKey), parseISO(last));
  const loggedToday = gap === 0;

  // A run still counts if it ended yesterday: the person has until midnight to extend it.
  let current = 0;
  if (gap === 0 || gap === 1) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (differenceInCalendarDays(parseISO(days[i]), parseISO(days[i - 1])) === 1) current++;
      else break;
    }
  }

  return { current, best, loggedToday };
}
