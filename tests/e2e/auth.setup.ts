import { expect, test as setup } from '@playwright/test';
import { createClerkClient } from '@clerk/backend';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { E2E_ENABLED, SKIP_REASON, path } from './support/env';

/**
 * Signs the E2E runner in the way a person would: open the browser, go to /:lang/auth,
 * switch to "Sign in", type the demo account, press Continue.
 *
 * The demo account is created through the Clerk Backend API first, because a UI sign-up
 * is blocked by Cloudflare Turnstile on this instance. A `+clerk_test` address is
 * auto-verified by Clerk on a development instance, so the password sign-in completes
 * without a verification e-mail — nothing is ever sent to a real inbox.
 *
 * The resulting cookie jar is saved as `storageState`, so every other spec starts already
 * signed in without repeating the login (and without 20 logins per run).
 */

const STATE_FILE = 'tests/e2e/.auth/user.json';
const EMAIL = process.env.E2E_USER_EMAIL ?? 'kaptia.e2e+clerk_test@example.com';
const PASSWORD = process.env.E2E_USER_PASSWORD ?? 'KaptiaE2E!2026';

setup.skip(!E2E_ENABLED, SKIP_REASON);
setup('sign in as the demo account', async ({ page }) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  expect(secretKey, 'CLERK_SECRET_KEY is required for the E2E demo account').toBeTruthy();

  const clerk = createClerkClient({ secretKey });
  const existing = await clerk.users.getUserList({ emailAddress: [EMAIL] });
  if (existing.data.length === 0) {
    await clerk.users.createUser({
      emailAddress: [EMAIL],
      password: PASSWORD,
      firstName: 'E2E',
      lastName: 'Runner',
      skipPasswordChecks: true,
      // This Clerk instance requires recorded consent for every new user.
      legalAcceptedAt: new Date(),
    });
  }

  await page.goto(path('/auth'));
  // The tab is React state, not just the URL hash, so wait for the tablist and click it.
  const signInTab = page.getByRole('tab', { name: /prihlásenie|sign in|iniciar sesión/i }).first();
  await signInTab.waitFor({ state: 'visible', timeout: 30_000 });
  await signInTab.click();
  await expect(signInTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });

  await expect(page.locator('#identifier-field')).toBeVisible({ timeout: 30_000 });
  await page.locator('#identifier-field').fill(EMAIL);
  await page.locator('#password-field').fill(PASSWORD);
  await page.getByRole('button', { name: /continue|pokračovať|continuar/i }).first().click();

  // A correct login lands on the dashboard; anything else is a real failure worth seeing.
  await page.waitForURL(/\/[a-z]{2}\/dashboard/, { timeout: 45_000 });

  // First login only: choose a currency in the welcome modal and make sure the overlay is
  // gone before the state is saved for the other specs.
  const { dismissCurrencyModal } = await import('./support/env');
  await dismissCurrencyModal(page);

  mkdirSync(dirname(STATE_FILE), { recursive: true });
  await page.context().storageState({ path: STATE_FILE });

  // The PDF export is a paid feature (`POST /api/export-pdf` answers 403 for free users),
  // so the demo account is put on Standard — in the E2E database only.
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl || databaseUrl.includes('neon.tech')) {
    throw new Error(
      'Refusing to touch the plan: DATABASE_URL must point at the disposable E2E database, not production.',
    );
  }
  const me = await page.request.get('/api/auth/user');
  const user = await me.json();
  const { Client } = await import('pg');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query("update users set plan = 'standard' where id = $1", [user.id]);
  await client.end();
});
