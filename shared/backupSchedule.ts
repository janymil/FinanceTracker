/**
 * When the next automatic backup runs — "every day at 2 AM", in the customer's own zone.
 *
 * Two things this replaces, both of which made the promise in the app false:
 *
 * - `2 AM` was the *server's* 2 AM. The box runs in UTC and the customers are in Lima (UTC-5), so
 *   "todos los días a las 2:00 AM" would have fired at 21:00 the evening before, and the tab would
 *   still have claimed 2 AM.
 * - The old calculation moved forward in whole days from the last run, so the hour drifted to
 *   whenever the last backup happened to finish.
 *
 * Pure and zone-aware, so it is a test and not a hope. Days are advanced on the calendar in the
 * zone; a daylight-saving shift can move a run by an hour, which the hourly catch-up absorbs.
 */
import { localParts, offsetMs } from './timezones';

export type BackupFrequency = 'daily' | 'weekly' | 'monthly';

export interface BackupScheduleInput {
  now: Date;
  /** IANA zone of the person the backup belongs to (`users.timezone`). */
  timeZone: string;
  frequency: BackupFrequency;
  /** The last run, if any: the next one is never before it. */
  lastBackup?: Date | null;
  /** Local hour of the run. The app promises 2. */
  hour?: number;
}

/** The instant the clock in `timeZone` reads `hour:00` on that calendar day. */
function zonedHourInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, 0, 0);
  let instant = wall - offsetMs(new Date(wall), timeZone);
  // Near a daylight-saving change the first guess is an hour off; one more pass settles it.
  instant = wall - offsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** 0 = Sunday. Read from the zone's own calendar date, not from UTC. */
function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The next calendar day the schedule allows, in the zone. */
function advance(
  year: number,
  month: number,
  day: number,
  frequency: BackupFrequency,
): { year: number; month: number; day: number } {
  if (frequency === 'monthly') {
    const nextMonth = new Date(Date.UTC(year, month, 1)); // month is already 1-based, so this is +1
    return {
      year: nextMonth.getUTCFullYear(),
      month: nextMonth.getUTCMonth() + 1,
      day: 1,
    };
  }

  const step = frequency === 'weekly' ? 7 : 1;
  const next = new Date(Date.UTC(year, month - 1, day + step));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

/**
 * The next run after `now`, and after the last one.
 *
 * Daily runs land on 2 AM local; weekly on Sunday 2 AM; monthly on the 1st at 2 AM — the three
 * options the settings screen offers.
 */
export function nextBackupAt(input: BackupScheduleInput): Date {
  const hour = Math.min(Math.max(Math.trunc(input.hour ?? 2), 0), 23);
  const timeZone = input.timeZone;
  const floor = input.lastBackup && input.lastBackup > input.now ? input.lastBackup : input.now;

  const start = localParts(floor, timeZone);
  let { year, month, day } = start;

  if (input.frequency === 'weekly') {
    // Walk to the next Sunday the clock has not passed yet.
    let guard = 0;
    while (weekdayOf(year, month, day) !== 0 && guard < 7) {
      ({ year, month, day } = advance(year, month, day, 'daily'));
      guard += 1;
    }
  }

  let candidate = zonedHourInstant(year, month, day, hour, timeZone);

  // Never in the past, and never a second run inside the same period.
  let guard = 0;
  while (candidate <= floor && guard < 400) {
    ({ year, month, day } = advance(year, month, day, input.frequency === 'weekly' ? 'weekly' : input.frequency));
    candidate = zonedHourInstant(year, month, day, hour, timeZone);
    guard += 1;
  }

  return candidate;
}
