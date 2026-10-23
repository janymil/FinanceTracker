/**
 * OCR providers for receipt images.
 *
 * Order (server behaviour, unchanged): **Mistral OCR** first, **Google Cloud Vision**
 * as the fallback. Both are injectable so contract tests can run with no network and
 * no GCP credentials — the `@google-cloud/vision` SDK is imported lazily and only when
 * no fake client is supplied.
 */
import nodeFetch from 'node-fetch';

export type OcrSource = 'mistral' | 'vision';

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
}

export interface OcrOutcome {
  text: string;
  source: OcrSource;
}

const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr';
const DEFAULT_MISTRAL_MODEL = 'mistral-ocr-latest';

let cachedVisionClient: VisionLike | null | undefined;

function hasGoogleCloudConfig(): boolean {
  return Boolean(
    process.env.GOOGLE_CLOUD_PROJECT_ID &&
      process.env.GOOGLE_CLOUD_PRIVATE_KEY &&
      process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
  );
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
  cachedVisionClient = new ImageAnnotatorClient({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_CLOUD_PROJECT_ID,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    },
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  }) as unknown as VisionLike;

  return cachedVisionClient;
}

async function resolveVisionClient(deps: OcrDeps): Promise<VisionLike | null> {
  return deps.visionClient !== undefined ? deps.visionClient : defaultVisionClient();
}

async function runMistralOcr(imageBuffer: Buffer, deps: OcrDeps, apiKey: string): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? (nodeFetch as unknown as OcrFetch);

  const response = await fetchImpl(MISTRAL_OCR_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: deps.mistralModel ?? process.env.MISTRAL_OCR_MODEL ?? DEFAULT_MISTRAL_MODEL,
      document: {
        type: 'image_url',
        image_url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
      },
    }),
  });

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
  if (!visionClient) {
    throw new Error('No OCR provider configured (set MISTRAL_API_KEY or Google Cloud Vision credentials)');
  }

  try {
    const [result] = await visionClient.textDetection({ image: { content: imageBuffer } });

    const detections = result?.textAnnotations;
    if (detections && detections.length > 0) {
      return { text: detections[0].description || '', source: 'vision' };
    }

    return { text: result?.fullTextAnnotation?.text || '', source: 'vision' };
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Failed to process image with OCR');
  }
}

/** Backwards-compatible signature: the upload handler only needs the text. */
export async function performOCR(imageBuffer: Buffer, deps: OcrDeps = {}): Promise<string> {
  const outcome = await performOCRDetailed(imageBuffer, deps);
  return outcome.text;
}
