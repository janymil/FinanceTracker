/**
 * Receipt extraction — PURE half.
 *
 * The route handler in `server/uploadReceipt.ts` used to mix three things in one
 * function: the OpenAI call, the JSON parsing and the field normalization. Only
 * the last one is testable without money and network, so it lives here.
 *
 * The impure half is `server/receiptExtraction.ts` (`extractReceiptWithAI`).
 * Tests import THIS file only, so no provider SDK / API key is ever needed.
 *
 * RULES (blueprint 02)
 * - amounts become integer cents via `shared/money.ts`; a float never leaves this module
 * - `amount <= 0` is treated as "no amount" (kept from the original implementation)
 * - dates never go through `new Date(...)` for numeric formats, so no timezone shift
 * - vendor is trimmed/collapsed and capped at 100 chars
 */
import { centsToNumber, parseAmountToCents, type Cents } from './money';

export interface ReceiptExtractionDraft {
  amountInCents: Cents | null;
  /** YYYY-MM-DD */
  date: string | null;
  vendor: string | null;
  /** Untouched input (model reply), kept for debugging recorded fixtures. */
  raw: unknown;
  provider?: string;
  model?: string;
  error?: string;
}

/** Shape the HTTP API has always returned — do not change without a client update. */
export interface LegacyExtractedReceipt {
  amount?: number;
  date?: string;
  vendor?: string;
}

export const RECEIPT_VENDOR_MAX_LENGTH = 100;

const CURRENCY_CODE = /\b(?:EUR|USD|GBP|CZK|PLN|HUF|CHF|PEN)\b|S\//gi;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EU_DATE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/;

/** "24,89 EUR" -> "24,89" (ISO codes confuse the money parser on purpose). */
export function stripCurrencyCodes(value: string): string {
  return value.replace(CURRENCY_CODE, ' ').replace(/\s+/g, ' ').trim();
}

