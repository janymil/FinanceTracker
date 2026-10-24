import { useAuth } from "./useAuth";

export type AiBlockReason = 'ai_disabled' | 'plan_required' | null;

/**
 * Mirrors the server's aiAccess gate so the interface can hide (rather than fail) AI
 * features for free accounts and for accounts that switched AI off.
 *
 * The server remains the authority — this only avoids showing buttons that would 403.
 */
export function useAiAccess() {
  const { user } = useAuth();
  const plan = (user?.plan ?? 'free') as string;
  const aiEnabled = (user as any)?.aiEnabled !== false;
  const hasPaidPlan = plan === 'standard' || plan === 'premium';

  const reason: AiBlockReason = !aiEnabled ? 'ai_disabled' : !hasPaidPlan ? 'plan_required' : null;

  return {
    plan,
    aiEnabled,
    hasPaidPlan,
    allowed: reason === null,
    reason,
  };
}
