import { expect, test } from '@playwright/test';
import { E2E_ENABLED, SKIP_REASON } from './support/env';

/**
 * E2E-3 — PDF export through the real server, with the external PDF service stubbed.
 *
 * The stub lives in `support/pdf-stub-server.ts` and is started by `global-setup.ts`;
 * `playwright.config.ts` starts the app with `PDF_SERVICE_URL` pointing at it. This is the
 * only way to cover the server → service → download path, because `page.route()` sees
 * browser traffic only.
 *
 * The test user must have plan `standard` or `premium` — `POST /api/export-pdf` returns 403
 * for `free`.
 */

test.skip(!E2E_ENABLED, SKIP_REASON);

test.describe('E2E-3 export PDF', () => {
  test('server returns a PDF produced by the (stubbed) service', async ({ page }) => {
    // Sign-in state comes from the project's storageState / test instance.
    await page.goto('/');

    const response = await page.request.post('/api/export-pdf', {
      data: { month: 'March', year: 2026 },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');

    const body = await response.body();
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(20);
  });
});

