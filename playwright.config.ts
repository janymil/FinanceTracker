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
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5000';
const MANAGED_SERVER = process.env.E2E_MANAGED_SERVER === '1';
const E2E_ENABLED = process.env.E2E_ENABLED === '1';
const STORAGE_STATE = 'tests/e2e/.auth/user.json';

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
    // NOTE: do not add a global `x-user-language` header here. Playwright applies
    // extraHTTPHeaders to every request in the context, including Clerk's CDN, and the
    // resulting CORS preflight makes Clerk's own script fail to load (`failed_to_load_clerk_js`).
  },

  projects: [
    // When E2E is enabled, one setup run signs in and everything else reuses its cookies.
    ...(E2E_ENABLED ? [{ name: 'setup', testMatch: /auth\.setup\.ts/ }] : []),
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...(E2E_ENABLED ? { storageState: STORAGE_STATE } : {}) },
      ...(E2E_ENABLED ? { dependencies: ['setup'] } : {}),
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], ...(E2E_ENABLED ? { storageState: STORAGE_STATE } : {}) },
      testMatch: /add-expense\.spec\.ts/,
      ...(E2E_ENABLED ? { dependencies: ['setup'] } : {}),
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
