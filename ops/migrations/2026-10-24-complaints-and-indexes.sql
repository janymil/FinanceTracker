-- 2026-10-24
-- 1) Libro de Reclamaciones (Peru). Run with `npm run db:push` or paste into the Neon SQL editor.
CREATE TABLE IF NOT EXISTS complaints (
  id serial PRIMARY KEY,
  code varchar(24) NOT NULL,
  kind varchar(10) NOT NULL,
  full_name varchar(160) NOT NULL,
  document_type varchar(12) NOT NULL,
  document_number varchar(24) NOT NULL,
  address varchar(240) NOT NULL,
  email varchar(160) NOT NULL,
  phone varchar(32),
  service varchar(160) NOT NULL,
  amount_claimed varchar(32),
  detail text NOT NULL,
  request text NOT NULL,
  language varchar(5) NOT NULL DEFAULT 'es',
  status varchar(12) NOT NULL DEFAULT 'open',
  response text,
  created_at timestamp NOT NULL DEFAULT now(),
  answered_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_complaints_code" ON complaints (code);
CREATE INDEX IF NOT EXISTS "IDX_complaints_email" ON complaints (email);

-- 2) Recurring transactions: link each rule to the transaction the user entered, so the
--    daily job can create the repeats and deleting the original stops the rule.
ALTER TABLE recurring_transactions ADD COLUMN IF NOT EXISTS source_transaction_id integer;
CREATE INDEX IF NOT EXISTS "IDX_recurring_active_user" ON recurring_transactions (is_active, user_id);

-- 3) E-mail notifications: language the person uses, and an opt-out switch.
ALTER TABLE users ADD COLUMN IF NOT EXISTS language varchar(5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

-- 3b) Time zone (IANA name, e.g. America/Lima): decides where "this month" starts and ends.
--     NULL until the app saves the device's zone on the person's first visit.
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone varchar(64);

-- 4) Indexes for the tables every screen filters by user. Safe to run on a live database
--    (CREATE INDEX IF NOT EXISTS; use CONCURRENTLY from psql if the tables are large).
CREATE INDEX IF NOT EXISTS "IDX_transactions_user_date" ON transactions (user_id, date);
CREATE INDEX IF NOT EXISTS "IDX_transactions_category" ON transactions (category_id);
CREATE INDEX IF NOT EXISTS "IDX_budgets_user" ON budgets (user_id);
CREATE INDEX IF NOT EXISTS "IDX_categories_user" ON categories (user_id);
CREATE INDEX IF NOT EXISTS "IDX_expense_reminders_user_due" ON expense_reminders (user_id, due_date);
CREATE INDEX IF NOT EXISTS "IDX_goals_user" ON goals (user_id);
CREATE INDEX IF NOT EXISTS "IDX_goal_contributions_goal" ON goal_contributions (goal_id);
CREATE INDEX IF NOT EXISTS "IDX_goal_messages_goal" ON goal_messages (goal_id);
