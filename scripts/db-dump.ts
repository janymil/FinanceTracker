#!/usr/bin/env node
/**
 * Kaptia — a real dump of the customer database, sent somewhere *else*.
 *
 * Why this exists: on 2026-10-26 the only `pg_dump` in the repository was an optional step inside
 * `scripts/legacy/deploy-prod.sh`, which nobody ran on a schedule. Neon's point-in-time restore
 * was the only copy of the customer records, and it lives inside the same provider that holds the
 * originals — so "we have backups" meant "we trust one company's retention setting".
 *
 * What it does, in order:
 *   1. `pg_dump --format=custom`, which is compressed and restorable table by table;
 *   2. `pg_restore --list` on the finished file, so a truncated or empty dump fails here rather
 *      than on the day someone needs it;
 *   3. uploads to a **separate destination** (`BACKUP_S3_*`, or `BACKUP_DIR` on another mount);
 *   4. prunes copies older than `BACKUP_RETAIN_DAYS`;
 *   5. writes a `job_runs` row, so a dump that stops happening is visible in Admin → Watch.
 *
 * Restoring is `docs/recovery-runbook.md` procedure B, and it ends with `npm run dr:verify`.
 *
 * Usage:
 *   npm run db:dump                          # dump, verify, upload, prune
 *   npm run db:dump -- --json                # one JSON line, for a wrapper
 *   npm run db:dump -- --keep-local          # leave the file in BACKUP_DIR/scratch
 *   npm run db:dump -- --no-prune            # upload only
 *
 * Exit codes: 0 = dumped and delivered; 1 = the dump or the upload failed; 2 = bad usage or
 * configuration (no source, no destination, no pg_dump binary).
 *
 * Deliberate: the connection string and the destination credentials are never printed, only the
 * host and the bucket. A backup log is the last place a password should appear.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Options {
  json: boolean;
  keepLocal: boolean;
  prune: boolean;
  sourceUrl: string;
  localDir: string;
  retainDays: number;
  pgDump: string;
  pgRestore: string;
}

export const JOB_NAME = 'db-dump';
export const DEFAULT_RETAIN_DAYS = 30;

/** `kaptia-2026-10-26T03-15-00.dump` — sortable, and no colon that a filesystem or URL hates. */
export function dumpFileName(at: Date): string {
  const stamp = at.toISOString().replace(/\.\d{3}Z$/, '').replace(/:/g, '-');
  return `kaptia-${stamp}.dump`;
}

/** Key under the destination bucket; `db/YYYY/MM/` keeps listing cheap as the months pile up. */
export function objectKey(at: Date, fileName: string): string {
  const year = at.getUTCFullYear();
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `db/${year}/${month}/${fileName}`;
}

/** Retention is per-file and inclusive: a copy exactly `retainDays` old is kept. */
export function isExpired(lastModified: Date, now: Date, retainDays: number): boolean {
  const ageMs = now.getTime() - lastModified.getTime();
  return ageMs > retainDays * 24 * 60 * 60 * 1000;
}

/** Host and database only: a connection string carries a password. */
export function describeSource(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}

/**
 * The libpq environment for a connection string.
 *
 * This used to be `{ ...process.env, PGDATABASE: options.sourceUrl }`, and `pg_dump` then
 * ignored the string and tried the *local* socket:
 *
 *     pg_dump: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed
 *
 * libpq reads `PGDATABASE` as a database name; only the `dbname` *parameter* is expanded when it
 * looks like a URI. So the job could never have dumped anything — which nobody knew, because the
 * timer was never installed and the unit tests stub the child process.
 *
 * The string is decomposed into the variables libpq does understand. It cannot go in argv:
 * `ps` shows arguments to every user on the host, and this one carries the password.
 */
