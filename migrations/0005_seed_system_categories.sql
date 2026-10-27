-- Kaptia — the standard categories every account starts with.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- Rows in `categories` with `user_id IS NULL` are the shared, predefined list:
-- `storage.getCategories` returns those plus the person's own. They were inserted into the
-- production database by hand long before this repository had migrations, so a database built
-- from `migrations/` alone came up with none of them, and three flows broke at once:
--
--   * the goals form filters `type = 'goal'` and got an empty dropdown, while
--     `POST /api/goals` refuses a goal without a category (400 "A category is required"),
--     so nobody could create a savings goal;
--   * the expense and income pickers had nothing to choose;
--   * `GET /api/categories` returned an empty list, so auto-categorisation had no targets.
--
-- WHAT THESE ROWS ARE
-- -------------------
-- An exact copy of production's system categories as printed by
-- `node scripts/db-verify-globals.mjs --prod` on 2026-10-27: 16 rows — 6 expense, 3 income and
-- 7 goal — with the same names, icons and colours the live database already has. Mirroring
-- production rather than inventing a nicer list is deliberate: a rebuilt database has to *be*
-- production, or "disaster recovery works" is only a claim. The consequence is that applying
-- this file to production inserts nothing, which is what a healthy database should see.
--
-- IDEMPOTENT ON PURPOSE: `scripts/seed-system-categories.mjs` runs this same file against a
-- database that already has some of the rows, and the guard below is what makes that safe.
INSERT INTO "categories" ("user_id", "name", "icon", "color", "type")
SELECT v.user_id, v.name, v.icon, v.color, v.type
FROM (VALUES
  -- Expense categories
  (NULL::varchar, 'Food'::varchar,           'food'::varchar,          '#3B82F6'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Entertainment'::varchar,  'entertainment'::varchar, '#F59E0B'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Housing'::varchar,        'home'::varchar,          '#10B981'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Transportation'::varchar, 'car'::varchar,           '#EF4444'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Healthcare'::varchar,     'heart'::varchar,         '#8B5CF6'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Shopping'::varchar,       'shopping-bag'::varchar,  '#F97316'::varchar, 'expense'::varchar),
  -- Income categories
  (NULL::varchar, 'Salary'::varchar,         'salary'::varchar,        '#10B981'::varchar, 'income'::varchar),
  (NULL::varchar, 'Freelance'::varchar,      'laptop'::varchar,        '#3B82F6'::varchar, 'income'::varchar),
  (NULL::varchar, 'Investments'::varchar,    'investment'::varchar,    '#8B5CF6'::varchar, 'income'::varchar),
  -- Goal categories (the goals form only lists `type = 'goal'`)
  (NULL::varchar, 'Emergency Fund'::varchar, 'shield'::varchar,        '#EF4444'::varchar, 'goal'::varchar),
  (NULL::varchar, 'Vacation'::varchar,       'plane'::varchar,         '#F59E0B'::varchar, 'goal'::varchar),
  (NULL::varchar, 'House Down Payment'::varchar, 'home'::varchar,      '#10B981'::varchar, 'goal'::varchar),
  (NULL::varchar, 'Car Purchase'::varchar,   'car'::varchar,           '#3B82F6'::varchar, 'goal'::varchar),
  (NULL::varchar, 'Debt Payoff'::varchar,    'credit-card'::varchar,   '#8B5CF6'::varchar, 'goal'::varchar),
  (NULL::varchar, 'Retirement'::varchar,     'piggy-bank'::varchar,    '#6B7280'::varchar, 'goal'::varchar),
  (NULL::varchar, 'Other'::varchar,          'target'::varchar,        '#9CA3AF'::varchar, 'goal'::varchar)
) AS v(user_id, name, icon, color, type)
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c
  WHERE c."user_id" IS NULL
    AND c."name" = v.name
    AND c."type" = v.type
);
