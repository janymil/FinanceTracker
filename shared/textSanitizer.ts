/**
 * What leaves the server before an AI provider reads a bank statement.
 *
 * The consent screen promises that names, card numbers, account numbers and other
 * identifiers are removed first. That promise is only worth the patterns behind it, and the
 * first version of these patterns was tested against real statement lines and failed on the
 * ordinary cases: the holder's name is usually printed in CAPITALS (`JUAN PEREZ GARCIA`), the
 * IBAN is usually printed in groups (`SK68 1100 0000 0026 1234 5678`), and cards are printed
 * with spaces or dashes. All three were sent to the provider untouched while the screen said
 * they were removed.
 *
 * The same patterns also did the opposite kind of damage: `\b[A-Z][a-z]+ [A-Z][a-z]+\b` turned
 * `Tesco Stores` and `Kaufland Slovakia` into `[NAME_REDACTED]`, so the model was asked to
 * categorise a shop that no longer had a name. Redaction that destroys the merchant is not free.
 *
 * So the rules are now:
 *  - generic rules only match things that cannot be a merchant (an IBAN length, a card that
 *    passes Luhn, a date-of-birth number with a slash);
 *  - a person's own name is matched from the account, exactly, instead of guessed from capital
 *    letters — the caller passes it in;
 *  - the loose, line-based rules (a name after `Titular:`/`Klient:`/`Holder:`, an address) only
 *    look at the header region, where those lines actually live.
 */

export type SensitiveKind =
  | 'name'
  | 'account'
  | 'ssn'
  | 'card'
  | 'iban'
  | 'email'
  | 'phone'
  | 'address'
  | 'balance';

export interface SensitiveDataHit {
  type: SensitiveKind;
  count: number;
  /** Already masked: the whole point is that an example must not undo the redaction. */
  examples: string[];
  redactionPattern: string;
}

export interface SanitizeOptions {
  /** The account holder's name(s), as stored on the account. Matched exactly, not guessed. */
  holderNames?: Array<string | null | undefined>;
  /** Lines from the top of the document that are treated as the statement header. */
  headerLines?: number;
}

export interface SanitizeResult {
  sanitized: string;
  detectedData: SensitiveDataHit[];
}

const REDACTION = {
  name: '[NAME_REDACTED]',
  account: '[ACCOUNT_REDACTED]',
  ssn: '[SSN_REDACTED]',
  card: '[CARD_REDACTED]',
  iban: '[IBAN_REDACTED]',
  email: '[EMAIL_REDACTED]',
  phone: '[PHONE_REDACTED]',
  address: '[ADDRESS_REDACTED]',
  balance: '[BALANCE_REDACTED]',
} as const;

/** Keep enough to recognise the kind of value, never enough to read it. */
function maskNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? `****${digits.slice(-4)}` : '****';
}

