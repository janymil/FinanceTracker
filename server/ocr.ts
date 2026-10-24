/**
 * OCR providers for receipt images.
 *
 * Order (server behaviour, unchanged): **Mistral OCR** first, **Google Cloud Vision**
 * as the fallback. Both are injectable so contract tests can run with no network and
 * no GCP credentials — the `@google-cloud/vision` SDK is imported lazily and only when
 * no fake client is supplied.
 */
import nodeFetch from 'node-fetch';
import { existsSync } from 'node:fs';

export type OcrSource = 'mistral' | 'vision' | 'openai';

export interface OcrFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<any>;
}

export type OcrFetch = (url: string, init: any) => Promise<OcrFetchResponse>;

export interface VisionLike {
  textDetection(input: { image: { content: Buffer } }): Promise<
    Array<{
      textAnnotations?: Array<{ description?: string | null }>;
      fullTextAnnotation?: { text?: string | null };
    }>
  >;
}

export interface OcrDeps {
  /** Defaults to node-fetch. Tests pass a stub. */
  fetchImpl?: OcrFetch;
  /** `null` disables the Vision fallback; `undefined` resolves it lazily from env. */
  visionClient?: VisionLike | null;
  mistralApiKey?: string;
  mistralModel?: string;
  /** Wait before retrying a 429/5xx from Mistral. Zero in tests. */
  retryDelayMs?: number;
  /**
   * Last-resort reader. `null` disables it; `undefined` resolves it lazily from env
   * (only when OPENAI_API_KEY exists). Injected in tests so no network is needed.
   */
  openaiVision?: ((image: Buffer) => Promise<string>) | null;
}

export interface OcrOutcome {
  text: string;
  source: OcrSource;
}

const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr';
const DEFAULT_MISTRAL_MODEL = 'mistral-ocr-latest';

let cachedVisionClient: VisionLike | null | undefined;

function hasGoogleCloudConfig(): boolean {
  if (
    process.env.GOOGLE_CLOUD_PROJECT_ID &&
    process.env.GOOGLE_CLOUD_PRIVATE_KEY &&
    process.env.GOOGLE_CLOUD_CLIENT_EMAIL
  ) {
    return true;
  }
  // The standard Google form is also accepted: a service-account JSON file on disk.
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile) {
    try {
      return existsSync(keyFile);
    } catch {
      return false;
    }
  }
  return false;
}

/** Lazy singleton: the SDK is never loaded when a fake client is injected. */
async function defaultVisionClient(): Promise<VisionLike | null> {
  if (cachedVisionClient !== undefined) return cachedVisionClient;

  if (!hasGoogleCloudConfig()) {
    console.warn('Google Cloud Vision not configured - OCR will rely on Mistral OCR (no Vision fallback).');
    cachedVisionClient = null;
    return cachedVisionClient;
  }

  const { ImageAnnotatorClient } = await import('@google-cloud/vision');

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const inlineCredentials =
    process.env.GOOGLE_CLOUD_PROJECT_ID &&
    process.env.GOOGLE_CLOUD_PRIVATE_KEY &&
    process.env.GOOGLE_CLOUD_CLIENT_EMAIL;

  cachedVisionClient = new ImageAnnotatorClient(
    inlineCredentials
      ? {
          credentials: {
            type: 'service_account',
            project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
            private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
          },
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        }
      : { keyFilename: keyFile }
  ) as unknown as VisionLike;

  return cachedVisionClient;
}

async function resolveVisionClient(deps: OcrDeps): Promise<VisionLike | null> {
  return deps.visionClient !== undefined ? deps.visionClient : defaultVisionClient();
}

