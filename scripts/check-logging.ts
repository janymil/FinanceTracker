/**
 * Fails when server code logs through `console.*` directly.
 *
 * Server logs go through `server/logger.ts` so that levels, production behaviour and the
 * "metadata only, never personal data" rule live in one file. This check is part of
 * `npm run check`, which `scripts/deploy.sh` runs before anything is built or reloaded.
 *
 *   npm run check:logging
 *
 * Exit code 0 = no direct console calls; 1 = the offending file and line are printed.
 */
import fs from 'node:fs';
import path from 'node:path';

const SERVER_DIR = path.resolve(process.cwd(), 'server');
const LOGGER_FILE = path.join(SERVER_DIR, 'logger.ts');
const FORBIDDEN = /console\.(log|info|debug)\s*\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const offenders: string[] = [];

for (const file of walk(SERVER_DIR)) {
  if (file === LOGGER_FILE) continue;

  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let inBlockComment = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      return;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (FORBIDDEN.test(line)) {
      offenders.push(`${path.relative(process.cwd(), file)}:${index + 1}: ${trimmed}`);
    }
  });
}

if (offenders.length > 0) {
  console.error('Direct console.* calls in server code — use log.debug/info/warn/error from server/logger.ts:');
  for (const line of offenders) console.error(`  ${line}`);
  process.exit(1);
}

console.log('[check:logging] server logs go through server/logger.ts');
