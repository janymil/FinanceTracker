/**
 * Currencies a person can track their money in.
 *
 * The account stores the ISO 4217 code ("MXN"), never the symbol: "$" alone cannot tell
 * US dollars from Mexican, Colombian, Chilean or Argentine pesos. Accounts created before
 * this existed hold a symbol, which `resolveStoredCurrency` still understands.
 *
 * This is the currency the person TRACKS in. What Kaptia charges is separate
 * (shared/pricing.ts: soles in Peru, dollars elsewhere).
 */
export interface CurrencyInfo {
  code: string;
  symbol: string;
  /** Digits after the decimal point in everyday use (CLP and PYG have none). */
  decimals: number;
  group: "featured" | "latam" | "other";
}

export const CURRENCIES: CurrencyInfo[] = [
  // The two markets Kaptia is built for
  { code: "PEN", symbol: "S/", decimals: 2, group: "featured" },
  { code: "USD", symbol: "$", decimals: 2, group: "featured" },

  // Latin America
  { code: "MXN", symbol: "$", decimals: 2, group: "latam" },
  { code: "COP", symbol: "$", decimals: 2, group: "latam" },
  { code: "CLP", symbol: "$", decimals: 0, group: "latam" },
  { code: "ARS", symbol: "$", decimals: 2, group: "latam" },
  { code: "BRL", symbol: "R$", decimals: 2, group: "latam" },
  { code: "UYU", symbol: "$U", decimals: 2, group: "latam" },
  { code: "BOB", symbol: "Bs", decimals: 2, group: "latam" },
  { code: "PYG", symbol: "₲", decimals: 0, group: "latam" },
  { code: "GTQ", symbol: "Q", decimals: 2, group: "latam" },
  { code: "CRC", symbol: "₡", decimals: 2, group: "latam" },
  { code: "DOP", symbol: "RD$", decimals: 2, group: "latam" },
  { code: "HNL", symbol: "L", decimals: 2, group: "latam" },
  { code: "NIO", symbol: "C$", decimals: 2, group: "latam" },
  { code: "PAB", symbol: "B/.", decimals: 2, group: "latam" },
  { code: "VES", symbol: "Bs.S", decimals: 2, group: "latam" },

  // Everywhere else
  { code: "EUR", symbol: "€", decimals: 2, group: "other" },
  { code: "GBP", symbol: "£", decimals: 2, group: "other" },
  { code: "CAD", symbol: "CA$", decimals: 2, group: "other" },
  { code: "AUD", symbol: "A$", decimals: 2, group: "other" },
  { code: "CHF", symbol: "CHF", decimals: 2, group: "other" },
  { code: "SEK", symbol: "kr", decimals: 2, group: "other" },
  { code: "PLN", symbol: "zł", decimals: 2, group: "other" },
  { code: "CZK", symbol: "Kč", decimals: 2, group: "other" },
  { code: "HUF", symbol: "Ft", decimals: 0, group: "other" },
  { code: "RUB", symbol: "₽", decimals: 2, group: "other" },
];

/** Symbols used by accounts created before ISO codes were stored. */
const LEGACY_SYMBOL_TO_CODE: Record<string, string> = {
  "$": "USD",
  "S/": "PEN",
  "R$": "BRL",
  "$U": "UYU",
  "Bs": "BOB",
  "€": "EUR",
  "£": "GBP",
  "C$": "CAD", // the old list used C$ for Canadian dollars
  "A$": "AUD",
  "CHF": "CHF",
  "kr": "SEK",
  "zł": "PLN",
  "Kč": "CZK",
  "Ft": "HUF",
  "₽": "RUB",
};

export function currencyByCode(code: string | null | undefined): CurrencyInfo | undefined {
  const upper = String(code ?? "").trim().toUpperCase();
  return CURRENCIES.find((currency) => currency.code === upper);
}

/**
 * Accepts an ISO code ("pen", "PEN") or a legacy symbol ("S/", "$") and returns the
 * currency, or null when it is neither. Never guesses.
 */
export function resolveStoredCurrency(value: string | null | undefined): CurrencyInfo | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const byCode = currencyByCode(raw);
  if (byCode) return byCode;
  const legacyCode = LEGACY_SYMBOL_TO_CODE[raw];
  return legacyCode ? currencyByCode(legacyCode) ?? null : null;
}

export const DEFAULT_CURRENCY_CODE = "USD";

const LOCALE_BY_LANGUAGE: Record<string, string> = { en: "en-US", es: "es-PE", sk: "sk-SK" };

/**
 * `S/ 1,234.50`, `$1,234.50`, `$ 1.234` (CLP has no decimals). The number format follows
 * the page language; the symbol and decimals follow the currency.
 */
export function formatCurrencyAmount(amount: number, code: string, language = "en"): string {
  const info = currencyByCode(code) ?? currencyByCode(DEFAULT_CURRENCY_CODE)!;
  const locale = LOCALE_BY_LANGUAGE[language.slice(0, 2).toLowerCase()] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: info.code,
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    }).format(amount);
  } catch {
    return `${info.symbol}${amount.toFixed(info.decimals)}`;
  }
}

const CURRENCY_BY_TIME_ZONE: Record<string, string> = {
  "America/Lima": "PEN",
  "America/Mexico_City": "MXN",
  "America/Bogota": "COP",
  "America/Santiago": "CLP",
  "America/Argentina/Buenos_Aires": "ARS",
  "America/Sao_Paulo": "BRL",
  "America/Montevideo": "UYU",
  "America/La_Paz": "BOB",
  "America/Asuncion": "PYG",
  "America/Guatemala": "GTQ",
  "America/Costa_Rica": "CRC",
  "America/Santo_Domingo": "DOP",
  "America/Panama": "PAB",
  "America/Caracas": "VES",
  "America/Guayaquil": "USD",
  "America/Toronto": "CAD",
  "Europe/London": "GBP",
  "Europe/Warsaw": "PLN",
  "Europe/Prague": "CZK",
  "Europe/Moscow": "RUB",
  "Australia/Sydney": "AUD",
  "Australia/Perth": "AUD",
  "Australia/Adelaide": "AUD",
};

const EURO_ZONES = new Set([
  "Europe/Bratislava", "Europe/Madrid", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Vienna",
  "Europe/Athens", "Europe/Helsinki", "Europe/Dublin", "Europe/Lisbon", "Atlantic/Azores",
]);

/**
 * The currency a new person most likely tracks in: their device's time zone says where they live,
 * the page language is the fallback. Only a suggestion; they still choose.
 */
export function suggestCurrencyCode(timeZone?: string | null, language?: string | null): string {
  if (timeZone) {
    const byZone = CURRENCY_BY_TIME_ZONE[timeZone] ?? (EURO_ZONES.has(timeZone) ? "EUR" : undefined);
    if (byZone) return byZone;
  }
  const lang = (language ?? "").slice(0, 2).toLowerCase();
  if (lang === "es") return "PEN";
  if (lang === "sk") return "EUR";
  return DEFAULT_CURRENCY_CODE;
}
