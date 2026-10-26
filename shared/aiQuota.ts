/**
 * The AI allowance: how many AI actions a plan includes, and how one action is counted.
 *
 * One "AI action" is one AI result a person asked for. Cheap features cost 1 action; the few
 * that call several providers or send a lot of text cost more. Customers are shown *actions* —
 * never tokens or dollars, which nobody can plan with.
 *
 * These numbers are the pricing promise (the pricing page, the FAQ and the in-app meter all
 * quote them), so they live in code with one source of truth. Per-function caps for a single
 * expensive feature still belong in `ai_usage_limits` (editable from the admin screen); this
 * file is the plan-wide pool that stops one account from burning the AI budget.
 */

export type QuotaPlan = 'free' | 'standard' | 'premium';

export interface PlanQuota {
  /** AI actions per calendar month. 0 = AI is not part of this plan. */
  monthlyActions: number;
  /** Safety net: one person cannot spend the whole month's pool in a single day. */
  dailyActions: number;
}

export const AI_QUOTAS: Record<QuotaPlan, PlanQuota> = {
  free: { monthlyActions: 0, dailyActions: 0 },
  standard: { monthlyActions: 300, dailyActions: 50 },
  premium: { monthlyActions: 1000, dailyActions: 100 },
};

/**
 * AI actions per function. Unknown names cost 1, so a new feature is metered from its first
 * call; these are the ones that cost a provider more than a single short answer.
 */
export const AI_ACTION_WEIGHTS: Record<string, number> = {
  'receipt-extraction': 3, // photo OCR: Mistral -> Google Vision -> gpt-6-luna
  parseBankStatement: 3, // a whole statement in one call
  'mascot-image': 3, // DALL·E renders one image per call
  'voice-entry': 2, // speech-to-text plus the parsing call
  tts: 1, // reading a short text aloud
};

export const DEFAULT_ACTION_WEIGHT = 1;

/** Shown in the interface as "you have used 80%" and in the admin screen as a column. */
export const QUOTA_WARNING_RATIO = 0.8;

export function weightFor(functionName: string): number {
  return AI_ACTION_WEIGHTS[functionName] ?? DEFAULT_ACTION_WEIGHT;
}

/** Calls -> actions, with the per-function weight applied. */
export function actionsFor(rows: Array<{ functionName: string; calls: number }>): number {
  return rows.reduce((total, row) => total + row.calls * weightFor(row.functionName), 0);
}

export function quotaForPlan(plan: string | null | undefined): PlanQuota {
  const key = String(plan ?? 'free').toLowerCase() as QuotaPlan;
  return AI_QUOTAS[key] ?? AI_QUOTAS.free;
}

/** First moment of the current month. Quotas reset here. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/** First moment of today, for the daily safety net. */
export function dayStart(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/** What we show the customer as "resets on": the first day of next month. */
export function nextResetAt(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

export type QuotaStateName = 'ok' | 'warning' | 'blocked';

export interface QuotaState {
  plan: QuotaPlan;
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  /** 0..1, for the progress bar. Capped at 1. */
  usedRatio: number;
  state: QuotaStateName;
  /** ISO timestamp: the day the allowance comes back. */
  resetsAt: string;
}

/**
 * Turns the counts into what the interface shows. A plan with 0 actions is `blocked` with a
 * zero limit, so the free plan can display "AI is a paid feature" without a special case.
 */
export function quotaState(input: {
  plan: string | null | undefined;
  monthlyUsed: number;
  dailyUsed: number;
  now?: Date;
}): QuotaState {
  const now = input.now ?? new Date();
  const quota = quotaForPlan(input.plan);
  const monthlyUsed = Math.max(0, Math.round(input.monthlyUsed));
  const dailyUsed = Math.max(0, Math.round(input.dailyUsed));

  const monthlyRemaining = Math.max(0, quota.monthlyActions - monthlyUsed);
  const dailyRemaining = quota.dailyActions > 0 ? Math.max(0, quota.dailyActions - dailyUsed) : 0;

  const outOfActions = quota.monthlyActions > 0 && monthlyUsed >= quota.monthlyActions;
  const outOfDay = quota.dailyActions > 0 && dailyUsed >= quota.dailyActions;
  const noAiOnPlan = quota.monthlyActions === 0;

  const usedRatio = quota.monthlyActions > 0
    ? Math.min(1, monthlyUsed / quota.monthlyActions)
    : 1;

  const state: QuotaStateName = noAiOnPlan || outOfActions || outOfDay
    ? 'blocked'
    : usedRatio >= QUOTA_WARNING_RATIO
      ? 'warning'
      : 'ok';

  return {
    plan: String(input.plan ?? 'free').toLowerCase() as QuotaPlan,
    monthlyLimit: quota.monthlyActions,
    monthlyUsed,
    monthlyRemaining,
    dailyLimit: quota.dailyActions,
    dailyUsed,
    dailyRemaining,
    usedRatio,
    state,
    resetsAt: nextResetAt(now).toISOString(),
  };
}
