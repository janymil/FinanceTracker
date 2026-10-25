import { log } from './logger';
import { sql } from "drizzle-orm";
import { db } from "./db";
import { DataEncryption } from "./encryption";

/**
 * Verifies at boot that the configured ENCRYPTION_KEY can actually read this database.
 * A key mismatch is otherwise silent: every field simply renders as
 * DataEncryption.UNREADABLE and the app looks broken rather than misconfigured.
 */
export async function checkEncryptionKey(): Promise<void> {
  const { enabled, environment } = DataEncryption.getEncryptionStatus();

  if (!enabled) {
    log.info(`[ENCRYPTION] disabled (NODE_ENV=${environment}) - sensitive fields are stored as plaintext`);
    return;
  }

  try {
    const result: any = await db.execute(sql`
      select description, reference_note
        from transactions
       where description like '%:%'
       limit 200
    `);
    const rows = (result?.rows ?? result ?? []) as Array<{
      description: string | null;
      reference_note: string | null;
    }>;

    if (rows.length === 0) {
      log.info('[ENCRYPTION] enabled - no encrypted rows to verify yet');
      return;
    }

    const unreadable = rows.reduce((total, row) => {
      const descriptionBad = row.description ? !DataEncryption.isReadable(row.description) : false;
      const noteBad = row.reference_note ? !DataEncryption.isReadable(row.reference_note) : false;
      return total + (descriptionBad ? 1 : 0) + (noteBad ? 1 : 0);
    }, 0);

    if (unreadable > 0) {
      console.error(
        `[ENCRYPTION] KEY MISMATCH - ${unreadable} encrypted field(s) in ${rows.length} sampled transactions cannot be ` +
        `decrypted with the configured ENCRYPTION_KEY (${process.env.ENCRYPTION_KEY?.length ?? 0} chars). ` +
        `Encrypted text will render as "${DataEncryption.UNREADABLE}". ` +
        'Restore the ENCRYPTION_KEY that encrypted this database, or accept the loss for ' +
        'legacy rows and run "npx tsx scripts/relabel-legacy-encrypted.ts" (dry run first).'
      );
    } else {
      log.info(`[ENCRYPTION] key verified against ${rows.length} encrypted transaction row(s)`);
    }
  } catch (error) {
    console.warn('[ENCRYPTION] startup key check skipped:', (error as Error).message);
  }
}
