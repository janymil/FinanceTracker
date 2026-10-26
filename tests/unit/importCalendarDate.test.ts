import { describe, expect, it, vi } from 'vitest';

// The helper is pure; its module also imports storage and Clerk for the other import helpers.
vi.mock('../../server/storage', () => ({ storage: {} }));
vi.mock('../../server/clerkAuth', () => ({ getUserId: () => undefined }));

import { toCalendarDate } from '../../lib/importHelpers';

/**
 * A bank file's day is a calendar day. Parsing it as midnight UTC showed the previous evening
 * in Lima, so imported movements landed one day early — the bug this helper exists to stop.
 */
describe('toCalendarDate', () => {
  it('stores a plain bank day at noon UTC so Lima still shows the same date', () => {
    const date = toCalendarDate('2026-01-15')!;
    expect(date.toISOString()).toBe('2026-01-15T12:00:00.000Z');

    // Lima is UTC-5: evening of the same day, not 14 January.
    const limaWallClock = new Date(date.getTime() - 5 * 60 * 60 * 1000);
    expect(limaWallClock.toISOString().slice(0, 10)).toBe('2026-01-15');
  });

  it('leaves a value that already carries a time untouched', () => {
    expect(toCalendarDate('2026-01-15T23:30:00Z')!.toISOString()).toBe('2026-01-15T23:30:00.000Z');
  });

  it('returns null for a missing or unreadable value', () => {
    expect(toCalendarDate('')).toBeNull();
    expect(toCalendarDate(undefined)).toBeNull();
    expect(toCalendarDate('not a date')).toBeNull();
  });
});
