import { beforeAll, describe, expect, it, vi } from 'vitest';

// Only the window parser is exercised here: the deletion itself needs a database, and the
// integration job is where that belongs.
vi.mock('../../server/db', () => ({ db: {} }));

let parseWindows: typeof import('../../scripts/prune-retention')['parseWindows'];
let DEFAULT_WINDOWS: typeof import('../../scripts/prune-retention')['DEFAULT_WINDOWS'];

beforeAll(async () => {
  ({ parseWindows, DEFAULT_WINDOWS } = await import('../../scripts/prune-retention'));
});

/**
 * Retention windows.
 *
 * These decide what is deleted for every customer, so the defaults are pinned: a typo that
 * shortened one would delete rows the privacy policy says are kept, and nothing would fail.
 */
describe('retention windows', () => {
  it('has the published defaults', () => {
    expect(DEFAULT_WINDOWS).toEqual({
      aiUsageDays: 400,
      aiCacheDays: 90,
      jobRunDays: 90,
      sessionDays: 1,
    });
  });

  it('returns the defaults when no flag is given', () => {
    expect(parseWindows([])).toEqual(DEFAULT_WINDOWS);
  });

  it('overrides one window and leaves the others alone', () => {
    expect(parseWindows(['--ai-usage-days=200'])).toEqual({
      ...DEFAULT_WINDOWS,
      aiUsageDays: 200,
    });
  });

  it('accepts every window', () => {
    expect(
      parseWindows(['--ai-usage-days=10', '--ai-cache-days=20', '--job-run-days=30', '--session-days=2']),
    ).toEqual({ aiUsageDays: 10, aiCacheDays: 20, jobRunDays: 30, sessionDays: 2 });
  });

  it('refuses a window that would delete everything', () => {
    // Zero days means "delete rows written today". That must be a loud error, not a silent run.
    expect(parseWindows(['--ai-usage-days=0'])).toEqual({ error: 'invalid window: --ai-usage-days=0' });
    expect(parseWindows(['--session-days=-5'])).toEqual({ error: 'invalid window: --session-days=-5' });
  });

  it('ignores flags it does not own, so --dry-run can sit next to them', () => {
    expect(parseWindows(['--dry-run', '--ai-cache-days=7'])).toEqual({
      ...DEFAULT_WINDOWS,
      aiCacheDays: 7,
    });
  });
});
