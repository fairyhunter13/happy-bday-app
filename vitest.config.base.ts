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
        functions: 50,    // Minimum 50% function coverage (unit tests only)
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

        // Generated code - auto-generated OpenAPI clients
        '**/generated/**',
        '**/*.gen.ts',

        // Schema/Type definitions - Zod schemas are declarative
        '**/schemas/**',
        '**/*.schemas.ts',

        // Route definitions - just Express router setup
        '**/routes/**',
        '**/*.routes.ts',

        // Bootstrap files - application startup
        'src/app.ts',
        'src/worker.ts',
        'src/index.ts',

        // Middleware - Express middleware
        '**/middleware/**',

        // Database migrations/seeds
        '**/db/migrate.ts',
        '**/db/seed.ts',

        // Interface files
        '**/*.interface.ts',

        // Validators - Zod-based validators
        '**/validators/**',

        // Queue infrastructure - RabbitMQ connection/consumer/publisher
        '**/queue/connection.ts',
        '**/queue/consumer.ts',
        '**/queue/publisher.ts',
        '**/queue/index.ts',

        // Cache infrastructure - Redis client
        '**/cache.service.ts',

        // Logger utility - console wrapper
        '**/utils/logger.ts',
        '**/utils/response.ts',

        // Timer service - simple setTimeout wrapper
        '**/services/timer.service.ts',

        // Config logger - pino configuration
        '**/config/logger.ts',

        // Database infrastructure - connection, interceptors
        '**/db/connection.ts',
        '**/db/interceptors/**',

        // Root config files
        '*.config.js',
        '*.config.ts',
        '*.config.mjs',
        'eslint.config.js',
        'vitest.config.*.ts',
        'prettier.config.mjs',

        // Queue configuration (declarative)
        '**/queue/config.ts',

        // Database schema (declarative Drizzle tables)
        '**/db/schema/*.ts',

        // Metrics services (monitoring infrastructure)
        '**/system-metrics.service.ts',

        // Scripts directory - build/deploy utilities
        'scripts/**',

        // Coverage report artifacts
        'coverage/**',
        'jscpd-report/**',

        // Controllers - Express route handlers (integration tested)
        '**/controllers/**',

        // Workers - Background job processors (integration tested)
        '**/workers/**',

        // Repositories - Database operations (integration tested)
        '**/repositories/**',

        // Clients - External API clients (integration tested)
        '**/clients/**',

        // Schedulers - Cron jobs (integration tested)
        '**/schedulers/**',
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
