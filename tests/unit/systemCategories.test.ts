import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A database built from `migrations/` alone had no shared categories at all.
 *
 * `categories` rows with `user_id IS NULL` are the predefined list (`storage.getCategories`
 * returns them plus the person's own). They were inserted into production by hand long before
 * this repository had migrations, so nothing recreated them. The visible result: the goals form
 * filters `type = 'goal'`, got an empty dropdown, and `POST /api/goals` refuses a goal without a
 * category — nobody could create a savings goal on a fresh database.
 *
 * These assertions keep the seed file honest if someone edits it.
 */
const SQL = readFileSync(
  resolve(process.cwd(), 'migrations/0005_seed_system_categories.sql'),
  'utf8',
);

const ROW = /\(NULL::varchar,\s*'([^']+)'::varchar,\s*'([^']+)'::varchar,\s*'(#[0-9A-Fa-f]{6})'::varchar,\s*'(income|expense|goal)'::varchar\)/g;

const rows = Array.from(SQL.matchAll(ROW)).map((match) => ({
  name: match[1],
  icon: match[2],
  color: match[3],
  type: match[4] as 'income' | 'expense' | 'goal',
}));

describe('the standard category seed', () => {
  it('is a migration that will actually run', () => {
    const journal = JSON.parse(
      readFileSync(resolve(process.cwd(), 'migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };
    expect(journal.entries.map((entry) => entry.tag)).toContain('0005_seed_system_categories');
  });

  it('creates every row it claims to', () => {
    // 16 = production's system category count on 2026-10-27 (db:verify-globals --prod).
    expect(rows.length).toBe(16);
  });

  it('seeds the goal categories, which are the ones whose absence blocks goal creation', () => {
    const goalCategories = rows.filter((row) => row.type === 'goal');
    expect(goalCategories.length).toBeGreaterThanOrEqual(5);
    expect(goalCategories.map((row) => row.name)).toContain('Emergency Fund');
  });

  it('seeds income and expense categories too', () => {
    expect(rows.filter((row) => row.type === 'expense').length).toBe(6);
    expect(rows.filter((row) => row.type === 'income').length).toBe(3);
    expect(rows.map((row) => row.name)).toContain('Food');
    expect(rows.map((row) => row.name)).toContain('Salary');
  });

  it('matches production row for row, so a rebuild equals the live database', () => {
    // Snapshot from `node scripts/db-verify-globals.mjs --prod`, 2026-10-27.
    const PRODUCTION: Array<[string, string, string]> = [
      ['Food', 'food', 'expense'],
      ['Entertainment', 'entertainment', 'expense'],
      ['Housing', 'home', 'expense'],
      ['Transportation', 'car', 'expense'],
      ['Healthcare', 'heart', 'expense'],
      ['Shopping', 'shopping-bag', 'expense'],
      ['Salary', 'salary', 'income'],
      ['Freelance', 'laptop', 'income'],
      ['Investments', 'investment', 'income'],
      ['Emergency Fund', 'shield', 'goal'],
      ['Vacation', 'plane', 'goal'],
      ['House Down Payment', 'home', 'goal'],
      ['Car Purchase', 'car', 'goal'],
      ['Debt Payoff', 'credit-card', 'goal'],
      ['Retirement', 'piggy-bank', 'goal'],
      ['Other', 'target', 'goal'],
    ];

    const actual = rows.map((row) => [row.name, row.icon, row.type]);
    expect(actual.sort()).toEqual(PRODUCTION.sort());
  });

  it('uses one name per type, so the idempotent guard cannot insert duplicates', () => {
    const seen = rows.map((row) => `${row.type}:${row.name}`);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('is safe to run twice', () => {
    expect(SQL).toContain('WHERE NOT EXISTS');
    expect(SQL).not.toMatch(/\b(TRUNCATE|DELETE)\b/i);
  });

  it('stores icons the client can render', () => {
    // Keys of `categoryIcons` in client/src/lib/icons-registry.tsx are lowercase slugs.
    for (const row of rows) {
      expect(row.icon).toMatch(/^[a-z][a-z-]*$/);
    }
  });

  it('gives every row a hex colour the UI can use', () => {
    for (const row of rows) {
      expect(row.color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
