import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAiFixture } from '../../shared/aiFixture';

/**
 * Module 2 of step 3: replay recorded provider replies through the IMPURE path
 * (`extractReceiptWithAI`) with the OpenAI client mocked.
 *
 * Nothing here touches the network: the "model" is a fixture on disk.
 */

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock('../../server/openaiClient', () => ({
  openai: { chat: { completions: { create: createMock } } },
}));

import { extractReceiptWithAI, extractStructuredData } from '../../server/receiptExtraction';

interface ReceiptExpected {
  amountInCents: number | null;
  date: string | null;
  vendor: string | null;
}

const fixtureDir = fileURLToPath(new URL('./recorded/openai', import.meta.url));

const cases = readdirSync(fixtureDir)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => ({
    file,
    fixture: parseAiFixture<ReceiptExpected>(
      JSON.parse(readFileSync(path.join(fixtureDir, file), 'utf8')),
      file,
    ),
  }));

/** A recorded reply is committed as JSON; a string output means "the model returned prose". */
const asContent = (output: unknown): string =>
  typeof output === 'string' ? output : JSON.stringify(output);

beforeEach(() => {
  createMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recorded fixture set', () => {
  it('contains at least 8 receipt fixtures, all valid', () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
  });

  it('every fixture is a receipt-extraction case with expectations', () => {
    for (const { file, fixture } of cases) {
      expect(fixture.meta.task, file).toBe('receipt-extraction');
      expect(fixture.input.length, file).toBeGreaterThan(0);
      expect(Object.keys(fixture.expected), file).toContain('amountInCents');
    }
  });

  it('marks synthetic fixtures as synthetic (no fake provenance)', () => {
    const sources = new Set(cases.map(({ fixture }) => fixture.meta.source));
    expect(Array.from(sources).every((source) => source === 'synthetic' || source === 'captured')).toBe(true);
    // Until a real capture run happens, everything must say "synthetic".
    expect(cases.some(({ fixture }) => fixture.meta.source === 'synthetic')).toBe(true);
  });
});

describe('extractReceiptWithAI plumbing (no network)', () => {
  it('asks for JSON at temperature 0.1 with the parsing model', async () => {
    createMock.mockResolvedValueOnce({ choices: [{ message: { content: '{"amount":5}' } }] });

    await extractReceiptWithAI('SPOLU 5,00 €');

    const request = createMock.mock.calls[0][0];
    expect(request.temperature).toBe(0.1);
    expect(request.response_format).toEqual({ type: 'json_object' });
    expect(request.model).toBe('gpt-6-luna');
    expect(request.messages[0].role).toBe('system');
    expect(request.messages[0].content).toContain('extract');
    expect(request.messages[1]).toEqual({ role: 'user', content: 'SPOLU 5,00 €' });
  });

  it('strips ```json fences before parsing', async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        { message: { content: '```json\n{"amount":"5,00","date":"2026-03-01","vendor":"X"}\n```' } },
      ],
    });

    const draft = await extractReceiptWithAI('text');
    expect(draft.amountInCents).toBe(500);
    expect(draft.date).toBe('2026-03-01');
  });

  it('returns an empty draft when the provider omits choices', async () => {
    createMock.mockResolvedValueOnce({ choices: [] });

    const draft = await extractReceiptWithAI('text');
    expect(draft.amountInCents).toBeNull();
    expect(draft.error).toBeUndefined();
  });

  it('returns an error draft when the provider throws', async () => {
    createMock.mockRejectedValueOnce(new Error('provider down'));

    const draft = await extractReceiptWithAI('text');
    expect(draft.error).toBe('Failed to extract structured data');
    expect(draft.amountInCents).toBeNull();
    expect(draft.model).toBe('gpt-6-luna');
  });
});

describe('extractStructuredData (legacy wire shape)', () => {
  afterEach(() => {
    delete process.env.RECEIPT_REGEX_FALLBACK;
  });

  it('returns numbers, not cents, for backwards compatibility', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: '{"amount":"24,89","date":"12.03.2026","vendor":"Lidl"}' } }],
    });

    await expect(extractStructuredData('text')).resolves.toEqual({
      amount: 24.89,
      date: '2026-03-12',
      vendor: 'Lidl',
    });
  });

  it('propagates the error instead of throwing', async () => {
    createMock.mockRejectedValueOnce(new Error('boom'));
    await expect(extractStructuredData('text')).resolves.toEqual({
      error: 'Failed to extract structured data',
    });
  });

  it('uses the regex fallback only when the flag is on', async () => {
    const ocrText = 'Lidl Slovakia\nDatum: 12.03.2026\nSPOLU 24,89 €';
    createMock.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

    await expect(extractStructuredData(ocrText)).resolves.toEqual({});

    process.env.RECEIPT_REGEX_FALLBACK = '1';
    await expect(extractStructuredData(ocrText)).resolves.toEqual({
      amount: 24.89,
      date: '2026-03-12',
      vendor: 'Lidl Slovakia',
    });
  });
});

describe('extractReceiptWithAI replays recorded replies', () => {
  for (const { file, fixture } of cases) {
    it(`replays ${file}`, async () => {
      createMock.mockResolvedValueOnce({
        choices: [{ message: { content: asContent(fixture.output) } }],
      });

      const draft = await extractReceiptWithAI(fixture.input);

      expect({
        amountInCents: draft.amountInCents,
        date: draft.date,
        vendor: draft.vendor,
      }).toEqual(fixture.expected);

      expect(draft.error).toBeUndefined();
      expect(draft.model).toBe(fixture.meta.model);
      expect(draft.provider).toBe('openai');
      expect(draft.raw).toEqual(fixture.output);
    });
  }
});
