/**
 * Mascot image generation.
 *
 * The account that serves Kaptia no longer has DALL·E: `dall-e-3` answers
 * "The model 'dall-e-3' does not exist", which is why every mascot request ended in
 * "Failed to generate mascot". The gpt-image family replaced it, and it answers with base64
 * instead of a URL, so the bytes are read from either shape.
 *
 * The model is a list, not a constant: a retired name is skipped and the next one is tried,
 * and `AI_IMAGE_MODEL` pins the choice without a code change.
 */
import { log } from './logger';
import type { ImageGenerateParamsNonStreaming, ImagesResponse } from 'openai/resources/images';

/** First entry is the one that answers on the current account; the rest are a safety net. */
export const DEFAULT_IMAGE_MODELS = ['gpt-image-1.5', 'gpt-image-2', 'dall-e-3'] as const;

/** Configured model first (when set), then the built-in order, without duplicates. */
export function imageModelCandidates(configured: string | undefined = process.env.AI_IMAGE_MODEL): string[] {
  const pinned = (configured ?? '').trim();
  const models = pinned ? [pinned, ...DEFAULT_IMAGE_MODELS] : [...DEFAULT_IMAGE_MODELS];
  return models.filter((model, index) => model.length > 0 && models.indexOf(model) === index);
}

/**
 * A name the account does not have is the one failure worth retrying on the next model.
 * A rejected prompt or a missing key fails the same way on every model, so it is reported.
 */
export function isMissingModelError(error: any): boolean {
  const message = String(error?.message ?? '');
  return error?.status === 404 || /does not exist|unknown model|unsupported model|model_not_found/i.test(message);
}

export interface MascotImageClient {
  images: { generate: (params: ImageGenerateParamsNonStreaming) => Promise<ImagesResponse> };
}

export interface GeneratedMascotImage {
  /** Raw PNG bytes, ready for the CDN or the local uploads folder. */
  bytes: Buffer;
  /** The model that actually answered, so the log line names the real cost driver. */
  model: string;
  /** The provider URL when the response carried one (dall-e only); it expires in about an hour. */
  temporaryUrl?: string;
}

async function defaultClient(): Promise<MascotImageClient> {
  const OpenAI = (await import('openai')).default;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function download(url: string): Promise<Buffer> {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error('Failed to download generated image');
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * One mascot picture, from the first model that answers.
 *
 * `b64_json` and `url` are both handled because the two families answer differently; asking
 * dall-e for base64 skips a second network hop to fetch what it just generated.
 */
export async function generateMascotImage(
  prompt: string,
  deps: {
    getClient?: () => Promise<MascotImageClient>;
    downloadImage?: (url: string) => Promise<Buffer>;
  } = {},
): Promise<GeneratedMascotImage> {
  const getClient = deps.getClient ?? defaultClient;
  const downloadImage = deps.downloadImage ?? download;
  const client = await getClient();

  let lastError: unknown;
  for (const model of imageModelCandidates()) {
    const params: ImageGenerateParamsNonStreaming = {
      model: model as ImageGenerateParamsNonStreaming['model'],
      prompt,
      n: 1,
      size: '1024x1024',
    };
    if (model.startsWith('dall-e')) {
      params.quality = 'standard';
      params.response_format = 'b64_json';
    }

    try {
      const response = await client.images.generate(params);
      const item = response?.data?.[0];

      if (typeof item?.b64_json === 'string' && item.b64_json.length > 0) {
        return { bytes: Buffer.from(item.b64_json, 'base64'), model };
      }
      if (typeof item?.url === 'string' && item.url.length > 0) {
        return { bytes: await downloadImage(item.url), model, temporaryUrl: item.url };
      }
      throw new Error(`Image model ${model} returned neither image data nor a URL`);
    } catch (error) {
      if (!isMissingModelError(error)) throw error;
      lastError = error;
      log.warn(`Mascot image model "${model}" is not available on this account; trying the next one`);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No image model is available for the mascot');
}

/**
 * A stable 0-based slot derived from the person's id.
 *
 * The id is a Clerk one (`user_3L0xu…`), so reading its digits gave NaN for most accounts
 * and the prompt literally said "expressive eyes, undefined, in undefined colors".
 */
export function stableIndexFromId(userId: string, length: number): number {
  if (length <= 0) return 0;
  let hash = 0;
  for (const character of String(userId ?? '')) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1_000_003;
  }
  return hash % length;
}
