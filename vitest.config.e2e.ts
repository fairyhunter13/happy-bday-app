import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

/**
 * End-to-End Test Configuration
 * Full system tests with all components running
 * DRY: Extends base config with e2e-specific settings
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Only include e2e tests
      include: ['tests/e2e/**/*.test.ts'],

      // Long timeout for e2e tests (full system startup)
      testTimeout: 120000,  // 2 minutes
      hookTimeout: 120000,

      // Run e2e tests sequentially to avoid port conflicts
      poolOptions: {
        threads: {
          singleThread: true,
        },
      },
    },
  })
);
