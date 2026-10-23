import { expect, test } from '@playwright/test';
import { ExpensesPage } from './pages/expenses-page';
import {
  E2E_ENABLED,
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

test.describe('E2E-1 add expense', () => {
  test('adding 50.00 moves totalExpensesInCents by exactly 5000', async ({ page, request }) => {
    const range = monthRange(currentMonthKey());
    const before = await fetchSummary(request, range);

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
    const after = await fetchSummary(request, range);
    expect(after.totalExpensesInCents - before.totalExpensesInCents).toBe(5000);
  });

  test('a double click on save creates exactly one transaction', async ({ page, request }) => {
    const range = monthRange(currentMonthKey());
    const before = await fetchSummary(request, range);

    const expenses = new ExpensesPage(page);
    await expenses.goto();

    const description = uniqueDescription('E2E double');
    await expenses.openDialog();
    await expenses.fillExpense({ amount: '10.00', description });

    // Two clicks in quick succession: the second must not produce a second row.
    await expenses.save();
    await expenses.save().catch(() => undefined);

    const after = await fetchSummary(request, range);
    expect(after.totalExpensesInCents - before.totalExpensesInCents).toBe(1000);
  });
});
