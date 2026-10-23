/**
 * Classification: does this failure touch money, how bad is it, and is it even ours?
 *
 * Deterministic, no AI (blueprint 07 §9.3). The result decides the badge in the admin
 * panel and whether an AI analysis is allowed to spend budget.
 */
import type { GuardEvent, GuardKind, GuardSeverity } from './types';

/** Routes where a failure can move, hide or mis-report money. */
const MONEY_ROUTE_RE =
  /(expense|income|transaction|budget|goal|receipt|invoice|pdf|export|summary|import|voice|balance|report|stripe|subscription)/i;

/** Words that mean money even if the route looks innocent. */
const MONEY_WORD_RE =
  /\b(amount|total|balance|cents?|currency|price|sum|subtotal|saldo|suma|čiastk|ciastk|zostatok|castka|částka)\b/i;

/** Never report on our own plumbing: that is how an error loop starts. */
const SELF_REPORT_RE = /^\/api\/(telemetry|admin\/watch)\b/i;

export function isSelfReport(route: string | undefined): boolean {
  return Boolean(route && SELF_REPORT_RE.test(route));
}

/**
 * `kind === 'invariant'` is always money. Otherwise the route and the message decide.
 * A caller can also force it (`moneyPath: true`) when the route name is uninformative.
 */
export function detectMoneyPath(
  event: Pick<GuardEvent, 'kind' | 'route' | 'message' | 'moneyPath'>,
): boolean {
  if (event.moneyPath === true) return true;
  if (event.kind === 'invariant') return true;
  if (event.route && MONEY_ROUTE_RE.test(event.route)) return true;
  if (event.message && MONEY_WORD_RE.test(event.message)) return true;
  return false;
}

/**
 * Severity is a function of the kind, the money flag and — for HTTP — the status.
 * `info` exists so the panel can stay quiet about things that are expected.
 */
export function assignSeverity(
  kind: GuardKind,
  moneyPath: boolean,
  status?: number,
  explicit?: GuardSeverity,
): GuardSeverity {
  if (explicit) return explicit;
  if (moneyPath) return 'critical';
  if (kind === 'job') return 'critical';
  if (kind === 'invariant') return 'critical';
  if (kind === 'swallowed') return 'error';
  if (kind === 'http') {
    if (status && status >= 500) return 'error';
    if (status && status >= 400) return 'warning';
    return 'info';
  }
  return 'error';
}

export const SEVERITY_ORDER: Record<GuardSeverity, number> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
};

/** Sort helper shared by the API and the UI so both agree on "worst first". */
export function compareSeverity(a: GuardSeverity, b: GuardSeverity): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}
