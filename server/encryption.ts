
import crypto from 'crypto';
import { log } from './logger';

// The key is 32 bytes written as 64 hex characters. Development may fall back to a
// throwaway key; production must never do so, because every row written with a key that
// disappears on restart becomes unreadable.
const getEncryptionKey = (): Buffer => {
  const raw = process.env.ENCRYPTION_KEY;
  const valid = Boolean(raw && /^[0-9a-fA-F]{64}$/.test(raw));

  if (!valid) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY must be set to exactly 64 hex characters in production.');
    }
    log.warn('ENCRYPTION_KEY missing or not 64 hex characters. Using a temporary key for development.');
    return crypto.randomBytes(32);
  }

  return Buffer.from(raw as string, 'hex');
};

const ENCRYPTION_KEY = getEncryptionKey();

function parseKey(raw: string | undefined): Buffer | null {
  const value = (raw ?? '').trim();
  return /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, 'hex') : null;
}

/**
 * Every key that may have written a row: the current one first, then the ones handed over in
 * `ENCRYPTION_KEY_PREVIOUS`.
 *
 * Rotation used to be all-or-nothing: the ciphertext carries no key id, so the only way to change
 * the key was to re-encrypt every row inside one window, and a half-finished run left rows nobody
 * could read. With a ring the new key writes immediately while the old one still reads, so a
 * rotation is three steps that can each be watched: put the old value in PREVIOUS, put the new one
 * in ENCRYPTION_KEY, run `db:encrypt:backfill --apply`, then empty PREVIOUS.
 *
 * Only the current key ever *writes*. A previous key that is also allowed to write would make the
 * backfill pointless: rows would keep landing in the old scheme.
 */
const DECRYPTION_KEYS: Buffer[] = (() => {
  const keys: Buffer[] = [ENCRYPTION_KEY];
  for (const part of (process.env.ENCRYPTION_KEY_PREVIOUS ?? '').split(',')) {
    const key = parseKey(part);
    if (key && !keys.some((existing) => existing.equals(key))) keys.push(key);
  }
  return keys;
})();

/** How many keys this process can read with. 1 unless a rotation is in progress. */
export const encryptionKeyRingSize = (): number => DECRYPTION_KEYS.length;

/**
 * Version prefix for the authenticated scheme (AES-256-GCM). A value that does not start with
 * it is legacy AES-256-CBC, `iv:ciphertext`. Both are read; only the new one is written.
 */
const SCHEME_GCM = 'v2';
const GCM_IV_BYTES = 12;

/**
 * True when `ENCRYPTION_KEY` came from the environment as 64 hex characters, rather than being
 * the per-process throwaway key generated above for development. A key that changes on restart
 * must never *write* ciphertext: the rows would be unreadable as soon as the process bounced.
 */
const KEY_IS_STABLE = Boolean(
  process.env.ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY),
);

const DECRYPTION_WARNING_INTERVAL_MS = 60_000;

let lastDecryptionWarning = 0;
let suppressedDecryptionWarnings = 0;

export class DataEncryption {
  /**
   * Returned instead of ciphertext when a value cannot be decrypted. Showing the raw
   * `iv:ciphertext` blob in the UI looks like a bug; this marker makes the cause obvious.
   * storage.updateTransaction() refuses to persist this marker, so the original
   * ciphertext is never overwritten by a read.
   */
  static readonly UNREADABLE = '[unreadable: encrypted with a different key]';

  /**
   * Encryption is on in production, when asked for explicitly, and whenever a real key is
   * present.
   *
   * That third clause closes a gap that used to exist: a development machine pointed at a
   * database holding real customer rows wrote them in plain text, because only
   * `NODE_ENV=production` switched the cipher on. With the throwaway key (no valid
   * `ENCRYPTION_KEY`) it stays off deliberately — writing rows with a key that is regenerated
   * on every restart would lose them just as surely as writing them in clear.
   */
  private static isEncryptionEnabled(): boolean {
    return (
      process.env.NODE_ENV === 'production' ||
      process.env.ENCRYPTION_ENABLED === 'true' ||
      KEY_IS_STABLE
    );
  }

