import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { monthRange } from '../../shared/timezones';
import { databaseTestUrl as testUrl, describeDb } from './dbTestEnv';

/**
 * Core tracking against a REAL Postgres: time zones decide which month a purchase belongs to,
 * deletes tell the truth about what they removed, and the account settings really persist.
 *
 *   DATABASE_URL_TEST=postgresql://… npm run test:integration
 *
 * Skipped with a visible reason when the variable is not set. Never point it at production.
 */

describeDb('core tracking (real database)', () => {
  let storage: typeof import('../../server/storage')['storage'];
  const stamp = Date.now();
  const userId = `itest_core_${stamp}`;
  const otherId = `itest_other_${stamp}`;
  let categoryId: number;
  let lateNightId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl as string;
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
    ({ storage } = await import('../../server/storage'));

    for (const id of [userId, otherId]) {
      await storage.upsertUser({ id, email: `${id}@example.com`, firstName: 'Core', plan: 'standard' } as any);
    }
    const category = await storage.createCategory({ userId, name: 'ITest Core', icon: 'tag', color: '#00AA00', type: 'expense' });
    categoryId = category.id;

    // 22:00 on Oct 31 in Lima, 04:00 on Nov 1 in Bratislava
    const lateNight = await storage.createTransaction({
      userId, amount: '10.00', type: 'expense', description: 'late night', categoryId,
      date: new Date('2026-11-01T03:00:00.000Z'),
    } as any);
    lateNightId = lateNight.id;
    // Mid-month purchase: October everywhere
    await storage.createTransaction({
      userId, amount: '5.50', type: 'expense', description: 'mid month', categoryId,
      date: new Date('2026-10-15T15:00:00.000Z'),
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

  describe('account settings', () => {
    it('persists time zone, e-mail reminders and language', async () => {
      const updated = await storage.updateUser(userId, { timezone: 'America/Lima', emailNotifications: false, language: 'es' } as any);
      expect((updated as any).timezone).toBe('America/Lima');
      expect((updated as any).emailNotifications).toBe(false);
      expect((updated as any).language).toBe('es');
    });

    it('reads the zone back, UTC when none was chosen', async () => {
      expect(await storage.getUserTimeZone(userId)).toBe('America/Lima');
      expect(await storage.getUserTimeZone(otherId)).toBe('UTC');
      expect(await storage.getUserTimeZone('nobody')).toBe('UTC');
    });
  });

  describe('which month a purchase belongs to', () => {
    it('counts the late-night purchase in October for Lima and in November for Bratislava', async () => {
      const lima = monthRange(2026, 10, 'America/Lima');
      const bratislava = monthRange(2026, 10, 'Europe/Bratislava');
      const inLima = await storage.getUserFinancialSummary(userId, lima.start, lima.end);
      const inBratislava = await storage.getUserFinancialSummary(userId, bratislava.start, bratislava.end);
      expect(inLima.totalExpensesInCents).toBe(1550);
      expect(inBratislava.totalExpensesInCents).toBe(550);
    });

    it('applies the same rule to a budget\'s spending', async () => {
      const budget = await storage.createBudget({
        userId, categoryId, amount: '100.00', period: 'monthly',
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-31T00:00:00.000Z'),
      } as any);
      const forLima = (await storage.getUserBudgets(userId)).find((b) => b.id === budget.id);
      const forBratislava = (await storage.getUserBudgets(userId, 'Europe/Bratislava')).find((b) => b.id === budget.id);
      expect(forLima?.spent).toBe(15.5);
      expect(forLima?.remaining).toBe(84.5);
      expect(forBratislava?.spent).toBe(5.5);
    });

    it('keeps the last day of a budget in full, even for rows saved at the end of that day', async () => {
      const budget = await storage.createBudget({
        userId, categoryId, amount: '50.00', period: 'monthly',
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-31T23:59:59.999Z'),
      } as any);
      const found = (await storage.getUserBudgets(userId)).find((b) => b.id === budget.id);
      expect(found?.spent).toBe(15.5);
    });
  });

  describe('counting and deleting', () => {
    it('counts only the person\'s own transactions', async () => {
      expect(await storage.countUserTransactions(userId)).toBe(2);
      expect(await storage.countUserTransactions(otherId)).toBe(0);
    });

    it('refuses to delete someone else\'s transaction and says so', async () => {
      expect(await storage.deleteTransaction(lateNightId, otherId)).toBe(false);
      expect(await storage.countUserTransactions(userId)).toBe(2);
    });

    it('reports a real delete once and nothing the second time', async () => {
      expect(await storage.deleteTransaction(lateNightId, userId)).toBe(true);
      expect(await storage.deleteTransaction(lateNightId, userId)).toBe(false);
      expect(await storage.countUserTransactions(userId)).toBe(1);
    });

    it('does the same for budgets and goals, and never across accounts', async () => {
      const budget = await storage.createBudget({
        userId, categoryId, amount: '20.00', period: 'monthly',
        startDate: new Date('2026-12-01T00:00:00.000Z'), endDate: new Date('2026-12-31T00:00:00.000Z'),
      } as any);
      expect(await storage.deleteBudget(budget.id, otherId)).toBe(false);
      expect(await storage.deleteBudget(budget.id, userId)).toBe(true);
      expect(await storage.deleteBudget(budget.id, userId)).toBe(false);

      const goal = await storage.createGoal({
        userId, name: 'Trip', targetAmount: '500.00', currentAmount: '0.00', category: 'travel', status: 'active',
        targetDate: new Date('2027-06-01T00:00:00.000Z'),
      } as any);
      expect(await storage.deleteGoal(goal.id, otherId)).toBe(false);
      expect(await storage.deleteGoal(goal.id, userId)).toBe(true);
      expect(await storage.deleteGoal(goal.id, userId)).toBe(false);
    });
  });
});
