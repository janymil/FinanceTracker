# `tests/e2e` — Playwright (blueprint 05)

The suite is **opt-in**. Without `E2E_ENABLED=1` every spec is skipped with an explicit
reason, so `npm run test:e2e -- --list` works in CI without a server, database or Clerk.

## Why the gate

A real run needs all of this — none of it may point at production:

| Requirement | Note |
|---|---|
| Clerk **test** instance | emails like `you+clerk_test@example.com`, code `424242` |
| Seeded database | a dedicated test user, zero transactions (the "before" total is 0) |
| Running app | `npm run dev` or `E2E_MANAGED_SERVER=1` to let Playwright start it |
| Country blocking off | `DISABLE_COUNTRY_BLOCKING=1`, otherwise the runner can get a 403 |

## A real run (what the suite does)

`auth.setup.ts` creates (once) a demo account in the Clerk **test** instance
(`kaptia.e2e+clerk_test@example.com`), opens `/:lang/auth`, switches to "Sign in", types
the credentials and saves the cookie jar to `tests/e2e/.auth/user.json`. Every other spec
starts from that jar, so a failure is never "the login step was flaky".

`human-flow.spec.ts` is the "walks like a user" test:

1. land on the dashboard (already signed in)
2. open Expenses → add **50.00** through the form
3. the row appears and the total changes
4. reload — the row is still there (came from the database)
5. the same row is visible in Transactions
6. Profile renders the "Data & privacy" card
7. `/api/auth/user` returns the demo account

### Run it against a disposable database (recommended)

```bash
# 1. throw-away Postgres
docker run --rm -d --name kaptia-e2e-db \
  -e POSTGRES_PASSWORD=e2e -e POSTGRES_USER=e2e -e POSTGRES_DB=kaptia \
  -p 127.0.0.1:55432:5432 postgres:16-alpine

DATABASE_URL='postgresql://e2e:e2e@127.0.0.1:55432/kaptia' npx drizzle-kit push

# 2. the app, pointed at that database (port 4400 — Chrome blocks 5061)
PORT=4400 DATABASE_URL='postgresql://e2e:e2e@127.0.0.1:55432/kaptia' \
  DISABLE_COUNTRY_BLOCKING=1 \
  PDF_SERVICE_URL='http://127.0.0.1:4010' PDF_API_KEY='e2e-stub-key' \
  ./node_modules/.bin/tsx server/index.ts

# 3. the suite (in another shell; .env supplies the Clerk test keys)
set -a && . ./.env && set +a
DATABASE_URL='postgresql://e2e:e2e@127.0.0.1:55432/kaptia' \
E2E_ENABLED=1 E2E_BASE_URL=http://127.0.0.1:4400 E2E_LOCALE=sk \
npx playwright test

# 4. clean up
docker rm -f kaptia-e2e-db
```

`auth.setup.ts` refuses to run if `DATABASE_URL` contains `neon.tech` — the demo account is
put on the Standard plan for the PDF test, and that must never happen in production.

### Two traps this suite already paid for

- **Clerk tokens are short-lived.** A saved cookie jar is useless until a page has loaded
  and the Clerk client refreshed the session. `ensureSession()` does that in `beforeEach`;
  without it the first API call answers 401 even though the user "is" signed in.
- **The first-login currency modal is a full-screen overlay.** If it is left open, every
  later click fails with "element intercepts pointer events" — a message that has nothing
  to do with the feature under test. `dismissCurrencyModal()` closes it (with an API
  fallback) before any assertion runs.

### Known coverage gap

Country blocking and Stripe checkout are not covered: the first needs a real geo setup, the
second a test-mode Stripe account with webhooks. Both are listed in `05-e2e-critical-flows.md`.


## What is covered

| Spec | Level | Asserts |
|---|---|---|
| `add-expense.spec.ts` | browser | add 50.00 € → row visible, total text changed, **`totalExpensesInCents` delta = 5000**; double-click creates exactly one row |
| `voice-parse.api.spec.ts` | HTTP | `/api/voice/parse` returns cents, type and `needsReview`; empty transcript → 400 |
| `export-pdf.spec.ts` | — | `fixme`: outbound PDF service cannot be stubbed with `page.route()` (see file) |

Rules the specs follow:

- Every URL goes through `path()` — the app is `/:lang/...` on all 59 routes.
- Money is asserted as an **exact cent delta from `/api/financial-summary`**, never by
  parsing the formatted UI string (locale-dependent: `50,00 €` vs `€50.00`).
- Locators use `data-testid` (`add-expense`, `save-expense`, `expenses-total`) or real
  control ids (`#amount`, `#description`). Never i18n copy.
- `trace`/`video`/`screenshot` are kept on failure in `test-results/`.
- `workers: 1` and one user per run: a crashed run must not poison the next one.

## No Docker? Use a throw-away embedded Postgres

`embedded-postgres` ships real Postgres binaries as an npm package (no admin rights, no install):

```bash
mkdir /tmp/pgdb && cd /tmp/pgdb && npm init -y && npm i embedded-postgres
# start it with user e2e / password e2e on port 55432 and create the databases as UTF8:
#   create database kaptia template template0 encoding 'UTF8' lc_collate 'C' lc_ctype 'C';
```

Create the database as **UTF8**. On Windows the default is WIN1252, which rejects characters such
as "—" or "č" with "untranslatable character" and makes the suite fail for the wrong reason.
Then follow the steps above with `DATABASE_URL=postgresql://e2e:e2e@127.0.0.1:55432/kaptia`.

## What the specs cover

| Spec | What it proves |
|---|---|
| `core-tracking.spec.ts` | income, expense create/edit/delete, budgets, goals, reports, every export format (CSV/JSON/Excel/PDF) and the Export button, time-zone month boundary |
| `onboarding.spec.ts` | anonymous API access, JSON 404, sign-in deep link, currency suggestion, welcome + first transaction, Free-plan checklist, currency lock, signed Clerk webhook, failing-network recovery |
| `ai-consent.spec.ts` | Free plan and the AI switch really stop every AI route |
| `human-flow.spec.ts`, `add-expense.spec.ts` | a person adding an expense, desktop and mobile |

`onboarding.spec.ts` creates throw-away users in the Clerk **test** instance and deletes them
afterwards; the standing demo account is kept on purpose.
