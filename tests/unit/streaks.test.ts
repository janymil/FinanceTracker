import { describe, expect, it } from 'vitest';
import { loggingStreak } from '../../shared/streaks';

describe('loggingStreak', () => {
  it('is empty with no entries', () => {
    expect(loggingStreak([], '2026-10-24')).toEqual({ current: 0, best: 0, loggedToday: false });
  });

  it('counts consecutive days ending today', () => {
    const result = loggingStreak(['2026-10-22', '2026-10-23', '2026-10-24'], '2026-10-24');
    expect(result).toEqual({ current: 3, best: 3, loggedToday: true });
  });

  it('keeps the streak alive when the last entry was yesterday', () => {
    const result = loggingStreak(['2026-10-22', '2026-10-23'], '2026-10-24');
    expect(result.current).toBe(2);
    expect(result.loggedToday).toBe(false);
  });

  it('resets after a missed day but remembers the best run', () => {
    const result = loggingStreak(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-23'], '2026-10-24');
    expect(result.current).toBe(1);
    expect(result.best).toBe(4);
  });

  it('is zero when the last entry is older than yesterday', () => {
    expect(loggingStreak(['2026-10-20'], '2026-10-24').current).toBe(0);
  });

  it('ignores duplicates and ordering', () => {
    const result = loggingStreak(['2026-10-24', '2026-10-23', '2026-10-24', '2026-10-23'], '2026-10-24');
    expect(result.current).toBe(2);
  });
});
