import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_AGE_HOURS,
  REQUIRED_GATES,
  majorVersion,
  missingGates,
  newestDump,
  releaseVerdict,
  stalenessVerdict,
  summarize,
  trackedSecrets,
  type CheckResult,
} from '../../scripts/check-readiness';

/**
 * The readiness gate exists because three prose passes drifted from the code: a record still listed
 * work that was finished, and the live release was a commit behind the repository while every
 * document said otherwise. The checks that need a host cannot run here, so what is pinned is the
 * part that decides: which comparison makes a claim false, which ones are only an owner decision,
 * and which one must never be reported as a pass.
 */

const base = { id: 'x', title: 'x' };

describe('releaseVerdict', () => {
  it('passes when the live build is the commit in the repository', () => {
    // The deployed id carries a timestamp after the sha; the repository knows only the sha.
    expect(releaseVerdict('27267e38-20261026-210338', '27267e38').status).toBe('pass');
  });

  it('fails when a commit was made and never deployed', () => {
    // This was the real state of the host: 3bc6a036 serving while HEAD moved to 27267e38.
    const verdict = releaseVerdict('3bc6a036-20261026-210338', '27267e38');

    expect(verdict.status).toBe('fail');
    expect(verdict.detail).toContain('27267e38');
    expect(verdict.detail).toContain('not live');
  });

  it('fails on an empty release file instead of assuming the build is fine', () => {
    expect(releaseVerdict('', '27267e38').status).toBe('fail');
  });

  it('compares only as many characters as the release actually has', () => {
    // A short sha in .release must not be compared against the whole HEAD sha.
    expect(releaseVerdict('27267e', '27267e38').status).toBe('pass');
  });
});

describe('trackedSecrets', () => {
  it('finds a real env file but not the dummy contract', () => {
    expect(trackedSecrets(['.env.example'])).toEqual([]);
    expect(trackedSecrets(['.env'])).toEqual(['.env']);
    expect(trackedSecrets(['.env.production', 'server/.env.test'])).toHaveLength(2);
  });

  it('finds keys and certificates, including in a subdirectory', () => {
    const found = trackedSecrets(['ops/tls/server.pem', 'a/b/private.key', 'certs/x.p12', 'service-account.json']);

    expect(found).toHaveLength(4);
  });

  it('does not flag files that merely mention env in the name', () => {
    expect(trackedSecrets(['docs/environment.md', 'shared/env.ts', '.envrc.example'])).toEqual([]);
  });
});

describe('missingGates', () => {
  it('is quiet when every ratchet is still wired into the check script', () => {
    const script = 'tsc && tsx scripts/check-logging.ts && tsx scripts/check-transaction-queries.ts && tsx scripts/check-client-cache.ts';

    expect(missingGates(script, REQUIRED_GATES)).toEqual([]);
  });

  it('names a gate that was dropped from the check script', () => {
    // A gate nobody runs is a paragraph: this is the failure the check exists to catch.
    const script = 'tsc && tsx scripts/check-logging.ts';

    expect(missingGates(script, REQUIRED_GATES)).toEqual(['check-transaction-queries', 'check-client-cache']);
  });
});

describe('newestDump', () => {
  it('returns the most recent archive, not the first in the listing', () => {
    const newest = newestDump([
      { name: 'kaptia-old.dump', mtimeMs: 1_000 },
      { name: 'kaptia-new.dump', mtimeMs: 9_000 },
    ]);

    expect(newest?.name).toBe('kaptia-new.dump');
  });

  it('ignores files that are not archives', () => {
    expect(newestDump([{ name: 'notes.txt', mtimeMs: 9_000 }])).toBeNull();
  });
});

describe('stalenessVerdict', () => {
  it('accepts a copy from the last run', () => {
    expect(stalenessVerdict(23, DEFAULT_MAX_AGE_HOURS).status).toBe('pass');
  });

  it('fails a copy older than the limit, because a stopped job is silent otherwise', () => {
    const verdict = stalenessVerdict(30, DEFAULT_MAX_AGE_HOURS);

    expect(verdict.status).toBe('fail');
    expect(verdict.detail).toContain('30.0h');
  });

  it('treats exactly the limit as still current', () => {
    expect(stalenessVerdict(DEFAULT_MAX_AGE_HOURS, DEFAULT_MAX_AGE_HOURS).status).toBe('pass');
  });
});

describe('majorVersion', () => {
  it('reads both sides of the comparison that broke a drill', () => {
    // pg_dump 16 against PostgreSQL 17 refuses to run; the client must match the server.
    expect(majorVersion('pg_dump (PostgreSQL) 17.2')).toBe('17');
    expect(majorVersion('17.6')).toBe('17');
    expect(majorVersion('pg_dump (PostgreSQL) 16.10')).not.toBe('17');
  });

  it('returns null when there is nothing to read', () => {
    expect(majorVersion(null)).toBeNull();
    expect(majorVersion('unknown')).toBeNull();
  });
});

describe('summarize', () => {
  const results = (...statuses: Array<CheckResult['status']>): CheckResult[] =>
    statuses.map((status, index) => ({ ...base, id: `check-${index}`, status, detail: '' }));

  it('exits zero when the only outstanding items are owner decisions', () => {
    const { exitCode, line } = summarize(results('pass', 'warn', 'skip'));

    expect(exitCode).toBe(0);
    expect(line).toContain('1 need an owner');
    expect(line).not.toContain('false right now');
  });

  it('exits one when a promise is false, and says so', () => {
    const { exitCode, line } = summarize(results('pass', 'fail'));

    expect(exitCode).toBe(1);
    expect(line).toContain('a promise in the readiness record is false right now');
  });

  it('exits zero on an empty result set rather than inventing a failure', () => {
    expect(summarize([]).exitCode).toBe(0);
  });
});
