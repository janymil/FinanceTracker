/**
 * Contract for recorded AI fixtures (`tests/ai/recorded/**`).
 *
 * A fixture is the ONLY way an AI-dependent path is allowed into CI: the model reply is
 * captured once, committed, and replayed. No key, no network, no cost, no flakiness.
 *
 * `source` is deliberately explicit:
 *   - "captured"  – produced by `scripts/capture-ai-fixture.ts` against a real provider
 *   - "synthetic" – hand-written to model a documented reply shape, before a real capture exists
 *
 * The validator rejects a fixture that claims to be captured without the metadata needed
 * to reproduce it. That keeps "it passed in CI" from silently meaning "nobody ever
 * looked at the real model output".
 */

export type AiFixtureSource = 'captured' | 'synthetic';
export type AiFixtureTask = 'receipt-extraction' | 'voice-extraction' | 'bank-statement';

const TASKS: AiFixtureTask[] = ['receipt-extraction', 'voice-extraction', 'bank-statement'];
const SOURCES: AiFixtureSource[] = ['captured', 'synthetic'];
const OCR_SOURCES = ['mistral', 'vision', 'text', 'ai-processor'];

export interface AiFixtureMeta {
  provider: string;
  model: string;
  task: AiFixtureTask;
  promptVersion: string;
  ocrSource?: string;
  capturedAt: string;
  source: AiFixtureSource;
}

export interface AiFixture<TExpected = Record<string, unknown>> {
  meta: AiFixtureMeta;
  input: string;
  /** Verbatim provider reply: an object, or a string when the model did not return JSON. */
  output: unknown;
  expected: TExpected;
}

export class AiFixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiFixtureError';
  }
}

function requireString(value: unknown, field: string, origin: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AiFixtureError(`${origin}: meta.${field} must be a non-empty string`);
  }
  return value;
}

/** Validates and types a raw fixture. Throws `AiFixtureError` with the offending field. */
export function parseAiFixture<TExpected = Record<string, unknown>>(
  raw: unknown,
  origin = 'fixture',
): AiFixture<TExpected> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AiFixtureError(`${origin}: fixture must be an object`);
  }

  const candidate = raw as Record<string, unknown>;
  const metaRaw = candidate.meta;
  if (metaRaw === null || typeof metaRaw !== 'object' || Array.isArray(metaRaw)) {
    throw new AiFixtureError(`${origin}: meta must be an object`);
  }

  const meta = metaRaw as Record<string, unknown>;
  const provider = requireString(meta.provider, 'provider', origin);
  const model = requireString(meta.model, 'model', origin);
  const task = requireString(meta.task, 'task', origin);
  const promptVersion = requireString(meta.promptVersion, 'promptVersion', origin);
  const capturedAt = requireString(meta.capturedAt, 'capturedAt', origin);
  const source = requireString(meta.source, 'source', origin);

  if (!TASKS.includes(task as AiFixtureTask)) {
    throw new AiFixtureError(`${origin}: meta.task "${task}" is not one of ${TASKS.join(', ')}`);
  }
  if (!SOURCES.includes(source as AiFixtureSource)) {
    throw new AiFixtureError(`${origin}: meta.source "${source}" is not one of ${SOURCES.join(', ')}`);
  }
  if (Number.isNaN(Date.parse(capturedAt))) {
    throw new AiFixtureError(`${origin}: meta.capturedAt must be an ISO timestamp`);
  }

  const ocrSource = meta.ocrSource === undefined ? undefined : String(meta.ocrSource);
  if (ocrSource !== undefined && !OCR_SOURCES.includes(ocrSource)) {
    throw new AiFixtureError(`${origin}: meta.ocrSource "${ocrSource}" is not one of ${OCR_SOURCES.join(', ')}`);
  }

  if (typeof candidate.input !== 'string') {
    throw new AiFixtureError(`${origin}: input must be a string (the OCR text or transcript)`);
  }
  if (!('output' in candidate) || candidate.output === undefined) {
    throw new AiFixtureError(`${origin}: output is required (verbatim provider reply)`);
  }
  if (candidate.expected === null || typeof candidate.expected !== 'object') {
    throw new AiFixtureError(`${origin}: expected must be an object`);
  }
  if (source === 'captured' && ocrSource === undefined) {
    throw new AiFixtureError(`${origin}: captured fixtures must record meta.ocrSource`);
  }

  return {
    meta: {
      provider,
      model,
      task: task as AiFixtureTask,
      promptVersion,
      ...(ocrSource !== undefined ? { ocrSource } : {}),
      capturedAt,
      source: source as AiFixtureSource,
    },
    input: candidate.input,
    output: candidate.output,
    expected: candidate.expected as TExpected,
  };
}
