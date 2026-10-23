/**
 * Money primitives for Kaptia.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Every monetary value is stored as PostgreSQL `decimal(12,2)`
 * (`shared/schema.ts`), which `pg` / Drizzle hand to us as a *string*
 * (e.g. "84.30"). The client then did
 * `transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0)`
 * in ~40 components, which introduces binary-float drift
 * (0.1 + 0.2 === 0.30000000000000004) and makes "exact to the cent"
 * assertions impossible.
 *
 * CONTRACT
 * --------
 * - Internally we always compute with integer **cents** (`Cents`).
 * - Parsing accepts the DB/API representation (`"84.30"`, `84.3`) and the
 *   human/OCR representation (`"1 234,56"`, `"84,30 €"`).
 * - Rounding is commercial "half away from zero".
 * - `decimal(12,2)` bounds are enforced: |value| <= 9_999_999_999.99 and the
 *   result is always a safe integer.
 * - Never compare money with `toBe(12.34)` in tests — compare cents.
 */

export type Cents = number;
export type AmountInput = string | number | null | undefined;

/** decimal(12,2) => max 10 integer digits => max 999_999_999_999 cents. */
export const MAX_ABS_CENTS = 999_999_999_999;

const CURRENCY_NOISE = /[\s\u00a0\u202f\u2009€$£¥]/g;
const THOUSANDS_DOTTED = /^\d{1,3}(\.\d{3}){2,}$/;
const THOUSANDS_COMMA = /^\d{1,3}(,\d{3}){2,}$/;

function fail(value: unknown, reason: string): never {
  throw new RangeError(`Invalid amount ${JSON.stringify(value)}: ${reason}`);
}

/**
 * Turns "1 234,56" / "1.234,56" / "-84.30" / "84.3" into a canonical
 * "1234.56" string. Currency symbols and whitespace are ignored because OCR
 * and the voice parser hand us values like "12,50 €".
 */
function canonicalize(raw: string, original: unknown): string {
  let text = raw.replace(CURRENCY_NOISE, '');
  if (text === '') fail(original, 'no digits found');

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  let decimalSep: '.' | ',' | null = null;

  if (hasComma && hasDot) {
    // "1.234,56" (EU) or "1,234.56" (US) — the right-most separator wins.
    decimalSep = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
  } else if (hasComma) {
    // "1234,56" => decimal; "1,234,567" => thousands.
    decimalSep = THOUSANDS_COMMA.test(text) ? null : ',';
  } else if (hasDot) {
    // "1234.56" => decimal (DB/API format); "1.234.567" => thousands.
    decimalSep = THOUSANDS_DOTTED.test(text) ? null : '.';
  }

  if (decimalSep === null) {
    text = text.replace(/[.,]/g, '');
  } else {
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    const cut = text.lastIndexOf(decimalSep);
    const head = text.slice(0, cut).replaceAll(thousandsSep, '');
    const tail = text.slice(cut + 1);
    text = `${head}.${tail}`;
  }

  if (!/^[+-]?\d*(?:\.\d*)?$/.test(text) || !/\d/.test(text)) {
    fail(original, 'not a decimal number');
  }
  return text;
}

/** Exact string -> cents conversion, rounded half away from zero. */
function decimalStringToCents(text: string, original: unknown): Cents {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match) fail(original, 'not a decimal number');

  const sign = match[1] === '-' ? -1 : 1;
  const intPart = (match[2] || '0').replace(/^0+(?=\d)/, '');
  const fracPart = match[3] || '';

  if (intPart.length > 10) fail(original, 'exceeds decimal(12,2) range');

  const firstTwo = (fracPart + '00').slice(0, 2);
  const thirdDigit = fracPart.length > 2 ? fracPart.charCodeAt(2) : 0;

  let cents = Number(intPart) * 100 + Number(firstTwo);
  if (thirdDigit >= 53 /* '5' */) cents += 1; // half away from zero
  cents *= sign;

  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_ABS_CENTS) {
    fail(original, 'exceeds decimal(12,2) range');
  }
  return cents;
}

/**
 * Parses any supported representation into integer cents.
 * `null` / `undefined` / `""` mean "no amount" and yield `0` — exactly how
 * the app treats optional columns (`budgets.amount`, `goalContributions.amount`).
 */
export function parseAmountToCents(value: AmountInput): Cents {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(value, 'not a finite number');
    if (Math.abs(value) > 1e12) fail(value, 'exceeds decimal(12,2) range');
    // toFixed(3) keeps 3 decimals of the binary value, then we round on the string.
    return decimalStringToCents(value.toFixed(3), value);
  }
  const raw = value.trim();
  if (raw === '') return 0;
  return decimalStringToCents(canonicalize(raw, value), value);
}

/** True when the value is a usable, parseable amount ("" is not). */
export function isValidAmount(value: AmountInput): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  try {
    parseAmountToCents(value);
    return true;
  } catch {
    return false;
  }
}

/** Guard for values that must already be integer cents. */
export function assertCents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Expected integer cents, received ${value}`);
  }
  return value;
}

export function centsToNumber(cents: Cents): number {
  return assertCents(cents) / 100;
}

/** "123456" -> "1234.56" (no thousands separators, always 2 decimals). */
export function centsToDecimalString(cents: Cents): string {
  assertCents(cents);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Rounds an arbitrary float to cents (half away from zero). */
export function roundToCents(value: number): Cents {
  return parseAmountToCents(value);
}

/** Exact sum — the antidote to `parseFloat(...).reduce(...)`. */
export function sumAmountsToCents(values: readonly AmountInput[]): Cents {
  let total = 0;
  for (const value of values) total += parseAmountToCents(value);
  return assertCents(total);
}

export function addCents(...values: readonly Cents[]): Cents {
  return assertCents(values.reduce((sum, value) => sum + assertCents(value), 0));
}

export function subCents(a: Cents, b: Cents): Cents {
  return assertCents(assertCents(a) - assertCents(b));
}

export function absCents(cents: Cents): Cents {
  return assertCents(Math.abs(assertCents(cents)));
}

export function negateCents(cents: Cents): Cents {
  return assertCents(-assertCents(cents));
}

/** -1 / 0 / 1 — deterministic sorting without float subtraction. */
export function compareCents(a: Cents, b: Cents): number {
  const left = assertCents(a);
  const right = assertCents(b);
  return left === right ? 0 : left < right ? -1 : 1;
}

/** Share of `part` in `total` in basis points (1 bp = 0.01 %). */
export function shareOfTotalInBasisPoints(part: Cents, total: Cents): number {
  assertCents(part);
  assertCents(total);
  if (total === 0) return 0;
  return Math.round((absCents(part) * 10_000) / absCents(total));
}

/** Rounds a nullable percentage to 2 decimals, mapping null/NaN to 0. */
export function percentOrZero(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}
