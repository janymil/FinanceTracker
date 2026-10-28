import { expect, test, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { monthRange } from '../../shared/timezones';
import { E2E_ENABLED, SKIP_REASON, ensureSession, fetchSummary, path, setPlan, uniqueDescription } from './support/env';

/**
 * Core tracking against the running app, signed in as the demo account:
 * income, expenses (create / edit / delete), budgets, goals, reports and every export format.
 *
 * Money is checked in cents through the API (the oracle); pages are checked for what a person
 * would see. The demo account accumulates data across runs, so every assertion is a difference
 * or uses a description that is unique to this run.
 */
test.skip(!E2E_ENABLED, SKIP_REASON);

const DAY = 86_400_000;
const recentWindow = () => ({
  start: new Date(Date.now() - 2 * DAY).toISOString(),
  end: new Date(Date.now() + DAY).toISOString(),
});
const calendarDay = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

async function addTransaction(request: APIRequestContext, body: Record<string, unknown>) {
  const response = await request.post('/api/transactions', { data: { date: new Date().toISOString(), ...body } });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

async function makeCategory(request: APIRequestContext) {
  const response = await request.post('/api/categories', {
    data: { name: uniqueDescription('Cat'), icon: 'tag', color: '#00aa00', type: 'expense' },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

test.beforeEach(async ({ page }) => {
  await ensureSession(page);
  await setPlan(page, 'standard');
});

test.describe('income and expenses', () => {
  test('income raises the balance by exactly its amount and shows on the Income page', async ({ page }) => {
    const before = await fetchSummary(page.request, recentWindow());
    const description = uniqueDescription('E2E salary');
    await addTransaction(page.request, { type: 'income', amount: 1234.56, description });

    const after = await fetchSummary(page.request, recentWindow());
    expect(after.totalIncomeInCents - before.totalIncomeInCents).toBe(123456);
    expect(after.netBalanceInCents - before.netBalanceInCents).toBe(123456);

    await page.goto(path('/income'));
    await expect(page.getByText(description).first()).toBeVisible({ timeout: 20_000 });
  });

  test('an expense can be edited and deleted, and the totals follow', async ({ page }) => {
    const before = await fetchSummary(page.request, recentWindow());
    const created = await addTransaction(page.request, { type: 'expense', amount: 20, description: uniqueDescription('E2E edit') });
    expect((await fetchSummary(page.request, recentWindow())).totalExpensesInCents - before.totalExpensesInCents).toBe(2000);

    const edited = await page.request.put(`/api/transactions/${created.id}`, { data: { amount: 25.5 } });
    expect(edited.ok(), await edited.text()).toBeTruthy();
    expect((await fetchSummary(page.request, recentWindow())).totalExpensesInCents - before.totalExpensesInCents).toBe(2550);

    const removed = await page.request.delete(`/api/transactions/${created.id}`);
    expect(removed.status()).toBe(200);
    expect((await fetchSummary(page.request, recentWindow())).totalExpensesInCents).toBe(before.totalExpensesInCents);

    // The second delete tells the truth: it is already gone.
    expect((await page.request.delete(`/api/transactions/${created.id}`)).status()).toBe(404);
    expect((await page.request.put(`/api/transactions/${created.id}`, { data: { amount: 1 } })).status()).toBe(404);
  });

  test('refuses nonsense instead of saving it', async ({ page }) => {
    const good = { type: 'expense', amount: 5, description: 'x', date: new Date().toISOString() };
    const bad: Array<[string, Record<string, unknown>]> = [
      ['zero amount', { amount: 0 }],
      ['negative amount', { amount: -5 }],
      ['text amount', { amount: 'abc' }],
      ['empty description', { description: '   ' }],
      ['unknown type', { type: 'transfer' }],
      ['unknown category', { categoryId: 999_999_999 }],
      ['invalid date', { date: 'not-a-date' }],
      ['javascript link', { paymentUrl: 'javascript:alert(1)' }],
    ];
    for (const [name, patch] of bad) {
      const response = await page.request.post('/api/transactions', { data: { ...good, ...patch } });
      expect(response.status(), name).toBe(400);
    }
    expect((await page.request.delete('/api/transactions/not-a-number')).status()).toBe(400);
  });
});

test.describe('budgets', () => {
  test('spending in the category moves the budget; edit, validation and delete behave', async ({ page }) => {
    const category = await makeCategory(page.request);
    const created = await page.request.post('/api/budgets', {
      data: { categoryId: category.id, amount: 100, startDate: calendarDay(-3), endDate: calendarDay(3) },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const budget = await created.json();
    expect(budget.amount).toBe('100.00');

    await addTransaction(page.request, { type: 'expense', amount: 40, description: uniqueDescription('E2E budget'), categoryId: category.id });

    const listed = (await (await page.request.get('/api/budgets')).json()).find((b: any) => b.id === budget.id);
    expect(listed.spent).toBe(40);
    expect(listed.remaining).toBe(60);
    expect(Math.round(listed.percentage)).toBe(40);

    const raised = await page.request.put(`/api/budgets/${budget.id}`, { data: { amount: 200 } });
    expect(raised.ok(), await raised.text()).toBeTruthy();
    const relisted = (await (await page.request.get('/api/budgets')).json()).find((b: any) => b.id === budget.id);
    expect(relisted.remaining).toBe(160);

    const invalid: Array<[string, Record<string, unknown>]> = [
      ['reversed dates', { startDate: calendarDay(3), endDate: calendarDay(-3) }],
      ['negative amount', { amount: -1 }],
      ['unknown category', { categoryId: 999_999_999 }],
      ['bad date', { startDate: 'soon' }],
    ];
    for (const [name, patch] of invalid) {
      const response = await page.request.post('/api/budgets', {
        data: { categoryId: category.id, amount: 10, startDate: calendarDay(-3), endDate: calendarDay(3), ...patch },
      });
      expect(response.status(), name).toBe(400);
    }

    expect((await page.request.delete(`/api/budgets/${budget.id}`)).status()).toBe(200);
    expect((await page.request.delete(`/api/budgets/${budget.id}`)).status()).toBe(404);
    expect((await page.request.put(`/api/budgets/${budget.id}`, { data: { amount: 5 } })).status()).toBe(404);
  });

  test('the Budget page opens for a Standard account', async ({ page }) => {
    await page.goto(path('/budget'));
    await expect(page).toHaveURL(/\/budget/);
    await expect(page.locator('body')).not.toContainText('Prihlásenie | Registrácia');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
  });

  test('a free account is told to upgrade, not shown someone else\'s numbers', async ({ page }) => {
    await setPlan(page, 'free');
    try {
      expect((await page.request.get('/api/budgets')).status()).toBe(403);
      expect((await page.request.get('/api/goals')).status()).toBe(403);
    } finally {
      await setPlan(page, 'standard');
    }
  });
});

test.describe('goals', () => {
  test('create, progress, validation and delete', async ({ page }) => {
    const name = uniqueDescription('E2E goal');
    const created = await page.request.post('/api/goals', {
      data: { name, targetAmount: 500, targetDate: `${calendarDay(90)}`, category: 'travel', description: 'for the test' },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const goal = await created.json();
    expect(goal.targetAmount).toBe('500.00');
    expect(goal.currentAmount).toBe('0.00');

    const progressed = await page.request.put(`/api/goals/${goal.id}`, { data: { currentAmount: 125.5 } });
    expect(progressed.ok(), await progressed.text()).toBeTruthy();
    const listed = (await (await page.request.get('/api/goals')).json()).find((g: any) => g.id === goal.id);
    expect(listed.currentAmount).toBe('125.50');

    const invalid: Array<[string, Record<string, unknown>]> = [
      ['empty name', { name: '  ' }],
      ['zero target', { targetAmount: 0 }],
      ['negative target', { targetAmount: -10 }],
      ['bad date', { targetDate: 'someday' }],
      ['no category', { category: '' }],
    ];
    for (const [label, patch] of invalid) {
      const response = await page.request.post('/api/goals', {
        data: { name: 'x', targetAmount: 10, targetDate: calendarDay(30), category: 'travel', ...patch },
      });
      expect(response.status(), label).toBe(400);
    }
    expect((await page.request.put(`/api/goals/${goal.id}`, { data: { currentAmount: -1 } })).status()).toBe(400);

    await page.goto(path('/goals'));
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });

    expect((await page.request.delete(`/api/goals/${goal.id}`)).status()).toBe(200);
    expect((await page.request.delete(`/api/goals/${goal.id}`)).status()).toBe(404);
  });
});

test.describe('reports', () => {
  test('the Reports page loads its numbers without errors', async ({ page }) => {
    // The statement is computed from the account's transactions (shared/periodReport),
    // so this page reads `/api/transactions` and no longer asks `/api/financial-summary`.
    const data = page.waitForResponse((r) => r.url().includes('/api/transactions') && r.ok(), { timeout: 30_000 });
    await page.goto(path('/reports'));
    await data;
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/something went wrong|chyba|error boundary/i)).toHaveCount(0);
  });

  test('summary figures add up and a reversed range is refused', async ({ page }) => {
    const summary = await fetchSummary(page.request, recentWindow());
    expect(summary.totalIncomeInCents - summary.totalExpensesInCents).toBe(summary.netBalanceInCents);
    const reversed = await page.request.get(`/api/financial-summary?startDate=${calendarDay(1)}&endDate=${calendarDay(-1)}`);
    expect(reversed.status()).toBe(400);
    const breakdown = await page.request.get('/api/expense-breakdown');
    expect(breakdown.ok()).toBeTruthy();
    expect(Array.isArray((await breakdown.json()).expensesByCategory)).toBe(true);
  });
});

test.describe('export (Premium)', () => {
  test.beforeEach(async ({ page }) => {
    await setPlan(page, 'premium');
  });
  test.afterEach(async ({ page }) => {
    await setPlan(page, 'standard');
  });

  test('every format downloads, with this month\'s data and safe cells', async ({ page }) => {
    const risky = `=cmd|' /C calc'!A0 ${Date.now()}`;
    await addTransaction(page.request, { type: 'expense', amount: 7.25, description: risky });

    const csv = await page.request.get('/api/export?format=csv&dateRange=month&includeTransactions=true');
    expect(csv.status()).toBe(200);
    const bytes = await csv.body();
    expect(Array.from(bytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]); // BOM for Excel
    const text = bytes.toString('utf8');
    expect(text).toContain('Date,Description,Amount,Type,Category\r\n');
    expect(text).toContain(`"'=cmd`); // defused
    expect(text).not.toMatch(/,"=cmd/);
    expect(text).toContain('7.25');

    const json = await page.request.get('/api/export?format=json&dateRange=month&includeTransactions=true&includeBudgets=true&includeGoals=true');
    expect(json.status()).toBe(200);
    const data = await json.json();
    expect(data.transactions.some((t: any) => t.description === risky)).toBe(true);
    expect(data.userId).toBeUndefined();
    expect(Array.isArray(data.budgets) && Array.isArray(data.goals)).toBe(true);

    const excel = await page.request.get('/api/export?format=excel&dateRange=year&includeTransactions=true');
    expect(excel.status()).toBe(200);
    expect(excel.headers()['content-type']).toContain('spreadsheetml');
    expect((await excel.body()).subarray(0, 2).toString()).toBe('PK'); // a real .xlsx (zip)

    const pdf = await page.request.get('/api/export?format=pdf&dateRange=quarter&includeTransactions=true');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
  });

  test('periods are respected: a custom range in the past leaves today out', async ({ page }) => {
    const description = uniqueDescription('E2E today');
    await addTransaction(page.request, { type: 'expense', amount: 3, description });
    const past = await page.request.get(
      `/api/export?format=json&dateRange=custom&startDate=${calendarDay(-400)}&endDate=${calendarDay(-300)}&includeTransactions=true`,
    );
    expect(past.status()).toBe(200);
    expect((await past.json()).transactions.some((t: any) => t.description === description)).toBe(false);

    const wide = await page.request.get(
      `/api/export?format=json&dateRange=custom&startDate=${calendarDay(-1)}&endDate=${calendarDay(1)}&includeTransactions=true`,
    );
    // +1 day: calendarDay() is a UTC date, the app reads dates in the person's own time zone,
    // and for a few hours every day those two disagree about what "today" is.
    expect((await wide.json()).transactions.some((t: any) => t.description === description)).toBe(true);
  });

  test('bad requests are refused with a reason', async ({ page }) => {
    expect((await page.request.get('/api/export?format=docx&includeTransactions=true')).status()).toBe(400);
    expect((await page.request.get('/api/export?format=csv&dateRange=custom&startDate=nope&endDate=nope&includeTransactions=true')).status()).toBe(400);
    expect((await page.request.get(`/api/export?format=csv&dateRange=custom&startDate=${calendarDay(5)}&endDate=${calendarDay(-5)}&includeTransactions=true`)).status()).toBe(400);
    expect((await page.request.get('/api/export?format=csv&includeTransactions=false')).status()).toBe(400);
  });

  test('a Standard account may export its rows but not the rendered PDF', async ({ page }) => {
    await setPlan(page, 'standard');
    // The rule the server actually enforces (`/api/export` in `server/routes/exportRoutes.ts`):
    // every plan may download its own rows as CSV/JSON; only `format=pdf` needs Premium. This
    // assertion used to demand 403 for CSV, which was the rule *before* export was opened to
    // every plan — so it was failing against correct code.
    expect((await page.request.get('/api/export?format=csv&includeTransactions=true')).status()).toBe(200);
    expect((await page.request.get('/api/export?format=pdf&includeTransactions=true')).status()).toBe(403);
  });

  test('the Export button on the page really downloads a file', async ({ page }) => {
    const description = uniqueDescription('E2E page export');
    await addTransaction(page.request, { type: 'expense', amount: 9.99, description });

    await page.goto(path('/export'));
    // Format → CSV
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /csv/i }).first().click();

    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.getByTestId('export-run').click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const file = readFileSync(await download.path());
    expect(file.toString('utf8')).toContain(description);
  });

  test('the Export page asks for dates instead of failing silently', async ({ page }) => {
    await page.goto(path('/export'));
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: /custom|vlastn|personaliz/i }).first().click();
    await page.getByTestId('export-run').click();
    await expect(page.getByText(/start and an end date|začiatok a koniec|fecha de inicio/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('time zone decides the month', () => {
  test('"this month" follows the chosen zone at the boundary', async ({ page }) => {
    const zone = 'Pacific/Kiritimati'; // UTC+14: its month starts 14 hours before UTC's
    const original = (await (await page.request.get('/api/auth/user')).json()).timezone ?? 'Europe/Bratislava';
    await setPlan(page, 'premium');
    try {
      expect((await page.request.put('/api/auth/user', { data: { timezone: zone } })).ok()).toBeTruthy();
      expect((await page.request.put('/api/auth/user', { data: { timezone: 'Mars/Olympus' } })).status()).toBe(400);

      const now = new Date();
      const local = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric' }).formatToParts(now);
      const year = Number(local.find((p) => p.type === 'year')!.value);
      const month = Number(local.find((p) => p.type === 'month')!.value);
      const { start } = monthRange(year, month, zone);

      const justBefore = uniqueDescription('E2E before-month');
      const justAfter = uniqueDescription('E2E after-month');
      await addTransaction(page.request, { type: 'expense', amount: 1, description: justBefore, date: new Date(start.getTime() - 60 * 60 * 1000).toISOString() });
      await addTransaction(page.request, { type: 'expense', amount: 1, description: justAfter, date: new Date(start.getTime() + 60 * 60 * 1000).toISOString() });

      const exported = await (await page.request.get('/api/export?format=json&dateRange=month&includeTransactions=true')).json();
      const names = exported.transactions.map((t: any) => t.description);
      expect(names).toContain(justAfter);
      expect(names).not.toContain(justBefore);
    } finally {
      await page.request.put('/api/auth/user', { data: { timezone: original } });
      await setPlan(page, 'standard');
    }
  });
});
