import { openai } from './openaiClient';
import { AI_MODELS, MODEL_CATALOG, stripCodeFences } from '../lib/aiProvider';
import {
  applyRegexFallback,
  normalizeReceiptExtraction,
  toLegacyExtractedReceipt,
  type LegacyExtractedReceipt,
  type ReceiptExtractionDraft,
} from '../shared/receiptExtraction';

/**
 * IMPURE half of receipt extraction: the only place that talks to a model.
 * Everything testable without network lives in `shared/receiptExtraction.ts`.
 */

export const RECEIPT_PROMPT_VERSION = 'receipt-extract@1';

/** Kept byte-identical to the previous inline prompt to avoid a silent behaviour change. */
export const RECEIPT_SYSTEM_PROMPT =
  'You are a financial application. Based on this OCR text from a receipt, extract: ' +
  '- amount (as a number) - purchase date (in YYYY-MM-DD format) - store/vendor name. ' +
  'Return the response in JSON format with keys: amount, date, vendor.';

/** Calls the model and normalizes the reply. Never throws; failures come back as `error`. */
export async function extractReceiptWithAI(ocrText: string): Promise<ReceiptExtractionDraft> {
  const model = AI_MODELS.parsing;
  const meta = { provider: MODEL_CATALOG[model]?.provider, model };

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: RECEIPT_SYSTEM_PROMPT },
        { role: 'user', content: ocrText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content ?? '{}';

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(content) || '{}');
    } catch {
      // A non-JSON reply is a recorded-fixture case, not a crash: keep it in `raw`.
      parsed = content;
    }

    return normalizeReceiptExtraction(parsed, meta);
  } catch (error) {
    console.error('Receipt extraction error:', error);
    return {
      amountInCents: null,
      date: null,
      vendor: null,
      raw: null,
      ...meta,
      error: 'Failed to extract structured data',
    };
  }
}

/**
 * Legacy entry point used by `uploadReceiptHandler` and `mobileUploadRoutes`.
 * Returns the historical `{ amount, date, vendor }` shape (amount as a number).
 */
export async function extractStructuredData(
  ocrText: string,
): Promise<LegacyExtractedReceipt & { error?: string }> {
  const draft = await extractReceiptWithAI(ocrText);
  if (draft.error) return { error: draft.error };

  const extracted = toLegacyExtractedReceipt(draft);
  return process.env.RECEIPT_REGEX_FALLBACK === '1'
    ? applyRegexFallback(extracted, ocrText)
    : extracted;
}
