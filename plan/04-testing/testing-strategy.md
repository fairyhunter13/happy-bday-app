# Testing Strategy - Birthday Message Scheduler

**Last Updated:** 2025-12-30

---

## Table of Contents

1. [Overview](#overview)
2. [Testing Pyramid](#testing-pyramid)
3. [Simple E2E Tests for CI/CD](#simple-e2e-tests-for-cicd)
4. [Scalable Performance Tests](#scalable-performance-tests)
5. [Message Type Abstraction Testing](#message-type-abstraction-testing)
6. [Database Performance Testing](#database-performance-testing)
7. [CI/CD Integration](#cicd-integration)

---

## Overview

### Testing Requirements

1. **Simple E2E in CI/CD:** Fast tests (< 5 min) with minimal containers
2. **Scalable Performance Tests:** Load tests for 1M+ msg/day with 20+ containers
3. **Abstraction Testing:** Generic tests that work with ANY message type
4. **Scale Testing:** Verify system handles 11.5 msg/sec sustained, 100+ msg/sec peak

### Testing Philosophy

- **Fast feedback:** Unit tests run in < 1 minute
- **Simple CI/CD:** E2E tests use 4 containers, run in < 5 minutes
- **Scalable perf:** Performance tests run weekly with full infrastructure
- **Generic framework:** Tests automatically work with new message types

---

## Testing Pyramid

```
         ╱╲
        ╱  ╲
       ╱ E2E ╲          ← Simple setup (4 containers)
      ╱────────╲           GitHub Actions: < 5 min
     ╱          ╲
    ╱ Integration╲       ← API + Database integration
   ╱──────────────╲        GitHub Actions: < 3 min
  ╱                ╲
 ╱   Unit Tests     ╲    ← Fast, isolated, mocked
╱────────────────────╲     GitHub Actions: < 2 min

Performance Tests (Separate)  ← 20+ containers, weekly schedule
```

### Test Distribution

| Type | Count | Coverage | Duration |
|------|-------|----------|----------|
| **Unit** | ~200 tests | 85%+ | < 2 min |
| **Integration** | ~50 tests | 80%+ | < 3 min |
| **E2E** | ~20 tests | 75%+ | < 5 min |
| **Performance** | ~10 scenarios | N/A | 30-60 min |

---

## Simple E2E Tests for CI/CD

### Docker Compose Setup (4 containers, < 5 min)

```yaml
# docker-compose.test.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    healthcheck:
      test: ["CMD", "pg_isready"]
      interval: 5s

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  api:
    build: .
    environment:
      NODE_ENV: test
      DATABASE_URL: postgres://test:test@postgres/test_db
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build: .
    command: npm run worker
    environment:
      NODE_ENV: test
      DATABASE_URL: postgres://test:test@postgres/test_db
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

### E2E Test Suite

```typescript
// tests/e2e/birthday-flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, teardown, createUser, triggerScheduler } from './helpers';

describe('Birthday Message E2E Flow', () => {
  beforeAll(async () => {
    await setup(); // Start containers, migrate DB
  });

  afterAll(async () => {
    await teardown(); // Stop containers, cleanup
  });

  it('should send birthday message at 9am user timezone', async () => {
    // 1. Create user with birthday today
    const user = await createUser({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      timezone: 'America/New_York',
      birthdayDate: new Date('1990-12-30'), // Today's date
    });

    // 2. Trigger daily scheduler
    await triggerScheduler('daily-precalculation');

    // 3. Wait for message to be scheduled
    const scheduled = await db.query.messageLogs.findFirst({
      where: eq(messageLogs.userId, user.id),
    });

    expect(scheduled).toBeDefined();
    expect(scheduled.messageType).toBe('BIRTHDAY');
    expect(scheduled.status).toBe('SCHEDULED');

    // 4. Trigger minute scheduler to enqueue
    await triggerScheduler('minute-enqueue');

    // 5. Wait for worker to process (max 10 seconds)
    await waitFor(async () => {
      const message = await db.query.messageLogs.findFirst({
        where: eq(messageLogs.userId, user.id),
      });
      return message?.status === 'SENT';
    }, 10000);

    // 6. Verify message sent
    const sent = await db.query.messageLogs.findFirst({
      where: eq(messageLogs.userId, user.id),
    });

    expect(sent.status).toBe('SENT');
    expect(sent.actualSendTime).toBeDefined();
    expect(sent.messageContent).toContain('Happy 35th!'); // 2025 - 1990 = 35
  }, 30000); // 30 second timeout

  it('should prevent duplicate messages (idempotency)', async () => {
    const user = await createUser({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      timezone: 'Europe/London',
      birthdayDate: new Date('1985-12-30'),
    });

    // Trigger scheduler twice
    await triggerScheduler('daily-precalculation');
    await triggerScheduler('daily-precalculation');

    // Should only have 1 message log
    const messages = await db.query.messageLogs.findMany({
      where: eq(messageLogs.userId, user.id),
    });

    expect(messages).toHaveLength(1);
  });

  it('should handle multiple message types (birthday + anniversary)', async () => {
    const user = await createUser({
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@example.com',
      timezone: 'America/Los_Angeles',
      birthdayDate: new Date('1992-12-30'),
      anniversaryDate: new Date('2020-12-30'), // Same day!
    });

    await triggerScheduler('daily-precalculation');

    const messages = await db.query.messageLogs.findMany({
      where: eq(messageLogs.userId, user.id),
    });

    expect(messages).toHaveLength(2);
    expect(messages.map(m => m.messageType)).toContain('BIRTHDAY');
    expect(messages.map(m => m.messageType)).toContain('ANNIVERSARY');
  });
});
```

### GitHub Actions Workflow (Simple E2E)

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Start test environment
        run: docker-compose -f docker-compose.test.yml up -d

      - name: Wait for services
        run: |
          docker-compose -f docker-compose.test.yml exec -T postgres pg_isready
          docker-compose -f docker-compose.test.yml exec -T redis redis-cli ping

      - name: Run migrations
        run: npm run db:migrate

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Cleanup
        if: always()
        run: docker-compose -f docker-compose.test.yml down -v
```

**Result:** E2E tests complete in < 5 minutes with 4 containers.

---

## Scalable Performance Tests

### Docker Compose Setup (24 containers, for weekly perf tests)

```yaml
# docker-compose.perf.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"

  api:
    build: .
    deploy:
      replicas: 5  # 5 API instances

  worker:
    build: .
    deploy:
      replicas: 10  # 10 workers (scale to 20 for peak tests)

  postgres-primary:
    image: postgres:15

  postgres-replica:
    image: postgres:15

  redis:
    image: redis:7

  prometheus:
    image: prom/prometheus

  grafana:
    image: grafana/grafana

  k6:
    image: grafana/k6
    volumes:
      - ./tests/performance:/scripts
```

### k6 Load Test Scenarios

#### 1. Sustained Load Test (1M msg/day simulation)

```javascript
// tests/performance/sustained-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    sustained_1m_per_day: {
      executor: 'constant-arrival-rate',
      rate: 12,  // 11.5 msg/sec (rounded to 12)
      timeUnit: '1s',
      duration: '24h',  // Full day test
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // Latency targets
    http_req_failed: ['rate<0.01'],  // < 1% error rate
    errors: ['rate<0.01'],
  },
};

export default function () {
  // Simulate message processing
  const payload = JSON.stringify({
    userId: `user-${Math.random()}`,
    messageType: 'BIRTHDAY',
    scheduledSendTime: new Date().toISOString(),
  });

  const res = http.post('http://api/internal/process-message', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'processing time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);
}
```

#### 2. Peak Load Test (100+ msg/sec)

```javascript
// tests/performance/peak-load.js
export const options = {
  scenarios: {
    peak_100_msg_sec: {
      executor: 'ramping-arrival-rate',
      startRate: 12,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      stages: [
        { duration: '2m', target: 12 },   // Baseline
        { duration: '1m', target: 100 },  // Ramp to peak
        { duration: '5m', target: 100 },  // Sustain peak
        { duration: '2m', target: 12 },   // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],  // Relaxed for peak
    http_req_failed: ['rate<0.05'],  // < 5% errors acceptable
  },
};
```

#### 3. Worker Scaling Test

```javascript
// tests/performance/worker-scaling.js
export const options = {
  scenarios: {
    test_1_worker: {
      executor: 'constant-arrival-rate',
      rate: 10,
      duration: '5m',
      tags: { workers: '1' },
    },
    test_5_workers: {
      executor: 'constant-arrival-rate',
      rate: 50,
      duration: '5m',
      tags: { workers: '5' },
    },
    test_10_workers: {
      executor: 'constant-arrival-rate',
      rate: 100,
      duration: '5m',
      tags: { workers: '10' },
    },
  },
};

// Verify linear scaling efficiency
// Target: 90% scaling efficiency (10 workers = 9x throughput of 1 worker)
```

### GitHub Actions Workflow (Weekly Performance Tests)

```yaml
# .github/workflows/performance-tests.yml
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * 0'  # Sunday 2am
  workflow_dispatch:

jobs:
  performance:
    runs-on: ubuntu-latest
    timeout-minutes: 120

    steps:
      - uses: actions/checkout@v4

      - name: Start performance environment
        run: docker-compose -f docker-compose.perf.yml up -d

      - name: Wait for services
        run: ./scripts/wait-for-services.sh

      - name: Run sustained load test (24h)
        run: docker-compose -f docker-compose.perf.yml run k6 run /scripts/sustained-load.js

      - name: Run peak load test
        run: docker-compose -f docker-compose.perf.yml run k6 run /scripts/peak-load.js

      - name: Run worker scaling test
        run: docker-compose -f docker-compose.perf.yml run k6 run /scripts/worker-scaling.js

      - name: Generate performance report
        run: npm run perf:report

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: perf-results/

      - name: Cleanup
        if: always()
        run: docker-compose -f docker-compose.perf.yml down -v
```

**Result:** Performance tests run weekly (not on every PR) with full infrastructure.

---

## Message Type Abstraction Testing

### Generic Test Framework

```typescript
// tests/unit/message-strategy.test.ts
import { describe, it, expect } from 'vitest';
import type { MessageStrategy } from '../src/types';

/**
 * Generic test suite that works with ANY MessageStrategy
 */
export function testMessageStrategy(
  strategyName: string,
  createStrategy: () => MessageStrategy,
  testCases: {
    shouldSendTrue: { user: User; date: Date };
    shouldSendFalse: { user: User; date: Date };
    expectedSendTime: { user: User; date: Date; expectedHour: number };
    expectedMessage: { user: User; expectedSubstring: string };
  }
) {
  describe(`MessageStrategy: ${strategyName}`, () => {
    it('should identify users who should receive message', async () => {
      const strategy = createStrategy();
      const { user, date } = testCases.shouldSendTrue;

      const result = await strategy.shouldSend(user, date);

      expect(result).toBe(true);
    });

    it('should identify users who should NOT receive message', async () => {
      const strategy = createStrategy();
      const { user, date } = testCases.shouldSendFalse;

      const result = await strategy.shouldSend(user, date);

      expect(result).toBe(false);
    });

    it('should calculate send time (9am local timezone)', () => {
      const strategy = createStrategy();
      const { user, date, expectedHour } = testCases.expectedSendTime;

      const sendTime = strategy.calculateSendTime(user, date);
      const localHour = DateTime.fromJSDate(sendTime)
        .setZone(user.timezone)
        .hour;

      expect(localHour).toBe(expectedHour);
    });

    it('should compose message correctly', async () => {
      const strategy = createStrategy();
      const { user, expectedSubstring } = testCases.expectedMessage;

      const message = await strategy.composeMessage(user, {
        currentYear: new Date().getFullYear(),
        timezone: user.timezone,
        messageType: strategy.messageType,
      });

      expect(message).toContain(expectedSubstring);
      expect(message).toContain(user.firstName);
    });

    it('should validate user has required data', () => {
      const strategy = createStrategy();
      const validUser = testCases.shouldSendTrue.user;

      const result = strategy.validate(validUser);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return schedule information', () => {
      const strategy = createStrategy();

      const schedule = strategy.getSchedule();

      expect(schedule.cadence).toBeDefined();
      expect(schedule.triggerField).toBeDefined();
    });
  });
}

// Test Birthday strategy
testMessageStrategy(
  'BirthdayMessageStrategy',
  () => new BirthdayMessageStrategy(),
  {
    shouldSendTrue: {
      user: { birthdayDate: new Date('1990-12-30'), timezone: 'UTC', firstName: 'John' },
      date: new Date('2025-12-30'),
    },
    shouldSendFalse: {
      user: { birthdayDate: new Date('1990-01-15'), timezone: 'UTC', firstName: 'Jane' },
      date: new Date('2025-12-30'),
    },
    expectedSendTime: {
      user: { timezone: 'America/New_York', birthdayDate: new Date('1990-12-30'), firstName: 'Bob' },
      date: new Date('2025-12-30'),
      expectedHour: 9,
    },
    expectedMessage: {
      user: { firstName: 'Alice', lastName: 'Smith', birthdayDate: new Date('1990-12-30') },
      expectedSubstring: 'Happy 35th!',
    },
  }
);

// Test Anniversary strategy (automatically uses same test suite!)
testMessageStrategy(
  'AnniversaryMessageStrategy',
  () => new AnniversaryMessageStrategy(),
  {
    shouldSendTrue: {
      user: { anniversaryDate: new Date('2020-12-30'), timezone: 'UTC', firstName: 'John' },
      date: new Date('2025-12-30'),
    },
    shouldSendFalse: {
      user: { anniversaryDate: new Date('2020-01-15'), timezone: 'UTC', firstName: 'Jane' },
      date: new Date('2025-12-30'),
    },
    expectedSendTime: {
      user: { timezone: 'Europe/London', anniversaryDate: new Date('2020-12-30'), firstName: 'Bob' },
      date: new Date('2025-12-30'),
      expectedHour: 9,
    },
    expectedMessage: {
      user: { firstName: 'Alice', lastName: 'Johnson', anniversaryDate: new Date('2020-12-30') },
      expectedSubstring: 'Happy 5th anniversary!',
    },
  }
);
```

**Benefit:** Adding a new message type? Just call `testMessageStrategy()` with your new strategy!

---

## Database Performance Testing

### Seed Large Dataset (10M users)

```typescript
// tests/performance/seed-database.ts
import { faker } from '@faker-js/faker';

async function seedDatabase() {
  console.log('Seeding 10M users...');
  const batchSize = 10000;
  const totalUsers = 10_000_000;

  for (let i = 0; i < totalUsers; i += batchSize) {
    const users = [];
    for (let j = 0; j < batchSize; j++) {
      users.push({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        timezone: faker.location.timeZone(),
        birthdayDate: faker.date.birthdate(),
        anniversaryDate: Math.random() > 0.5 ? faker.date.past() : null,
      });
    }

    await db.insert(schema.users).values(users);

    if (i % 100000 === 0) {
      console.log(`Inserted ${i} users...`);
    }
  }

  console.log('Seeding complete!');
}
```

### Birthday Detection Query Benchmark

```typescript
// tests/performance/database-queries.test.ts
import { describe, it, expect } from 'vitest';

describe('Database Performance (10M users)', () => {
  it('should find birthdays today in < 200ms', async () => {
    const start = performance.now();

    const birthdays = await db.query.users.findMany({
      where: and(
        isNull(users.deletedAt),
        isNotNull(users.birthdayDate),
        eq(sql`EXTRACT(MONTH FROM birthday_date)`, 12),
        eq(sql`EXTRACT(DAY FROM birthday_date)`, 30)
      ),
    });

    const duration = performance.now() - start;

    console.log(`Found ${birthdays.length} birthdays in ${duration}ms`);
    expect(duration).toBeLessThan(200); // < 200ms with 10M users
  });

  it('should insert 1000 message logs in < 500ms', async () => {
    const messages = Array(1000).fill(null).map(() => ({
      userId: faker.string.uuid(),
      messageType: 'BIRTHDAY',
      scheduledSendTime: new Date(),
      idempotencyKey: faker.string.uuid(),
      messageContent: 'Test message',
      status: 'SCHEDULED',
    }));

    const start = performance.now();
    await db.insert(schema.messageLogs).values(messages);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
  });
});
```

---

## CI/CD Integration

### Test Matrix

| Environment | Tests Run | Containers | Duration | Schedule |
|-------------|-----------|------------|----------|----------|
| **PR** | Unit + Integration | 0 | < 3 min | Every PR |
| **PR** | E2E (simple) | 4 | < 5 min | Every PR |
| **Main** | Unit + Integration + E2E | 4 | < 8 min | Every push to main |
| **Weekly** | Performance (full) | 24 | 30-60 min | Sunday 2am |

### Complete GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: docker-compose -f docker-compose.test.yml up -d
      - run: npm run test:e2e
      - run: docker-compose -f docker-compose.test.yml down -v
        if: always()
```

---

## Success Criteria

### Unit Tests
- ✅ Coverage: 85%+
- ✅ Duration: < 2 minutes
- ✅ All strategies tested with generic framework

### Integration Tests
- ✅ Coverage: 80%+
- ✅ Duration: < 3 minutes
- ✅ Database integration verified

### E2E Tests (CI/CD)
- ✅ Coverage: 75%+
- ✅ Duration: < 5 minutes
- ✅ Containers: 4 (postgres, redis, api, worker)
- ✅ Full user flow tested

### Performance Tests (Weekly)
- ✅ Sustained: 11.5 msg/sec for 24 hours
- ✅ Peak: 100+ msg/sec for 5 minutes
- ✅ Database: < 200ms birthday queries with 10M users
- ✅ Latency: p95 < 500ms, p99 < 1s
- ✅ Error rate: < 1%

---

## Next Steps

1. **Setup:** Implement Docker Compose configs (test.yml, perf.yml)
2. **Unit Tests:** Write generic test framework for message strategies
3. **Integration Tests:** Test API + database integration
4. **E2E Tests:** Implement simple 4-container E2E suite
5. **Performance Tests:** Create k6 scripts and weekly workflow
6. **CI/CD:** Configure GitHub Actions with test matrix

Refer to [`performance-testing-guide.md`](./performance-testing-guide.md) for detailed k6 scripts and benchmarking strategies.