async function runMistralOcr(imageBuffer: Buffer, deps: OcrDeps, apiKey: string): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? (nodeFetch as unknown as OcrFetch);

  const request = () =>
    fetchImpl(MISTRAL_OCR_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: deps.mistralModel ?? process.env.MISTRAL_OCR_MODEL ?? DEFAULT_MISTRAL_MODEL,
        document: {
          type: 'image_url',
          image_url: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        },
      }),
    });

  let response = await request();

  // Mistral rate-limits per second. A receipt upload that fails with 429 is a user
  // watching a spinner and losing a scanned receipt, so wait briefly and try once more
  // before falling back to another provider.
  if (response.status === 429 || response.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, deps.retryDelayMs ?? 1500));
    response = await request();
  }

  if (!response.ok) {
    throw new Error(`Mistral OCR HTTP ${response.status}`);
  }

  const payload: any = await response.json();
  const text = (payload?.pages ?? [])
    .map((page: any) => page?.markdown ?? '')
    .join('\n\n')
    .trim();

  if (!text) throw new Error('Mistral OCR returned no text');
  return text;
}

/**
 * Last resort: read the receipt with the multimodal model that already powers the app's AI.
 * Added after a production finding: Mistral OCR was returning 429 at account level while
 * Google Vision had no credentials at all, so receipt scanning failed for every user.
 */
async function runOpenAiVision(imageBuffer: Buffer, deps: OcrDeps): Promise<string> {
  if (deps.openaiVision) return deps.openaiVision(imageBuffer);
  if (deps.openaiVision === null) throw new Error('OpenAI vision disabled');

  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

  const { createRoutedClient } = await import('../lib/aiProvider.js');
  const client = createRoutedClient();
  const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

  const response = await client.chat.completions.create({
    model: 'gpt-6-luna',
    max_completion_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Transcribe every readable line of this receipt or invoice. ' +
              'Return plain text only, keep the original line order, do not summarise, do not add comments.',
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ] as any,
      },
    ],
  } as any);

  const text = String(response.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('OpenAI vision returned no text');

  // A multimodal model happily answers "this image does not show a receipt". That is a
  // refusal, not OCR text — passing it on would create a transaction whose merchant is
  // that sentence. Treat short refusals as a failure so the caller can tell the user.
  const looksLikeRefusal =
    text.length < 300 &&
    /(no (readable |visible )?(receipt|invoice|text)|does not (show|contain|appear)|cannot (read|find)|unable to (read|find)|not a receipt|not an invoice)/i.test(
      text,
    );
  if (looksLikeRefusal) {
    throw new Error('OpenAI vision reported that the image contains no receipt text');
  }

  return text;
}

/** OCR with the provider that actually answered — what recorded fixtures need. */
export async function performOCRDetailed(imageBuffer: Buffer, deps: OcrDeps = {}): Promise<OcrOutcome> {
  const mistralKey = deps.mistralApiKey ?? process.env.MISTRAL_API_KEY;

  if (mistralKey) {
    try {
      return { text: await runMistralOcr(imageBuffer, deps, mistralKey), source: 'mistral' };
    } catch (error) {
      console.warn('[OCR] Mistral OCR failed, falling back to Google Vision:', (error as Error).message);
    }
  }

  const visionClient = await resolveVisionClient(deps);
  if (visionClient) {
    try {
      const [result] = await visionClient.textDetection({ image: { content: imageBuffer } });

      const detections = result?.textAnnotations;
      if (detections && detections.length > 0) {
        return { text: detections[0].description || '', source: 'vision' };
      }

      return { text: result?.fullTextAnnotation?.text || '', source: 'vision' };
    } catch (error) {
      console.error('[OCR] Google Vision failed, falling back to OpenAI vision:', error);
    }
  }

  try {
    return { text: await runOpenAiVision(imageBuffer, deps), source: 'openai' };
  } catch (error) {
    console.error('[OCR] OpenAI vision failed:', error);
    throw new Error(
      'OCR is unavailable right now (Mistral quota, Google Vision not configured, OpenAI failed)',
    );
  }
}

/** Backwards-compatible signature: the upload handler only needs the text. */
export async function performOCR(imageBuffer: Buffer, deps: OcrDeps = {}): Promise<string> {
  const outcome = await performOCRDetailed(imageBuffer, deps);
  return outcome.text;
}
