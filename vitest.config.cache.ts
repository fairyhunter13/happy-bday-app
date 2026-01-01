import { defineConfig } from 'vitest/config';

/**
 * Vitest Cache Configuration
 *
 * Optimizations for test result caching:
 * - Cache test results to skip unchanged tests
 * - Dependency tracking for accurate cache invalidation
 * - Faster re-runs during development and CI
 *
 * Benefits:
 * - Skip tests for unchanged files
 * - Faster feedback loop in development
 * - Reduced CI execution time for incremental changes
 */
export default defineConfig({
  test: {
    // OPTIMIZATION: Enable test result caching
    cache: {
      dir: './node_modules/.vitest',
    },

    // Watch mode excludes
    watchExclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.vitest/**'],

    // OPTIMIZATION: Only re-run tests affected by changes
    changed: true, // Only run tests related to changed files

    // OPTIMIZATION: Dependency tracking
    deps: {
      // Inline dependencies for faster re-runs
      inline: ['@testcontainers/postgresql', '@testcontainers/rabbitmq', 'testcontainers'],
    },
  },
});
