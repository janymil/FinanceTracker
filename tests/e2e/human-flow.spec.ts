import { expect, test } from '@playwright/test';
import { ExpensesPage } from './pages/expenses-page';
import { E2E_ENABLED, SKIP_REASON, ensureSession, currentMonthKey, fetchSummary, monthRange, path, uniqueDescription } from './support/env';

/**
 * The "walks like a user" flow. Everything here is done through the interface, in the
 * order a new customer would do it — the only shortcut is that the login itself happened
 * once in `auth.setup.ts` and its cookie jar is reused.
 *
 * Steps:
 *   1. land on the dashboard
 *   2. open Expenses, add 50.00 through the form
 *   3. see the row and the changed total
 *   4. reload — the row must still be there (server round-trip, not local state)
 *   5. find it in Transactions
 *   6. open Profile and confirm the account/legal section renders
 *   7. the API agrees this is the demo account
 */

test.skip(!E2E_ENABLED, SKIP_REASON);

test.beforeEach(async ({ page }) => {
  await ensureSession(page);
});

test.describe('E2E-0 a human walks through the app', () => {
  test('dashboard → add expense → reload → transactions → profile', async ({ page }) => {
    const range = monthRange(currentMonthKey());

    // 1. Signed in already (storageState) — the dashboard greets the demo user.
    await page.goto(path('/dashboard'));
    await page.waitForURL(/\/[a-z]{2}\/dashboard/, { timeout: 30_000 });
    await expect(page.locator('body')).not.toContainText('Prihlásenie | Registrácia', { timeout: 15_000 });

    // 2. The money loop.
    const before = await fetchSummary(page.request, range);
    const description = uniqueDescription('E2E flow');
    const expenses = new ExpensesPage(page);
    await expenses.goto();
    const totalBefore = await expenses.total.innerText();
    await expenses.addExpense({ amount: '50.00', description });
    await expect(expenses.transactionRow(description)).toBeVisible();
    await expect(expenses.total).not.toHaveText(totalBefore);

    // 3. The server number moved by exactly 50.00.
    const after = await fetchSummary(page.request, range);
    expect(after.totalExpensesInCents - before.totalExpensesInCents).toBe(5000);

    // 4. Reload: the row comes back from the database, not from React state.
    //    `networkidle` is unreliable in dev (Vite HMR keeps a socket open) — wait for DOM
    //    and then for the row itself.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(expenses.transactionRow(description)).toBeVisible({ timeout: 20_000 });

    // 5. The same row is visible in the transaction list.
    await page.goto(path('/transactions'));
    await expect(page.getByText(description, { exact: false }).first()).toBeVisible({ timeout: 15_000 });

    // 6. The profile page renders the account section (data export / deletion card).
    await page.goto(path('/profile'));
    await expect(page.getByText(/Údaje a súkromie|Data & privacy|Datos y privacidad/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // 7. The session really belongs to the demo account.
    const me = await page.request.get('/api/auth/user');
    expect(me.ok()).toBeTruthy();
    const user = await me.json();
    expect(String(user.email ?? '')).toContain('+clerk_test@example.com');
  });
});
