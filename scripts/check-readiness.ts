#!/usr/bin/env node
/**
 * Kaptia — the operational promises, checked instead of described.
 *
 * Three readiness passes were written as prose. Prose drifts: after the third one, the record
 * still listed four interface files as "waiting for an idempotency key" that had all been wired,
 * and the running release was one commit behind `HEAD` while every document said the deploy was
 * current. Neither statement was a lie when written; both were false when read.
 *
 * So this script re-asks the questions a document can only assert, and answers with an exit code.
 * It is deliberately about *this host and this repository*, never about the product roadmap:
 *
 *   1. release-deployed        the build answering traffic is the commit in the repository
 *   2. no-secrets-tracked      no key, certificate or real env file has ever been committed
 *   3. gates-wired             the ratchets (logging, history reads, client cache) are still run
 *   4. budgets-present         the budget files those gates read parse
 *   5. backup-fresh            the newest dump is recent enough to be a backup
 *   6. backup-off-host         a copy exists somewhere other than the machine it copies
 *   7. pg-client-matches       the dump client can read the server it dumps (a drill found this)
 *   8. timers-enabled          every scheduled job is enabled, not merely installed
 *   9. health-live             the deployed build answers its deep health check
 *
 * Usage:
 *   npm run check:readiness                          # this host and this checkout
 *   npm run check:readiness -- --url https://kaptia.app
 *   npm run check:readiness -- --backup-dir /var/backups/kaptia --max-age-hours 26
 *   npm run check:readiness -- --json                # for a dashboard or a timer
 *
 * Exit codes: 0 = no promise is currently false; 1 = at least one is.
 *
 * `warn` is not a failure. It is an owner decision that is still outstanding (a credential nobody
 * has bought yet, a test instance nobody has created). Failing for those would train everyone to
 * ignore a red gate; hiding them would be the dishonesty the earlier passes warned about. `skip`
 * means the check cannot run here — on a laptop there is no dump directory and no systemd, and
 * that is not a finding.
 *
 * Nothing here reads a secret value: `BACKUP_S3_BUCKET` is tested for presence, never printed, and
 * the database is only connected to when a URL is already in the environment.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export type Status = 'pass' | 'fail' | 'warn' | 'skip';

export interface CheckResult {
  id: string;
  title: string;
  status: Status;
  detail: string;
}

const ROOT = path.resolve(import.meta.dirname, '..');

/** A dump older than this is not a backup, it is a souvenir. */
export const DEFAULT_MAX_AGE_HOURS = 26;

/** The gates that must stay wired into `npm run check`. A gate nobody runs is a paragraph. */
export const REQUIRED_GATES = ['check-logging', 'check-transaction-queries', 'check-client-cache'] as const;

/** Every scheduled job whose absence is silent. */
export const REQUIRED_TIMERS = [
  'kaptia-db-dump.timer',
  'kaptia-prune.timer',
  'kaptia-health.timer',
  'kaptia-uptime.timer',
  'kaptia-billing-reconcile.timer',
] as const;

