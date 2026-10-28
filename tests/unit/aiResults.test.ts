import { describe, expect, it } from 'vitest';
import {
  AIResponseError,
  clampConfidence,
  finiteNumber,
  isAIFailure,
  isDegraded,
  parseModelJson,
  validCategoryId,
} from '../../shared/aiResults';

/**
 * A model reply is untrusted input. These checks are what keep a broken provider from
 * looking like a normal answer.
 */
describe('parseModelJson', () => {
  it('parses a JSON object', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('accepts a JSON array (insights come back as an array)', () => {
    expect(parseModelJson('[{"id":"x"}]')).toEqual([{ id: 'x' }]);
  });

  it.each([null, undefined, '', '   '])('rejects an empty reply (%j)', (value) => {
    expect(() => parseModelJson(value as any)).toThrow(AIResponseError);
  });

  it('rejects prose instead of JSON', () => {
    expect(() => parseModelJson('Sure! Here is your answer.')).toThrow(/not valid JSON/);
  });

  /*
   * Providers do not always honour "JSON mode", and the gateway in front of them does not always pass
   * it on. A fenced or prefixed reply is still a usable answer; a truncated one is not.
   */
  it('accepts a reply wrapped in a code fence', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('accepts a reply with a sentence before and after the object', () => {
    expect(parseModelJson('Here you go: {"a":1} - hope it helps')).toEqual({ a: 1 });
  });

  it('takes the outermost object when the reply contains nested ones', () => {
    expect(parseModelJson('{"a":{"b":2}} trailing')).toEqual({ a: { b: 2 } });
  });

  it('still rejects a reply cut off mid-string: truncation is not a formatting accident', () => {
    expect(() => parseModelJson('{"a":"unfinis')).toThrow(/not valid JSON/);
  });

  it('still rejects prose that merely contains braces', () => {
    expect(() => parseModelJson('The answer {is} unclear')).toThrow(/not valid JSON/);
  });

  it.each(['42', '"text"', 'true', 'null'])('rejects JSON that is not an object (%s)', (value) => {
    expect(() => parseModelJson(value)).toThrow(AIResponseError);
  });
});

describe('clampConfidence', () => {
  it('keeps a valid number and clamps the rest into 0..1', () => {
    expect(clampConfidence(0.8)).toBe(0.8);
    expect(clampConfidence(7)).toBe(1);
    expect(clampConfidence(-2)).toBe(0);
  });

  it('reads a numeric string and falls back on junk', () => {
    expect(clampConfidence('0.4')).toBe(0.4);
    expect(clampConfidence('high')).toBe(0.5);
    expect(clampConfidence(undefined, 0.1)).toBe(0.1);
    expect(clampConfidence(NaN)).toBe(0.5);
  });
});

describe('validCategoryId', () => {
  const mine = [{ id: 3 }, { id: 9 }];

  it('accepts only the person\'s own category ids', () => {
    expect(validCategoryId(3, mine)).toBe(3);
    expect(validCategoryId('9', mine)).toBe(9);
  });

  it('rejects an id the model invented, or something that is not an integer', () => {
    expect(validCategoryId(4, mine)).toBeUndefined();
    expect(validCategoryId(3.5, mine)).toBeUndefined();
    expect(validCategoryId('abc', mine)).toBeUndefined();
    expect(validCategoryId(undefined, mine)).toBeUndefined();
    expect(validCategoryId(3, [])).toBeUndefined();
  });
});

describe('finiteNumber', () => {
  it('turns "N/A" and friends into the fallback', () => {
    expect(finiteNumber('N/A')).toBe(0);
    expect(finiteNumber(Infinity, 5)).toBe(5);
    expect(finiteNumber('12.5')).toBe(12.5);
    expect(finiteNumber(null)).toBe(0);
  });
});

describe('isAIFailure', () => {
  it('recognises the "service unavailable" payload', () => {
    expect(isAIFailure({ error: 'AI service temporarily unavailable', message: 'x' })).toBe(true);
    expect(isAIFailure(null)).toBe(true);
    expect(isAIFailure(undefined)).toBe(true);
  });

  it('does not flag real answers, including empty lists', () => {
    expect(isAIFailure([])).toBe(false);
    expect(isAIFailure({ tips: [] })).toBe(false);
    expect(isAIFailure({ error: '' })).toBe(false);
    expect(isAIFailure({ score: 80 })).toBe(false);
  });
});

describe('isDegraded', () => {
  it('recognises a fixed stand-in on an object and on any item of a list', () => {
    expect(isDegraded({ title: 'Track Your Expenses', degraded: true })).toBe(true);
    expect(isDegraded([{ title: 'Track Your Expenses', degraded: true }])).toBe(true);
    expect(isDegraded([{ title: 'real tip' }, { title: 'stand-in', degraded: true }])).toBe(true);
  });

  it('does not flag a real answer', () => {
    expect(isDegraded([{ title: 'real tip' }])).toBe(false);
    expect(isDegraded({ degraded: false })).toBe(false);
    expect(isDegraded(null)).toBe(false);
    expect(isDegraded('degraded')).toBe(false);
  });
});
