/**
 * Field-level encryption for the columns that hold someone's words.
 *
 * Only two transaction fields were encrypted. Receipt text, recurring payments, reminders (with
 * account numbers in them), goal names and the AI cache — which holds whole transaction lists —
 * were readable by anyone who could read the table. These helpers encrypt on write and decrypt on
 * read, and they are safe on rows written before the column was covered: `decryptIfEncrypted`
 * only touches values that are recognisably ciphertext, so existing plaintext keeps working.
 */
import { DataEncryption } from './encryption';

export function encryptField(value: string | null | undefined): string | null | undefined {
  return DataEncryption.encryptIfNeeded(value);
}

export function decryptField(value: string | null | undefined): string | null | undefined {
  return DataEncryption.decryptIfEncrypted(value);
}

/**
 * A JSON column holding ciphertext.
 *
 * `jsonb` accepts a JSON string, so the ciphertext is stored as one string. Rows written before
 * this change still hold the object itself, which the read side passes through untouched.
 */
export function encryptJsonField(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  return DataEncryption.encryptIfNeeded(JSON.stringify(value));
}

export function decryptJsonField<T = unknown>(value: unknown): T {
  if (typeof value !== 'string') return value as T;
  const plain = DataEncryption.decryptIfEncrypted(value);
  try {
    return JSON.parse(String(plain)) as T;
  } catch {
    // Not JSON any more: hand back what was stored rather than throwing inside a cache read.
    return value as T;
  }
}
