import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

/**
 * OPTIMIZED End-to-End Test Configuration
 *
 * Performance Optimizations:
 * - Increased pool worker threads for parallel test execution
 * - Reduced timeouts while maintaining reliability
 * - Enabled test file parallelism with resource management
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

      // OPTIMIZATION 1: Enable controlled parallelism for test FILES
      // Run up to 2 test files in parallel to balance speed and resource usage
      // Each file gets its own TestEnvironment with isolated containers
      fileParallelism: true,
      maxConcurrency: 2, // Limit concurrent test files to prevent resource exhaustion

      // OPTIMIZATION 2: Parallel execution within each test file
      poolOptions: {
        threads: {
          singleThread: false, // Enable parallelism
          maxThreads: 3, // Up to 3 threads per file
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
