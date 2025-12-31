# Performance Testing Guide: 1M+ Messages/Day
## Comprehensive Load Testing Strategy
**CODER/ARCHITECT Agent - Hive Mind Collective**
**Date:** 2025-12-30
**Target:** Validate 1M+ msg/day (11.5 msg/sec sustained, 100+ msg/sec peak)

---

## EXECUTIVE SUMMARY

This document provides complete performance testing strategies to validate the system can handle **1 million messages per day** on localhost before production deployment.

**Testing Objectives:**
- Validate queue throughput (100+ msg/sec)
- Validate database writes (1000+ writes/sec)
- Validate API response times (p95 < 1s, p99 < 2s)
- Identify bottlenecks early
- Verify horizontal scaling

---

## TABLE OF CONTENTS

1. [k6 Load Testing](#1-k6-load-testing)
2. [Database Performance Testing](#2-database-performance-testing)
3. [Queue Throughput Testing](#3-queue-throughput-testing)
4. [End-to-End System Testing](#4-end-to-end-system-testing)
5. [Localhost Simulation](#5-localhost-simulation)
6. [Bottleneck Analysis](#6-bottleneck-analysis)
7. [Performance Regression Tests](#7-performance-regression-tests)
8. [Resource Monitoring](#8-resource-monitoring)

---

## 1. K6 LOAD TESTING

### 1.1 Installation

```bash

# macOS

brew install k6

# Ubuntu/Debian

sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker

docker pull grafana/k6:latest
```

### 1.2 API Load Test: User Creation

```javascript
// tests/performance/k6/api-user-creation.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const userCreationDuration = new Trend('user_creation_duration');

export const options = {
  stages: [
    // Ramp-up phase
    { duration: '30s', target: 10 },   // Warm up to 10 VUs
    { duration: '1m', target: 50 },    // Increase to 50 VUs
    { duration: '1m', target: 100 },   // Increase to 100 VUs

    // Sustained load (simulate normal operation)
    { duration: '5m', target: 100 },   // Maintain 100 VUs for 5 minutes

    // Peak load (simulate daily peak)
    { duration: '2m', target: 200 },   // Spike to 200 VUs
    { duration: '3m', target: 200 },   // Maintain peak

    // Ramp-down
    { duration: '1m', target: 0 },     // Graceful shutdown
  ],

  thresholds: {
    // API response time
    'http_req_duration': [
      'p(50)<500',   // 50% of requests under 500ms
      'p(95)<1000',  // 95% of requests under 1s
      'p(99)<2000'   // 99% of requests under 2s
    ],

    // Success rate
    'http_req_failed': ['rate<0.01'],  // Error rate < 1%
    'success': ['rate>0.99'],          // Success rate > 99%

    // Request rate
    'http_reqs': ['rate>50'],          // At least 50 req/s
  },

  // Extensions
  ext: {
    loadimpact: {
      projectID: 0,
      name: 'Birthday Scheduler - API Load Test'
    }
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

// Generate realistic test data
function generateUser(vu, iter) {
  const firstNames = ['John', 'Jane', 'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller'];
  const timezones = [
    'America/New_York', 'America/Los_Angeles', 'America/Chicago',
    'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'
  ];

  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  const year = 1960 + Math.floor(Math.random() * 40);

  return {
    firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
    lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
    email: `user${vu}${iter}${Date.now()}@loadtest.com`,
    birthdayDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    timezone: timezones[Math.floor(Math.random() * timezones.length)]
  };
}

export default function() {
  const user = generateUser(__VU, __ITER);

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '10s',
  };

  const startTime = new Date().getTime();
  const response = http.post(
    `${BASE_URL}/user`,
    JSON.stringify(user),
    params
  );
  const endTime = new Date().getTime();
  const duration = endTime - startTime;

  // Record custom metrics
  userCreationDuration.add(duration);

  const checkResult = check(response, {
    'status is 201': (r) => r.status === 201,
    'has user id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined && body.id !== null;
      } catch {
        return false;
      }
    },
    'response time < 2s': (r) => r.timings.duration < 2000,
    'response has correct email': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.email === user.email;
      } catch {
        return false;
      }
    }
  });

  if (checkResult) {
    successRate.add(1);
  } else {
    errorRate.add(1);
    console.error(`Request failed: Status ${response.status}, Body: ${response.body}`);
  }

  // Think time (simulate real user behavior)
  sleep(Math.random() * 2 + 1);  // 1-3 seconds
}

export function handleSummary(data) {
  return {
    'performance-report.html': htmlReport(data),
    'performance-summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

### 1.3 API Load Test: Mixed Operations

```javascript
// tests/performance/k6/api-mixed-operations.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Load user IDs from file (created by previous test)
const userIds = new SharedArray('userIds', function() {
  return JSON.parse(open('./test-data/user-ids.json'));
});

export const options = {
  scenarios: {
    // Scenario 1: Create users (30% of traffic)
    create_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 30 },
        { duration: '5m', target: 30 },
        { duration: '1m', target: 0 },
      ],
      exec: 'createUser',
    },

    // Scenario 2: Read users (50% of traffic)
    read_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      exec: 'readUser',
    },

    // Scenario 3: Delete users (20% of traffic)
    delete_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '1m', target: 0 },
      ],
      exec: 'deleteUser',
    },
  },

  thresholds: {
    'http_req_duration{scenario:create_users}': ['p(95)<1000'],
    'http_req_duration{scenario:read_users}': ['p(95)<500'],
    'http_req_duration{scenario:delete_users}': ['p(95)<500'],
    'http_req_failed': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export function createUser() {
  const user = {
    firstName: `User${__VU}`,
    lastName: 'LoadTest',
    email: `user${__VU}${__ITER}@test.com`,
    birthdayDate: '1990-01-01',
    timezone: 'America/New_York'
  };

  const res = http.post(`${BASE_URL}/user`, JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' }
  });

  check(res, { 'create status 201': (r) => r.status === 201 });
  sleep(1);
}

export function readUser() {
  if (userIds.length === 0) {
    console.warn('No user IDs available for read test');
    return;
  }

  const userId = userIds[Math.floor(Math.random() * userIds.length)];
  const res = http.get(`${BASE_URL}/user/${userId}`);

  check(res, { 'read status 200': (r) => r.status === 200 });
  sleep(0.5);
}

export function deleteUser() {
  if (userIds.length === 0) {
    console.warn('No user IDs available for delete test');
    return;
  }

  const userId = userIds[Math.floor(Math.random() * userIds.length)];
  const res = http.del(`${BASE_URL}/user/${userId}`);

  check(res, { 'delete status 200': (r) => r.status === 200 || r.status === 404 });
  sleep(2);
}
```

### 1.4 Run k6 Tests

```bash

# Run basic API load test

k6 run tests/performance/k6/api-user-creation.js

# Run with custom settings

k6 run --vus 100 --duration 10m tests/performance/k6/api-user-creation.js

# Run with output to InfluxDB (for Grafana visualization)

k6 run --out influxdb=http://localhost:8086/k6 tests/performance/k6/api-user-creation.js

# Run in Docker

docker run --rm -i \
  --network=host \
  -v $(pwd)/tests/performance:/scripts \
  grafana/k6:latest \
  run /scripts/k6/api-user-creation.js
```

---

## 2. DATABASE PERFORMANCE TESTING

### 2.1 PostgreSQL Benchmarking Tool

```typescript
// tests/performance/database-benchmark.ts
import { Pool } from 'pg';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  operation: string;
  recordsProcessed: number;
  durationMs: number;
  recordsPerSecond: number;
  avgLatencyMs: number;
}

class DatabaseBenchmark {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'birthday_app',
      user: 'postgres',
      password: 'devpassword',
      max: 50,  // Connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async benchmarkInserts(count: number, batchSize: number = 1000): Promise<BenchmarkResult> {
    console.log(`\n📊 Benchmarking ${count} INSERT operations (batch size: ${batchSize})...`);

    const startTime = performance.now();
    let inserted = 0;

    for (let i = 0; i < count; i += batchSize) {
      const values = [];
      const placeholders = [];

      for (let j = 0; j < batchSize && (i + j) < count; j++) {
        const offset = i + j;
        values.push(
          `User${offset}`,
          'LoadTest',
          `user${offset}@benchmark.com`,
          '1990-12-30',
          'America/New_York'
        );
        placeholders.push(`($${j * 5 + 1}, $${j * 5 + 2}, $${j * 5 + 3}, $${j * 5 + 4}, $${j * 5 + 5})`);
      }

      const query = `
        INSERT INTO users (first_name, last_name, email, birthday_date, timezone)
        VALUES ${placeholders.join(', ')}
      `;

      await this.pool.query(query, values);
      inserted += Math.min(batchSize, count - i);

      if (inserted % 10000 === 0) {
        console.log(`  Inserted ${inserted}/${count} records...`);
      }
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    return {
      operation: 'INSERT',
      recordsProcessed: count,
      durationMs,
      recordsPerSecond: (count / durationMs) * 1000,
      avgLatencyMs: durationMs / count,
    };
  }

  async benchmarkSelects(count: number): Promise<BenchmarkResult> {
    console.log(`\n📊 Benchmarking ${count} SELECT operations...`);

    const startTime = performance.now();

    const promises = [];
    for (let i = 0; i < count; i++) {
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;

      const promise = this.pool.query(`
        SELECT * FROM users
        WHERE EXTRACT(MONTH FROM birthday_date) = $1
          AND EXTRACT(DAY FROM birthday_date) = $2
          AND deleted_at IS NULL
        LIMIT 100
      `, [month, day]);

      promises.push(promise);

      // Execute in batches of 50 concurrent queries
      if (promises.length >= 50) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }

    // Execute remaining
    await Promise.all(promises);

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    return {
      operation: 'SELECT',
      recordsProcessed: count,
      durationMs,
      recordsPerSecond: (count / durationMs) * 1000,
      avgLatencyMs: durationMs / count,
    };
  }

  async benchmarkUpdates(count: number): Promise<BenchmarkResult> {
    console.log(`\n📊 Benchmarking ${count} UPDATE operations...`);

    // Get user IDs
    const { rows } = await this.pool.query('SELECT id FROM users LIMIT $1', [count]);
    const userIds = rows.map(r => r.id);

    const startTime = performance.now();

    for (const userId of userIds) {
      await this.pool.query(
        'UPDATE users SET timezone = $1, updated_at = NOW() WHERE id = $2',
        ['Europe/London', userId]
      );
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    return {
      operation: 'UPDATE',
      recordsProcessed: count,
      durationMs,
      recordsPerSecond: (count / durationMs) * 1000,
      avgLatencyMs: durationMs / count,
    };
  }

  async benchmarkDeletes(count: number): Promise<BenchmarkResult> {
    console.log(`\n📊 Benchmarking ${count} DELETE operations (soft delete)...`);

    const { rows } = await this.pool.query('SELECT id FROM users WHERE deleted_at IS NULL LIMIT $1', [count]);
    const userIds = rows.map(r => r.id);

    const startTime = performance.now();

    for (const userId of userIds) {
      await this.pool.query(
        'UPDATE users SET deleted_at = NOW() WHERE id = $1',
        [userId]
      );
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    return {
      operation: 'DELETE',
      recordsProcessed: count,
      durationMs,
      recordsPerSecond: (count / durationMs) * 1000,
      avgLatencyMs: durationMs / count,
    };
  }

  printResults(results: BenchmarkResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('DATABASE BENCHMARK RESULTS');
    console.log('='.repeat(80));
    console.log();

    for (const result of results) {
      console.log(`Operation: ${result.operation}`);
      console.log(`  Records Processed: ${result.recordsProcessed.toLocaleString()}`);
      console.log(`  Duration: ${(result.durationMs / 1000).toFixed(2)}s`);
      console.log(`  Throughput: ${result.recordsPerSecond.toFixed(2)} records/sec`);
      console.log(`  Avg Latency: ${result.avgLatencyMs.toFixed(2)}ms`);
      console.log();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Run benchmarks
async function main() {
  const benchmark = new DatabaseBenchmark();
  const results: BenchmarkResult[] = [];

  try {
    // Benchmark INSERT (10,000 records)
    results.push(await benchmark.benchmarkInserts(10000, 1000));

    // Benchmark SELECT (5,000 queries)
    results.push(await benchmark.benchmarkSelects(5000));

    // Benchmark UPDATE (1,000 records)
    results.push(await benchmark.benchmarkUpdates(1000));

    // Benchmark DELETE (1,000 records)
    results.push(await benchmark.benchmarkDeletes(1000));

    benchmark.printResults(results);

    // Check if targets met
    console.log('TARGET VALIDATION:');
    const insertResult = results.find(r => r.operation === 'INSERT');
    if (insertResult && insertResult.recordsPerSecond >= 1000) {
      console.log('✅ INSERT throughput PASSED (target: 1000 writes/sec)');
    } else {
      console.log(`❌ INSERT throughput FAILED (actual: ${insertResult?.recordsPerSecond.toFixed(2)}, target: 1000)`);
    }

    const selectResult = results.find(r => r.operation === 'SELECT');
    if (selectResult && selectResult.recordsPerSecond >= 5000) {
      console.log('✅ SELECT throughput PASSED (target: 5000 reads/sec)');
    } else {
      console.log(`⚠️  SELECT throughput (actual: ${selectResult?.recordsPerSecond.toFixed(2)}, target: 5000)`);
    }

  } catch (error) {
    console.error('Benchmark failed:', error);
  } finally {
    await benchmark.close();
  }
}

main();
```

### 2.2 Run Database Benchmark

```bash

# Compile TypeScript

npx tsc tests/performance/database-benchmark.ts

# Run benchmark

node tests/performance/database-benchmark.js

# Expected output:
# INSERT: ~1500-3000 records/sec (batch inserts)
# SELECT: ~5000-10000 queries/sec (indexed lookups)
# UPDATE: ~800-1500 records/sec
# DELETE: ~800-1500 records/sec

```

---

## 3. QUEUE THROUGHPUT TESTING

### 3.1 Redpanda Producer Benchmark

```typescript
// tests/performance/queue-producer-benchmark.ts
import { Kafka, Producer, logLevel } from 'kafkajs';
import { performance } from 'perf_hooks';

class QueueProducerBenchmark {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'benchmark-producer',
      brokers: ['localhost:19092', 'localhost:29092', 'localhost:39092'],
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 3,
      },
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 5,
      idempotent: true,
      transactionalId: 'benchmark-producer',
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    console.log('✅ Connected to Redpanda');
  }

  async benchmarkThroughput(
    messagesPerSecond: number,
    durationSeconds: number
  ): Promise<void> {
    const totalMessages = messagesPerSecond * durationSeconds;
    console.log(`\n📊 Benchmarking ${messagesPerSecond} msg/sec for ${durationSeconds}s...`);
    console.log(`   Total messages: ${totalMessages.toLocaleString()}`);

    const startTime = performance.now();
    let sentCount = 0;
    const batchSize = 100;

    const intervalMs = (1000 / messagesPerSecond) * batchSize;

    const sendBatch = async () => {
      const messages = [];

      for (let i = 0; i < batchSize && sentCount < totalMessages; i++) {
        messages.push({
          topic: 'birthday-messages',
          messages: [{
            key: `user-${sentCount}`,
            value: JSON.stringify({
              userId: `user-${sentCount}`,
              messageType: 'birthday',
              scheduledSendTime: new Date().toISOString(),
              content: `Birthday message ${sentCount}`,
            }),
          }],
        });
        sentCount++;
      }

      if (messages.length > 0) {
        await this.producer.sendBatch({ topicMessages: messages });
      }
    };

    // Send messages at steady rate
    const interval = setInterval(async () => {
      if (sentCount >= totalMessages) {
        clearInterval(interval);
        return;
      }
      await sendBatch();
    }, intervalMs);

    // Wait for completion
    await new Promise(resolve => {
      const checkComplete = setInterval(() => {
        if (sentCount >= totalMessages) {
          clearInterval(checkComplete);
          clearInterval(interval);
          resolve(null);
        }
      }, 100);
    });

    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const actualThroughput = (totalMessages / durationMs) * 1000;

    console.log(`\n✅ RESULTS:`);
    console.log(`   Messages sent: ${totalMessages.toLocaleString()}`);
    console.log(`   Duration: ${(durationMs / 1000).toFixed(2)}s`);
    console.log(`   Target throughput: ${messagesPerSecond} msg/sec`);
    console.log(`   Actual throughput: ${actualThroughput.toFixed(2)} msg/sec`);

    if (actualThroughput >= messagesPerSecond * 0.95) {
      console.log(`   ✅ PASSED (within 5% of target)`);
    } else {
      console.log(`   ❌ FAILED (below 95% of target)`);
    }
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }
}

async function main() {
  const benchmark = new QueueProducerBenchmark();

  try {
    await benchmark.connect();

    // Test 1: Sustained load (11.5 msg/sec)
    console.log('\n🧪 Test 1: Sustained Load (1M msg/day = 11.5 msg/sec)');
    await benchmark.benchmarkThroughput(12, 60);

    // Test 2: Peak load (100 msg/sec)
    console.log('\n🧪 Test 2: Peak Load (100 msg/sec)');
    await benchmark.benchmarkThroughput(100, 60);

    // Test 3: Stress test (1000 msg/sec)
    console.log('\n🧪 Test 3: Stress Test (1000 msg/sec)');
    await benchmark.benchmarkThroughput(1000, 30);

  } catch (error) {
    console.error('Benchmark failed:', error);
  } finally {
    await benchmark.disconnect();
  }
}

main();
```

### 3.2 Redpanda Consumer Benchmark

```typescript
// tests/performance/queue-consumer-benchmark.ts
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { performance } from 'perf_hooks';

class QueueConsumerBenchmark {
  private kafka: Kafka;
  private consumer: Consumer;
  private messagesProcessed = 0;
  private startTime = 0;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'benchmark-consumer',
      brokers: ['localhost:19092', 'localhost:29092', 'localhost:39092'],
    });

    this.consumer = this.kafka.consumer({
      groupId: 'benchmark-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: 'birthday-messages', fromBeginning: false });
    console.log('✅ Consumer connected');
  }

  async benchmarkConsumption(durationSeconds: number): Promise<void> {
    console.log(`\n📊 Consuming messages for ${durationSeconds}s...`);

    this.messagesProcessed = 0;
    this.startTime = performance.now();

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        this.messagesProcessed++;

        // Simulate message processing (0-10ms)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      },
    });

    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000));

    const endTime = performance.now();
    const durationMs = endTime - this.startTime;
    const throughput = (this.messagesProcessed / durationMs) * 1000;

    console.log(`\n✅ CONSUMPTION RESULTS:`);
    console.log(`   Messages processed: ${this.messagesProcessed.toLocaleString()}`);
    console.log(`   Duration: ${(durationMs / 1000).toFixed(2)}s`);
    console.log(`   Throughput: ${throughput.toFixed(2)} msg/sec`);
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }
}

