import { expect, test } from '@playwright/test';
import { E2E_ENABLED, SKIP_REASON, ensureSession, path, setPlan } from './support/env';

/**
 * The two promises that must hold in production, checked against the running server:
 *
 *   1. a free account never reaches an AI provider (every AI route answers 403 with
 *      `plan_required`, including receipt scanning);
 *   2. the switch in Profile → Preferences really stops AI for the account.
 *
 * The demo account is put on the free plan for (1) and back on Standard afterwards, so the
 * other specs (PDF export needs a paid plan) are not affected by the order they run in.
 */
test.describe('AI consent gate', () => {
  test.skip(!E2E_ENABLED, SKIP_REASON);

  test('free plan is refused by every AI endpoint', async ({ page }) => {
    await ensureSession(page);
    await setPlan(page, 'free');

    try {
      const me = await page.request.get('/api/auth/user');
      expect(me.ok()).toBeTruthy();
      expect((await me.json()).plan).toBe('free');

      // Methods matter: insights is a GET, categorize is a POST (a wrong method would hit no
      // route at all). `/api/ai/tip` used to be the POST here; it was removed when the three
      // other advice panels were.
      const calls = [
        { endpoint: '/api/ai/insights', send: () => page.request.get('/api/ai/insights') },
        { endpoint: '/api/ai/categorize', send: () => page.request.post('/api/ai/categorize', { data: { transactions: [] } }) },
      ];
      for (const { endpoint, send } of calls) {
        const response = await send();
        expect(response.status(), endpoint).toBe(403);
        expect((await response.json()).code, endpoint).toBe('plan_required');
      }

      // Receipt scanning is AI: the photo must not be read for a free account.
      const upload = await page.request.post('/api/upload-receipt', {
        multipart: {
          receipt: { name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from('not-an-image') },
        },
      });
      expect(upload.status()).toBe(403);
      expect((await upload.json()).code).toBe('plan_required');
    } finally {
      await setPlan(page, 'standard');
    }
  });

  test('the AI switch persists and can be turned back on', async ({ page }) => {
    await ensureSession(page);

    try {
      const off = await page.request.put('/api/auth/user', { data: { aiEnabled: false } });
      expect(off.ok()).toBeTruthy();

      const afterOff = await (await page.request.get('/api/auth/user')).json();
      expect(afterOff.aiEnabled).toBe(false);

      // The UI reflects the stored value after a reload.
      await page.goto(path('/profile'), { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: /preferences|preferencie|preferencias/i }).click();
      const toggle = page.getByTestId('ai-toggle');
      await expect(toggle).toBeVisible({ timeout: 20_000 });
      await expect(toggle).not.toBeChecked();

      await expect(page.getByText(/AI processing is currently off|Spracovanie pomocou AI je pre tento účet|procesamiento con IA está desactivado/i).first()).toBeVisible();
    } finally {
      const on = await page.request.put('/api/auth/user', { data: { aiEnabled: true } });
      expect(on.ok()).toBeTruthy();
    }
  });
});
