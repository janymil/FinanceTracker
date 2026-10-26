#!/usr/bin/env node
/**
 * The history endpoint must not be read without a window.
 *
 * `/api/transactions` used to return the whole account: every row decrypted, several times per
 * page load. It now accepts `limit`/`offset`/`from`/`to`, and this gate is what keeps the old shape
 * from creeping back. It plays the part the browser suite would play for this specific change:
 * without it, a new screen that fetches everything is invisible until somebody notices the app is
 * slow, and the count of such screens only ever grows.
 *
 * The remaining offenders are listed in `transaction-query-budget.json` and the list may only
 * shrink. Adding a screen that downloads the whole history fails this check, and the fix is one of:
 *   - pass `?limit=…` (and `from`/`to` when the screen only shows a period);
 *   - or, if the screen genuinely needs everything (an export), add it to the budget in the same
 *     change, with a line saying why.
 *
 *   npm run check:transaction-queries
 *
 * Exit codes: 0 = at or below budget, 1 = a new unbounded read (or the budget file is missing).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLIENT_SRC = path.join(ROOT, 'client', 'src');
const BUDGET_FILE = path.join(ROOT, 'scripts', 'transaction-query-budget.json');
const ENDPOINT = '/api/transactions';

interface Offender {
  file: string;
  line: number;
  text: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** A window around the match, because a call is often written across two or three lines. */
function context(lines: string[], index: number): string {
  const from = Math.max(0, index - 2);
  const to = Math.min(lines.length - 1, index + 2);
  return lines.slice(from, to + 1).join(' ').replace(/\s+/g, ' ');
}

export function findOffenders(): Offender[] {
  const offenders: Offender[] = [];

  for (const file of walk(CLIENT_SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes(ENDPOINT)) continue;
    const lines = source.split('\n');

    lines.forEach((line, index) => {
      if (!line.includes(ENDPOINT)) return;
      // A comment about the endpoint is not a call to it.
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      const around = context(lines, index);

      // Writes are not reads; they are not the problem this gate is about.
      if (/\b(POST|PUT|PATCH|DELETE)\b/.test(around)) return;
      // Cache bookkeeping names a key, it does not fetch anything.
      if (/(invalidateQueries|refetchQueries|removeQueries|setQueryData|cancelQueries)/.test(around)) return;
      // A bounded read says so: either how many rows it wants, or the period it shows. A screen
      // that asks for "October" is not downloading the account's lifetime, and unlike a page size
      // a date window cannot truncate — every row in the period comes back.
      if (/limit=/.test(around) || /[?&]from=/.test(around)) return;

      offenders.push({
        file: path.relative(ROOT, file),
        line: index + 1,
        text: line.trim().slice(0, 120),
      });
    });
  }

  return offenders;
}

interface Budget {
  /** Why each entry is allowed to keep reading everything. */
  allowed: Record<string, string>;
}

function main(): number {
  const offenders = findOffenders();

  if (!fs.existsSync(BUDGET_FILE)) {
    console.error(`[check:transaction-queries] missing budget file: ${path.relative(ROOT, BUDGET_FILE)}`);
    return 1;
  }
  const budget: Budget = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
  const allowed = new Set(Object.keys(budget.allowed));

  const files = Array.from(new Set(offenders.map((offender) => offender.file))).sort();
  const unexpected = files.filter((file) => !allowed.has(file));

  if (unexpected.length > 0) {
    console.error(
      '[check:transaction-queries] these files read the history endpoint without a window:\n' +
        unexpected
          .map((file) => {
            const where = offenders.filter((offender) => offender.file === file);
            return `  ${file}:${where.map((w) => w.line).join(',')}  ${where[0].text}`;
          })
          .join('\n') +
        '\n\n  Add ?limit=… (and ?from=/&to= when the screen shows a period), or add the file to\n' +
        '  scripts/transaction-query-budget.json with a line saying why it needs everything.',
    );
    return 1;
  }

  const stale = Array.from(allowed).filter((file) => !files.includes(file)).sort();
  for (const file of stale) {
    console.warn(`[check:transaction-queries] budget entry no longer needed, please remove: ${file}`);
  }

  console.log(
    `[check:transaction-queries] ${files.length}/${allowed.size} file(s) still read the full history ` +
      `(${offenders.length} call(s)); budget met`,
  );
  return 0;
}

if (process.argv[1] && /check-transaction-queries/.test(process.argv[1])) {
  process.exit(main());
}
