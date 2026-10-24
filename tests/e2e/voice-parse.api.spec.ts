import { expect, test } from '@playwright/test';
import { E2E_ENABLED, SKIP_REASON, ensureSession } from './support/env';

/**
 * E2E-2 — voice parsing through the REAL route (API level, not the microphone).
 *
 * Why not the browser: recording audio means fake media devices, mic permissions and a
 * stubbed STT provider. 90 % of the value is "does a spoken sentence become the right
 * cents", and that is exactly what `/api/voice/parse` answers. The microphone path is
 * covered by the recorded STT fixtures once real audio samples exist (blueprint 03).
 */

test.skip(!E2E_ENABLED, SKIP_REASON);

test.beforeEach(async ({ page }) => {
  await ensureSession(page);
});

test.describe('E2E-2 voice parse', () => {
  test('expense sentence yields cents, type and review flag', async ({ page }) => {
    const response = await page.request.post('/api/voice/parse', {
      data: { transcript: 'Obed včera 12,50', userLanguage: 'sk' },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.amountInCents).toBe(1250);
    expect(body.data.type).toBe('expense');
    expect(body.data.needsReview).toBe(false);
    expect(body.data.note).toBe('Obed včera 12,50');
  });

  test('salary sentence is classified as income', async ({ page }) => {
    const response = await page.request.post('/api/voice/parse', {
      data: { transcript: 'Dostal som výplatu 2450 eur', userLanguage: 'sk' },
    });

    const body = await response.json();
    expect(body.data.amountInCents).toBe(245000);
    expect(body.data.type).toBe('income');
  });

  test('an utterance without an amount is flagged for review, never guessed', async ({ page }) => {
    const response = await page.request.post('/api/voice/parse', {
      data: { transcript: 'Nič som nekúpil', userLanguage: 'sk' },
    });

    const body = await response.json();
    expect(body.data.amountInCents).toBeNull();
    expect(body.data.needsReview).toBe(true);
  });

  test('rejects an empty transcript with 400', async ({ page }) => {
    const response = await page.request.post('/api/voice/parse', {
      data: { transcript: '', userLanguage: 'sk' },
    });

    expect(response.status()).toBe(400);
  });
});
