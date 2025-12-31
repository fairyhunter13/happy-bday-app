# E2E Tests - Birthday Message Scheduler

## Table of Contents

1. [Test Coverage](#test-coverage)
2. [Test Infrastructure](#test-infrastructure)
3. [Running Tests](#running-tests)
4. [Test Configuration](#test-configuration)
5. [Test Helpers](#test-helpers)
6. [Performance Reports](#performance-reports)
7. [Debugging Tests](#debugging-tests)
8. [CI/CD Integration](#cicd-integration)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)
11. [Coverage Goals](#coverage-goals)
12. [Future Improvements](#future-improvements)

---

Comprehensive end-to-end tests for the birthday message scheduling system.

## Test Coverage

### 1. Complete Birthday Message Flow (`birthday-message-flow.test.ts`)

Tests the complete end-to-end flow from user creation to message delivery:

- ✅ User creation via API
- ✅ Daily scheduler triggers message creation
- ✅ Message log created with SCHEDULED status
- ✅ Minute scheduler enqueues messages
- ✅ Messages published to RabbitMQ
- ✅ Worker processes messages
- ✅ Message status updated to SENT
- ✅ External API called (mock server)
- ✅ Duplicate prevention (idempotency)
- ✅ Both birthday and anniversary messages
- ✅ Timing accuracy (9am in user timezone)

**Coverage Target**: 95%+ on critical paths

### 2. Multi-Timezone Flow (`multi-timezone-flow.test.ts`)

Tests message delivery across multiple timezones:

- ✅ 12+ timezones (comprehensive global coverage)
- ✅ All users with same calendar day birthday
- ✅ Messages sent at 9am in each timezone
- ✅ UTC send time ordering verification
- ✅ DST (Daylight Saving Time) handling
- ✅ Edge case timezones (half-hour, quarter-hour offsets)
- ✅ International Date Line crossing
- ✅ Extreme timezones (UTC+14, UTC-12)
- ✅ 100 concurrent users across random timezones

**Timezones Tested**:
- Pacific/Auckland (UTC+12)
- Asia/Tokyo (UTC+9)
- Europe/London (UTC+0)
- America/New_York (UTC-5)
- America/Los_Angeles (UTC-8)
- Pacific/Honolulu (UTC-10)
- And many more...

### 3. Error Handling and Recovery (`error-recovery.test.ts`)

Tests error scenarios and recovery mechanisms:

- ✅ External API failures (500, 429 errors)
- ✅ Retry mechanism with exponential backoff
- ✅ Circuit breaker pattern (opens after threshold)
- ✅ Messages moved to DLQ after max retries
- ✅ Recovery scheduler finds missed messages
- ✅ Graceful degradation
- ✅ Timeout handling
- ✅ Error message tracking
- ✅ API response code tracking

**Error Scenarios**:
- HTTP 500 (Internal Server Error)
- HTTP 429 (Rate Limit)
- HTTP 400 (Bad Request)
- Network timeouts
- Slow responses
- Random failures

### 4. Concurrent Message Processing (`concurrent-messages.test.ts`)

Tests system behavior under high concurrency:

- ✅ 100 users with same birthday
- ✅ All messages processed concurrently
- ✅ No duplicates (idempotency at scale)
- ✅ Worker pool handles load
- ✅ Race condition prevention
- ✅ Database transaction isolation
- ✅ Multiple workers processing simultaneously
- ✅ Database connection pool efficiency

**Load Tests**:
- 100 concurrent users
- Multiple worker processes
- Concurrent scheduling operations
- Database consistency under writes

### 5. Performance Baseline (`performance-baseline.test.ts`)

Establishes performance baselines and tracks metrics:

- ✅ End-to-end latency measurement
- ✅ Throughput (messages per second)
- ✅ Resource utilization (memory, CPU)
- ✅ Performance degradation detection
- ✅ SLA compliance verification
- ✅ Performance report generation

**Metrics Tracked**:
- Scheduling time
- Enqueueing time
- Processing time
- Total E2E latency
- Throughput (msg/s)
- P50, P95, P99 latencies
- Memory usage
- Success/error rates

**SLA Targets**:
- Throughput: > 10 messages/second
- Max Latency: < 5 seconds
- Success Rate: > 95%

## Test Infrastructure

### Testcontainers

All E2E tests use **Testcontainers** for real service dependencies:

```typescript
import { TestEnvironment } from '../helpers/testcontainers.js';

const env = new TestEnvironment();
await env.setup(); // Starts PostgreSQL + RabbitMQ + Redis

// Run tests...

await env.teardown(); // Cleanup
```

**Services Started**:
- PostgreSQL 15 (with migrations)
- RabbitMQ 3.12 (with management)
- Redis 7 (for caching)

### Mock Email Server

Custom HTTP server that simulates the external email API:

```typescript
import { createMockEmailServer } from '../helpers/mock-email-server.js';

const server = await createMockEmailServer();
server.setResponseMode('error-500'); // Simulate failures
server.setErrorCount(3); // First 3 requests fail

// Track requests
expect(server.getRequestCount()).toBe(5);
expect(server.getLastRequest().body.email).toBe('test@test.com');

await server.stop();
```

**Features**:
- Configurable response modes (success, error, timeout)
- Request tracking and verification
- Delay simulation
- Random failure mode
- Statistics and analytics

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npm run test:e2e -- birthday-message-flow
```

### Run with Coverage

```bash
npm run test:coverage
```

### Run in Watch Mode

```bash
npm run test:watch
```

## Test Configuration

### Timeouts

E2E tests have extended timeouts due to Testcontainers startup:

```typescript
// vitest.config.e2e.ts
export default defineConfig({
  test: {
    testTimeout: 120000,  // 2 minutes
    hookTimeout: 120000,   // 2 minutes
    poolOptions: {
      threads: {
        singleThread: true, // Sequential execution
      },
    },
  },
});
```

### Environment Variables

Tests use environment variables for configuration:

```bash

# Database (provided by Testcontainers)

DATABASE_URL=postgresql://test:test@localhost:5432/test_db

# RabbitMQ (provided by Testcontainers)

RABBITMQ_URL=amqp://test:test@localhost:5672

# Mock Email Server (dynamic port)

MESSAGE_API_URL=http://localhost:DYNAMIC_PORT/api/messages
```

## Test Helpers

### `testcontainers.ts`

Manages Docker containers for PostgreSQL, RabbitMQ, and Redis:

```typescript
export class TestEnvironment {
  async setup(): Promise<void>
  async teardown(): Promise<void>
  getPostgresPool(): Pool
  getRabbitMQConnection(): Connection
}

export async function cleanDatabase(pool: Pool): Promise<void>
export async function purgeQueues(connection: Connection, queues: string[]): Promise<void>
export async function waitFor(condition: () => Promise<boolean>, timeout: number): Promise<void>
```

### `test-helpers.ts`

Database and RabbitMQ helper functions:

```typescript
export function createTestUser(overrides?: Partial<TestUser>): TestUser
export async function insertUser(pool: Pool, user: TestUser): Promise<TestUser>
export async function insertMessageLog(pool: Pool, log: TestMessageLog): Promise<TestMessageLog>
export async function findMessageLogsByUserId(pool: Pool, userId: string): Promise<TestMessageLog[]>
export async function publishTestMessage(connection: Connection, queue: string, message: object): Promise<void>
export async function consumeMessages(connection: Connection, queue: string): Promise<any[]>
```

### `mock-email-server.ts`

HTTP server for simulating external API:

```typescript
export class MockEmailServer {
  setResponseMode(mode: ResponseMode): void
  setErrorCount(count: number): void
  setRequestDelay(ms: number): void
  getRequests(): MockRequest[]
  getRequestCount(): number
  getLastRequest(): MockRequest | undefined
  verifyRequest(email: string, expectedFields: object): boolean
  reset(): void
}
```

## Performance Reports

Performance tests generate JSON reports in `tests/e2e/reports/`:

```json
{
  "generatedAt": "2025-12-30T12:00:00.000Z",
  "environment": {
    "nodeVersion": "v20.x.x",
    "platform": "darwin",
    "arch": "arm64"
  },
  "metrics": [
    {
      "testName": "throughput-100",
      "userCount": 100,
      "totalLatency": 5234,
      "throughput": 19.1,
      "p50Latency": 250,
      "p95Latency": 1200,
      "p99Latency": 2500,
      "successRate": 0.98
    }
  ],
  "summary": {
    "averageThroughput": 15.6,
    "averageLatency": 3200,
    "maxThroughput": 19.1,
    "minLatency": 150
  },
  "slaCompliance": {
    "meetsRequirements": true
  }
}
```

## Debugging Tests

### Enable Verbose Logging

```bash
DEBUG=* npm run test:e2e
```

### View Container Logs

```bash
docker logs <container_id>
```

### Inspect Database State

```typescript
// Add this to any test for debugging
const result = await pool.query('SELECT * FROM message_logs');
console.log('Messages:', result.rows);
```

### Mock Server Debugging

```typescript
mockEmailServer.setResponseMode('success');
console.log('Requests:', mockEmailServer.getRequests());
console.log('Stats:', mockEmailServer.getStats());
```

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload performance report
        uses: actions/upload-artifact@v3
        with:
          name: performance-report
          path: tests/e2e/reports/
```

## Best Practices

### 1. Test Isolation

- Each test cleans database and queues before running
- Tests run sequentially to avoid resource conflicts
- Containers are shared across tests in same file but isolated between files

### 2. Realistic Scenarios

- Use real PostgreSQL, RabbitMQ, Redis (via Testcontainers)
- Mock only external APIs (email service)
- Test with realistic data (100+ users, multiple timezones)

### 3. Comprehensive Coverage

- Happy path + error scenarios
- Edge cases (DST, timezone boundaries)
- Performance and scale
- Race conditions and concurrency

### 4. Fast Feedback

- Parallel test execution where possible
- Optimized container startup
- Efficient cleanup between tests

### 5. Maintainability

- Reusable test helpers
- Clear test descriptions
- Well-documented test infrastructure

## Troubleshooting

### Tests Timeout

- Increase timeout in `vitest.config.e2e.ts`
- Check Docker resources (CPU, memory)
- Verify network connectivity

### Container Startup Fails

- Check Docker daemon is running
- Verify port availability
- Check Docker resource limits

### Flaky Tests

- Add wait conditions (`waitFor`)
- Check for race conditions
- Verify cleanup between tests

### Performance Issues

- Check Docker resources
- Optimize database queries
- Review connection pool settings

## Coverage Goals

- **Critical Paths**: 95%+
  - Timezone conversion
  - Idempotency enforcement
  - Message scheduling
  - Message delivery

- **Error Handling**: 90%+
  - Retry mechanisms
  - Circuit breaker
  - DLQ handling
  - Recovery scheduler

- **Overall**: 85%+

## Future Improvements

- [ ] Add load testing with k6
- [ ] Implement chaos testing
- [ ] Add visual regression tests
- [ ] Performance profiling integration
- [ ] Database migration testing
- [ ] Disaster recovery scenarios
