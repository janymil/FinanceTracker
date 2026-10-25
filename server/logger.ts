/**
 * The server's single logging entry point.
 *
 * Route and service files used to call `console.log` directly, which meant:
 * - debug chatter could not be turned off without editing dozens of files;
 * - every new call site could pick a different level (or none);
 * - nothing stopped a prompt, a token or a card fragment from being printed.
 *
 * Rules for callers:
 * - `log.debug` for development tracing (silent in production unless LOG_LEVEL=debug);
 * - `log.info` for operational milestones ("plan activated", "job finished");
 * - `log.warn` / `log.error` for things a human may need to act on;
 * - never pass secrets, prompts, receipts or personal data — metadata only.
 *
 * This file is also the last line of defence: every argument is scrubbed before it is printed
 * (emails, bearer tokens, JWTs, keys and card/account-length digit strings; and whole values of
 * keys such as `transcript`, `description`, `ocrText`, `email`, `token`). Passing a transcript is
 * still a mistake to fix at the call site — it just no longer reaches pm2.
 *
 * Output stays plain `console.*` on purpose: pm2 already timestamps and rotates it,
 * and existing log-based checks keep working.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

type Level = keyof typeof LEVELS;

/**
 * Keys whose value is never written to a log line, whatever it contains. `transcript` and
 * `ocrText` are people's own words, `description`/`note` are free text they typed, and the rest
 * are credentials. Everything else is metadata and passes through.
 */
const SENSITIVE_KEY =
  /pass(word|phrase)?|secret|token|api[_-]?key|authorization|cookie|session|transcript|receipt|ocr[_-]?text|prompt|description|note|email|iban|card[_-]?number|cvv|account[_-]?number/i;

const MAX_STRING = 300;

/** Credentials and identifiers that are recognisable without a key telling us what they are. */
const PATTERNS: Array<[RegExp, string]> = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '«email»'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer «token»'],
  [/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g, '«key»'],
  [/\bwhsec_[A-Za-z0-9]{8,}\b/g, '«key»'],
  // JWTs (Clerk/Stripe session tokens and the like).
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g, '«jwt»'],
  // 13–19 digits, optionally grouped: card numbers and account numbers.
  [/\b(?:\d[ -]?){12,18}\d\b/g, '«number»'],
];

function scrubString(value: string): string {
  let text = value;
  for (const [pattern, replacement] of PATTERNS) text = text.replace(pattern, replacement);
  return text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}…` : text;
}

/**
 * A log-safe copy of one argument. Errors keep their name, message and stack (scrubbed), because
 * that is what makes a log line useful, but the stack is still text a person's data can leak into.
 */
function scrub(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      stack: value.stack ? scrubString(value.stack) : undefined,
    };
  }

  if (seen.has(value as object)) return '«circular»';
  if (depth >= 3) return '«object»';
  seen.add(value as object);

  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => scrub(entry, depth + 1, seen));

  if (value instanceof Date) return value.toISOString();

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '«redacted»' : scrub(entry, depth + 1, seen);
  }
  return out;
}

function threshold(): number {
  const configured = String(process.env.LOG_LEVEL || '').trim().toLowerCase();
  if (configured in LEVELS) return LEVELS[configured as Level];
  // Production keeps the same visibility it had before (info and above);
  // anywhere else debug is useful and free.
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;
}

function emit(level: Level, args: unknown[]): void {
  if (LEVELS[level] < threshold()) return;
  // Scrubbing happens here, once, so a call site that passes a transcript or an email by
  // mistake still cannot write it: see SENSITIVE_KEY / PATTERNS above.
  const safe = args.map((arg) => scrub(arg));
  if (level === 'error') console.error(...safe);
  else if (level === 'warn') console.warn(...safe);
  else console.log(...safe);
}

/** Redaction rules, exposed so a test (and any future sink) can use the same definition. */
export const redaction = { sensitiveKey: SENSITIVE_KEY, patterns: PATTERNS, scrub };

export const log = {
  debug: (...args: unknown[]): void => emit('debug', args),
  info: (...args: unknown[]): void => emit('info', args),
  warn: (...args: unknown[]): void => emit('warn', args),
  error: (...args: unknown[]): void => emit('error', args),
};
