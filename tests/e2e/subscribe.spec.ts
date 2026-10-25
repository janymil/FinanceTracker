import { expect, test } from '@playwright/test';
import { E2E_ENABLED, SKIP_REASON, ensureSession, path } from './support/env';

/**
 * E2E-5 — paying.
 *
 * The real provider is never contacted: the session request is stubbed and the redirect
 * target is a page this spec serves itself. That covers the part the app owns — the plan and
 * currency it asks for, following the returned URL, and what the person sees when the
 * provider refuses — without a live Stripe account or a webhook round trip.
 *
 * Stripe is forced through `/api/billing-region` so the assertion does not depend on where
 * the CI machine appears to be located (Peru would take the MercadoPago branch instead).
 */

test.skip(!E2E_ENABLED, SKIP_REASON);

const PROVIDER_URL = 'https://checkout.kaptia.test/session';
const PROVIDER_HOST = 'https://checkout.kaptia.test/**';

test.describe('E2E-5 checkout', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSession(page);
    // Dollars + Stripe, regardless of the runner's country.
    await page.route('**/api/billing-region*', (route) =>
      route.fulfill({ json: { country: 'SK', gateway: 'stripe', currency: 'usd' } }),
    );
    // Never leave the machine: the provider page is served here.
    await page.route(PROVIDER_HOST, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>provider</title><h1>provider</h1>' }),
    );
  });

  test('choosing a plan asks for a session and follows the returned URL', async ({ page }) => {
    const asked: { plan?: string; currency?: string } = {};
    await page.route('**/api/create-checkout-session', async (route) => {
      Object.assign(asked, route.request().postDataJSON());
      await route.fulfill({ json: { url: PROVIDER_URL } });
    });

    // A plan the account does not already have: the button for the current plan is disabled
    // on purpose, so clicking it would prove nothing.
    const me = await (await page.request.get('/api/auth/user')).json();
    const testId = me.plan === 'premium' ? 'subscribe-standard-monthly' : 'subscribe-premium-monthly';
    const expectedPlan = testId.includes('premium') ? 'premium' : 'standard';

    await page.goto(path('/subscribe'));
    const button = page.getByTestId(testId);
    await expect(button).toBeEnabled();
    await button.click();

    await expect(page).toHaveURL(/checkout\.kaptia\.test/);
    expect(asked?.plan).toBe(expectedPlan);
    // The page shows one price list and the server must charge that same one.
    expect(asked?.currency).toBe('usd');
  });

  test('a refused checkout keeps the person on the page, with the button usable again', async ({ page }) => {
    await page.route('**/api/create-checkout-session', (route) =>
      route.fulfill({ status: 402, json: { error: 'card_declined' } }),
    );

    const messages: string[] = [];
    page.on('dialog', async (dialog) => {
      messages.push(dialog.message());
      await dialog.dismiss();
    });

    const me = await (await page.request.get('/api/auth/user')).json();
    const testId = me.plan === 'premium' ? 'subscribe-standard-monthly' : 'subscribe-premium-monthly';

    await page.goto(path('/subscribe'));
    const button = page.getByTestId(testId);
    await button.click();

    // Not sent to the provider, told why, and able to try another card without a reload.
    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(messages.join(' ')).toContain('card_declined');
    await expect(page).toHaveURL(/\/subscribe$/);
    await expect(button).toBeEnabled();
  });

  test('the plan you already have cannot be bought twice', async ({ page }) => {
    const me = await (await page.request.get('/api/auth/user')).json();
    test.skip(!me.plan || me.plan === 'free', 'a Free account has no current plan card to disable');

    await page.goto(path('/subscribe'));
    const current = page.getByTestId(`subscribe-${me.plan}-${me.billingInterval === 'yearly' ? 'yearly' : 'monthly'}`);
    await expect(current).toBeDisabled();
  });
});
