import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The cipher is the one place in this app where a wrong change loses customer data silently:
 * every transaction description and reference note is encrypted, and a value that cannot be
 * decrypted renders as "[unreadable: encrypted with a different key]" instead of raising.
 *
 * Two things are pinned here:
 *   1. new writes use AES-256-GCM and carry the `v2:` prefix;
 *   2. values written by the old AES-256-CBC code still read, so switching scheme needs no
 *      migration and no downtime.
 *
 * `server/encryption.ts` reads its key at module load, so every test re-imports the module with
 * the environment it wants — a shared import would use one key for the whole file and hide
 * exactly the bug these tests exist to catch.
 */
const KEY_A = '11'.repeat(32);
const KEY_B = '22'.repeat(32);

type EncryptionModule = typeof import('../../server/encryption');

async function load(key: string | undefined, nodeEnv = 'production'): Promise<EncryptionModule> {
  vi.resetModules();
  if (key === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = key;
  process.env.NODE_ENV = nodeEnv;
  return import('../../server/encryption');
}

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.ENCRYPTION_ENABLED;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe('DataEncryption — new writes', () => {
  it('writes the versioned GCM form, not the old iv:ciphertext form', async () => {
    const { DataEncryption } = await load(KEY_A);
    const value = DataEncryption.encrypt('Lunch with Ana');

    expect(value.startsWith('v2:')).toBe(true);
    // v2 : iv(12 bytes) : tag(16 bytes) : ciphertext — four hex fields.
    expect(value.split(':')).toHaveLength(4);
    expect(value.split(':')[1]).toHaveLength(24); // 12 bytes
    expect(value.split(':')[2]).toHaveLength(32); // 16-byte auth tag
    expect(value).not.toContain('Lunch');
  });

  it('round-trips, including text with colons that could look like the format', async () => {
    const { DataEncryption } = await load(KEY_A);
    for (const text of ['Lunch with Ana', 'a:b:c', 'línea de gasto — 100 %']) {
      expect(DataEncryption.decrypt(DataEncryption.encrypt(text))).toBe(text);
    }
    expect(DataEncryption.encrypt('')).toBe('');
  });

  it('produces a different ciphertext for the same plaintext (fresh IV each time)', async () => {
    const { DataEncryption } = await load(KEY_A);
    const first = DataEncryption.encrypt('same text');
    const second = DataEncryption.encrypt('same text');
    expect(first).not.toBe(second);
    expect(DataEncryption.decrypt(first)).toBe('same text');
  });
});

describe('DataEncryption — tamper detection', () => {
  it('refuses a GCM value whose ciphertext was altered instead of returning garbage', async () => {
    const { DataEncryption } = await load(KEY_A);
    const [scheme, iv, tag, ciphertext] = DataEncryption.encrypt('Salary').split(':');

    // Flip one hex digit in the ciphertext: the tag no longer matches.
    const flipped = (ciphertext[0] === 'a' ? 'b' : 'a') + ciphertext.slice(1);
    const tampered = [scheme, iv, tag, flipped].join(':');

    expect(DataEncryption.tryDecrypt(tampered)).toBeNull();
    expect(DataEncryption.decrypt(tampered)).toBe(DataEncryption.UNREADABLE);
  });

  it('refuses a GCM value whose tag was swapped', async () => {
    const { DataEncryption } = await load(KEY_A);
    const [scheme, iv, , ciphertext] = DataEncryption.encrypt('Salary').split(':');
    const forgedTag = '00'.repeat(16);
    expect(DataEncryption.tryDecrypt([scheme, iv, forgedTag, ciphertext].join(':'))).toBeNull();
  });
});

describe('DataEncryption — legacy rows still read', () => {
  /** Exactly what the previous implementation wrote: hex(iv) + ':' + hex(ciphertext). */
  function legacyCbc(plaintext: string, keyHex: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(keyHex, 'hex'), iv);
    return `${iv.toString('hex')}:${cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex')}`;
  }

  it('reads a value written by the old CBC code, with no re-encryption', async () => {
    const stored = legacyCbc('Rent January', KEY_A);
    const { DataEncryption } = await load(KEY_A);

    expect(stored.startsWith('v2:')).toBe(false);
    expect(DataEncryption.decrypt(stored)).toBe('Rent January');
  });

  it('recognises both formats as encrypted', async () => {
    const { DataEncryption } = await load(KEY_A);
    expect(DataEncryption.isEncrypted(legacyCbc('x', KEY_A))).toBe(true);
    expect(DataEncryption.isEncrypted(DataEncryption.encrypt('x'))).toBe(true);
    expect(DataEncryption.isEncrypted('plain text')).toBe(false);
    expect(DataEncryption.isEncrypted('v2:only-two')).toBe(false);
    expect(DataEncryption.isEncrypted('')).toBe(false);
  });
});

describe('DataEncryption — the wrong key', () => {
  it('reports GCM ciphertext as unreadable rather than returning the blob', async () => {
    const writer = await load(KEY_A);
    const stored = writer.DataEncryption.encrypt('Medicines');

    const reader = await load(KEY_B);
    expect(reader.DataEncryption.tryDecrypt(stored)).toBeNull();
    expect(reader.DataEncryption.decrypt(stored)).toBe(reader.DataEncryption.UNREADABLE);
  });

  it('reports legacy CBC ciphertext as unreadable too', async () => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(KEY_A, 'hex'), iv);
    const stored = `${iv.toString('hex')}:${cipher.update('Medicines', 'utf8', 'hex') + cipher.final('hex')}`;

    const reader = await load(KEY_B);
    expect(reader.DataEncryption.tryDecrypt(stored)).toBeNull();
  });
});

describe('DataEncryption — when it is switched on', () => {
  it('encrypts outside production when a real key is present (a dev box pointed at real rows)', async () => {
    const { DataEncryption } = await load(KEY_A, 'development');
    expect(DataEncryption.getEncryptionStatus().enabled).toBe(true);
    expect(DataEncryption.encrypt('Salary')).toMatch(/^v2:/);
  });

  it('stays off with no key outside production, because that key dies on restart', async () => {
    const { DataEncryption } = await load(undefined, 'development');
    expect(DataEncryption.getEncryptionStatus().enabled).toBe(false);
    expect(DataEncryption.encrypt('Salary')).toBe('Salary');
    // A value that was never encrypted must pass through untouched, not become unreadable.
    expect(DataEncryption.decrypt('Salary')).toBe('Salary');
  });

  it('honours the explicit switch', async () => {
    process.env.ENCRYPTION_ENABLED = 'true';
    const { DataEncryption } = await load(KEY_A, 'development');
    expect(DataEncryption.getEncryptionStatus().enabled).toBe(true);
  });

  it('refuses to start production without a valid key', async () => {
    await expect(load(undefined, 'production')).rejects.toThrow(/ENCRYPTION_KEY/);
    await expect(load('not-a-key', 'production')).rejects.toThrow(/ENCRYPTION_KEY/);
  });
});
