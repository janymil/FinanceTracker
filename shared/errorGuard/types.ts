/**
 * Error Guard — shared vocabulary.
 *
 * Everything the app reports about a failure goes through these types, on the client
 * and on the server. They are deliberately narrow: a failure report is *structured
 * metadata*, never a request body, a URL with a query string, or a transaction.
 */

/** Who saw the failure. */
export type GuardSource = 'client' | 'server' | 'job';

/**
 * The kind of failure. This is what decides whether the tracker is even the right
 * tool — see blueprint 07 §17.
 */
export type GuardKind =
  /** Uncaught exception. */
  | 'exception'
  /** Unhandled promise rejection. */
  | 'rejection'
  /** A caught error that would otherwise be invisible (blueprint §17.1). */
  | 'swallowed'
  /** A 4xx/5xx the UI handled but nobody reported (blueprint §17.2). */
  | 'http'
  /** A money invariant broke without throwing (blueprint §18). */
  | 'invariant'
  /** A scheduled job failed or did not run (blueprint §17.3). */
  | 'job';

/** How much it matters. `critical` is reserved for money and total outages. */
export type GuardSeverity = 'critical' | 'error' | 'warning' | 'info';

export type GuardStatus = 'open' | 'resolved' | 'ignored';

/** Structured breadcrumb. Never free text from the DOM — labels only. */
export interface GuardBreadcrumb {
  type: 'navigation' | 'click' | 'http' | 'console' | 'custom';
  label: string;
  at?: number;
}

/** One failure, as produced by the client or the server. */
export interface GuardEvent {
  kind: GuardKind;
  message: string;
  name?: string;
  stack?: string;
  /** Route *pattern*, query string stripped, ids collapsed (`/api/expenses/:id`). */
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  requestId?: string;
  release?: string;
  source?: GuardSource;
  platform?: string;
  /** Set when the failure touches amounts, balances, budgets or exported money. */
  moneyPath?: boolean;
  severity?: GuardSeverity;
  /** Extra evidence. Values are scrubbed and depth-limited before they are sent. */
  context?: Record<string, unknown>;
  breadcrumbs?: GuardBreadcrumb[];
  /** How many identical failures this batch represents (aggregated client-side). */
  count?: number;
  occurredAt?: string;
  /**
   * Ephemeral, in-memory only: lets the server count distinct sessions per group
   * without ever learning who the user is. Must not be persisted or logged.
   */
  sessionRef?: string;
}

/** Ingest envelope. */
export interface GuardIngestPayload {
  events: GuardEvent[];
}

/** The analysis the AI produces. Validated with zod before it is stored. */
export interface GuardAnalysis {
  /** One plain sentence a non-developer can read. */
  plainSummary: string;
  /** Best guess at the cause, in plain words. */
  likelyCause: string;
  /** Where a developer should start reading code. */
  whereToLook: string;
  /** What the user actually experiences. */
  userImpact: string;
  moneyRisk: 'none' | 'possible' | 'likely';
  severity: GuardSeverity;
  confidence: number;
  suggestedFix: string;
}

export type GuardAIStatus = 'pending' | 'done' | 'skipped' | 'failed';

/** A group of identical failures (the only thing an admin ever looks at). */
export interface GuardGroup {
  id: string;
  kind: GuardKind;
  source: GuardSource;
  title: string;
  message: string;
  route: string | null;
  release: string | null;
  severity: GuardSeverity;
  status: GuardStatus;
  moneyPath: boolean;
  eventCount: number;
  sessionCount: number;
  firstSeen: string;
  lastSeen: string;
  aiStatus: GuardAIStatus;
  aiAnalysis: GuardAnalysis | null;
  aiModel: string | null;
  aiUpdatedAt: string | null;
}

/** Runtime health of the reporter itself — the honesty footer on the screen. */
export interface GuardHealth {
  bufferedGroups: number;
  lastFlushAt: string | null;
  lastError: string | null;
  writePathOpen: boolean;
}

export interface GuardSummary {
  openProblems: number;
  needAttentionNow: number;
  moneyProblems: number;
  eventsLast24h: number;
  eventsTotal: number;
  lastEventAt: string | null;
  /** Guard self-monitoring: what *this* process accepted and dropped. */
  accepted: number;
  dropped: number;
  flushFailures: number;
  aiCallsToday: number;
  aiCallsBudget: number;
  aiEnabled: boolean;
  /** Present in the API response; optional so the type stays usable without it. */
  health?: GuardHealth;
}

export interface GuardJobRun {
  jobName: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'ok' | 'failed' | 'running';
  errorCode: string | null;
  durationMs: number | null;
  /** True when the job has not reported for longer than its expected interval. */
  stale: boolean;
}

/** Plain-language label for a severity. The admin UI never shows the raw value. */
export function severityLabel(severity: GuardSeverity): string {
  switch (severity) {
    case 'critical':
      return 'Needs attention now';
    case 'error':
      return 'Worth fixing';
    case 'warning':
      return 'Minor';
    default:
      return 'For information';
  }
}

/** Plain-language label for a failure kind. */
export function kindLabel(kind: GuardKind): string {
  switch (kind) {
    case 'exception':
      return 'Crash';
    case 'rejection':
      return 'Failed in the background';
    case 'swallowed':
      return 'Failed silently';
    case 'http':
      return 'Request failed';
    case 'invariant':
      return 'Wrong numbers detected';
    case 'job':
      return 'Scheduled job failed';
    default:
      return 'Problem';
  }
}
