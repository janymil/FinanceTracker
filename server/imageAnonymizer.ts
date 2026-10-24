/**
 * Image anonymisation before AI OCR.
 *
 * Receipt photos and scanned statements must be read by a real OCR model (Tesseract
 * cannot handle a bank statement's layout). So instead of replacing the OCR provider, we
 * **black out the identifying parts of the image first**, then send the cleaned image to
 * Mistral OCR / OpenAI vision.
 *
 * How it works:
 *   1. Tesseract runs locally only as a *locator*: it returns the bounding box of every
 *      text line (no content is taken from it);
 *   2. each line is tested for identifiers (IBAN, card, phone, e-mail, national/tax ID,
 *      address labels, account numbers) or for the signed-in user's own name;
 *   3. matching lines are painted black on the image with sharp;
 *   4. the masked image is what leaves the server.
 */
import sharp from 'sharp';
import { anonymizeText, type AnonymizeExtras } from '../shared/aiAnonymizer';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TextLine {
  text: string;
  bbox: Box;
}

export interface ImageAnonymizeResult {
  image: Buffer;
  maskedLines: number;
  detectedLines: number;
  detectedWords: number;
}

/**
 * Labels that always introduce an identity — never a transaction row, so they are masked
 * even if the line happens to contain a number.
 */
const IDENTITY_LABELS =
  /^[\s*•-]*(cliente|customer|nombre|name|m[eé]no|meno|titular|holder|majite[ľl]|dr[žz]ite[ľl]|address|adresa|adres[au]|direcci[oó]n|domicilio|dni|c\.?e\.?|ruc|vat|tax|r\.?c\.?|rodn[eé]|birth|e-?mail|email|correo)\b/i;

/** Weaker labels: masked only when the line is not a money row ("BANK FEE 5.00"). */
const WEAK_LABELS =
  /^[\s*•-]*(iban|cuenta|account|tel|telef[oó]n|phone|bank|banka|swift|bic)\b/i;

/** A money amount at the end of a line: 53.00, 1.500,00, S/ 24.70. */
const AMOUNT = /(?:S\/\s*)?\d{1,3}(?:[ .]\d{3})*[.,]\d{2}(?!\d)/;

/** Redactions that identify a person or account on their own (labels not needed). */
const STRONG_REDACTIONS = new Set([
  'email',
  'iban',
  'card',
  'phone',
  'account_number',
  'sk_birth_number',
  'es_dni_nie',
  'pe_ruc',
  'us_ssn',
  'labelled_document',
  'url',
]);

function nameParts(extras?: AnonymizeExtras): string[] {
  const parts = new Set<string>();
  for (const name of extras?.names ?? []) {
    const value = (name ?? '').trim();
    if (value.length >= 3) {
      parts.add(value.toLowerCase());
      for (const piece of value.split(/\s+/)) {
        if (piece.length >= 3) parts.add(piece.toLowerCase());
      }
    }
  }
  const email = (extras?.email ?? '').trim().toLowerCase();
  if (email.includes('@')) parts.add(email);
  return Array.from(parts);
}

/**
 * Pure decision function, so the rules can be tested without OCR or images.
 * Deliberately conservative: amounts, dates, merchant names and line items are never masked.
 */
export function shouldMaskLine(text: string, extras?: AnonymizeExtras): boolean {
  const line = (text ?? '').trim();
  if (line.length < 3) return false;

  const { redactions } = anonymizeText(line);
  const keys = Object.keys(redactions);

  // IBAN, card, phone, e-mail, document number, long account number: never a transaction.
  if (keys.some((key) => STRONG_REDACTIONS.has(key))) return true;

  // "Titular:", "Cliente:", "Adresa:" — identity by definition.
  if (IDENTITY_LABELS.test(line)) return true;

  // The signed-in user's own name wins over everything, even on a money row.
  const lower = line.toLowerCase();
  for (const part of nameParts(extras)) {
    if (lower.includes(part)) return true;
  }

  const hasAmount = AMOUNT.test(line);

  // "BANK FEE 5.00" or "Account maintenance 12.00" are transactions, keep them.
  if (hasAmount) return false;

  if (WEAK_LABELS.test(line)) return true;
  if (keys.length > 0) return true;

  return false;
}


function padBox(box: Box, padding: number, width: number, height: number): Box {
  return {
    x0: Math.max(0, Math.floor(box.x0 - padding)),
    y0: Math.max(0, Math.floor(box.y0 - padding)),
    x1: Math.min(width, Math.ceil(box.x1 + padding)),
    y1: Math.min(height, Math.ceil(box.y1 + padding)),
  };
}

/** Paints opaque rectangles over the given boxes. Exported for the unit test. */
export async function maskBoxes(
  image: Buffer,
  boxes: Box[],
  options: { width?: number; height?: number; padding?: number } = {},
): Promise<Buffer> {
  const metadata = await sharp(image).metadata();
  const width = options.width ?? metadata.width ?? 0;
  const height = options.height ?? metadata.height ?? 0;
  if (boxes.length === 0 || !width || !height) return image;

  const padding = options.padding ?? 4;
  const rects = boxes
    .map((box) => padBox(box, padding, width, height))
    .map(
      (box) =>
        `<rect x="${box.x0}" y="${box.y0}" width="${Math.max(1, box.x1 - box.x0)}" height="${Math.max(1, box.y1 - box.y0)}" fill="#000000"/>`,
    )
    .join('');

  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects}</svg>`,
  );

  return sharp(image)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function detectLines(image: Buffer): Promise<{ lines: TextLine[]; words: number }> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, { logger: () => {} });
  try {
    const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
    const lines: TextLine[] = [];
    let words = 0;

    for (const block of (data as any).blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          if (!line?.bbox || !line?.text) continue;
          words += Array.isArray(line.words) ? line.words.length : String(line.text).split(/\s+/).length;
          lines.push({ text: String(line.text), bbox: line.bbox });
        }
      }
    }

    return { lines, words };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

/**
 * Returns an image that is safe to send to an OCR/AI provider.
 *
 * `detectedWords === 0` means the locator could not read anything — the caller must not
 * send that image anywhere, because no masking could be applied.
 */
export async function anonymizeImageForAI(
  imageBuffer: Buffer,
  extras?: AnonymizeExtras,
): Promise<ImageAnonymizeResult> {
  // Normalise orientation and size first: what we detect is exactly what we send.
  const prepared = await sharp(imageBuffer)
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  const metadata = await sharp(prepared).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const { lines, words } = await detectLines(prepared);
  const toMask = lines.filter((line) => shouldMaskLine(line.text, extras));

  if (toMask.length === 0) {
    return { image: prepared, maskedLines: 0, detectedLines: lines.length, detectedWords: words };
  }

  const masked = await maskBoxes(prepared, toMask.map((line) => line.bbox), {
    width,
    height,
    padding: 4,
  });

  return {
    image: masked,
    maskedLines: toMask.length,
    detectedLines: lines.length,
    detectedWords: words,
  };
}

