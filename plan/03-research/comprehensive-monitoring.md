# Comprehensive Monitoring Plan - Happy Birthday Message Scheduler

**Document Version:** 1.0
**Date:** 2025-12-30
**Status:** Complete Research & Implementation Plan
**Goal:** Achieve 100% observability with zero blind spots

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Monitoring State](#current-monitoring-state)
3. [Complete Metrics Inventory](#complete-metrics-inventory)
4. [Missing Metrics Analysis](#missing-metrics-analysis)
5. [Monitoring Architecture](#monitoring-architecture)
6. [Grafana Dashboard Specifications](#grafana-dashboard-specifications)
7. [Alert Rule Definitions](#alert-rule-definitions)
8. [OpenTelemetry Integration Plan](#opentelemetry-integration-plan)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Best Practices & Standards](#best-practices--standards)

---

## Executive Summary

### Current State

- **Monitoring Stack:** Prometheus + Grafana (operational)
- **Coverage:** ~60% of critical metrics implemented
- **Gaps:** User activity, message patterns, external API, cache, security, cost tracking
- **Alert Coverage:** Basic alerts defined, missing SLI/SLO framework

### Target State

- **Coverage:** 100% of application, business, infrastructure, and security metrics
- **Observability:** RED + USE + Golden Signals implemented
- **Alerting:** SLI/SLO-based alerts with runbooks
- **Tracing:** OpenTelemetry for distributed request tracing
- **Log Aggregation:** Structured logs with correlation IDs

### Key Recommendations

1. **Immediate:** Add missing business metrics (user activity, message patterns)
2. **Short-term:** Implement OpenTelemetry for distributed tracing
3. **Medium-term:** Add log aggregation (Loki) and security metrics
4. **Long-term:** Implement cost tracking and FinOps dashboards

---

## Current Monitoring State

### ✅ Currently Monitored Metrics

#### 1. HTTP/API Metrics (via `metrics.middleware.ts`)

```typescript
// Implemented in metricsService
- birthday_scheduler_api_requests_total (Counter)
  Labels: method, path, status

- birthday_scheduler_api_response_time_seconds (Histogram)
  Labels: method, path, status
  Buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
```

**Coverage:** ✅ Request rate, latency (P50/P95/P99), status codes

#### 2. Business Metrics (via `metrics.service.ts`)

```typescript
// Message lifecycle tracking
- birthday_scheduler_messages_scheduled_total (Counter)
  Labels: message_type, timezone

- birthday_scheduler_messages_sent_total (Counter)
  Labels: message_type, status_code

- birthday_scheduler_messages_failed_total (Counter)
  Labels: message_type, error_type, retry_count

- birthday_scheduler_message_delivery_duration_seconds (Histogram)
  Labels: message_type, status
  Buckets: [0.1, 0.5, 1, 2, 5, 10, 30]

- birthday_scheduler_message_processing_quantiles (Summary)
  Labels: message_type
  Percentiles: [0.5, 0.9, 0.95, 0.99]
```

**Coverage:** ✅ Messages scheduled, sent, failed (by type)

#### 3. Queue Metrics (partial)

```typescript
- birthday_scheduler_queue_depth (Gauge)
  Labels: queue_name
```

**Coverage:** ⚠️ Queue depth only - missing: processing time, DLQ, consumer health

#### 4. Worker Metrics (partial)

```typescript
- birthday_scheduler_active_workers (Gauge)
  Labels: worker_type
```

**Coverage:** ⚠️ Active workers only - missing: utilization, task completion time

#### 5. Scheduler Metrics

```typescript
- birthday_scheduler_execution_duration_seconds (Histogram)
  Labels: job_type, status
  Buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120]
```

**Coverage:** ✅ CRON execution time and status

#### 6. Circuit Breaker Metrics

```typescript
- birthday_scheduler_circuit_breaker_open (Gauge)
  Labels: service_name
```

**Coverage:** ✅ Circuit breaker state (open/closed)

#### 7. Database Metrics (partial)

```typescript
- birthday_scheduler_database_connections (Gauge)
  Labels: pool_name, state (active/idle)
```

**Coverage:** ⚠️ Connection pool only - missing: query time, slow queries, deadlocks

#### 8. Resource Metrics (Node.js defaults)

```typescript
// Collected via collectDefaultMetrics()
- process_cpu_user_seconds_total
- process_cpu_system_seconds_total
- process_resident_memory_bytes
- process_heap_bytes
- nodejs_eventloop_lag_seconds
- nodejs_gc_duration_seconds
```

**Coverage:** ✅ CPU, memory, event loop, GC

### 🔴 Current Gaps

1. **User Activity Metrics:** Not tracked
2. **Message Pattern Metrics:** Not tracked (time-to-delivery, retry patterns)
3. **External API Metrics:** Not tracked (vendor response times, error rates)
4. **Cache Metrics:** Not implemented (no caching yet)
5. **Security Metrics:** Not tracked (rate limits, auth failures)
6. **Cost Metrics:** Not tracked
7. **Database Performance:** Partial (missing slow queries, deadlocks)
8. **Queue Health:** Partial (missing processing time, DLQ depth)
9. **Log Aggregation:** Not implemented
10. **Distributed Tracing:** Not implemented

---

## Complete Metrics Inventory

### Category 1: Application Metrics (RED Method)

**RED = Rate, Errors, Duration**

#### HTTP/API Layer

```typescript
// ✅ IMPLEMENTED
- birthday_scheduler_api_requests_total
  Description: Total HTTP requests
  Type: Counter
  Labels: method, path, status
  Use: Track request rate

- birthday_scheduler_api_response_time_seconds
  Description: HTTP response time distribution
  Type: Histogram
  Labels: method, path, status
  Buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  Use: Calculate P50, P95, P99 latency

// 🔴 MISSING
- birthday_scheduler_api_request_size_bytes
  Description: HTTP request body size
  Type: Histogram
  Labels: method, path
  Buckets: [100, 1000, 10000, 100000, 1000000]
  Use: Track payload sizes

- birthday_scheduler_api_response_size_bytes
  Description: HTTP response body size
  Type: Histogram
  Labels: method, path
  Buckets: [100, 1000, 10000, 100000, 1000000]
  Use: Track response sizes

- birthday_scheduler_api_concurrent_requests
  Description: Number of in-flight requests
  Type: Gauge
  Use: Track concurrent load
```

### Category 2: Business Metrics

#### Message Lifecycle

```typescript
// ✅ IMPLEMENTED
- birthday_scheduler_messages_scheduled_total
- birthday_scheduler_messages_sent_total
- birthday_scheduler_messages_failed_total
- birthday_scheduler_message_delivery_duration_seconds
- birthday_scheduler_message_processing_quantiles

// 🔴 MISSING - Message Patterns
- birthday_scheduler_message_time_to_delivery_seconds
  Description: Time from scheduled to actual send
  Type: Histogram
  Labels: message_type
  Buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600]
  Use: Track delivery latency vs schedule

- birthday_scheduler_message_retry_attempts
  Description: Distribution of retry attempts
  Type: Histogram
  Labels: message_type
  Buckets: [0, 1, 2, 3, 4, 5]
  Use: Understand retry patterns

- birthday_scheduler_message_delivery_attempts_total
  Description: Total delivery attempts (including retries)
  Type: Counter
  Labels: message_type, attempt_number
  Use: Track retry frequency

- birthday_scheduler_message_idempotency_skips_total
  Description: Messages skipped due to idempotency
  Type: Counter
  Labels: message_type
  Use: Track duplicate prevention
```

#### User Activity

```typescript
// 🔴 MISSING - All user metrics
- birthday_scheduler_users_created_total
  Description: Total users created
  Type: Counter
  Labels: timezone_region
  Use: Track user growth

- birthday_scheduler_users_active_total
  Description: Total active users (have upcoming messages)
  Type: Gauge
  Labels: message_type
  Use: Track active user base

- birthday_scheduler_users_inactive_total
  Description: Users with no upcoming messages
  Type: Gauge
  Use: Track user churn

- birthday_scheduler_users_by_timezone
  Description: User distribution by timezone
  Type: Gauge
  Labels: timezone
  Use: Understand geographic distribution

- birthday_scheduler_user_registration_rate
  Description: User registration rate (per hour)
  Type: Gauge
  Use: Track growth trends
```

### Category 3: Database Metrics

```typescript
// ✅ IMPLEMENTED (partial)
- birthday_scheduler_database_connections
  Labels: pool_name, state (active/idle)

// 🔴 MISSING - Query Performance
- birthday_scheduler_database_query_duration_seconds
  Description: Database query execution time
  Type: Histogram
  Labels: query_type, table
  Buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2]
  Use: Track slow queries

- birthday_scheduler_database_slow_queries_total
  Description: Queries exceeding threshold (100ms)
  Type: Counter
  Labels: query_type, table
  Use: Alert on performance degradation

- birthday_scheduler_database_deadlocks_total
  Description: Database deadlock occurrences
  Type: Counter
  Use: Track transaction conflicts

- birthday_scheduler_database_transaction_duration_seconds
  Description: Transaction execution time
  Type: Histogram
  Labels: operation
  Buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  Use: Track transaction performance

- birthday_scheduler_database_pool_wait_time_seconds
  Description: Time waiting for connection from pool
  Type: Histogram
  Buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
  Use: Track pool saturation

- birthday_scheduler_database_rows_affected
  Description: Number of rows affected by queries
  Type: Histogram
  Labels: operation, table
  Buckets: [1, 10, 100, 1000, 10000]
  Use: Understand query impact
```

### Category 4: Queue Metrics (RabbitMQ)

```typescript
// ✅ IMPLEMENTED (partial)
- birthday_scheduler_queue_depth
  Labels: queue_name

// 🔴 MISSING - Queue Health
- birthday_scheduler_queue_messages_published_total
  Description: Messages published to queue
  Type: Counter
  Labels: queue_name
  Use: Track message production

- birthday_scheduler_queue_messages_consumed_total
  Description: Messages consumed from queue
  Type: Counter
  Labels: queue_name, status (ack/nack/reject)
  Use: Track message consumption

- birthday_scheduler_queue_message_processing_duration_seconds
  Description: Time to process message (consume to ack)
  Type: Histogram
  Labels: queue_name
  Buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
  Use: Track worker performance

- birthday_scheduler_queue_dlq_messages
  Description: Messages in dead-letter queue
  Type: Gauge
  Labels: dlq_name
  Use: Alert on unprocessable messages

- birthday_scheduler_queue_consumers_active
  Description: Number of active consumers
  Type: Gauge
  Labels: queue_name
  Use: Track worker scaling

- birthday_scheduler_queue_messages_unacked
  Description: Messages consumed but not acknowledged
  Type: Gauge
  Labels: queue_name
  Use: Track in-flight messages

- birthday_scheduler_queue_publish_rate
  Description: Message publish rate (msg/sec)
  Type: Gauge
  Labels: queue_name
  Use: Track production throughput

- birthday_scheduler_queue_consume_rate
  Description: Message consume rate (msg/sec)
  Type: Gauge
  Labels: queue_name
  Use: Track consumption throughput

- birthday_scheduler_queue_prefetch_count
  Description: Current prefetch setting per consumer
  Type: Gauge
  Labels: queue_name
  Use: Monitor fair distribution
```

### Category 5: Worker Metrics

```typescript
// ✅ IMPLEMENTED (partial)
- birthday_scheduler_active_workers
  Labels: worker_type

// 🔴 MISSING - Worker Performance
- birthday_scheduler_worker_task_duration_seconds
  Description: Worker task execution time
  Type: Histogram
  Labels: worker_id, task_type
  Buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
  Use: Track individual worker performance

- birthday_scheduler_worker_utilization_percent
  Description: Worker busy time percentage
  Type: Gauge
  Labels: worker_id
  Use: Track worker efficiency

- birthday_scheduler_worker_tasks_completed_total
  Description: Tasks completed by worker
  Type: Counter
  Labels: worker_id, status (success/failure)
  Use: Track worker throughput

- birthday_scheduler_worker_restarts_total
  Description: Worker restart count
  Type: Counter
  Labels: worker_id, reason
  Use: Track worker stability

- birthday_scheduler_worker_errors_total
  Description: Worker error count
  Type: Counter
  Labels: worker_id, error_type
  Use: Track worker failures

- birthday_scheduler_worker_idle_time_seconds
  Description: Worker idle time
  Type: Counter
  Labels: worker_id
  Use: Optimize worker count
```

### Category 6: Scheduler Metrics

```typescript
// ✅ IMPLEMENTED
- birthday_scheduler_execution_duration_seconds
  Labels: job_type, status

// 🔴 MISSING - Scheduler Health
- birthday_scheduler_cron_job_executions_total
  Description: Total CRON job executions
  Type: Counter
  Labels: job_name, status (success/failure)
  Use: Track scheduler reliability

- birthday_scheduler_cron_job_last_success_timestamp
  Description: Unix timestamp of last successful execution
  Type: Gauge
  Labels: job_name
  Use: Alert on missed schedules

- birthday_scheduler_cron_job_missed_executions_total
  Description: Missed CRON executions
  Type: Counter
  Labels: job_name
  Use: Track scheduling failures

- birthday_scheduler_cron_job_messages_scheduled
  Description: Messages scheduled per job execution
  Type: Histogram
  Labels: job_name
  Buckets: [0, 1, 10, 100, 1000, 10000]
  Use: Understand batch sizes

- birthday_scheduler_scheduler_lag_seconds
  Description: Delay between expected and actual execution
  Type: Histogram
  Labels: job_name
  Buckets: [0, 1, 5, 10, 30, 60, 300]
  Use: Track scheduling accuracy
```

### Category 7: External API Metrics

```typescript
// 🔴 MISSING - All external API metrics
- birthday_scheduler_external_api_requests_total
  Description: Requests to external message API
  Type: Counter
  Labels: vendor, endpoint, status
  Use: Track external API usage

- birthday_scheduler_external_api_response_time_seconds
  Description: External API response time
  Type: Histogram
  Labels: vendor, endpoint
  Buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
  Use: Track vendor performance

- birthday_scheduler_external_api_errors_total
  Description: External API errors
  Type: Counter
  Labels: vendor, error_type
  Use: Track vendor reliability

- birthday_scheduler_external_api_timeouts_total
  Description: External API timeout count
  Type: Counter
  Labels: vendor, endpoint
  Use: Track timeout issues

- birthday_scheduler_external_api_circuit_breaker_state
  Description: Circuit breaker state per vendor
  Type: Gauge
  Labels: vendor
  Values: 0 (closed), 1 (open), 2 (half-open)
  Use: Track circuit breaker status

- birthday_scheduler_external_api_rate_limit_hits_total
  Description: Rate limit violations from vendor
  Type: Counter
  Labels: vendor
  Use: Track rate limiting
```

### Category 8: Security Metrics

```typescript
// 🔴 MISSING - All security metrics
- birthday_scheduler_rate_limit_exceeded_total
  Description: Rate limit violations by clients
  Type: Counter
  Labels: path, client_ip
  Use: Detect abuse

- birthday_scheduler_authentication_failures_total
  Description: Failed authentication attempts
  Type: Counter
  Labels: auth_type
  Use: Detect attacks

- birthday_scheduler_authorization_denials_total
  Description: Authorization denials
  Type: Counter
  Labels: resource, action
  Use: Track access control

- birthday_scheduler_suspicious_activity_total
  Description: Suspicious activity events
  Type: Counter
  Labels: activity_type
  Use: Security monitoring

- birthday_scheduler_api_key_usage_total
  Description: API key usage count
  Type: Counter
  Labels: key_id
  Use: Track API key usage

- birthday_scheduler_csrf_violations_total
  Description: CSRF protection violations
  Type: Counter
  Use: Detect CSRF attempts
```

### Category 9: Cache Metrics (Future)

```typescript
// 🔴 MISSING - Not implemented yet (Redis/cache layer)
- birthday_scheduler_cache_hits_total
  Description: Cache hit count
  Type: Counter
  Labels: cache_type
  Use: Track cache efficiency

- birthday_scheduler_cache_misses_total
  Description: Cache miss count
  Type: Counter
  Labels: cache_type
  Use: Track cache efficiency

- birthday_scheduler_cache_evictions_total
  Description: Cache eviction count
  Type: Counter
  Labels: cache_type, reason
  Use: Tune cache size

- birthday_scheduler_cache_size_bytes
  Description: Current cache size
  Type: Gauge
  Labels: cache_type
  Use: Monitor memory usage

- birthday_scheduler_cache_operation_duration_seconds
  Description: Cache operation time
  Type: Histogram
  Labels: operation (get/set/delete)
  Buckets: [0.0001, 0.001, 0.01, 0.1, 1]
  Use: Track cache performance
```

### Category 10: Cost Metrics

```typescript
// 🔴 MISSING - All cost metrics
- birthday_scheduler_api_call_cost_usd
  Description: Estimated cost per API call
  Type: Counter
  Labels: vendor, message_type
  Use: Track operational costs

- birthday_scheduler_infrastructure_cost_usd_hourly
  Description: Infrastructure cost per hour
  Type: Gauge
  Labels: resource_type (database/queue/compute)
  Use: FinOps tracking

- birthday_scheduler_messages_cost_usd
  Description: Cost per message sent
  Type: Counter
  Labels: message_type
  Use: Calculate ROI

- birthday_scheduler_cost_per_user_usd
  Description: Cost per active user
  Type: Gauge
  Use: Unit economics
```

### Category 11: Resource Metrics (USE Method)

**USE = Utilization, Saturation, Errors**

```typescript
// ✅ IMPLEMENTED (via Node.js defaults)
- process_cpu_user_seconds_total
- process_cpu_system_seconds_total
- process_resident_memory_bytes
- process_heap_bytes
- nodejs_eventloop_lag_seconds
- nodejs_gc_duration_seconds

// 🔴 MISSING - Additional resource metrics
- birthday_scheduler_disk_io_bytes_total
  Description: Disk I/O bytes read/written
  Type: Counter
  Labels: operation (read/write)
  Use: Track I/O usage

- birthday_scheduler_network_io_bytes_total
  Description: Network bytes sent/received
  Type: Counter
  Labels: direction (in/out)
  Use: Track network usage

- birthday_scheduler_file_descriptors_used
  Description: Open file descriptors
  Type: Gauge
  Use: Prevent fd exhaustion

- birthday_scheduler_thread_count
  Description: Active thread count
  Type: Gauge
  Use: Monitor concurrency
```

---

## Missing Metrics Analysis

### Priority 1: Critical Business Metrics (Implement First)

#### 1. User Activity Metrics
**Why Critical:** Business growth and engagement tracking
**Impact:** Cannot measure user growth, churn, or geographic distribution
**Implementation Complexity:** Low
**Estimated Effort:** 2-4 hours

```typescript
// Add to metrics.service.ts
public readonly usersCreatedTotal: Counter;
public readonly usersActiveGauge: Gauge;
public readonly usersByTimezone: Gauge;

// Track in UserService
recordUserCreated(timezone: string): void {
  this.usersCreatedTotal.inc({ timezone_region: getRegion(timezone) });
}
```

#### 2. Message Pattern Metrics
**Why Critical:** Understand delivery performance and retry patterns
**Impact:** Cannot optimize retry logic or detect delivery issues
**Implementation Complexity:** Medium
**Estimated Effort:** 4-8 hours

```typescript
// Track time-to-delivery
const scheduledTime = message.scheduledSendTime;
const actualTime = new Date();
const delay = (actualTime - scheduledTime) / 1000;
metricsService.recordTimeToDelivery(messageType, delay);

// Track retry patterns
metricsService.recordRetryAttempt(messageType, retryCount);
```

#### 3. External API Metrics
**Why Critical:** Track vendor performance and reliability
**Impact:** Cannot detect vendor issues or optimize circuit breaker
**Implementation Complexity:** Medium
**Estimated Effort:** 4-6 hours

```typescript
// Add to MessageSenderService
async sendMessage(): Promise<MessageResponse> {
  const startTime = Date.now();
  try {
    const response = await this.httpClient.post(...);
    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordExternalApiRequest('message_api', 'send', response.statusCode);
    metricsService.recordExternalApiResponseTime('message_api', 'send', duration);
    return response;
  } catch (error) {
    metricsService.recordExternalApiError('message_api', error.type);
    throw error;
  }
}
```

### Priority 2: Operational Metrics (Implement Next)

#### 4. Enhanced Queue Metrics
**Why Important:** Optimize worker scaling and detect queue issues
**Impact:** Cannot properly scale workers or detect DLQ buildup
**Implementation Complexity:** Medium-High
**Estimated Effort:** 6-10 hours

Requires RabbitMQ Management API integration:
```typescript
// RabbitMQ metrics collector
class RabbitMQMetricsCollector {
  async collectMetrics(): Promise<void> {
    const queueStats = await this.getQueueStats();
    metricsService.setQueueDepth('birthday-messages', queueStats.messages);
    metricsService.setQueueDLQDepth('birthday-dlq', queueStats.dlqMessages);
    metricsService.setQueueConsumerCount('birthday-messages', queueStats.consumers);
    metricsService.setQueueUnackedMessages('birthday-messages', queueStats.unacked);
  }
}
```

#### 5. Worker Performance Metrics
**Why Important:** Optimize worker count and detect performance issues
**Impact:** Cannot properly scale or identify slow workers
**Implementation Complexity:** Low-Medium
**Estimated Effort:** 4-6 hours

```typescript
// Add to MessageWorker
async processMessage(job: MessageJob): Promise<void> {
  const workerId = process.env.WORKER_ID;
  const startTime = Date.now();

  try {
    await this.handleMessage(job);
    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordWorkerTaskCompletion(workerId, 'success', duration);
  } catch (error) {
    metricsService.recordWorkerError(workerId, error.type);
    throw error;
  }
}
```

#### 6. Database Performance Metrics
**Why Important:** Detect slow queries and optimize database
**Impact:** Cannot identify query bottlenecks
**Implementation Complexity:** Medium
**Estimated Effort:** 6-8 hours

Requires query instrumentation:
```typescript
// Drizzle ORM middleware
db.use(async (query, params, next) => {
  const startTime = Date.now();
  const result = await next();
  const duration = (Date.now() - startTime) / 1000;

  metricsService.recordQueryDuration(query.type, query.table, duration);
  if (duration > 0.1) { // 100ms threshold
    metricsService.recordSlowQuery(query.type, query.table);
  }
  return result;
});
```

### Priority 3: Enhanced Observability (Implement After P1/P2)

#### 7. Security Metrics
**Why Important:** Detect abuse and attacks
**Impact:** Limited security visibility
**Implementation Complexity:** Low-Medium
**Estimated Effort:** 4-6 hours

```typescript
// Add to rate-limit middleware
if (rateLimitExceeded) {
  metricsService.recordRateLimitViolation(req.path, req.ip);
  throw new TooManyRequestsError();
}
```

#### 8. Scheduler Health Metrics
**Why Important:** Detect missed CRON executions
**Impact:** Cannot detect scheduler failures
**Implementation Complexity:** Low
**Estimated Effort:** 2-4 hours

```typescript
// Add to scheduler service
async executeJob(jobName: string): Promise<void> {
  try {
    await job.execute();
    metricsService.recordCronJobSuccess(jobName);
    metricsService.updateCronJobLastSuccess(jobName, Date.now());
  } catch (error) {
    metricsService.recordCronJobFailure(jobName);
  }
}
```

### Priority 4: Future Enhancements

#### 9. Cache Metrics (when Redis is added)
**Implementation:** When caching layer is added
**Estimated Effort:** 4-6 hours

#### 10. Cost Metrics (for FinOps)
**Implementation:** Phase 2/3 enhancement
**Estimated Effort:** 8-12 hours (requires billing integration)

---

## Monitoring Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Fastify API  │  │   Workers    │  │  Schedulers  │              │
│  │   (5 pods)   │  │  (10 pods)   │  │   (1 pod)    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                       │
│         └─────────────────┴──────────────────┘                       │
│                           │                                          │
│                           │ Expose /metrics                          │
│                           ▼                                          │
└───────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Metrics Collection Layer                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Prometheus                               │   │
│  │  - Scrape interval: 15s                                      │   │
│  │  - Retention: 15 days                                        │   │
│  │  - Storage: 50GB SSD                                         │   │
│  │  - High availability: 2 replicas                             │   │
│  └──────────────┬───────────────────────────────────────────────┘   │
│                 │                                                    │
│                 │ PromQL queries                                     │
│                 ▼                                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     Visualization Layer                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                       Grafana                                 │   │
│  │  - Dashboards: 6 custom dashboards                           │   │
│  │  - Alerts: 20+ alert rules                                   │   │
│  │  - Notifications: Slack, PagerDuty, Email                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Distributed Tracing Layer                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   OpenTelemetry                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │   Tracer   │  │  Exporter  │  │   Jaeger   │             │   │
│  │  │  (in-app)  │──▶│  (OTLP)    │──▶│  Backend   │             │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Log Aggregation Layer                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Grafana Loki                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │ Promtail   │──▶│    Loki    │──▶│  Grafana   │             │   │
│  │  │(log agent) │  │  (storage) │  │  (viewer)   │             │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       Infrastructure Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  PostgreSQL  │  │   RabbitMQ   │  │    Redis     │              │
│  │  (Exporter)  │  │  (Exporter)  │  │  (Exporter)  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                       │
│         └─────────────────┴──────────────────┘                       │
│                           │                                          │
│                           │ Infrastructure metrics                   │
│                           ▼                                          │
│                     Prometheus                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Prometheus Configuration

**Scrape Configuration:**
```yaml

# prometheus.yml

global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'birthday-scheduler-prod'
    environment: 'production'

scrape_configs:
  # Application metrics
  - job_name: 'birthday-scheduler-api'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ['birthday-scheduler']
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: 'birthday-scheduler-api'
        action: keep
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: instance
      - source_labels: [__meta_kubernetes_pod_ip]
        target_label: __address__
        replacement: '${1}:3000'
    metrics_path: '/metrics'
    scrape_timeout: 10s

  # Worker metrics
  - job_name: 'birthday-scheduler-worker'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ['birthday-scheduler']
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: 'birthday-scheduler-worker'
        action: keep
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: instance
    metrics_path: '/metrics'
    scrape_timeout: 10s

  # PostgreSQL exporter
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # RabbitMQ exporter
  - job_name: 'rabbitmq-exporter'
    static_configs:
      - targets: ['rabbitmq-exporter:9419']

  # Redis exporter (when added)
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Node exporter (for host metrics)
  - job_name: 'node-exporter'
    kubernetes_sd_configs:
      - role: node
    relabel_configs:
      - source_labels: [__meta_kubernetes_node_name]
        target_label: instance
```

**Recording Rules (for pre-aggregation):**
```yaml

# rules.yml

groups:
  - name: birthday_scheduler_aggregations
    interval: 30s
    rules:
      # API error rate (5-minute window)
      - record: birthday_scheduler:api_error_rate:5m
        expr: |
          sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m]))
          /
          sum(rate(birthday_scheduler_api_requests_total[5m]))

      # Message success rate (5-minute window)
      - record: birthday_scheduler:message_success_rate:5m
        expr: |
          sum(rate(birthday_scheduler_messages_sent_total[5m]))
          /
          (sum(rate(birthday_scheduler_messages_sent_total[5m])) +
           sum(rate(birthday_scheduler_messages_failed_total[5m])))

      # Queue processing rate (msg/sec)
      - record: birthday_scheduler:queue_processing_rate:1m
        expr: rate(birthday_scheduler_queue_messages_consumed_total{status="ack"}[1m])

      # Worker utilization
      - record: birthday_scheduler:worker_utilization:5m
        expr: avg(birthday_scheduler_worker_utilization_percent) by (worker_id)
```

#### 2. OpenTelemetry Integration

**Why OpenTelemetry?**
- **Vendor-neutral:** Not locked into specific tracing backend
- **Comprehensive:** Traces, metrics, and logs in one framework
- **Future-proof:** Industry standard for observability
- **Correlation:** Link traces with metrics and logs

**Implementation Plan:**

```typescript
// src/config/telemetry.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';

export function initTelemetry() {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'birthday-scheduler',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
    }),
  });

  // Export to Jaeger
  const exporter = new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces',
  });

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  // Auto-instrumentation
  provider.register({
    instrumentations: [
      new FastifyInstrumentation(),
      new HttpInstrumentation(),
      new PgInstrumentation(),
    ],
  });

  return provider;
}

// Usage in app.ts
import { initTelemetry } from './config/telemetry.js';
const tracer = initTelemetry();
```

**Trace Context Propagation:**
```typescript
// Add trace ID to logs
import { trace } from '@opentelemetry/api';

export function getTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().traceId;
}

// In logger configuration
logger.info({
  traceId: getTraceId(),
  message: 'Processing message',
});
```

#### 3. Log Aggregation with Loki

**Why Loki?**
- **Cost-effective:** Indexes labels, not full-text
- **Grafana integration:** Seamless with existing stack
- **Simple:** Easy to deploy and operate
- **Correlation:** Link logs with metrics and traces

**Deployment:**
```yaml

# loki-config.yaml

auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h  # 30 days
```

**Promtail Configuration:**
```yaml

# promtail-config.yaml

server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Kubernetes pod logs
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        target_label: app
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
    pipeline_stages:
      # Parse JSON logs
      - json:
          expressions:
            level: level
            timestamp: time
            message: msg
            trace_id: traceId
      # Add labels
      - labels:
          level:
          trace_id:
      # Add timestamp
      - timestamp:
          source: timestamp
          format: RFC3339
```

**Structured Logging Enhancement:**
```typescript
// src/config/logger.ts (enhanced)
import pino from 'pino';
import { getTraceId } from './telemetry.js';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },
  mixin: () => ({
    traceId: getTraceId(),
    environment: process.env.NODE_ENV,
    service: 'birthday-scheduler',
  }),
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

---

## Grafana Dashboard Specifications

### Dashboard 1: Executive Overview

**Purpose:** High-level business and system health
**Audience:** Leadership, product managers
**Update Frequency:** Real-time (15s refresh)

**Panels:**

1. **Top Row - Key Metrics (Stat panels)**
   - Total Messages Today (Counter)
   - Success Rate % (Gauge, 95%+ green, 90-95% yellow, <90% red)
   - Active Users (Gauge)
   - API Uptime % (Gauge)

2. **Second Row - Trends (Time series)**
   - Messages Sent Over Time (stacked by type: birthday, anniversary)
   - Error Rate Trend (line chart, 5-minute window)
   - Response Time P95 (line chart)
   - Queue Depth (line chart)

3. **Third Row - Geographic Distribution**
   - Users by Timezone (Bar chart)
   - Messages by Region (Pie chart)

4. **Fourth Row - Health Status**
   - System Health (Status panel: OK/Degraded/Down)
   - Circuit Breaker Status (Status list)
   - Recent Alerts (Alert list panel)

**PromQL Queries:**
```promql

# Total Messages Today

sum(increase(birthday_scheduler_messages_sent_total[24h]))

# Success Rate %

(sum(rate(birthday_scheduler_messages_sent_total[5m])) /
 (sum(rate(birthday_scheduler_messages_sent_total[5m])) +
  sum(rate(birthday_scheduler_messages_failed_total[5m])))) * 100

# Active Users

sum(birthday_scheduler_users_active_total)

# API Uptime %

avg(up{job="birthday-scheduler-api"}) * 100

# Messages by Type

sum by (message_type) (rate(birthday_scheduler_messages_sent_total[5m]))

# Error Rate

sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])) /
sum(rate(birthday_scheduler_api_requests_total[5m])) * 100

# Response Time P95

histogram_quantile(0.95,
  sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m]))
  by (le))

# Queue Depth

birthday_scheduler_queue_depth{queue_name="birthday-messages"}
```

### Dashboard 2: API Performance (RED Method)

**Purpose:** API request monitoring
**Audience:** Backend engineers, SRE
**Update Frequency:** 15s

**Panels:**

1. **Rate - Request Volume**
   - Requests per Second (by endpoint)
   - Top 10 Endpoints by Traffic
   - Traffic Heatmap (24h)

2. **Errors - Error Tracking**
   - Error Rate % (by endpoint)
   - Errors by Status Code (4xx vs 5xx)
   - Error Spike Detection (anomaly detection)

3. **Duration - Latency Metrics**
   - P50/P95/P99 Response Time (by endpoint)
   - Latency Distribution Heatmap
   - Slow Requests (>1s) Count

4. **Additional Metrics**
   - Concurrent Requests (gauge)
   - Request/Response Size Distribution
   - Rate Limit Hits

**PromQL Queries:**
```promql

# Requests per Second

sum(rate(birthday_scheduler_api_requests_total[1m])) by (path)

# Error Rate by Endpoint

sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])) by (path) /
sum(rate(birthday_scheduler_api_requests_total[5m])) by (path) * 100

