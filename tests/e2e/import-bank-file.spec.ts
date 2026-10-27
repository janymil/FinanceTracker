import { expect, test } from '@playwright/test';
import {
  E2E_ENABLED,
  SKIP_REASON,
  currentMonthKey,
  ensureSession,
  fetchSummary,
  monthRange,
  path,
  setPlan,
  uniqueDescription,
} from './support/env';

/**
 * E2E-4 — importing a bank statement.
 *
 * The parsing rules themselves are unit-tested (`tests/unit/statementImport.test.ts`). What
 * was never covered is the path a person actually walks: pick a file, the server previews
 * what it understood, confirm, and the money lands in the database to the cent. That path
 * is the easiest place to create duplicates, so it deserves the same oracle as `add-expense`:
 * the cent-exact delta from `/api/financial-summary`.
 */

test.skip(!E2E_ENABLED, SKIP_REASON);

/** Today, in the day-first format a Peruvian bank exports. */
function todayDayFirst(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${now.getFullYear()}`;
}

/** One expense, using the separate debit/credit columns most banks produce. */
function statementCsv(description: string, debit: string): string {
  return ['Fecha,Descripcion,Cargo,Abono', `${todayDayFirst()},"${description}",${debit},`].join('\n');
}

test.describe('E2E-4 bank statement import', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSession(page);
    // Importing is Premium: the server refuses it for anyone else (`/api/import` in
    // `server/routes/exportRoutes.ts`) and the page is wrapped in `RequirePlan`. This used to say
    // "Standard", which made the whole spec unreachable — it waited 60s for a tab that never
    // rendered, and nothing said why.
    await setPlan(page, 'premium');
  });

  test('a CSV is previewed, then imported for exactly its amount', async ({ page }) => {
    const range = monthRange(currentMonthKey());
    const before = await fetchSummary(page.request, range);
    const description = uniqueDescription('E2E bank');

    await page.goto(path('/export'));
    // Import lives on the export page, in its own tab — and that tab's content is not rendered
    // until it is selected, so the source cards below do not exist yet.
    await page.getByTestId('export-tab-import').click();
    await page.getByTestId('import-source-bank-file').click();
    await page.getByTestId('import-file-input').setInputFiles({
      name: 'statement.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(statementCsv(description, '25.00'), 'utf8'),
    });

    // The server decides what the rows are; the preview is the person's last chance to say no.
    const preview = page.getByTestId('import-preview');
    await expect(preview).toBeVisible();
    await expect(preview.getByText(description, { exact: false })).toBeVisible();

    await page.getByTestId('confirm-import').click();
    await expect(preview).toBeHidden();

    const after = await fetchSummary(page.request, range);
    expect(after.totalExpensesInCents - before.totalExpensesInCents).toBe(2500);
  });

  test('a file it cannot understand imports nothing', async ({ page }) => {
    const range = monthRange(currentMonthKey());
    const before = await fetchSummary(page.request, range);

    await page.goto(path('/export'));
    await page.getByTestId('export-tab-import').click();
    await page.getByTestId('import-source-bank-file').click();
    await page.getByTestId('import-file-input').setInputFiles({
      name: 'not-a-statement.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('hola\nmundo\n', 'utf8'),
    });

    // No header row, so no preview: the toast explains it and nothing is written.
    await expect(page.getByTestId('import-preview')).toBeHidden();
    const after = await fetchSummary(page.request, range);
    expect(after.totalExpensesInCents).toBe(before.totalExpensesInCents);
  });
});
