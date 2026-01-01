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

      // Pass through CI environment variables to test processes
      // CRITICAL: Tests need CI/GITHUB_ACTIONS to detect CI mode and use GitHub Actions services
      env: {
        NODE_ENV: 'test',
        CI: process.env.CI || 'false',
        GITHUB_ACTIONS: process.env.GITHUB_ACTIONS || 'false',
        DATABASE_URL: process.env.DATABASE_URL || '',
        RABBITMQ_URL: process.env.RABBITMQ_URL || '',
        REDIS_URL: process.env.REDIS_URL || '',
      },

      // Optimized timeout for integration tests
      testTimeout: 45000, // Reduced from 60s to 45s
      hookTimeout: 45000,

      // OPTIMIZATION 1: Thread configuration
      poolOptions: {
        threads: {
          // CI: Use single thread to ensure test isolation
          // Local: Use 4 threads for maximum speed with testcontainers
          singleThread: isCI,
          maxThreads: isCI ? 1 : 4,
          minThreads: 1,
        },
      },

      // OPTIMIZATION 2: Controlled file parallelism
      // IMPORTANT: Disabled in CI to prevent test interference
      // Queue tests share the same PostgreSQL database and can interfere with each other
      // when running in parallel (one test's beforeEach cleanup affects another test's data)
      fileParallelism: !isCI,
      maxConcurrency: isCI ? 1 : 3,

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
