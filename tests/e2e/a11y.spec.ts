import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_ENABLED, SKIP_REASON, ensureSession, path, setPlan } from './support/env';

/**
 * E2E-6 — the accessibility gate.
 *
 * Counting `aria-label` occurrences says nothing about whether the app can actually be used:
 * it misses contrast, a control with no name at all, a dialog that traps the keyboard and an
 * ARIA attribute that lies. This runs axe on the pages where money moves and fails on the two
 * severities a person cannot work around on their own (critical, serious).
 *
 * Rules follow WCAG 2.1 A/AA. Copy is never asserted — pages are reached by URL and axe works
 * on structure, so translated text cannot make this spec fail for the wrong reason.
 */

test.skip(!E2E_ENABLED, SKIP_REASON);

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
/** A missing accessible name, a broken ARIA attribute or an unlabelled field is not "a nit". */
const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

/** Runs axe and fails with the rule id, the impact and the offending selectors. */
async function expectNoBlockingViolations(page: Page, where: string): Promise<void> {
  // Audit the real screen, not its skeleton. The dashboard lazy-loads several widgets behind a
  // placeholder, and axe was scoring the "Loading..." text of a card that no customer ever
  // sees for more than a moment. Waiting is also what a person does.
  await expect(page.locator('[data-testid="lazy-loading"]'))
    .toHaveCount(0, { timeout: 20_000 })
    .catch(() => undefined);

  // Skeletons are excluded on purpose: the card carries `animate-pulse`, so axe samples the text
  // mid-fade and reports a contrast ratio that no user ever sees (and some dev-server chunks never
  // resolve at all). The placeholder keeps `role="status"` so a screen reader still announces it.
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('[data-testid="lazy-loading"]')
    .analyze();
  const blocking = violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''));

  const report = blocking
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 5)
        .map((node) => `      ${node.target.join(' ')}\n        ${node.html.slice(0, 300)}`);
      return `  ${violation.id} [${violation.impact}] ${violation.help} (${violation.nodes.length})\n${nodes.join('\n')}`;
    })
    .join('\n');

  expect(blocking, `${where}: ${blocking.length} blocking accessibility violation(s)\n${report}`).toHaveLength(0);
}

test.describe('E2E-6 accessibility', () => {
  // This spec audits up to four screens per test and waits for lazy widgets to arrive before
  // scoring them. On a cold Vite dev bundle that is comfortably more than the 60s default, and a
  // timeout looks exactly like a violation in the report — so it gets its own budget.
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await ensureSession(page);
  });

  test('the dashboard and the expenses form', async ({ page }) => {
    await page.goto(path('/dashboard'));
    await expect(page.locator('main')).toBeVisible();
    await expectNoBlockingViolations(page, 'dashboard');

    await page.goto(path('/expenses'));
    const addButton = page.getByTestId('add-expense').first();
    await expect(addButton).toBeVisible();
    await expectNoBlockingViolations(page, 'expenses');

    // The dialog is where the labels matter: an unlabelled amount field is invisible to a
    // screen reader, and a dialog that does not trap focus loses the keyboard behind it.
    await addButton.click();
    await expect(page.locator('#tx-amount')).toBeVisible();
    await expectNoBlockingViolations(page, 'expenses · add dialog');
  });

  test('the export and import page', async ({ page }) => {
    // The page is wrapped in `RequirePlan plan="premium"`, so on the standing Standard account
    // this audited an upgrade prompt. Premium here, back to Standard afterwards so the other
    // specs see the account they expect.
    await setPlan(page, 'premium');
    await page.goto(path('/export'));
    await expect(page.getByTestId('export-run')).toBeVisible();
    await expectNoBlockingViolations(page, 'export');
    await setPlan(page, 'standard');
  });

  test('the subscribe page', async ({ page }) => {
    await page.goto(path('/subscribe'));
    await expect(page.getByTestId('subscribe-standard-monthly')).toBeVisible();
    await expectNoBlockingViolations(page, 'subscribe');
  });

  test('the profile page', async ({ page }) => {
    await page.goto(path('/profile'));
    await expect(page.locator('main')).toBeVisible();
    await expectNoBlockingViolations(page, 'profile');
  });

  test('the landing page', async ({ page }) => {
    await page.goto(path(''));
    await expect(page.locator('main, body').first()).toBeVisible();
    await expectNoBlockingViolations(page, 'landing');
  });
});
