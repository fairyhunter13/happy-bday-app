import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 60000,
    hookTimeout: 60000,
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 3,
        minThreads: 1,
      },
    },
  },
});
