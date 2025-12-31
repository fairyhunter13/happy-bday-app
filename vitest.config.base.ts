import { defineConfig } from 'vitest/config';

/**
 * Base Vitest Configuration
 * DRY Principle: Shared configuration for all test types
 * Specific configs (unit, integration, e2e) extend this base
 */
export default defineConfig({
  test: {
    // Global test settings
    globals: true,
    environment: 'node',

    // Default excludes
    exclude: ['node_modules', 'dist'],

    // Environment variables
    env: {
      NODE_ENV: 'test',
    },

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],

      // Coverage thresholds (enforced in CI/CD)
      // NOTE: These thresholds are disabled in vitest.config.unit-ci.ts for sharded runs
      // and re-enforced in coverage-report job after merging all coverage reports
      thresholds: {
        lines: 80,        // Minimum 80% line coverage
        functions: 80,    // Minimum 80% function coverage
        branches: 75,     // Minimum 75% branch coverage
        statements: 80,   // Minimum 80% statement coverage
      },

      // Files to exclude from coverage
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts',
        '**/*.config.ts',
        '**/*.d.ts',
        '**/index.ts', // Re-export files
      ],

      // Coverage output directory
      reportsDirectory: './coverage',

      // Enable all coverage features
      all: true,
    },

    // Default timeouts
    testTimeout: 30000,  // 30 seconds
    hookTimeout: 30000,

    // Pool options for parallel execution
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 5,
        minThreads: 1,
      },
    },
  },
});
