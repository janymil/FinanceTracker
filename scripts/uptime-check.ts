/**
 * External uptime check (blueprint 07 §11) — the one thing the tracker cannot do for itself.
 *
 * Run it from cron every 5 minutes; a failing check exits non-zero and, when mail is
 * configured, sends one e-mail to `ERROR_GUARD_ALERT_EMAIL`.
 *
 *   UPTIME_BASE_URL=https://kaptia.app npm run uptime:check
 *
 * Deliberate: it does not log in, does not write anything, and does not need a session.
 */
import 'dotenv/config';
import { databaseSummary } from '../server/errorGuard/store.js';
import { isEmailConfigured, sendEmail } from '../server/emailService.js';

const TIMEOUT_MS = Number(process.env.UPTIME_TIMEOUT_MS) || 10_000;

function baseUrl(): string {
  const raw = process.env.UPTIME_BASE_URL || process.env.HEALTHCHECK_URL || process.env.ERROR_GUARD_URL || '';
  if (!raw) return '';
  return raw.replace(/\/api\/health(\/deep)?\/?$/, '').replace(/\/+$/, '');
}

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* HTML is fine */
  }
  return { status: response.status, body };
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function runChecks(base: string): Promise<Check[]> {
  const checks: Check[] = [];

  try {
    const health = await getJson(`${base}/api/health/deep`);
    const payload = health.body as { status?: string; checks?: { database?: { status?: string } } };
    checks.push({
      name: 'API + database',
      ok: health.status === 200 && payload?.status === 'ok',
      detail: `${health.status} / db=${payload?.checks?.database?.status ?? 'unknown'}`,
    });
  } catch (error) {
    checks.push({
      name: 'API + database',
      ok: false,
      detail: error instanceof Error ? error.message : 'unreachable',
    });
  }

  try {
    const page = await getJson(`${base}/sk/pricing`);
    const html = typeof page.body === 'string' ? page.body : '';
    checks.push({
      name: 'Public page renders',
      ok: page.status === 200 && html.length > 500,
      detail: `${page.status} / ${html.length} bytes`,
    });
  } catch (error) {
    checks.push({
      name: 'Public page renders',
      ok: false,
      detail: error instanceof Error ? error.message : 'unreachable',
    });
  }

  return checks;
}

/** A quiet warning, never a failure: zero errors is a good day, not an outage. */
async function telemetryAgeWarning(): Promise<string | null> {
  try {
    const summary = await databaseSummary();
    if (!summary.lastEventAt) return 'no problem has ever been recorded';
    const ageHours = (Date.now() - new Date(summary.lastEventAt).getTime()) / 3_600_000;
    if (ageHours > 24) return `nothing recorded for ${Math.round(ageHours)} h`;
    return null;
  } catch {
    return 'tracker database not reachable';
  }
}

async function main(): Promise<void> {
  const base = baseUrl();
  if (!base) {
    console.error(
      '[uptime] Set UPTIME_BASE_URL (or HEALTHCHECK_URL), e.g. UPTIME_BASE_URL=https://kaptia.app',
    );
    process.exit(1);
    return;
  }

  console.log(`[uptime] checking ${base}`);
  const checks = await runChecks(base);
  for (const check of checks) {
    console.log(`${check.ok ? '  PASS' : '  FAIL'}  ${check.name} — ${check.detail}`);
  }

  const warning = await telemetryAgeWarning();
  if (warning) console.log(`  NOTE  tracker: ${warning}`);

  const failures = checks.filter((check) => !check.ok);
  if (failures.length === 0) {
    console.log('[uptime] all checks passed');
    // MUST exit explicitly: this script imports server/db.ts, whose connection pool keeps
    // the event loop alive. Without this the process would hang forever under cron and pile
    // up one idle process (and one database connection) every 5 minutes.
    process.exit(0);
    return;
  }

  const recipients = (process.env.ERROR_GUARD_ALERT_EMAIL ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (recipients.length > 0 && isEmailConfigured()) {
    await sendEmail({
      to: recipients.join(','),
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@kaptia.app',
      subject: `Kaptia is down: ${failures.map((failure) => failure.name).join(', ')}`,
      text: [
        `Checks failed against ${base}:`,
        ...failures.map((failure) => `- ${failure.name}: ${failure.detail}`),
        '',
        'This is the external monitor, so the app itself may be unable to report this.',
      ].join('\n'),
    }).catch(() => undefined);
  }

  process.exit(1);
}

void main().catch((error) => {
  console.error('[uptime] check crashed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
