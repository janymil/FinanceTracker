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

## Run

```bash
# 1. browsers (one-off)
npx playwright install chromium

# 2. app + env
export E2E_ENABLED=1
export E2E_BASE_URL=http://localhost:5000
export E2E_LOCALE=sk
npm run dev            # or: E2E_MANAGED_SERVER=1 npm run test:e2e

# 3. suite
npm run test:e2e
npm run test:e2e -- --list        # parses specs, needs no server
npx playwright show-report test-results/html
```

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
