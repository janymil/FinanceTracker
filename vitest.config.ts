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
  },
});
