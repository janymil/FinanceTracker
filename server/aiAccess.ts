/**
 * One gate for every AI feature.
 *
 * Two promises are enforced here, in one place, so no route can forget them:
 *   1. the account switch in Profile turns **all** AI off (OCR, voice, tips, insights…);
 *   2. the free plan never reaches an AI provider.
 *
 * Denials carry a stable `code` so the interface can show a translated message instead of
 * a raw English error.
 */
import type { NextFunction, Request, Response } from 'express';
import { storage } from './storage';
import { getUserId } from './clerkAuth';
import { rateLimit } from './middleware/rateLimit';
import {
  actionsFor,
  dayStart,
  monthStart,
  quotaState,
  weightFor,
  type QuotaState,
} from '../shared/aiQuota';
import { log } from './logger';

export type AiDenyCode = 'unauthenticated' | 'ai_disabled' | 'plan_required' | 'ai_quota_exceeded';


export interface AiAccess {
  userId: string;
  plan: string;
  aiEnabled: boolean;
  allowed: boolean;
  code?: AiDenyCode;
}

export async function checkAiAccess(userId: string | undefined | null): Promise<AiAccess | null> {
  if (!userId) {
    return { userId: '', plan: 'free', aiEnabled: false, allowed: false, code: 'unauthenticated' };
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return { userId, plan: 'free', aiEnabled: false, allowed: false, code: 'unauthenticated' };
  }

  if (user.aiEnabled === false) {
    return { userId, plan: user.plan ?? 'free', aiEnabled: false, allowed: false, code: 'ai_disabled' };
  }

  if ((user.plan ?? 'free') === 'free') {
    return { userId, plan: 'free', aiEnabled: true, allowed: false, code: 'plan_required' };
  }

  return { userId, plan: user.plan ?? 'free', aiEnabled: true, allowed: true };
}

const MESSAGES: Record<AiDenyCode, string> = {
  unauthenticated: 'Authentication required',
  ai_disabled: 'AI features are switched off for this account.',
  plan_required: 'AI features require the Standard or Premium plan.',
  ai_quota_exceeded: 'You have used all the AI actions included in this month. They reset on the 1st.',
};

export function denyAi(res: Response, code: AiDenyCode, extra?: object) {
  const status = code === 'unauthenticated' ? 401 : 403;
  return res.status(status).json({ error: MESSAGES[code], code, ...(extra ?? {}) });
}

export interface AiQuotaReport {
  state: QuotaState;
  /** Actions used per function this month, biggest first. Feed for the in-app breakdown. */
  breakdown: Array<{ functionName: string; actions: number }>;
  costThisMonth: number;
}

/**
 * One read of a person's AI allowance: what they used this month, today, and what is left.
 *
 * A failed read must never lock a paying customer out of a feature they paid for, so an error
 * is logged and treated as "no usage yet". The daily net and the monthly pool both come from
 * the same rows, so the two numbers can never disagree.
 */
export async function getAiQuota(userId: string, plan: string): Promise<AiQuotaReport> {
  const now = new Date();
  let rows: Array<{ functionName: string; calls: number; todayCalls: number; cost: number }> = [];

  try {
    rows = await storage.getAIQuotaUsage(userId, monthStart(now), dayStart(now));
  } catch (error) {
    log.error('Failed to read AI quota usage:', error);
  }

  const monthlyUsed = actionsFor(rows);
  const dailyUsed = actionsFor(rows.map((row) => ({ functionName: row.functionName, calls: row.todayCalls })));

  return {
    state: quotaState({ plan, monthlyUsed, dailyUsed, now }),
    breakdown: rows
      .map((row) => ({ functionName: row.functionName, actions: row.calls * weightFor(row.functionName) }))
      .sort((a, b) => b.actions - a.actions),
    costThisMonth: rows.reduce((total, row) => total + row.cost, 0),
  };
}


/**
 * Every AI call costs real money, so the per-person ceiling lives in the same gate as the
 * plan check: a short burst limit and a sustained hourly limit. Both are counted per user id
 * (never per IP), and can be tuned without a deploy: AI_RATE_PER_MIN, AI_RATE_PER_HOUR.
 */
const aiUserKey = (req: Request) => {
  const id = (req as any).aiUser?.id;
  return id ? `u:${id}` : null;
};

const burstLimit = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.AI_RATE_PER_MIN) || 20,
  keyPrefix: 'ai-min',
  keyFn: aiUserKey,
  code: 'ai_rate_limited',
  message: 'Too many AI requests. Please wait a moment.',
});

const sustainedLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: Number(process.env.AI_RATE_PER_HOUR) || 300,
  keyPrefix: 'ai-hour',
  keyFn: aiUserKey,
  code: 'ai_rate_limited',
  message: 'AI request limit reached for this hour. Please try again later.',
});

/**
 * Express middleware. Denied by default: unauthenticated, the account off-switch and the free
 * plan are all refused, then the request is counted against the person's AI limits.
 *
 * The monthly allowance is checked here rather than inside each AI function, so a new route
 * inherits the cap without remembering to ask for it. A blocked call is refused before the
 * rate limiter runs, which also keeps a blocked account from spending its hourly allowance.
 *
 * Requests already in flight are counted too. The allowance is spent when a call *finishes*, so a
 * page that fires six AI widgets at once passed the same check six times and could go over the
 * monthly limit by up to five calls. Two at a time is plenty for a person and impossible for a
 * script that opens requests in parallel.
 */
const MAX_CONCURRENT_AI_REQUESTS = 2;
const inFlightByUser = new Map<string, number>();

function releaseInFlight(userId: string): void {
  const current = inFlightByUser.get(userId) ?? 0;
  if (current <= 1) inFlightByUser.delete(userId);
  else inFlightByUser.set(userId, current - 1);
}

export function aiGuard() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getUserId(req as any);
    const access = await checkAiAccess(userId);
    if (!access || !access.allowed) {
      return denyAi(res, access?.code ?? 'unauthenticated');
    }

    const quota = await getAiQuota(access.userId, access.plan);
    if (quota.state.state === 'blocked') {
      return denyAi(res, 'ai_quota_exceeded', quota.state);
    }

    const inFlight = inFlightByUser.get(access.userId) ?? 0;
    if (inFlight >= MAX_CONCURRENT_AI_REQUESTS) {
      // Same shape the rate limiter answers with: this is a temporary "too many at once", not a
      // quota refusal, and the app already knows how to show it.
      return res.status(429).json({
        error: 'Too many AI requests in flight',
        message: 'Please wait for the current answer before starting another.',
        code: 'ai_rate_limited',
      });
    }

    inFlightByUser.set(access.userId, inFlight + 1);
    // Released however the response ends — success, refusal, error or a dropped connection.
    res.on('finish', () => releaseInFlight(access.userId));
    res.on('close', () => releaseInFlight(access.userId));

    (req as any).aiUser = { id: access.userId, plan: access.plan, quota: quota.state };
    return burstLimit(req, res, () => sustainedLimit(req, res, next));
  };
}
