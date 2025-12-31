import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

// Check if running in CI/CD environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

/**
 * Integration Test Configuration
 * Tests with database, message queue, and external dependencies
 * DRY: Extends base config with integration-specific settings
 *
 * COVERAGE: No strict thresholds
 * Focus: Logic correctness, proper integration between components
 * These tests verify that components work together correctly.
 *
 * CI Mode: Runs in single thread to avoid connection pool exhaustion
 * Local Mode: Runs with 3 threads for faster execution
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Only include integration tests
      include: ['tests/integration/**/*.test.ts'],

      // Medium timeout for integration tests
      testTimeout: 60000, // 1 minute
      hookTimeout: 60000,

      // In CI: Use single thread to prevent connection pool exhaustion
      // when all tests connect to the same docker-compose PostgreSQL instance
      // Local: Use multiple threads since testcontainers create isolated instances
      poolOptions: {
        threads: {
          singleThread: isCI,
          maxThreads: isCI ? 1 : 3,
          minThreads: 1,
        },
      },

      // Serialize file execution in CI to prevent race conditions
      ...(isCI ? { fileParallelism: false } : {}),

      // Coverage - NO strict thresholds for integration tests
      // Focus on logic correctness, not coverage metrics
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