export function libpqEnv(connectionString: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  delete env.PGDATABASE;
  delete env.PGHOST;
  delete env.PGPORT;
  delete env.PGUSER;
  delete env.PGPASSWORD;

  try {
    const url = new URL(connectionString);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      throw new Error('not a postgres URL');
    }
    env.PGHOST = decodeURIComponent(url.hostname);
    if (url.port) env.PGPORT = url.port;
    if (url.username) env.PGUSER = decodeURIComponent(url.username);
    if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
    const database = url.pathname.replace(/^\//, '');
    if (database) env.PGDATABASE = decodeURIComponent(database);
    // Neon requires TLS; its certificate is not verified here for the same reason the app does
    // not verify it (see server/db.ts). `sslmode` is carried through when the URL states one.
    env.PGSSLMODE = url.searchParams.get('sslmode') || 'require';
    env.PGAPPNAME = 'kaptia-db-dump';
  } catch {
    // Not a URL: hand it over as a database name and let libpq decide what it is.
    env.PGDATABASE = connectionString;
  }

  return env;
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): Options | { error: string } {
  const options: Options = {
    json: false,
    keepLocal: false,
    prune: true,
    sourceUrl: '',
    localDir: env.BACKUP_DIR ?? '',
    retainDays: Number(env.BACKUP_RETAIN_DAYS) || DEFAULT_RETAIN_DAYS,
    pgDump: env.PG_DUMP_BINARY || 'pg_dump',
    pgRestore: env.PG_RESTORE_BINARY || 'pg_restore',
  };

  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--keep-local') options.keepLocal = true;
    else if (arg === '--no-prune') options.prune = false;
    else if (arg.startsWith('--dir=')) options.localDir = arg.slice('--dir='.length);
    else if (arg.startsWith('--retain-days=')) options.retainDays = Number(arg.slice('--retain-days='.length));
    else if (arg.startsWith('--source=')) options.sourceUrl = arg.slice('--source='.length);
    else return { error: `Unknown argument: ${arg}` };
  }

  if (!Number.isFinite(options.retainDays) || options.retainDays < 1) {
    return { error: '--retain-days must be a positive number' };
  }

  if (!options.sourceUrl) {
    // DATABASE_URL_PROD first: the monitoring jobs run with NODE_ENV=production and must not
    // quietly dump a development database (see ops/kaptia-monitoring/README.md).
    options.sourceUrl = env.DATABASE_URL_PROD || env.DATABASE_URL || '';
  }
  if (!options.sourceUrl) {
    return { error: 'No source database. Set DATABASE_URL (or pass --source=postgres://…).' };
  }

  return options;
}


