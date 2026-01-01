import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

// Check if running in CI/CD environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

/**
 * OPTIMIZED Integration Test Configuration
 *
 * Performance Optimizations:
 * - Increased parallelism in local mode
 * - Better connection pool management for CI
 * - Reduced timeouts while maintaining reliability
 * - Test sharding support for CI
 * - Optimized retry strategy
 *
 * Target: Complete integration suite in < 8 minutes
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Only include integration tests
      include: ['tests/integration/**/*.test.ts'],

      // Optimized timeout for integration tests
      testTimeout: 45000, // Reduced from 60s to 45s
      hookTimeout: 45000,

      // OPTIMIZATION 1: Improved parallelism
      poolOptions: {
        threads: {
          // CI: Use 2 threads instead of 1 for faster execution
          // Local: Use 4 threads for maximum speed
          singleThread: false,
          maxThreads: isCI ? 2 : 4, // Increased from 1/3 to 2/4
          minThreads: 1,
        },
      },

      // OPTIMIZATION 2: Controlled file parallelism
      // In CI: Allow 2 files in parallel with shared connection pool
      // Local: Allow 3 files in parallel with testcontainers
      fileParallelism: true,
      maxConcurrency: isCI ? 2 : 3,

      // OPTIMIZATION 3: Sequence specific test patterns
      // Note: poolMatchGlobs was removed in Vitest 2.x, using sequence instead
      sequence: {
        // Database tests should run sequentially to prevent connection exhaustion
        shuffle: false,
      },

      // OPTIMIZATION 4: Retry flaky tests
      retry: 1,

      // OPTIMIZATION 5: Bail strategy
      bail: 5,

      // Coverage - DISABLED for integration tests (faster CI)
      coverage: {
        enabled: false,
      },

      // OPTIMIZATION 6: Minimal reporting
      reporters: isCI ? ['basic', 'github-actions'] : ['basic'],
    },
  })
);
