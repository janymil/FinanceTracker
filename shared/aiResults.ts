/**
 * Checks for what a model hands back.
 *
 * A model reply is untrusted input: it can be empty, prose instead of JSON, JSON of the wrong
 * shape, a confidence of "high", or a category id that never existed. These helpers turn all of
 * that into either a safe value or a clear `AIResponseError`, so a broken provider can never
 * look like a normal answer.
 */

export class AIResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIResponseError';
  }
}

/** Parses a model reply that must be a JSON object. Throws `AIResponseError` otherwise. */
export function parseModelJson(content: string | null | undefined): Record<string, any> {
  if (typeof content !== 'string' || content.trim() === '') {
    throw new AIResponseError('The model returned an empty reply');
  }

  const attempt = (text: string): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  };

  let parsed = attempt(content);

  /*
   * A reply inside a code fence, or with one sentence in front of it, is still a usable answer: the
   * provider's "JSON mode" is advisory, and the gateway in front of it does not always pass it on.
   * Take the outermost braces and try once more.
   *
   * A reply that was cut off mid-string still fails here, which is right: that is a truncated answer,
   * not a formatting accident, and pretending otherwise would hide a prompt that asks for too much.
   */
  if (parsed === undefined) {
    const withoutFences = content.replace(/```(?:json)?/gi, '').trim();
    parsed = attempt(withoutFences);

    if (parsed === undefined) {
      const start = withoutFences.indexOf('{');
      const end = withoutFences.lastIndexOf('}');
      if (start !== -1 && end > start) {
        parsed = attempt(withoutFences.slice(start, end + 1));
      }
    }
  }

  if (parsed === undefined) {
    throw new AIResponseError('The model reply was not valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new AIResponseError('The model reply was not a JSON object or array');
  }
  return parsed as Record<string, any>;
}

/** Confidence is always a number between 0 and 1; anything else becomes `fallback`. */
export function clampConfidence(value: unknown, fallback = 0.5): number {
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

/** A category id is only accepted when it is one of the person's own categories. */
export function validCategoryId(
  value: unknown,
  categories: ReadonlyArray<{ id: number }>,
): number | undefined {
  const id = typeof value === 'string' ? Number(value) : value;
  if (typeof id !== 'number' || !Number.isInteger(id)) return undefined;
  return categories.some((category) => category.id === id) ? id : undefined;
}

/** Finite number or `fallback` (models sometimes answer "N/A" or "about 40"). */
export function finiteNumber(value: unknown, fallback = 0): number {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : fallback;
}

/**
 * True when `runAI` (or a route) produced the "service unavailable" payload instead of a
 * real answer. Such a payload must never be cached or shown as if it were a result.
 */
export function isAIFailure(result: unknown): boolean {
  if (result === null || result === undefined) return true;
  if (typeof result !== 'object' || Array.isArray(result)) return false;
  const record = result as Record<string, unknown>;
  return typeof record.error === 'string' && record.error.length > 0;
}

/**
 * True when the answer is a locally written stand-in rather than something a model produced
 * (the provider failed, so a fixed tip in the person's language took its place).
 *
 * Such an answer is useful on screen, but it cost nothing and said nothing about the person:
 * it must not be charged against the allowance, and it must not be cached as if it were
 * real advice. Marked by the generator with `degraded: true`, on the object or on any item.
 */
export function isDegraded(result: unknown): boolean {
  const marked = (value: unknown): boolean =>
    Boolean(value) && typeof value === 'object' && (value as Record<string, unknown>).degraded === true;

  if (Array.isArray(result)) return result.some(marked);
  return marked(result);
}
