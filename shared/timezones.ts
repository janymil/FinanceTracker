/**
 * Time zones for "this month", budget periods and exports.
 *
 * A person picks a standard IANA zone (America/Lima, Europe/Bratislava); the server and the
 * browser both turn calendar days into exact instants with `Intl`, so daylight saving is handled
 * by the platform and no date library is needed.
 */

export const DEFAULT_TIME_ZONE = 'UTC';

const DAY_MS = 86_400_000;

/** Zones offered in the picker. Any valid IANA zone is still accepted (the browser's own is always listed). */
export const TIME_ZONE_CHOICES = [
  'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Phoenix', 'America/Denver',
  'America/Chicago', 'America/Mexico_City', 'America/Guatemala', 'America/Costa_Rica', 'America/Panama',
  'America/Bogota', 'America/Lima', 'America/Guayaquil', 'America/New_York', 'America/Toronto',
  'America/Havana', 'America/Santo_Domingo', 'America/Caracas', 'America/La_Paz', 'America/Halifax',
  'America/Santiago', 'America/Asuncion', 'America/Argentina/Buenos_Aires', 'America/Montevideo',
  'America/Sao_Paulo', 'Atlantic/Azores', 'UTC', 'Europe/London', 'Europe/Dublin', 'Europe/Lisbon',
  'Europe/Madrid', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Vienna', 'Europe/Prague',
  'Europe/Bratislava', 'Europe/Warsaw', 'Europe/Athens', 'Europe/Helsinki', 'Europe/Kyiv',
  'Europe/Istanbul', 'Europe/Moscow', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg',
  'Africa/Nairobi', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok',
  'Asia/Jakarta', 'Asia/Singapore', 'Asia/Manila', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo',
  'Asia/Seoul', 'Australia/Perth', 'Australia/Adelaide', 'Australia/Sydney', 'Pacific/Auckland',
] as const;

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The stored zone, or the default when it is missing or no longer valid. */
export function resolveTimeZone(value: unknown): string {
  return isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock reading in `timeZone` at the given instant. */
export function localParts(instant: Date, timeZone: string): LocalParts {
  const read: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') read[part.type] = Number(part.value);
  }
  return { year: read.year, month: read.month, day: read.day, hour: read.hour % 24, minute: read.minute, second: read.second };
}

/** Milliseconds the zone is ahead of UTC at that instant (negative west of Greenwich). */
export function offsetMs(instant: Date, timeZone: string): number {
  const p = localParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant a calendar day starts in the zone (month is 1-12; days past the month roll over). */
export function startOfZonedDay(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let instant = guess - offsetMs(new Date(guess), timeZone);
  // Near a daylight-saving change the first guess can land an hour off; one more pass settles it.
  instant = guess - offsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** The last millisecond of a calendar day in the zone. */
export function endOfZonedDay(year: number, month: number, day: number, timeZone: string): Date {
  return new Date(startOfZonedDay(year, month, day + 1, timeZone).getTime() - 1);
}

export interface InstantRange {
  start: Date;
  end: Date;
}

export type RangePreset = 'month' | 'quarter' | 'year';

/** "This month / quarter / year" as the person living in `timeZone` sees the calendar. */
export function presetRange(preset: RangePreset, timeZone: string, now: Date = new Date()): InstantRange {
  const { year, month } = localParts(now, timeZone);
  if (preset === 'month') {
    return { start: startOfZonedDay(year, month, 1, timeZone), end: endOfZonedDay(year, month + 1, 0, timeZone) };
  }
  if (preset === 'quarter') {
    const first = month - ((month - 1) % 3);
    return { start: startOfZonedDay(year, first, 1, timeZone), end: endOfZonedDay(year, first + 3, 0, timeZone) };
  }
  return { start: startOfZonedDay(year, 1, 1, timeZone), end: endOfZonedDay(year, 12, 31, timeZone) };
}

/** A whole calendar month (month is 1-12) in the zone. */
export function monthRange(year: number, month: number, timeZone: string): InstantRange {
  return { start: startOfZonedDay(year, month, 1, timeZone), end: endOfZonedDay(year, month + 1, 0, timeZone) };
}

/**
 * Budgets and goals store calendar days ("2026-10-31" arrives as midnight UTC). Read those days
 * as dates, then cover them from the first instant to the last instant in the person's zone.
 */
export function calendarDaysRange(startDay: Date, endDay: Date, timeZone: string): InstantRange {
  return {
    start: startOfZonedDay(startDay.getUTCFullYear(), startDay.getUTCMonth() + 1, startDay.getUTCDate(), timeZone),
    end: endOfZonedDay(endDay.getUTCFullYear(), endDay.getUTCMonth() + 1, endDay.getUTCDate(), timeZone),
  };
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A "yyyy-MM-dd" string as its calendar day, or null for anything else. */
export function parseDateOnly(raw: unknown): { year: number; month: number; day: number } | null {
  if (typeof raw !== 'string') return null;
  const match = DATE_ONLY.exec(raw.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? { year, month, day }
    : null;
}

/** Start of a range: a date-only value means the first moment of that day in the zone. */
export function rangeStartFrom(raw: unknown, parsed: Date, timeZone: string): Date {
  const day = parseDateOnly(raw);
  return day ? startOfZonedDay(day.year, day.month, day.day, timeZone) : parsed;
}

/** End of a range: a date-only value means the last moment of that day in the zone. */
export function rangeEndFrom(raw: unknown, parsed: Date, timeZone: string): Date {
  const day = parseDateOnly(raw);
  return day ? endOfZonedDay(day.year, day.month, day.day, timeZone) : parsed;
}

export interface TimeZoneOption {
  id: string;
  /** Standard name in the person's language, e.g. "Eastern Time", "Central European Time". */
  name: string;
  city: string;
  /** "UTC-05:00" at the given moment (changes with daylight saving). */
  offset: string;
  offsetMinutes: number;
  /** Ready to show: "Eastern Time — New York (UTC-05:00)". */
  label: string;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export function describeTimeZone(id: string, locale = 'en', now: Date = new Date()): TimeZoneOption {
  const zoneName = (style: 'longGeneric' | 'long') =>
    new Intl.DateTimeFormat(locale, { timeZone: id, timeZoneName: style })
      .formatToParts(now)
      .find((part) => part.type === 'timeZoneName')?.value;
  // "GMT" alone is not a name; UTC reads better in full.
  const name = id === 'UTC' ? zoneName('long') ?? 'UTC' : zoneName('longGeneric') ?? zoneName('long') ?? id;
  const city = id === 'UTC' ? 'UTC' : id.split('/').pop()!.replace(/_/g, ' ');
  const offsetMinutes = Math.round(offsetMs(now, id) / 60_000);
  const offset = formatOffset(offsetMinutes);
  return { id, name, city, offset, offsetMinutes, label: id === 'UTC' ? `${name} (${offset})` : `${name} — ${city} (${offset})` };
}

/** Picker options, west to east. Includes `extra` (for example the browser's own zone) when not already listed. */
export function timeZoneOptions(locale = 'en', extra: readonly string[] = [], now: Date = new Date()): TimeZoneOption[] {
  const ids = new Set<string>(TIME_ZONE_CHOICES);
  for (const id of extra) if (isValidTimeZone(id)) ids.add(id);
  return Array.from(ids)
    .map((id) => describeTimeZone(id, locale, now))
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city));
}

/** The browser's zone, or the default when it cannot say. */
export function detectTimeZone(): string {
  try {
    return resolveTimeZone(new Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export { DAY_MS };
