import { describe, expect, it } from 'vitest';
import { AiFixtureError, parseAiFixture } from '../../shared/aiFixture';

const valid = {
  meta: {
    provider: 'openai',
    model: 'gpt-6-luna',
    task: 'receipt-extraction',
    promptVersion: 'receipt-extract@1',
    ocrSource: 'mistral',
    capturedAt: '2026-10-22T09:00:00Z',
    source: 'captured',
  },
  input: 'SPOLU 24,89 €',
  output: { amount: '24,89' },
  expected: { amountInCents: 2489 },
};

const withMeta = (patch: Record<string, unknown>) =>
  ({ ...valid, meta: { ...valid.meta, ...patch } }) as unknown;

describe('parseAiFixture', () => {
  it('accepts a complete fixture', () => {
    const fixture = parseAiFixture(valid, 'valid.json');
    expect(fixture.meta.provider).toBe('openai');
    expect(fixture.meta.source).toBe('captured');
    expect(fixture.expected).toEqual({ amountInCents: 2489 });
  });

  it('rejects a non-object fixture', () => {
    for (const bad of [null, 'x', 42, []]) {
      expect(() => parseAiFixture(bad)).toThrow(AiFixtureError);
    }
  });

  it('requires every identity field', () => {
    for (const field of ['provider', 'model', 'task', 'promptVersion', 'capturedAt', 'source']) {
      expect(() => parseAiFixture(withMeta({ [field]: undefined }), 'x.json')).toThrow(
        new RegExp(`meta\\.${field}`),
      );
      expect(() => parseAiFixture(withMeta({ [field]: '   ' }), 'x.json')).toThrow(
        new RegExp(`meta\\.${field}`),
      );
    }
  });

  it('rejects unknown task and source values', () => {
    expect(() => parseAiFixture(withMeta({ task: 'summarize' }))).toThrow(/meta\.task/);
    expect(() => parseAiFixture(withMeta({ source: 'guessed' }))).toThrow(/meta\.source/);
  });

  it('requires an ISO timestamp', () => {
    expect(() => parseAiFixture(withMeta({ capturedAt: 'yesterday' }))).toThrow(/capturedAt/);
  });

  it('requires ocrSource only for captured fixtures', () => {
    expect(() => parseAiFixture(withMeta({ ocrSource: undefined }))).toThrow(/ocrSource/);

    const synthetic = parseAiFixture(withMeta({ source: 'synthetic', ocrSource: undefined }));
    expect(synthetic.meta.source).toBe('synthetic');
  });

  it('rejects an unknown ocrSource', () => {
    expect(() => parseAiFixture(withMeta({ ocrSource: 'tesseract' }))).toThrow(/ocrSource/);
  });

  it('requires input, output and expected', () => {
    expect(() => parseAiFixture({ ...valid, input: 123 })).toThrow(/input/);
    expect(() => parseAiFixture({ ...valid, output: undefined })).toThrow(/output/);
    expect(() => parseAiFixture({ ...valid, expected: null })).toThrow(/expected/);
  });

  it('allows a string output (the model answered with prose)', () => {
    const fixture = parseAiFixture({ ...valid, output: 'I cannot read this' });
    expect(fixture.output).toBe('I cannot read this');
  });

  it('names the origin file in the error message', () => {
    expect(() => parseAiFixture({}, 'receipt-99.json')).toThrow(/receipt-99\.json/);
  });
});
