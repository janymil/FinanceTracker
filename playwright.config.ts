import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for Kaptia (blueprint 05).
 *
 * The suite is OPT-IN: specs call `test.skip(!E2E_ENABLED, …)` because a real run needs
 * a Clerk **test** instance, a seeded database and a running server. `--list` works
 * without any of that, so the config and specs can be reviewed in CI.
 *
 * Why only a few flows: Clerk login + `/:lang/` prefixes (59 routes) + SSR
 * (`server/ssr.ts`) + `countryBlockingMiddleware` make each flow expensive and flaky.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5000';
const MANAGED_SERVER = process.env.E2E_MANAGED_SERVER === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  outputDir: 'test-results/artifacts',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'test-results/html' }],
  ],

  // Starts the local PDF stub (see support/pdf-stub-server.ts). No-op unless E2E_ENABLED=1.
  globalSetup: './tests/e2e/global-setup.ts',

  use: {
    baseURL: BASE_URL,
    locale: 'sk-SK',
    timezoneId: 'Europe/Bratislava',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Tests must never touch a human's account or production Clerk.
    extraHTTPHeaders: process.env.E2E_LOCALE ? { 'x-user-language': process.env.E2E_LOCALE } : {},
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      testMatch: /add-expense\.spec\.ts/,
    },
  ],

  // Start the app automatically only when explicitly asked (it needs DATABASE_URL,
  // Clerk test keys and country blocking disabled).
  ...(MANAGED_SERVER
    ? {
        webServer: {
          command: 'npm run dev',
          url: `${BASE_URL}/api/health`,
          reuseExistingServer: true,
          timeout: 180_000,
          env: {
            NODE_ENV: 'development',
            DISABLE_COUNTRY_BLOCKING: '1',
            // Point the app at the local stub instead of pdf-processor.formatika.dev.
            PDF_SERVICE_URL: `http://127.0.0.1:${process.env.E2E_PDF_STUB_PORT ?? 4010}`,
            PDF_API_KEY: 'e2e-stub-key',
          },
        },
      }
    : {}),
});
