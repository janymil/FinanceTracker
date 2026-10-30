/**
 * Whether we still owe someone the AI question.
 *
 * `ai_enabled` alone cannot answer that: `true` means "chose to keep it on" *and* "was never
 * asked, and the old default said yes". `ai_consent_decided_at` is the only thing that tells
 * the two apart, so `null` — not `false` — is what means "ask".
 *
 * The answer is written by the server with its own clock (see `PUT /api/auth/user`); a
 * timestamp a browser could set would be evidence of nothing.
 */
export interface AiConsentState {
  aiEnabled?: boolean | null;
  aiConsentDecidedAt?: Date | string | null;
}

export function needsAiConsent(user: AiConsentState | null | undefined): boolean {
  // No row (signed out, or still loading): there is nobody to ask, and a dialog that renders
  // before the account is known is a dialog that flashes at strangers.
  if (!user) return false;
  return user.aiConsentDecidedAt == null;
}
