import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../server/db';
import { DataEncryption } from '../server/encryption';

/**
 * Encrypts rows written before a column was covered.
 *
 * Encryption is applied on write, so a column added to the list only becomes protected as rows
 * are saved again — a receipt from last year, an old repeating payment or a goal created in 2024
 * would stay readable to anyone with database access indefinitely. This walks the tables once and
 * rewrites every value that is still plaintext.
 *
 * Safe to run twice: a value that is already ciphertext is skipped, so a second run changes
 * nothing. It prints counts only — never a row's content.
 *
 * Usage:
 *   npx tsx scripts/backfill-field-encryption.ts            # dry run
 *   npx tsx scripts/backfill-field-encryption.ts --apply    # write
 */
const APPLY = process.argv.includes('--apply');
const BATCH = 500;

/** The two shapes `DataEncryption.encrypt` produces; anything else is plaintext. */
function needsEncryption(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (value.startsWith('v2:')) return false;
  if (/^[0-9a-f]{16,}:[0-9a-f]{2,}$/i.test(value)) return false;
  return true;
}

async function backfillTextColumns(table: string, columns: string[]): Promise<number> {
  let offset = 0;
  let rowsChanged = 0;

  for (;;) {
    const result: any = await db.execute(sql`
      select id, ${sql.raw(columns.join(', '))}
        from ${sql.raw(table)}
       order by id
       limit ${BATCH} offset ${offset}
    `);
    const rows = (result?.rows ?? result) as Array<Record<string, unknown>>;
    if (!rows.length) break;
    offset += rows.length;

    for (const row of rows) {
      let touched = false;
      for (const column of columns) {
        const raw = row[column];
        if (!needsEncryption(raw)) continue;
        touched = true;
        if (!APPLY) continue;
        // One column per statement keeps the SQL obviously valid and is plenty for a one-off run.
        await db.execute(sql`
          update ${sql.raw(table)}
             set ${sql.raw(column)} = ${DataEncryption.encrypt(raw)}
           where id = ${row.id as number}
        `);
      }
      if (touched) rowsChanged += 1;
    }
  }

  return rowsChanged;
}

/** `jsonb` columns hold an object until they are encrypted, then a JSON string of ciphertext. */
async function backfillJsonColumns(table: string, columns: string[]): Promise<number> {
  let offset = 0;
  let rowsChanged = 0;

  for (;;) {
    const result: any = await db.execute(sql`
      select id, ${sql.raw(columns.join(', '))}
        from ${sql.raw(table)}
       order by id
       limit ${BATCH} offset ${offset}
    `);
    const rows = (result?.rows ?? result) as Array<Record<string, unknown>>;
    if (!rows.length) break;
    offset += rows.length;

    for (const row of rows) {
      let touched = false;
      for (const column of columns) {
        const raw = row[column];
        // A string is either already ciphertext (skip) or a bare value nobody encrypted.
        if (typeof raw === 'string') continue;
        if (raw === null || raw === undefined) continue;
        touched = true;
        if (!APPLY) continue;
        const cipher = DataEncryption.encrypt(JSON.stringify(raw));
        await db.execute(sql`
          update ${sql.raw(table)}
             set ${sql.raw(column)} = to_jsonb(${cipher}::text)
           where id = ${row.id as number}
        `);
      }
      if (touched) rowsChanged += 1;
    }
  }

  return rowsChanged;
}

async function main(): Promise<void> {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Rows written without it would not be readable by the key the app uses.',
    );
  }

  // The key must be the one the app already uses: encrypting with a different key would write rows
  // that the running app shows as unreadable. Prove it against a row that is already encrypted.
  const sample: any = await db.execute(sql`
    select description
      from transactions
     where description like 'v2:%'
     limit 1
  `);
  const sampleRow = ((sample?.rows ?? sample) as Array<{ description: string }>)[0];
  if (sampleRow) {
    const readable = DataEncryption.tryDecrypt(sampleRow.description);
    if (readable === null) {
      throw new Error(
        'This ENCRYPTION_KEY cannot read rows the app already encrypted. Refusing to write new ciphertext with a key the app cannot use.',
      );
    }
  }

  const targets: Array<[string, string[], 'text' | 'json']> = [
    ['transactions', ['ocr_text'], 'text'],
    ['recurring_transactions', ['description'], 'text'],
    ['expense_reminders', ['title', 'description', 'reference_note'], 'text'],
    ['goals', ['name', 'description'], 'text'],
    ['ai_cache', ['input_json', 'output_json'], 'json'],
  ];

  let total = 0;
  for (const [table, columns, kind] of targets) {
    const changed =
      kind === 'json'
        ? await backfillJsonColumns(table, columns)
        : await backfillTextColumns(table, columns);
    total += changed;
    console.log(`${table}: ${changed} row(s) ${APPLY ? 'rewritten' : 'would be rewritten'}`);
  }

  console.log(
    APPLY
      ? `Done: ${total} row(s) now encrypted.`
      : `Dry run: ${total} row(s) still hold plaintext. Re-run with --apply to encrypt them.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Encryption backfill failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
