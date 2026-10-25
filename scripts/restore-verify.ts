#!/usr/bin/env node
/**
 * Kaptia — proves that a RESTORED copy of the database can actually be read.
 *
 * A restore is not finished when the rows are back; it is finished when the rows can be
 * decrypted. Every transaction description and reference note is encrypted with
 * ENCRYPTION_KEY (`server/encryption.ts`), so a perfectly correct restore made with the wrong
 * key returns all the data and none of it usable — the app renders
 * `[unreadable: encrypted with a different key]` instead of raising an error
 * (`server/encryptionDiagnostics.ts` explains why that is silent).
 *
 * This script answers three questions about a restored copy:
 *   1. are the tables there, and do they have rows;
 *   2. how old is the newest transaction — the real data-loss window of the restore;
 *   3. can the configured ENCRYPTION_KEY open the encrypted fields.
 *
 * Usage:
 *   RESTORE_DATABASE_URL=postgres://… npx tsx scripts/restore-verify.ts
 *   npx tsx scripts/restore-verify.ts --url postgres://… --sample 500
 *   npm run dr:verify -- --url postgres://…
 *
 * Exit codes:
 *   0 = readable and populated (the restore is usable)
 *   1 = a problem: empty core tables, or ciphertext this key cannot open
 *   2 = bad usage (no target, or the target is the live production database)
 *
 * Nothing is written: SELECTs only. The connection string is never printed, only its host and
 * database name, because the whole point of a restore target is that it holds a full copy.
 */
import 'dotenv/config';
import pg from 'pg';

const DEFAULT_SAMPLE = 200;

/** Core tables whose emptiness means the restore did not really restore anything. */
const CORE_TABLES = ['users', 'transactions', 'categories', 'budgets'] as const;

/** Tables that hold ENCRYPTION_KEY-protected text. */
const ENCRYPTED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: 'transactions', column: 'description' },
  { table: 'transactions', column: 'reference_note' },
  { table: 'recurring_transactions', column: 'description' },
];

interface Args {
  url?: string;
  sample: number;
  json: boolean;
}

function parseArgs(argv: string[]): Args | { error: string } {
  const args: Args = { sample: DEFAULT_SAMPLE, json: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--sample') args.sample = Number(argv[(i += 1)]);
    else if (arg.startsWith('--sample=')) args.sample = Number(arg.slice('--sample='.length));
    else if (arg === '--url') args.url = argv[(i += 1)];
    else if (arg.startsWith('--url=')) args.url = arg.slice('--url='.length);
    else return { error: `Unknown argument: ${arg}` };
  }

  if (!Number.isFinite(args.sample) || args.sample < 1) return { error: '--sample must be a positive number' };
  return args;
}

/** Host and database only — a connection string carries a password. */
function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}


