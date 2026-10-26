/**
 * Input rules for core tracking (transactions, budgets, goals, exports).
 * Pure functions so the routes and the unit tests share one definition.
 */

const MAX_AMOUNT = 999_999_999;

export const MAX_DESCRIPTION_LENGTH = 200;
export const MAX_NOTE_LENGTH = 1000;

/** A positive, finite amount rounded to cents, as the string the decimal column expects. */
export function cleanPositiveAmount(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim();
  if (!/^[+]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > MAX_AMOUNT * 100) return null;
  return (cents / 100).toFixed(2);
}

/** Zero or more: goal progress may be 0. */
export function cleanNonNegativeAmount(value: unknown): string | null {
  if (value === 0 || value === '0' || value === '0.00') return '0.00';
  return cleanPositiveAmount(value);
}

export function cleanDateValue(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null;

  const text = typeof value === 'string' ? value.trim() : '';

  /*
   * A plain day (`2026-10-01`, what an `<input type="date">` sends) is a calendar date, not an
   * instant. `new Date("2026-10-01")` parses it as midnight UTC, which is 30 September, 19:00 in
   * Lima: a salary dated the 1st then counted in the previous month's totals and budgets. Noon
   * UTC is the same day in every timezone the app serves (±12 h), so the day survives the round
   * trip. The import path learned this first (`lib/importHelpers.toCalendarDate`); this is the
   * same rule for manual entry and quick add, which is where it was still wrong.
   */
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const noonUtc = new Date(`${text}T12:00:00Z`);
    return Number.isNaN(noonUtc.getTime()) ? null : noonUtc;
  }

  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Trimmed text with a length limit; null when empty or too long. */
export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

/** Positive integer id from a route parameter or form value, or null. */
export function cleanId(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null;
}

/** A spreadsheet treats a cell starting with = + - @ as a formula; prefix it so it stays text. */
export function neutralizeSpreadsheetCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** One CSV field: formula-neutralised and always quoted. */
export function csvField(value: unknown): string {
  return `"${neutralizeSpreadsheetCell(value).replace(/"/g, '""')}"`;
}
