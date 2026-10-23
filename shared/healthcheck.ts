/**
 * Health-check evaluation (pure).
 *
 * `scripts/healthcheck.ts` does the HTTP call; this module decides whether the answer is
 * healthy. Keeping the decision pure means the synthetic monitor's rules are unit-tested
 * instead of living in a shell cron nobody dares to touch.
 */

export interface HealthCheckInput {
  httpStatus: number;
  body: unknown;
  latencyMs: number;
  /** Budget for the whole request; exceeding it counts as unhealthy. */
  maxLatencyMs: number;
}

export interface HealthEvaluation {
  ok: boolean;
  problems: string[];
  latencyMs: number;
  status: string | null;
}

const UNHEALTHY_STATUSES = new Set(['error', 'down', 'fail', 'failed', 'unhealthy']);

/**
 * Rules:
 * - HTTP status must be 2xx
 * - the body must be an object with a string `status`
 * - `status` must not be one of error/down/failed/unhealthy
 * - `checks` entries must not report `status: 'error'` (e.g. the database probe)
 * - latency must stay within the budget
 */
export function evaluateHealth(input: HealthCheckInput): HealthEvaluation {
  const problems: string[] = [];
  const { httpStatus, body, latencyMs, maxLatencyMs } = input;

  if (httpStatus < 200 || httpStatus >= 300) {
    problems.push(`HTTP ${httpStatus}`);
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    problems.push('response body is not an object');
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const rawStatus = payload.status;
  const status = typeof rawStatus === 'string' ? rawStatus : null;

  if (status === null) {
    problems.push('missing string field: status');
  } else if (UNHEALTHY_STATUSES.has(status.toLowerCase())) {
    problems.push(`status is "${status}"`);
  }

  const checks = payload.checks;
  if (checks && typeof checks === 'object' && !Array.isArray(checks)) {
    for (const [name, value] of Object.entries(checks as Record<string, unknown>)) {
      const checkStatus = value && typeof value === 'object'
        ? (value as Record<string, unknown>).status
        : undefined;
      if (typeof checkStatus === 'string' && UNHEALTHY_STATUSES.has(checkStatus.toLowerCase())) {
        problems.push(`check "${name}" is "${checkStatus}"`);
      }
    }
  }

  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    problems.push('invalid latency measurement');
  } else if (latencyMs > maxLatencyMs) {
    problems.push(`latency ${Math.round(latencyMs)}ms exceeds ${maxLatencyMs}ms`);
  }

  return { ok: problems.length === 0, problems, latencyMs, status };
}

/** One-line summary for cron logs / e-mail subjects. */
export function describeHealth(url: string, evaluation: HealthEvaluation): string {
  const now = new Date().toISOString();
  return evaluation.ok
    ? `OK ${url} (${Math.round(evaluation.latencyMs)}ms) at ${now}`
    : `FAIL ${url} at ${now}: ${evaluation.problems.join('; ')}`;
}
