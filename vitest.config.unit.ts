import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

/**
 * Unit Test Configuration
 * Fast, isolated tests for individual functions/classes
 * DRY: Extends base config with unit-specific settings
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Only include unit tests
      include: ['tests/unit/**/*.test.ts'],

      // Fast timeout for unit tests
      testTimeout: 10000,  // 10 seconds
      hookTimeout: 10000,
    },
  })
);
