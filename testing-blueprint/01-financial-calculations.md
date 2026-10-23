# 01 — Financial calculations (money, summaries, charts)

> Status: **IMPLEMENTED** (step 2). Verified by 54 unit tests + `tsc` + `vite build`.
> Companion to `00-testing-strategy.md`; contracts from its section 3 apply verbatim.

---

## 1. Scope

**In scope**

| Artifact | What it owns |
|---|---|
| `shared/money.ts` | parsing/formatting/rounding money, integer `Cents`, `decimal(12,2)` bounds |
| `shared/calculations.ts` | `calculateFinancialSummary`, `groupTransactionsByMonth`, `groupByCategory`, `pickTopExpenseCategory`, `percentChange`, `expenseChangeSincePreviousMonth`, `getMonthKey`, `getMonthBounds`, `filterByDateRange`, `sumTransactionAmounts*`, `sumAmountsByCategoryName`, `sumAmountsByMonthKey` |
| `server/storage.ts` → `getUserFinancialSummary` | SQL `sum()` + cent-exact conversion; returns `*InCents` alongside legacy numbers |
| UI call sites | expenses, income, transactions, trends, calendar, budget, dashboard widgets, export-tools |

**Out of scope (explicitly)**

- Stripe amounts and plan pricing (`server/routes/stripeRoutes.ts`) — integer cents in Stripe API already, separate blueprint.
- AI cost accounting (`lib/aiCostCalculator.ts`) — billed in micro-dollars, not user money.
- Currency *conversion*. Kaptia stores one display symbol (`users.currency`, `varchar(5)`); there is no FX rate anywhere. Any test that assumes conversion is wrong.
- Percent formatting/`Intl` output — UI concern.

---

## 2. Contracts

Follows 00 §3.1–3.4 exactly. Two decisions this blueprint adds:

1. **Refund** = `income` row with `parentTransactionId`. Counted in `totalIncome` (historical behaviour), excluded from `netIncome`, reported as `refundsInCents`.
2. **Unknown `type`** (anything not `income`/`expense`) is ignored and counted in `ignoredTransactionCount` — never silently treated as an expense.

---

## 3. Ground truth

`tests/fixtures/transactions-march-2026.sk.json` — 21 rows, hand-computed:

| Group | Count | Notes |
|---|---|---|
| March expenses | 15 | incl. `2026-03-01T00:10` and `2026-03-31T23:50` (range boundaries) |
| March incomes | 3 | Mzda 2450.00, Freelance 650.00, Dividendy 150.00 |
| Refund | 1 | income with `parentTransactionId: 6`, Refundácie 249.99 |
| February rows | 2 | must be excluded by the March filter |

Currency symbol `€`, language `sk`, amounts as **strings** (`"84.30"`), dates as local wall-clock
(`"2026-03-02T10:15:00"`, no `Z`) so month bucketing is identical on every runner.

---

## 4. Expected output (March 2026, after date filtering)

| Field | Value |
|---|---|
| `totalIncomeInCents` | `349999` (3499.99 € incl. refund) |
| `netIncomeInCents` | `325000` (3250.00 €, refund excluded) |
| `refundsInCents` | `24999` |
| `totalExpensesInCents` | `128608` (1286.08 €) |
| `netBalanceInCents` | `221391` (2213.91 €) |
| counts | income 4, expense 15, total 19, ignored 0 |
| `topExpenseCategory` | Bývanie / `64850` / 3 transactions |
| `savingsRateInBasisPoints` | `6043` (60.43 %) |
| expenses by category | Bývanie 64850, Nákup 24999, Potraviny 19655, Doprava 7240, Dary 3500, Stravovanie 2890, Zábava 2200, Zdravie 1875, Predplatné 1399 |

Whole dataset (no filter): income `399999`, expenses `134108`, net `265891`.
Monthly series: `2026-02` (50000/5500) → `2026-03` (349999/128608); Feb→Mar expense change `2238.33 %`.

---

## 5. Edge cases (each has a test)

