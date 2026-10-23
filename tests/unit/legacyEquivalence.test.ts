import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  groupTransactionsByMonth,
  sumAmountsByCategoryName,
  sumTransactionAmountsByTypeInCents,
  type TransactionLike,
} from '../../shared/calculations';

/**
 * Module 9: proof that step 2's rewiring did NOT change the numbers.
 *
 * The old client code did `reduce((sum, t) => sum + parseFloat(t.amount), 0)` inline in
 * ~40 components. This file reimplements that behaviour literally and compares it to the
 * new cent-exact helpers over the same golden fixture. If someone changes an aggregation
 * later, this test is the one that says "the displayed total moved".
 */

const fixture: { transactions: TransactionLike[] } = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../fixtures/transactions-march-2026.sk.json', import.meta.url)),
    'utf8',
  ),
);

const rows = fixture.transactions;

/* ---------- the OLD implementation, kept verbatim in spirit ---------- */

const legacyTotal = (transactions: TransactionLike[]): number =>
  transactions.reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);

const legacyByType = (transactions: TransactionLike[], type: string): number =>
  transactions
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + parseFloat(String(t.amount)), 0);

const legacyByMonth = (transactions: TransactionLike[]): Record<string, number> =>
  transactions.reduce((acc: Record<string, number>, t) => {
    const date = new Date(t.date as string);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    acc[monthKey] = (acc[monthKey] ?? 0) + parseFloat(String(t.amount));
    return acc;
  }, {});

const legacyByCategory = (transactions: TransactionLike[]): Record<string, number> =>
  transactions.reduce((acc: Record<string, number>, t) => {
    const category = t.categoryName || 'Uncategorized';
    acc[category] = (acc[category] ?? 0) + parseFloat(String(t.amount));
    return acc;
  }, {});

/* ---------- the NEW implementation, as wired in step 2 ---------- */

const newTotal = (transactions: TransactionLike[]): number =>
  sumTransactionAmountsByTypeInCents(transactions, 'expense') / 100
  + sumTransactionAmountsByTypeInCents(transactions, 'income') / 100;

const newByCategory = (transactions: TransactionLike[]): Record<string, number> =>
  Object.fromEntries(
    sumAmountsByCategoryName(transactions).map((row) => [row.name, row.amount]),
  );

const newByMonth = (transactions: TransactionLike[]): Record<string, number> =>
  Object.fromEntries(
    groupTransactionsByMonth(transactions).map((bucket) => [
      bucket.monthKey,
      bucket.income + bucket.expenses,
    ]),
  );

describe('old parseFloat reducers vs new cent-exact helpers', () => {
  it('produce the same total on the golden dataset', () => {
    expect(newTotal(rows)).toBeCloseTo(legacyTotal(rows), 10);
    expect(newTotal(rows)).toBe(5341.07);
  });

  it('produce the same per-type totals', () => {
    expect(sumTransactionAmountsByTypeInCents(rows, 'expense') / 100).toBeCloseTo(
      legacyByType(rows, 'expense'),
      10,
    );
    expect(sumTransactionAmountsByTypeInCents(rows, 'income') / 100).toBeCloseTo(
      legacyByType(rows, 'income'),
      10,
    );
  });

  it('produce the same monthly buckets', () => {
    const legacy = legacyByMonth(rows);
    const current = newByMonth(rows);

    expect(Object.keys(current).sort()).toEqual(Object.keys(legacy).sort());
    for (const month of Object.keys(legacy)) {
      expect(current[month]).toBeCloseTo(legacy[month], 10);
    }
  });

  it('produce the same category totals', () => {
    const legacy = legacyByCategory(rows);
    const current = newByCategory(rows);

    expect(Object.keys(current).sort()).toEqual(Object.keys(legacy).sort());
    for (const category of Object.keys(legacy)) {
      expect(current[category]).toBeCloseTo(legacy[category], 10);
    }
  });

  it('differ exactly where the old code was broken: binary float drift', () => {
    // Three rows of 0.10 EUR: parseFloat gives 0.30000000000000004.
    const drift = [
      { amount: '0.10', type: 'expense', date: '2026-03-01T10:00:00', categoryName: 'A' },
      { amount: '0.20', type: 'expense', date: '2026-03-01T10:00:00', categoryName: 'A' },
    ] as TransactionLike[];

    const legacy = legacyTotal(drift);
    const current = sumTransactionAmountsByTypeInCents(drift, 'expense');

    expect(legacy).not.toBe(0.3);            // 0.30000000000000004
    expect(current).toBe(30);                // exact cents
    expect(current / 100).toBe(0.3);
  });
});
