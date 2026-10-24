import { expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Shared E2E helpers. No secrets, no production URLs — everything is env-driven.
 */

export const E2E_ENABLED = process.env.E2E_ENABLED === '1';
export const LOCALE = process.env.E2E_LOCALE ?? 'sk';

export const SKIP_REASON =
  'E2E requires a Clerk test instance + seeded database + running server. ' +
  'Set E2E_ENABLED=1 (see tests/e2e/README.md).';

/**
 * Clerk session tokens are short-lived; a saved cookie jar is only useful once the
 * browser has loaded the app and the Clerk client refreshed the token. Without this,
 * the first API call of a spec answers 401 even though the user is "signed in".
 */
/**
 * A brand-new account is asked "which currency?" in a modal overlay. While that overlay is
 * open, every click on the page below fails with "element intercepts pointer events" — a
 * confusing failure that has nothing to do with the feature under test. Dismiss it the way
 * a person would, with an API fallback if the animation swallows the click.
 */
export async function dismissCurrencyModal(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog').first();
  try {
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    return; // no modal for this account
  }

  await dialog.getByRole('button').first().click().catch(() => undefined);
  try {
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  } catch {
    await page.request.put('/api/auth/user', { data: { currency: '$' } });
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
}

export async function ensureSession(page: Page): Promise<void> {
  await page.goto(`/${LOCALE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await expect
    .poll(async () => (await page.request.get('/api/auth/user')).status(), { timeout: 45_000 })
    .toBe(200);
  await dismissCurrencyModal(page);
}

/** Path helper — every route in this app is locale prefixed (/:lang/...). */
export function path(route: string): string {
  return `/${LOCALE}${route.startsWith('/') ? route : `/${route}`}`;
}

/** "YYYY-MM" for the local calendar, matching how the dashboard picks "this month". */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Inclusive month bounds as ISO strings, same local-time semantics as the backend. */
export function monthRange(monthKey: string): { start: string; end: string } {
  const [year, month] = monthKey.split('-').map(Number);
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString(),
    end: new Date(year, month, 0, 23, 59, 59, 999).toISOString(),
  };
}

export interface FinancialSummary {
  totalIncomeInCents: number;
  totalExpensesInCents: number;
  netBalanceInCents: number;
}

/**
 * Reads the cent-exact summary straight from the API — the oracle for UI assertions.
 * `totalExpensesInCents` exists because step 2 of the testing work added it.
 */
export async function fetchSummary(
  request: APIRequestContext,
  range: { start: string; end: string },
): Promise<FinancialSummary> {
  const response = await request.get(
    `/api/financial-summary?startDate=${encodeURIComponent(range.start)}&endDate=${encodeURIComponent(range.end)}`,
  );
  if (!response.ok()) {
    throw new Error(`financial-summary failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as FinancialSummary;
}

/** Unique description so parallel/repeated runs never collide on a text assertion. */
export function uniqueDescription(prefix = 'E2E'): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export type { Page };
