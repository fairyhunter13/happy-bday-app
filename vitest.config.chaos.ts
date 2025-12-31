import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.base';

// Check if running in CI/CD environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

/**
 * Chaos Test Configuration
 * Tests for resilience, fault tolerance, and recovery scenarios
 * DRY: Extends base config with chaos-specific settings
 *
 * COVERAGE: No thresholds (chaos tests focus on resilience, not coverage)
 * Focus: System resilience under failure conditions
 * These tests verify the system handles failures gracefully.
 *
 * CI Mode: Runs in single thread to avoid resource contention
 * Local Mode: Runs with 2 threads for reasonable execution time
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Only include chaos tests
      include: ['tests/chaos/**/*.test.ts'],

      // Long timeout for chaos tests (they involve container restarts, etc.)
      testTimeout: 120000, // 2 minutes
      hookTimeout: 120000,

      // In CI: Use single thread to prevent resource exhaustion
      // Chaos tests are resource-intensive and require isolated execution
      poolOptions: {
        threads: {
          singleThread: isCI,
          maxThreads: isCI ? 1 : 2,
          minThreads: 1,
        },
      },

      // Serialize file execution in CI to prevent race conditions
      ...(isCI ? { fileParallelism: false } : {}),

      // Coverage - NO thresholds for chaos tests
      // Focus on resilience testing, not coverage metrics
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
