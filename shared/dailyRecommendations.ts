/**
 * Why "Daily recommendations" can be empty, and how the UI should explain it.
 *
 * The screen used to say "Add at least 3 transactions" even when the customer had plenty —
 * the AI simply returned nothing that day. Those are two different situations and deserve
 * two different sentences, so the server names the reason.
 */
export type EmptyReason = 'not_enough_data' | 'no_suggestions' | null;

export interface RecommendationsPayload {
  recommendations?: unknown[];
  insights?: unknown[];
  reason?: EmptyReason;
  [key: string]: unknown;
}

export interface RecommendationsInput {
  transactionCount: number;
  totalIncome?: number;
  totalExpenses?: number;
}

const MIN_TRANSACTIONS = 3;

export function annotateEmptyReason<T extends RecommendationsPayload>(
  result: T | null | undefined,
  input: RecommendationsInput,
): T & { recommendations: unknown[]; insights: unknown[]; reason: EmptyReason } {
  const base = (result ?? {}) as T;
  const recommendations = Array.isArray(base.recommendations) ? base.recommendations : [];
  const insights = Array.isArray(base.insights) ? base.insights : [];

  if (recommendations.length > 0 || insights.length > 0) {
    return { ...base, recommendations, insights, reason: null };
  }

  const hasMoney = Number(input.totalIncome ?? 0) > 0 || Number(input.totalExpenses ?? 0) > 0;
  const reason: EmptyReason =
    input.transactionCount >= MIN_TRANSACTIONS && hasMoney ? 'no_suggestions' : 'not_enough_data';

  return { ...base, recommendations, insights, reason };
}
