# Testing Quick Start Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Running Tests](#running-tests)
3. [Performance Tests](#performance-tests)
4. [Docker Compose](#docker-compose)
5. [Coverage Reports](#coverage-reports)
6. [Common Issues](#common-issues)
7. [Test Structure](#test-structure)
8. [Writing Tests](#writing-tests)
9. [CI/CD](#cicd)
10. [Performance Targets](#performance-targets)
11. [Need Help?](#need-help)

---

Quick reference for running tests in the Happy Birthday App.

## Prerequisites

```bash

# Install dependencies

npm install

# Ensure Docker is running (for integration/E2E tests)

docker ps
```

## Running Tests

### Quick Commands

```bash

# Run all tests

npm test

# Run unit tests (fast, no Docker needed)

npm run test:unit

# Run integration tests (requires Docker)

npm run test:integration

# Run E2E tests (requires Docker)

npm run test:e2e

# Run with coverage

npm run test:coverage

# Run in watch mode

npm run test:watch

# Open test UI

npm run test:ui
```

### Run Specific Test File

```bash

# Run single test file

npm test tests/unit/timezone-conversion.test.ts

# Run with pattern

npm test -- --grep "birthday"
```

## Performance Tests

```bash

# Start performance environment

npm run docker:perf

# Run sustained load test (1M messages/day)

npm run perf:k6

# Run peak load test (100+ msg/sec)

npm run perf:k6:peak

# Run worker scaling test

npm run perf:k6:worker

# Generate report

npm run perf:report

# Stop performance environment

npm run docker:perf:down
```

## Docker Compose

### Test Environment (4 containers)

```bash

# Start

npm run docker:test

# Stop

npm run docker:test:down
```

### Performance Environment (24 containers)

```bash

# Start

npm run docker:perf

# Stop

npm run docker:perf:down
```

## Coverage Reports

```bash

# Generate coverage

npm run test:coverage

# View HTML report

open coverage/index.html

# View text summary

cat coverage/coverage-summary.txt
```

## Common Issues

### "Docker not running"

```bash

# Start Docker Desktop
# or

sudo systemctl start docker
```

### "Port already in use"

```bash

# Stop existing containers

docker-compose -f docker-compose.test.yml down -v
```

### "Testcontainers timeout"

```bash

# Increase Docker memory/CPU
# Docker Desktop > Settings > Resources

```

## Test Structure

```
tests/
├── unit/           # Fast tests, no dependencies
├── integration/    # Tests with database/queue
├── e2e/           # Full system tests
├── performance/   # k6 load tests
├── helpers/       # Test utilities
└── fixtures/      # Test data
```

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Integration Test Template

```typescript
import { describe, it, beforeAll, afterAll } from 'vitest';
import { PostgresTestContainer } from '../helpers/testcontainers';

describe('Integration', () => {
  let container: PostgresTestContainer;

  beforeAll(async () => {
    container = new PostgresTestContainer();
    await container.start();
  });

  afterAll(async () => {
    await container.stop();
  });

  it('should work', async () => {
    // Test implementation
  });
});
```

## CI/CD

Tests run automatically on every PR:
- Lint & Type Check
- Unit Tests (5 parallel shards)
- Integration Tests
- E2E Tests
- Coverage Report

## Performance Targets

| Metric | Target |
|--------|--------|
| Unit Tests | < 2 min |
| Integration Tests | < 3 min |
| E2E Tests | < 5 min |
| Total CI Time | < 10 min |
| Code Coverage | 85%+ |

## Need Help?

See full documentation:
- [tests/README.md](./README.md) - Complete guide
- [TESTING_INFRASTRUCTURE_SUMMARY.md](../TESTING_INFRASTRUCTURE_SUMMARY.md) - Infrastructure overview
- [plan/04-testing/testing-strategy.md](../plan/04-testing/testing-strategy.md) - Testing strategy
