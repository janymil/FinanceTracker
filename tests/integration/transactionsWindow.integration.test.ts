import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseTestUrl as testUrl, describeDb } from './dbTestEnv';

/**
 * Paging over a real Postgres.
 *
 * The interesting failures are invisible to a type check: two pages that overlap because the
 * ordering is not total, a count that disagrees with the rows, a date window that is inclusive on
 * one end and exclusive on the other. All of them show up as "a transaction is missing from the
 * list", which is the kind of bug a customer reports and nobody can reproduce.
 */
describeDb('history windows (real database)', () => {
  let storage: typeof import('../../server/storage')['storage'];
  const stamp = Date.now();
  const userId = `itest_window_${stamp}`;
  const otherId = `itest_window_other_${stamp}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl as string;
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
    ({ storage } = await import('../../server/storage'));

    for (const id of [userId, otherId]) {
      await storage.upsertUser({ id, email: `${id}@example.com`, firstName: 'Window', plan: 'standard' } as any);
    }

    // Five rows on distinct days, plus two that share the same instant: the shared instant is what
    // makes an ordering on `date` alone unstable.
    for (let day = 1; day <= 3; day += 1) {
      await storage.createTransaction({
        userId,
        amount: '10.00',
        type: 'expense',
        description: `day ${day}`,
        date: new Date(`2026-09-0${day}T12:00:00.000Z`),
      } as any);
    }
    for (const description of ['same instant a', 'same instant b']) {
      await storage.createTransaction({
        userId,
        amount: '1.00',
        type: 'expense',
        description,
        date: new Date('2026-10-15T12:00:00.000Z'),
      } as any);
    }
    // Another account's row: it must never appear in this person's pages.
    await storage.createTransaction({
      userId: otherId,
      amount: '99.00',
      type: 'expense',
      description: 'not mine',
      date: new Date('2026-10-15T12:00:00.000Z'),
    } as any);
  });

  afterAll(async () => {
    if (!storage) return;
    for (const id of [userId, otherId]) {
      try {
        await storage.deleteUserCompletely(id);
      } catch (error) {
        console.warn('[integration] cleanup failed:', error);
      }
    }
  });

  it('counts only its own rows', async () => {
    expect(await storage.countTransactionsInRange(userId)).toBe(5);
  });

  it('pages without dropping or repeating a row', async () => {
    const first = await storage.getUserTransactions(userId, { limit: 2, offset: 0 });
    const second = await storage.getUserTransactions(userId, { limit: 2, offset: 2 });
    const third = await storage.getUserTransactions(userId, { limit: 2, offset: 4 });

    const ids = [...first, ...second, ...third].map((row) => row.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it('returns the newest first, with a total order on rows sharing an instant', async () => {
    const rows = await storage.getUserTransactions(userId, { limit: 5 });
    const dates = rows.map((row) => new Date(row.date).getTime());

    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    // The two rows on the same instant come back in id order, newest id first.
    const sameInstant = rows.filter((row) => dates.filter((d) => d === new Date(row.date).getTime()).length > 1);
    expect(sameInstant.map((row) => row.id)).toEqual([...sameInstant.map((row) => row.id)].sort((a, b) => b - a));
  });

  it('filters an inclusive range', async () => {
    const rows = await storage.getUserTransactions(userId, {
      from: new Date('2026-09-01T00:00:00.000Z'),
      to: new Date('2026-09-03T23:59:59.999Z'),
    });

    expect(rows).toHaveLength(3);
    expect(await storage.countTransactionsInRange(
      userId,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-03T23:59:59.999Z'),
    )).toBe(3);
  });

  it('counts the window, not the account, when a range is given', async () => {
    const from = new Date('2026-10-01T00:00:00.000Z');
    expect(await storage.countTransactionsInRange(userId, from)).toBe(2);
  });

  it('takes a bare number as a page size, so old callers keep working', async () => {
    // The signature accepts `limit` as a number for the call sites that were written before the
    // window object existed.
    const rows = await storage.getUserTransactions(userId, 3);
    expect(rows).toHaveLength(3);
  });

  it('decrypts the description of a paged row', async () => {
    const [row] = await storage.getUserTransactions(userId, { limit: 1 });
    expect(['same instant a', 'same instant b']).toContain(row.description);
  });
});
