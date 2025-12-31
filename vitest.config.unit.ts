import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

/**
 * Unit Test Configuration
 * Fast, isolated tests for individual functions/classes
 * DRY: Extends base config with unit-specific settings
 *
 * COVERAGE REQUIREMENTS:
 * - 80% line coverage
 * - 50% function coverage (unit tests only - infrastructure functions excluded)
 * - 75% branch coverage
 * - 80% statement coverage
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

      // Coverage thresholds for unit tests
      coverage: {
        thresholds: {
          lines: 80, // Minimum 80% line coverage
          functions: 50, // Minimum 50% function coverage (unit tests only)
          branches: 75, // Minimum 75% branch coverage
          statements: 80, // Minimum 80% statement coverage
        },
      },
    },
  })
);
