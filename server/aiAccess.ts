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
 * Express middleware. Free plan and the off-switch are both denied by default; only a
 * route that is explicitly not AI-driven may pass `requirePaidPlan: false`.
 */
export function aiGuard(options: { requirePaidPlan?: boolean } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getUserId(req as any);
    const access = await checkAiAccess(userId);
    if (!access || !access.allowed) {
      return denyAi(res, access?.code ?? 'unauthenticated');
    }
    if (options.requirePaidPlan === false && access.plan === 'free') {
      (req as any).aiUser = { id: access.userId, plan: access.plan };
      return next();
    }
    (req as any).aiUser = { id: access.userId, plan: access.plan };
    return next();
  };
}
