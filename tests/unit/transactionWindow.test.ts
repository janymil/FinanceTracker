import { describe, expect, it } from 'vitest';
import { MAX_PAGE_SIZE, parseTransactionWindow } from '../../shared/transactionWindow';

/**
 * What a history request is allowed to ask for.
 *
 * The route used to ignore the query entirely and return everything, so a typo in `limit` was
 * silently the most expensive request the app could make. These cases pin the strict reading:
 * a bad value is a 400, never "here is the whole account".
 */
describe('parseTransactionWindow', () => {
  it('means "everything" when nothing is asked for', () => {
    expect(parseTransactionWindow({})).toEqual({ ok: true, window: {} });
  });

  it('reads a page', () => {
    expect(parseTransactionWindow({ limit: '50', offset: '100' })).toEqual({
      ok: true,
      window: { limit: 50, offset: 100 },
    });
  });

  it('caps the page size instead of trusting the caller', () => {
    const result = parseTransactionWindow({ limit: '100000' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.window.limit).toBe(MAX_PAGE_SIZE);
  });

  it('reads an ISO window', () => {
    const result = parseTransactionWindow({ from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.window.from?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
      expect(result.window.to?.toISOString()).toBe('2026-10-31T23:59:59.999Z');
    }
  });

  it('refuses a limit that is not a positive whole number', () => {
    for (const limit of ['0', '-5', 'abc', '1.5', 'NaN']) {
      expect(parseTransactionWindow({ limit })).toEqual({
        ok: false,
        error: 'limit must be a positive whole number',
      });
    }
  });

  it('refuses a negative offset', () => {
    expect(parseTransactionWindow({ offset: '-1' })).toEqual({ ok: false, error: 'offset must be zero or more' });
  });

  it('refuses a date it cannot read', () => {
    expect(parseTransactionWindow({ from: 'yesterday' })).toEqual({ ok: false, error: 'from must be an ISO date' });
    expect(parseTransactionWindow({ to: '2026-13-45' })).toEqual({ ok: false, error: 'to must be an ISO date' });
  });

  it('refuses a window that ends before it starts', () => {
    expect(
      parseTransactionWindow({ from: '2026-11-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' }),
    ).toEqual({ ok: false, error: 'from must not be after to' });
  });

  it('treats an empty string as "not asked for"', () => {
    // A form that submits `?limit=` with nothing in it must not become a 400 for the whole screen.
    expect(parseTransactionWindow({ limit: '', offset: '', from: '' })).toEqual({ ok: true, window: {} });
  });
});
