# Chaos Engineering Tests

## Table of Contents

1. [Overview](#overview)
2. [Test Categories](#test-categories)
3. [Running Chaos Tests](#running-chaos-tests)
4. [Test Suites](#test-suites)
5. [Expected Behaviors](#expected-behaviors)
6. [Monitoring During Tests](#monitoring-during-tests)
7. [Test Results Documentation](#test-results-documentation)
8. [Scenario](#scenario)
9. [Observations](#observations)
10. [Improvements](#improvements)
11. [Safety Guidelines](#safety-guidelines)
12. [Tools Used](#tools-used)
13. [Next Steps](#next-steps)

---

## Overview

Chaos testing validates system resilience by intentionally introducing failures and observing system behavior under adverse conditions.

**Goal:** Ensure graceful degradation and automatic recovery.

---

## Test Categories

1. **Database Failures** - Connection loss, slow queries, pool exhaustion
2. **Message Queue Failures** - RabbitMQ crashes, network partitions
3. **Resource Constraints** - CPU/memory limits, disk pressure
4. **Network Issues** - Latency, packet loss, partitions
5. **Service Degradation** - External API failures, timeouts

---

## Running Chaos Tests

### Prerequisites

```bash

# Install dependencies

npm install

# Start infrastructure

docker-compose up -d

# Verify services running

docker ps
```

### Execute Tests

```bash

# All chaos tests

npm run test:chaos

# Specific test suite

npm run test:chaos -- database
npm run test:chaos -- rabbitmq
npm run test:chaos -- resources

# With verbose logging

DEBUG=chaos:* npm run test:chaos
```

---

## Test Suites

### 1. Database Chaos Tests

- **File:** `database-chaos.test.ts`
- **Scenarios:** Connection failures, slow queries, pool exhaustion
- **Recovery:** Automatic reconnection, circuit breaker activation

### 2. RabbitMQ Chaos Tests

- **File:** `rabbitmq-chaos.test.ts`
- **Scenarios:** Queue unavailability, message loss, connection drops
- **Recovery:** Auto-reconnect, message persistence, dead letter queues

### 3. Resource Limit Tests

- **File:** `resource-limits.test.ts`
- **Scenarios:** Memory constraints, CPU throttling, disk pressure
- **Recovery:** Graceful degradation, backpressure handling

### 4. Network Partition Tests

- **File:** `network-partition.test.ts`
- **Scenarios:** Network isolation, high latency, packet loss
- **Recovery:** Timeout handling, retry logic, fallback mechanisms

### 5. External Service Failures

- **File:** `external-service-chaos.test.ts`
- **Scenarios:** API timeouts, rate limiting, service outages
- **Recovery:** Circuit breaker, retry with backoff, graceful degradation

---

## Expected Behaviors

### System Should:

✅ **Continue Processing** - Unaffected operations proceed normally
✅ **Graceful Degradation** - Reduce functionality, don't crash
✅ **Auto-Recovery** - Reconnect and resume when services restore
✅ **Preserve Data** - No message loss, no data corruption
✅ **Log Errors** - Clear error messages for debugging
✅ **Alert Operators** - Trigger monitoring alerts
✅ **Circuit Breaker** - Prevent cascading failures

### System Should NOT:

❌ **Crash** - Application should stay running
❌ **Silent Failures** - All errors must be logged
❌ **Data Loss** - Messages must be persisted or retry
❌ **Infinite Retries** - Use exponential backoff with limits
❌ **Resource Leaks** - Clean up connections properly

---

## Monitoring During Tests

```bash

# Watch application logs

docker logs -f birthday-scheduler-api

# Monitor resource usage

docker stats

# Check queue depth

rabbitmqadmin list queues

# Database connections

psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"

# Application metrics

curl http://localhost:3000/metrics
```

---

## Test Results Documentation

After running chaos tests, document findings in `CHAOS_TEST_RESULTS.md`:

```markdown

# Test: Database Connection Failure
**Date:** 2025-12-30
**Duration:** 5 minutes

## Scenario

Killed PostgreSQL container while processing messages

## Observations

- ✅ Circuit breaker opened after 3 failures
- ✅ Application continued running
- ✅ Health check reported degraded state
- ✅ Automatic reconnection after 30s
- ⚠️ 12 messages delayed during outage

## Improvements

- Reduce circuit breaker threshold to 2 failures
- Implement message retry queue
```

---

## Safety Guidelines

⚠️ **NEVER run chaos tests in production without proper safeguards**

1. Run in isolated test environment
2. Have rollback plan ready
3. Monitor closely during tests
4. Start with small blast radius
5. Gradually increase severity
6. Document all findings

---

## Tools Used

- **Testcontainers** - Spin up and destroy containers
- **Toxiproxy** - Network failure injection
- **stress-ng** - CPU/memory stress testing
- **Vitest** - Test framework
- **Docker** - Container management

---

## Next Steps

1. Run all chaos tests and document results
2. Fix any critical issues discovered
3. Implement additional safeguards
4. Schedule regular chaos testing (monthly)
5. Integrate into CI/CD pipeline