# P95 Latency by Endpoint

histogram_quantile(0.95,
  sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m]))
  by (path, le))

# Concurrent Requests

birthday_scheduler_api_concurrent_requests

# Request Size Distribution

histogram_quantile(0.95,
  sum(rate(birthday_scheduler_api_request_size_bytes_bucket[5m]))
  by (le))
```

### Dashboard 3: Message Processing

**Purpose:** Message lifecycle monitoring
**Audience:** Product team, operations
**Update Frequency:** 30s

**Panels:**

1. **Message Flow**
   - Messages Scheduled (rate)
   - Messages Sent (rate, by type)
   - Messages Failed (rate, by error type)
   - Success Rate Trend

2. **Delivery Performance**
   - Time to Delivery Distribution
   - Delivery Latency P95
   - Retry Attempt Distribution
   - Idempotency Skips

3. **Queue Health**
   - Queue Depth Over Time
   - Messages in DLQ
   - Processing Rate vs Production Rate
   - Unacked Messages

4. **Worker Performance**
   - Active Workers
   - Worker Utilization %
   - Task Completion Rate
   - Worker Errors

**PromQL Queries:**
```promql

# Messages Scheduled (rate)

sum(rate(birthday_scheduler_messages_scheduled_total[5m])) by (message_type)

# Messages Sent (rate)

