import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseVoiceInput, toLocalYmd } from '../../shared/voiceParser';

/**
 * Module 4 of step 4: the deterministic voice parser.
 * No audio, no STT, no LLM — the same fixtures drive SK/EN/ES.
 */

interface Phrase {
  text: string;
  expected: {
    amountInCents: number | null;
    type: 'income' | 'expense';
    date: '' | 'today' | 'yesterday' | string;
    needsReview: boolean;
  };
}

interface PhraseFile {
  language: string;
  now: string;
  phrases: Phrase[];
}

const fixtureDir = fileURLToPath(new URL('../fixtures', import.meta.url));

const loadFixture = (file: string): PhraseFile =>
  JSON.parse(readFileSync(path.join(fixtureDir, file), 'utf8'));

const files = ['voice-phrases.sk.json', 'voice-phrases.en.json', 'voice-phrases.es.json'].map((file) => ({
  file,
  data: loadFixture(file),
}));

/** Resolves "today" / "yesterday" against the fixture's frozen now. */
function resolveDate(token: string, now: Date): string {
  if (token === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return toLocalYmd(yesterday);
  }
  if (token === 'today') return toLocalYmd(now);
  return token;
}

describe('voice phrase matrix', () => {
  it('covers all three supported languages', () => {
    expect(files.map(({ data }) => data.language).sort()).toEqual(['en-us', 'es-pe', 'sk']);
  });

  it('has a meaningful number of phrases', () => {
    const total = files.reduce((sum, { data }) => sum + data.phrases.length, 0);
    expect(total).toBeGreaterThanOrEqual(100);
  });

  for (const { file, data } of files) {
    describe(file, () => {
      const now = new Date(data.now);

      for (const phrase of data.phrases) {
        it(`parses "${phrase.text}"`, () => {
          const result = parseVoiceInput(phrase.text, data.language, now);

          expect(result.amountInCents).toBe(phrase.expected.amountInCents);
          expect(result.type).toBe(phrase.expected.type);
          expect(result.date).toBe(resolveDate(phrase.expected.date, now));
          expect(result.needsReview).toBe(phrase.expected.needsReview);
        });
      }
    });
  }
});

describe('income/expense classification — regression', () => {
  const now = new Date(2026, 2, 15, 10, 0, 0);

  it('does not treat "zaplatil" (paid) as income', () => {
    // Old code: text.includes('plat') -> "zaplatil" contains "plat" -> income. Wrong.
    expect(parseVoiceInput('Zaplatil som 15.75 za pizzu', 'sk', now).type).toBe('expense');
    expect(parseVoiceInput('Zaplatil som 15.75 za pizzu', 'sk', now).amountInCents).toBe(1575);
  });

  it('still recognises salary in Slovak, English and Spanish', () => {
    expect(parseVoiceInput('Dostal som výplatu 2450 eur', 'sk', now).type).toBe('income');
    expect(parseVoiceInput('Mzda 1200', 'sk', now).type).toBe('income');
    expect(parseVoiceInput('Plat 950,50', 'sk', now).type).toBe('income');
    expect(parseVoiceInput('Received salary 2450', 'en-us', now).type).toBe('income');
    expect(parseVoiceInput('Recibí mi salario 2450', 'es-pe', now).type).toBe('income');
  });

  it('defaults to expense when nothing indicates income', () => {
    expect(parseVoiceInput('Káva 2,50', 'sk', now).type).toBe('expense');
  });
});

describe('relative dates use the local calendar', () => {
  it('resolves "today" to the local day even just after midnight', () => {
    // toISOString() would return the previous day in any timezone ahead of UTC.
    const justAfterMidnight = new Date(2026, 2, 15, 0, 30, 0);
    expect(parseVoiceInput('káva dnes 2,50', 'sk', justAfterMidnight).date).toBe('2026-03-15');
  });

  it('resolves "today" late at night to the same day', () => {
    const lateEvening = new Date(2026, 2, 15, 23, 50, 0);
    expect(parseVoiceInput('káva dnes 2,50', 'sk', lateEvening).date).toBe('2026-03-15');
  });

  it('resolves "yesterday" across a month boundary', () => {
    const firstOfMonth = new Date(2026, 3, 1, 9, 0, 0);
    expect(parseVoiceInput('obed včera 12,50', 'sk', firstOfMonth).date).toBe('2026-03-31');
  });

  it('leaves the date empty when no relative word is present', () => {
    expect(parseVoiceInput('Káva 2,50', 'sk', new Date(2026, 2, 15)).date).toBe('');
  });
});

describe('amount extraction shapes', () => {
  const now = new Date(2026, 2, 15, 10, 0, 0);

  it('accepts dot, comma and colon as the decimal separator', () => {
    expect(parseVoiceInput('kava 5.50', 'sk', now).amountInCents).toBe(550);
    expect(parseVoiceInput('kava 5,50', 'sk', now).amountInCents).toBe(550);
    expect(parseVoiceInput('kava 5:50', 'sk', now).amountInCents).toBe(550);
  });

  it('reads a split decimal ("2 50" -> 2.50)', () => {
    const result = parseVoiceInput('mlieko 2 50', 'sk', now);
    expect(result.amountInCents).toBe(250);
    expect(result.needsReview).toBe(false);
  });

  it('keeps the legacy string form', () => {
    expect(parseVoiceInput('kava 5,50', 'sk', now).amount).toBe('5.50');
    expect(parseVoiceInput('nic', 'sk', now).amount).toBe('');
  });

  it('skips currency words', () => {
    expect(parseVoiceInput('platba 30 eur', 'sk', now).amountInCents).toBe(3000);
    expect(parseVoiceInput('payment 30 dollars', 'en-us', now).amountInCents).toBe(3000);
    expect(parseVoiceInput('pago 30 pesos', 'es-pe', now).amountInCents).toBe(3000);
  });

  it('flags multiple numeric candidates for review', () => {
    const result = parseVoiceInput('káva 2,50 a croissant 3,20', 'sk', now);
    expect(result.amountInCents).toBe(250);
    expect(result.needsReview).toBe(true);
  });

  it('documents the space-separated thousands limitation', () => {
    // "1 500" is read as two tokens by the regex parser; the LLM path handles these.
    const result = parseVoiceInput('benzín 1 500', 'sk', now);
    expect(result.amountInCents).toBe(100);
    expect(result.needsReview).toBe(true);
  });

  it('returns null (not 0) when nothing numeric is present', () => {
    const result = parseVoiceInput('Nič som nekúpil', 'sk', now);
    expect(result.amountInCents).toBeNull();
    expect(result.needsReview).toBe(true);
  });
});

describe('shape and robustness', () => {
  const now = new Date(2026, 2, 15, 10, 0, 0);

  it('keeps the original transcript in note', () => {
    expect(parseVoiceInput('Káva 2,50', 'sk', now).note).toBe('Káva 2,50');
  });

  it('falls back to "Transaction" when nothing usable is found', () => {
    expect(parseVoiceInput('12 34', 'sk', now).description).toBe('Transaction');
  });

  it('handles empty and whitespace transcripts without throwing', () => {
    const empty = parseVoiceInput('', 'sk', now);
    expect(empty.amountInCents).toBeNull();
    expect(empty.needsReview).toBe(true);

    const blank = parseVoiceInput('     ', 'sk', now);
    expect(blank.amountInCents).toBeNull();
  });

  it('is deterministic for the same inputs', () => {
    const first = parseVoiceInput('Obed včera 12,50', 'sk', now);
    const second = parseVoiceInput('Obed včera 12,50', 'sk', now);
    expect(first).toEqual(second);
  });
});

