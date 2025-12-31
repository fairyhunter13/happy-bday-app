import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

/**
 * End-to-End Test Configuration
 * Full system tests with all components running
 * DRY: Extends base config with e2e-specific settings
 *
 * COVERAGE: No strict thresholds
 * Focus:
 * - Logic and flow correctness
 * - Validity of end-to-end scenarios
 * - User journey completeness
 *
 * E2E tests verify the entire system works as expected from
 * an external perspective, not code coverage metrics.
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Only include e2e tests
      include: ['tests/e2e/**/*.test.ts'],

      // Long timeout for e2e tests (full system startup)
      testTimeout: 120000, // 2 minutes
      hookTimeout: 120000,

      // CRITICAL: Run e2e test FILES sequentially to avoid resource conflicts
      // Each test file creates its own TestEnvironment with limited connection pools
      // Running files in parallel causes PostgreSQL connection exhaustion in CI
      fileParallelism: false,

      // Run e2e tests sequentially to avoid port conflicts
      poolOptions: {
        threads: {
          singleThread: true,
        },
      },

      // Coverage - NO strict thresholds for e2e tests
      // Focus on logic correctness and flow validity
      coverage: {
        thresholds: {
          lines: 0,
          functions: 0,
          branches: 0,
          statements: 0,
        },
      },
    },
  })
);
