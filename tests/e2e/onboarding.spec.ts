import { expect, test, type Page } from '@playwright/test';
import { createClerkClient } from '@clerk/backend';
import { Webhook } from 'svix';
import { E2E_ENABLED, LOCALE, SKIP_REASON, path } from './support/env';

/**
 * Login and a brand-new person's first minutes, with a real Clerk test user:
 *
 *   signed out → deep link → sign in → back on the page they asked for → pick a currency
 *   (suggested first) → welcome (time zone, first transaction) → it never comes back.
 *
 * Plus the protected API for anonymous callers and Clerk's signed webhook.
 * Nothing here uses a real inbox: a `+clerk_test` address is auto-verified on a Clerk
 * development instance, and the user is deleted afterwards.
 */
test.skip(!E2E_ENABLED, SKIP_REASON);

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5000';
const stamp = Date.now();
const EMAIL = `kaptia.e2e.onboarding${stamp}+clerk_test@example.com`;
const PASSWORD = 'KaptiaE2E!2026';
const DESCRIPTION = `Káva ${stamp}`;

function clerk() {
  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}

function disposableDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  if (!url || url.includes('neon.tech')) {
    throw new Error('DATABASE_URL must point at the disposable E2E database, not a hosted one.');
  }
  return url;
}

async function signInThroughTheForm(page: Page) {
  const signInTab = page.getByRole('tab', { name: /prihlásenie|sign in|iniciar sesión/i }).first();
  await signInTab.waitFor({ state: 'visible', timeout: 30_000 });
  await signInTab.click();
  await expect(signInTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
  await expect(page.locator('#identifier-field')).toBeVisible({ timeout: 30_000 });
  await page.locator('#identifier-field').fill(EMAIL);
  await page.locator('#password-field').fill(PASSWORD);
  await page.getByRole('button', { name: /continue|pokračovať|continuar/i }).first().click();
}

test.describe('anonymous visitors', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the protected API refuses callers who are not signed in', async ({ request }) => {
    for (const url of ['/api/auth/user', '/api/transactions', '/api/budgets', '/api/goals', '/api/financial-summary?startDate=2026-01-01&endDate=2026-01-31', '/api/export?format=csv&includeTransactions=true']) {
      expect((await request.get(url)).status(), url).toBe(401);
    }
    expect((await request.post('/api/transactions', { data: { amount: 1, type: 'expense', description: 'x', date: new Date().toISOString() } })).status()).toBe(401);
  });

  test('an endpoint that does not exist answers 404 as JSON, not the home page', async ({ request }) => {
    for (const [method, url] of [['get', '/api/does-not-exist'], ['post', '/api/ai/insights-typo']] as const) {
      const response = await request[method](url);
      expect(response.status(), `${method} ${url}`).toBe(404);
      expect(response.headers()['content-type']).toContain('application/json');
    }
  });

  test('the sign-up page shows the terms notice and links to both policies', async ({ page }) => {
    await page.goto(path('/auth#sign-up'));
    const notice = page.getByTestId('signup-terms-notice');
    await expect(notice).toBeVisible({ timeout: 30_000 });
    await expect(notice.locator('a[href$="/terms-of-service"]')).toHaveCount(1);
    await expect(notice.locator('a[href$="/privacy-policy"]')).toHaveCount(1);
  });

  test('refuses to bounce a visitor to another site after sign-in', async ({ page }) => {
    await page.goto(path('/auth?redirect=%2F%2Fevil.example#sign-in'));
    await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).hostname).toBe(new URL(BASE_URL).hostname);
  });
});

