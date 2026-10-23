import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Shared E2E helpers. No secrets, no production URLs — everything is env-driven.
 */

export const E2E_ENABLED = process.env.E2E_ENABLED === '1';
export const LOCALE = process.env.E2E_LOCALE ?? 'sk';

export const SKIP_REASON =
  'E2E requires a Clerk test instance + seeded database + running server. ' +
  'Set E2E_ENABLED=1 (see tests/e2e/README.md).';

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
