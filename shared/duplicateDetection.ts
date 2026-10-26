/**
 * Duplicate detection for bank-statement imports (PURE).
 *
 * Extracted from `lib/pdfProcessor.ts`, where it sat between OCR and AI code and could not
 * be imported by a test without pulling pdf-parse/tesseract/pdf2pic. The logic is
 * unchanged, including the 0.7 threshold and the 3-day / 1 % tolerances.
 *
 * Why it matters for money: a duplicate import silently doubles expenses. This is the only
 * thing preventing that, so it belongs under test.
 */

export interface MatchableTransaction {
  date: string;
  description: string;
  amount: number;
  type: string;
}

export interface DuplicateMatch<TExtracted extends MatchableTransaction, TExisting extends MatchableTransaction> {
  extractedTransaction: TExtracted;
  existingTransactions: TExisting[];
  /** Highest similarity found for this row (0-1). */
  similarityScore: number;
  matchReasons: string[];
}

export const DUPLICATE_THRESHOLD = 0.7;
const AMOUNT_EPSILON = 0.01;
const DATE_TOLERANCE_DAYS = 3;

/** Levenshtein distance, iterative two-row version (same result as the matrix one). */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,          // deletion
        previous[j] + 1,             // insertion
        previous[j - 1] + substitutionCost, // substitution
      );
    }
    previous = [...current];
  }

  return previous[b.length];
}

/** 1 for identical strings, decreasing with edit distance. */
export function calculateDescriptionSimilarity(a: string, b: string): number {
  const left = (a ?? '').toLowerCase().trim();
  const right = (b ?? '').toLowerCase().trim();

  if (left === right) return 1;

  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) return 1;

  return 1 - levenshteinDistance(left, right) / maxLength;
}

/** Exact day = 1, within 3 days = 0.5, otherwise 0. */
export function calculateDateSimilarity(date1: string, date2: string): number {
  const first = new Date(date1);
  const second = new Date(date2);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return 0;

  if (first.toDateString() === second.toDateString()) return 1;

  const diffDays = Math.abs((first.getTime() - second.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= DATE_TOLERANCE_DAYS ? 0.5 : 0;
}

/** Exact (<1 cent) = 1, within 1 % = 0.8, within 5 % = 0.5, otherwise 0. */
export function calculateAmountSimilarity(amount1: number, amount2: number): number {
  const diff = Math.abs(amount1 - amount2);
  if (diff < AMOUNT_EPSILON) return 1;

  const denominator = Math.max(Math.abs(amount1), Math.abs(amount2));
  if (denominator === 0) return 0;

  const percentDiff = diff / denominator;
  if (percentDiff <= 0.01) return 0.8;
  if (percentDiff <= 0.05) return 0.5;
  return 0;
}

/** Weighted score: date 40 %, amount 35 %, description 20 %, type 5 %. */
export function calculateTransactionSimilarity(
  extracted: MatchableTransaction,
  existing: MatchableTransaction,
): number {
  const score =
    calculateDateSimilarity(extracted.date, existing.date) * 0.4 +
    calculateAmountSimilarity(extracted.amount, existing.amount) * 0.35 +
    calculateDescriptionSimilarity(extracted.description, existing.description) * 0.2 +
    (extracted.type === existing.type ? 1 : 0) * 0.05;

  return score;
}

/**
 * Rows whose best match scores >= 0.7 are reported with the matching existing rows and the
 * reasons. Nothing is dropped here — the user confirms in the UI.
 *
 * Candidates are narrowed before scoring. The old version compared every extracted row with every
 * stored row, and each comparison ran a Levenshtein distance: a 500-row statement against two
 * years of history was ~1.8 million string comparisons on the request thread, which is what made
 * the preview freeze for everyone else while it ran. Only rows within the 5 % amount tolerance and
 * the 3-day window can reach the 0.7 threshold anyway, so everything else is skipped without
 * touching the strings.
 */
export function detectDuplicateTransactions<
  TExtracted extends MatchableTransaction,
  TExisting extends MatchableTransaction,
>(
  extractedTransactions: TExtracted[],
  existingTransactions: TExisting[],
): Array<DuplicateMatch<TExtracted, TExisting>> {
  const duplicates: Array<DuplicateMatch<TExtracted, TExisting>> = [];

  // Bucket by whole currency unit: a 5 % tolerance never crosses more than a few buckets, and a
  // lookup is O(1) instead of a scan.
  const buckets = new Map<number, TExisting[]>();
  for (const existing of existingTransactions) {
    const bucket = Math.round(Math.abs(Number(existing.amount) || 0));
    const list = buckets.get(bucket);
    if (list) list.push(existing);
    else buckets.set(bucket, [existing]);
  }

  const candidateWindow = (amount: number): TExisting[] => {
    const magnitude = Math.abs(Number(amount) || 0);
    const centre = Math.round(magnitude);
    // 5 % of the amount, at least one unit: a 100.00 row looks in 95…105.
    const span = Math.max(1, Math.ceil(magnitude * 0.05));
    const candidates: TExisting[] = [];
    for (let bucket = centre - span; bucket <= centre + span; bucket += 1) {
      const list = buckets.get(bucket);
      if (list) candidates.push(...list);
    }
    return candidates;
  };

  for (const extracted of extractedTransactions) {
    const matches: TExisting[] = [];
    const matchReasons: string[] = [];
    let highestSimilarity = 0;

    const pool = existingTransactions.length <= 50 ? existingTransactions : candidateWindow(extracted.amount);

    for (const existing of pool) {
      // Date is 40 % of the score: outside the tolerance the row cannot reach 0.7, so skip the
      // expensive string comparison.
      if (calculateDateSimilarity(extracted.date, existing.date) === 0) continue;

      const similarity = calculateTransactionSimilarity(extracted, existing);
      if (similarity < DUPLICATE_THRESHOLD) continue;

      matches.push(existing);
      highestSimilarity = Math.max(highestSimilarity, similarity);

      if (extracted.date === existing.date) matchReasons.push('Exact date match');
      if (Math.abs(extracted.amount - existing.amount) < AMOUNT_EPSILON) matchReasons.push('Exact amount match');
      if (calculateDescriptionSimilarity(extracted.description, existing.description) > 0.8) {
        matchReasons.push('Very similar description');
      }
    }

    if (matches.length > 0) {
      duplicates.push({
        extractedTransaction: extracted,
        existingTransactions: matches,
        similarityScore: highestSimilarity,
        matchReasons: Array.from(new Set(matchReasons)),
      });
    }
  }

  return duplicates;
}