test.describe('a brand-new account, start to finish', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: { cookies: [], origins: [] } });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    await clerk().users.createUser({
      emailAddress: [EMAIL],
      password: PASSWORD,
      firstName: 'Nová',
      lastName: 'Používateľka',
      skipPasswordChecks: true,
      legalAcceptedAt: new Date(),
    });
    page = await browser.newPage({ baseURL: BASE_URL, locale: 'sk-SK', timezoneId: 'Europe/Bratislava' });
  });

  test.afterAll(async () => {
    await page?.close();
    const found = await clerk().users.getUserList({ emailAddress: [EMAIL] });
    for (const user of found.data) await clerk().users.deleteUser(user.id);
  });

  test('a deep link while signed out goes to sign-in and returns there afterwards', async () => {
    await page.goto(path('/budget'));
    await page.waitForURL(new RegExp(`/${LOCALE}/auth\\?redirect=%2F${LOCALE}%2Fbudget`), { timeout: 30_000 });
    await signInThroughTheForm(page);
    await page.waitForURL(new RegExp(`/${LOCALE}/budget`), { timeout: 45_000 });
  });

  test('the first thing asked is the currency, with a suggestion from where they live', async () => {
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    // Time zone Europe/Bratislava → euro
    const suggestion = page.getByTestId('currency-suggested-EUR');
    await expect(suggestion).toBeVisible();
    await expect(page.getByTestId('currency-PEN')).toBeVisible(); // everything else is still there

    await suggestion.click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    const me = await (await page.request.get('/api/auth/user')).json();
    expect(me.currency).toBe('EUR');
  });

  test('the time zone was saved automatically and the welcome shows it', async () => {
    const welcome = page.getByTestId('first-run-welcome');
    await expect(welcome).toBeVisible({ timeout: 20_000 });
    await expect(welcome.getByTestId('timezone-setting')).toContainText(/stredoeurópsky|central european|europa central/i);
    await expect.poll(async () => (await (await page.request.get('/api/auth/user')).json()).timezone, { timeout: 15_000 }).toBe('Europe/Bratislava');
  });

  test('the first transaction is saved from the welcome (comma decimals included)', async () => {
    const welcome = page.getByTestId('first-run-welcome');
    await welcome.getByTestId('welcome-next').click();

    // Nothing is sent for an empty form
    await welcome.getByTestId('welcome-save').click();
    await expect(welcome.getByTestId('welcome-message')).toBeVisible();

    await welcome.getByTestId('welcome-amount').fill('12,50');
    await welcome.getByTestId('welcome-description').fill(DESCRIPTION);
    await welcome.getByTestId('welcome-save').click();
    await expect(welcome).toBeHidden({ timeout: 15_000 });

    const transactions = await (await page.request.get('/api/transactions')).json();
    const saved = transactions.find((t: any) => t.description === DESCRIPTION);
    expect(saved).toBeTruthy();
    expect(saved.amount).toBe('12.50');
    expect(saved.type).toBe('expense');
  });

  test('the welcome never comes back, and a Free account sees steps it can actually do', async () => {
    await page.goto(path('/dashboard'));
    const checklist = page.getByTestId('onboarding-checklist');
    await expect(checklist).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('first-run-welcome')).toHaveCount(0);

    // Free plan: no budget or goal steps (they answer 403), a way to see the plans instead.
    await expect(checklist.locator('a[href$="/budget"]')).toHaveCount(0);
    await expect(checklist.locator('a[href$="/goals"]')).toHaveCount(0);
    await expect(checklist.locator('a[href$="/pricing"]')).toHaveCount(1);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('onboarding-checklist')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('first-run-welcome')).toHaveCount(0);
  });

  test('the currency is locked once there is money history', async () => {
    expect((await page.request.put('/api/auth/user', { data: { currency: 'PEN' } })).status()).toBe(409);
    expect((await page.request.put('/api/auth/user', { data: { currency: 'EUR' } })).status()).toBe(200);
    const me = await (await page.request.get('/api/auth/user')).json();
    expect(me.currency).toBe('EUR');
  });

  test('Free is still held to its limits for the new account', async () => {
    expect((await page.request.get('/api/budgets')).status()).toBe(403);
    expect((await page.request.get('/api/goals')).status()).toBe(403);
    expect((await page.request.get('/api/export?format=csv&includeTransactions=true')).status()).toBe(403);
  });
});