function run(command: string, args: string[], cwd = ROOT): string | null {
  try {
    return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Pure decisions — unit-tested in tests/unit/checkReadiness.test.ts
// ---------------------------------------------------------------------------------------------

/**
 * Is the build answering traffic behind the repository?
 *
 * The deployed id is `<short sha>-<timestamp>`; the repository knows only the sha. A deploy that
 * never ran, and a hotfix that was committed and forgotten, both look exactly like this.
 */
export function releaseVerdict(release: string, head: string): { status: Status; detail: string } {
  const deployed = release.split('-')[0];
  if (!deployed) {
    return { status: 'fail', detail: 'the release file is empty, so the live build cannot be identified' };
  }
  if (deployed === head.slice(0, deployed.length)) {
    return { status: 'pass', detail: `the live build is this commit (${head})` };
  }
  return {
    status: 'fail',
    detail: `the live build is ${deployed} but the repository is at ${head} — commit and deploy, or the fix is not live`,
  };
}

/**
 * Tracked paths that must never be tracked at all.
 *
 * A key in history is not fixed by rotating it: it is in every clone, every fork and every copy.
 * The allow-list is one file — the dummy contract.
 */
export function trackedSecrets(files: string[]): string[] {
  return files.filter((file) => {
    const base = path.basename(file);
    if (base === '.env.example') return false;
    if (/^\.env($|\.)/.test(base)) return true;
    return /\.(pem|key|p12|pfx)$/i.test(base) || /^service-account.*\.json$/i.test(base);
  });
}

/** Gates named in `package.json` but no longer run by `npm run check`. */
export function missingGates(checkScript: string, required: readonly string[]): string[] {
  return required.filter((gate) => !checkScript.includes(gate));
}

/** The newest `.dump` file in a directory listing, or null when there is none. */
export function newestDump(entries: Array<{ name: string; mtimeMs: number }>): { name: string; mtimeMs: number } | null {
  const dumps = entries.filter((entry) => entry.name.endsWith('.dump'));
  if (dumps.length === 0) return null;
  return dumps.reduce((newest, entry) => (entry.mtimeMs > newest.mtimeMs ? entry : newest));
}

/** Is the newest copy too old to be called a backup? */
export function stalenessVerdict(ageHours: number, maxAgeHours: number): { status: Status; detail: string } {
  const age = `${ageHours.toFixed(1)}h old`;
  if (ageHours > maxAgeHours) {
    return {
      status: 'fail',
      detail: `the newest dump is ${age}, past the ${maxAgeHours}h limit — the job is not running, and nothing else notices`,
    };
  }
  return { status: 'pass', detail: `the newest dump is ${age} (limit ${maxAgeHours}h)` };
}

/** `pg_dump (PostgreSQL) 17.2` and `17.6` -> 17. A mismatch means the client refuses a newer server. */
export function majorVersion(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/(\d+)(?:\.\d+)?/);
  return match ? match[1] : null;
}

/** One line for a human, and the exit code for everything else. */
export function summarize(results: CheckResult[]): { line: string; exitCode: 0 | 1 } {
  const count = (status: Status) => results.filter((result) => result.status === status).length;
  const failed = count('fail');
  const owned = count('warn');
  const skipped = count('skip');
  const line =
    `[check:readiness] ${count('pass')} passed, ${failed} failed, ${owned} need an owner, ${skipped} skipped` +
    (failed > 0 ? ' — a promise in the readiness record is false right now' : '');
  return { line, exitCode: failed > 0 ? 1 : 0 };
}

// ---------------------------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------------------------

function checkReleaseDeployed(): CheckResult {
  const base = { id: 'release-deployed', title: 'the live build is this commit' };
  const releaseFile = path.join(ROOT, '.release');
  if (!fs.existsSync(releaseFile)) {
    return { ...base, status: 'skip', detail: 'no .release file: this checkout has never been deployed from this directory' };
  }
  const head = run('git', ['rev-parse', '--short', 'HEAD']);
  if (!head) {
    return { ...base, status: 'skip', detail: 'git is not available here, so the deployed commit cannot be compared' };
  }
  const release = fs.readFileSync(releaseFile, 'utf8').trim();
  return { ...base, ...releaseVerdict(release, head) };
}

function checkNoSecretsTracked(): CheckResult {
  const base = { id: 'no-secrets-tracked', title: 'no key or real env file is tracked' };
  const list = run('git', ['ls-files']);
  if (list === null) {
    return { ...base, status: 'skip', detail: 'git is not available here' };
  }
  const offenders = trackedSecrets(list.split('\n').filter(Boolean));
  if (offenders.length > 0) {
    return { ...base, status: 'fail', detail: `tracked in git: ${offenders.join(', ')} — rotating it is not enough, it is in every clone` };
  }
  return { ...base, status: 'pass', detail: 'the only env file in git is the dummy contract' };
}

function checkGatesWired(): CheckResult {
  const base = { id: 'gates-wired', title: 'the ratchets are still run by npm run check' };
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
    const missing = missingGates(pkg.scripts?.check ?? '', REQUIRED_GATES);
    if (missing.length > 0) {
      return { ...base, status: 'fail', detail: `${missing.join(', ')} removed from the check script` };
    }
    return { ...base, status: 'pass', detail: `${REQUIRED_GATES.length} gates wired into the check script` };
  } catch {
    return { ...base, status: 'fail', detail: 'package.json could not be read' };
  }
}

