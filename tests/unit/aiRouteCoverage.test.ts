import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Nothing that spends AI money may be reachable without the gate.
 *
 * `aiGuard()` / `checkAiAccess()` is what turns away the free plan and the account's AI
 * off-switch, and what counts a person's allowance. A route that calls an AI function without
 * it is the bug that let a Premium user with AI switched off still have transactions sent out.
 * This test reads the source, so a new route that forgets the gate fails the build.
 */
const ROOT = path.resolve(__dirname, '..', '..');

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTs(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const rel = (file: string) => path.relative(ROOT, file).replace(/\\/g, '/');

/** Every exported AI function of server/openai.ts, plus the entry points that wrap them. */
function aiFunctionNames(): string[] {
  const source = fs.readFileSync(path.join(ROOT, 'server/openai.ts'), 'utf8');
  const exported = Array.from(source.matchAll(/export async function (\w+)\(/g)).map((m) => m[1]);
  return [...exported, 'runAI', 'parseTransactionWithMistral', 'matchCategoryIntelligentlyMistral'];
}

const callsAI = (text: string, names: string[]) =>
  names.some((name) => new RegExp(`(?<![\\w.])${name}\\(`).test(text));

const GATE = /\b(aiGuard|checkAiAccess)\(/;

/**
 * Files allowed to call AI without a gate of their own, and why. Each one is either the AI
 * implementation itself, is gated at its call site (shown in the same file list below), or
 * is not user data.
 */
const IMPLEMENTATION = new Set([
  'server/openai.ts',            // the functions themselves
  'server/aiAccess.ts',          // the gate
  'server/autoCategorize.ts',    // calls checkAiAccess itself (tested separately)
  'server/mistralTransactionParser.ts', // implementation, called only from the gated voice routes
  'server/groqClient.ts',        // implementation (speech-to-text + shared voice prompt), same mount
  'server/errorGuard/triage.ts', // admin error reports: metadata only, no user data, own budget
  'server/errorGuard/triagePrompt.ts',
]);

/** Routers with no gate in the file itself, because they are mounted behind it (checked below). */
const MOUNTED_BEHIND_GATE: Record<string, string> = {
  'server/routes/mistralVoiceRoutes.ts': 'mistralVoiceRoutes',
};

describe('every AI call site is behind the gate', () => {
  const names = aiFunctionNames();
  const files = [...listTs(path.join(ROOT, 'server')), ...listTs(path.join(ROOT, 'lib'))];

  it('finds the AI functions it is supposed to guard', () => {
    expect(names).toEqual(expect.arrayContaining([
      'categorizeExpense', 'generateAIFinancialHealthScore', 'generateSpendingInsights',
      'generateTrendPredictions', 'runAI',
    ]));
  });

  const callers = files
    .map((file) => ({ file: rel(file), text: fs.readFileSync(file, 'utf8') }))
    .filter(({ file, text }) => !IMPLEMENTATION.has(file) && !MOUNTED_BEHIND_GATE[file] && !file.startsWith('lib/') && callsAI(text, names));

  it('has callers to check (the scan itself works)', () => {
    expect(callers.map((c) => c.file)).toEqual(expect.arrayContaining(['server/routes/aiRoutes.ts']));
  });

  it.each(callers.map((c) => c.file))('%s uses the gate', (file) => {
    const text = callers.find((c) => c.file === file)!.text;
    expect(GATE.test(text), `${file} calls AI without aiGuard()/checkAiAccess()`).toBe(true);
  });

  it('gates each route of aiRoutes.ts individually, not just the file', () => {
    const text = fs.readFileSync(path.join(ROOT, 'server/routes/aiRoutes.ts'), 'utf8');
    const registrations = Array.from(text.matchAll(/app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g));
    const unguarded: string[] = [];

    registrations.forEach((match, index) => {
      const start = match.index ?? 0;
      const end = registrations[index + 1]?.index ?? text.length;
      const chunk = text.slice(start, end);
      const route = `${match[1].toUpperCase()} ${match[2]}`;
      if (callsAI(chunk, names) && !GATE.test(chunk)) unguarded.push(route);
    });

    expect(unguarded).toEqual([]);
  });

  it.each(Object.entries(MOUNTED_BEHIND_GATE))('%s is mounted behind aiGuard()', (_file, routerName) => {
    const text = fs.readFileSync(path.join(ROOT, 'server/routes/index.ts'), 'utf8');
    // every `app.use( ... );` call, so the check does not depend on how it is formatted
    const mounts = Array.from(text.matchAll(/app\.use\(([\s\S]*?)\n?\s*\);/g)).map((m) => m[1]);
    const mount = mounts.find((args) => new RegExp(`\\b${routerName}\\s*$`).test(args.trim()));
    expect(mount, `${routerName} is not mounted in routes/index.ts`).toBeDefined();
    expect(mount).toContain('aiGuard()');
  });

  it('keeps the background auto-categorisation behind the same access check', () => {
    const text = fs.readFileSync(path.join(ROOT, 'server/autoCategorize.ts'), 'utf8');
    expect(text).toMatch(/checkAiAccess/);
  });

  it('no longer has a background job that spends AI money', () => {
    const text = fs.readFileSync(path.join(ROOT, 'server/batch-processor.ts'), 'utf8');
    expect(text).not.toMatch(/runAI\(/);
    expect(text).not.toMatch(/setInterval/);
  });

  it('no file calls a model provider on its own for chat (everything goes through lib/aiProvider)', () => {
    const offenders = files
      .filter((file) => !rel(file).startsWith('lib/aiProvider.ts'))
      .map((file) => ({ file: rel(file), text: fs.readFileSync(file, 'utf8') }))
      .filter(({ text }) => /chat\/completions/.test(text) && !/ocr/i.test(text))
      .map((entry) => entry.file);
    // server/mistralClient.ts keeps its own chat method for the legacy surface; it is no longer
    // used by any prompt (see the next test), so it may exist but must not be imported for chat.
    expect(offenders.filter((file) => file !== 'server/mistralClient.ts')).toEqual([]);
  });

  it('no prompt module still imports the direct Mistral chat client', () => {
    const importers = files
      .map((file) => ({ file: rel(file), text: fs.readFileSync(file, 'utf8') }))
      .filter(({ text }) => /createChatCompletion\(/.test(text) && /from ['"].*mistralClient/.test(text))
      .map((entry) => entry.file);
    expect(importers).toEqual([]);
  });
});