sum(rate(birthday_scheduler_messages_sent_total[5m])) by (message_type)

# Messages Failed (rate)

sum(rate(birthday_scheduler_messages_failed_total[5m])) by (error_type)

# Success Rate

(sum(rate(birthday_scheduler_messages_sent_total[5m])) /
 (sum(rate(birthday_scheduler_messages_sent_total[5m])) +
  sum(rate(birthday_scheduler_messages_failed_total[5m])))) * 100

# Time to Delivery P95

histogram_quantile(0.95,
  sum(rate(birthday_scheduler_message_time_to_delivery_seconds_bucket[5m]))
  by (message_type, le))

# Queue Depth

birthday_scheduler_queue_depth{queue_name="birthday-messages"}

# DLQ Depth

birthday_scheduler_queue_dlq_messages{dlq_name="birthday-dlq"}

# Processing vs Production Rate

sum(rate(birthday_scheduler_queue_messages_consumed_total{status="ack"}[1m]))
-
sum(rate(birthday_scheduler_queue_messages_published_total[1m]))

# Worker Utilization

avg(birthday_scheduler_worker_utilization_percent)
```

### Dashboard 4: Database Performance

**Purpose:** Database health and query optimization
**Audience:** Database engineers, SRE
**Update Frequency:** 30s

**Panels:**

1. **Connection Pool**
   - Active Connections
   - Idle Connections
   - Connection Pool Usage %
   - Connection Wait Time

2. **Query Performance**
   - Query Duration P95 (by table)
   - Slow Queries (>100ms)
   - Queries per Second
   - Rows Affected Distribution

3. **Database Health**
   - Transaction Duration P95
   - Deadlock Count
   - Database Size Growth
   - Cache Hit Rate

4. **PostgreSQL Metrics (from exporter)**
   - Connections by State
   - Locks by Type
   - Replication Lag (if applicable)
   - Vacuum/Autovacuum Activity

**PromQL Queries:**
```promql

