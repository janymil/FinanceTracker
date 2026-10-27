import { describe, expect, it } from 'vitest';
import { parseMonthKeyLocal } from '../../client/src/lib/dateUtils';

/**
 * The monthly charts bucket transactions by `YYYY-MM` (`shared/calculations.sumAmountsByMonthKey`,
 * which builds the key from local date parts) and then turn the key back into a label.
 *
 * That second step used `new Date('2026-10' + '-01')`. ECMAScript parses a bare `YYYY-MM-DD`
 * string as UTC midnight, so `getMonth()` answered "September" for anyone west of Greenwich:
 * on Lima time this month's expenses were filed under the previous month's name, while
 * Bratislava saw the right one. The label is now built from local parts.
 */
describe('parseMonthKeyLocal', () => {
  it('returns the first day of the month the key names', () => {
    const date = parseMonthKeyLocal('2026-10');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9); // October, zero-based
    expect(date.getDate()).toBe(1);
  });

  it('agrees with constructing the date from local parts in any time zone', () => {
    for (const key of ['2026-01', '2026-10', '2027-12']) {
      const [year, month] = key.split('-').map(Number);
      expect(parseMonthKeyLocal(key).getTime()).toBe(new Date(year, month - 1, 1).getTime());
    }
  });

  it('does not roll the month backwards the way a UTC parse does', () => {
    // The regression in one line: a UTC parse of the same key is a different instant, and west
    // of Greenwich that instant is still the previous month.
    const utc = new Date('2026-10' + '-01');
    const local = parseMonthKeyLocal('2026-10');
    const utcMonthInLocalTime = utc.getMonth();
    const localMonthInLocalTime = local.getMonth();

    // East of or on Greenwich both agree; west of it the UTC parse shows September.
    expect(localMonthInLocalTime).toBe(9);
    expect(utcMonthInLocalTime === 9 || utcMonthInLocalTime === 8).toBe(true);
  });

  it('falls back to a valid date instead of an Invalid Date label', () => {
    for (const bad of ['', 'not-a-month', '2026-13', '2026']) {
      const date = parseMonthKeyLocal(bad);
      expect(Number.isNaN(date.getTime())).toBe(false);
      expect(date.getDate()).toBe(1);
    }
  });
});
