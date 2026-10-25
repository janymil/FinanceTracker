#!/usr/bin/env node
/**
 * Kaptia — concurrency probe for the **import and OCR** routes.
 *
 * The question it answers: "how many imports at once before the app starts refusing or crawling?"
 * That matters because OCR falls back to `tesseract.js`, which runs in this Node process — the same
 * process that serves every page — so a burst of imports competes with ordinary traffic for CPU and
 * memory. `ops/kaptia-monitoring/README.md` records a past incident where a runaway process
 * consumed the whole host, which is exactly the failure this probe is meant to find early.
 *
 * **AI routes are deliberately excluded.** Every call bills a provider, and the latency measured
 * would be the provider's, not ours. A cost ceiling is a different test.
 *
 * Usage:
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:4400 \
 *   LOAD_TEST_COOKIE='__session=…' \
 *   npm run load:import
 *
 *   npm run load:import -- --concurrency 1,2,4,8 --requests 8 --preset import-data
 *   npm run load:import -- --preset receipt-ocr --file /tmp/receipt.jpg
 *
 * Options:
 *   --concurrency  comma-separated levels (default 1,2,4)
 *   --requests     requests per level (default 8)
 *   --preset       import-data (default) | receipt-ocr | pdf-statement
 *   --file         image/PDF for the two multipart presets
 *   --allow-remote allow a non-localhost target (see the warning below)
 *
 * Read the result like this:
 *   ok        request succeeded (2xx)
 *   limited   429 — the per-user rate limit answered, which is the guard working, not a fault
 *   error     anything else, including a connection reset: this is the number that matters
 *
 * The suite writes rows to the target database. Point it at a disposable one — never production.
 * A premium test account is required: import answers 403 for other plans, which is not a load
 * result. `receipt-ocr` allows 60 requests per hour per user and `pdf-statement` 10 per 10 minutes,
 * so a 429 count near the cap is expected and is reported separately for that reason.
 *
 * Exit codes: 0 = every level served with under 20% errors; 1 = it did not keep up; 2 = bad usage.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

type Preset = 'import-data' | 'receipt-ocr' | 'pdf-statement';

const PRESETS: Record<Preset, { path: string; needsFile: boolean; note: string }> = {
  'import-data': { path: '/api/import-data', needsFile: false, note: 'JSON import — the cheapest write path' },
  'receipt-ocr': { path: '/api/upload-receipt', needsFile: true, note: 'OCR: Mistral → Vision → tesseract fallback' },
  'pdf-statement': { path: '/api/import/pdf-statement', needsFile: true, note: 'PDF statement parsing + duplicate detection' },
};

interface Options {
  baseUrl: string;
  cookie: string;
  preset: Preset;
  concurrency: number[];
  requests: number;
  file?: string;
  allowRemote: boolean;
}

function parseList(value: string): number[] {
  return value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

function parseArgs(argv: string[]): Options | { error: string } {
  const options: Options = {
    baseUrl: process.env.LOAD_TEST_BASE_URL ?? '',
    cookie: process.env.LOAD_TEST_COOKIE ?? '',
    preset: 'import-data',
    concurrency: [1, 2, 4],
    requests: 8,
    allowRemote: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[(i += 1)];
    if (arg === '--base-url') options.baseUrl = next();
    else if (arg === '--cookie') options.cookie = next();
    else if (arg === '--file') options.file = next();
    else if (arg === '--allow-remote') options.allowRemote = true;
    else if (arg === '--requests') options.requests = Number(next());
    else if (arg === '--concurrency') options.concurrency = parseList(next() ?? '');
    else if (arg === '--preset') options.preset = next() as Preset;
    else return { error: `Unknown argument: ${arg}` };
  }

  if (!options.baseUrl) return { error: 'No target. Set LOAD_TEST_BASE_URL or pass --base-url.' };
  if (!options.cookie) {
    return {
      error:
        'No session. Set LOAD_TEST_COOKIE or pass --cookie — without a login every request is a 401 ' +
        'and the run measures the auth path instead of the import path.',
    };
  }
  if (!(options.preset in PRESETS)) return { error: `Unknown --preset. Use one of: ${Object.keys(PRESETS).join(', ')}` };
  if (PRESETS[options.preset].needsFile && !options.file) return { error: `--preset ${options.preset} needs --file` };
  if (!Number.isFinite(options.requests) || options.requests < 1) return { error: '--requests must be a positive number' };
  if (options.concurrency.length === 0) return { error: '--concurrency needs at least one positive level' };

  return options;
}

/** Localhost only by default: this probe writes rows wherever it is pointed. */
function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}


