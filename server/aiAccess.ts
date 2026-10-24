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

export type AiDenyCode = 'unauthenticated' | 'ai_disabled' | 'plan_required';

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
};

export function denyAi(res: Response, code: AiDenyCode) {
  const status = code === 'unauthenticated' ? 401 : 403;
  return res.status(status).json({ error: MESSAGES[code], code });
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
 */
export function aiGuard() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getUserId(req as any);
    const access = await checkAiAccess(userId);
    if (!access || !access.allowed) {
      return denyAi(res, access?.code ?? 'unauthenticated');
    }
    (req as any).aiUser = { id: access.userId, plan: access.plan };
    return burstLimit(req, res, () => sustainedLimit(req, res, next));
  };
}