test.describe('Clerk webhook (signed, runs in development too)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  const secret = process.env.CLERK_WEBHOOK_SECRET ?? '';
  const userId = `user_e2e_hook_${stamp}`;

  async function send(request: any, event: object, { sign = true, id = `msg_${Math.random().toString(36).slice(2)}` } = {}) {
    const body = JSON.stringify(event);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (sign) {
      const now = new Date();
      headers['svix-id'] = id;
      headers['svix-timestamp'] = String(Math.floor(now.getTime() / 1000));
      headers['svix-signature'] = new Webhook(secret).sign(id, now, body);
    }
    const response = await request.post('/api/clerk-webhooks', { headers, data: body });
    return { status: response.status() as number, json: await response.json().catch(() => ({})) };
  }

  async function rowFor(id: string) {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: disposableDatabaseUrl() });
    await client.connect();
    try {
      return (await client.query('select id, email, first_name, currency from users where id = $1', [id])).rows[0];
    } finally {
      await client.end();
    }
  }

  const created = {
    type: 'user.created',
    data: {
      id: userId,
      email_addresses: [{ id: 'e1', email_address: `${userId}@example.com` }],
      primary_email_address_id: 'e1',
      first_name: 'Hook',
      last_name: 'Test',
      created_at: Date.now(),
    },
  };

  test.skip(!secret, 'CLERK_WEBHOOK_SECRET is not set for this run');

  test('unsigned and badly signed requests are refused', async ({ request }) => {
    expect((await send(request, created, { sign: false })).status).toBe(400);
    const forged = await request.post('/api/clerk-webhooks', {
      headers: { 'content-type': 'application/json', 'svix-id': 'msg_forged', 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
      data: JSON.stringify(created),
    });
    expect(forged.status()).toBe(400);
    expect(await rowFor(userId)).toBeUndefined();
  });

  test('created → duplicate → updated → deleted, with settings left alone', async ({ request }) => {
    expect((await send(request, created)).json.outcome).toBe('created');
    expect((await rowFor(userId))?.email).toBe(`${userId}@example.com`);

    // Clerk delivering it twice, or the first dashboard load winning the race, is harmless
    expect((await send(request, created)).json.outcome).toBe('already-exists');

    // A setting changed in the app must survive an identity update from Clerk
    const { Client } = await import('pg');
    const client = new Client({ connectionString: disposableDatabaseUrl() });
    await client.connect();
    await client.query("update users set currency = 'PEN' where id = $1", [userId]);
    await client.end();

    const updated = await send(request, { type: 'user.updated', data: { ...created.data, first_name: 'Renamed' } });
    expect(updated.json.outcome).toBe('updated');
    const row = await rowFor(userId);
    expect(row.first_name).toBe('Renamed');
    expect(row.currency).toBe('PEN');

    expect((await send(request, { type: 'user.deleted', data: { id: userId } })).json.outcome).toBe('deleted');
    expect(await rowFor(userId)).toBeUndefined();
    expect((await send(request, { type: 'user.deleted', data: { id: userId } })).json.outcome).toBe('nothing-to-delete');
  });
});

test.describe('when the network misbehaves during the first minute', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: { cookies: [], origins: [] } });

  const email = `kaptia.e2e.flaky${stamp}+clerk_test@example.com`;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    await clerk().users.createUser({ emailAddress: [email], password: PASSWORD, firstName: 'Flaky', lastName: 'Network', skipPasswordChecks: true, legalAcceptedAt: new Date() });
    page = await browser.newPage({ baseURL: BASE_URL, locale: 'sk-SK', timezoneId: 'Europe/Bratislava' });
  });

  test.afterAll(async () => {
    await page?.close();
    const found = await clerk().users.getUserList({ emailAddress: [email] });
    for (const user of found.data) await clerk().users.deleteUser(user.id);
  });

  test('a failed account load says so and offers a retry instead of silently skipping the currency', async () => {
    // Only the account endpoint fails; everything else (Clerk, the app shell) works.
    await page.route('**/api/auth/user', (route) => (route.request().method() === 'GET' ? route.abort('failed') : route.continue()));

    await page.goto(path('/auth#sign-in'));
    const signInTab = page.getByRole('tab', { name: /prihlásenie|sign in|iniciar sesión/i }).first();
    await signInTab.click();
    await page.locator('#identifier-field').fill(email);
    await page.locator('#password-field').fill(PASSWORD);
    await page.getByRole('button', { name: /continue|pokračovať|continuar/i }).first().click();
    await page.waitForURL(new RegExp(`/${LOCALE}/dashboard`), { timeout: 45_000 });

    await expect(page.getByTestId('account-load-failed')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('currency-suggestion')).toHaveCount(0); // never asks over a currency it could not read

    // Network back: Retry loads the account and the currency question appears.
    await page.unroute('**/api/auth/user');
    await page.getByTestId('account-load-failed').getByRole('button').click();
    await expect(page.getByTestId('currency-suggestion')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('account-load-failed')).toHaveCount(0);
  });

  test('a failed save shows an inline error and the same click works once the network is back', async () => {
    await page.route('**/api/auth/user', (route) => (route.request().method() === 'PUT' ? route.fulfill({ status: 500, body: '{"message":"boom"}', contentType: 'application/json' }) : route.continue()));

    await page.getByTestId('currency-suggested-EUR').click();
    await expect(page.getByTestId('currency-error')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('currency-suggestion')).toBeVisible(); // still there, nothing was lost

    await page.unroute('**/api/auth/user');
    await page.getByTestId('currency-suggested-EUR').click();
    await expect(page.getByTestId('currency-suggestion')).toHaveCount(0, { timeout: 15_000 });
    const me = await (await page.request.get('/api/auth/user')).json();
    expect(me.currency).toBe('EUR');
  });

  test('then the welcome can be skipped and does not return', async () => {
    const welcome = page.getByTestId('first-run-welcome');
    await expect(welcome).toBeVisible({ timeout: 20_000 });
    await welcome.getByTestId('welcome-skip').click();
    await expect(welcome).toBeHidden();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('onboarding-checklist')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('first-run-welcome')).toHaveCount(0);
  });
});
