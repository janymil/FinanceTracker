# Migrations

Every change to `shared/schema.ts` reaches a database through a **reviewed SQL file in this
folder, applied in order**. `drizzle-kit push` is a development convenience and is never
used against production: it applies whatever the schema file says — drops included — with no
review and no record of what happened.

## The baseline

`0000_baseline_2026_10.sql` is the whole schema as it stood on 2026-10-25 (35 tables). It
was generated from `shared/schema.ts`, applied to an empty Postgres 16, and then compared
against production with `npm run db:drift:prod`: no missing table, no missing column, no
type mismatch. That is what "the baseline matches production" means here.

Production was already at that state, so it was **stamped** instead of rebuilt:

```
npm run db:baseline:prod
```

That command runs the drift check first and refuses to write anything if the database does
not match the code. When it succeeds it only inserts one row into
`drizzle.__drizzle_migrations`; no schema is touched.

`archive/pre-baseline-2025/` holds the three files that used to live here. They are history,
not migrations: none of them was listed in the journal, so the migrator never ran them, and
`0001`/`0002` describe a design (integer user ids, a password column) that no longer exists.

## Changing the schema

```
npm run db:generate     # writes 0001_<name>.sql + updates migrations/meta/
# read the SQL before committing it
npm run db:migrate      # apply to DATABASE_URL
npm run db:drift        # the database now has everything the code expects
```

Then, in order:

```
npm run db:migrate:prod # apply the same file to production
./scripts/deploy.sh     # the deploy re-checks production before it ships the code
```

The deploy step is not decoration: `scripts/deploy.sh` runs `db:drift:prod` before reloading,
so code that expects a column the production database does not have is stopped there instead
of returning 500s on the screen that uses it.

## Rules

- One file per change, named `NNNN_short_description.sql`, in the order they will be applied.
- Never edit a migration that has already been applied anywhere. Write the next one.
- Read the generated SQL. `db:generate` will happily write `DROP COLUMN`.
- Data moves (backfill, rename with a copy) go in the same file as the structural change, or
  in an explicit script if they need to run in batches.
- `ADD COLUMN ... NOT NULL` without a default fails on a table with rows. Add the column
  nullable, backfill, then tighten.
- Indexes on a large table: `CREATE INDEX CONCURRENTLY` cannot run inside the transaction the
  migrator uses, so create those from `psql` and add the same statement to the file as
  `CREATE INDEX IF NOT EXISTS` so a fresh database still gets it.

## Known difference from production

The baseline is slightly *more permissive* than production in six places, because production
got those columns from hand-written SQL with stricter constraints:

| Column | Production | Baseline |
| --- | --- | --- |
| `expense_reminders.is_recurring` | NOT NULL | nullable |
| `expense_reminders.reminder_days_before` | NOT NULL | nullable |
| `expense_reminders.is_active` | NOT NULL | nullable |
| `expense_reminders.is_completed` | NOT NULL | nullable |
| `payment_failures.stripe_invoice_id` | NOT NULL | nullable |
| `users.email` | NOT NULL | nullable |

`payment_failures.created_at` and `payment_failures.updated_at` exist in production but are
not in the code at all. None of this breaks a query (the code always sends a value for its own
columns), and `db:drift` reports the differences as warnings, not failures. Tightening them is
a separate change with a backfill, not something to slip into this baseline.

## Checking without changing anything

```
npm run db:drift        # DATABASE_URL
npm run db:drift:prod   # DATABASE_URL_PROD
```

Read-only. Exits 1 when the database is missing a table or column the code expects, prints
leftovers as notes, and never writes.
