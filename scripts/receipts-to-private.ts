import 'dotenv/config';
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../server/db';
import { cloudStorage } from '../server/cloudStorage';

/**
 * Moves receipt photos out of the public bucket layout.
 *
 * Until the readiness review, a receipt was stored as `receipts/receipt-<userId>-<time>.<ext>`
 * and served by the bucket's permanent public URL: the owner was in the name and the rest of the
 * name was a timestamp, so a link could be guessed. New uploads are stored under
 * `receipts/<userId>/<random>` and read through `/api/receipts/...`, which answers only the owner.
 * This script brings the older objects across so the old links stop working on their own.
 *
 * For each legacy object it copies the bytes to the new layout, points the transaction that
 * referenced the public URL at the private path, and only then deletes the old object. A failure
 * half way therefore leaves the photo readable, never lost.
 *
 * Usage:
 *   npx tsx scripts/receipts-to-private.ts            # dry run: count only
 *   npx tsx scripts/receipts-to-private.ts --apply    # move
 *
 * Run it against the environment whose rows you are rewriting: `NODE_ENV=production` makes
 * `server/db.ts` use `DATABASE_URL_PROD`, and the old object must only be deleted after that
 * environment's rows point at the copy. Running it on a development database would delete photos
 * that production still references.
 */
const APPLY = process.argv.includes('--apply');
const LEGACY_KEY = /^receipts\/receipt-(.+)-(\d{10,})\.([a-z0-9]{2,5})$/i;

interface LegacyReceipt {
  key: string;
  ownerId: string;
  extension: string;
}

async function main(): Promise<void> {
  const files = await cloudStorage.listFiles('receipts/');

  const legacy: LegacyReceipt[] = [];
  for (const file of files) {
    const key = file.Path && file.Path.startsWith('receipts/') ? file.Path : `receipts/${file.ObjectName}`;
    const match = LEGACY_KEY.exec(key);
    if (match) legacy.push({ key, ownerId: match[1], extension: match[3] });
  }

  console.log(`${files.length} object(s) under receipts/, ${legacy.length} in the old predictable layout`);
  if (!legacy.length) return;

  if (!APPLY) {
    console.log('Dry run: nothing was changed. Re-run with --apply to move them.');
    return;
  }

  let moved = 0;
  let kept = 0;
  let relinked = 0;
  let failed = 0;

  for (const item of legacy) {
    const oldFileName = item.key.split('/').pop() ?? item.key;
    try {
      const { data, contentType } = await cloudStorage.downloadBuffer(item.key);
      const fileName = `${crypto.randomUUID()}.${item.extension}`;
      const newKey = `receipts/${item.ownerId}/${fileName}`;

      await cloudStorage.uploadFile(newKey, data, contentType || 'image/jpeg');

      const oldUrl = cloudStorage.getPublicUrl(item.key);
      const result: any = await db.execute(sql`
        update transactions
           set image_url = ${`/api/receipts/${item.ownerId}/${fileName}`}
         where image_url = ${oldUrl}
      `);
      relinked += Number(result?.rowCount ?? 0);

      /*
       * Delete the old object only when nothing points at it any more.
       *
       * The rewrite above matches one exact URL shape. If a row stored the same photo under a
       * different shape (another public domain, a Bunny URL, a host change), the update matches
       * nothing and deleting the object would remove the only copy of a customer's receipt. So the
       * question asked here is not "did I update a row?" but "does anything still name this file?".
       */
      const stillReferenced: any = await db.execute(sql`
        select count(*)::int as remaining
          from transactions
         where image_url like ${'%' + oldFileName}
      `);
      const remaining = Number(((stillReferenced?.rows ?? stillReferenced) as Array<{ remaining: number }>)[0]?.remaining ?? 0);

      if (remaining > 0) {
        kept += 1;
        console.warn(
          `[receipts] kept ${oldFileName}: ${remaining} row(s) still reference it under a different URL shape — check by hand`,
        );
        continue;
      }

      // The bytes exist twice and nothing names the old key any more.
      await cloudStorage.deleteFile(item.key);
      moved += 1;
    } catch (error) {
      failed += 1;
      console.warn(`[receipts] could not move ${oldFileName}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`moved ${moved}, kept ${kept}, transaction rows re-pointed ${relinked}, failed ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Receipt migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
