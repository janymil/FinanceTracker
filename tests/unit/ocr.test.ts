import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAiFixture } from '../../shared/aiFixture';
import { performOCR, performOCRDetailed, type OcrFetch, type VisionLike } from '../../server/ocr';

/**
 * Module 3 of step 3: OCR provider contract (Mistral primary, Vision fallback).
 * Both providers are injected, so no network, no GCP credentials, no cost.
 */

const recordedDir = fileURLToPath(new URL('../ai/recorded/mistral-ocr', import.meta.url));

const mistralFixture = parseAiFixture<{ text: string; source: string }>(
  JSON.parse(readFileSync(path.join(recordedDir, 'lidl-01.json'), 'utf8')),
  'lidl-01.json',
);

const okFetch = (payload: unknown) =>
  vi.fn<OcrFetch>(async () => ({ ok: true, status: 200, json: async () => payload }));

const visionWith = (detections: string | null, fullText?: string): VisionLike => ({
  textDetection: async () => [
    {
      textAnnotations: detections === null ? [] : [{ description: detections }],
      fullTextAnnotation: fullText ? { text: fullText } : undefined,
    },
  ],
});

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Mistral OCR (primary provider)', () => {
  it('replays the recorded OCR response and reports the source', async () => {
    const fetchImpl = okFetch(mistralFixture.output);

    const outcome = await performOCRDetailed(Buffer.from('image-bytes'), {
      fetchImpl,
      mistralApiKey: 'test-key',
      visionClient: null,
    });

    expect(outcome).toEqual(mistralFixture.expected);
    expect(outcome.source).toBe('mistral');
  });

  it('sends the documented request', async () => {
    const fetchImpl = okFetch(mistralFixture.output);

    await performOCRDetailed(Buffer.from('image-bytes'), {
      fetchImpl,
      mistralApiKey: 'test-key',
      visionClient: null,
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.mistral.ai/v1/ocr');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('mistral-ocr-latest');
    expect(body.document.type).toBe('image_url');
    // Images reach this function as PNG from server/imageAnonymizer, so the data URL must
    // say PNG — a wrong MIME type is exactly the kind of detail a strict OCR API rejects.
    expect(body.document.image_url).toMatch(/^data:image\/png;base64,/);
  });

  it('honours a model override', async () => {
    const fetchImpl = okFetch({ pages: [{ markdown: 'x' }] });
    await performOCRDetailed(Buffer.from('i'), {
      fetchImpl,
      mistralApiKey: 'k',
      mistralModel: 'mistral-ocr-2512',
      visionClient: null,
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).model).toBe('mistral-ocr-2512');
  });

  it('joins multiple pages with a blank line', async () => {
    const fetchImpl = okFetch({ pages: [{ markdown: 'page one' }, { markdown: 'page two' }] });
    const outcome = await performOCRDetailed(Buffer.from('i'), {
      fetchImpl,
      mistralApiKey: 'k',
      visionClient: null,
    });
    expect(outcome.text).toBe('page one\n\npage two');
  });
});

describe('Vision fallback', () => {
  it('falls back when Mistral keeps returning a non-OK status', async () => {
    const fetchImpl = vi.fn<OcrFetch>(async () => ({ ok: false, status: 500, json: async () => ({}) }));

    const outcome = await performOCRDetailed(Buffer.from('i'), {
      fetchImpl,
      mistralApiKey: 'k',
      visionClient: visionWith('VISION TEXT'),
      retryDelayMs: 0,
    });

    expect(outcome).toEqual({ text: 'VISION TEXT', source: 'vision' });
    // One attempt, one retry after the 5xx, then the fallback.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries a rate-limited Mistral call once and keeps its answer', async () => {
    const fetchImpl = vi
      .fn<OcrFetch>()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ pages: [{ markdown: 'LIDL 23.50' }] }),
      });

    const outcome = await performOCRDetailed(Buffer.from('i'), {
      fetchImpl,
      mistralApiKey: 'k',
      visionClient: visionWith('VISION TEXT'),
      retryDelayMs: 0,
    });

    expect(outcome).toEqual({ text: 'LIDL 23.50', source: 'mistral' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('falls back when the Mistral request throws', async () => {
    const fetchImpl = vi.fn<OcrFetch>(async () => {
      throw new Error('ECONNRESET');
    });

    const outcome = await performOCRDetailed(Buffer.from('i'), {
      fetchImpl,
      mistralApiKey: 'k',
      visionClient: visionWith('VISION TEXT'),
    });

    expect(outcome).toEqual({ text: 'VISION TEXT', source: 'vision' });
  });

  it('falls back when Mistral returns no text', async () => {
    const fetchImpl = okFetch({ pages: [] });

    const outcome = await performOCRDetailed(Buffer.from('i'), {
      fetchImpl,
      mistralApiKey: 'k',
      visionClient: visionWith('VISION TEXT'),
    });

    expect(outcome.text).toBe('VISION TEXT');
    expect(outcome.source).toBe('vision');
  });

  it('uses fullTextAnnotation when textAnnotations is empty', async () => {
    const outcome = await performOCRDetailed(Buffer.from('i'), {
      mistralApiKey: '',
      visionClient: visionWith(null, 'FULLTEXT'),
    });

    expect(outcome).toEqual({ text: 'FULLTEXT', source: 'vision' });
  });

  it('throws a clear error when every provider is unavailable', async () => {
    await expect(
      performOCRDetailed(Buffer.from('i'), {
        mistralApiKey: '',
        visionClient: null,
        openaiVision: null,
      }),
    ).rejects.toThrow('OCR is unavailable right now');
  });

  it('falls back to OpenAI vision when Mistral and Vision cannot help', async () => {
    const fetchImpl = vi.fn<OcrFetch>(async () => ({ ok: false, status: 429, json: async () => ({}) }));

    const outcome = await performOCRDetailed(Buffer.from('i'), {
      fetchImpl,
      mistralApiKey: 'k',
      visionClient: null,
      retryDelayMs: 0,
      openaiVision: async () => 'LIDL\nMlieko 1,29\nSpolu 23,50',
    });

    expect(outcome.source).toBe('openai');
    expect(outcome.text).toContain('Spolu 23,50');
  });

  it('uses OpenAI vision when Vision throws', async () => {
    const visionClient: VisionLike = {
      textDetection: async () => {
        throw new Error('quota exceeded');
      },
    };

    const outcome = await performOCRDetailed(Buffer.from('i'), {
      mistralApiKey: '',
      visionClient,
      openaiVision: async () => 'OPENAI TEXT',
    });

    expect(outcome).toEqual({ text: 'OPENAI TEXT', source: 'openai' });
  });
});

describe('performOCR (legacy signature)', () => {
  it('returns only the text', async () => {
    const fetchImpl = okFetch(mistralFixture.output);
    const text = await performOCR(Buffer.from('i'), {
      fetchImpl,
      mistralApiKey: 'k',
      visionClient: null,
    });

    expect(text).toBe(mistralFixture.expected.text);
  });
});