# Active Connections

birthday_scheduler_database_connections{state="active"}

# Connection Pool Usage %

(sum(birthday_scheduler_database_connections{state="active"}) /
 (sum(birthday_scheduler_database_connections{state="active"}) +
  sum(birthday_scheduler_database_connections{state="idle"}))) * 100

# Query Duration P95

histogram_quantile(0.95,
  sum(rate(birthday_scheduler_database_query_duration_seconds_bucket[5m]))
  by (table, le))

# Slow Queries

sum(rate(birthday_scheduler_database_slow_queries_total[5m])) by (table)

# Transaction Duration P95

histogram_quantile(0.95,
  sum(rate(birthday_scheduler_database_transaction_duration_seconds_bucket[5m]))
  by (operation, le))

# Deadlocks

rate(birthday_scheduler_database_deadlocks_total[5m])
```

### Dashboard 5: Infrastructure & Resources (USE Method)

**Purpose:** System resource monitoring
**Audience:** Infrastructure team, SRE
**Update Frequency:** 30s

**Panels:**

1. **CPU Utilization**
   - CPU Usage % (per pod)
   - CPU Throttling
   - Event Loop Lag

2. **Memory**
   - Memory Usage (RSS)
   - Heap Usage
   - Garbage Collection Pauses
   - Memory Leak Detection (trend)

3. **Saturation**
   - Queue Depth Saturation
   - Connection Pool Saturation
   - Disk I/O Wait Time
   - Network Bandwidth Usage

4. **Errors**
   - Process Restarts
   - OOM Kills
   - File Descriptor Exhaustion
   - Thread Pool Exhaustion

**PromQL Queries:**
```promql

