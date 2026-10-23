/**
 * Synthetic health check — meant for cron/systemd, not for CI.
 *
 *   npm run healthcheck -- --url https://kaptia.app
 *   npm run healthcheck -- --url https://kaptia.app --deep --max-latency 3000 --json
 *
 * Exit code 0 = healthy, 1 = unhealthy (so cron/systemd `OnFailure=` can alert).
 * The decision logic is pure and unit-tested in `shared/healthcheck.ts`.
 */
import 'dotenv/config';
import { describeHealth, evaluateHealth } from '../shared/healthcheck';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function numberFrom(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const baseUrl = (typeof args.url === 'string' ? args.url : process.env.HEALTHCHECK_URL ?? 'http://localhost:5000')
    .replace(/\/+$/, '');
  const endpoint = args.deep === true ? '/api/health/deep' : '/api/health';
  const url = `${baseUrl}${endpoint}`;

  const maxLatencyMs = numberFrom(args['max-latency'], numberFrom(process.env.HEALTHCHECK_MAX_LATENCY_MS, 2000));
  const timeoutMs = numberFrom(args.timeout, 10_000);
  const jsonOutput = args.json === true;

  const startedAt = Date.now();
  let httpStatus = 0;
  let body: unknown = null;
  let transportError: string | null = null;

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    httpStatus = response.status;
    body = await response.json().catch(() => null);
  } catch (error) {
    transportError = error instanceof Error ? error.message : String(error);
  }

  const latencyMs = Date.now() - startedAt;

  if (transportError) {
    const message = `FAIL ${url} after ${latencyMs}ms: ${transportError}`;
    if (jsonOutput) {
      console.log(JSON.stringify({ ok: false, url, latencyMs, problems: [transportError] }));
    } else {
      console.error(message);
    }
    process.exit(1);
  }

  const evaluation = evaluateHealth({ httpStatus, body, latencyMs, maxLatencyMs });

  if (jsonOutput) {
    console.log(JSON.stringify({ url, httpStatus, ...evaluation }));
  } else if (evaluation.ok) {
    console.log(describeHealth(url, evaluation));
  } else {
    console.error(describeHealth(url, evaluation));
  }

  process.exit(evaluation.ok ? 0 : 1);
}

main().catch((error) => {
  console.error('healthcheck crashed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
