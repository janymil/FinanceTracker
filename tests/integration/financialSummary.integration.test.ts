import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseTestUrl as testUrl, describeDb } from './dbTestEnv';

/**
 * Integration module: `getUserFinancialSummary` against a REAL Postgres.
 *
 * Requires a Neon **branch** (never production):
 *   DATABASE_URL_TEST=postgresql://… npm run test:integration
 *
 * Without the variable the suite is skipped with a visible reason — not silently green.
 * The env is set BEFORE `server/storage` is imported, because `server/db.ts` reads
 * DATABASE_URL at module load.
 */

describeDb('getUserFinancialSummary (real database)', () => {
  let storage: typeof import('../../server/storage')['storage'];
  const userId = `itest_${Date.now()}`;
  let categoryId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl as string;
    process.env.NODE_ENV = 'test';
    // Deterministic key so description encryption works on a bare test database.
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);

    ({ storage } = await import('../../server/storage'));

    await storage.upsertUser({
      id: userId,
      email: `${userId}@example.com`,
      firstName: 'Integration',
      lastName: 'Test',
      plan: 'standard',
    } as any);

    const category = await storage.createCategory({
      userId,
      name: 'ITest Food',
      icon: 'utensils',
      color: '#FF0000',
      type: 'expense',
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    if (!storage) return;
    try {
      await storage.deleteUserCompletely(userId);
    } catch (error) {
      console.warn('[integration] cleanup failed:', error);
    }
  });

  it('sums cent-exactly, including values that drift in binary float', async () => {
    for (const amount of ['0.10', '0.20', '100.50']) {
      await storage.createTransaction({
        userId,
        categoryId,
        amount,
        description: `ITest row ${amount}`,
        date: new Date('2026-03-02T10:00:00Z'),
        type: 'expense',
      } as any);
    }

    const summary = await storage.getUserFinancialSummary(
      userId,
      new Date('2026-03-01T00:00:00Z'),
      new Date('2026-03-31T23:59:59Z'),
    );

    expect(summary.totalExpensesInCents).toBe(10080); // 0.10 + 0.20 + 100.50
    expect(summary.totalIncomeInCents).toBe(0);
    expect(summary.netBalanceInCents).toBe(-10080);
    expect(summary.transactionsByCategory).toHaveLength(1);
    expect(summary.transactionsByCategory[0]).toMatchObject({
      categoryName: 'ITest Food',
      amountInCents: 10080,
      type: 'expense',
    });
  });

  it('excludes rows outside the requested range', async () => {
    const summary = await storage.getUserFinancialSummary(
      userId,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T23:59:59Z'),
    );

    expect(summary.totalExpensesInCents).toBe(0);
    expect(summary.transactionsByCategory).toEqual([]);
  });

  it('decrypts descriptions back on read', async () => {
    const rows = await storage.getUserTransactions(userId);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.description.startsWith('ITest row '))).toBe(true);
  });
});
