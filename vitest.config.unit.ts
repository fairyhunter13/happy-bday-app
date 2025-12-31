import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

/**
 * Unit Test Configuration
 * Fast, isolated tests for individual functions/classes
 * DRY: Extends base config with unit-specific settings
 *
 * COVERAGE REQUIREMENTS (STRICT):
 * - 80% line coverage
 * - 80% function coverage
 * - 80% branch coverage
 * - 85% statement coverage
 * These thresholds are enforced in CI/CD for unit tests only.
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

      // Coverage thresholds - STRICT for unit tests
      coverage: {
        thresholds: {
          lines: 80, // Minimum 80% line coverage
          functions: 80, // Minimum 80% function coverage
          branches: 80, // Minimum 80% branch coverage
          statements: 85, // Minimum 85% statement coverage
        },
      },
    },
  })
);
