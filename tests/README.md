# Testing Infrastructure

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Running Tests](#running-tests)
4. [Performance Tests](#performance-tests)
5. [Test Helpers](#test-helpers)
6. [CI/CD Integration](#cicd-integration)
7. [Writing Tests](#writing-tests)
8. [Coverage Reports](#coverage-reports)
9. [Debugging Tests](#debugging-tests)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [Resources](#resources)

---

Complete testing infrastructure for the Happy Birthday App with unit, integration, E2E, and performance tests.

## Overview

This testing infrastructure follows the testing pyramid approach with:
- **Unit Tests (50%)**: Fast, isolated tests for business logic
- **Integration Tests (30%)**: Database and RabbitMQ integration tests
- **E2E Tests (20%)**: Full end-to-end flow tests
- **Performance Tests**: k6 load tests for 1M+ messages/day

### Coverage Goals

- **Unit Tests**: 85%+ coverage
- **Integration Tests**: 80%+ coverage
- **E2E Tests**: 75%+ coverage
- **Overall**: 85%+ code coverage

## Directory Structure

```
tests/
├── unit/                     # Unit tests (fast, isolated)
│   ├── timezone-conversion.test.ts
│   ├── idempotency.test.ts
│   └── message-scheduling.test.ts
├── integration/              # Integration tests (with real services)
│   └── database-integration.test.ts
├── e2e/                      # End-to-end tests
│   └── birthday-flow.test.ts
├── performance/              # k6 performance tests
│   ├── sustained-load.js     # 1M messages/day (11.5 msg/sec)
│   ├── peak-load.js          # 100+ msg/sec
│   ├── worker-scaling.js     # Worker scaling efficiency
│   └── generate-report.ts    # Report generator
├── helpers/                  # Test utilities
│   ├── testcontainers.ts     # Testcontainers setup
│   └── test-helpers.ts       # Helper functions
├── fixtures/                 # Test data
│   ├── users.ts              # User fixtures
│   └── messages.ts           # Message fixtures
└── README.md                 # This file
```

## Running Tests

### Prerequisites

```bash
npm install
```

### Unit Tests

Fast tests with no external dependencies:

```bash

# Run all unit tests

npm run test:unit

# Run with coverage

npm run test:unit -- --coverage

# Run in watch mode

npm run test:watch
```

### Integration Tests

Tests with PostgreSQL and RabbitMQ using Testcontainers:

```bash

# Run all integration tests

npm run test:integration

# Requires Docker to be running

```

### E2E Tests

Full end-to-end tests with Docker Compose:

```bash

# Start test environment

npm run docker:test

# Run E2E tests

npm run test:e2e

# Stop test environment

npm run docker:test:down
```

### All Tests

```bash

# Run all tests with coverage

npm run test:coverage
```

### Test UI

```bash

# Open Vitest UI

npm run test:ui
```

## Performance Tests

### Prerequisites

Install k6:

```bash

# macOS

brew install k6

# Ubuntu

sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Running Performance Tests

```bash

# Start performance environment (24 containers)

npm run docker:perf

# Run sustained load test (1M messages/day for 24 hours)

npm run perf:k6

# Run peak load test (100+ msg/sec)

npm run perf:k6:peak

# Run worker scaling test

npm run perf:k6:worker

# Generate performance report

npm run perf:report

# Stop performance environment

npm run docker:perf:down
```

### Performance Targets

| Test | Target | Duration |
|------|--------|----------|
| Sustained Load | 11.5 msg/sec | 24 hours |
| Peak Load | 100+ msg/sec | 5 minutes |
| Latency (p95) | < 500ms | - |
| Latency (p99) | < 1000ms | - |
| Error Rate | < 1% | - |

## Test Helpers

### Testcontainers

Automatically manages test containers for PostgreSQL, RabbitMQ, and Redis:

```typescript
import { TestEnvironment } from './helpers/testcontainers';

const env = new TestEnvironment();
await env.setup(); // Starts all containers
await env.runMigrations(); // Runs database migrations
// ... run tests
await env.teardown(); // Stops all containers
```

### Test Fixtures

Predefined test data:

```typescript
import { testUsers } from './fixtures/users';

const user = testUsers.johnUtc; // User in UTC with birthday today
const user = testUsers.janeNewYork; // User in New York
```

### Helper Functions

```typescript
import {
  insertUser,
  findUserByEmail,
  createTestUser,
  waitFor,
} from './helpers/test-helpers';

// Create and insert test user
const user = await insertUser(pool, createTestUser());

// Wait for condition
await waitFor(async () => {
  const messages = await findMessageLogsByUserId(pool, user.id);
  return messages.length > 0;
}, 10000);
```

## CI/CD Integration

### GitHub Actions

The project uses parallel test execution with 5 shards for unit tests:

```yaml

# .github/workflows/ci.yml

jobs:
  unit-tests:
    strategy:
      matrix:
        shard: [1, 2, 3, 4, 5]
    steps:
      - run: npm run test:unit -- --shard=${{ matrix.shard }}/5
```

### Test Workflow

1. **Lint & Type Check**: ESLint and TypeScript validation
2. **Unit Tests**: 5 parallel shards (< 2 min per shard)
3. **Integration Tests**: With service containers (< 3 min)
4. **E2E Tests**: With Docker Compose (< 5 min)
5. **Coverage Report**: Merged coverage from all tests

### Performance Tests

Weekly performance tests run on Sundays at 2am UTC:

```yaml

# .github/workflows/performance.yml

on:
  schedule:
    - cron: '0 2 * * 0'
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresTestContainer } from '../helpers/testcontainers';

describe('Database Integration', () => {
  let container: PostgresTestContainer;

  beforeAll(async () => {
    container = new PostgresTestContainer();
    await container.start();
  });

  afterAll(async () => {
    await container.stop();
  });

  it('should query database', async () => {
    const pool = container.getPool();
    const result = await pool.query('SELECT 1');
    expect(result.rows).toHaveLength(1);
  });
});
```

### E2E Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestEnvironment } from '../helpers/testcontainers';

describe('Birthday Flow E2E', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();
  });

  afterAll(async () => {
    await env.teardown();
  });

  it('should send birthday message', async () => {
    // Test implementation
  });
});
```

## Coverage Reports

Coverage reports are generated in multiple formats:

```bash

# Run tests with coverage

npm run test:coverage

# View HTML report

open coverage/index.html

# View text summary

cat coverage/coverage-summary.txt
```

### Coverage Files

- `coverage/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format for CI/CD
- `coverage/coverage-final.json` - JSON format

## Debugging Tests

### Debug Single Test

```bash

# Run specific test file

npm run test tests/unit/timezone-conversion.test.ts

# Run with debugging

node --inspect-brk node_modules/.bin/vitest run tests/unit/timezone-conversion.test.ts
```

### Test Logs

```bash

# Enable verbose logging

npm run test -- --reporter=verbose

# Enable test logs in Testcontainers

DEBUG=testcontainers* npm run test:integration
```

## Best Practices

1. **Keep unit tests fast**: No external dependencies
2. **Use Testcontainers for integration tests**: Real services, isolated
3. **Clean up after tests**: Use beforeEach/afterEach hooks
4. **Use fixtures**: Predefined test data for consistency
5. **Test edge cases**: Timezones, leap years, concurrent operations
6. **Follow AAA pattern**: Arrange, Act, Assert
7. **Use descriptive test names**: What, When, Expected result

## Troubleshooting

### Testcontainers Issues

```bash

# Ensure Docker is running

docker ps

# Clean up orphaned containers

docker system prune -a
```

### Port Conflicts

If you get port conflicts, check running containers:

```bash
docker ps
docker-compose -f docker-compose.test.yml down -v
```

### Slow Tests

```bash

# Run tests in parallel

npm run test:unit -- --pool=threads --poolOptions.threads.maxThreads=4

# Skip E2E tests during development

npm run test:unit && npm run test:integration
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testcontainers Documentation](https://testcontainers.com/)
- [k6 Documentation](https://k6.io/docs/)
- [Testing Best Practices](../plan/04-testing/testing-strategy.md)
