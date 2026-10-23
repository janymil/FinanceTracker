/**
 * Deterministic post-processing for Spanish spoken numbers.
 *
 * Extracted from `server/mistralTransactionParser.ts`, where a hardcoded table was used
 * both to hint the prompt and to *correct* the model's answer afterwards. The correcting
 * half is pure and belongs in tests: it fires regardless of what the model returns.
 */
export interface AmountCorrection {
  pattern: RegExp;
  expectedAmount: string;
  label: string;
}

export const SPANISH_AMOUNT_PATTERNS: AmountCorrection[] = [
  { pattern: /cinco\s+ochenta/i, expectedAmount: '5.80', label: 'cinco ochenta' },
  { pattern: /dos\s+cincuenta/i, expectedAmount: '2.50', label: 'dos cincuenta' },
  { pattern: /tres\s+veinte/i, expectedAmount: '3.20', label: 'tres veinte' },
];

/** First hardcoded pattern present in the transcript, or null. */
export function findAmountCorrection(transcript: string): AmountCorrection | null {
  return SPANISH_AMOUNT_PATTERNS.find((candidate) => candidate.pattern.test(transcript)) ?? null;
}

/**
 * Overrides the model's amount when a known spoken-number pattern is present.
 * Returns the original value (stringified) when no correction applies.
 */
export function applyAmountCorrections(
  transcript: string,
  extractedAmount: unknown,
): { amount: string; corrected: boolean; label?: string } {
  const original = String(extractedAmount ?? '');
  const correction = findAmountCorrection(transcript);

  if (!correction) return { amount: original, corrected: false };
  if (original === correction.expectedAmount) {
    return { amount: original, corrected: false, label: correction.label };
  }

  return { amount: correction.expectedAmount, corrected: true, label: correction.label };
}
