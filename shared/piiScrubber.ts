/**
 * PII scrubbing for error reporting.
 *
 * WHY: `server/groqClient.ts` logs the first 100 characters of a voice transcript and
 * `server/routes/transactionRoutes.ts` logs a full financial summary. Sending that to a
 * third-party error tracker (Sentry) without scrubbing would ship customers' financial
 * data and speech transcripts abroad. GDPR/SK Act 18/2018 problem, not a style issue.
 *
 * RULES
 * - Field-name redaction wins over content: a known sensitive key is always replaced.
 * - Content redaction catches what leaks through free text (emails, phones, IBANs, PANs).
 * - Numbers are kept: amounts are needed to debug and are not directly identifying.
 * - Pure, dependency-free, depth/length limited so a huge payload cannot hang the process.
 */

export type Redacted = string;

const REDACTED = '[redacted]';

/** Lower-case key names whose value is never sent. */
const SENSITIVE_KEYS = new Set([
  'description',
  'referencenote',
  'ocrtext',
  'ocrcategory',
  'ocrvendor',
  'transcript',
  'note',
  'email',
  'phone',
  'firstname',
  'lastname',
  'fullname',
  'address',
  'iban',
  'cardnumber',
  'paymenturl',
  'stripecustomerid',
  'stripesubscriptionid',
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
]);

const SENSITIVE_KEY_PATTERN = /(password|passwd|secret|token|api[_-]?key|authorization|cookie)/i;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}[ ]?[A-Z0-9]{1,4}\b/g;
const CARD_SEPARATED = /\b\d{4}(?:[ -]\d{4}){2,4}\b/g;
const CARD_PLAIN = /\b\d{13,19}\b/g;
const PHONE_INTL = /(?:\+|00)\d{1,3}[\s-]?(?:\d[\s-]?){6,12}\d/g;
// 0912 345 678 / 02 123 4567 — the area code is 2 to 4 digits in SK/CZ.
const PHONE_LOCAL = /\b0\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4}\b/g;

const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 50;

/** Redacts emails, IBANs, card numbers and phone numbers inside free text. */
export function scrubString(value: string): string {
  if (value.length === 0) return value;
  let text = value;
  text = text.replace(EMAIL, '[redacted:email]');
  text = text.replace(IBAN, '[redacted:iban]');
  text = text.replace(CARD_SEPARATED, '[redacted:card]');
  text = text.replace(CARD_PLAIN, '[redacted:card]');
  text = text.replace(PHONE_INTL, '[redacted:phone]');
  text = text.replace(PHONE_LOCAL, '[redacted:phone]');
  return text;
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.has(lower) || SENSITIVE_KEY_PATTERN.test(lower);
}

/**
 * Recursively redacts a value. Objects keep their shape (keys are needed for debugging),
 * values under sensitive keys become `[redacted]`.
 */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[redacted:depth]';

  if (typeof value === 'string') return scrubString(value);
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    return '[redacted:type]';
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      stack: value.stack ? scrubString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => scrubValue(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push('[redacted:truncated]');
    return items;
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(source)) {
      result[key] = isSensitiveKey(key) ? REDACTED : scrubValue(entry, depth + 1);
    }
    return result;
  }

  return REDACTED;
}

export interface ScrubbableEvent {
  message?: string;
  user?: Record<string, unknown>;
  request?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * Scrubs a Sentry event in place-safe fashion (returns a new object).
 * `user` is reduced to `{ id }` — email/username/ip are dropped on purpose.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  const scrubbed: ScrubbableEvent = { ...event };

  if (typeof event.message === 'string') scrubbed.message = scrubString(event.message);

  if (event.user && typeof event.user === 'object') {
    scrubbed.user = event.user.id !== undefined ? { id: event.user.id } : {};
  }

  if (event.request && typeof event.request === 'object') {
    scrubbed.request = scrubValue(event.request) as Record<string, unknown>;
  }

  if (event.extra && typeof event.extra === 'object') {
    scrubbed.extra = scrubValue(event.extra) as Record<string, unknown>;
  }

  if (event.contexts && typeof event.contexts === 'object') {
    scrubbed.contexts = scrubValue(event.contexts) as Record<string, unknown>;
  }

  if (Array.isArray(event.breadcrumbs)) {
    scrubbed.breadcrumbs = event.breadcrumbs.map((crumb) => scrubValue(crumb) as Record<string, unknown>);
  }

  return scrubbed as T;
}

/** Scrubs a single breadcrumb (message + data), keeping the category. */
export function scrubBreadcrumb<T extends Record<string, unknown>>(breadcrumb: T): T {
  const scrubbed: Record<string, unknown> = { ...breadcrumb };
  if (typeof breadcrumb.message === 'string') {
    scrubbed.message = scrubString(breadcrumb.message);
  }
  if (breadcrumb.data && typeof breadcrumb.data === 'object') {
    scrubbed.data = scrubValue(breadcrumb.data);
  }
  return scrubbed as T;
}
