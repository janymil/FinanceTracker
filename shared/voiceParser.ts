/**
 * Deterministic voice-text parser (the part that needs no model).
 *
 * Extracted from `server/routes/voiceRoutes.ts`, where it was 120 untyped lines inside a
 * route file: unimportable, untestable, and it called `new Date()` internally so its
 * output depended on when you ran it.
 *
 * CONTRACT
 * - pure: (transcript, language, now) -> result. No clock, no network, no fs.
 * - `amountInCents` is the source of truth; `amount` keeps the legacy string form.
 * - `needsReview` is true when no amount was found, or when the utterance contains more
 *   than one numeric candidate ("káva 2,50 a croissant 3,20").
 *
 * KNOWN LIMITS (documented, tested): word numbers ("stovka") are not supported, and
 * space-separated thousands ("1 500") are read as two tokens. Those utterances belong to
 * the LLM path (`parseTransactionWithGroq` / `parseTransactionWithMistral`).
 */
import { parseAmountToCents, type Cents } from './money';

export interface VoiceParseResult {
  /** Legacy string form, e.g. "12.50"; empty when no amount was recognised. */
  amount: string;
  amountInCents: Cents | null;
  description: string;
  type: 'income' | 'expense';
  /** YYYY-MM-DD, or empty when the utterance has no relative date. */
  date: string;
  needsReview: boolean;
  note: string;
}

const CURRENCY_WORDS = new Set([
  'euro', 'euros', 'eur', 'dollar', 'dollars', 'usd', 'peso', 'pesos', '$', '€',
]);

// Word-boundary matching: the old `text.includes('plat')` classified "zaplatil"
// (= "paid") as income, because "zaplatil" contains "plat". "výplata" needs its own
// prefix pattern so the fix does not lose the legitimate salary case.
const INCOME_PATTERNS = [
  /\breceived\b/, /\bsalary\b/, /\bincome\b/,
  /\bpríjem\b/, /\bmzda\b/, /\bplat\b/, /\bvýplat/,
  /\bingreso\b/, /\bsalario\b/, /\bsueldo\b/,
];

const YESTERDAY_WORDS = ['yesterday', 'včera', 'ayer'];
const TODAY_WORDS = ['today', 'dnes', 'hoy'];

const DECIMAL = /(\d+)[.:,](\d{1,2})/;
const INTEGER = /^\d+$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local calendar date — `toISOString()` would return yesterday for a 00:30 "today". */
export function toLocalYmd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseVoiceInput(transcript: string, userLanguage: string, now: Date): VoiceParseResult {
  void userLanguage; // kept for signature compatibility; language only affects the LLM prompt

  const text = transcript.toLowerCase().trim();
  const words = transcript.split(/\s+/).filter((word) => word.length > 0);

  let amount = '';
  let amountTokenIndex = -1;
  let amountTokenSpan = 0;
  const numericTokens: number[] = [];

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];

    if (CURRENCY_WORDS.has(word.toLowerCase())) continue;

    const decimalMatch = DECIMAL.exec(word);
    if (decimalMatch) {
      numericTokens.push(i);
      if (!amount) {
        amount = `${decimalMatch[1]}.${decimalMatch[2]}`;
        amountTokenIndex = i;
        amountTokenSpan = 1;
      }
      continue;
    }

    if (!INTEGER.test(word)) continue;

    numericTokens.push(i);
    if (amount) continue;

    const nextWord = words[i + 1];
    if (nextWord && /^\d{1,2}$/.test(nextWord) && Number.parseInt(nextWord, 10) < 100) {
      // "dvanásť päťdesiat" transcribed as digits: "12 50" -> 12.50
      amount = `${word}.${nextWord.padStart(2, '0')}`;
      amountTokenIndex = i;
      amountTokenSpan = 2;
      numericTokens.push(i + 1);
      i += 1;
      continue;
    }

    amount = word;
    amountTokenIndex = i;
    amountTokenSpan = 1;
  }

  const hasExtraNumericToken = numericTokens.some(
    (index) => index < amountTokenIndex || index >= amountTokenIndex + amountTokenSpan,
  );

  // Description: first capitalised token, else first meaningful word (unchanged behaviour).
  let description = '';
  const properNouns = words.filter((word) => /^[A-Z]/.test(word) && word.length > 2);

  if (properNouns.length > 0) {
    description = properNouns[0];
  } else {
    const meaningfulWords = words.filter((word) => {
      const clean = word.toLowerCase().replace(/[^\w]/g, '');
      return clean.length > 2 && !/^\d/.test(clean);
    });
    description = meaningfulWords.length > 0
      ? meaningfulWords[0].charAt(0).toUpperCase() + meaningfulWords[0].slice(1)
      : 'Transaction';
  }

  const type: 'income' | 'expense' = INCOME_PATTERNS.some((pattern) => pattern.test(text))
    ? 'income'
    : 'expense';

  let date = '';
  if (YESTERDAY_WORDS.some((word) => text.includes(word))) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    date = toLocalYmd(yesterday);
  } else if (TODAY_WORDS.some((word) => text.includes(word))) {
    date = toLocalYmd(now);
  }

  let amountInCents: Cents | null = null;
  if (amount) {
    try {
      amountInCents = parseAmountToCents(amount);
    } catch {
      amountInCents = null;
    }
  }

  return {
    amount,
    amountInCents,
    description,
    type,
    date,
    needsReview: amount === '' || hasExtraNumericToken,
    note: transcript,
  };
}