# CPU Usage %

rate(process_cpu_user_seconds_total[5m]) * 100

# Memory Usage (RSS)

process_resident_memory_bytes / 1024 / 1024  # MB

# Heap Usage

process_heap_bytes / 1024 / 1024  # MB

# Event Loop Lag

nodejs_eventloop_lag_seconds

# GC Pause Time

rate(nodejs_gc_duration_seconds_sum[5m])

# Queue Saturation (depth vs capacity)

birthday_scheduler_queue_depth{queue_name="birthday-messages"} /
5000 * 100  # Assuming 5000 capacity

# Connection Pool Saturation

sum(birthday_scheduler_database_connections{state="active"}) /
20 * 100  # Assuming max 20 connections
```

### Dashboard 6: External Dependencies

**Purpose:** External service monitoring
**Audience:** Operations, SRE
**Update Frequency:** 30s

**Panels:**

1. **External API Performance**
   - Response Time by Vendor
   - Error Rate by Vendor
   - Timeout Count
   - Request Rate

2. **Circuit Breaker Status**
   - Circuit State (open/closed/half-open)
   - Failure Threshold Proximity
   - Circuit Breaker Events

3. **RabbitMQ Health**
   - Queue Depth Trend
   - Consumer Count
   - Message Publish/Consume Rate
   - Connection Count

4. **Redis Health (when added)**
   - Cache Hit Rate
   - Eviction Rate
   - Memory Usage
   - Commands per Second

**PromQL Queries:**
```promql

# External API Response Time P95

histogram_quantile(0.95,
  sum(rate(birthday_scheduler_external_api_response_time_seconds_bucket[5m]))
  by (vendor, le))

# External API Error Rate

sum(rate(birthday_scheduler_external_api_errors_total[5m])) by (vendor) /
sum(rate(birthday_scheduler_external_api_requests_total[5m])) by (vendor) * 100

# Circuit Breaker State

birthday_scheduler_external_api_circuit_breaker_state

# RabbitMQ Queue Depth (from exporter)

rabbitmq_queue_messages{queue="birthday_messages"}

# RabbitMQ Consumer Count

rabbitmq_queue_consumers{queue="birthday_messages"}

# Message Rate Comparison

sum(rate(rabbitmq_queue_messages_published_total{queue="birthday_messages"}[1m])) -
sum(rate(rabbitmq_queue_messages_consumed_total{queue="birthday_messages"}[1m]))
```

---

## Alert Rule Definitions

### SLI/SLO Framework

**Service-Level Indicators (SLIs):**
1. **Availability:** % of successful API requests
2. **Latency:** P95 response time
3. **Message Success Rate:** % of messages delivered
4. **Queue Processing:** Queue depth < threshold

**Service-Level Objectives (SLOs):**
1. **Availability SLO:** 99.9% uptime (43.2 min downtime/month)
2. **Latency SLO:** P95 < 500ms, P99 < 1s
3. **Message Success SLO:** 99.5% delivery success
4. **Queue Health SLO:** Queue depth < 1000 messages

### Alert Categories

#### Category 1: Critical Alerts (Severity: Critical, Notify: PagerDuty + Slack)

**1. Service Down**
```yaml
- alert: ServiceDown
  expr: up{job="birthday-scheduler-api"} == 0
  for: 1m
  labels:
    severity: critical
    component: application
    slo: availability
  annotations:
    summary: "Birthday Scheduler API is down"
    description: "API pod {{ $labels.instance }} has been down for 1 minute"
    impact: "Users cannot create/manage birthday messages"
    runbook: "https://docs.internal/runbooks/service-down"
    slo_violation: "Availability SLO (99.9%) at risk"
```

**2. High Error Rate (SLO Violation)**
```yaml
- alert: HighErrorRate
  expr: |
    (sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])) /
     sum(rate(birthday_scheduler_api_requests_total[5m]))) * 100 > 10
  for: 5m
  labels:
    severity: critical
    component: api
    slo: availability
  annotations:
    summary: "API error rate exceeds threshold"
    description: "Error rate is {{ $value | humanizePercentage }} (threshold: 10%)"
    impact: "Availability SLO at risk, users experiencing failures"
    runbook: "https://docs.internal/runbooks/high-error-rate"
    slo_violation: "Yes - Availability SLO 99.9%"
```

**3. Message Delivery Failure (SLO Violation)**
```yaml
- alert: LowMessageSuccessRate
  expr: |
    (sum(rate(birthday_scheduler_messages_sent_total[10m])) /
     (sum(rate(birthday_scheduler_messages_sent_total[10m])) +
      sum(rate(birthday_scheduler_messages_failed_total[10m])))) * 100 < 99.5
  for: 10m
  labels:
    severity: critical
    component: message-delivery
    slo: delivery_success
  annotations:
    summary: "Message delivery success rate below SLO"
    description: "Success rate: {{ $value | humanizePercentage }} (SLO: 99.5%)"
    impact: "Users not receiving birthday messages"
    runbook: "https://docs.internal/runbooks/low-delivery-success"
    slo_violation: "Yes - Delivery Success SLO 99.5%"
```

**4. Queue Overflow**
```yaml
- alert: QueueDepthCritical
  expr: birthday_scheduler_queue_depth{queue_name="birthday-messages"} > 5000
  for: 5m
  labels:
    severity: critical
    component: queue
    slo: queue_health
  annotations:
    summary: "Message queue critically full"
    description: "Queue depth: {{ $value }} (threshold: 5000)"
    impact: "Message processing severely delayed, workers overwhelmed"
    runbook: "https://docs.internal/runbooks/queue-overflow"
    action: "Scale up workers immediately"
```

**5. Circuit Breaker Open**
```yaml
- alert: CircuitBreakerOpen
  expr: birthday_scheduler_circuit_breaker_open == 1
  for: 2m
  labels:
    severity: critical
    component: external-service
  annotations:
    summary: "Circuit breaker open for {{ $labels.service_name }}"
    description: "External service {{ $labels.service_name }} is failing"
    impact: "Message delivery blocked"
    runbook: "https://docs.internal/runbooks/circuit-breaker"
    action: "Check external service health"
```

**6. Database Connection Pool Exhausted**
```yaml
- alert: DatabasePoolExhausted
  expr: |
    (sum(birthday_scheduler_database_connections{state="active"}) /
     20) * 100 > 90
  for: 3m
  labels:
    severity: critical
    component: database
  annotations:
    summary: "Database connection pool near exhaustion"
    description: "Pool usage: {{ $value | humanizePercentage }}"
    impact: "API requests timing out, database bottleneck"
    runbook: "https://docs.internal/runbooks/db-pool-exhaustion"
    action: "Scale database connections or investigate connection leaks"
```

**7. Scheduler Stopped**
```yaml
- alert: SchedulerNotExecuting
  expr: |
    time() - birthday_scheduler_cron_job_last_success_timestamp{job_name="daily-birthday"} > 7200
  for: 5m
  labels:
    severity: critical
    component: scheduler
  annotations:
    summary: "Daily birthday scheduler has not run"
    description: "Last success: {{ $value | humanizeDuration }} ago"
    impact: "Birthday messages not being scheduled"
    runbook: "https://docs.internal/runbooks/scheduler-failure"
    action: "Check scheduler pod health and logs"
```

#### Category 2: Warning Alerts (Severity: Warning, Notify: Slack)

**8. Elevated Error Rate**
```yaml
- alert: ElevatedErrorRate
  expr: |
    (sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])) /
     sum(rate(birthday_scheduler_api_requests_total[5m]))) * 100 > 5
  for: 5m
  labels:
    severity: warning
    component: api
  annotations:
    summary: "API error rate elevated"
    description: "Error rate: {{ $value | humanizePercentage }} (threshold: 5%)"
    runbook: "https://docs.internal/runbooks/elevated-errors"
```

**9. High Response Time (SLO Warning)**
```yaml
- alert: HighResponseTime
  expr: |
    histogram_quantile(0.95,
      sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m]))
      by (le)) > 0.5
  for: 5m
  labels:
    severity: warning
    component: api
    slo: latency
  annotations:
    summary: "API P95 latency above threshold"
    description: "P95 latency: {{ $value }}s (SLO: 500ms)"
    runbook: "https://docs.internal/runbooks/high-latency"
    slo_warning: "Latency SLO (P95 < 500ms) approaching violation"