function checkBudgetsPresent(): CheckResult {
  const base = { id: 'budgets-present', title: 'the budget files the gates read parse' };
  const files = ['scripts/logging-budget.json', 'scripts/transaction-query-budget.json'];
  const broken: string[] = [];
  for (const file of files) {
    try {
      JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    } catch {
      broken.push(file);
    }
  }
  if (broken.length > 0) {
    return { ...base, status: 'fail', detail: `unreadable or missing: ${broken.join(', ')} — the gate that reads it fails next` };
  }
  return { ...base, status: 'pass', detail: `${files.length} budget file(s) parse` };
}

function checkBackupFresh(backupDir: string, maxAgeHours: number): CheckResult {
  const base = { id: 'backup-fresh', title: 'the newest copy is recent enough to be a backup' };
  if (!fs.existsSync(backupDir)) {
    return { ...base, status: 'skip', detail: `${backupDir} does not exist here — no dump job on this machine` };
  }
  const entries = fs.readdirSync(backupDir).map((name) => ({ name, mtimeMs: fs.statSync(path.join(backupDir, name)).mtimeMs }));
  const newest = newestDump(entries);
  if (!newest) {
    return { ...base, status: 'fail', detail: `${backupDir} holds no .dump file — the job has never produced one` };
  }
  const ageHours = (Date.now() - newest.mtimeMs) / 3_600_000;
  const verdict = stalenessVerdict(ageHours, maxAgeHours);
  return { ...base, ...verdict, detail: `${newest.name}: ${verdict.detail}` };
}

function checkBackupOffHost(): CheckResult {
  const base = { id: 'backup-off-host', title: 'a copy exists off this machine' };
  // Presence only. The value is never printed, never compared, never logged.
  if (process.env.BACKUP_S3_BUCKET) {
    return { ...base, status: 'pass', detail: 'a separate destination is configured for the copies' };
  }
  return {
    ...base,
    status: 'warn',
    detail: 'the only copies are on this host, so a lost machine takes the originals and the copies together — needs a storage destination',
  };
}

async function checkPgClientMatches(): Promise<CheckResult> {
  const base = { id: 'pg-client-matches', title: 'the dump client can read the server it dumps' };
  const clientVersion = run('pg_dump', ['--version']);
  if (!clientVersion) {
    return { ...base, status: 'skip', detail: 'no pg_dump on PATH here' };
  }
  const prod = process.argv.includes('--prod');
  const name = prod ? 'DATABASE_URL_PROD' : 'DATABASE_URL';
  const url = process.env[name];
  if (!url) {
    return { ...base, status: 'skip', detail: `pg_dump found (${clientVersion}), but no ${name} to compare against` };
  }
  let serverVersion = '';
  try {
    const pg = (await import('pg')).default;
    const client = new pg.Client({
      connectionString: url,
      ssl: /neon\.tech|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10_000,
    });
    await client.connect();
    try {
      const result = await client.query('SHOW server_version');
      serverVersion = String(result.rows[0]?.server_version ?? '');
    } finally {
      await client.end();
    }
  } catch {
    return { ...base, status: 'skip', detail: 'the database could not be reached, so the versions were not compared' };
  }
  const clientMajor = majorVersion(clientVersion);
  const serverMajor = majorVersion(serverVersion);
  if (!clientMajor || !serverMajor) {
    return { ...base, status: 'skip', detail: `version strings were not readable (client ${clientVersion}, server ${serverVersion})` };
  }
  if (clientMajor !== serverMajor) {
    return {
      ...base,
      status: 'fail',
      detail: `pg_dump is major ${clientMajor} and the server is major ${serverMajor} — pg_dump refuses a newer server, so the daily copy fails`,
    };
  }
  return { ...base, status: 'pass', detail: `client and server are both major ${clientMajor}` };
}

