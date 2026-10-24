import { expect, test } from '@playwright/test';
import { E2E_ENABLED, SKIP_REASON, ensureSession, path } from './support/env';

/**
 * The two promises that must hold in production, checked against the running server:
 *
 *   1. a free account never reaches an AI provider (every AI route answers 403 with
 *      `plan_required`, including receipt scanning);
 *   2. the switch in Profile → Preferences really stops AI for the account.
 *
 * The demo account is on the free plan, so it can prove (1) directly and (2) for the
 * persistence part of the switch.
 */
test.describe('AI consent gate', () => {
  test.skip(!E2E_ENABLED, SKIP_REASON);

  test('free plan is refused by every AI endpoint', async ({ page }) => {
    await ensureSession(page);

    const me = await page.request.get('/api/auth/user');
    expect(me.ok()).toBeTruthy();
    expect((await me.json()).plan).toBe('free');

    for (const endpoint of ['/api/ai/insights', '/api/ai/tip']) {
      const response = await page.request.post(endpoint, { data: {} });
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