interface DumpResult {
  file: string;
  bytes: number;
  sha256: string;
  tableCount: number;
  deliveredTo: string;
  objectKey?: string;
  pruned: number;
  durationMs: number;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(new Error(`${command} is not installed on this host (or not on PATH)`));
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited ${code}: ${stderr.trim().slice(0, 800)}`));
    });
  });
}

async function sha256Of(file: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

/** `pg_restore --list` proves the archive has a directory: a truncated dump fails here. */
async function verifyArchive(file: string, options: Options): Promise<number> {
  const listing = await run(options.pgRestore, ['--list', file], process.env);
  return listing.split('\n').filter((line) => /\bTABLE DATA\b/.test(line)).length;
}

async function pruneLocal(dir: string, options: Options, now: Date): Promise<number> {
  let removed = 0;
  for (const entry of await fsp.readdir(dir).catch(() => [] as string[])) {
    if (!entry.startsWith('kaptia-') || !entry.endsWith('.dump')) continue;
    const stat = await fsp.stat(path.join(dir, entry)).catch(() => null);
    if (stat && isExpired(stat.mtime, now, options.retainDays)) {
      await fsp.unlink(path.join(dir, entry)).catch(() => undefined);
      removed += 1;
    }
  }
  return removed;
}

async function deliverToS3(
  file: string,
  key: string,
  bucket: string,
  endpoint: string,
  region: string,
  options: Options,
  now: Date,
): Promise<number> {
  const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = await import(
    '@aws-sdk/client-s3'
  );

  const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY ?? '',
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(file),
      ContentType: 'application/octet-stream',
      Metadata: { 'kaptia-kind': 'database-dump', sha256: await sha256Of(file) },
    }),
  );

  if (!options.prune) return 0;

  let removed = 0;
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: 'db/', ContinuationToken: token }),
    );
    for (const object of page.Contents ?? []) {
      if (!object.Key || !object.LastModified) continue;
      if (object.Key === key) continue;
      if (!isExpired(object.LastModified, now, options.retainDays)) continue;
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
      removed += 1;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return removed;
}

async function recordRun(status: 'ok' | 'failed', startedAt: Date, error?: string): Promise<void> {
  try {
    // Lazy: importing the store pulls in the database client, and this script must still be able
    // to report a usage error on a host where the app is not configured at all.
    const { recordJobRun } = await import('../server/errorGuard/store.js');
    await recordJobRun({
      jobName: JOB_NAME,
      status,
      errorCode: error ? error.slice(0, 120) : undefined,
      startedAt,
      finishedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
    });
  } catch {
    /* job_runs is the durable channel when it is reachable; a failed write must not fail the dump */
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const startedAt = new Date();
  const parsed = parseArgs(argv);
  if ('error' in parsed) {
    console.error(`[db:dump] ${parsed.error}`);
    return 2;
  }
  const options = parsed;

  const bucket = process.env.BACKUP_S3_BUCKET ?? '';
  const endpoint = process.env.BACKUP_S3_ENDPOINT ?? '';
  const region = process.env.BACKUP_S3_REGION ?? 'auto';
  const useS3 = Boolean(bucket);

  if (!useS3 && !options.localDir) {
    console.error(
      '[db:dump] No destination. Set BACKUP_S3_BUCKET (endpoint + keys) or BACKUP_DIR.\n' +
        '          A dump written next to the database it copies is not a second copy.',
    );
    return 2;
  }

  const fileName = dumpFileName(startedAt);
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'kaptia-dump-'));
  const target = path.join(workDir, fileName);

  try {
    // The connection string goes in the environment, not in argv: `ps` shows arguments to every
    // user on the host, and this one carries the database password. libpq needs it decomposed
    // into the variables it understands — see `libpqEnv`.
    const childEnv: NodeJS.ProcessEnv = libpqEnv(options.sourceUrl);

    await run(
      options.pgDump,
      ['--format=custom', '--compress=9', '--no-owner', '--no-privileges', `--file=${target}`],
      childEnv,
    );

    const stat = await fsp.stat(target);
    if (stat.size === 0) throw new Error('pg_dump produced an empty file');

    let tableCount = 0;
    try {
      tableCount = await verifyArchive(target, options);
      if (tableCount === 0) throw new Error('the archive contains no table data');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('is not installed')) {
        console.warn(
          `[db:dump] ${message}. Uploading unverified — install the PostgreSQL client and re-run ` +
            'so this step can prove the file is restorable.',
        );
      } else {
        throw error;
      }
    }

    let deliveredTo: string;
    let deliveredKey: string | undefined;
    let pruned = 0;

    if (useS3) {
      deliveredKey = objectKey(startedAt, fileName);
      pruned = await deliverToS3(
        target,
        deliveredKey,
        bucket,
        endpoint,
        region,
        options,
        startedAt,
      );
      deliveredTo = `s3://${bucket}/${deliveredKey}`;
      if (options.keepLocal && options.localDir) {
        await fsp.mkdir(options.localDir, { recursive: true });
        await fsp.copyFile(target, path.join(options.localDir, fileName));
      }
    } else {
      await fsp.mkdir(options.localDir, { recursive: true });
      deliveredTo = path.join(options.localDir, fileName);
      await fsp.copyFile(target, deliveredTo);
      pruned = options.prune ? await pruneLocal(options.localDir, options, startedAt) : 0;
    }

    const result: DumpResult = {
      file: fileName,
      bytes: stat.size,
      sha256: await sha256Of(target),
      tableCount,
      deliveredTo,
      objectKey: deliveredKey,
      pruned,
      durationMs: Date.now() - startedAt.getTime(),
    };

    await recordRun('ok', startedAt);

    if (options.json) {
      console.log(JSON.stringify({ ok: true, source: describeSource(options.sourceUrl), ...result }));
    } else {
      console.log(`[db:dump] source      ${describeSource(options.sourceUrl)}`);
      console.log(`[db:dump] dump        ${result.file} (${(result.bytes / 1024 / 1024).toFixed(1)} MB)`);
      console.log(`[db:dump] verified    ${result.tableCount} table(s) of data in the archive`);
      console.log(`[db:dump] delivered   ${result.deliveredTo}`);
      console.log(`[db:dump] retention   ${options.retainDays} days, pruned ${result.pruned}`);
      console.log(`[db:dump] sha256      ${result.sha256}`);
      console.log(`[db:dump] took        ${result.durationMs} ms`);
      console.log(
        '[db:dump] Next, prove it restores: docs/recovery-runbook.md procedure B, then `npm run dr:verify`.',
      );
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordRun('failed', startedAt, message);
    console.error(`[db:dump] FAILED: ${message}`);
    return 1;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// Only when run as a script: importing this module (the unit test) must not dump anything.
const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('[db:dump] unexpected failure:', error);
      process.exit(1);
    });
}
