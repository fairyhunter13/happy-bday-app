import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 120000, // 2 minutes for E2E tests
    hookTimeout: 120000,
    poolOptions: {
      threads: {
        singleThread: true, // Run E2E tests sequentially
      },
    },
  },
});
