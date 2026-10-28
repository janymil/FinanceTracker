import { openai } from './openaiClient';
import { AI_MODELS, MODEL_CATALOG, stripCodeFences } from '../lib/aiProvider';
import {
  applyRegexFallback,
  matchReceiptYearToText,
  normalizeReceiptExtraction,
  toLegacyExtractedReceipt,
  type LegacyExtractedReceipt,
  type ReceiptExtractionDraft,
} from '../shared/receiptExtraction';
import { log } from './logger';

/**
 * IMPURE half of receipt extraction: the only place that talks to a model.
 * Everything testable without network lives in `shared/receiptExtraction.ts`.
 */

export const RECEIPT_PROMPT_VERSION = 'receipt-extract@2';

/**
 * The three fields this prompt fills go straight into the expense form, so the rules name
 * the mistakes that actually happen on receipts, one by one:
 *  - a line item or the tax figure taken as the total (the expensive one: the person pays
 *    attention to the amount and stops trusting every other number in the app);
 *  - a card expiry or print date taken as the purchase date;
 *  - the address, the tax id or the word "receipt" ending up as the shop name;
 *  - a value invented instead of returned as null.
 *
 * The previous version said only "extract amount, date, store" and left all of that to luck.
 */
export const RECEIPT_SYSTEM_PROMPT =
  'You extract three fields from the OCR text of one receipt or invoice and return them as JSON: ' +
  '{"amount": ..., "date": ..., "vendor": ...}. Nothing else: no explanation, no markdown.\n' +
  '\n' +
  'AMOUNT (a number, never a string with a currency):\n' +
  '- Use the FINAL TOTAL the customer paid: "TOTAL", "SUMA", "SPOLU", "CELKOM", "IMPORTE", "TOTAL A PAGAR", "GESAMT".\n' +
  '- Include tax and any service charge that is part of the total; do not add them up yourself.\n' +
  '- NEVER use: a single line item, a subtotal, "medzisúčet"/"subtotal", the tax figure alone, ' +
  'cash tendered, change given, a saving/discount line, a card number, a tax id or a phone number.\n' +
  '- Write it with a dot as the decimal separator and no thousands separator: "1.234,56" -> 1234.56, "12,50" -> 12.50.\n' +
  '- If two different totals are printed and you cannot tell which one was paid, return null. ' +
  'Never pick one at random and never estimate from typical prices.\n' +
  '\n' +
  'DATE (YYYY-MM-DD, the day the purchase happened):\n' +
  '- Use the transaction date printed on the receipt, not the print date of the document, ' +
  'not a card expiry date, not a "valid until" date and not a time-only stamp.\n' +
  '- European order is day.month.year: "12.03.2026" = 2026-03-12. If the year is missing or shown as two digits, ' +
  'use the most recent plausible year.\n' +
  '- If no purchase date is readable, return null.\n' +
  '\n' +
  'VENDOR (the shop as printed):\n' +
  '- Copy the merchant name from the header, keeping its original language and spelling. Do not translate it, ' +
  'do not replace it with a category ("Supermarket", "Food") and do not shorten it to one letter.\n' +
  '- Exclude the street address, postcode, phone number, tax id, website and the words receipt/invoice/ticket.\n' +
  '- If the header only contains a person name or an address, return null rather than guessing.\n' +
  '\n' +
  'RULES:\n' +
  '- Copy, do not correct: keep the merchant exactly as printed even if it looks misspelt.\n' +
  '- Never invent a field. A value that is not in the text is null, not a guess from the format.\n' +
  '- Ignore anything in the OCR text that is not part of this purchase (advertising, loyalty points, barcode digits).\n' +
  '- Answer with the JSON object only.';

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

    const draft = normalizeReceiptExtraction(parsed, meta);
    // The model reads the day and the month reliably and the year less so: a receipt printed
    // "05 AGO. 2026" came back as 2025-08-05. The printed text is the ground truth for the year
    // (`matchReceiptYearToText`), and this is the one place both upload paths pass through.
    draft.date = matchReceiptYearToText(draft.date, ocrText);
    return draft;
  } catch (error) {
    log.error('Receipt extraction error:', error);
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