```

**10. Queue Depth High**
```yaml
- alert: QueueDepthHigh
  expr: birthday_scheduler_queue_depth{queue_name="birthday-messages"} > 1000
  for: 10m
  labels:
    severity: warning
    component: queue
  annotations:
    summary: "Message queue depth elevated"
    description: "Queue depth: {{ $value }} (threshold: 1000)"
    runbook: "https://docs.internal/runbooks/queue-backing-up"
    action: "Consider scaling workers"
```

**11. High Memory Usage**
```yaml
- alert: HighMemoryUsage
  expr: process_resident_memory_bytes / 1024 / 1024 / 1024 > 1.5
  for: 5m
  labels:
    severity: warning
    component: application
  annotations:
    summary: "Application memory usage high"
    description: "Memory usage: {{ $value }}GB (threshold: 1.5GB)"
    runbook: "https://docs.internal/runbooks/high-memory"
    action: "Check for memory leaks"
```

**12. DLQ Messages Accumulating**
```yaml
- alert: DLQMessagesAccumulating
  expr: birthday_scheduler_queue_dlq_messages{dlq_name="birthday-dlq"} > 10
  for: 15m
  labels:
    severity: warning
    component: queue
  annotations:
    summary: "Messages accumulating in DLQ"
    description: "DLQ depth: {{ $value }} (threshold: 10)"
    runbook: "https://docs.internal/runbooks/dlq-messages"
    action: "Investigate failed messages"
```

**13. Worker Restarts**
```yaml
- alert: FrequentWorkerRestarts
  expr: rate(birthday_scheduler_worker_restarts_total[5m]) > 0
  for: 1m
  labels:
    severity: warning
    component: worker
  annotations:
    summary: "Worker {{ $labels.worker_id }} restarting frequently"
    description: "Restart rate: {{ $value }} restarts/min"
    runbook: "https://docs.internal/runbooks/worker-restarts"
```

**14. Slow Database Queries**
```yaml
- alert: SlowDatabaseQueries
  expr: rate(birthday_scheduler_database_slow_queries_total[5m]) > 1
  for: 10m
  labels:
    severity: warning
    component: database
  annotations:
    summary: "Slow queries detected"
    description: "Slow query rate: {{ $value }} queries/sec"
    runbook: "https://docs.internal/runbooks/slow-queries"
    action: "Review slow query log and optimize"
```

**15. External API Slow Response**
```yaml
- alert: ExternalAPISlowResponse
  expr: |
    histogram_quantile(0.95,
      sum(rate(birthday_scheduler_external_api_response_time_seconds_bucket[5m]))
      by (vendor, le)) > 5
  for: 10m
  labels:
    severity: warning
    component: external-api
  annotations:
    summary: "External API {{ $labels.vendor }} responding slowly"
    description: "P95 response time: {{ $value }}s (threshold: 5s)"
    runbook: "https://docs.internal/runbooks/external-api-slow"
```

#### Category 3: Info Alerts (Severity: Info, Notify: Email)

**16. Low Throughput**
```yaml
- alert: LowThroughput
  expr: rate(birthday_scheduler_messages_sent_total[5m]) < 1
  for: 30m
  labels:
    severity: info
    component: message-delivery
  annotations:
    summary: "Message throughput is low"
    description: "Current rate: {{ $value }} msg/sec (expected: >1 msg/sec)"
```

**17. User Growth Anomaly**
```yaml
- alert: UnusualUserRegistrationRate
  expr: |
    abs(rate(birthday_scheduler_users_created_total[1h]) -
        avg_over_time(rate(birthday_scheduler_users_created_total[1h])[7d:1h])) >
    2 * stddev_over_time(rate(birthday_scheduler_users_created_total[1h])[7d:1h])
  for: 1h
  labels:
    severity: info
    component: users
  annotations:
    summary: "Unusual user registration pattern"
    description: "Registration rate deviates from 7-day baseline"
```

### Alert Notification Routing

```yaml

# alertmanager.yml

route:
  receiver: 'email-default'
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    # Critical alerts -> PagerDuty + Slack
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true

    - match:
        severity: critical
      receiver: 'slack-critical'

    # Warning alerts -> Slack
    - match:
        severity: warning
      receiver: 'slack-warnings'

    # Info alerts -> Email
    - match:
        severity: info
      receiver: 'email-team'

receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: '<PAGERDUTY_INTEGRATION_KEY>'
        severity: critical

  - name: 'slack-critical'
    slack_configs:
      - api_url: '<SLACK_WEBHOOK_URL>'
        channel: '#alerts-critical'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'slack-warnings'
    slack_configs:
      - api_url: '<SLACK_WEBHOOK_URL>'
        channel: '#alerts-warnings'
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'

  - name: 'email-team'
    email_configs:
      - to: 'team@example.com'
        from: 'alertmanager@example.com'
        smarthost: 'smtp.example.com:587'
```

---

## OpenTelemetry Integration Plan

### Why OpenTelemetry?

**Benefits:**
1. **Distributed Tracing:** Track requests across API → Queue → Worker → External API
2. **Context Propagation:** Link logs, metrics, and traces with correlation IDs
3. **Vendor-Neutral:** Not locked into specific backend (Jaeger, Zipkin, etc.)
4. **Auto-Instrumentation:** Automatic instrumentation for Fastify, HTTP, PostgreSQL
5. **Sampling:** Control trace volume with intelligent sampling strategies
6. **Future-Proof:** Industry standard, CNCF graduated project

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Fastify    │  │  Worker    │  │ Scheduler  │            │
│  │   API      │  │  Process   │  │  Process   │            │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘            │
│        │               │               │                    │
│        └───────────────┴───────────────┘                    │
│                        │                                    │
│           OpenTelemetry SDK (in-process)                    │
│                        │                                    │
│  ┌─────────────────────┴─────────────────────┐             │
│  │  Tracer  │  Exporter  │  Context Propagation│             │
│  └──────────┴────────────┴────────────────────┘             │
└─────────────────────────┬───────────────────────────────────┘
                          │ OTLP/gRPC
                          ▼
┌──────────────────────────────────────────────────────────────┐
│               OpenTelemetry Collector                        │
│  ┌───────────┐  ┌────────────┐  ┌─────────────┐            │
│  │ Receivers │─▶│ Processors │─▶│  Exporters  │            │
│  └───────────┘  └────────────┘  └──────┬──────┘            │
│    - OTLP         - Batch           │  Jaeger              │
│    - Prometheus   - Sampling        │  Prometheus          │
│                   - Filter          │  Loki                │
└─────────────────────────────────────────┴───────────────────┘
                                          │
                   ┌──────────────────────┼─────────────┐
                   │                      │             │
                   ▼                      ▼             ▼
            ┌──────────┐         ┌─────────────┐  ┌────────┐
            │  Jaeger  │         │ Prometheus  │  │  Loki  │
            │ (Traces) │         │  (Metrics)  │  │ (Logs) │
            └────┬─────┘         └──────┬──────┘  └───┬────┘
                 │                      │             │
                 └──────────────────────┴─────────────┘
                                  │
                                  ▼
                          ┌───────────────┐
                          │    Grafana    │
                          │ (Unified View)│
                          └───────────────┘
```

### Implementation Steps

#### Step 1: Install Dependencies

```bash
npm install --save \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-grpc \
  @opentelemetry/exporter-metrics-otlp-grpc \
  @opentelemetry/instrumentation-fastify \
  @opentelemetry/instrumentation-http \
  @opentelemetry/instrumentation-pg \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

#### Step 2: Create Telemetry Configuration

```typescript
// src/config/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { env } from './environment.js';

export function initTelemetry(): NodeSDK {
  const traceExporter = new OTLPTraceExporter({
    url: env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4317',
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4317',
    }),
    exportIntervalMillis: 60000, // 1 minute
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'birthday-scheduler',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV,
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'unknown',
    }),
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fastify': {
          enabled: true,
          requestHook: (span, request) => {
            span.setAttribute('http.user_agent', request.headers['user-agent'] || 'unknown');
            span.setAttribute('http.client_ip', request.ip);
          },
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingPaths: ['/health', '/metrics'],
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
          enhancedDatabaseReporting: true,
        },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('Telemetry terminated'))
      .catch((error) => console.error('Error shutting down telemetry', error))
      .finally(() => process.exit(0));
  });

  return sdk;
}
```

#### Step 3: Initialize in Application

```typescript
// src/index.ts
import { initTelemetry } from './config/telemetry.js';

// Initialize OpenTelemetry FIRST (before any other imports)
const telemetry = initTelemetry();

// Then import and start the app
import { createApp } from './app.js';
import { env } from './config/environment.js';

const app = await createApp();
await app.listen({ port: env.PORT, host: env.HOST });
```

#### Step 4: Add Custom Spans

```typescript
// src/services/message.service.ts
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('birthday-scheduler');

