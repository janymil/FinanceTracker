import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETAIN_DAYS,
  describeSource,
  dumpFileName,
  isExpired,
  main,
  objectKey,
  parseArgs,
} from '../../scripts/db-dump';

/**
 * The dump script is the only thing standing between "Neon keeps a copy" and "we hold our own
 * copy". It cannot be exercised end to end in CI (there is no database and no pg_dump binary),
 * so what is pinned here is everything that can silently be wrong without a database: the name
 * a copy gets, where it lands, when it is allowed to be deleted, and the refusal to run without
 * a destination.
 */
describe('dumpFileName', () => {
  it('is sortable and free of characters a path or a URL dislikes', () => {
    const name = dumpFileName(new Date('2026-10-26T03:15:00.000Z'));
    expect(name).toBe('kaptia-2026-10-26T03-15-00.dump');
    expect(name).not.toContain(':');
  });

  it('sorts chronologically as plain text (so "the newest copy" needs no metadata)', () => {
    const older = dumpFileName(new Date('2026-09-01T00:00:00.000Z'));
    const newer = dumpFileName(new Date('2026-10-01T00:00:00.000Z'));
    expect([newer, older].sort()).toEqual([older, newer]);
  });
});

describe('objectKey', () => {
  it('groups by year and month so a listing stays cheap', () => {
    const at = new Date('2026-03-09T01:02:03.000Z');
    expect(objectKey(at, dumpFileName(at))).toBe('db/2026/03/kaptia-2026-03-09T01-02-03.dump');
  });

  it('zero-pads the month', () => {
    const at = new Date('2026-01-05T00:00:00.000Z');
    expect(objectKey(at, 'x.dump')).toBe(`db/2026/01/x.dump`);
  });
});

describe('isExpired', () => {
  const now = new Date('2026-10-26T12:00:00.000Z');

  it('keeps a copy that is exactly at the retention limit', () => {
    const lastModified = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(isExpired(lastModified, now, 30)).toBe(false);
  });

  it('deletes once it is past the limit', () => {
    const lastModified = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000 - 1000);
    expect(isExpired(lastModified, now, 30)).toBe(true);
  });

  it('keeps a fresh copy', () => {
    expect(isExpired(new Date('2026-10-26T11:00:00.000Z'), now, 30)).toBe(false);
  });
});

describe('describeSource', () => {
  it('prints host and database, never the password', () => {
    const described = describeSource('postgres://user:s3cret@db.example.com:5432/kaptia?sslmode=require');
    expect(described).toBe('db.example.com:5432/kaptia');
    expect(described).not.toContain('s3cret');
    expect(described).not.toContain('user');
  });
});

describe('parseArgs', () => {
  it('defaults to the configured sources and 30 days of retention', () => {
    const options = parseArgs([], { DATABASE_URL: 'postgres://a:b@h:5432/d' });
    expect(options).toMatchObject({
      sourceUrl: 'postgres://a:b@h:5432/d',
      retainDays: DEFAULT_RETAIN_DAYS,
      prune: true,
      json: false,
    });
  });

  it('prefers DATABASE_URL_PROD, because the timers run as production', () => {
    const options = parseArgs([], {
      DATABASE_URL: 'postgres://a:b@dev:5432/dev',
      DATABASE_URL_PROD: 'postgres://a:b@prod:5432/live',
    });
    expect(options).toMatchObject({ sourceUrl: 'postgres://a:b@prod:5432/live' });
  });

  it('refuses to run with no source at all', () => {
    const options = parseArgs([], {});
    expect(options).toHaveProperty('error');
  });

  it('rejects an unknown flag instead of ignoring it', () => {
    const options = parseArgs(['--verbose'], { DATABASE_URL: 'postgres://h/d' });
    expect(options).toEqual({ error: 'Unknown argument: --verbose' });
  });

  it('rejects a retention window that would delete everything', () => {
    const options = parseArgs(['--retain-days=0'], { DATABASE_URL: 'postgres://h/d' });
    expect(options).toHaveProperty('error');
  });

  it('accepts flags in the order they are typed', () => {
    const options = parseArgs(['--json', '--no-prune', '--retain-days=7'], {
      DATABASE_URL: 'postgres://h/d',
    });
    expect(options).toMatchObject({ json: true, prune: false, retainDays: 7 });
  });
});

describe('main — configuration refusals', () => {
  it('exits 2 with no destination, rather than writing the copy beside the original', async () => {
    const code = await main(['--source=postgres://user:pw@host:5432/db']);
    expect(code).toBe(2);
  });

  it('exits 2 with no source', async () => {
    const previous = { ...process.env };
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_PROD;
    const code = await main([]);
    process.env = previous;
    expect(code).toBe(2);
  });
});
