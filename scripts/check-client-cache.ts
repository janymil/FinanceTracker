#!/usr/bin/env node
/**
 * No screen may opt out of the shared cache without saying so.
 *
 * Twenty queries in this app set `staleTime: 0` to be "always fresh". Each one refetched on every
 * mount of its component, and the sidebar and header mount on every screen — the production access
 * log showed `/api/auth/user` five times and `/api/transactions` four times inside twenty seconds
 * for a single person. The shared default is a cache; a query that wants to ignore it has to be
 * listed here with a reason, and the list may only shrink.
 *
 *   npm run check:client-cache
 *
 * Exit codes: 0 = no unlisted opt-out, 1 = one was added.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLIENT_SRC = path.join(ROOT, 'client', 'src');

/**
 * Queries that genuinely must not be cached. Empty today: every screen either shows something a
 * mutation invalidates, or is cheap enough that a minute of staleness is invisible.
 *
 * Add a file here only with a reason that would survive review: "it felt stale" is not one.
 */
const ALLOWED = new Set<string>([]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function main(): number {
  const offenders: Array<{ file: string; line: number; text: string }> = [];

  for (const file of walk(CLIENT_SRC)) {
    const relative = path.relative(ROOT, file);
    if (ALLOWED.has(relative)) continue;

    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      // A comment explaining the old value is not an opt-out.
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (!/(staleTime|gcTime):\s*0\s*,?/.test(line)) return;
      offenders.push({ file: relative, line: index + 1, text: trimmed.slice(0, 120) });
    });
  }

  if (offenders.length > 0) {
    console.error(
      '[check:client-cache] these queries opt out of the shared cache, which refetches on every ' +
        'mount:\n' +
        offenders.map((o) => `  ${o.file}:${o.line}  ${o.text}`).join('\n') +
        '\n\n  Use a real staleTime (30s for a list a mutation invalidates, a few minutes for ' +
        'reference data), or add the file to ALLOWED in this script with a reason.',
    );
    return 1;
  }

  console.log('[check:client-cache] no query opts out of the shared cache');
  return 0;
}

if (process.argv[1] && /check-client-cache/.test(process.argv[1])) {
  process.exit(main());
}
