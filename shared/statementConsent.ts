/**
 * The statement-upload screen, versioned.
 *
 * The text on that screen describes what happens to someone's bank statement, so it is not
 * decoration: it is the thing they are agreeing to. It used to be unversioned React state, which
 * meant the app could not tell who had accepted which sentences — and when the sentences turned
 * out to be false and were corrected, every older "yes" would have silently become agreement with
 * text nobody had read.
 *
 * Bump the version whenever the promises change. A stored version that does not match this
 * constant means "ask again", which is the correct outcome after a correction.
 */
export const STATEMENT_CONSENT_VERSION = '2026-10-30';

export interface StatementConsentState {
  version?: string | null;
  acceptedAt?: Date | string | null;
}

/** True only when this person accepted the exact text that is on screen now. */
export function hasAcceptedStatementConsent(user: StatementConsentState | null | undefined): boolean {
  return Boolean(user && user.version === STATEMENT_CONSENT_VERSION);
}