function maskName(value: string): string {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}***`);
  return initials.join(' ') || '***';
}

function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  return `${(local ?? '').slice(0, 1)}***@${domain ?? '***'}`;
}

/** Luhn: what separates a card number from a reference number of the same length. */
function passesLuhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Every spelling a name can take on a statement: with and without diacritics. */
function nameVariants(name: string): string[] {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 3) return [];
  return Array.from(new Set([trimmed, stripDiacritics(trimmed)])).filter(Boolean);
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * IBAN as printed: two country letters, two check digits, then groups, sometimes with spaces and
 * sometimes without. 15–34 characters is the ISO 13616 range, which is what keeps this from
 * matching an ordinary product code.
 */
const IBAN_SHAPE = /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]{1,4}){3,9}\b/g;

/** A run of digits with the separators cards are printed with, so groups stay together. */
const CARD_SHAPE = /\b(?:\d[ -]?){12,22}\d\b/g;

/** Spanish/Latin/Slovak street prefixes, used only inside the header region. */
const ADDRESS_PREFIX =
  /\b(?:calle|avenida|av\.|jr\.|jirón|jiron|urbanización|urbanizacion|urb\.|pasaje|ulica|ul\.|trieda)\s+[^\n,;]{3,60}/gi;

const HEADER_LABEL =
  /^(\s*(?:titular|cliente|nombre(?: del (?:titular|cliente))?|name|account holder|holder|majitel|majiteľ|meno(?: majiteľa)?|klient|inhaber|kontoinhaber)\s*[:\-]\s*)(.+)$/i;

const US_STREET_ADDRESS =
  /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court)\b/gi;


/**
 * Remove identifiers from statement text, and report what was removed.
 *
 * Order matters: value shapes that carry their own check run before the loose digit rule, so a
 * card printed with spaces is labelled a card instead of being half-eaten as 4-digit runs.
 */
export function sanitizeStatementText(text: string, options: SanitizeOptions = {}): SanitizeResult {
  const headerLines = Math.max(0, options.headerLines ?? 20);
  const hits: SensitiveDataHit[] = [];
  let sanitized = text;

  const record = (type: SensitiveKind, values: string[], mask: (value: string) => string) => {
    if (values.length === 0) return;
    hits.push({
      type,
      count: values.length,
      examples: values.slice(0, 3).map(mask),
      redactionPattern: REDACTION[type],
    });
  };

  // 1. E-mail addresses.
  {
    const pattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const values = sanitized.match(pattern) ?? [];
    record('email', values, maskEmail);
    sanitized = sanitized.replace(pattern, REDACTION.email);
  }

  // 2. IBAN, grouped or not — before the digit rule, or the groups are eaten separately.
  {
    const values: string[] = [];
    sanitized = sanitized.replace(IBAN_SHAPE, (match) => {
      const compact = match.replace(/[ -]/g, '');
      if (compact.length < 15 || compact.length > 34) return match;
      values.push(match);
      return REDACTION.iban;
    });
    record('iban', values, maskNumber);
  }

  // 3. Card numbers printed with any of the usual separators.
  {
    const values: string[] = [];
    sanitized = sanitized.replace(CARD_SHAPE, (match) => {
      if (!passesLuhn(match.replace(/\D/g, ''))) return match;
      values.push(match);
      return REDACTION.card;
    });
    record('card', values, maskNumber);
  }

  // 4. US SSN and the Central-European birth number (`900101/1234`).
  {
    const ssn = sanitized.match(/\b\d{3}-\d{2}-\d{4}\b/g) ?? [];
    record('ssn', ssn, maskNumber);
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, REDACTION.ssn);

    const birthNumbers = sanitized.match(/\b\d{6}\s?\/\s?\d{3,4}\b/g) ?? [];
    record('ssn', birthNumbers, maskNumber);
    sanitized = sanitized.replace(/\b\d{6}\s?\/\s?\d{3,4}\b/g, REDACTION.ssn);
  }

  // 5. Long plain digit runs: account numbers, DNIs and the like. A run that is the integer part
  //    of a decimal amount (`12345678.90`) is money, not an account.
  {
    const values: string[] = [];
    sanitized = sanitized.replace(/\b\d{8,20}\b/g, (match, offset: number, whole: string) => {
      const next = whole.slice(offset + match.length, offset + match.length + 3);
      if (/^[.,]\d/.test(next)) return match;
      values.push(match);
      return REDACTION.account;
    });
    record('account', values, maskNumber);
  }

  // 6. The account holder's own name, taken from the account rather than guessed from capitals.
  {
    const values: string[] = [];
    for (const raw of options.holderNames ?? []) {
      const name = (raw ?? '').trim();
      if (name.length < 3) continue;
      for (const variant of nameVariants(name)) {
        const pattern = new RegExp(variant.split(/\s+/).map(escapeRegExp).join('\\s+'), 'gi');
        sanitized = sanitized.replace(pattern, () => {
          values.push(variant);
          return REDACTION.name;
        });
      }
    }
    record('name', values, maskName);
  }

  // 7. Line rules, header region only: a name after a label, and an address.
  {
    const lines = sanitized.split('\n');
    const nameValues: string[] = [];
    const addressValues: string[] = [];
    const limit = Math.min(headerLines, lines.length);

    for (let index = 0; index < limit; index += 1) {
      let line = lines[index];

      const labelled = line.match(HEADER_LABEL);
      if (labelled) {
        const value = labelled[2];
        // Only the part that reads like a name; a balance printed after it survives.
        const namePart = value.match(/^[^\d]{3,60}/);
        if (namePart && /[A-Za-z\u00C0-\u024F]{2}/.test(namePart[0])) {
          nameValues.push(namePart[0].trim());
          line = `${labelled[1]}${REDACTION.name}${value.slice(namePart[0].length)}`;
        }
      }

      line = line.replace(ADDRESS_PREFIX, (match) => {
        addressValues.push(match);
        return REDACTION.address;
      });
      line = line.replace(US_STREET_ADDRESS, (match) => {
        addressValues.push(match);
        return REDACTION.address;
      });

      lines[index] = line;
    }

    sanitized = lines.join('\n');
    record('name', nameValues, maskName);
    record('address', addressValues, () => '***');
  }

  // 8. Phone numbers in their common groupings.
  {
    const pattern = /\b(?:\+?\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?)?\d{2,4}[ .-]\d{2,4}[ .-]\d{2,4}\b/g;
    const values = sanitized.match(pattern) ?? [];
    record('phone', values, maskNumber);
    sanitized = sanitized.replace(pattern, REDACTION.phone);
  }

  // 9. Balance and total lines are not transactions, and the parser is told to ignore them.
  {
    const values = [
      ...(sanitized.match(/^.*\bbalance\b.*$/gim) ?? []),
      ...(sanitized.match(/^.*\b(?:saldo|total)\b.*$/gim) ?? []),
    ];
    record('balance', values, () => '***');
    sanitized = sanitized.replace(/^.*\bbalance\b.*$/gim, REDACTION.balance);
    sanitized = sanitized.replace(/^.*\b(?:saldo|total)\b.*$/gim, REDACTION.balance);
  }

  return { sanitized, detectedData: hits };
}

/** Total redactions, for the "we removed N identifiers" line. */
export const countRedactions = (hits: SensitiveDataHit[]): number =>
  hits.reduce((sum, hit) => sum + hit.count, 0);
