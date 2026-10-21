import 'dotenv/config';
import { db } from '../server/db';
import { DataEncryption } from '../server/encryption';
import { sql } from 'drizzle-orm';

/**
 * Cleans up rows that were encrypted with a previous ENCRYPTION_KEY.
 *
 * Their original text is unrecoverable, and they render as
 * "[unreadable: encrypted with a different key]". This replaces that placeholder with a
 * readable label built from the category, so lists look normal again. Amounts, dates,
 * categories and types are untouched.
 *
 * Usage:
 *   npx tsx scripts/relabel-legacy-encrypted.ts            # dry run
 *   npx tsx scripts/relabel-legacy-encrypted.ts --apply    # write
 */
const APPLY = process.argv.includes('--apply');
const userArgIndex = process.argv.indexOf('--user');
const userEmail = userArgIndex > -1 ? process.argv[userArgIndex + 1] : null;

async function main() {
  const res: any = await db.execute(sql`
    select t.id,
           t.description,
           t.type,
           u.email as user_email,
           c.name as category_name
      from transactions t
      join users u on u.id = t.user_id
      left join categories c on c.id = t.category_id
     order by t.id
  `);
  const allRows = (res?.rows ?? res) as any[];

  const rows = userEmail
    ? allRows.filter((row) => String(row.user_email || '').toLowerCase() === userEmail.toLowerCase())
    : allRows;

  const legacy = rows.filter(
    (row) => row.description && !DataEncryption.isReadable(row.description),
  );

  console.log(`scope: ${userEmail ?? 'all users'}`);
  console.log(`transactions total: ${rows.length}`);
  console.log(`legacy (unreadable) rows: ${legacy.length}`);
  console.log(`mode: ${APPLY ? 'APPLY' : 'dry run'}`);

  for (const row of legacy.slice(0, 10)) {
    console.log(`  #${row.id} ${row.type ?? ''} ${row.category_name ?? '(no category)'}`);
  }
  if (legacy.length > 10) console.log(`  ... and ${legacy.length - 10} more`);

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to relabel these rows.');
    return;
  }

  let updated = 0;
  for (const row of legacy) {
    const label = `Legacy transaction${row.category_name ? ` - ${row.category_name}` : ''}`;
    const encrypted = DataEncryption.encryptDescription(label);
    await db.execute(sql`update transactions set description = ${encrypted} where id = ${row.id}`);
    updated++;
  }

  console.log(`\nrelabelled ${updated} row(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('ERR:', error.message);
    process.exit(1);
  });
