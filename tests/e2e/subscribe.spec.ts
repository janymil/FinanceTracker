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

  test('choosing a plan asks the right thing: a session when free, a change when already paying', async ({ page }) => {
    const me = await (await page.request.get('/api/auth/user')).json();
    const testId = me.plan === 'premium' ? 'subscribe-standard-monthly' : 'subscribe-premium-monthly';
    const expectedPlan = testId.includes('premium') ? 'premium' : 'standard';
    const interval = testId.endsWith('yearly') ? 'yearly' : 'monthly';

    const asked = {
      checkout: 0,
      change: null as { plan?: string; currency?: string } | null,
      mercadoPago: null as { plan?: string; interval?: string } | null,
    };

    // Whatever the account is, /api/create-checkout-session must never be reached by someone who
    // already has paid access: it would create a second charge for the same plan.
    await page.route('**/api/create-checkout-session', async (route) => {
      asked.checkout += 1;
      await route.fulfill({ json: { url: PROVIDER_URL } });
    });
    await page.route('**/api/change-subscription', async (route) => {
      asked.change = route.request().postDataJSON();
      await route.fulfill({ json: { success: true, type: 'upgrade' } });
    });
    await page.route('**/api/mercadopago/subscribe', async (route) => {
      asked.mercadoPago = route.request().postDataJSON();
      await route.fulfill({ json: { init_point: PROVIDER_URL } });
    });
    // The change path ends with a reload and a dialog; accept whatever it says.
    page.on('dialog', (dialog) => dialog.dismiss());

    await page.goto(path('/subscribe'));
    const button = page.getByTestId(testId);
    await expect(button).toBeEnabled();
    await button.click();

    const paidWithCard = Boolean(me.stripeSubscriptionId);
    const paidWithMercadoPago = Boolean(me.mpPreapprovalId);

    if (paidWithMercadoPago) {
      // Soles are charged by MercadoPago; the interval travels with the plan.
      await expect.poll(() => asked.mercadoPago?.plan).toBe(expectedPlan);
      expect(asked.mercadoPago?.interval).toBe(interval);
      expect(asked.checkout).toBe(0);
      return;
    }

    if (paidWithCard) {
      // planKey(): monthly plans travel as the bare name, yearly ones as `premium-yearly`.
      const expectedKey = interval === 'monthly' ? expectedPlan : `${expectedPlan}-yearly`;
      await expect.poll(() => asked.change?.plan).toBe(expectedKey);
      expect(asked.change?.currency).toBe('usd');
      expect(asked.checkout).toBe(0);
      return;
    }

    // A period paid by wallet/transfer, or a free account: a wallet payer is told to pay the same
    // way instead of being sent to card checkout, and a free account gets a session.
    const walletPaid = Boolean(me.paidUntil) && new Date(me.paidUntil).getTime() > Date.now() && me.plan !== 'free';
    if (walletPaid) {
      await expect.poll(() => asked.checkout).toBe(0);
      return;
    }

    await expect(page).toHaveURL(/checkout\.kaptia\.test/);
    expect(asked.checkout).toBe(1);
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

  /**
   * The Peru path — the one that used to live *below* the plans.
   *
   * Paying in soles has three parts that only make sense together: which method, where to send
   * the money, and the document. The popup is the only place that shows all three, so these
   * cases pin: the click opens it, the Yape number is on screen before an operation number is
   * asked for, the document is stored before the claim, and the claim carries the plan that
   * was clicked.
   *
   * Both document shapes run through the same steps on purpose — a natural person who gives no
   * DNI must reach the same claim a named boleta does. Refusing them was the bug.
   */
  const documents = [
    {
      label: 'a boleta with a DNI',
      selection: 'boleta',
      number: '12345678',
      name: 'Ana Torres',
      expectedType: 'dni',
      expectedNumber: '12345678',
      expectedName: 'Ana Torres',
    },
    {
      label: 'a boleta with both optional boxes empty',
      selection: 'boleta',
      number: '',
      name: '',
      expectedType: 'none',
      // The dialog sends no number at all; the server stores SUNAT's placeholder.
      expectedNumber: undefined,
      expectedName: undefined,
    },
  ] as const;

  for (const document of documents) {
    test(`soles: ${document.label} reaches the claim through one popup`, async ({ page }) => {
      await page.route('**/api/billing-region*', (route) =>
        route.fulfill({
          json: { country: 'PE', gateway: 'mercadopago', gateways: ['mercadopago'], currency: 'pen' },
        }),
      );

      // Captured request bodies. A plain `let` here is narrowed to null by control-flow
      // analysis (the assignment happens inside a callback), so the assertions cannot read it.
      const captured: { profile: any; claim: any } = { profile: null, claim: null };
      await page.route('**/api/billing-profile', async (route) => {
        if (route.request().method() === 'PUT') {
          captured.profile = route.request().postDataJSON();
          return route.fulfill({ json: { success: true, profile: captured.profile } });
        }
        return route.fulfill({ json: { profile: null } });
      });

      await page.route('**/api/payments/manual/instructions', (route) =>
        route.fulfill({
          json: {
            legalName: 'Kaptia Peru SAC',
            yape: '987654321',
            plin: null,
            bank: { name: 'BCP', account: '193-1234567-0-11', cci: null, holder: null },
            renewsAutomatically: false,
          },
        }),
      );

      let claimReceived = false;
      await page.route('**/api/payments/manual', (route) => {
        captured.claim = route.request().postDataJSON();
        claimReceived = true;
        return route.fulfill({
          status: 201,
          json: { success: true, id: 1, status: 'pending', amountCents: 990, message: 'ok' },
        });
      });

      const me = await (await page.request.get('/api/auth/user')).json();
      test.skip(
        Boolean(me.stripeSubscriptionId || me.mpPreapprovalId),
        'this case is about buying, not about editing a card subscription',
      );

      const testId = me.plan === 'premium' ? 'subscribe-standard-monthly' : 'subscribe-premium-monthly';
      const expectedPlan = testId.includes('premium') ? 'premium' : 'standard';

      await page.goto(path('/subscribe'));
      await page.getByTestId(testId).click();

      const dialog = page.getByTestId('peru-checkout-dialog');
      await expect(dialog).toBeVisible();
      // Opening the popup charges nothing: the method is still being chosen.
      expect(claimReceived).toBe(false);

      // The wallet path shows where the money goes BEFORE asking for an operation number.
      await page.getByTestId('peru-method-yape').click();
      await expect(page.getByTestId('peru-destination')).toContainText('987654321');

      await page.getByTestId(`comprobante-kind-${document.selection}`).click();
      // Both boxes are on screen and optional; the anonymous boleta simply leaves them empty.
      await expect(page.getByTestId('comprobante-number')).toBeVisible();
      if (document.number) {
        await page.getByTestId('comprobante-number').fill(document.number);
        await page.getByTestId('comprobante-name').fill(document.name);
      }

      await page.getByTestId('peru-operation-number').fill('OP-123456');
      await page.getByTestId('peru-checkout-submit').click();

      await expect.poll(() => captured.claim?.method).toBe('yape');
      expect(captured.claim?.operationNumber).toBe('OP-123456');
      expect(captured.claim?.plan).toBe(expectedPlan);
      expect(captured.claim?.interval).toBe('monthly');
      // The document is stored before the claim, because it cannot be fixed afterwards.
      expect(captured.profile?.documentType).toBe(document.expectedType);
      expect(captured.profile?.documentNumber).toBe(document.expectedNumber);
      expect(captured.profile?.businessName).toBe(document.expectedName);
      expect(captured.profile?.kind).toBe('boleta');
      await expect(page.getByTestId('peru-checkout-dialog')).toContainText('OP-123456');
    });
  }
});


