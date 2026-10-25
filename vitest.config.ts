import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Unit tests run with NO database, NO network and NO AI keys.
 * Anything that needs Postgres belongs in `tests/integration` and is
 * additionally guarded by DATABASE_URL_TEST (see testing-blueprint/00-testing-strategy.md).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/ai/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'external-services/**',
      'tests/e2e/**',
      'tests/ai/images/**',
    ],
    testTimeout: 10_000,
    hookTimeout: 20_000,
    // Goldens must never depend on the runner's clock.
    unstubGlobals: true,
    /**
     * Coverage is scoped on purpose: these four files decide what a number on a screen means,
     * and each one already has tests. A repo-wide percentage would mostly measure how much React
     * exists, which is a fact we already know — see `testing-blueprint/00-testing-strategy.md`
     * §2 for why thresholds were originally left out and what changed.
     */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['shared/money.ts', 'shared/calculations.ts', 'shared/trackingInput.ts', 'lib/aiProvider.ts'],
      all: false,
      /**
       * Measured on 2026-10-25: 98.09 statements / 89.13 branches / 95.65 functions / 98.09 lines.
       * The numbers sit a few points below what is there today, so this is a ratchet against
       * regression rather than a tripwire a small refactor trips.
       */
      thresholds: { statements: 95, branches: 85, functions: 90, lines: 95 },
    },
  },
});