async function main() {
  const benchmark = new QueueConsumerBenchmark();

  try {
    await benchmark.connect();
    await benchmark.benchmarkConsumption(60);
  } catch (error) {
    console.error('Benchmark failed:', error);
  } finally {
    await benchmark.disconnect();
  }
}

main();
```

---

## 4. END-TO-END SYSTEM TESTING

### 4.1 Full System Load Test

```typescript
// tests/performance/e2e-system-test.ts
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import axios from 'axios';

interface SystemMetrics {
  apiResponseTime: number[];
  queueDepth: number[];
  databaseConnections: number[];
  messagesProcessed: number;
  errors: number;
}

class E2ESystemTest {
  private pool: Pool;
  private kafka: Kafka;
  private metrics: SystemMetrics;

  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'birthday_app',
      user: 'postgres',
      password: 'devpassword',
      max: 10,
    });

    this.kafka = new Kafka({
      brokers: ['localhost:19092'],
    });

    this.metrics = {
      apiResponseTime: [],
      queueDepth: [],
      databaseConnections: [],
      messagesProcessed: 0,
      errors: 0,
    };
  }

  async simulateLoad(durationMinutes: number): Promise<void> {
    console.log(`\n🧪 Running E2E system test for ${durationMinutes} minutes...`);

    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);

    // Metrics collection interval
    const metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 5000);

    // API request loop (simulate 50 req/sec)
    const apiInterval = setInterval(async () => {
      await this.sendAPIRequest();
    }, 20);

    // Wait for duration
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (Date.now() >= endTime) {
          clearInterval(checkInterval);
          clearInterval(metricsInterval);
          clearInterval(apiInterval);
          resolve(null);
        }
      }, 1000);
    });

    this.printMetrics();
  }

  async sendAPIRequest(): Promise<void> {
    try {
      const startTime = performance.now();

      const response = await axios.post('http://localhost/user', {
        firstName: 'Test',
        lastName: 'User',
        email: `test${Date.now()}@e2etest.com`,
        birthdayDate: '1990-01-01',
        timezone: 'America/New_York',
      }, {
        timeout: 5000,
      });

      const endTime = performance.now();
      this.metrics.apiResponseTime.push(endTime - startTime);

      if (response.status === 201) {
        this.metrics.messagesProcessed++;
      }
    } catch (error) {
      this.metrics.errors++;
    }
  }

  async collectMetrics(): Promise<void> {
    try {
      // Get database connections
      const { rows } = await this.pool.query(
        "SELECT count(*) as count FROM pg_stat_activity WHERE datname = 'birthday_app'"
      );
      this.metrics.databaseConnections.push(parseInt(rows[0].count));

      // Get queue depth (via Redpanda admin API)
      const admin = this.kafka.admin();
      await admin.connect();
      const offsets = await admin.fetchOffsets({ groupId: 'birthday-workers', topics: ['birthday-messages'] });
      const depth = offsets.reduce((sum, topic) => {
        return sum + topic.partitions.reduce((s, p) => s + parseInt(p.offset), 0);
      }, 0);
      this.metrics.queueDepth.push(depth);
      await admin.disconnect();

    } catch (error) {
      console.error('Metrics collection error:', error);
    }
  }

  printMetrics(): void {
    console.log('\n' + '='.repeat(80));
    console.log('E2E SYSTEM TEST RESULTS');
    console.log('='.repeat(80));

    // API metrics
    const avgResponseTime = this.metrics.apiResponseTime.reduce((a, b) => a + b, 0) / this.metrics.apiResponseTime.length;
    const p95ResponseTime = this.percentile(this.metrics.apiResponseTime, 0.95);
    const p99ResponseTime = this.percentile(this.metrics.apiResponseTime, 0.99);

    console.log(`\nAPI Performance:`);
    console.log(`  Requests sent: ${this.metrics.apiResponseTime.length}`);
    console.log(`  Avg response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  p95 response time: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`  p99 response time: ${p99ResponseTime.toFixed(2)}ms`);
    console.log(`  Errors: ${this.metrics.errors}`);

    // Database metrics
    const avgConnections = this.metrics.databaseConnections.reduce((a, b) => a + b, 0) / this.metrics.databaseConnections.length;
    const maxConnections = Math.max(...this.metrics.databaseConnections);

    console.log(`\nDatabase:`);
    console.log(`  Avg connections: ${avgConnections.toFixed(0)}`);
    console.log(`  Max connections: ${maxConnections}`);

    // Queue metrics
    const avgQueueDepth = this.metrics.queueDepth.reduce((a, b) => a + b, 0) / this.metrics.queueDepth.length;
    const maxQueueDepth = Math.max(...this.metrics.queueDepth);

    console.log(`\nQueue:`);
    console.log(`  Avg depth: ${avgQueueDepth.toFixed(0)} messages`);
    console.log(`  Max depth: ${maxQueueDepth} messages`);

    // Validation
    console.log(`\n${'='.repeat(80)}`);
    console.log(`VALIDATION:`);
    if (p95ResponseTime < 1000) {
      console.log(`  ✅ API p95 < 1s PASSED`);
    } else {
      console.log(`  ❌ API p95 < 1s FAILED`);
    }

    if (this.metrics.errors / this.metrics.apiResponseTime.length < 0.01) {
      console.log(`  ✅ Error rate < 1% PASSED`);
    } else {
      console.log(`  ❌ Error rate < 1% FAILED`);
    }
  }

  percentile(arr: number[], p: number): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

async function main() {
  const test = new E2ESystemTest();

  try {
    await test.simulateLoad(5);  // 5 minute test
  } catch (error) {
    console.error('E2E test failed:', error);
  } finally {
    await test.close();
  }
}

main();
```

---

## 5. LOCALHOST SIMULATION

### 5.1 1M Messages/Day Simulation

```bash

#!/bin/bash
# tests/performance/simulate-1m-per-day.sh

echo "🚀 Simulating 1M messages/day on localhost"
echo "==========================================="
echo ""

# Calculate sustained load
# 1M messages / 86400 seconds = 11.5 msg/sec sustained

SUSTAINED_RATE=12

# Calculate peak load (10x factor)

PEAK_RATE=120

# Duration

DURATION_MINUTES=10

echo "Configuration:"
echo "  Sustained rate: ${SUSTAINED_RATE} msg/sec"
echo "  Peak rate: ${PEAK_RATE} msg/sec"
echo "  Duration: ${DURATION_MINUTES} minutes"
echo ""

# Start monitoring

echo "📊 Starting resource monitoring..."
docker stats --no-stream > performance-stats-before.txt

# Phase 1: Warm-up (1 minute at 10% capacity)

echo "🔥 Phase 1: Warm-up (1 min)"
k6 run --vus 5 --duration 1m tests/performance/k6/api-user-creation.js

# Phase 2: Sustained load (5 minutes)

echo "📈 Phase 2: Sustained load (${SUSTAINED_RATE} msg/sec, 5 min)"
k6 run --vus 12 --duration 5m tests/performance/k6/api-user-creation.js

# Phase 3: Peak load (2 minutes)

echo "🔥 Phase 3: Peak load (${PEAK_RATE} msg/sec, 2 min)"
k6 run --vus 120 --duration 2m tests/performance/k6/api-user-creation.js

# Phase 4: Cool-down (2 minutes at 50% capacity)

echo "📉 Phase 4: Cool-down (2 min)"
k6 run --vus 6 --duration 2m tests/performance/k6/api-user-creation.js

# Capture final stats

docker stats --no-stream > performance-stats-after.txt

echo ""
echo "✅ Simulation complete"
echo ""
echo "Check results:"
echo "  - k6 summary above"
echo "  - Docker stats: performance-stats-*.txt"
echo "  - Grafana dashboard: http://localhost:3001"
```

### 5.2 Resource Monitoring Script

```bash

#!/bin/bash
# tests/performance/monitor-resources.sh

echo "📊 Monitoring system resources during load test..."

OUTPUT_FILE="performance-monitoring-$(date +%Y%m%d-%H%M%S).csv"

echo "timestamp,cpu_percent,memory_mb,disk_io_mb,network_kb" > $OUTPUT_FILE

while true; do
    TIMESTAMP=$(date +%s)

    # CPU usage
    CPU=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')

    # Memory usage (MB)
    MEM=$(free -m | awk 'NR==2{printf "%.0f", $3}')

    # Disk I/O (MB/s)
    DISK=$(iostat -d -x 1 2 | awk '/^sd/ {print $6}' | tail -1)

    # Network (KB/s)
    NET=$(sar -n DEV 1 1 | awk '/Average.*eth0/ {print $5}')

    echo "$TIMESTAMP,$CPU,$MEM,$DISK,$NET" >> $OUTPUT_FILE

    sleep 5
done
```

---

## 6. BOTTLENECK ANALYSIS

### 6.1 Identify Bottlenecks Checklist

| Component | Check | Tool | Threshold |
|-----------|-------|------|-----------|
| **API Response Time** | p95 < 1s | k6 | ❌ if p95 > 1s |
| **Database CPU** | < 80% | `docker stats` | ⚠️ if > 80% |
| **Database Connections** | < 80% of max | `pg_stat_activity` | ⚠️ if > 320/400 |
| **Queue Depth** | < 1000 messages | Redpanda Console | ⚠️ if > 1000 |
| **Worker CPU** | < 70% | `docker stats` | ⚠️ if > 70% |
| **Redis Memory** | < 1.5GB | `INFO memory` | ⚠️ if > 1.5GB |
| **Network Bandwidth** | < 100 Mbps | `iftop` | ⚠️ if saturated |

### 6.2 Bottleneck Resolution Strategies

**If API is slow (p95 > 1s):**
- Add more API replicas (scale to 7-10)
- Increase connection pool size
- Add caching layer (Redis)
- Optimize slow queries

**If Database is slow:**
- Check slow query log
- Add missing indexes
- Enable read replica routing
- Consider partitioning

**If Queue is backing up:**
- Add more workers (scale to 15-20)
- Increase worker concurrency (5 → 10)
- Check worker errors/retries
- Optimize message processing

**If Workers are slow:**
- Profile worker code (slow external API calls?)
- Implement circuit breaker
- Add worker horizontal scaling
- Reduce per-worker concurrency

---

## 7. PERFORMANCE REGRESSION TESTS

### 7.1 CI/CD Integration (GitHub Actions)

```yaml

# .github/workflows/performance-tests.yml

name: Performance Regression Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  performance-baseline:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: birthday_app
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
        ports:
          - 5432:5432

      redis:
        image: redis:7
        ports:
          - 6379:6379

      redpanda:
        image: docker.redpanda.com/redpandadata/redpanda:v23.3.3
        ports:
          - 9092:9092

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Start application
        run: npm start &
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/birthday_app
          REDIS_URL: redis://localhost:6379
          REDPANDA_BROKERS: localhost:9092

      - name: Wait for application
        run: |
          timeout 30 bash -c 'until curl -f http://localhost:3000/health; do sleep 1; done'

      - name: Run k6 performance test
        uses: grafana/k6-action@v0.3.0
        with:
          filename: tests/performance/k6/api-user-creation.js
          flags: --out json=performance-results.json

      - name: Parse results
        run: |
          node tests/performance/parse-k6-results.js

      - name: Compare with baseline
        run: |
          node tests/performance/compare-baseline.js

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: |
            performance-results.json
            performance-report.html

      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('performance-summary.json'));

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Performance Test Results

              - API p95: ${results.p95}ms (baseline: 800ms)
              - Throughput: ${results.throughput} req/sec
              - Error rate: ${results.errorRate}%

              ${results.regression ? '⚠️ Performance regression detected' : '✅ No regression'}
              `
            });
