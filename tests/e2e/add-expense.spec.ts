import { expect, test } from '@playwright/test';
import { ExpensesPage } from './pages/expenses-page';
import {
  E2E_ENABLED,
  ensureSession,
  SKIP_REASON,
  currentMonthKey,
  fetchSummary,
  monthRange,
  uniqueDescription,
} from './support/env';

/**
 * E2E-1 — the money loop users actually complain about:
 * add an expense in the UI, then verify the cent-exact number on the server and that
 * the UI reflects it.
 */

test.skip(!E2E_ENABLED, SKIP_REASON);

// Clerk tokens are short-lived: load the app once so the session is refreshed before
// any API call in this spec.
test.beforeEach(async ({ page }) => {
  await ensureSession(page);
});

test.describe('E2E-1 add expense', () => {
  test('adding 50.00 moves totalExpensesInCents by exactly 5000', async ({ page }) => {
    const range = monthRange(currentMonthKey());
    const before = await fetchSummary(page.request, range);

    const expenses = new ExpensesPage(page);
    await expenses.goto();
    const totalBefore = await expenses.total.innerText();

    const description = uniqueDescription('E2E lunch');
    await expenses.addExpense({ amount: '50.00', description });

    // UI reflects the new row ...
    await expect(expenses.transactionRow(description)).toBeVisible();
    // ... the displayed total changed ...
    await expect(expenses.total).not.toHaveText(totalBefore);
    // ... and the server number moved by exactly 50.00 EUR.
    const after = await fetchSummary(page.request, range);
    expect(after.totalExpensesInCents - before.totalExpensesInCents).toBe(5000);
  });

  test('a double click on save creates exactly one transaction', async ({ page }) => {
    const range = monthRange(currentMonthKey());
    const before = await fetchSummary(page.request, range);

    const expenses = new ExpensesPage(page);
    await expenses.goto();

    const description = uniqueDescription('E2E double');
    await expenses.openDialog();
    await expenses.fillExpense({ amount: '10.00', description });

    // Two clicks in the same tick — the exact thing an impatient user does. Dispatching
    // both from the page avoids Playwright's "wait until stable/attached" behaviour, which
    // would serialise them and hide the race we are testing.
    await page.getByTestId('transaction-save').evaluate((element) => {
      (element as HTMLButtonElement).click();
      (element as HTMLButtonElement).click();
    });

    // The dialog must close and only one row may exist.
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(description, { exact: false })).toHaveCount(1, { timeout: 20_000 });

    const after = await fetchSummary(page.request, range);
    expect(after.totalExpensesInCents - before.totalExpensesInCents).toBe(1000);
  });
});