| Case | Expected |
|---|---|
| Empty period | all zeros, `topExpenseCategory: null`, `savingsRate: null` |
| Expenses only (no income) | `savingsRate: null` — not `Infinity`, not `NaN`; `netBalanceInCents` negative |
| `amount: null` (optional column) | treated as `0`, row still counted |
| `categoryName: null` | bucketed as `Uncategorized` |
| `type: 'transfer'` / `''` | ignored + `ignoredTransactionCount` increments |
| Month boundary | `2026-03-01T00:00:00.000` and `2026-03-31T23:59:59.999` included; `2026-04-01T00:00:00.001` excluded |
| UTC timestamps (`...Z`, production shape) | bucketed into the correct local month |
| Invalid date / `2026-13` | `RangeError` |
| Locale | category names pass through untranslated (SK dataset → `Bývanie`, EN dataset → `Groceries`) |
| Float drift | `sumAmountsToCents(['0.10','0.20']) === 30` (not `0.30000000000000004`) |
| `1.005` rounding | `101` cents (half away from zero) |
| Range guard | `10000000000.00` and `1e13` throw `RangeError` |

---

## 6. Runner skeleton (as implemented)

```ts
// tests/unit/calculations.test.ts
const fixture: Fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/transactions-march-2026.sk.json', import.meta.url)), 'utf8'),
);

const marchRows = () =>
  filterByDateRange(
    fixture.transactions,
    fixture.expected.march.range.start,
    fixture.expected.march.range.end,
  );

it('matches every hand-computed total to the cent', () => {
  const summary = calculateFinancialSummary(marchRows());
  expect(summary.totalExpensesInCents).toBe(128608);
  expect(summary.netBalanceInCents).toBe(221391);
  expect(summary.topExpenseCategory).toMatchObject({ categoryName: 'Bývanie', amountInCents: 64850 });
});
```

```ts
// tests/unit/money.test.ts
expect(sumAmountsToCents(['0.10', '0.20'])).toBe(30);   // not 0.30000000000000004
expect(parseAmountToCents('1.005')).toBe(101);          // half away from zero
expect(() => parseAmountToCents('abc')).toThrow(RangeError);
```

Run: `npm run test` → 2 files, 54 tests, ~1 s. No DB, no network, no API keys.

---

## 7. Determinism

- No network, no DB, no clock: `getMonthBounds`/`getMonthKey` are pure and the fixture uses
  **local wall-clock** timestamps (no `Z`) so the result does not depend on the runner's TZ.
- Sorting is locale-independent (`compareCents`, then plain `<` on names) so output order is stable.
- The only tolerated float is the derived `number` view (`totalExpenses: 1286.08`), asserted with
  `toBe` only because both sides are the same double; all authoritative assertions use `*InCents`.

---

## 8. Production wiring — what changed (step 2)

| File | Change |
|---|---|
| `server/storage.ts:972` `getUserFinancialSummary` | `Number(sum)` → `parseAmountToCents(sum)`; added `totalIncomeInCents`, `totalExpensesInCents`, `netBalanceInCents`, `amountInCents` per category |
| `server/routes/transactionRoutes.ts:335` | removed misleading `Math.abs()` on non-negative amounts |
| `client/src/pages/expenses.tsx` | totals, month chart, category pie → shared helpers |
| `client/src/pages/income.tsx` | same |
| `client/src/pages/transactions.tsx` | totals via `sumTransactionAmountsByType` |
| `client/src/pages/trends.tsx` | period + category series accumulated in cents |
| `client/src/pages/calendar.tsx` | per-day totals via helper |
| `client/src/pages/budget.tsx` | `totalBudget` via `sumAmountsToCents` |
| `client/src/components/{ai-insights,quick-financial-snapshot,trends-chart,budget-overview,financial-health-score,export-tools}.tsx` | reducers replaced with cent-exact helpers |

**Regression gate (CI-ready):**

```bash
grep -rn "+ parseFloat(\|reduce((sum.*parseFloat" client/src   # must print 0
```

`parseFloat(formData.amount)` in form submit handlers is **allowed** — it converts a single user
input into a number for the API, it never accumulates. The gate targets accumulation only.

---

## 9. Known deviations / follow-ups

1. `expenses.tsx` used `'Other'` as the fallback category name, `income.tsx` used `'Uncategorized'`.
   Both now use `UNCATEGORIZED` → visible label change for transactions without a category.
2. `saveSettings`/`budget` form values are still parsed with `parseFloat` at the API boundary;
   validation should move to a zod schema (`insertBudgetSchema` already exists in `shared/schema.ts`).
3. Server summary still runs three SQL `sum()` queries. A single query with `FILTER (WHERE ...)`
   would be faster but is **not** required for correctness — do not change it inside a test PR.
4. No integration test yet for `getUserFinancialSummary` (needs a Neon branch → step 4).

