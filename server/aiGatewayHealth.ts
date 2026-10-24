/**
 * Health of the AI side, for /api/health/deep.
 *
 * The gateway being down is NOT an outage: calls fall back to the providers directly. So it is
 * reported as `degraded`, never as an error, and it does not fail the overall check. The
 * answer is cached for a short time because the endpoint is public and must not become a way to
 * make this server hammer the gateway.
 */
export type AiHealthStatus = 'ok' | 'degraded' | 'disabled';

const CACHE_MS = 30_000;
// Under the synthetic check's 2s latency budget, so a slow gateway reads "degraded" instead of
// making the whole deep check look slow.
const TIMEOUT_MS = 1_200;

let cached: { status: AiHealthStatus; at: number } | null = null;

/** Test helper. */
export function resetAiGatewayHealthCache(): void {
  cached = null;
}

export async function checkAiGateway(now: number = Date.now()): Promise<AiHealthStatus> {
  if (process.env.AI_PROCESSOR_ENABLED !== 'true') return 'disabled';
  const url = String(process.env.AI_PROCESSOR_URL || '').replace(/\/+$/, '');
  if (!url || !process.env.AI_PROCESSOR_API_KEY) return 'degraded';

  if (cached && now - cached.at < CACHE_MS) return cached.status;

  let status: AiHealthStatus = 'degraded';
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.ok) {
      const body: any = await response.json().catch(() => null);
      // A gateway that is up but has no key configured refuses every request: that is degraded.
      status = body?.status === 'ok' && body?.authConfigured !== false ? 'ok' : 'degraded';
    }
  } catch {
    status = 'degraded';
  }

  cached = { status, at: now };
  return status;
}
