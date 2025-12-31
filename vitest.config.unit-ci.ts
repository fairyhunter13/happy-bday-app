import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

/**
 * Unit Test Configuration for CI (Sharded Tests)
 *
 * This configuration is used when running sharded tests in CI/CD.
 * Coverage thresholds are DISABLED here because:
 * - Each shard only runs a subset of tests
 * - Individual shard coverage will always be incomplete
 * - Coverage thresholds are checked after merging all shard reports
 *
 * Coverage thresholds are enforced in the `coverage-report` job
 * after all shard coverage reports are merged.
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Only include unit tests
      include: ['tests/unit/**/*.test.ts'],

      // Fast timeout for unit tests
      testTimeout: 10000, // 10 seconds
      hookTimeout: 10000,

      // Coverage thresholds DISABLED for sharded CI runs
      // Thresholds are checked after merging all coverage reports
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
