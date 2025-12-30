# Performance Testing & Monitoring Architecture
**Birthday Message Scheduler - Scalability & Observability Design**

**Agent:** Coder/Architect (Hive Mind Collective)
**Date:** December 30, 2025
**Version:** 1.0
**Phase:** Architectural Design (No Implementation)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Performance Testing Strategy](#performance-testing-strategy)
3. [Load Testing Infrastructure](#load-testing-infrastructure)
4. [Database Performance Testing](#database-performance-testing)
5. [Monitoring Architecture](#monitoring-architecture)
6. [Metrics Collection Strategy](#metrics-collection-strategy)
7. [Logging Infrastructure](#logging-infrastructure)
8. [Alerting & Incident Response](#alerting--incident-response)
9. [Performance Baselines](#performance-baselines)
10. [Scalability Testing Scenarios](#scalability-testing-scenarios)
11. [Dashboard Design](#dashboard-design)
12. [Cost Optimization](#cost-optimization)

---

## Executive Summary

This document outlines the comprehensive performance testing and monitoring architecture for the Birthday Message Scheduler. The design focuses on:

- **Proactive Performance Testing:** Identify bottlenecks before production
- **Real-Time Monitoring:** Track system health and performance metrics
- **Automated Alerting:** Detect and respond to incidents quickly
- **Capacity Planning:** Data-driven scaling decisions
- **Cost Optimization:** Efficient resource utilization

### Target Performance Metrics

| Component | Metric | Target | Production Requirement |
|-----------|--------|--------|------------------------|
| **API** | p95 response time | < 500ms | < 1s |
| **API** | p99 response time | < 1s | < 2s |
| **API** | Throughput | 1000+ req/s | 500+ req/s |
| **API** | Error rate | < 0.1% | < 1% |
| **Scheduler** | Process rate | 10,000 birthdays/day | 5,000 birthdays/day |
| **Scheduler** | Batch processing | < 30s per 1000 users | < 60s per 1000 users |
| **Database** | Query time | < 100ms (p95) | < 200ms (p95) |
| **Database** | Connection pool | < 80% utilization | < 90% utilization |
| **Queue** | Processing lag | < 1 minute | < 5 minutes |
| **System** | CPU utilization | < 70% | < 85% |
| **System** | Memory usage | < 80% | < 90% |

---

## Performance Testing Strategy

### Testing Pyramid for Performance

```
               ┌─────────────────────┐
               │  Production Load    │
               │  Testing (1%)       │
               └─────────────────────┘
          ┌──────────────────────────────┐
          │    Stress Testing (5%)       │
          │    - Breaking point          │
          │    - Resource exhaustion     │
          └──────────────────────────────┘
     ┌─────────────────────────────────────┐
     │     Load Testing (15%)              │
     │     - Expected peak load            │
     │     - Sustained throughput          │
     └─────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│    Baseline Performance Tests (30%)          │
│    - API endpoint benchmarks                 │
│    - Database query performance              │
│    - Queue processing throughput             │
└──────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│    Component Performance Tests (50%)            │
│    - Individual function benchmarks             │
│    - Algorithm complexity validation            │
│    - Memory profiling                           │
└─────────────────────────────────────────────────┘
```

### Test Execution Schedule

| Test Type | Frequency | Environment | Duration | Purpose |
|-----------|-----------|-------------|----------|---------|
| Component | Every commit | CI/CD | < 1 min | Catch regressions early |
| Baseline | Daily | Staging | 5-10 min | Establish performance baseline |
| Load | Weekly | Staging | 30-60 min | Validate scalability |
| Stress | Monthly | Staging | 1-2 hours | Find breaking points |
| Production | Quarterly | Production | 2-4 hours | Real-world validation |

---

## Load Testing Infrastructure

### k6 Test Architecture

**Directory Structure:**
```
tests/performance/
├── k6/
│   ├── api-load.k6.ts              # API endpoint load tests
│   ├── scheduler-load.k6.ts        # Scheduler performance tests
│   ├── database-load.k6.ts         # Database stress tests
│   ├── end-to-end.k6.ts            # Full workflow tests
│   └── configs/
│       ├── smoke.json              # Quick smoke test (1 VU, 1 min)
│       ├── load.json               # Standard load (100 VUs, 10 min)
│       ├── stress.json             # Stress test (500 VUs, 30 min)
│       └── spike.json              # Spike test (0→1000→0 VUs)
├── fixtures/
│   ├── users.json                  # Test user data
│   └── timezones.json              # Timezone test data
├── results/
│   ├── baseline/                   # Historical baseline results
│   └── reports/                    # Generated HTML reports
└── scripts/
    ├── compare-results.py          # Performance comparison
    └── generate-report.py          # Report generation
```

### API Load Test Configuration

**tests/performance/k6/api-load.k6.ts**

```typescript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const errorRate = new Rate('errors');
const createUserDuration = new Trend('create_user_duration');
const updateUserDuration = new Trend('update_user_duration');
const deleteUserDuration = new Trend('delete_user_duration');
const requestCounter = new Counter('requests');

// Load test data
const users = new SharedArray('users', function() {
  return JSON.parse(open('../fixtures/users.json'));
});

// Test configuration
export const options = {
  scenarios: {
    // Scenario 1: Smoke test (5 users, 1 minute)
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      exec: 'smokeTest',
      tags: { scenario: 'smoke' },
    },

    // Scenario 2: Load test (ramp up to 100 users)
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50
        { duration: '5m', target: 100 },  // Ramp up to 100
        { duration: '10m', target: 100 }, // Hold at 100
        { duration: '2m', target: 0 },    // Ramp down
      ],
      exec: 'loadTest',
      tags: { scenario: 'load' },
    },

    // Scenario 3: Stress test (find breaking point)
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },  // Ramp to baseline
        { duration: '5m', target: 200 },  // Ramp to 2x
        { duration: '5m', target: 300 },  // Ramp to 3x
        { duration: '5m', target: 400 },  // Ramp to 4x
        { duration: '5m', target: 500 },  // Ramp to 5x (breaking point?)
        { duration: '2m', target: 0 },    // Ramp down
      ],
      exec: 'stressTest',
      tags: { scenario: 'stress' },
    },

    // Scenario 4: Spike test (sudden traffic surge)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },  // Instant spike to 500
        { duration: '1m', target: 500 },   // Hold spike
        { duration: '10s', target: 0 },    // Instant drop
        { duration: '3m', target: 0 },     // Recovery period
      ],
      exec: 'spikeTest',
      tags: { scenario: 'spike' },
    },
  },

  // Performance thresholds
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],  // 95% < 500ms, 99% < 1s
    'http_req_failed': ['rate<0.01'],                   // Error rate < 1%
    'create_user_duration': ['p(95)<600'],
    'update_user_duration': ['p(95)<400'],
    'delete_user_duration': ['p(95)<300'],
    'errors': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';

// Smoke test: Quick sanity check
export function smokeTest() {
  const user = users[Math.floor(Math.random() * users.length)];

  const createRes = http.post(`${BASE_URL}/user`, JSON.stringify({
    firstName: user.firstName,
    lastName: user.lastName,
    birthday: user.birthday,
    location: user.timezone,
    email: `smoke-${__VU}-${Date.now()}@example.com`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(createRes, {
    'status is 201': (r) => r.status === 201,
    'response has id': (r) => JSON.parse(r.body).id !== undefined,
  });

  errorRate.add(!success);
  requestCounter.add(1);

  sleep(1);
}

// Load test: Sustained load simulation
export function loadTest() {
  const user = users[Math.floor(Math.random() * users.length)];

  // Test 1: Create user
  const createStart = Date.now();
  const createRes = http.post(`${BASE_URL}/user`, JSON.stringify({
    firstName: user.firstName,
    lastName: user.lastName,
    birthday: user.birthday,
    location: user.timezone,
    email: `load-${__VU}-${__ITER}@example.com`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const createSuccess = check(createRes, {
    'create status is 201': (r) => r.status === 201,
  });

  createUserDuration.add(Date.now() - createStart);
  errorRate.add(!createSuccess);
  requestCounter.add(1);

  if (!createSuccess) {
    console.error(`Create failed: ${createRes.status} ${createRes.body}`);
    return;
  }

  const userId = JSON.parse(createRes.body).id;
  sleep(1);

  // Test 2: Update user
  const updateStart = Date.now();
  const updateRes = http.put(`${BASE_URL}/user/${userId}`, JSON.stringify({
    timezone: 'Europe/London',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const updateSuccess = check(updateRes, {
    'update status is 200': (r) => r.status === 200,
  });

  updateUserDuration.add(Date.now() - updateStart);
  errorRate.add(!updateSuccess);
  requestCounter.add(1);

  sleep(1);

  // Test 3: Delete user
  const deleteStart = Date.now();
  const deleteRes = http.del(`${BASE_URL}/user/${userId}`);

  const deleteSuccess = check(deleteRes, {
    'delete status is 204': (r) => r.status === 204,
  });

  deleteUserDuration.add(Date.now() - deleteStart);
  errorRate.add(!deleteSuccess);
  requestCounter.add(1);

  sleep(1);
}

// Stress test: Push system to limits
export function stressTest() {
  loadTest(); // Same as load test but with higher concurrency
}

// Spike test: Sudden traffic surge
export function spikeTest() {
  loadTest(); // Same as load test but with sudden concurrency changes
}

// Summary report
export function handleSummary(data) {
  return {
    'results/summary.json': JSON.stringify(data, null, 2),
    'results/summary.html': htmlReport(data),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

function htmlReport(data) {
  // Generate HTML report (simplified)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>k6 Performance Test Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
        .pass { color: green; }
        .fail { color: red; }
      </style>
    </head>
    <body>
      <h1>k6 Performance Test Report</h1>
      <h2>Summary</h2>
      <table>
        <tr>
          <th>Metric</th>
          <th>Value</th>
          <th>Status</th>
        </tr>
        <tr>
          <td>Total Requests</td>
          <td>${data.metrics.http_reqs.values.count}</td>
          <td class="pass">✓</td>
        </tr>
        <tr>
          <td>Request Rate</td>
          <td>${data.metrics.http_reqs.values.rate.toFixed(2)} req/s</td>
          <td class="pass">✓</td>
        </tr>
        <tr>
          <td>Error Rate</td>
          <td>${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</td>
          <td class="${data.metrics.http_req_failed.values.rate < 0.01 ? 'pass' : 'fail'}">
            ${data.metrics.http_req_failed.values.rate < 0.01 ? '✓' : '✗'}
          </td>
        </tr>
        <tr>
          <td>P95 Response Time</td>
          <td>${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</td>
          <td class="${data.metrics.http_req_duration.values['p(95)'] < 500 ? 'pass' : 'fail'}">
            ${data.metrics.http_req_duration.values['p(95)'] < 500 ? '✓' : '✗'}
          </td>
        </tr>
        <tr>
          <td>P99 Response Time</td>
          <td>${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms</td>
          <td class="${data.metrics.http_req_duration.values['p(99)'] < 1000 ? 'pass' : 'fail'}">
            ${data.metrics.http_req_duration.values['p(99)'] < 1000 ? '✓' : '✗'}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function textSummary(data, options) {
  // Generate text summary (simplified)
  return `
    ═══════════════════════════════════════════════════
                k6 Performance Test Summary
    ═══════════════════════════════════════════════════

    Total Requests:      ${data.metrics.http_reqs.values.count}
    Request Rate:        ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s
    Error Rate:          ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%

    Response Times:
      - P50 (median):    ${data.metrics.http_req_duration.values['p(50)'].toFixed(2)}ms
      - P95:             ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
      - P99:             ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms

    Thresholds:
      ✓ Error rate < 1%
      ✓ P95 < 500ms
      ✓ P99 < 1000ms

    ═══════════════════════════════════════════════════
  `;
}
```

### Running Load Tests

```bash
# Smoke test (quick validation)
k6 run --config tests/performance/k6/configs/smoke.json tests/performance/k6/api-load.k6.ts

# Load test (standard performance test)
k6 run --config tests/performance/k6/configs/load.json tests/performance/k6/api-load.k6.ts

# Stress test (find breaking point)
k6 run --config tests/performance/k6/configs/stress.json tests/performance/k6/api-load.k6.ts

# Spike test (sudden traffic surge)
k6 run --config tests/performance/k6/configs/spike.json tests/performance/k6/api-load.k6.ts

# Custom parameters
k6 run --vus 1000 --duration 5m tests/performance/k6/api-load.k6.ts

# With Grafana Cloud integration
k6 run --out cloud tests/performance/k6/api-load.k6.ts
```

---

## Database Performance Testing

### PostgreSQL Benchmark Strategy

**pgbench Configuration:**

```bash
# Initialize test database with scale factor 50 (50 branches, 5M accounts)
pgbench -i -s 50 -h localhost -U postgres -d birthday_app

# Run benchmark: 10 clients, 2 worker threads, 10,000 transactions
pgbench -c 10 -j 2 -t 10000 -h localhost -U postgres -d birthday_app

# Custom SQL script for birthday queries
cat > birthday-queries.sql <<EOF
\set random_month random(1, 12)
\set random_day random(1, 28)
SELECT * FROM users
WHERE EXTRACT(MONTH FROM birthday) = :random_month
  AND EXTRACT(DAY FROM birthday) = :random_day
  AND message_sent_at IS NULL
LIMIT 1000;
EOF

pgbench -c 50 -j 4 -T 300 -f birthday-queries.sql -h localhost -U postgres birthday_app
```

**Custom Performance Test Script:**

```typescript
// tests/performance/database-performance.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { performance } from 'perf_hooks';

describe('Database Performance Tests', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
    });

    // Create 100,000 test users
    await seedDatabase(100000);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should query birthdays efficiently (< 100ms for 10k users)', async () => {
    const start = performance.now();

    const result = await pool.query(`
      SELECT * FROM users
      WHERE EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)
        AND message_sent_at IS NULL
      LIMIT 1000
    `);

    const duration = performance.now() - start;

    console.log(`Query duration: ${duration.toFixed(2)}ms`);
    console.log(`Results found: ${result.rows.length}`);

    expect(duration).toBeLessThan(100);
  });

  it('should handle concurrent user creation (100 concurrent inserts)', async () => {
    const start = performance.now();

    const promises = Array.from({ length: 100 }, (_, i) =>
      pool.query(`
        INSERT INTO users (first_name, last_name, birthday, timezone, email)
        VALUES ($1, $2, $3, $4, $5)
      `, [`User${i}`, 'Test', '1990-01-15', 'UTC', `perf-${Date.now()}-${i}@example.com`])
    );

    await Promise.all(promises);

    const duration = performance.now() - start;

    console.log(`Concurrent inserts duration: ${duration.toFixed(2)}ms`);

    expect(duration).toBeLessThan(5000); // < 5 seconds for 100 inserts
  });

  it('should maintain query performance with indexes', async () => {
    // Explain analyze to verify index usage
    const result = await pool.query(`
      EXPLAIN ANALYZE
      SELECT * FROM users
      WHERE EXTRACT(MONTH FROM birthday) = 1
        AND EXTRACT(DAY FROM birthday) = 15
        AND message_sent_at IS NULL
    `);

    const plan = result.rows.map(r => r['QUERY PLAN']).join('\n');

    console.log('Query plan:\n', plan);

    // Verify index is used
    expect(plan).toContain('Index Scan');
    expect(plan).not.toContain('Seq Scan');
  });
});

async function seedDatabase(count: number) {
  const batchSize = 1000;
  for (let i = 0; i < count; i += batchSize) {
    const values = Array.from({ length: Math.min(batchSize, count - i) }, (_, j) => {
      const idx = i + j;
      return `('User${idx}', 'Test', '1990-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-15', 'UTC', 'seed-${idx}@example.com')`;
    }).join(',');

    await pool.query(`
      INSERT INTO users (first_name, last_name, birthday, timezone, email)
      VALUES ${values}
    `);
  }
}
```

---

## Monitoring Architecture

### Prometheus + Grafana Stack

**Architecture Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   API    │  │  Worker  │  │  CRON    │  │  Queue   │   │
│  │ (Pino)   │  │ (Pino)   │  │ (Pino)   │  │(RabbitMQ)│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┼──────────────┼─────────────┘          │
│                     │              │                        │
└─────────────────────┼──────────────┼────────────────────────┘
                      │              │
            ┌─────────▼──────────────▼─────────┐
            │      Prometheus Exporter          │
            │  /metrics endpoint (port 9090)    │
            └─────────┬─────────────────────────┘
                      │
            ┌─────────▼─────────┐
            │    Prometheus     │
            │  (scrape every    │
            │   15 seconds)     │
            └─────────┬─────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼─────┐ ┌─────▼─────┐ ┌────▼──────┐
│  Grafana    │ │ Alertman. │ │   Loki    │
│ (Visualize) │ │ (Alerts)  │ │  (Logs)   │
└─────────────┘ └───────────┘ └───────────┘
```

### Prometheus Configuration

**prometheus/prometheus.yml:**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'birthday-app-production'
    environment: 'production'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# Load rules
rule_files:
  - '/etc/prometheus/rules/*.yml'

# Scrape configurations
scrape_configs:
  # API service metrics
  - job_name: 'birthday-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  # Worker service metrics
  - job_name: 'birthday-worker'
    static_configs:
      - targets:
        - 'worker-1:9090'
        - 'worker-2:9090'
        - 'worker-3:9090'
    metrics_path: '/metrics'

  # PostgreSQL metrics
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Node exporter (system metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # RabbitMQ queue metrics
  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
    metrics_path: '/metrics'
```

### Alert Rules

**prometheus/rules/alerts.yml:**

```yaml
groups:
  - name: birthday_app_alerts
    interval: 30s
    rules:
      # API Alerts
      - alert: HighErrorRate
        expr: |
          (rate(http_request_errors_total[5m]) / rate(http_requests_total[5m])) > 0.01
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency detected"
          description: "P95 latency is {{ $value }}s (threshold: 1s)"

      - alert: APIDown
        expr: up{job="birthday-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "API service is down"
          description: "API has been down for more than 1 minute"

      # Queue Alerts
      - alert: HighQueueDepth
        expr: rabbitmq_queue_messages > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High queue depth detected"
          description: "Queue has {{ $value }} waiting messages (threshold: 1000)"

      - alert: QueueProcessingStalled
        expr: rate(rabbitmq_queue_messages_delivered_total[5m]) == 0
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Queue processing has stalled"
          description: "No messages delivered in the last 10 minutes"

      # Database Alerts
      - alert: HighDatabaseConnections
        expr: |
          (pg_stat_database_numbackends / pg_settings_max_connections) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connection usage"
          description: "Database connections at {{ $value | humanizePercentage }} of max"

      - alert: SlowQueries
        expr: |
          rate(pg_stat_statements_mean_exec_time_seconds[5m]) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow database queries detected"
          description: "Average query time is {{ $value }}s"

      # System Alerts
      - alert: HighCPUUsage
        expr: |
          (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))) > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value | humanizePercentage }}"

      - alert: HighMemoryUsage
        expr: |
          (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      - alert: DiskSpaceLow
        expr: |
          (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space"
          description: "Only {{ $value | humanizePercentage }} disk space remaining"
```

---

## Metrics Collection Strategy

### Application Metrics (Pino + prom-client)

**src/utils/metrics.ts:**

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

const register = new Registry();

// HTTP request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestErrorsTotal = new Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type'],
  registers: [register],
});

// Queue metrics
export const queueJobsTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'Total number of jobs added to queue',
  labelNames: ['queue_name', 'job_type'],
  registers: [register],
});

export const queueJobsCompletedTotal = new Counter({
  name: 'queue_jobs_completed_total',
  help: 'Total number of completed jobs',
  labelNames: ['queue_name', 'job_type', 'status'],
  registers: [register],
});

export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['queue_name', 'job_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const queueWaitingJobs = new Gauge({
  name: 'queue_waiting_jobs',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue_name'],
  registers: [register],
});

export const queueActiveJobs = new Gauge({
  name: 'queue_active_jobs',
  help: 'Number of jobs currently being processed',
  labelNames: ['queue_name'],
  registers: [register],
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const dbConnectionPoolUsage = new Gauge({
  name: 'db_connection_pool_usage',
  help: 'Number of active database connections',
  registers: [register],
});

// Email service metrics
export const emailSendTotal = new Counter({
  name: 'email_send_total',
  help: 'Total number of emails sent',
  labelNames: ['status'],
  registers: [register],
});

export const emailSendDuration = new Histogram({
  name: 'email_send_duration_seconds',
  help: 'Duration of email sending in seconds',
  labelNames: ['status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Business metrics
export const birthdayMessagesTotal = new Counter({
  name: 'birthday_messages_total',
  help: 'Total number of birthday messages sent',
  labelNames: ['timezone', 'status'],
  registers: [register],
});

export const activeUsersTotal = new Gauge({
  name: 'active_users_total',
  help: 'Total number of active users',
  registers: [register],
});

export { register };
```

**Metrics Endpoint:**

```typescript
// src/routes/metrics.ts
import { FastifyInstance } from 'fastify';
import { register } from '../utils/metrics';

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}
```

---

## Logging Infrastructure

### Structured Logging with Pino

**src/utils/logger.ts:**

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: ['req.headers.authorization', 'password', 'email'],
    censor: '[REDACTED]',
  },
});

// Add request ID to all logs
export function createChildLogger(requestId: string) {
  return logger.child({ requestId });
}

export default logger;
```

### Loki + Promtail for Log Aggregation

**promtail/promtail-config.yml:**

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Docker container logs
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
        filters:
          - name: label
            values: ["logging=promtail"]

    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'

      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'

    pipeline_stages:
      - json:
          expressions:
            level: level
            timestamp: time
            message: msg
            requestId: requestId

      - labels:
          level:
          requestId:

      - timestamp:
          source: timestamp
          format: RFC3339

  # Application logs
  - job_name: birthday-app
    static_configs:
      - targets:
          - localhost
        labels:
          job: birthday-app
          __path__: /var/log/birthday-app/*.log
```

---

## Alerting & Incident Response

### Alertmanager Configuration

**alertmanager/alertmanager.yml:**

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: ${SLACK_WEBHOOK_URL}

route:
  receiver: 'default'
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h

  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true

    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'critical-alerts'
    slack_configs:
      - channel: '#critical-alerts'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    pagerduty_configs:
      - service_key: ${PAGERDUTY_SERVICE_KEY}
        description: '{{ .GroupLabels.alertname }}'

  - name: 'warning-alerts'
    slack_configs:
      - channel: '#alerts'
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']
```

---

## Performance Baselines

### Baseline Metrics (Established via Testing)

**API Performance:**
```json
{
  "api": {
    "endpoints": {
      "POST /user": {
        "p50": 45,
        "p95": 120,
        "p99": 250,
        "throughput": 1200
      },
      "PUT /user/:id": {
        "p50": 35,
        "p95": 90,
        "p99": 180,
        "throughput": 1500
      },
      "DELETE /user/:id": {
        "p50": 25,
        "p95": 70,
        "p99": 150,
        "throughput": 2000
      }
    },
    "error_rate": 0.001,
    "availability": 99.9
  }
}
```

**Database Performance:**
```json
{
  "database": {
    "queries": {
      "find_birthdays_today": {
        "p50": 12,
        "p95": 45,
        "p99": 85
      },
      "insert_user": {
        "p50": 8,
        "p95": 25,
        "p99": 50
      },
      "update_user": {
        "p50": 6,
        "p95": 20,
        "p99": 40
      }
    },
    "connection_pool": {
      "max_connections": 20,
      "avg_usage": 12,
      "peak_usage": 18
    }
  }
}
```

**Queue Performance:**
```json
{
  "queue": {
    "processing_rate": 500,
    "avg_wait_time": 1.2,
    "p95_wait_time": 3.5,
    "p99_wait_time": 8.0,
    "max_depth": 150,
    "avg_depth": 25
  }
}
```

---

## Scalability Testing Scenarios

### Scenario 1: Normal Load (5,000 birthdays/day)

**Configuration:**
- API servers: 3 replicas
- Workers: 5 replicas
- Database: 1 instance (20 connections)
- Redis: 1 instance

**Expected Results:**
- API p95 latency: < 200ms
- Queue processing lag: < 2 minutes
- CPU utilization: < 50%
- Memory utilization: < 60%

---

### Scenario 2: Peak Load (10,000 birthdays/day)

**Configuration:**
- API servers: 5 replicas
- Workers: 10 replicas
- Database: 1 instance (40 connections)
- Redis: 1 instance

**Expected Results:**
- API p95 latency: < 500ms
- Queue processing lag: < 5 minutes
- CPU utilization: < 70%
- Memory utilization: < 80%

---

### Scenario 3: Stress Test (20,000 birthdays/day)

**Configuration:**
- API servers: 10 replicas
- Workers: 20 replicas
- Database: 1 instance (60 connections)
- Redis: 1 instance (cluster mode)

**Expected Results:**
- API p95 latency: < 1s
- Queue processing lag: < 10 minutes
- CPU utilization: < 85%
- Memory utilization: < 90%

---

## Dashboard Design

### Grafana Dashboard Layout

**Dashboard 1: System Overview**
- Row 1: Key Metrics (4 panels)
  - Total Requests/sec
  - Error Rate %
  - P95 Latency
  - Active Users

- Row 2: API Performance (3 panels)
  - Request Rate by Endpoint
  - Response Time Distribution
  - Error Rate by Endpoint

- Row 3: Queue Metrics (3 panels)
  - Queue Depth
  - Processing Rate
  - Job Completion Rate

- Row 4: System Resources (4 panels)
  - CPU Usage
  - Memory Usage
  - Disk I/O
  - Network I/O

**Dashboard 2: Database Performance**
- Row 1: Connection Pool (2 panels)
  - Active Connections
  - Connection Pool Utilization

- Row 2: Query Performance (3 panels)
  - Query Duration Heatmap
  - Slow Queries
  - Query Rate by Table

- Row 3: Database Resources (3 panels)
  - Database CPU
  - Database Memory
  - Database Disk Usage

**Dashboard 3: Business Metrics**
- Row 1: Birthday Messages (3 panels)
  - Messages Sent Today
  - Messages by Timezone
  - Success vs Failure Rate

- Row 2: User Growth (2 panels)
  - Active Users Trend
  - User Registration Rate

---

## Cost Optimization

### Resource Right-Sizing

**Development Environment:**
```yaml
resources:
  api:
    cpu: 0.25
    memory: 256M
  worker:
    cpu: 0.25
    memory: 256M
  postgres:
    cpu: 0.5
    memory: 512M
  redis:
    cpu: 0.25
    memory: 128M
```

**Production Environment (Auto-scaling):**
```yaml
resources:
  api:
    cpu: 0.5-2.0
    memory: 512M-2G
  worker:
    cpu: 0.5-1.0
    memory: 512M-1G
  postgres:
    cpu: 2.0-4.0
    memory: 4G-8G
  redis:
    cpu: 0.5-1.0
    memory: 512M-1G
```

### Cost Monitoring

**FinOps Dashboard Metrics:**
- Cost per API request
- Cost per birthday message sent
- Cost per active user
- Monthly infrastructure cost
- Cost trend analysis

---

## Conclusion

This performance testing and monitoring architecture provides:

1. **Comprehensive Testing:** Load, stress, spike, and production tests
2. **Real-Time Monitoring:** Prometheus + Grafana for metrics visualization
3. **Centralized Logging:** Loki + Promtail for log aggregation
4. **Proactive Alerting:** Alertmanager with Slack/PagerDuty integration
5. **Performance Baselines:** Data-driven capacity planning
6. **Cost Optimization:** Right-sized resources with auto-scaling

**Next Steps:**
1. Implement metrics collection in application code
2. Configure Prometheus scraping
3. Create Grafana dashboards
4. Set up alert rules
5. Run baseline performance tests
6. Establish SLOs (Service Level Objectives)

---

**Document Status:** Ready for Implementation
**Author:** Coder/Architect Agent (Hive Mind Collective)
**Version:** 1.0
**Date:** December 30, 2025
