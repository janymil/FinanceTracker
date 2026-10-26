/**
 * Fails when code logs through `console.*` instead of the project's logger.
 *
 * Server code goes through `server/logger.ts` so that levels, production behaviour and the
 * "metadata only, never personal data" rule live in one file. This check is part of
 * `npm run check`, which `scripts/deploy.sh` runs before anything is built or reloaded.
 *
 * Two rules, deliberately different:
 *
 *   server/    zero. `server/logger.ts` is the only exemption: it is the sink and prints
 *              through `console.*` on purpose (pm2 already timestamps and rotates its output).
 *
 *   client/src a budget that may only shrink (`scripts/logging-budget.json`). The browser has
 *              no logger, ~200 calls and no gate at all, so a wave of cleanup would be a large
 *              blind edit across the money screens. Freezing the number stops it growing today;
 *              `--update` lowers it as calls are removed, and it cannot be raised without
 *              `--raise`, which prints a warning.
 *
 * The previous version matched `console.error(` — a call, not a reference — so
 * `.catch(console.error)` and `const out = console.log` were invisible to it. On 2026-10-26 one
 * live reference was sitting in server code while this check reported success. The scanner below
 * strips comments and string literals before looking, which is what makes matching the bare
 * reference safe.
 *
 * Exit code 0 = clean (or within budget); 1 = something to fix.
 *
 *   npm run check:logging
 *   npm run check:logging -- --update     # lower the client budget to today's count
 *   npm run check:logging -- --raise      # stop here: say why in the commit message
 *   npm run check:logging -- --verbose    # list every client file and its count
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIR = path.join(ROOT, 'client', 'src');
const LOGGER_FILE = path.join(SERVER_DIR, 'logger.ts');
const BUDGET_FILE = path.join(ROOT, 'scripts', 'logging-budget.json');

const CONSOLE_REFERENCE = /\bconsole\s*\.\s*([A-Za-z]+)/g;

const args = new Set(process.argv.slice(2));
const UPDATE = args.has('--update');
const RAISE = args.has('--raise');
const VERBOSE = args.has('--verbose');

/**
 * Removes comments and the *contents* of string literals, keeping the code around them and the
 * line breaks, so `'console.error'` inside a message and a commented-out call are not reported
 * while `console.error` passed as a callback is.
 */
function stripCommentsAndStrings(source: string): string {
  let out = '';
  let i = 0;
  let blockComment = false;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        out += '  ';
        i += 2;
      } else {
        out += char === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      out += '  ';
      i += 2;
      continue;
    }

    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      out += quote; // keep the delimiter so line and column stay readable
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') {
          out += '  ';
          i += 2;
          continue;
        }
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += quote;
      i += 1;
      continue;
    }

    out += char;
    i += 1;
  }

  return out;
}

interface Hit {
  file: string;
  line: number;
  method: string;
  text: string;
}

function scanFile(file: string): Hit[] {
  const raw = fs.readFileSync(file, 'utf8');
  const cleanLines = stripCommentsAndStrings(raw).split('\n');
  const rawLines = raw.split('\n');
  const hits: Hit[] = [];

  cleanLines.forEach((line, index) => {
    CONSOLE_REFERENCE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CONSOLE_REFERENCE.exec(line)) !== null) {
      hits.push({
        file: path.relative(ROOT, file),
        line: index + 1,
        method: match[1],
        text: rawLines[index]?.trim() ?? '',
      });
    }
  });

  return hits;
}

function walk(dir: string, extensions: string[], out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, extensions, out);
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}


/** ---- server: nothing is allowed outside the logger sink ---- */
const serverFiles = walk(SERVER_DIR, ['.ts'], []).filter((file) => file !== LOGGER_FILE);
const serverHits = serverFiles.flatMap(scanFile);

if (serverHits.length > 0) {
  console.error(
    'Direct console.* use in server code — use log.debug/info/warn/error from server/logger.ts:',
  );
  for (const hit of serverHits) console.error(`  ${hit.file}:${hit.line}: ${hit.text}`);
  console.error(`\n${serverHits.length} occurrence(s). The logger is what scrubs personal data.`);
  process.exit(1);
}

/** ---- client: a budget that may only shrink ---- */
interface Budget {
  $comment?: string;
  client: {
    budget: number;
    measured?: string;
    note?: string;
    files?: Record<string, number>;
  };
}

const clientFiles = walk(CLIENT_DIR, ['.ts', '.tsx'], []);
const clientHits = clientFiles.flatMap(scanFile);
const perFile = new Map<string, number>();
for (const hit of clientHits) perFile.set(hit.file, (perFile.get(hit.file) ?? 0) + 1);
const sortedFiles = [...perFile.entries()].sort((a, b) => b[1] - a[1]);

let budget: Budget = { client: { budget: 0 } };
if (fs.existsSync(BUDGET_FILE)) {
  try {
    budget = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8')) as Budget;
  } catch (error) {
    console.error(`[check:logging] ${path.relative(ROOT, BUDGET_FILE)} is not valid JSON:`, error);
    process.exit(1);
  }
} else if (!UPDATE) {
  console.error(
    `[check:logging] ${path.relative(ROOT, BUDGET_FILE)} is missing. ` +
      'Recreate it with `npm run check:logging -- --update`.',
  );
  process.exit(1);
}

const allowed = budget.client.budget;
const today = new Date().toISOString().slice(0, 10);

function writeBudget(nextBudget: number) {
  const next: Budget = {
    $comment:
      'Ceiling for console.* references in client/src, enforced by scripts/check-logging.ts. ' +
      'It may only go down: remove calls, then run `npm run check:logging -- --update`.',
    client: {
      budget: nextBudget,
      measured: today,
      note: 'The browser has no logger yet; this freezes the count until it does.',
      files: Object.fromEntries(sortedFiles),
    },
  };
  fs.writeFileSync(BUDGET_FILE, `${JSON.stringify(next, null, 2)}\n`);
}

if (UPDATE) {
  if (clientHits.length > allowed && !RAISE) {
    console.error(
      `[check:logging] Refusing to raise the client budget from ${allowed} to ` +
        `${clientHits.length}. Remove ${clientHits.length - allowed} call(s) first, or pass ` +
        '`--raise` and explain it in the commit message.',
    );
    for (const [file, count] of sortedFiles.slice(0, 10)) console.error(`  ${count}\t${file}`);
    process.exit(1);
  }
  writeBudget(clientHits.length);
  console.log(
    `[check:logging] client budget set to ${clientHits.length} ` +
      `(was ${allowed}) in ${path.relative(ROOT, BUDGET_FILE)}`,
  );
  process.exit(0);
}

if (VERBOSE) {
  for (const [file, count] of sortedFiles) console.log(`  ${count}\t${file}`);
}

if (clientHits.length > allowed) {
  console.error(
    `Console.* references in client/src: ${clientHits.length}, budget ${allowed}. ` +
      `Over by ${clientHits.length - allowed}.`,
  );
  for (const [file, count] of sortedFiles.slice(0, 10)) console.error(`  ${count}\t${file}`);
  console.error(
    '\nRemove the new call(s), or route them through one place. The budget never goes up.',
  );
  process.exit(1);
}

if (clientHits.length < allowed) {
  console.log(
    `[check:logging] client console budget ${allowed}, actual ${clientHits.length}. ` +
      'Lower it with `npm run check:logging -- --update`.',
  );
}

console.log(
  `[check:logging] server: 0 direct console calls; client: ${clientHits.length}/${allowed} budget`,
);