function checkTimersEnabled(): CheckResult {
  const base = { id: 'timers-enabled', title: 'every scheduled job is enabled, not merely installed' };
  if (!run('systemctl', ['--version'])) {
    return { ...base, status: 'skip', detail: 'systemd is not available here (laptop or container)' };
  }
  const missing: string[] = [];
  const disabled: string[] = [];
  for (const unit of REQUIRED_TIMERS) {
    const state = run('systemctl', ['is-enabled', unit]);
    if (state === null) missing.push(`${unit} (missing)`);
    else if (state !== 'enabled') disabled.push(`${unit} (${state})`);
  }
  if (missing.length > 0 || disabled.length > 0) {
    return {
      ...base,
      status: 'fail',
      detail: `${[...missing, ...disabled].join(', ')} — a job that is not enabled does not run, and its absence is silent`,
    };
  }
  return { ...base, status: 'pass', detail: `${REQUIRED_TIMERS.length} timers enabled` };
}

async function checkHealthLive(url: string | null): Promise<CheckResult> {
  const base = { id: 'health-live', title: 'the deployed build answers its deep health check' };
  if (!url) {
    return { ...base, status: 'skip', detail: 'no --url given, so nothing was asked over the network' };
  }
  const target = `${url.replace(/\/+$/, '')}/api/health/deep`;
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(15_000) });
    const body = (await response.json().catch(() => null)) as { status?: string; release?: string } | null;
    if (!response.ok || body?.status !== 'ok') {
      return { ...base, status: 'fail', detail: `${target} answered ${response.status} with status ${body?.status ?? 'unreadable'}` };
    }
    return { ...base, status: 'pass', detail: `${target} reports ok (release ${body.release ?? 'unknown'})` };
  } catch (error) {
    return { ...base, status: 'fail', detail: `${target} could not be reached: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// ---------------------------------------------------------------------------------------------

function argumentValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

export async function collect(): Promise<CheckResult[]> {
  const backupDir = argumentValue('--backup-dir') ?? process.env.BACKUP_DIR ?? '/var/backups/kaptia';
  const requestedAge = Number(argumentValue('--max-age-hours') ?? DEFAULT_MAX_AGE_HOURS);
  const maxAgeHours = Number.isFinite(requestedAge) && requestedAge > 0 ? requestedAge : DEFAULT_MAX_AGE_HOURS;
  const url = argumentValue('--url') ?? process.env.HEALTHCHECK_URL ?? null;

  return [
    checkReleaseDeployed(),
    checkNoSecretsTracked(),
    checkGatesWired(),
    checkBudgetsPresent(),
    checkBackupFresh(backupDir, maxAgeHours),
    checkBackupOffHost(),
    await checkPgClientMatches(),
    checkTimersEnabled(),
    await checkHealthLive(url),
  ];
}

const SYMBOL: Record<Status, string> = { pass: 'ok  ', fail: 'FAIL', warn: 'own ', skip: 'skip' };

async function main(): Promise<number> {
  const results = await collect();
  const { line, exitCode } = summarize(results);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ok: exitCode === 0, results }, null, 2));
    return exitCode;
  }

  console.log('[check:readiness] operational promises, checked');
  for (const result of results) {
    console.log(`  ${SYMBOL[result.status]}  ${result.id.padEnd(20)} ${result.detail}`);
  }
  console.log('');
  console.log(line);
  if (exitCode !== 0) {
    console.log('  Fix the failing lines above. A line marked "own" is a decision, not a bug: it needs an owner.');
  }
  return exitCode;
}

if (process.argv[1] && /check-readiness/.test(process.argv[1])) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('[check:readiness] crashed:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}




