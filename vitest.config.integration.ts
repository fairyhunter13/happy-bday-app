import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

/**
 * Integration Test Configuration
 * Tests with database, message queue, and external dependencies
 * DRY: Extends base config with integration-specific settings
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Only include integration tests
      include: ['tests/integration/**/*.test.ts'],

      // Medium timeout for integration tests
      testTimeout: 60000,  // 1 minute
      hookTimeout: 60000,

      // Fewer threads for integration tests (they use more resources)
      poolOptions: {
        threads: {
          singleThread: false,
          maxThreads: 3,
          minThreads: 1,
        },
      },
    },
  })
);