interface Sample {
  ms: number;
  status: number;
  note?: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function mimeFor(file: string): string {
  if (file.endsWith('.pdf')) return 'application/pdf';
  if (file.endsWith('.png')) return 'image/png';
  if (/\.jpe?g$/.test(file)) return 'image/jpeg';
  return 'application/octet-stream';
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if ('error' in parsed) {
    console.error(`[load] ${parsed.error}`);
    return 2;
  }
  const options = parsed;

  if (!isLocal(options.baseUrl) && !options.allowRemote) {
    console.error(
      `[load] Refusing ${options.baseUrl}: this probe writes rows to the target database.\n` +
        '       Use a disposable database, or pass --allow-remote if you are certain.'
    );
    return 2;
  }

  const preset = PRESETS[options.preset];
  const fileBytes = options.file ? new Uint8Array(await readFile(options.file)) : undefined;
  const fileName = options.file ? basename(options.file) : 'upload';
  const fileMime = options.file ? mimeFor(options.file) : 'application/octet-stream';
  const runTag = `lt-${Date.now().toString(36)}`;

  const url = `${options.baseUrl.replace(/\/+$/, '')}${preset.path}`;

  function buildRequest(index: number): { url: string; init: RequestInit } {
    const headers: Record<string, string> = { cookie: options.cookie, accept: 'application/json' };

    if (options.preset === 'import-data') {
      // One expense per request: enough to exercise validation, encryption and the insert path.
      const content = JSON.stringify({
        expenses: [
          { amount: 10 + index, description: `${runTag}-${index}`, type: 'expense', date: '2026-01-15' },
        ],
      });
      return {
        url,
        init: {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ format: 'json', content }),
        },
      };
    }

    // Multipart must be rebuilt per request: a FormData body cannot be sent twice.
    const form = new FormData();
    form.append(
      options.preset === 'receipt-ocr' ? 'receipt' : 'pdf',
      new Blob([fileBytes ?? new Uint8Array()], { type: fileMime }),
      fileName
    );
    return { url, init: { method: 'POST', headers, body: form } };
  }

  async function one(index: number): Promise<Sample> {
    const request = buildRequest(index);
    const started = performance.now();
    try {
      const response = await fetch(request.url, request.init);
      // Draining the body is part of the cost; without it the timing is optimistic.
      const text = await response.text();
      const ms = performance.now() - started;
      const note = response.ok ? undefined : text.replace(/\s+/g, ' ').slice(0, 160);
      return { ms, status: response.status, note };
    } catch (error) {
      return { ms: performance.now() - started, status: 0, note: (error as Error).message };
    }
  }
  async function runLevel(level: number): Promise<{ samples: Sample[]; errorRatio: number }> {
    const samples: Sample[] = [];
    let issued = 0;

    async function worker(): Promise<void> {
      for (;;) {
        const index = issued;
        issued += 1;
        if (index >= options.requests) return;
        samples.push(await one(index));
      }
    }

    await Promise.all(Array.from({ length: Math.min(level, options.requests) }, worker));

    const failures = samples.filter(
      (sample) => sample.status === 0 || (sample.status >= 300 && sample.status !== 429)
    );
    return { samples, errorRatio: samples.length === 0 ? 0 : failures.length / samples.length };
  }



  console.log(`[load] ${preset.path} — ${preset.note}`);
  console.log(`[load] ${options.requests} request(s) per level, levels ${options.concurrency.join(', ')}`);
  console.log('[load] concurrency  ok  limited  error     p50     p95     max');
  console.log('[load] ' + '-'.repeat(62));

  let worstErrorRatio = 0;
  let firstFailureNotes: string[] = [];

  for (const level of options.concurrency) {
    const { samples, errorRatio } = await runLevel(level);
    worstErrorRatio = Math.max(worstErrorRatio, errorRatio);

    const ok = samples.filter((sample) => sample.status >= 200 && sample.status < 300).length;
    const limited = samples.filter((sample) => sample.status === 429).length;
    const failed = samples.length - ok - limited;
    const times = samples.map((sample) => sample.ms).sort((a, b) => a - b);

    if (firstFailureNotes.length === 0) {
      firstFailureNotes = samples
        .filter((sample) => sample.note && sample.status !== 429)
        .map((sample) => `${sample.status} ${sample.note}`)
        .slice(0, 3);
    }

    console.log(
      `[load] ${String(level).padStart(11)}  ${String(ok).padStart(2)}  ${String(limited).padStart(7)}  ` +
        `${String(failed).padStart(5)}  ${`${Math.round(percentile(times, 50))}ms`.padStart(6)}  ` +
        `${`${Math.round(percentile(times, 95))}ms`.padStart(6)}  ` +
        `${`${Math.round(times[times.length - 1] ?? 0)}ms`.padStart(6)}`
    );

    if (errorRatio > 0.5) {
      console.log('[load] stopping the ramp: more than half of the requests failed at this level.');
      break;
    }
  }

  if (firstFailureNotes.length > 0) {
    console.log('[load] first failures:');
    for (const note of firstFailureNotes) console.log(`  - ${note}`);
  }

  if (worstErrorRatio > 0.2) {
    console.error(`[load] FAIL — ${Math.round(worstErrorRatio * 100)}% of requests failed at some level.`);
    return 1;
  }

  console.log('[load] PASS — every level served (429 counts as the rate limit working, not a fault).');
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('[load] unexpected failure:', error);
    process.exit(1);
  });
