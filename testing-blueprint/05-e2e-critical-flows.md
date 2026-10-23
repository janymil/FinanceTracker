# 05 — E2E critical flows (Playwright)

> Status: **PARTIALLY IMPLEMENTED** (step 5).
> Done: config, page object, 3 spec files (9 tests listed), 3 `data-testid` hooks, README.
> Not executed: a real run needs a Clerk test instance + seeded DB; the specs are gated by
> `E2E_ENABLED=1` and skip with an explicit reason otherwise.
> Prerequisite: blueprints 01–04 (numbers must be correct before asserting them in a browser).

---

## 1. Scope

**In scope — exactly three flows**

| # | Flow | Why this one |
|---|---|---|
| E2E-1 | sign in → add expense 50.00 € → dashboard reflects it | the money loop users complain about |
| E2E-2 | voice input → pre-filled confirmation → save | highest-friction path, most moving parts |
| E2E-3 | export PDF → file downloads | proves the external PDF service is wired |

**Out of scope:** Stripe checkout (test-mode Stripe + webhooks = own blueprint), admin panel,
collaborative goals, courses, promo/demo generators.

**Why only three:** Clerk login + `/:lang/` prefix (59 routes in `client/src/App.tsx`) + SSR
(`server/ssr.ts`) + `countryBlockingMiddleware` make every additional flow expensive and flaky.
Three stable flows beat ten brittle ones.

---

## 2. Contracts / environment

| Concern | Rule |
|---|---|
| Auth | **Clerk test instance only.** Never production keys. Email pattern `you+clerk_test@example.com`, verification code `424242`. |
| URL | Every route is `/:lang/...` → `baseURL` + `LOCALE_PREFIX = '/sk'`. Never hardcode a path without the prefix. |
| Data | Each run creates its own user via the same path `scripts/audit-flows.ts` uses, and deletes it afterwards. Never reuse a human's account. |
| Geo | `countryBlockingMiddleware` reads `blocked_countries` from the DB and can 403 the runner's IP. E2E env must disable it explicitly (`DISABLE_COUNTRY_BLOCKING=1`) — do not rely on runner geography. |
| Money | Assertions compare **cents** from `GET /api/financial-summary` (`totalExpensesInCents`), and only then assert the rendered text. |
| AI | No live AI in E2E-1/E2E-3. E2E-2 mocks the transcription endpoint via `page.route()`. |

---

## 3. Ground truth

```
tests/e2e/fixtures/user.ts        # test user factory (Clerk test instance + DB row)
tests/e2e/fixtures/pdf-bytes.ts   # tiny valid PDF used by the mocked PDF route
tests/e2e/pages/*.ts              # page objects: DashboardPage, ExpenseDialog, VoiceEntry
```

Baseline must be **empty**: the created user has zero transactions, so "before" is `0` — no
subtraction from a dirty fixture, no dependence on other tests.

---

## 4. Expected assertions (E2E-1)

```ts
const before = await page.request.get(`${API}/api/financial-summary?...`);
const beforeCents = (await before.json()).totalExpensesInCents;   // 0

await expenseDialog.create({ amount: '50.00', category: 'Reštaurácie', description: 'E2E lunch' });

const after = await page.request.get(`${API}/api/financial-summary?...`);
expect((await after.json()).totalExpensesInCents - beforeCents).toBe(5000);   // exactly 50.00 €

await page.reload();
await expect(dashboard.monthExpenses).toHaveText(/50[.,]00/);      // locale-aware: 50,00 in SK
await expect(dashboard.recentTransactions).toContainText('E2E lunch');
```

Rules:
- The delta must be **exactly** `5000` cents. A `toBeGreaterThan` assertion hides the float bug we
  just removed.
- UI text assertions are locale-aware: SK renders `50,00 €`, EN `€50.00`. One expectation per locale,
  never a regex that accepts both.
- The chart assertion is structural (new data point / new bar label), not pixel-based.

---

## 5. Edge cases (minimum)

1. `/:lang/` prefix: the same flow must pass for `/sk` and `/en-us` (parameterised, not duplicated).
2. Month boundary: a transaction created at `23:59` local on the last day of the month must land in
   that month (use `page.clock` to pin time; the dashboard defaults to "this month").
3. Empty state: dashboard with zero transactions renders zeros, not `NaN` or a spinner forever.
4. Mobile viewport (Pixel 5 `393×851`): the "add transaction" dialog is reachable and submittable.
5. Session expiry: after sign-out, a protected route redirects instead of rendering `null`
   (`transactions.tsx` returns `null` when `!user` — assert the redirect, not the blank page).
6. Failed save (API 500): the toast appears and the dialog stays open with data intact.
7. Duplicate submit (double click) → exactly one transaction (`5000` cents, not `10000`).
8. E2E-2: transcription mocked to `"obed dvanásť päťdesiat"` → form pre-filled with `12.50`.
9. E2E-3: PDF route mocked → download event fires, file starts with `%PDF-`.
10. Cleanup: after the run the test user has no rows (`deleteUserCompletely`), verified by an API call.

---

## 6. Runner skeleton

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,             // one shared test user per file
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
```

```ts
// tests/e2e/add-expense.spec.ts
import { test, expect } from '@playwright/test';