/** Model value -> integer cents, or null when there is no usable positive amount. */
export function normalizeReceiptAmount(input: unknown): Cents | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number' && !Number.isFinite(input)) return null;

  let value: string | number = input as string | number;
  if (typeof value === 'string') {
    const cleaned = stripCurrencyCodes(value);
    if (cleaned === '') return null;
    value = cleaned;
  }

  try {
    const cents = parseAmountToCents(value);
    return cents > 0 ? cents : null;
  } catch {
    return null;
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Date -> YYYY-MM-DD, or null.
 * Numeric formats are parsed explicitly: `new Date('12.03.2026')` is Invalid in V8
 * and `new Date('2026-03-12')` is UTC midnight (which shifts the day in negative offsets).
 */
export function normalizeReceiptDate(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const text = String(input).trim();
  if (text === '') return null;

  const iso = ISO_DATE.exec(text);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return isValidYmd(year, month, day) ? formatYmd(year, month, day) : null;
  }

  const eu = EU_DATE.exec(text);
  if (eu) {
    const first = Number(eu[1]);
    const second = Number(eu[2]);
    let year = Number(eu[3]);
    if (eu[3].length === 2) year += 2000;

    // Default is EU (d/m/y). Switch to US (m/d/y) only when the numbers force it,
    // e.g. "12/25/2026" — otherwise "03/12/2026" stays 3 December, which is the
    // documented Kaptia default.
    let day = first;
    let month = second;
    if (second > 12 && first <= 12) {
      month = first;
      day = second;
    }

    return isValidYmd(year, month, day) ? formatYmd(year, month, day) : null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;

  // Strings that carry an explicit zone are read in UTC; ambiguous ones in local time.
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  return hasZone
    ? formatYmd(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate())
    : formatYmd(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

/**
 * Month tokens, indexed 0..11, for receipts that print the month as a word.
 *
 * Three languages, because the app is served in `en`, `es` and `sk` and a Peruvian receipt says
 * "AGO". Only a prefix is listed; the rest of the word is swallowed by the pattern, so "agosto",
 * "augusta" and "aug" all resolve to their own month.
 */
const MONTH_TOKENS: string[][] = [
  ['jan'], ['feb'], ['mar'], ['apr'], ['may', 'maj'], ['jun'],
  ['jul'], ['aug', 'ago'], ['sep', 'set'], ['oct', 'okt'], ['nov'], ['dec', 'dic'],
];

/**
 * The receipt's own year, for the case where the model read the day and month but the year wrong.
 *
 * A photo printed "05 AGO. 2026" came back from the model as `2025-08-05`, so the expense was
 * saved a year in the past — where the current month never shows it, and the person who had just
 * scanned the receipt reported "it was not saved". The printed text is the ground truth: when it
 * carries the same day and the same month with a four-digit year, that year wins.
 *
 * Narrow on purpose. A different day or month is a different date (a print date, a card expiry,
 * "valid until") and is left exactly as the model answered, which is the rule `applyRegexFallback`
 * already follows. Two candidate years for that day and month means it is not a correction, so
 * the model's answer stands.
 */
export function matchReceiptYearToText(date: string | null, ocrText: string): string | null {
  if (!date || !ocrText) return date;

  const parts = ISO_DATE.exec(date.trim());
  if (!parts) return date;

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const tokens = MONTH_TOKENS[month - 1];
  if (!tokens) return date;

  const text = ocrText.toLowerCase();
  const dayPattern = day < 10 ? `0?${day}` : String(day);
  const monthPattern = month < 10 ? `0?${month}` : String(month);

  const patterns = [
    // 05.08.2025, 05/08/2025, 05-08-2025, 08/05/2025 (US order), 2025-08-05
    new RegExp(`(?:^|\\D)${dayPattern}[./-]${monthPattern}[./-](\\d{4})(?!\\d)`, 'g'),
    new RegExp(`(?:^|\\D)${monthPattern}[./-]${dayPattern}[./-](\\d{4})(?!\\d)`, 'g'),
    new RegExp(`(?:^|\\D)(\\d{4})[./-]${monthPattern}[./-]${dayPattern}(?!\\d)`, 'g'),
    // 05 AGO. 2026, 5 de agosto de 2026, 05. Aug 2026
    new RegExp(
      `(?:^|\\D)${dayPattern}\\s*(?:de\\s*)?[.\\-/]?\\s*(?:${tokens.join('|')})\\p{L}*\\.?\\s*,?\\s*(?:de\\s*)?(\\d{4})(?!\\d)`,
      'gu',
    ),
  ];

  const found: string[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (!found.includes(match[1])) found.push(match[1]);
      // A zero-length match would spin forever; these patterns always consume a year.
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    }
  }

  if (found.length !== 1) return date;
  const textYear = Number(found[0]);
  if (!isValidYmd(textYear, month, day) || textYear === year) return date;

  return formatYmd(textYear, month, day);
}

/** Vendor -> trimmed, whitespace-collapsed, 1..100 chars, or null. */
export function normalizeReceiptVendor(input: unknown): string | null {
  if (input === null || input === undefined) return null;

  // Coerced like the original implementation (it used String(result.vendor)).
  const vendor = String(input).replace(/\s+/g, ' ').trim();
  if (vendor.length === 0 || vendor.length > RECEIPT_VENDOR_MAX_LENGTH) return null;
  if (/^(?:n\/?a|none|unknown|-+)$/i.test(vendor)) return null;
  return vendor;
}

/**
 * Normalizes whatever the model returned ({ amount, date, vendor }), or an empty
 * draft when it returned something unusable. Never throws.
 */
export function normalizeReceiptExtraction(
  raw: unknown,
  meta: { provider?: string; model?: string } = {},
): ReceiptExtractionDraft {
  const source: Record<string, unknown> =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  return {
    amountInCents: normalizeReceiptAmount(source.amount),
    date: normalizeReceiptDate(source.date),
    vendor: normalizeReceiptVendor(source.vendor),
    raw,
    ...(meta.provider ? { provider: meta.provider } : {}),
    ...(meta.model ? { model: meta.model } : {}),
  };
}

/** Draft -> the legacy `{ amount, date, vendor }` wire shape (omits nulls). */
export function toLegacyExtractedReceipt(draft: ReceiptExtractionDraft): LegacyExtractedReceipt {
  const extracted: LegacyExtractedReceipt = {};
  if (draft.amountInCents !== null) extracted.amount = centsToNumber(draft.amountInCents);
  if (draft.date) extracted.date = draft.date;
  if (draft.vendor) extracted.vendor = draft.vendor;
  return extracted;
}

/* ------------------------------------------------------------------------- *
 * Regex fallbacks.
 *
 * These lived (unused) at the bottom of server/uploadReceipt.ts. They are kept
 * because they need no model at all, and are wired behind an explicit flag
 * (`RECEIPT_REGEX_FALLBACK=1`) — never by default, because a regex on OCR text
 * happily picks up a line item instead of the total.
 * ------------------------------------------------------------------------- */

/** Last currency-marked number (or "total/spolu/celkom" value) — raw string. */
export function extractAmountFromText(text: string): string | null {
  // Symbols and ISO codes both count, including Peru's "S/" — a soles receipt used to
  // fall through to null because only € $ £ ¥ were recognised.
  const currency = '(?:€|\\$|£|¥|\\b(?:EUR|USD|PEN|CZK|PLN|GBP|CHF)\\b|S\\/)';
  const markedRegex = new RegExp(
    `(?:${currency})\\s*(\\d+(?:[.,]\\d{2})?)|(\\d+(?:[.,]\\d{2})?)\\s*(?:${currency})`,
    'gi',
  );
  const marked = Array.from(text.matchAll(markedRegex));
  if (marked.length > 0) {
    return marked[marked.length - 1][0].trim();
  }

  // Keyword and number may be separated by a currency token ("SPOLU EUR 21.80").
  const totalRegex = new RegExp(
    `(?:total|sum|suma|celkom|spolu|celkem|gesamt|importe|monto|amount due|to pay)[^\\d\\n]{0,14}(\\d+(?:[.,]\\d{2})?)`,
    'gi',
  );
  const totals = Array.from(text.matchAll(totalRegex));
  return totals.length > 0 ? totals[totals.length - 1][1] : null;
}

/** First non-empty line, 3..50 chars — usually the merchant header. */
export function extractMerchantFromText(text: string): string | null {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  const firstLine = lines[0];
  if (firstLine && firstLine.length > 2 && firstLine.length < 50) return firstLine;
  return null;
}

/** First date-looking token, raw (not normalized). */
export function extractDateFromText(text: string): string | null {
  const dateRegex = /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})|(\d{2,4}[./-]\d{1,2}[./-]\d{1,2})/g;
  const matches = text.match(dateRegex);
  return matches && matches.length > 0 ? matches[0] : null;
}

/** Fills only the fields the model left empty. Pure; no defaults invented. */
export function applyRegexFallback(
  extracted: LegacyExtractedReceipt,
  ocrText: string,
): LegacyExtractedReceipt {
  const result: LegacyExtractedReceipt = { ...extracted };

  if (result.amount === undefined) {
    const cents = normalizeReceiptAmount(extractAmountFromText(ocrText));
    if (cents !== null) result.amount = centsToNumber(cents);
  }
  if (result.date === undefined) {
    const date = normalizeReceiptDate(extractDateFromText(ocrText));
    if (date !== null) result.date = date;
  }
  if (result.vendor === undefined) {
    const vendor = normalizeReceiptVendor(extractMerchantFromText(ocrText));
    if (vendor !== null) result.vendor = vendor;
  }

  return result;
}