  static encrypt(text: string): string {
    if (!this.isEncryptionEnabled() || !text) {
      return text;
    }

    try {
      // AES-256-GCM, not CBC: the tag is an integrity check. A CBC value that is altered
      // either fails to decrypt or decrypts into plausible-looking garbage — and with no tag
      // there is no way to tell the two apart, so tampering is silent. The old format is still
      // readable below; nothing has to be re-encrypted to switch scheme.
      const iv = crypto.randomBytes(GCM_IV_BYTES);
      const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Return format: v2:iv:tag:ciphertext (all hex). The prefix is the discriminator that
      // lets tryDecrypt read rows written by either scheme.
      return [SCHEME_GCM, iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted].join(':');
    } catch (error) {
      // Never fall back to storing the plain text of something that should be encrypted.
      log.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypts a value, returning `null` when the current ENCRYPTION_KEY cannot read it.
   * Use this when the caller needs to distinguish "plaintext" from "wrong key".
   */
  static tryDecrypt(encryptedData: string): string | null {
    if (!this.isEncryptionEnabled() || !encryptedData) {
      return encryptedData;
    }

    // Recognisable ciphertext: `v2:iv:tag:ciphertext`, or the legacy `hexIv:hexCiphertext`.
    // Anything else is plaintext written before that column was covered, and must come back
    // unchanged rather than as UNREADABLE. The legacy pattern is the strict one — a description
    // like "Note: hi" has a colon too, and treating it as ciphertext turned it into UNREADABLE.
    const looksLikeCiphertext =
      encryptedData.startsWith(`${SCHEME_GCM}:`) || /^[0-9a-f]{16,}:[0-9a-f]{2,}$/i.test(encryptedData);
    if (!looksLikeCiphertext) {
      return encryptedData;
    }

    // Every key that could have written it, in order. A wrong key simply fails and the next one
    // is tried; the authentication tag in v2 is what makes "wrong key" indistinguishable from
    // "altered ciphertext", so a null here means the value is not usable either way.
    for (const key of DECRYPTION_KEYS) {
      const plaintext = this.decryptWith(encryptedData, key);
      if (plaintext !== null) return plaintext;
    }

    return null;
  }

  /** One attempt with one key. Null means "this key cannot open this value". */
  private static decryptWith(value: string, key: Buffer): string | null {
    if (value.startsWith(`${SCHEME_GCM}:`)) {
      return this.decryptGcmWith(value, key);
    }

    const [ivHex, encrypted] = value.split(':');
    if (!ivHex || !encrypted) return null;

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch {
      // Backward compatibility for legacy createCipher format
      try {
        const legacyDecipher = crypto.createDecipher('aes-256-cbc', key);
        let decrypted = legacyDecipher.update(encrypted, 'hex', 'utf8');
        decrypted += legacyDecipher.final('utf8');
        return decrypted;
      } catch {
        return null;
      }
    }
  }

  /**
   * `v2:iv:tag:ciphertext`. Returns null for a wrong key *and* for altered ciphertext, because
   * the authentication tag cannot tell us which it was — and both mean "this value is not
   * usable", which is what the caller acts on.
   */
  private static decryptGcmWith(value: string, key: Buffer): string | null {
    const [, ivHex, tagHex, ciphertext] = value.split(':');
    if (!ivHex || !tagHex || !ciphertext) return null;

    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return null;
    }
  }

  static isReadable(value: string): boolean {
    return this.tryDecrypt(value) !== null;
  }

  static decrypt(encryptedData: string): string {
    const plaintext = this.tryDecrypt(encryptedData);

    if (plaintext === null) {
      // One actionable line instead of a stack trace per row (a key mismatch affects
      // every encrypted row, which used to flood the logs on every request).
      const now = Date.now();
      suppressedDecryptionWarnings++;
      if (now - lastDecryptionWarning > DECRYPTION_WARNING_INTERVAL_MS) {
        log.error(
          `[ENCRYPTION] ${suppressedDecryptionWarnings} value(s) could not be decrypted with the current ENCRYPTION_KEY. ` +
          'This database was encrypted with a different key - restore the original ENCRYPTION_KEY to read it.'
        );
        lastDecryptionWarning = now;
        suppressedDecryptionWarnings = 0;
      }
      return this.UNREADABLE;
    }

    return plaintext;
  }

  /**
   * Decrypt only what is actually ciphertext.
   *
   * New columns are encrypted from the first write, but rows written before that are still
   * plaintext, and `decrypt()` turns anything it cannot read into `UNREADABLE`. Worse, the old
   * `isEncrypted()` treated *any* value with exactly one colon as ciphertext, so a plaintext
   * "Lunch: pizza" would have been destroyed on read. The two schemes are recognisable on their
   * own: `v2:iv:tag:ciphertext`, or the legacy `hexIv:hexCiphertext`.
   */
  static decryptIfEncrypted(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') return value;
    if (!this.isEncryptionEnabled()) return value;

    if (value.startsWith(`${SCHEME_GCM}:`)) return this.decrypt(value);
    if (/^[0-9a-f]{16,}:[0-9a-f]{2,}$/i.test(value)) return this.decrypt(value);
    return value;
  }

  /** Encrypt unless the value is already ciphertext (a re-save must not double-encrypt). */
  static encryptIfNeeded(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined || value === '') return value;
    if (value.startsWith(`${SCHEME_GCM}:`)) return value;
    if (/^[0-9a-f]{16,}:[0-9a-f]{2,}$/i.test(value)) return value;
    return this.encrypt(value);
  }

  static decryptAmount(encryptedAmount: string): string {
    return this.decrypt(encryptedAmount);
  }

  static encryptDescription(description: string): string {
    return this.encrypt(description);
  }

  static decryptDescription(encryptedDescription: string): string {
    return this.decrypt(encryptedDescription);
  }

  // Utility method to check if data appears to be encrypted
  static isEncrypted(data: string): boolean {
    if (!data) return false;
    if (data.startsWith(`${SCHEME_GCM}:`)) return data.split(':').length === 4;
    return data.includes(':') && data.split(':').length === 2;
  }

  /** The scheme new writes use, and the one `tryDecrypt` prefers. Reported for diagnostics. */
  static getScheme(): 'aes-256-gcm' {
    return 'aes-256-gcm';
  }

  // Method to get encryption status
  static getEncryptionStatus(): { enabled: boolean; environment: string } {
    return {
      enabled: this.isEncryptionEnabled(),
      environment: process.env.NODE_ENV || 'development'
    };
  }
}
