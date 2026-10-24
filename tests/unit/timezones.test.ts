import { describe, expect, it } from 'vitest';
import {
  calendarDaysRange,
  describeTimeZone,
  endOfZonedDay,
  isValidTimeZone,
  localParts,
  monthRange,
  presetRange,
  rangeEndFrom,
  rangeStartFrom,
  resolveTimeZone,
  startOfZonedDay,
  timeZoneOptions,
  TIME_ZONE_CHOICES,
} from '@shared/timezones';

const iso = (date: Date) => date.toISOString();

describe('time zone validity', () => {
  it('accepts IANA names and refuses everything else', () => {
    expect(isValidTimeZone('America/Lima')).toBe(true);
    expect(isValidTimeZone('Europe/Bratislava')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    for (const bad of ['', 'Mars/Olympus', 'UTC-5', 'lima', null, undefined, 5, 'x'.repeat(80)]) {
      expect(isValidTimeZone(bad)).toBe(false);
    }
  });

  it('falls back to UTC when nothing valid is stored', () => {
    expect(resolveTimeZone(null)).toBe('UTC');
    expect(resolveTimeZone('nope')).toBe('UTC');
    expect(resolveTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
  });

  it('every offered zone is valid', () => {
    for (const id of TIME_ZONE_CHOICES) expect(isValidTimeZone(id), id).toBe(true);
  });
});

describe('days in a zone', () => {
  it('starts a day at local midnight (Lima is UTC-5, no daylight saving)', () => {
    expect(iso(startOfZonedDay(2026, 10, 1, 'America/Lima'))).toBe('2026-10-01T05:00:00.000Z');
    expect(iso(endOfZonedDay(2026, 10, 31, 'America/Lima'))).toBe('2026-11-01T04:59:59.999Z');
  });

  it('works east of UTC (Tokyo is UTC+9)', () => {
    expect(iso(startOfZonedDay(2026, 10, 1, 'Asia/Tokyo'))).toBe('2026-09-30T15:00:00.000Z');
  });

  it('follows daylight saving (New York: UTC-4 in summer, UTC-5 in winter)', () => {
    expect(iso(startOfZonedDay(2026, 7, 1, 'America/New_York'))).toBe('2026-07-01T04:00:00.000Z');
    expect(iso(startOfZonedDay(2026, 12, 1, 'America/New_York'))).toBe('2026-12-01T05:00:00.000Z');
  });

  it('gets the 23-hour and 25-hour days right', () => {
    // US clocks go forward on 2026-03-08 and back on 2026-11-01.
    const spring = endOfZonedDay(2026, 3, 8, 'America/New_York').getTime() - startOfZonedDay(2026, 3, 8, 'America/New_York').getTime() + 1;
    const autumn = endOfZonedDay(2026, 11, 1, 'America/New_York').getTime() - startOfZonedDay(2026, 11, 1, 'America/New_York').getTime() + 1;
    expect(spring).toBe(23 * 3_600_000);
    expect(autumn).toBe(25 * 3_600_000);
  });

  it('reads the local calendar day', () => {
    // 03:00 UTC on Nov 1 is still the evening of Oct 31 in Lima.
    const parts = localParts(new Date('2026-11-01T03:00:00.000Z'), 'America/Lima');
    expect([parts.year, parts.month, parts.day, parts.hour]).toEqual([2026, 10, 31, 22]);
  });
});

describe('this month / quarter / year', () => {
  // 2026-11-01 03:00 UTC is still October 31st in Lima but already November 1st in Bratislava.
  const moment = new Date('2026-11-01T03:00:00.000Z');

  it('is October for someone in Lima and November for someone in Bratislava', () => {
    const lima = presetRange('month', 'America/Lima', moment);
    expect(iso(lima.start)).toBe('2026-10-01T05:00:00.000Z');
    expect(iso(lima.end)).toBe('2026-11-01T04:59:59.999Z');

    const bratislava = presetRange('month', 'Europe/Bratislava', moment);
    expect(iso(bratislava.start)).toBe('2026-10-31T23:00:00.000Z');
    expect(iso(bratislava.end)).toBe('2026-11-30T22:59:59.999Z');
  });

  it('puts a late-evening purchase in the month the person lived it', () => {
    const purchase = new Date('2026-11-01T02:30:00.000Z'); // 21:30 on Oct 31 in Lima
    const october = presetRange('month', 'America/Lima', moment);
    expect(purchase >= october.start && purchase <= october.end).toBe(true);
  });

  it('covers the calendar quarter and year', () => {
    const quarter = presetRange('quarter', 'America/Lima', moment);
    expect(iso(quarter.start)).toBe('2026-10-01T05:00:00.000Z');
    expect(iso(quarter.end)).toBe('2027-01-01T04:59:59.999Z');
    const year = presetRange('year', 'America/Lima', moment);
    expect(iso(year.start)).toBe('2026-01-01T05:00:00.000Z');
    expect(iso(year.end)).toBe('2027-01-01T04:59:59.999Z');
  });

  it('starts February quarter-aligned and handles leap years', () => {
    const q1 = presetRange('quarter', 'UTC', new Date('2028-02-15T12:00:00.000Z'));
    expect(iso(q1.start)).toBe('2028-01-01T00:00:00.000Z');
    expect(iso(q1.end)).toBe('2028-03-31T23:59:59.999Z');
    expect(iso(monthRange(2028, 2, 'UTC').end)).toBe('2028-02-29T23:59:59.999Z');
  });
});

describe('date-only values and stored calendar days', () => {
  it('reads a plain date as a day in the person\'s zone', () => {
    const parsed = new Date('2026-10-31');
    expect(iso(rangeStartFrom('2026-10-31', parsed, 'America/Lima'))).toBe('2026-10-31T05:00:00.000Z');
    expect(iso(rangeEndFrom('2026-10-31', parsed, 'America/Lima'))).toBe('2026-11-01T04:59:59.999Z');
  });

  it('keeps an exact timestamp as it is', () => {
    const exact = new Date('2026-10-31T10:00:00.000Z');
    expect(rangeEndFrom('2026-10-31T10:00:00.000Z', exact, 'America/Lima')).toBe(exact);
    expect(rangeStartFrom('2026-10-31T10:00:00.000Z', exact, 'America/Lima')).toBe(exact);
  });

  it('rejects an impossible calendar date as date-only', () => {
    const parsed = new Date('2026-02-30');
    expect(rangeEndFrom('2026-02-30', parsed, 'UTC')).toBe(parsed);
  });

  it('covers a budget from its first to its last local moment, old rows included', () => {
    const zone = 'America/Lima';
    // New rows: midnight UTC. Old rows from before the fix may hold 23:59:59.999 UTC.
    for (const end of ['2026-10-31T00:00:00.000Z', '2026-10-31T23:59:59.999Z']) {
      const period = calendarDaysRange(new Date('2026-10-01T00:00:00.000Z'), new Date(end), zone);
      expect(iso(period.start)).toBe('2026-10-01T05:00:00.000Z');
      expect(iso(period.end)).toBe('2026-11-01T04:59:59.999Z');
    }
  });
});

describe('picker labels', () => {
  const moment = new Date('2026-10-24T12:00:00.000Z');

  it('uses the standard zone name, the city and the offset', () => {
    expect(describeTimeZone('America/New_York', 'en', moment).label).toBe('Eastern Time — New York (UTC-04:00)');
    expect(describeTimeZone('Europe/Bratislava', 'en', moment).label).toBe('Central European Time — Bratislava (UTC+02:00)');
    expect(describeTimeZone('America/Lima', 'en', moment).label).toBe('Peru Standard Time — Lima (UTC-05:00)');
    expect(describeTimeZone('Asia/Kolkata', 'en', moment).label).toBe('India Standard Time — Kolkata (UTC+05:30)');
    expect(describeTimeZone('UTC', 'en', moment).label).toBe('Coordinated Universal Time (UTC+00:00)');
  });

  it('names zones in the person\'s language', () => {
    expect(describeTimeZone('America/Lima', 'es', moment).name).toBe('hora estándar de Perú');
    expect(describeTimeZone('Europe/Bratislava', 'sk', moment).name).toBe('stredoeurópsky čas');
  });

  it('lists zones west to east and adds the browser zone when it is not offered', () => {
    const options = timeZoneOptions('en', ['Africa/Casablanca'], moment);
    expect(options.some((option) => option.id === 'Africa/Casablanca')).toBe(true);
    const minutes = options.map((option) => option.offsetMinutes);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(new Set(options.map((option) => option.id)).size).toBe(options.length);
  });
});
