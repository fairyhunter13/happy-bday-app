import { defineConfig } from 'vitest/config';

/**
 * Performance Test Configuration
 *
 * Specialized configuration for performance baseline tests.
 * These tests measure system performance and should run quickly.
 *
 * Target: Complete performance tests in < 5 minutes
 */
export default defineConfig({
  test: {
    // Global test settings
    globals: true,
    environment: 'node',

    // Only include performance tests
    include: ['tests/e2e/performance-baseline.test.ts'],

    // Environment variables
    env: {
      NODE_ENV: 'test',
      ENABLE_DB_METRICS: 'true', // Enable metrics for performance tests
    },

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // Performance test timeouts
    testTimeout: 60000, // 1 minute per test
    hookTimeout: 90000, // 1.5 minutes for setup/teardown

    // Run performance tests sequentially for accurate measurements
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },

    // No coverage for performance tests
    coverage: {
      enabled: false,
    },

    // Detailed reporting for performance metrics
    reporters: ['verbose'],
  },
});
