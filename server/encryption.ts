
import crypto from 'crypto';

// Get encryption key from Replit Secrets or generate a fallback for development
const getEncryptionKey = (): Buffer => {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('ENCRYPTION_KEY not found in environment variables. Using temporary key for development.');
    return crypto.randomBytes(32);
  }
  
  // Convert hex string from environment to Buffer
  return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
};

const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-gcm';
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

  private static isEncryptionEnabled(): boolean {
    // Enable encryption in production or when explicitly enabled
    return process.env.NODE_ENV === 'production' || process.env.ENCRYPTION_ENABLED === 'true';
  }

  static encrypt(text: string): string {
    if (!this.isEncryptionEnabled() || !text) {
      return text;
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return format: iv:encrypted
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      return text; // Fallback to original text if encryption fails
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

    if (!encryptedData.includes(':')) {
      return encryptedData; // Return as-is if not encrypted
    }

    const [ivHex, encrypted] = encryptedData.split(':');
    if (!ivHex || !encrypted) {
      return encryptedData; // Return as-is if malformed
    }

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch {
      // Backward compatibility for legacy createCipher format
      try {
        const legacyDecipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
        let decrypted = legacyDecipher.update(encrypted, 'hex', 'utf8');
        decrypted += legacyDecipher.final('utf8');
        return decrypted;
      } catch {
        return null;
      }
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
        console.error(
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

  static encryptAmount(amount: string): string {
    return this.encrypt(amount);
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
    return Boolean(data && data.includes(':') && data.split(':').length === 2);
  }

  // Method to get encryption status
  static getEncryptionStatus(): { enabled: boolean; environment: string } {
    return {
      enabled: this.isEncryptionEnabled(),
      environment: process.env.NODE_ENV || 'development'
    };
  }
}
