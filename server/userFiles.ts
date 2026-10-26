/**
 * The stored objects that belong to one person.
 *
 * Deleting an account removed the rows and left everything in object storage: receipt photos, the
 * mascot images, and every cloud backup. The rows are gone, so nothing in the app can find them
 * again — but they are still there, under a name that contains the person's id, which is exactly
 * what a deletion request is about. This lists and removes them by prefix.
 *
 * It is deliberately best-effort: the caller has already erased the records, and refusing the
 * deletion because a bucket was slow would leave the request half-done. Every failure is logged
 * and counted so the leftover is visible instead of silent.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from './logger';
import { cloudStorage } from './cloudStorage';

export interface FileCleanupResult {
  deleted: number;
  failed: number;
}

async function deletePrefix(prefix: string, result: FileCleanupResult): Promise<void> {
  let files: Array<{ ObjectName: string; Path?: string }> = [];
  try {
    files = await cloudStorage.listFiles(prefix);
  } catch (error) {
    result.failed += 1;
    log.warn('[files] Could not list a folder during account deletion', {
      prefix,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  for (const file of files) {
    // R2 returns the full key in `Path`; Bunny returns a zone-relative one. Trust `Path` only
    // when it is inside the prefix we asked for, otherwise build the key ourselves.
    const key =
      file.Path && file.Path.includes(prefix.replace(/\/$/, '')) ? file.Path : `${prefix}${file.ObjectName}`;
    try {
      await cloudStorage.deleteFile(key);
      result.deleted += 1;
    } catch (error) {
      result.failed += 1;
      log.warn('[files] Could not delete a stored object during account deletion', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/** Mascot images written to disk when the bucket was unreachable. */
async function deleteLocalMascots(userId: string, result: FileCleanupResult): Promise<void> {
  const dir = path.join(process.cwd(), 'uploads', 'mascots');
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return; // The folder does not exist on this host.
  }
  for (const name of names.filter((entry) => entry.startsWith(`mascot-${userId}-`))) {
    try {
      await fs.unlink(path.join(dir, name));
      result.deleted += 1;
    } catch (error) {
      result.failed += 1;
      log.warn('[files] Could not delete a local mascot image', {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function deleteUserFiles(userId: string): Promise<FileCleanupResult> {
  const result: FileCleanupResult = { deleted: 0, failed: 0 };

  await deletePrefix(`receipts/${userId}/`, result);
  // Receipts stored before the owner-scoped layout: `receipts/receipt-<userId>-<time>.<ext>`.
  await deletePrefix(`receipts/receipt-${userId}-`, result);
  await deletePrefix(`mascots/${userId}/`, result);
  await deletePrefix(`backups/user-${userId}/`, result);
  await deleteLocalMascots(userId, result);

  log.info('[files] Account files removed', { deleted: result.deleted, failed: result.failed });
  return result;
}