async function main(): Promise<number> {
  const parsedArgs = parseArgs(process.argv.slice(2));
  if ('error' in parsedArgs) {
    console.error(`[dr:verify] ${parsedArgs.error}`);
    return 2;
  }

  const url = parsedArgs.url ?? process.env.RESTORE_DATABASE_URL;
  if (!url) {
    console.error(
      '[dr:verify] No target. Set RESTORE_DATABASE_URL or pass --url.\n' +
        '            This script is for a RESTORED COPY, never for the live database.'
    );
    return 2;
  }

  // Restoring is the one moment where pointing at production is catastrophic, so refuse it
  // even when a shell variable gets exported by mistake.
  const liveUrl = process.env.DATABASE_URL_PROD;
  if (liveUrl && url === liveUrl) {
    console.error('[dr:verify] Refusing: this is DATABASE_URL_PROD (the live database), not a restored copy.');
    return 2;
  }

  // The key decides the answer more than the restore does, so check it before connecting.
  // Without this, a missing key in development silently becomes a random throwaway key and
  // every encrypted field would look corrupt — a false alarm in the middle of an incident.
  const key = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    console.error(
      '[dr:verify] ENCRYPTION_KEY must be the 64-hex-character key that encrypted this data.\n' +
        `            Got ${key.length} characters. A different key means the restore cannot be read, ` +
        'however complete the rows are.'
    );
    return 1;
  }

  // Enable decryption explicitly: the check below is meaningless when encryption is off.
  process.env.ENCRYPTION_ENABLED = 'true';
  const { DataEncryption } = await import('../server/encryption');

  const client = new pg.Client({
    connectionString: url,
    ssl: /neon\.tech|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 30_000,
  });

  const report = {
    target: describeTarget(url),
    tables: {} as Record<string, number>,
    newestTransaction: null as string | null,
    plaintextTransactions: 0,
    sampledEncryptedValues: 0,
    unreadableValues: 0,
    problems: [] as string[],
  };

  try {
    await client.connect();

    for (const table of CORE_TABLES) {
      try {
        const result = await client.query<{ count: string }>(`select count(*)::text as count from ${table}`);
        report.tables[table] = Number(result.rows[0]?.count ?? 0);
      } catch (error) {
        report.tables[table] = -1;
        report.problems.push(`table ${table} is missing or unreadable (${(error as Error).message})`);
      }
    }

    for (const table of CORE_TABLES) {
      if (report.tables[table] === 0) report.problems.push(`table ${table} is empty`);
    }

    const newest = await client.query<{ newest: string | null }>(
      'select max(created_at)::text as newest from transactions'
    );
    report.newestTransaction = newest.rows[0]?.newest ?? null;
    if (!report.newestTransaction) report.problems.push('transactions has no rows with a creation time');

    // Legacy rows were written before encryption was switched on. They are expected, and they
    // are counted separately so a large plaintext backlog is not confused with a broken key.
    const plaintext = await client.query<{ count: string }>(
      "select count(*)::text as count from transactions where description is not null and description not like '%:%'"
    );
    report.plaintextTransactions = Number(plaintext.rows[0]?.count ?? 0);

    for (const { table, column } of ENCRYPTED_COLUMNS) {
      let rows: Array<{ value: string | null }> = [];
      try {
        const result = await client.query<{ value: string | null }>(
          `select ${column} as value
             from ${table}
            where ${column} like '%:%'
            order by id desc
            limit $1`,
          [parsedArgs.sample]
        );
        rows = result.rows;
      } catch {
        // A missing column is reported by scripts/db-schema-drift.ts, not here.
        continue;
      }

      for (const row of rows) {
        if (!row.value) continue;
        report.sampledEncryptedValues += 1;
        if (!DataEncryption.isReadable(row.value)) report.unreadableValues += 1;
      }
    }

    if (report.unreadableValues > 0) {
      report.problems.push(
        `${report.unreadableValues} of ${report.sampledEncryptedValues} sampled encrypted value(s) cannot be ` +
          'decrypted with this ENCRYPTION_KEY — the copy is fine, the key is not, or it belongs to another database'
      );
    }
  } catch (error) {
    report.problems.push(`could not read the target: ${(error as Error).message}`);
  } finally {
    await client.end().catch(() => undefined);
  }

  const ok = report.problems.length === 0;

  if (parsedArgs.json) {
    console.log(JSON.stringify({ ok, ...report }, null, 2));
  } else {
    console.log(`[dr:verify] target ${report.target}`);
    for (const [table, count] of Object.entries(report.tables)) {
      console.log(`  ${count === -1 ? 'MISSING ' : 'rows    '} ${table.padEnd(24)} ${count === -1 ? '' : count}`);
    }
    console.log(`  newest transaction          ${report.newestTransaction ?? '(none)'}`);
    console.log(`  plaintext (pre-encryption)  ${report.plaintextTransactions}`);
    console.log(`  encrypted values sampled    ${report.sampledEncryptedValues}`);
    console.log(`  unreadable                  ${report.unreadableValues}`);

    if (ok) {
      console.log('[dr:verify] PASS — the restored copy is populated and readable with this key.');
    } else {
      console.error('[dr:verify] FAIL');
      for (const problem of report.problems) console.error(`  - ${problem}`);
      console.error(
        '  Do not put a new key into production and do not delete the old copy: find the key that ' +
          'encrypted this data first (docs/recovery-runbook.md).'
      );
    }
  }

  return ok ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('[dr:verify] unexpected failure:', error);
    process.exit(1);
  });

