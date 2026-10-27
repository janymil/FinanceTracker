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
-- Names are the canonical ones that `server/categoryTranslations.ts` translates for the three
-- languages, and icons are keys of `categoryIcons` in `client/src/lib/icons-registry.tsx`, so
-- no row here renders a fallback icon.
--
-- IDEMPOTENT ON PURPOSE: `scripts/seed-system-categories.mjs` runs this same file against a
-- live database that already has some of the rows.
INSERT INTO "categories" ("user_id", "name", "icon", "color", "type")
SELECT v.user_id, v.name, v.icon, v.color, v.type
FROM (VALUES
  -- Expense categories
  (NULL::varchar, 'Food'::varchar,              'food'::varchar,           '#EF4444'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Transportation'::varchar,    'transportation'::varchar, '#3B82F6'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Housing'::varchar,           'housing'::varchar,        '#8B5CF6'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Entertainment'::varchar,     'entertainment'::varchar,  '#F59E0B'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Healthcare'::varchar,        'healthcare'::varchar,     '#EC4899'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Shopping'::varchar,          'shopping'::varchar,       '#06B6D4'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Utilities'::varchar,         'utilities'::varchar,      '#10B981'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Education'::varchar,         'education'::varchar,      '#6366F1'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Travel'::varchar,            'travel'::varchar,         '#14B8A6'::varchar, 'expense'::varchar),
  (NULL::varchar, 'Personal Care'::varchar,     'other'::varchar,          '#F43F5E'::varchar, 'expense'::varchar),
  -- Income categories
  (NULL::varchar, 'Salary'::varchar,            'salary'::varchar,         '#059669'::varchar, 'income'::varchar),
  (NULL::varchar, 'Freelance'::varchar,         'freelance'::varchar,      '#22C55E'::varchar, 'income'::varchar),
  (NULL::varchar, 'Investments'::varchar,       'investment'::varchar,     '#0EA5E9'::varchar, 'income'::varchar),
  (NULL::varchar, 'Business'::varchar,          'business'::varchar,       '#0891B2'::varchar, 'income'::varchar),
  (NULL::varchar, 'Other Income'::varchar,      'other'::varchar,          '#6B7280'::varchar, 'income'::varchar),
  -- Goal categories (the goals form only lists `type = 'goal'`)
  (NULL::varchar, 'Emergency Fund'::varchar,    'emergency'::varchar,      '#F59E0B'::varchar, 'goal'::varchar),
  (NULL::varchar, 'Vacation'::varchar,          'vacation'::varchar,       '#06B6D4'::varchar, 'goal'::varchar),
  (NULL::varchar, 'House Down Payment'::varchar,'house'::varchar,          '#8B5CF6'::varchar, 'goal'::varchar),
  (NULL::varchar, 'Car Purchase'::varchar,      'car'::varchar,            '#3B82F6'::varchar, 'goal'::varchar),
  (NULL::varchar, 'Debt Payoff'::varchar,       'savings'::varchar,        '#EF4444'::varchar, 'goal'::varchar),
  (NULL::varchar, 'Retirement'::varchar,        'retirement'::varchar,     '#EC4899'::varchar, 'goal'::varchar),
  (NULL::varchar, 'Other'::varchar,             'other'::varchar,          '#6B7280'::varchar, 'goal'::varchar)
) AS v(user_id, name, icon, color, type)
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c
  WHERE c."user_id" IS NULL
    AND c."name" = v.name
    AND c."type" = v.type
);
