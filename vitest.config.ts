import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

/**
 * Main Vitest Configuration
 * Extends base config with settings for all test types
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Include all test files
      include: ['tests/**/*.test.ts'],

      // Longer timeout for integration/e2e tests
      testTimeout: 120000,  // 2 minutes
      hookTimeout: 120000,
    },
  })
);
