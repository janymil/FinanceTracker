/**
 * The window a history request asks for.
 *
 * Lives in `shared/` so the route and its tests agree about what a query string means. The rules
 * are strict on purpose: a typo in `limit` must be a 400, not a silent "here is everything", which
 * is exactly the behaviour this whole change exists to remove.
 */
export const MAX_PAGE_SIZE = 500;

export interface TransactionWindow {
  limit?: number;
  offset?: number;
  from?: Date;
  to?: Date;
}

export type WindowResult = { ok: true; window: TransactionWindow; total?: number } | { ok: false; error: string };

function parseDate(value: unknown): Date | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return 'invalid';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'invalid' : date;
}

/**
 * Reads `limit`, `offset`, `from` and `to` from a query object.
 *
 * No `limit` keeps the historical behaviour (everything) so an old client is unaffected, and the
 * route reports how many rows there are either way — a screen can then say "showing the latest N
 * of M" instead of quietly showing less.
 */
export function parseTransactionWindow(query: Record<string, unknown>): WindowResult {
  const window: TransactionWindow = {};

  const limitRaw = query.limit;
  if (limitRaw !== undefined && limitRaw !== '') {
    const limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1) return { ok: false, error: 'limit must be a positive whole number' };
    window.limit = Math.min(limit, MAX_PAGE_SIZE);
  }

  const offsetRaw = query.offset;
  if (offsetRaw !== undefined && offsetRaw !== '') {
    const offset = Number(offsetRaw);
    if (!Number.isInteger(offset) || offset < 0) return { ok: false, error: 'offset must be zero or more' };
    window.offset = offset;
  }

  const from = parseDate(query.from);
  if (from === 'invalid') return { ok: false, error: 'from must be an ISO date' };
  if (from) window.from = from;

  const to = parseDate(query.to);
  if (to === 'invalid') return { ok: false, error: 'to must be an ISO date' };
  if (to) window.to = to;

  if (window.from && window.to && window.from > window.to) {
    return { ok: false, error: 'from must not be after to' };
  }

  return { ok: true, window };
}
