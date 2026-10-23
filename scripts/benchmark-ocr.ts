/**
 * Live accuracy benchmark for receipt extraction.
 *
 * Runs every recorded fixture back through the REAL provider and reports per-field
 * accuracy. Opt-in, costs money, **never** part of CI (blueprint 02 §8).
 *
 *   npm run benchmark:ocr -- --yes
 *   npm run benchmark:ocr -- --yes --include-synthetic --fail-under 90
 *
 * Without `--fail-under` the process always exits 0: a drop in AI accuracy must open
 * an issue / send a report, not break a pull request.
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseAiFixture, type AiFixture } from '../shared/aiFixture';
import { extractReceiptWithAI } from '../server/receiptExtraction';

interface Expected {
  amountInCents: number | null;
  date: string | null;
  vendor: string | null;
}

interface BenchmarkEntry {
  file: string;
  source: string;
  provider: string;
  model: string;
  error: string | null;
  expected: Expected;
  actual: Expected;
  match: { amount: boolean; date: boolean; vendor: boolean };
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function listJsonFiles(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listJsonFiles(full);
    return entry.endsWith('.json') ? [full] : [];
  });
}

function pct(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run against production.');
    process.exit(1);
  }
  if (args.yes !== true) {
    console.error(
      'Usage: npm run benchmark:ocr -- --yes [--include-synthetic] [--fail-under <percent>]\n' +
        '       --yes is required because this spends real API credit.',
    );
    process.exit(1);
  }

  const includeSynthetic = args['include-synthetic'] === true;
  const recordedDir = path.resolve(process.cwd(), 'tests/ai/recorded');

  const fixtures: Array<{ file: string; fixture: AiFixture<Expected> }> = [];

  for (const file of listJsonFiles(recordedDir)) {
    try {
      const fixture = parseAiFixture<Expected>(JSON.parse(readFileSync(file, 'utf8')), file);
      if (fixture.meta.task !== 'receipt-extraction') continue;
      if (file.includes(`${path.sep}mistral-ocr${path.sep}`)) continue;
      if (!includeSynthetic && fixture.meta.source !== 'captured') continue;
      fixtures.push({ file, fixture });
    } catch (error) {
      console.error(`⚠️  skipping invalid fixture ${file}: ${(error as Error).message}`);
    }
  }

  if (fixtures.length === 0) {
    console.error(
      'No fixtures to benchmark.\n' +
        'Capture some first: npm run capture:ai -- --image <path> --yes\n' +
        'Or benchmark the synthetic contract set: --include-synthetic',
    );
    process.exit(1);
  }

  console.log(`📊 Benchmarking ${fixtures.length} fixture(s) against the live provider…\n`);

  const results: BenchmarkEntry[] = [];
  for (const { file, fixture } of fixtures) {
    const draft = await extractReceiptWithAI(fixture.input);
    const actual: Expected = {
      amountInCents: draft.amountInCents,
      date: draft.date,
      vendor: draft.vendor,
    };

    const match = {
      amount: actual.amountInCents === fixture.expected.amountInCents,
      date: actual.date === fixture.expected.date,
      vendor: actual.vendor === fixture.expected.vendor,
    };

    results.push({
      file: path.relative(process.cwd(), file),
      source: fixture.meta.source,
      provider: draft.provider ?? fixture.meta.provider,
      model: draft.model ?? fixture.meta.model,
      error: draft.error ?? null,
      expected: fixture.expected,
      actual,
      match,
    });

    const mark = (ok: boolean) => (ok ? '✅' : '❌');
    console.log(
      `${path.basename(file)} ${mark(match.amount)}amount ${mark(match.date)}date ${mark(match.vendor)}vendor`,
    );
  }

  const accuracies = {
    amount: pct(results.filter((r) => r.match.amount).length, results.length),
    date: pct(results.filter((r) => r.match.date).length, results.length),
    vendor: pct(results.filter((r) => r.match.vendor).length, results.length),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    promptVersion: 'receipt-extract@1',
    fixtureCount: results.length,
    accuracies,
    results,
  };

  const reportsDir = path.resolve(process.cwd(), 'testing-blueprint/reports');
  mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `ocr-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(
    `\nAccuracy — amount: ${accuracies.amount}%  date: ${accuracies.date}%  vendor: ${accuracies.vendor}%\n` +
      `Report: ${path.relative(process.cwd(), reportPath)}`,
  );

  const threshold = typeof args['fail-under'] === 'string' ? Number(args['fail-under']) : undefined;
  if (threshold !== undefined && Number.isFinite(threshold)) {
    const worst = Math.min(accuracies.amount, accuracies.date, accuracies.vendor);
    if (worst < threshold) {
      console.error(`\n❌ worst accuracy ${worst}% is below --fail-under ${threshold}%`);
      process.exit(1);
    }
    console.log(`\n✅ worst accuracy ${worst}% meets --fail-under ${threshold}%`);
  }
}

main().catch((error) => {
  console.error('\n❌ benchmark failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