```

---

## 8. RESOURCE MONITORING

### 8.1 Real-Time Monitoring Dashboard

Access Grafana dashboard at `http://localhost:3001` during load tests.

**Key Metrics to Watch:**

1. **API Metrics:**
   - Request rate (target: 50-100 req/sec)
   - Response time p95 (target: < 1s)
   - Error rate (target: < 1%)

2. **Queue Metrics:**
   - Message production rate (target: 11.5 msg/sec sustained)
   - Message consumption rate (should match production)
   - Queue depth (target: < 1000 messages)

3. **Database Metrics:**
   - Active connections (target: < 320)
   - Query duration (target: < 100ms)
   - Locks/deadlocks (target: 0)

4. **System Metrics:**
   - CPU usage (target: < 70%)
   - Memory usage (target: < 80%)
   - Network I/O (target: < 100 Mbps)

---

## CONCLUSION

This performance testing guide provides complete strategies to validate the system can handle **1 million messages per day** on localhost.

**Testing Checklist:**
- ✅ k6 API load tests (50-200 VUs)
- ✅ Database benchmark (1000+ writes/sec)
- ✅ Queue throughput test (100+ msg/sec)
- ✅ E2E system test (5-10 minutes)
- ✅ Resource monitoring (Grafana)
- ✅ Bottleneck identification
- ✅ Performance regression tests (CI/CD)

**Success Criteria:**
- API p95 < 1 second
- Database writes > 1000/sec
- Queue throughput > 100 msg/sec
- Error rate < 1%
- No resource exhaustion

**Next Steps:**
1. Run all performance tests
2. Identify and fix bottlenecks
3. Re-run tests until targets met
4. Document actual performance metrics
5. Deploy to production with confidence

---

**Document Version:** 1.0
**Author:** CODER/ARCHITECT Agent
**Date:** 2025-12-30
**Status:** Ready for Testing