test('adding a 50.00 € expense moves the dashboard by exactly 50.00 €', async ({ page, request }) => {
  const user = await createTestUser();
  await signIn(page, user);                      // Clerk test instance

  const before = await summaryCents(request, user);
  await page.goto('/sk/dashboard');
  await page.getByRole('button', { name: /pridať|add/i }).click();
  await page.getByLabel(/suma|amount/i).fill('50.00');
  await page.getByLabel(/kategória|category/i).click();
  await page.getByRole('option', { name: 'Reštaurácie' }).click();
  await page.getByRole('button', { name: /uložiť|save/i }).click();
  await expect(page.getByText(/uložené|saved/i)).toBeVisible();

  const after = await summaryCents(request, user);
  expect(after.totalExpensesInCents - before.totalExpensesInCents).toBe(5000);

  await page.reload();
  await expect(page.getByTestId('month-expenses')).toHaveText(/50[.,]00/);
});
```

Notes for the implementer (verify, do not guess):
- `signIn` should use Clerk's official testing helper (`@clerk/testing`: `clerkSetup()` +
  `setupClerkTestingToken()`), or the `+clerk_test` / `424242` flow. Pin the package version and
  confirm it against the installed `@clerk/clerk-react@5`.
- The voice endpoint used by `client/src/components/simple-voice-input.tsx` must be read from source
  before writing `page.route()` — do not invent a URL.
- Locators: prefer `getByRole` / `getByTestId`. Existing components have no test IDs; add
  `data-testid` only where text is locale-dependent.

---

## 7. Determinism

- Time: `page.clock.install({ time: new Date(2026, 2, 15, 10, 0, 0) })` before navigation, so
  "this month" is stable. Server-side dates still come from the real clock — assertions must read the
  range back from the API rather than hardcoding month bounds.
- Locale: one parameterised run per locale (`sk`, `en-us`). Never assert a string that only appears in
  one translation.
- AI: no live calls. Voice and OCR responses are mocked. The PDF service is intercepted with a
  fixture buffer.
- Test isolation: `fullyParallel: false`, one user per spec, cleanup in `afterAll`; a crashed run must
  not poison the next one.
- If the suite grows beyond ~5 minutes, move E2E to a nightly job and keep only E2E-1 on PRs.

---

## 8. What must NOT happen

- Snapshot tests of the whole dashboard (every copy/i18n change breaks them).
- Assertions on `Math.round`ed display values while the underlying data is unverified.
- A "retry until green" loop that hides a real race in `useTransactions`.
- Running E2E against `kaptia.app` (production). The staging URL is a separate requirement of this
  blueprint.

---

## 9. Implementation log (step 5)

| Artifact | What it does |
|---|---|
| `playwright.config.ts` | `testDir: tests/e2e`, `workers: 1`, trace/video/screenshot on failure, `locale: sk-SK`, `timezoneId: Europe/Bratislava`, optional `webServer` behind `E2E_MANAGED_SERVER=1` |
| `tests/e2e/support/env.ts` | `E2E_ENABLED` gate, `path()` (locale prefix), `monthRange()`/`currentMonthKey()` (local semantics), `fetchSummary()` (cent oracle), `uniqueDescription()` |
| `tests/e2e/pages/expenses-page.ts` | page object using `data-testid` + real control ids (`#amount`, `#description`) |
| `tests/e2e/add-expense.spec.ts` | E2E-1: add 50.00 → row visible, total text changed, **API delta = 5000**; double-click → exactly one row |
| `tests/e2e/voice-parse.api.spec.ts` | E2E-2 at HTTP level: cents + type + `needsReview`, income detection, empty transcript → 400 |
| `tests/e2e/support/pdf-stub-server.ts` | node:http stub for the external PDF service, records the payload |
| `tests/e2e/global-setup.ts` | starts/stops the stub when `E2E_ENABLED=1` |
| `tests/e2e/export-pdf.spec.ts` | E2E-3: `POST /api/export-pdf` through the real server against a local PDF stub (`%PDF-` asserted) |
| `client/src/pages/expenses.tsx` | 3 stable hooks: `add-expense` (header + empty state), `save-expense`, `expenses-total` |
| `package.json` | `test:e2e`, `test:e2e:list`, `test:e2e:install` |

Verified without a live app: `npx playwright test --list` → **9 tests in 3 files**; `tsc` clean;
vitest still 202 (the e2e folder is excluded from the vitest runner, and `.spec.ts` never
collides with the `.test.ts` convention).

**Deliberate deviations from the original plan:**

1. **E2E-2 is an HTTP-level flow, not a microphone flow.** Recording audio needs fake media
   devices, mic permissions and a stubbed STT provider. The question that matters — "does a
   spoken sentence become the right cents" — is answered by `/api/voice/parse`.
2. **E2E-3 runs at HTTP level against a local PDF stub.** `page.route()` only intercepts
   *browser* requests; the PDF is produced by the server calling `pdf-processor.formatika.dev`.
   `tests/e2e/support/pdf-stub-server.ts` (started by `global-setup.ts`) replaces the service,
   and the app is launched with `PDF_SERVICE_URL` pointing at it — so the test asserts a real
   `%PDF-` body from `POST /api/export-pdf` without touching the external service. The browser
   *click* on the export button is still not automated: the page has no stable hook for it.
3. **Dashboard-card assertion replaced by the expenses-page total + API delta.** The dashboard
   value is rendered inside an i18n'd insight array (`quick-financial-snapshot.tsx`) with no
   stable hook; adding a test id there would mean restructuring that component. The cent delta
   from `/api/financial-summary` is the stronger assertion anyway.

**To make it runnable:** provision the Clerk test instance and a seeded test user, then
`E2E_ENABLED=1 E2E_BASE_URL=… npx playwright install chromium && npm run test:e2e`.
Nothing else in the harness changes.