export class MessageService {
  async scheduleMessage(user: User, messageType: string): Promise<void> {
    // Create custom span
    return await tracer.startActiveSpan('scheduleMessage', async (span) => {
      try {
        // Add attributes
        span.setAttribute('user.id', user.id);
        span.setAttribute('user.timezone', user.timezone);
        span.setAttribute('message.type', messageType);

        // Business logic
        const message = await this.createMessage(user, messageType);
        span.setAttribute('message.id', message.id);

        // Add event
        span.addEvent('message_created', {
          messageId: message.id,
          scheduledTime: message.scheduledSendTime,
        });

        await this.publishToQueue(message);

        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        // Record exception
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

#### Step 5: Context Propagation (Queue)

```typescript
// src/queue/publisher.ts
import { trace, context, propagation } from '@opentelemetry/api';

export class MessagePublisher {
  async publish(job: MessageJob): Promise<void> {
    // Inject trace context into message headers
    const carrier = {};
    propagation.inject(context.active(), carrier);

    await this.channel.sendToQueue(
      QUEUES.BIRTHDAY_MESSAGES,
      Buffer.from(JSON.stringify(job)),
      {
        persistent: true,
        headers: {
          ...carrier, // Include trace context
        },
      }
    );
  }
}

// src/queue/consumer.ts
export class MessageConsumer {
  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    // Extract trace context from message headers
    const parentContext = propagation.extract(context.active(), msg.properties.headers);

    // Continue trace in new context
    const tracer = trace.getTracer('birthday-scheduler');
    const span = tracer.startSpan(
      'processMessage',
      {
        kind: SpanKind.CONSUMER,
      },
      parentContext
    );

    try {
      // Process message
      await this.processMessage(job);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }
}
```

#### Step 6: Link Traces to Logs

```typescript
// src/config/logger.ts
import pino from 'pino';
import { trace } from '@opentelemetry/api';

export const logger = pino({
  mixin: () => {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        traceFlags: spanContext.traceFlags,
      };
    }
    return {};
  },
});
```

#### Step 7: Deploy OpenTelemetry Collector

```yaml

# otel-collector-config.yaml

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 10s
    send_batch_size: 1024

  # Sampling: Keep 100% of errors, 10% of successful traces
  probabilistic_sampler:
    sampling_percentage: 10
    hash_seed: 22

  # Filter out health check traces
  filter:
    spans:
      exclude:
        match_type: strict
        attributes:
          - key: http.target
            value: /health

exporters:
  # Export traces to Jaeger
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

  # Export metrics to Prometheus
  prometheus:
    endpoint: 0.0.0.0:8889
    namespace: otel

  # Export logs to Loki
  loki:
    endpoint: http://loki:3100/loki/api/v1/push

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, probabilistic_sampler, filter]
      exporters: [jaeger]

    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]

    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [loki]
```

```yaml

# docker-compose.prod.yml (add services)

services:
  # ... existing services ...

  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    container_name: otel-collector
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"  # OTLP gRPC
      - "4318:4318"  # OTLP HTTP
      - "8889:8889"  # Prometheus exporter
    networks:
      - app-network

  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger
    ports:
      - "16686:16686"  # Jaeger UI
      - "14250:14250"  # gRPC
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    networks:
      - app-network
```

#### Step 8: Sampling Strategy

**Head-based Sampling (at source):**
```typescript
// src/config/telemetry.ts
import { TraceIdRatioBasedSampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-node';

const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.1), // 10% of traces
});

const sdk = new NodeSDK({
  // ... other config
  sampler,
});
```

**Tail-based Sampling (at collector):**
```yaml

# otel-collector-config.yaml

processors:
  tail_sampling:
    decision_wait: 10s
    num_traces: 100
    expected_new_traces_per_sec: 10
    policies:
      # Sample all errors
      - name: errors-policy
        type: status_code
        status_code:
          status_codes: [ERROR]

      # Sample slow requests
      - name: slow-requests
        type: latency
        latency:
          threshold_ms: 1000

      # Sample 10% of successful fast requests
      - name: probabilistic-policy
        type: probabilistic
        probabilistic:
          sampling_percentage: 10
```

### Trace Visualization in Grafana

**Add Jaeger Data Source:**
```yaml

# grafana/datasources/jaeger.yaml

apiVersion: 1
datasources:
  - name: Jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:16686
    isDefault: false
```

**Link Traces from Metrics:**
```yaml

# In Grafana dashboard panel

"links": [
  {
    "title": "View Trace",
    "url": "http://jaeger:16686/trace/${__data.fields.traceID}"
  }
]
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2) - IMMEDIATE

**Goal:** Add critical missing metrics and improve existing dashboards

#### Tasks:

1. **Add Business Metrics (4-6 hours)**
   - User activity metrics (created, active, by timezone)
   - Message pattern metrics (time-to-delivery, retry distribution)
   - Idempotency skip tracking

2. **Add External API Metrics (4-6 hours)**
   - Request/response tracking in MessageSenderService
   - Error categorization
   - Timeout tracking

3. **Enhance Queue Metrics (6-8 hours)**
   - RabbitMQ Management API integration
   - DLQ depth monitoring
   - Consumer count tracking
   - Publish/consume rate metrics

4. **Update Grafana Dashboards (4-6 hours)**
   - Create "Message Processing" dashboard
   - Enhance "Executive Overview" with new metrics
   - Add "External Dependencies" dashboard

**Deliverables:**
- 15+ new metrics added
- 3 new/updated Grafana dashboards
- Updated alert rules for new metrics

**Success Criteria:**
- Can track user growth and activity
- Can detect external API issues before they impact users
- Can optimize queue/worker scaling decisions

---

### Phase 2: Enhanced Observability (Week 3-4)

**Goal:** Add distributed tracing and improve database monitoring

#### Tasks:

1. **OpenTelemetry Integration (8-12 hours)**
   - Install and configure OTel SDK
   - Add auto-instrumentation
   - Deploy OpenTelemetry Collector
   - Deploy Jaeger backend
   - Create custom spans for critical operations

2. **Database Performance Metrics (6-8 hours)**
   - Query duration tracking
   - Slow query detection
   - Transaction monitoring
   - Connection pool wait time

3. **Worker Performance Metrics (4-6 hours)**
   - Individual worker task duration
   - Worker utilization percentage
   - Worker restart tracking
   - Idle time monitoring

4. **Scheduler Health Metrics (2-4 hours)**
   - Last execution timestamp
   - Missed execution detection
   - Execution lag tracking

**Deliverables:**
- OpenTelemetry fully integrated
- Distributed traces visible in Jaeger
- Database performance dashboard
- Worker performance dashboard

**Success Criteria:**
- Can trace request through API → Queue → Worker → External API
- Can identify slow database queries
- Can detect worker performance issues

---

### Phase 3: Security & Advanced Monitoring (Week 5-6)

**Goal:** Add security monitoring and log aggregation

#### Tasks:

1. **Security Metrics (4-6 hours)**
   - Rate limit violation tracking
   - Authentication failure monitoring
   - Suspicious activity detection
   - API key usage tracking

2. **Log Aggregation with Loki (8-10 hours)**
   - Deploy Grafana Loki
   - Deploy Promtail agents
   - Configure log parsing and labels
   - Create log-based dashboards
   - Link logs to traces

3. **Enhanced Alerting (4-6 hours)**
   - Implement SLI/SLO alerts
   - Add security alerts
   - Configure alert routing
   - Create runbook documentation

4. **Cost Tracking Foundation (4-6 hours)**
   - API call cost estimation
   - Infrastructure cost tracking (basic)
   - Cost per message/user calculations

**Deliverables:**
- Security monitoring dashboard
- Loki deployed and collecting logs
- Unified observability (metrics + logs + traces)
- SLO-based alerting

**Success Criteria:**
- Can detect security threats
- Can search logs with full context (trace ID linking)
- Alerts are actionable with runbooks

---

### Phase 4: Optimization & FinOps (Week 7-8)

**Goal:** Optimize monitoring stack and add cost visibility

#### Tasks:

1. **Monitoring Optimization (6-8 hours)**
   - Optimize Prometheus retention
   - Implement recording rules
   - Tune alert thresholds based on data
   - Reduce metric cardinality if needed

2. **Cost Analytics (8-10 hours)**
   - Detailed cost tracking by resource
   - Cost allocation by message type
   - Cost anomaly detection
   - Cost optimization recommendations

3. **Performance Tuning (4-6 hours)**
   - Optimize trace sampling rates
   - Tune log retention
   - Configure metric aggregation

4. **Documentation (4-6 hours)**
   - Monitoring architecture documentation
   - Dashboard user guides
   - Alert response playbooks
   - Troubleshooting guides

**Deliverables:**
- Optimized monitoring stack (reduced costs)
- Cost analytics dashboard
- Complete documentation

**Success Criteria:**
- Monitoring overhead < 5% of infrastructure costs
- Can track unit economics (cost per user/message)
- Team can self-serve for common issues

---

### Phase 5: Advanced Features (Future)

**Optional enhancements for later:**

1. **Cache Monitoring (when Redis is added)**
   - Cache hit/miss rate
   - Eviction tracking
   - Memory usage

2. **Machine Learning Anomaly Detection**
   - Prophet/ML-based anomaly detection
   - Predictive alerting

3. **Custom Business Dashboards**
   - Product analytics
   - User engagement metrics
   - A/B testing dashboards

4. **Advanced Tracing**
   - Trace-based alerting
   - Service dependency mapping
   - Error correlation

---

## Best Practices & Standards

### 1. Metric Naming Conventions

**Follow Prometheus best practices:**

```
<namespace>_<subsystem>_<metric_name>_<unit>_<type>

Examples:
- birthday_scheduler_api_requests_total (counter)
- birthday_scheduler_message_delivery_duration_seconds (histogram)
- birthday_scheduler_queue_depth (gauge)
- birthday_scheduler_database_connections (gauge)
```

**Rules:**
- Use snake_case
- Include unit in name (seconds, bytes, total)
- Counter names end with `_total`
- Use consistent subsystem names (api, queue, database, worker)

### 2. Label Best Practices

**Good labels (low cardinality):**
```typescript
{
  message_type: "birthday",        // Limited values (birthday, anniversary)
  status: "success",               // Limited values (success, failure)
  error_type: "network_timeout",   // Limited error types
  timezone_region: "America",      // Grouped by region, not full timezone
}
```

**Bad labels (high cardinality):**
```typescript
{
  user_id: "123e4567-...",  // ❌ Millions of unique values
  message_id: "456f7890-...", // ❌ Millions of unique values
  full_path: "/api/users/123/messages/456", // ❌ Use normalized path
  timestamp: "2025-12-30T10:00:00Z", // ❌ Use metric timestamp
}
```

**Cardinality limit:** Keep unique label combinations < 10,000 per metric

### 3. Dashboard Design Principles

**Hierarchy:**
1. **Executive Overview:** High-level business metrics
2. **Service Dashboards:** Detailed service-specific metrics
3. **Infrastructure Dashboards:** Low-level resource metrics
4. **Troubleshooting Dashboards:** Deep-dive investigation

**Layout:**
- **Top row:** Key metrics (stat panels)
- **Second row:** Trends over time (time series)
- **Lower rows:** Detailed breakdowns

**Colors:**
- Green: Healthy/Success
- Yellow: Warning
- Red: Critical/Error
- Blue: Informational

**Refresh rates:**
- Executive: 15-30 seconds
- Service: 30 seconds
- Infrastructure: 1 minute
- Troubleshooting: 10 seconds

### 4. Alert Design Principles

**RED Alerting:**
- **Rate:** Alert on traffic drops (may indicate outage)
- **Errors:** Alert on error rate spikes
- **Duration:** Alert on latency increases

**SLO-Based Alerting:**
- Define SLOs based on user impact
- Alert when approaching SLO violation (not after)
- Use error budgets to prevent alert fatigue

**Alert Fatigue Prevention:**
- Group related alerts
- Use appropriate thresholds (avoid flapping)
- Include runbooks in alerts
- Auto-resolve when possible
- Deduplicate similar alerts

**Alert Severity:**
- **Critical:** User-impacting, requires immediate action
- **Warning:** Degraded performance, investigate soon
- **Info:** Informational, no action needed

### 5. Runbook Template

Every alert should have a runbook:

```markdown

# Alert: [Alert Name]

## Severity

[Critical/Warning/Info]

## Description

[What does this alert mean?]

## Impact

[How does this affect users/business?]

## Diagnosis

1. Check [dashboard link]
2. Run query: `[PromQL query]`
3. Check logs: `{app="birthday-scheduler"} |= "error"`

## Resolution

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Escalation

If unable to resolve in 30 minutes:
- Contact: [team/person]
- Slack channel: [#channel]

## Prevention

[How to prevent this in future]

## Related

- SLO: [link]
- Dashboard: [link]
- Incident history: [link]
```

### 6. Monitoring as Code

**Store all monitoring configuration in Git:**

```
monitoring/
├── prometheus/
│   ├── prometheus.yml
│   ├── rules/
│   │   ├── recording-rules.yml
│   │   └── alert-rules.yml
│   └── targets/
├── grafana/
│   ├── dashboards/
│   │   ├── executive-overview.json
│   │   ├── api-performance.json
│   │   └── ...
│   ├── datasources/
│   │   ├── prometheus.yaml
│   │   └── jaeger.yaml
│   └── provisioning/
├── otel/
│   └── otel-collector-config.yaml
├── loki/
│   └── loki-config.yaml
└── alertmanager/
    └── alertmanager.yml
```

**Benefits:**
- Version control
- Peer review via PR
- Reproducible deployments
- Disaster recovery

### 7. Monitoring Metrics (Monitor the Monitors)

**Track monitoring system health:**
```promql

# Prometheus scrape failures

up{job="birthday-scheduler-api"} == 0

# Prometheus storage usage

prometheus_tsdb_storage_blocks_bytes /
prometheus_tsdb_retention_limit_bytes * 100

# Alert manager notification failures

rate(alertmanager_notifications_failed_total[5m]) > 0

# Grafana dashboard errors

grafana_api_response_status_total{code=~"5.."}
```

---

## Summary & Next Steps

### Current Monitoring Coverage

| Category | Coverage | Status |
|----------|----------|--------|
| HTTP/API Metrics | 70% | ⚠️ Missing request/response size |
| Business Metrics | 50% | 🔴 Missing user activity, patterns |
| Database Metrics | 30% | 🔴 Missing query performance |
| Queue Metrics | 40% | 🔴 Missing DLQ, processing time |
| Worker Metrics | 30% | 🔴 Missing utilization, restarts |
| Scheduler Metrics | 60% | ⚠️ Missing missed executions |
| Circuit Breaker | 80% | ✅ Well implemented |
| Resource Metrics | 90% | ✅ Node.js defaults good |
| External API | 0% | 🔴 Not tracked |
| Security Metrics | 0% | 🔴 Not tracked |
| Distributed Tracing | 0% | 🔴 Not implemented |
| Log Aggregation | 0% | 🔴 Not implemented |

**Overall Coverage: ~40%**

### Target State: 100% Coverage

**After implementation:**
- ✅ All RED metrics (Rate, Errors, Duration)
- ✅ All USE metrics (Utilization, Saturation, Errors)
- ✅ Golden Signals (Latency, Traffic, Errors, Saturation)
- ✅ SLI/SLO framework with alerts
- ✅ Distributed tracing with OpenTelemetry
- ✅ Unified observability (metrics + logs + traces)
- ✅ Security monitoring
- ✅ Cost tracking

### Immediate Next Steps

1. **Review this document with team** (1 hour)
   - Validate metrics selection
   - Prioritize implementation phases
   - Assign ownership

2. **Start Phase 1 implementation** (Week 1-2)
   - Add critical business metrics
   - Add external API metrics
   - Enhance queue metrics
   - Update Grafana dashboards

3. **Set up monitoring infrastructure** (Week 3)
   - OpenTelemetry Collector
   - Jaeger for traces
   - Loki for logs (if Phase 3 is prioritized)

4. **Document and train team** (Ongoing)
   - Dashboard usage guides
   - Alert response playbooks
   - Troubleshooting procedures

### Key Decisions Needed

1. **OpenTelemetry Priority:**
   - Implement in Phase 2 (recommended) or Phase 3?
   - Jaeger vs Tempo vs other backend?

2. **Log Aggregation:**
   - Loki (recommended for Grafana integration)?
   - ELK stack (more features, more complex)?
   - CloudWatch/Datadog (managed, higher cost)?

3. **Trace Sampling:**
   - Head-based (10% at source) or tail-based (smart at collector)?
   - Retention period for traces (7 days? 30 days)?

4. **Cost Tracking:**
   - Implement in Phase 4 or defer to Phase 5?
   - Integration with cloud billing APIs?

5. **Alert Notification:**
   - Slack + Email sufficient?
   - Add PagerDuty for critical alerts?
   - SMS for escalations?

---

## Conclusion

This comprehensive monitoring plan provides a roadmap to achieve **100% observability** for the Birthday Message Scheduler application. By implementing the metrics, dashboards, alerts, and distributed tracing outlined in this document, the team will gain complete visibility into:

- **Application Performance:** API latency, throughput, errors
- **Business Metrics:** User growth, message delivery success, patterns
- **Infrastructure Health:** Database, queue, worker performance
- **External Dependencies:** Vendor API reliability
- **Security:** Rate limits, authentication, abuse detection
- **Cost:** Unit economics and optimization opportunities

The phased implementation approach ensures quick wins (Phase 1) while building toward comprehensive distributed tracing and unified observability (Phases 2-3).

**Total Estimated Effort:** 8-10 weeks (with 1 engineer dedicated 50% time)

**Key Success Metric:** Reduce Mean Time to Detection (MTTD) and Mean Time to Resolution (MTTR) by 80% through proactive alerting and comprehensive observability.

---

## Appendix A: Metric Catalog

[Complete list of all 100+ metrics with descriptions, types, labels, and queries - see sections above]

## Appendix B: PromQL Query Library

[Common queries for dashboards and alerts - see sections above]

## Appendix C: Grafana Dashboard JSON

[Dashboard specifications and JSON exports - see sections above]

## Appendix D: Alert Rule YAML

[Complete alert rules configuration - see sections above]

## Appendix E: OpenTelemetry Configuration

[OTel SDK and Collector configuration - see sections above]

---

**Document Maintained By:** SRE Team
**Last Updated:** 2025-12-30
**Next Review:** 2026-01-30 (quarterly review)
