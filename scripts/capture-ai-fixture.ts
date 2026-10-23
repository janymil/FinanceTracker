/**
 * Captures ONE real receipt-extraction reply into `tests/ai/recorded/<provider>/`.
 *
 * COSTS MONEY. Opt-in, never runs in CI, refuses production.
 *
 *   npm run capture:ai -- --image tests/ai/images/lidl-01.jpg --name lidl-01 --yes
 *   npm run capture:ai -- --text "Lidl\nSPOLU 24,89 €" --name manual-01 --yes
 *
 * The written file is validated with `parseAiFixture` before it hits the disk, so a
 * malformed capture fails here instead of in CI.
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseAiFixture } from '../shared/aiFixture';
import { performOCRDetailed } from '../server/ocr';
import { RECEIPT_PROMPT_VERSION, extractReceiptWithAI } from '../server/receiptExtraction';

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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function usageAndExit(message?: string): never {
  if (message) console.error(`\n❌ ${message}\n`);
  console.error(
    [
      'Usage:',
      '  npm run capture:ai -- --image <path> [--name <slug>] --yes',
      '  npm run capture:ai -- --text "<ocr text>" [--name <slug>] --yes',
      '',
      'Options:',
      '  --yes        required acknowledgement that this spends real API credit',
      '  --name       fixture file name (default: derived from the image / timestamp)',
      '  --out        output directory (default: tests/ai/recorded)',
      '',
      'This writes a COMMITTED fixture. Check it for personal data before committing.',
    ].join('\n'),
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (process.env.NODE_ENV === 'production') {
    usageAndExit('Refusing to run against production.');
  }
  if (args.yes !== true) {
    usageAndExit('Pass --yes to confirm the AI call (it costs money).');
  }

  const imagePath = typeof args.image === 'string' ? args.image : undefined;
  const textArg = typeof args.text === 'string' ? args.text : undefined;
  if (!imagePath && !textArg) usageAndExit('Provide --image <path> or --text "<ocr text>".');

  console.log('⚠️  Live capture: this calls Mistral/Google OCR and a paid LLM.');

  const ocr = textArg
    ? { text: textArg, source: 'text' as const }
    : await performOCRDetailed(readFileSync(imagePath as string));

  console.log(`🔍 OCR source: ${ocr.source} (${ocr.text.length} chars)`);

  const draft = await extractReceiptWithAI(ocr.text);
  if (draft.error) usageAndExit(draft.error);

  const name = typeof args.name === 'string' ? slugify(args.name) : slugify(imagePath ?? `capture-${Date.now()}`);
  const dir = path.resolve(process.cwd(), typeof args.out === 'string' ? args.out : 'tests/ai/recorded');

  const fixture = {
    meta: {
      provider: draft.provider ?? 'unknown',
      model: draft.model ?? 'unknown',
      task: 'receipt-extraction',
      promptVersion: RECEIPT_PROMPT_VERSION,
      ocrSource: ocr.source,
      capturedAt: new Date().toISOString(),
      source: 'captured',
    },
    input: ocr.text,
    output: draft.raw,
    expected: {
      amountInCents: draft.amountInCents,
      date: draft.date,
      vendor: draft.vendor,
    },
  };

  // Fail here, not in CI.
  parseAiFixture(fixture, `${name}.json`);

  const providerDir = path.join(dir, fixture.meta.provider);
  mkdirSync(providerDir, { recursive: true });
  const target = path.join(providerDir, `${name}.json`);
  writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

  console.log(`✅ wrote ${path.relative(process.cwd(), target)}`);
  console.log(`   amountInCents: ${fixture.expected.amountInCents}`);
  console.log(`   date: ${fixture.expected.date}`);
  console.log(`   vendor: ${fixture.expected.vendor}`);
  console.log('\n👉 Review the file for personal data, then commit it.');
}

main().catch((error) => {
  console.error('\n❌ capture failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
