import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

// Check if running in CI/CD environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

/**
 * OPTIMIZED End-to-End Test Configuration
 *
 * Performance Optimizations:
 * - Increased pool worker threads for parallel test execution (local only)
 * - Reduced timeouts while maintaining reliability
 * - Sequential file execution in CI to prevent resource conflicts
 * - Added sequence setup to prevent resource conflicts
 * - Optimized retry and bail strategies
 *
 * Target: Complete E2E suite in < 10 minutes
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Only include e2e tests
      include: ['tests/e2e/**/*.test.ts'],

      // Optimized timeout for e2e tests
      testTimeout: 90000, // Reduced from 120s to 90s (1.5 minutes)
      hookTimeout: 90000,

      // OPTIMIZATION 1: Controlled file parallelism
      // IMPORTANT: Disabled in CI to prevent RabbitMQConnection singleton conflicts
      // E2E tests share the same RabbitMQ connection singleton and can interfere
      fileParallelism: !isCI,
      maxConcurrency: isCI ? 1 : 2,

      // OPTIMIZATION 2: Thread configuration
      poolOptions: {
        threads: {
          // CI: Use single thread to ensure test isolation
          // Local: Allow parallelism with testcontainers
          singleThread: isCI,
          maxThreads: isCI ? 1 : 3,
          minThreads: 1,
        },
      },

      // OPTIMIZATION 3: Sequence setup to manage resources
      // Tests within a file can run in parallel, but setup is sequential
      sequence: {
        setupFiles: 'list', // Run setup files in order
        hooks: 'stack', // Run hooks in stack order
      },

      // OPTIMIZATION 4: Retry strategy for flaky tests
      retry: 1, // Retry failed tests once to handle transient failures

      // OPTIMIZATION 5: Bail on multiple failures
      bail: 5, // Stop after 5 failures to save time

      // Coverage - DISABLED for E2E tests (faster execution)
      coverage: {
        enabled: false,
      },

      // OPTIMIZATION 6: Reduce reporter overhead
      reporters: ['basic'], // Minimal reporting for faster execution
    },
  })
);
