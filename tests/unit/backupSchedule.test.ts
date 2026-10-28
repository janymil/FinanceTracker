import { describe, expect, it } from 'vitest';
import { nextBackupAt } from '../../shared/backupSchedule';
import { localParts } from '../../shared/timezones';

/**
 * "Every day at 2 AM", for the person the backup belongs to.
 *
 * The app promises 2 AM to a customer in Lima on a server that runs in UTC, so "2 AM" has to be
 * their 2 AM. The old calculation also drifted to whatever hour the last backup finished, and the
 * tab kept claiming 2 AM.
 */

const LIMA = 'America/Lima'; // UTC-5, no daylight saving
const BRATISLAVA = 'Europe/Bratislava'; // UTC+1/+2
const utc = (iso: string) => new Date(iso);

describe('nextBackupAt — daily at 2 AM in the person\'s zone', () => {
  it('is 2 AM in Lima, not 2 AM UTC', () => {
    // 10:00 in Lima on 28 October 2026.
    const next = nextBackupAt({ now: utc('2026-10-28T15:00:00Z'), timeZone: LIMA, frequency: 'daily' });

    // 10:00 in Lima means today's 2 AM has gone, so the next one is tomorrow at 02:00 Lima,
    // which is 07:00 UTC — the server's clock is not the customer's clock.
    expect(localParts(next, LIMA)).toMatchObject({ year: 2026, month: 10, day: 29, hour: 2, minute: 0 });
    expect(next.toISOString()).toBe('2026-10-29T07:00:00.000Z');
  });

  it('waits for tomorrow once today\'s 2 AM has passed', () => {
    // 03:00 in Lima on the 29th: today's run is behind us.
    const next = nextBackupAt({ now: utc('2026-10-29T08:00:00Z'), timeZone: LIMA, frequency: 'daily' });

    expect(localParts(next, LIMA)).toMatchObject({ day: 30, hour: 2 });
  });

  it('does not run twice in the same night', () => {
    // The last backup ran at 02:00 Lima on the 29th; the next is the 30th at 02:00.
    const lastBackup = utc('2026-10-29T07:00:00Z');
    const next = nextBackupAt({
      now: utc('2026-10-29T08:00:00Z'),
      timeZone: LIMA,
      frequency: 'daily',
      lastBackup,
    });

    expect(localParts(next, LIMA)).toMatchObject({ day: 30, hour: 2 });
  });

  it('handles a zone east of UTC', () => {
    const next = nextBackupAt({ now: utc('2026-10-28T15:00:00Z'), timeZone: BRATISLAVA, frequency: 'daily' });

    // 17:00 in Bratislava: tomorrow 02:00 local. Winter time there is UTC+1 (DST ended on
    // 25 October 2026), so that is 01:00 UTC.
    expect(localParts(next, BRATISLAVA)).toMatchObject({ day: 29, hour: 2 });
    expect(next.toISOString()).toBe('2026-10-29T01:00:00.000Z');
  });

  it('is always in the future', () => {
    for (const iso of ['2026-10-28T06:59:59Z', '2026-10-28T07:00:00Z', '2026-12-31T23:59:00Z']) {
      const now = utc(iso);
      const next = nextBackupAt({ now, timeZone: LIMA, frequency: 'daily' });
      expect(next.getTime()).toBeGreaterThan(now.getTime());
    }
  });
});

describe('nextBackupAt — weekly and monthly', () => {
  it('weekly lands on Sunday at 2 AM local', () => {
    // Wednesday 28 October 2026.
    const next = nextBackupAt({ now: utc('2026-10-28T15:00:00Z'), timeZone: LIMA, frequency: 'weekly' });

    expect(localParts(next, LIMA)).toMatchObject({ day: 1, month: 11, hour: 2 }); // Sunday 1 November
  });

  it('monthly lands on the 1st at 2 AM local', () => {
    const next = nextBackupAt({ now: utc('2026-10-28T15:00:00Z'), timeZone: LIMA, frequency: 'monthly' });

    expect(localParts(next, LIMA)).toMatchObject({ year: 2026, month: 11, day: 1, hour: 2 });
  });
});
