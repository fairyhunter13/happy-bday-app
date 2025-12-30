# Comprehensive Metrics Strategy Research

**Date:** December 31, 2025
**Research Conducted By:** ANALYST Agent (Hive Mind)
**Purpose:** Achieve 100+ metrics target with comprehensive observability
**Current Status:** 100+ custom metrics implemented
**Target:** Enhanced observability and monitoring excellence

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Metrics Inventory](#current-metrics-inventory)
3. [Industry Standards & Methodologies](#industry-standards--methodologies)
4. [Technology-Specific Metrics](#technology-specific-metrics)
5. [Additional Metrics Recommendations](#additional-metrics-recommendations)
6. [Prometheus Best Practices](#prometheus-best-practices)
7. [Metric Naming Conventions](#metric-naming-conventions)
8. [Cardinality Management](#cardinality-management)
9. [Implementation Guidance](#implementation-guidance)
10. [PromQL Examples](#promql-examples)
11. [References](#references)

---

## Executive Summary

### Current State Analysis

The Happy Birthday App has successfully implemented **100+ custom metrics** across multiple categories:

- **Counters:** 50 metrics (messages, business events, queue operations, performance, database, HTTP)
- **Gauges:** 47 metrics (queue depth, workers, database, queue, performance, system)
- **Histograms:** 26 metrics (delivery duration, API response, database, queue, HTTP client)
- **Summaries:** 5 metrics (processing quantiles, API, database, queue, HTTP client)

**Total Custom Metrics:** 128+ (exceeding the 100+ target)

### Key Achievement

The application has achieved comprehensive observability coverage with metrics spanning:
- Application business logic
- Infrastructure components (PostgreSQL, RabbitMQ, Fastify)
- Performance characteristics
- Security events
- System health

### Research Focus Areas

This research document provides:
1. Industry-standard metric methodologies (RED, Four Golden Signals, USE)
2. Technology-specific best practices for Fastify, PostgreSQL, RabbitMQ
3. Advanced metric strategies for production excellence
4. Implementation guidance and PromQL query examples

---

## Current Metrics Inventory

### Metrics by Category

#### 1. Counter Metrics (50 total)

**Core Application (10 metrics):**
- `birthday_scheduler_messages_scheduled_total` - Messages scheduled for delivery
- `birthday_scheduler_messages_sent_total` - Successfully sent messages
- `birthday_scheduler_messages_failed_total` - Failed message deliveries
- `birthday_scheduler_api_requests_total` - Total API requests
- `birthday_scheduler_user_activity_total` - User activity events
- `birthday_scheduler_message_retries_total` - Message retry attempts
- `birthday_scheduler_external_api_calls_total` - External API calls
- `birthday_scheduler_security_events_total` - Security events
- `birthday_scheduler_rate_limit_hits_total` - Rate limit violations
- `birthday_scheduler_auth_failures_total` - Authentication failures

**Business Metrics (15 metrics):**
- `birthday_scheduler_birthdays_processed_total` - Birthdays processed
- `birthday_scheduler_message_template_usage_total` - Template usage
- `birthday_scheduler_user_creations_total` - User registrations
- `birthday_scheduler_user_deletions_total` - User deletions
- `birthday_scheduler_configuration_changes_total` - Config changes
- `birthday_scheduler_feature_usage_total` - Feature usage tracking
- `birthday_scheduler_message_delivery_by_hour_total` - Delivery timing
- `birthday_scheduler_birthday_greeting_types_total` - Greeting types
- `birthday_scheduler_notification_preferences_changed_total` - Preference changes
- `birthday_scheduler_user_logins_total` - Login events
- `birthday_scheduler_subscription_events_total` - Subscription changes
- `birthday_scheduler_webhook_deliveries_total` - Webhook calls
- `birthday_scheduler_email_bounces_total` - Email bounces
- `birthday_scheduler_sms_delivery_status_total` - SMS delivery
- `birthday_scheduler_push_notification_status_total` - Push notifications

**Queue/RabbitMQ Metrics (10 metrics):**
- `birthday_scheduler_publisher_confirms_total` - Publisher confirmations
- `birthday_scheduler_message_acks_total` - Message acknowledgments
- `birthday_scheduler_message_nacks_total` - Negative acknowledgments
- `birthday_scheduler_message_redeliveries_total` - Redeliveries
- `birthday_scheduler_queue_bindings_created_total` - Queue bindings
- `birthday_scheduler_channel_opens_total` - Channel opens
- `birthday_scheduler_channel_closes_total` - Channel closes
- `birthday_scheduler_connection_recoveries_total` - Connection recoveries
- `birthday_scheduler_queue_purges_total` - Queue purges
- `birthday_scheduler_exchange_declarations_total` - Exchange declarations

**Performance Metrics (5 metrics):**
- `birthday_scheduler_cache_hits_total` - Cache hits
- `birthday_scheduler_cache_misses_total` - Cache misses
- `birthday_scheduler_cache_evictions_total` - Cache evictions
- `birthday_scheduler_connection_pool_timeouts_total` - Pool timeouts
- `birthday_scheduler_gc_events_total` - Garbage collection events

**Database Metrics (5 metrics):**
- `birthday_scheduler_database_deadlocks_total` - Deadlocks
- `birthday_scheduler_database_commits_total` - Transaction commits
- `birthday_scheduler_database_rollbacks_total` - Transaction rollbacks
- `birthday_scheduler_database_checkpoints_total` - Checkpoints
- `birthday_scheduler_database_seq_scans_total` - Sequential scans

**HTTP Client Metrics (5 metrics):**
- `birthday_scheduler_http_client_retries_total` - HTTP retries
- `birthday_scheduler_http_client_timeouts_total` - HTTP timeouts
- `birthday_scheduler_http_connection_reuse_total` - Connection reuse
- `birthday_scheduler_http_dns_lookups_total` - DNS lookups
- `birthday_scheduler_http_tls_handshakes_total` - TLS handshakes

#### 2. Gauge Metrics (47 total)

**Core Application (7 metrics):**
- `birthday_scheduler_queue_depth` - Current queue depth
- `birthday_scheduler_active_workers` - Active worker count
- `birthday_scheduler_database_connections` - Database connections
- `birthday_scheduler_circuit_breaker_open` - Circuit breaker state
- `birthday_scheduler_dlq_depth` - Dead letter queue depth
- `birthday_scheduler_active_users` - Active users
- `birthday_scheduler_pending_messages` - Pending messages

**Business Metrics (10 metrics):**
- `birthday_scheduler_birthdays_today` - Birthdays today
- `birthday_scheduler_birthdays_pending` - Pending birthdays
- `birthday_scheduler_user_timezone_distribution` - User timezones
- `birthday_scheduler_peak_hour_messaging_load` - Peak load
- `birthday_scheduler_active_message_templates` - Active templates
- `birthday_scheduler_users_by_tier` - Users by tier
- `birthday_scheduler_scheduled_jobs_count` - Scheduled jobs
- `birthday_scheduler_failed_jobs_retry_queue` - Failed jobs
- `birthday_scheduler_active_webhooks_count` - Active webhooks
- `birthday_scheduler_notification_queue_backlog` - Notification backlog

**Performance Metrics (10 metrics):**
- `birthday_scheduler_cache_hit_rate` - Cache hit rate percentage
- `birthday_scheduler_connection_pool_wait_time` - Pool wait time
- `birthday_scheduler_batch_processing_size` - Batch size
- `birthday_scheduler_event_loop_utilization` - Event loop utilization
- `birthday_scheduler_compression_ratio` - Compression ratio
- `birthday_scheduler_payload_size_bytes` - Payload size
- `birthday_scheduler_node_active_handles` - Node.js handles
- `birthday_scheduler_node_active_requests` - Node.js requests
- `birthday_scheduler_node_event_loop_lag` - Event loop lag
- `birthday_scheduler_memory_pool_utilization` - Memory pool usage

**Queue/RabbitMQ Metrics (10 metrics):**
- `birthday_scheduler_message_age_seconds` - Message age
- `birthday_scheduler_consumer_count` - Active consumers
- `birthday_scheduler_channel_count` - Active channels
- `birthday_scheduler_exchange_bindings_count` - Exchange bindings
- `birthday_scheduler_prefetch_count` - Prefetch count
- `birthday_scheduler_ack_rate` - Ack rate per second
- `birthday_scheduler_nack_rate` - Nack rate per second
- `birthday_scheduler_redelivery_rate` - Redelivery rate
- `birthday_scheduler_queue_memory_usage` - Queue memory
- `birthday_scheduler_unacked_messages_count` - Unacked messages

**Database Metrics (10 metrics):**
- `birthday_scheduler_index_hit_ratio` - Index hit ratio
- `birthday_scheduler_buffer_cache_hit_ratio` - Buffer cache hit ratio
- `birthday_scheduler_replication_lag` - Replication lag
- `birthday_scheduler_active_transactions` - Active transactions
- `birthday_scheduler_lock_wait_count` - Lock wait count
- `birthday_scheduler_database_table_size` - Table size
- `birthday_scheduler_database_index_size` - Index size
- `birthday_scheduler_database_row_estimates` - Row estimates
- `birthday_scheduler_database_connection_age` - Connection age
- `birthday_scheduler_database_query_queue_length` - Query queue length

**System Metrics (10 metrics):**
- `birthday_scheduler_process_open_file_descriptors` - Open FDs
- `birthday_scheduler_process_max_file_descriptors` - Max FDs
- `birthday_scheduler_process_start_time` - Process start time
- `birthday_scheduler_process_uptime_seconds` - Process uptime
- `birthday_scheduler_v8_heap_space_size` - V8 heap space
- `birthday_scheduler_v8_heap_statistics` - V8 heap stats
- `birthday_scheduler_v8_external_memory` - V8 external memory
- `birthday_scheduler_system_load_average` - System load
- `birthday_scheduler_system_free_memory` - Free memory
- `birthday_scheduler_system_total_memory` - Total memory

#### 3. Histogram Metrics (26 total)

**Core Application (6 metrics):**
- `birthday_scheduler_message_delivery_duration_seconds` - Delivery duration
- `birthday_scheduler_api_response_time_seconds` - API response time
- `birthday_scheduler_scheduler_execution_duration_seconds` - Scheduler duration
- `birthday_scheduler_external_api_latency_seconds` - External API latency
- `birthday_scheduler_database_query_duration_seconds` - Query duration
- `birthday_scheduler_message_time_to_delivery_seconds` - Time to delivery

**Performance Metrics (5 metrics):**
- `birthday_scheduler_batch_processing_duration_seconds` - Batch duration
- `birthday_scheduler_gc_pause_time_seconds` - GC pause time
- `birthday_scheduler_connection_pool_acquisition_time_seconds` - Pool acquisition
- `birthday_scheduler_cache_operation_duration_seconds` - Cache operation
- `birthday_scheduler_serialization_duration_seconds` - Serialization

**Queue/RabbitMQ Metrics (5 metrics):**
- `birthday_scheduler_message_publish_duration_seconds` - Publish duration
- `birthday_scheduler_message_consume_duration_seconds` - Consume duration
- `birthday_scheduler_queue_wait_time_seconds` - Queue wait time
- `birthday_scheduler_channel_operation_duration_seconds` - Channel operations
- `birthday_scheduler_message_processing_latency_seconds` - Processing latency

**Database Metrics (5 metrics):**
- `birthday_scheduler_transaction_duration_seconds` - Transaction duration
- `birthday_scheduler_lock_wait_time_seconds` - Lock wait time
- `birthday_scheduler_checkpoint_duration_seconds` - Checkpoint duration
- `birthday_scheduler_connection_establishment_time_seconds` - Connection time
- `birthday_scheduler_query_planning_time_seconds` - Query planning time

**HTTP Client Metrics (5 metrics):**
- `birthday_scheduler_http_request_duration_seconds` - HTTP request duration
- `birthday_scheduler_dns_lookup_duration_seconds` - DNS lookup duration
- `birthday_scheduler_tls_handshake_duration_seconds` - TLS handshake
- `birthday_scheduler_http_request_size_bytes` - Request size
- `birthday_scheduler_http_response_size_bytes` - Response size

#### 4. Summary Metrics (5 total)

- `birthday_scheduler_message_processing_quantiles` - Message processing quantiles
- `birthday_scheduler_api_response_quantiles` - API response quantiles
- `birthday_scheduler_database_query_quantiles` - Database query quantiles
- `birthday_scheduler_queue_latency_quantiles` - Queue latency quantiles
- `birthday_scheduler_http_client_latency_quantiles` - HTTP client quantiles

### Default Metrics from prom-client

The application also collects Node.js default metrics via `collectDefaultMetrics()`:

- Process CPU usage
- Process memory usage (heap, RSS, external)
- Event loop lag
- Garbage collection metrics
- File descriptor usage
- Active handles and requests

**Total Metrics:** 128+ custom + ~20 default = **148+ total metrics**

---

## Industry Standards & Methodologies

### 1. Four Golden Signals (Google SRE)

The Four Golden Signals framework, developed by Google's SRE team, focuses on service health from a user perspective.

#### 1.1 Latency
**Definition:** Time to serve a request

**Implementation:**
- Use percentiles (p50, p95, p99) instead of averages
- Distinguish between successful and failed request latencies
- Track both API and database query latencies

**Existing Metrics:**
- `birthday_scheduler_api_response_time_seconds` (Histogram)
- `birthday_scheduler_database_query_duration_seconds` (Histogram)
- `birthday_scheduler_message_delivery_duration_seconds` (Histogram)

**Advanced Metric - Apdex Score:**
The Apdex (Application Performance Index) score combines user satisfaction levels:
- Satisfied: response time ≤ target
- Tolerating: response time ≤ 4× target
- Frustrated: response time > 4× target

**Formula:** Apdex = (Satisfied + 0.5 × Tolerating) / Total Requests

**Priority:** P1 - Already well-covered

#### 1.2 Traffic
**Definition:** Service usage volume (requests/minute, queries/second)

**Implementation:**
- Track request rates across all endpoints
- Monitor message throughput
- Measure queue processing rates

**Existing Metrics:**
- `birthday_scheduler_api_requests_total` (Counter)
- `birthday_scheduler_messages_scheduled_total` (Counter)
- `birthday_scheduler_messages_sent_total` (Counter)

**PromQL Example:**
```promql
# Request rate (requests per second)
rate(birthday_scheduler_api_requests_total[5m])

# Messages per minute
rate(birthday_scheduler_messages_sent_total[1m]) * 60
```

**Priority:** P0 - Critical, well-implemented

#### 1.3 Errors
**Definition:** Rate of failed requests

**Implementation:**
- Track error rates as percentages, not absolute counts
- Distinguish between 4xx (client) and 5xx (server) errors
- Monitor application-specific error types

**Existing Metrics:**
- `birthday_scheduler_messages_failed_total` (Counter)
- `birthday_scheduler_auth_failures_total` (Counter)
- `birthday_scheduler_database_rollbacks_total` (Counter)

**PromQL Example:**
```promql
# Error rate percentage
(
  rate(birthday_scheduler_messages_failed_total[5m])
  /
  rate(birthday_scheduler_messages_scheduled_total[5m])
) * 100
```

**Priority:** P0 - Critical, well-implemented

#### 1.4 Saturation
**Definition:** Resource consumption as percentage of capacity

**Implementation:**
- Monitor CPU, memory, disk, network utilization
- Track connection pool usage
- Measure queue depth relative to capacity

**Existing Metrics:**
- `birthday_scheduler_database_connections` (Gauge)
- `birthday_scheduler_queue_depth` (Gauge)
- `birthday_scheduler_event_loop_utilization` (Gauge)
- `birthday_scheduler_memory_pool_utilization` (Gauge)

**PromQL Example:**
```promql
# Database connection pool saturation
(
  birthday_scheduler_database_connections{state="active"}
  /
  (birthday_scheduler_database_connections{state="active"} + birthday_scheduler_database_connections{state="idle"})
) * 100
```

**Priority:** P0 - Critical, well-implemented

### 2. RED Method (Microservices)

The RED Method, introduced by Tom Wilkie, focuses on microservices monitoring.

#### Components:
1. **Rate** - Requests per second (equivalent to Traffic)
2. **Errors** - Failed requests per second
3. **Duration** - Request processing time (equivalent to Latency)

**Implementation Status:** ✅ Fully covered by existing metrics

**PromQL Dashboard Example:**
```promql
# RED Method for Birthday Scheduler API
# Rate
sum(rate(birthday_scheduler_api_requests_total[5m])) by (method, path)

# Errors
sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])) by (method, path)

# Duration (p95)
histogram_quantile(0.95,
  rate(birthday_scheduler_api_response_time_seconds_bucket[5m])
)
```

**Priority:** P0 - Critical, fully implemented

### 3. USE Method (Infrastructure)

The USE Method (Brendan Gregg) focuses on resource monitoring.

#### Components:
1. **Utilization** - How busy resources are (% time busy)
2. **Saturation** - How full/constrained resources are (queue depth)
3. **Errors** - Error counts for resources

**Application to Birthday Scheduler:**

**Database Resources:**
- Utilization: `birthday_scheduler_active_transactions`
- Saturation: `birthday_scheduler_database_query_queue_length`
- Errors: `birthday_scheduler_database_deadlocks_total`

**RabbitMQ Resources:**
- Utilization: `birthday_scheduler_consumer_count`
- Saturation: `birthday_scheduler_queue_depth`
- Errors: `birthday_scheduler_message_nacks_total`

**Node.js Resources:**
- Utilization: `birthday_scheduler_event_loop_utilization`
- Saturation: `birthday_scheduler_node_event_loop_lag`
- Errors: Default GC metrics

**Priority:** P0 - Critical, well-implemented

---

## Technology-Specific Metrics

### 1. Fastify Node.js Application Metrics

#### Current Implementation
The application uses Fastify with comprehensive API metrics.

#### Recommended Fastify Metrics (from fastify-metrics plugin)

**Already Implemented:**
- HTTP request duration ✅
- HTTP request totals ✅
- Response status codes ✅

**Additional Recommendations:**

##### P1 - Important (Consider Adding)

1. **Route-Specific Metrics**
```typescript
// Track metrics per route
birthday_scheduler_route_requests_total{route="/api/birthdays", method="GET"}
birthday_scheduler_route_duration_seconds{route="/api/birthdays", method="GET"}
```

2. **Request Body Size Distribution**
```typescript
birthday_scheduler_request_body_size_bytes{route, method}
```

3. **Response Body Size Distribution**
```typescript
birthday_scheduler_response_body_size_bytes{route, method}
```

##### P2 - Nice to Have

4. **Fastify Plugin Lifecycle Metrics**
```typescript
birthday_scheduler_plugin_load_duration_seconds{plugin_name}
birthday_scheduler_plugin_load_errors_total{plugin_name}
```

5. **Decorator Usage Metrics**
```typescript
birthday_scheduler_decorator_calls_total{decorator_name}
```

#### Security Considerations
**Best Practice:** Serve metrics on a separate port to avoid public exposure.

```typescript
// Separate metrics server instance
const metricsApp = fastify();
metricsApp.get('/metrics', async () => {
  return metricsService.getMetrics();
});
await metricsApp.listen({ port: 9090, host: '0.0.0.0' });
```

**Priority:** P1 for route-specific metrics, P2 for plugin metrics

### 2. PostgreSQL Database Metrics

#### Current Implementation
The application has comprehensive database metrics covering connections, queries, transactions.

#### Recommended PostgreSQL Metrics (from postgres_exporter)

**Already Implemented:**
- Database connections ✅
- Query duration ✅
- Transaction commits/rollbacks ✅
- Deadlocks ✅
- Sequential scans ✅
- Index/buffer cache hit ratios ✅
- Replication lag ✅

**Additional Recommendations (via postgres_exporter):**

##### P0 - Critical (Add via postgres_exporter sidecar)

1. **Database Availability**
```promql
pg_up{instance="postgres:5432"}
```

2. **Connection Limits**
```promql
pg_settings_max_connections - pg_stat_activity_count
```

3. **Database Size Growth**
```promql
pg_database_size_bytes{datname="birthday_scheduler"}
```

4. **Bloat Metrics**
```promql
pg_stat_user_tables_n_dead_tup{relname="users"}
pg_stat_user_tables_last_autovacuum
```

##### P1 - Important

5. **Table and Index Statistics**
```promql
pg_stat_user_tables_seq_scan{relname}
pg_stat_user_tables_idx_scan{relname}
pg_stat_user_tables_n_tup_ins{relname}
pg_stat_user_tables_n_tup_upd{relname}
pg_stat_user_tables_n_tup_del{relname}
```

6. **Query Performance from pg_stat_statements**
```promql
pg_stat_statements_calls{query}
pg_stat_statements_mean_time_seconds{query}
pg_stat_statements_max_time_seconds{query}
```

7. **Checkpoint Statistics**
```promql
pg_stat_bgwriter_checkpoints_timed
pg_stat_bgwriter_checkpoints_req
pg_stat_bgwriter_checkpoint_write_time
pg_stat_bgwriter_checkpoint_sync_time
```

##### P2 - Nice to Have

8. **Lock Statistics**
```promql
pg_locks_count{mode, locktype}
```

9. **WAL Statistics**
```promql
pg_stat_wal_wal_bytes
pg_stat_wal_wal_records
pg_stat_wal_wal_buffers_full
```

#### Implementation via postgres_exporter

**Deployment:**
```yaml
# docker-compose.yml addition
postgres-exporter:
  image: prometheuscommunity/postgres-exporter:latest
  environment:
    DATA_SOURCE_NAME: "postgresql://metrics_user:password@postgres:5432/birthday_scheduler?sslmode=disable"
  ports:
    - "9187:9187"
  depends_on:
    - postgres
```

**User Setup:**
```sql
-- Create monitoring user with minimal privileges
CREATE USER metrics_user WITH PASSWORD 'secure_password';
GRANT pg_monitor TO metrics_user;
GRANT CONNECT ON DATABASE birthday_scheduler TO metrics_user;
```

**Custom Queries (queries.yaml):**
```yaml
pg_database_bloat:
  query: |
    SELECT
      schemaname,
      tablename,
      pg_total_relation_size(schemaname||'.'||tablename) as table_bytes,
      pg_relation_size(schemaname||'.'||tablename) as table_bytes_no_toast
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  metrics:
    - schemaname:
        usage: "LABEL"
    - tablename:
        usage: "LABEL"
    - table_bytes:
        usage: "GAUGE"
    - table_bytes_no_toast:
        usage: "GAUGE"
```

**Priority:** P0 for postgres_exporter deployment

### 3. RabbitMQ Message Queue Metrics

#### Current Implementation
Comprehensive RabbitMQ metrics covering queues, channels, messages.

#### Recommended RabbitMQ Metrics (from rabbitmq_prometheus plugin)

**Already Implemented (Application-Level):**
- Message acks/nacks ✅
- Message redeliveries ✅
- Queue depth ✅
- Consumer count ✅
- Channel operations ✅
- Publisher confirms ✅

**Additional Recommendations (via RabbitMQ Plugin):**

##### P0 - Critical (Add via rabbitmq_prometheus plugin)

1. **Queue-Level Metrics**
```promql
rabbitmq_queue_messages_ready{queue="birthday_notifications"}
rabbitmq_queue_messages_unacked{queue="birthday_notifications"}
rabbitmq_queue_messages{queue="birthday_notifications"}
rabbitmq_queue_consumers{queue="birthday_notifications"}
```

2. **Node-Level Metrics**
```promql
rabbitmq_node_mem_used
rabbitmq_node_disk_free
rabbitmq_node_fd_used
rabbitmq_node_sockets_used
```

3. **Connection Metrics**
```promql
rabbitmq_connections_total
rabbitmq_channels_total
rabbitmq_connections_closed_total
```

##### P1 - Important

4. **Message Rates**
```promql
rabbitmq_queue_messages_published_total{queue}
rabbitmq_queue_messages_delivered_total{queue}
rabbitmq_queue_messages_redelivered_total{queue}
```

5. **Consumer Utilization**
```promql
rabbitmq_queue_consumer_utilisation{queue}
```

6. **Memory Usage**
```promql
rabbitmq_queue_process_memory_bytes{queue}
rabbitmq_queue_messages_bytes{queue}
```

##### P2 - Nice to Have

7. **Exchange Metrics**
```promql
rabbitmq_exchange_messages_published_in_total{exchange}
rabbitmq_exchange_messages_published_out_total{exchange}
```

8. **Erlang VM Metrics**
```promql
rabbitmq_erlang_processes_used
rabbitmq_erlang_gc_runs_total
rabbitmq_erlang_gc_reclaimed_bytes_total
```

#### Implementation via rabbitmq_prometheus Plugin

**Enable Plugin:**
```bash
rabbitmq-plugins enable rabbitmq_prometheus
```

**Prometheus Configuration:**
```yaml
scrape_configs:
  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
    scrape_interval: 30s
```

**Advanced: Per-Queue Filtering**
```yaml
scrape_configs:
  - job_name: 'rabbitmq-detailed'
    static_configs:
      - targets: ['rabbitmq:15692']
    params:
      family: ['queue_metrics']
      vhost: ['/']
    scrape_interval: 30s
```

**Priority:** P0 for plugin enablement

### 4. TypeORM Performance Metrics

#### Current Implementation
Database connection pool and query metrics are tracked.

#### Recommended TypeORM Metrics

**Already Implemented:**
- Connection pool state ✅
- Query duration ✅
- Transaction metrics ✅

**Additional Recommendations:**

##### P1 - Important

1. **Connection Pool Stats (via DataSource)**
```typescript
// Implement periodic collection
const poolStats = await dataSource.driver.pool.stats();

metricsService.setGauge('connection_pool_total', poolStats.total);
metricsService.setGauge('connection_pool_idle', poolStats.idle);
metricsService.setGauge('connection_pool_waiting', poolStats.waiting);
```

2. **Query Execution Time Tracking**
```typescript
// Custom QueryRunner with timing
class MetricsQueryRunner extends QueryRunner {
  async query(query: string, parameters?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await super.query(query, parameters);
      const duration = (Date.now() - start) / 1000;

      metricsService.recordDatabaseQuery(
        this.getQueryType(query),
        this.getTableName(query),
        duration
      );

      return result;
    } catch (error) {
      metricsService.recordDatabaseError(error);
      throw error;
    }
  }
}
```

3. **Slow Query Tracking**
```typescript
// Custom logger with threshold
class MetricsLogger {
  logQuery(query: string, parameters: any[], queryRunner: QueryRunner) {
    const executionTime = queryRunner.executionTime;

    if (executionTime > 1000) { // 1 second threshold
      metricsService.incrementCounter('slow_queries_total', {
        query_type: this.getQueryType(query)
      });
      logger.warn({ query, executionTime }, 'Slow query detected');
    }
  }
}
```

##### P2 - Nice to Have

4. **Entity-Level Metrics**
```typescript
birthday_scheduler_entity_inserts_total{entity="User"}
birthday_scheduler_entity_updates_total{entity="Birthday"}
birthday_scheduler_entity_deletes_total{entity="Message"}
```

5. **Migration Metrics**
```typescript
birthday_scheduler_migration_duration_seconds{migration}
birthday_scheduler_migration_status{migration, status="success|failed"}
```

**Priority:** P1 for connection pool stats

---

## Additional Metrics Recommendations

### Enhanced Observability Metrics

While the current implementation exceeds the 100+ metric target, here are additional strategic metrics for production excellence:

#### 1. SLI/SLO Metrics (P0 - Critical)

**Service Level Indicators:**

1. **Availability SLI**
```typescript
birthday_scheduler_availability_sli_ratio
// Calculated as: successful_requests / total_requests
```

**PromQL:**
```promql
# 99.9% availability target
(
  sum(rate(birthday_scheduler_api_requests_total{status!~"5.."}[30d]))
  /
  sum(rate(birthday_scheduler_api_requests_total[30d]))
) >= 0.999
```

2. **Latency SLI**
```typescript
birthday_scheduler_latency_sli_ratio
// Calculated as: requests_under_threshold / total_requests
```

**PromQL:**
```promql
# 95% of requests under 200ms
histogram_quantile(0.95,
  sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le)
) < 0.2
```

3. **Throughput SLI**
```typescript
birthday_scheduler_throughput_sli_ratio
// Messages delivered vs scheduled
```

**PromQL:**
```promql
# 99% delivery success rate
(
  sum(rate(birthday_scheduler_messages_sent_total[1h]))
  /
  sum(rate(birthday_scheduler_messages_scheduled_total[1h]))
) >= 0.99
```

4. **Error Budget Tracking**
```typescript
birthday_scheduler_error_budget_remaining_ratio
// Track SLO compliance
```

**PromQL:**
```promql
# Error budget: 0.1% (100% - 99.9% availability)
1 - (
  sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[30d]))
  /
  sum(rate(birthday_scheduler_api_requests_total[30d]))
  /
  0.001  # Error budget (0.1%)
)
```

#### 2. Business KPI Metrics (P1 - Important)

1. **Daily Active Users (DAU)**
```typescript
birthday_scheduler_daily_active_users_count
```

2. **Message Delivery Success Rate**
```typescript
birthday_scheduler_message_success_rate_percentage
```

3. **Average Time to Birthday Processing**
```typescript
birthday_scheduler_birthday_processing_time_seconds
```

4. **Revenue/Cost Metrics**
```typescript
birthday_scheduler_message_cost_total{provider, message_type}
birthday_scheduler_infrastructure_cost_daily
```

#### 3. Advanced Queue Metrics (P1 - Important)

1. **Queue Processing Efficiency**
```typescript
birthday_scheduler_queue_processing_efficiency_ratio
// Messages processed / Time spent
```

2. **Message Time in Queue Distribution**
```typescript
birthday_scheduler_message_queue_time_seconds_bucket
```

3. **DLQ Movement Rate**
```typescript
birthday_scheduler_dlq_movement_rate
// Messages moved to DLQ per second
```

4. **Consumer Lag**
```typescript
birthday_scheduler_consumer_lag_seconds{queue, consumer}
```

#### 4. Advanced Database Metrics (P1 - Important)

1. **Query Cache Efficiency**
```typescript
birthday_scheduler_query_cache_hit_ratio
```

2. **Temporary Table Usage**
```typescript
birthday_scheduler_temp_tables_created_total{query_type}
```

3. **Table Bloat Percentage**
```typescript
birthday_scheduler_table_bloat_percentage{table}
```

4. **Connection Churn Rate**
```typescript
birthday_scheduler_connection_churn_rate
// New connections per second
```

#### 5. Security & Compliance Metrics (P0 - Critical)

1. **Suspicious Activity Detection**
```typescript
birthday_scheduler_suspicious_activity_total{activity_type, severity}
```

2. **PII Access Tracking**
```typescript
birthday_scheduler_pii_access_total{entity, action}
```

3. **Audit Log Completeness**
```typescript
birthday_scheduler_audit_log_gaps_total
```

4. **Encryption Status**
```typescript
birthday_scheduler_encryption_status{component, encrypted="true|false"}
```

#### 6. Infrastructure Health Metrics (P1 - Important)

1. **Container Resource Limits**
```typescript
birthday_scheduler_container_cpu_limit_ratio
birthday_scheduler_container_memory_limit_ratio
```

2. **Disk I/O Utilization**
```typescript
birthday_scheduler_disk_io_utilization_percentage
```

3. **Network Bandwidth Usage**
```typescript
birthday_scheduler_network_bandwidth_bytes{direction="in|out"}
```

4. **DNS Resolution Time**
```typescript
birthday_scheduler_dns_resolution_duration_seconds{domain}
```

#### 7. Application-Specific Advanced Metrics (P2 - Nice to Have)

1. **Birthday Detection Accuracy**
```typescript
birthday_scheduler_birthday_detection_accuracy_percentage
```

2. **Template Rendering Performance**
```typescript
birthday_scheduler_template_rendering_duration_seconds{template}
```

3. **Timezone Conversion Accuracy**
```typescript
birthday_scheduler_timezone_conversion_errors_total{timezone}
```

4. **Message Personalization Rate**
```typescript
birthday_scheduler_message_personalization_ratio
```

---

## Prometheus Best Practices

### 1. Metric Naming Conventions

Based on [Prometheus official naming guidelines](https://prometheus.io/docs/practices/naming/):

#### Core Principles

1. **Application Prefix:** All metrics start with `birthday_scheduler_`
2. **Lowercase with underscores:** `birthday_scheduler_api_requests_total`
3. **Include unit suffix:** `_seconds`, `_bytes`, `_total`, `_ratio`
4. **Counter suffix:** Always end counters with `_total`

#### Unit Standards

| Metric Family | Base Unit | Suffix |
|---------------|-----------|--------|
| Time | seconds | `_seconds` |
| Size | bytes | `_bytes` |
| Ratio | 0-1 | `_ratio` |
| Percentage | 0-100 | `_percentage` (avoid, use ratio) |
| Count | N/A | `_total` (counters only) |
| Temperature | celsius | `_celsius` |

#### Examples from Current Implementation

**Good Examples:**
```typescript
✅ birthday_scheduler_api_response_time_seconds
✅ birthday_scheduler_database_query_duration_seconds
✅ birthday_scheduler_messages_scheduled_total
✅ birthday_scheduler_cache_hit_rate (ratio 0-1)
✅ birthday_scheduler_http_request_size_bytes
```

**Avoid:**
```typescript
❌ birthday_scheduler_api_response_ms (use seconds)
❌ birthday_scheduler_messages_scheduled (missing _total)
❌ birthday_scheduler_cache_hit_percent (use ratio)
❌ birthdayScheduler_requests (use underscores)
```

### 2. Label Best Practices

#### Label Naming

Based on [CNCF Prometheus Labels guide](https://www.cncf.io/blog/2025/07/22/prometheus-labels-understanding-and-best-practices/):

1. **Lowercase with underscores:** `message_type`, `status_code`
2. **Avoid leading underscores:** Reserved for internal use
3. **Descriptive names:** `failure_type` not `ft`
4. **Consistent across metrics:** Same label name for same concept

**Examples:**
```typescript
✅ {method="GET", path="/api/birthdays", status="200"}
✅ {queue_name="birthday_notifications", consumer_tag="worker_1"}
✅ {message_type="email", status_code="200"}
```

#### Label Cardinality Management

**Critical Rule:** Avoid high-cardinality labels that create unbounded time series.

**Low Cardinality (Safe):**
```typescript
✅ {status="200|404|500"} // ~10 values
✅ {method="GET|POST|PUT|DELETE"} // 4-7 values
✅ {environment="dev|staging|prod"} // 3 values
✅ {message_type="email|sms|push"} // 3-10 values
```

**High Cardinality (Dangerous):**
```typescript
❌ {user_id="12345"} // Millions of unique users
❌ {email="user@example.com"} // Unbounded
❌ {request_id="uuid-..."} // Unique per request
❌ {timestamp="2025-12-31..."} // Infinite values
```

**Cardinality Impact:**
```
Metric with 3 labels, each with N values:
Total time series = N₁ × N₂ × N₃

Example:
{method=4, path=20, status=10}
= 4 × 20 × 10 = 800 time series ✅ Good

{method=4, user_id=1000000, status=10}
= 4 × 1,000,000 × 10 = 40,000,000 time series ❌ Catastrophic
```

**Solution for High Cardinality:**
Use aggregations or separate tracking systems for high-cardinality data.

```typescript
// Instead of tracking per user:
❌ metricsService.recordApiRequest(method, path, status, userId);

// Track aggregated metrics:
✅ metricsService.recordApiRequest(method, path, status);
// Store detailed per-user data in application database
```

### 3. Histogram Bucket Selection

#### Bucket Strategy

Histograms require careful bucket selection for accurate percentile calculation.

**Current Implementation Example:**
```typescript
buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
// API response times: 1ms to 5s
```

**Guidelines:**

1. **Cover expected range:** Include min to max expected values
2. **Exponential distribution:** More buckets at low end (0.001, 0.01, 0.1, 1)
3. **Include outliers:** Add buckets beyond normal range
4. **Trade-off:** More buckets = better accuracy but higher storage

**Bucket Examples by Use Case:**

**Fast Operations (API, Cache):**
```typescript
buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1]
// 0.1ms to 100ms
```

**Medium Operations (Database Queries):**
```typescript
buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
// 1ms to 5s
```

**Slow Operations (Batch Processing):**
```typescript
buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120]
// 100ms to 2 minutes
```

**Storage Size Metrics:**
```typescript
buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
// 100 bytes to 1MB
```

### 4. Summary vs Histogram

#### When to Use Each

**Histogram:**
- Server-side percentile calculation
- Aggregatable across instances
- Required for alerting on latencies
- Higher storage cost
- **Use Case:** API response times, query durations

**Summary:**
- Client-side percentile calculation
- NOT aggregatable
- Lower storage cost
- Pre-configured quantiles (0.5, 0.9, 0.95, 0.99)
- **Use Case:** Single-instance quantile tracking

**Current Implementation:** Uses both appropriately
- Histograms for API, database, queue metrics (aggregatable)
- Summaries for quantile tracking (efficient for single metrics)

### 5. Metric Collection Performance

#### Best Practices

1. **Lazy Initialization:** Metrics initialized once at startup ✅
2. **Avoid Synchronous Calls:** Metric recording is fast (in-memory) ✅
3. **Batch Updates:** Update multiple related metrics together ✅
4. **Sampling for High-Volume:** Consider sampling for extremely high-traffic metrics

**Performance Considerations:**

```typescript
// Fast: In-memory increment
metricsService.recordMessageSent(messageType, statusCode);

// Slow: Avoid during request handling
❌ const metrics = await metricsService.getMetrics(); // ~10-100ms

// Good: Expose metrics endpoint
✅ app.get('/metrics', async (req, res) => {
  res.header('Content-Type', metricsService.getContentType());
  return metricsService.getMetrics();
});
```

### 6. Default Labels

#### Application-Wide Labels

The application correctly uses default labels:

```typescript
{
  service: 'birthday-message-scheduler',
  environment: 'production',
  version: '1.0.0'
}
```

**Benefits:**
- Consistent across all metrics
- Easy filtering in Prometheus/Grafana
- Multi-environment support
- Version tracking for rollbacks

**PromQL Filtering:**
```promql
# Production only
birthday_scheduler_api_requests_total{environment="production"}

# Specific version
birthday_scheduler_api_requests_total{version="1.2.3"}

# Cross-environment comparison
sum(rate(birthday_scheduler_api_requests_total[5m])) by (environment)
```

---

## Cardinality Management

### Understanding Cardinality

**Cardinality:** Number of unique time series per metric.

**Formula:**
```
Time Series Count = Unique combinations of all label values
```

**Example:**
```typescript
birthday_scheduler_api_requests_total{method, path, status}

Labels:
- method: 4 values (GET, POST, PUT, DELETE)
- path: 20 unique API paths
- status: 10 status codes (200, 201, 400, 401, 403, 404, 500, 502, 503, 504)

Cardinality = 4 × 20 × 10 = 800 time series ✅ Acceptable
```

### Cardinality Limits

**Prometheus Recommendations:**
- Per metric: < 10,000 time series ✅ Good
- Per metric: 10,000 - 100,000 ⚠️ Warning
- Per metric: > 100,000 ❌ Problem
- Total instance: < 1,000,000 ✅ Good

### Cardinality Explosion Prevention

#### 1. Avoid User-Specific Labels

**Problem:**
```typescript
❌ {user_id="123456"}
// With 1M users = 1M time series per metric
```

**Solution:**
```typescript
✅ Track user metrics in application database
✅ Use aggregated labels: {user_tier="free|premium"}
```

#### 2. Bounded Label Values

**Problem:**
```typescript
❌ {path="/api/users/12345/birthdays"} // Unbounded user IDs
```

**Solution:**
```typescript
✅ {path="/api/users/:id/birthdays"} // Parameterized route
```

**Implementation:**
```typescript
// Normalize paths before recording
function normalizePath(path: string): string {
  return path
    .replace(/\/\d+/g, '/:id')          // /users/123 -> /users/:id
    .replace(/\/[0-9a-f-]{36}/g, '/:uuid'); // UUIDs
}

metricsService.recordApiRequest(method, normalizePath(path), status);
```

#### 3. Cardinality Monitoring

**Check Cardinality in Prometheus:**
```promql
# Count time series per metric
count({__name__=~"birthday_scheduler_.*"}) by (__name__)

# Total time series for application
count({service="birthday-message-scheduler"})

# Cardinality by label
count(birthday_scheduler_api_requests_total) by (method)
count(birthday_scheduler_api_requests_total) by (path)
```

**Alert on High Cardinality:**
```yaml
groups:
  - name: cardinality_alerts
    rules:
      - alert: HighMetricCardinality
        expr: count({__name__=~"birthday_scheduler_.*"}) by (__name__) > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Metric {{ $labels.__name__ }} has high cardinality"
          description: "{{ $value }} time series"
```

### Current Implementation Analysis

**Cardinality Estimate for Birthday Scheduler:**

```typescript
// API Requests
birthday_scheduler_api_requests_total{method, path, status}
= 4 × 20 × 10 = 800 ✅

// Messages
birthday_scheduler_messages_scheduled_total{message_type, timezone}
= 3 × 30 = 90 ✅

// Database Queries
birthday_scheduler_database_query_duration_seconds{query_type, table}
= 10 × 15 = 150 ✅

// Queue Metrics
birthday_scheduler_queue_depth{queue_name}
= 5 = 5 ✅

// Estimated Total: ~2,000-5,000 time series
```

**Status:** ✅ Excellent - Well below cardinality limits

---

## Implementation Guidance

### 1. Metrics Integration Checklist

#### Phase 1: Core Metrics (Already Implemented ✅)
- [x] Initialize Prometheus registry
- [x] Configure default labels (service, environment, version)
- [x] Collect default Node.js metrics
- [x] Implement core counters (requests, messages, errors)
- [x] Implement core gauges (workers, connections, queue depth)
- [x] Implement histograms (latency, duration)
- [x] Expose /metrics endpoint

#### Phase 2: External Exporters (Recommended)
- [ ] Deploy postgres_exporter sidecar
- [ ] Enable rabbitmq_prometheus plugin
- [ ] Configure Prometheus scraping for exporters
- [ ] Create unified Grafana dashboards

#### Phase 3: Advanced Metrics (Optional)
- [ ] Implement SLI/SLO tracking
- [ ] Add business KPI metrics
- [ ] Create custom recording rules
- [ ] Configure advanced alerting

### 2. Instrumentation Patterns

#### Pattern 1: Middleware Instrumentation (Fastify)

```typescript
// Already implemented in the app
fastify.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now();
});

fastify.addHook('onResponse', async (request, reply) => {
  const duration = (Date.now() - request.startTime) / 1000;

  metricsService.recordApiRequest(
    request.method,
    request.routerPath || request.url,
    reply.statusCode
  );

  metricsService.recordApiResponseTime(
    request.method,
    request.routerPath || request.url,
    reply.statusCode,
    duration
  );
});
```

#### Pattern 2: Decorator Pattern (Database)

```typescript
// Wrap TypeORM queries with metrics
function withMetrics<T>(
  operation: () => Promise<T>,
  queryType: string,
  table: string
): Promise<T> {
  const start = Date.now();

  return operation()
    .then((result) => {
      const duration = (Date.now() - start) / 1000;
      metricsService.recordDatabaseQuery(queryType, table, duration);
      metricsService.recordDatabaseCommit(queryType);
      return result;
    })
    .catch((error) => {
      metricsService.recordDatabaseRollback(error.message);
      throw error;
    });
}

// Usage
await withMetrics(
  () => userRepository.save(user),
  'INSERT',
  'users'
);
```

#### Pattern 3: AOP Pattern (RabbitMQ)

```typescript
// Aspect-oriented programming for queue operations
class MetricsQueueWrapper {
  async publish(exchange: string, routingKey: string, message: any) {
    const start = Date.now();

    try {
      await this.channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)));

      const duration = (Date.now() - start) / 1000;
      metricsService.recordMessagePublishDuration(exchange, routingKey, duration);
      metricsService.recordPublisherConfirm(exchange, 'success');
    } catch (error) {
      metricsService.recordPublisherConfirm(exchange, 'failed');
      throw error;
    }
  }

  async consume(queue: string, handler: Function) {
    return this.channel.consume(queue, async (msg) => {
      const start = Date.now();
      metricsService.setConsumerCount(queue, 1);

      try {
        await handler(msg);
        this.channel.ack(msg);

        const duration = (Date.now() - start) / 1000;
        metricsService.recordMessageConsumeDuration(queue, 'success', duration);
        metricsService.recordMessageAck(queue, this.consumerTag);
      } catch (error) {
        this.channel.nack(msg);
        metricsService.recordMessageConsumeDuration(queue, 'failed', duration);
        metricsService.recordMessageNack(queue, error.message);
      }
    });
  }
}
```

#### Pattern 4: Timer Utility

```typescript
// Helper for timing operations
class MetricsTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  stop(): number {
    return (Date.now() - this.startTime) / 1000;
  }
}

// Usage
const timer = new MetricsTimer();
await processMessage(message);
metricsService.recordMessageProcessingLatency(
  message.type,
  'success',
  timer.stop()
);
```

### 3. Testing Metrics

#### Unit Testing Metrics

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
  });

  it('should increment message counter', async () => {
    metricsService.recordMessageScheduled('email', 'UTC');
    metricsService.recordMessageScheduled('email', 'UTC');

    const metrics = await metricsService.getMetricValues();
    expect(metrics.scheduledTotal).toBe(2);
  });

  it('should record histogram values', async () => {
    metricsService.recordApiResponseTime('GET', '/api/birthdays', 200, 0.123);

    const metricsText = await metricsService.getMetrics();
    expect(metricsText).toContain('birthday_scheduler_api_response_time_seconds');
  });
});
```

#### Integration Testing with Prometheus

```typescript
import { describe, it, expect } from 'vitest';
import axios from 'axios';

describe('Metrics Endpoint', () => {
  it('should expose metrics in Prometheus format', async () => {
    const response = await axios.get('http://localhost:3000/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.data).toContain('birthday_scheduler_api_requests_total');
  });

  it('should include default labels', async () => {
    const response = await axios.get('http://localhost:3000/metrics');

    expect(response.data).toContain('service="birthday-message-scheduler"');
    expect(response.data).toContain('environment="test"');
  });
});
```

### 4. Deployment Configuration

#### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'production'
    replica: 'prometheus-1'

scrape_configs:
  # Birthday Scheduler Application
  - job_name: 'birthday-scheduler'
    static_configs:
      - targets: ['app:3000']
    scrape_interval: 15s
    metrics_path: '/metrics'

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 30s

  # RabbitMQ Prometheus Plugin
  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
    scrape_interval: 30s
    params:
      family: ['queue_metrics', 'connection_metrics']

rule_files:
  - '/etc/prometheus/rules/*.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

#### Recording Rules

```yaml
# /etc/prometheus/rules/birthday_scheduler.yml
groups:
  - name: birthday_scheduler_aggregations
    interval: 30s
    rules:
      # Error rate (5min window)
      - record: birthday_scheduler:api_error_rate:5m
        expr: |
          (
            sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m]))
            /
            sum(rate(birthday_scheduler_api_requests_total[5m]))
          )

      # P95 API latency (5min window)
      - record: birthday_scheduler:api_latency_p95:5m
        expr: |
          histogram_quantile(0.95,
            sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le, method)
          )

      # Message success rate
      - record: birthday_scheduler:message_success_rate:5m
        expr: |
          (
            sum(rate(birthday_scheduler_messages_sent_total[5m]))
            /
            sum(rate(birthday_scheduler_messages_scheduled_total[5m]))
          )

      # Queue saturation
      - record: birthday_scheduler:queue_saturation:current
        expr: |
          (
            birthday_scheduler_queue_depth{queue_name="birthday_notifications"}
            /
            1000  # Max queue capacity
          )
```

---

## PromQL Examples

### 1. RED Method Queries

#### Rate (Requests per Second)

```promql
# Overall request rate
sum(rate(birthday_scheduler_api_requests_total[5m]))

# Per-endpoint request rate
sum(rate(birthday_scheduler_api_requests_total[5m])) by (method, path)

# Per-environment request rate
sum(rate(birthday_scheduler_api_requests_total[5m])) by (environment)
```

#### Errors (Error Rate %)

```promql
# Overall error rate (%)
(
  sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m]))
  /
  sum(rate(birthday_scheduler_api_requests_total[5m]))
) * 100

# Error rate by endpoint
(
  sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])) by (path)
  /
  sum(rate(birthday_scheduler_api_requests_total[5m])) by (path)
) * 100

# 4xx vs 5xx errors
sum(rate(birthday_scheduler_api_requests_total{status=~"4.."}[5m])) by (status)
sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])) by (status)
```

#### Duration (Latency Percentiles)

```promql
# P50, P95, P99 latency
histogram_quantile(0.50, sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le))
histogram_quantile(0.99, sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le))

# Per-endpoint P95 latency
histogram_quantile(0.95,
  sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le, path)
)

# Average latency (use histogram_avg or summary)
avg(rate(birthday_scheduler_api_response_time_seconds_sum[5m]) / rate(birthday_scheduler_api_response_time_seconds_count[5m]))
```

### 2. Four Golden Signals Queries

#### Traffic

```promql
# Messages scheduled per minute
sum(rate(birthday_scheduler_messages_scheduled_total[1m])) * 60

# Messages sent per hour
sum(rate(birthday_scheduler_messages_sent_total[1h])) * 3600

# Peak traffic hour
topk(1,
  sum(rate(birthday_scheduler_api_requests_total[1h])) by (hour)
)
```

#### Latency

```promql
# API latency percentiles
histogram_quantile(0.95, sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le))

# Database query latency
histogram_quantile(0.99, sum(rate(birthday_scheduler_database_query_duration_seconds_bucket[5m])) by (le))

# Message delivery latency
histogram_quantile(0.95, sum(rate(birthday_scheduler_message_delivery_duration_seconds_bucket[5m])) by (le))
```

#### Errors

```promql
# Overall error rate
sum(rate(birthday_scheduler_messages_failed_total[5m]))

# Authentication failure rate
sum(rate(birthday_scheduler_auth_failures_total[5m]))

# Database error rate
sum(rate(birthday_scheduler_database_rollbacks_total[5m]))
```

#### Saturation

```promql
# Database connection pool saturation
(
  birthday_scheduler_database_connections{state="active"}
  /
  (birthday_scheduler_database_connections{state="active"} + birthday_scheduler_database_connections{state="idle"})
) * 100

# Queue depth vs capacity
(birthday_scheduler_queue_depth{queue_name="birthday_notifications"} / 1000) * 100

# Event loop saturation
birthday_scheduler_event_loop_utilization * 100

# Memory saturation
(birthday_scheduler_system_total_memory - birthday_scheduler_system_free_memory) / birthday_scheduler_system_total_memory * 100
```

### 3. Business KPI Queries

```promql
# Delivery success rate (last hour)
(
  sum(rate(birthday_scheduler_messages_sent_total[1h]))
  /
  sum(rate(birthday_scheduler_messages_scheduled_total[1h]))
) * 100

# Birthdays processed today (24h)
sum(increase(birthday_scheduler_birthdays_processed_total[24h]))

# Active users (last 15 minutes)
birthday_scheduler_active_users{time_window="15m"}

# Template usage distribution
topk(10, sum(rate(birthday_scheduler_message_template_usage_total[1h])) by (template_name))

# Peak messaging hours
topk(5, sum(rate(birthday_scheduler_message_delivery_by_hour_total[24h])) by (hour))
```

### 4. Performance Analysis Queries

```promql
# Cache hit rate
(
  sum(rate(birthday_scheduler_cache_hits_total[5m]))
  /
  (sum(rate(birthday_scheduler_cache_hits_total[5m])) + sum(rate(birthday_scheduler_cache_misses_total[5m])))
) * 100

# Database query performance by type
avg(rate(birthday_scheduler_database_query_duration_seconds_sum[5m]) / rate(birthday_scheduler_database_query_duration_seconds_count[5m])) by (query_type)

# Slow queries (>1s)
sum(rate(birthday_scheduler_database_query_duration_seconds_bucket{le="1.0"}[5m])) by (query_type)

# GC overhead
sum(rate(birthday_scheduler_gc_pause_time_seconds_sum[5m])) / sum(rate(birthday_scheduler_process_uptime_seconds[5m])) * 100

# Connection pool wait time
avg(birthday_scheduler_connection_pool_wait_time) by (pool_name)
```

### 5. Queue Health Queries

```promql
# Queue depth trend
delta(birthday_scheduler_queue_depth{queue_name="birthday_notifications"}[5m])

# Consumer efficiency (acks per second)
sum(rate(birthday_scheduler_message_acks_total[5m])) by (queue_name)

# Redelivery rate (should be low)
sum(rate(birthday_scheduler_message_redeliveries_total[5m])) by (queue_name)

# Message age (time in queue)
birthday_scheduler_message_age_seconds{queue_name="birthday_notifications"}

# Consumer utilization
birthday_scheduler_consumer_count{queue_name="birthday_notifications"} > 0
```

### 6. Alerting Queries

```promql
# High error rate alert (>1%)
(
  sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m]))
  /
  sum(rate(birthday_scheduler_api_requests_total[5m]))
) > 0.01

# High latency alert (P95 >500ms)
histogram_quantile(0.95,
  sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le)
) > 0.5

# Queue saturation alert (>80%)
birthday_scheduler_queue_depth{queue_name="birthday_notifications"} / 1000 > 0.8

# Database connection exhaustion (>90%)
(
  birthday_scheduler_database_connections{state="active"}
  /
  (birthday_scheduler_database_connections{state="active"} + birthday_scheduler_database_connections{state="idle"})
) > 0.9

# Memory pressure (>85%)
(
  (birthday_scheduler_system_total_memory - birthday_scheduler_system_free_memory)
  /
  birthday_scheduler_system_total_memory
) > 0.85
```

### 7. Capacity Planning Queries

```promql
# Predict queue growth (linear regression)
predict_linear(birthday_scheduler_queue_depth{queue_name="birthday_notifications"}[30m], 3600)

# Database growth rate (bytes per hour)
rate(birthday_scheduler_database_table_size{table="messages"}[1h]) * 3600

# Request rate trend (next hour)
predict_linear(sum(rate(birthday_scheduler_api_requests_total[30m]))[30m], 3600)

# Memory usage trend
predict_linear(birthday_scheduler_system_total_memory - birthday_scheduler_system_free_memory[1h], 3600)
```

---

## References

### Official Documentation

1. **Prometheus Best Practices**
   - [Metric and Label Naming](https://prometheus.io/docs/practices/naming/)
   - [Prometheus Data Model](https://prometheus.io/docs/concepts/data_model/)
   - [Recording Rules](https://prometheus.io/docs/practices/rules/)

2. **CNCF Resources**
   - [Prometheus Labels: Understanding and Best Practices](https://www.cncf.io/blog/2025/07/22/prometheus-labels-understanding-and-best-practices/)

3. **Better Stack Community**
   - [Prometheus Best Practices: 8 Dos and Don'ts](https://betterstack.com/community/guides/monitoring/prometheus-best-practices/)
   - [Monitoring Node.js Apps with Prometheus](https://betterstack.com/community/guides/scaling-nodejs/nodejs-prometheus/)

### Monitoring Methodologies

4. **Four Golden Signals**
   - [The Four Golden Signals of Monitoring | Sysdig](https://www.sysdig.com/blog/golden-signals-kubernetes)
   - [The Four Golden Signals for SRE Monitoring | Better Stack](https://betterstack.com/community/guides/monitoring/sre-golden-signals/)
   - [Google SRE Book: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)

5. **RED Method**
   - [Microservices Monitoring with the RED Method | Last9](https://last9.io/blog/monitoring-with-red-method/)
   - [RED Metrics & Monitoring | Splunk](https://www.splunk.com/en_us/blog/learn/red-monitoring.html)

6. **USE Method**
   - [Metrics at a Glance for Production Clusters | InfraCloud](https://www.infracloud.io/blogs/metrics-at-glance-for-production-clusters/)

### Technology-Specific Guides

7. **Fastify Metrics**
   - [fastify-metrics - npm](https://www.npmjs.com/package/fastify-metrics)
   - [GitHub - SkeLLLa/fastify-metrics](https://github.com/SkeLLLa/fastify-metrics)
   - [@promster/fastify - npm](https://www.npmjs.com/package/@promster/fastify)

8. **PostgreSQL Monitoring**
   - [Top metrics in PostgreSQL monitoring with Prometheus | Sysdig](https://www.sysdig.com/blog/postgresql-monitoring)
   - [GitHub - prometheus-community/postgres_exporter](https://github.com/prometheus-community/postgres_exporter)
   - [Complete Guide To Monitor PostgreSQL With Prometheus and Grafana | Medium](https://rezakhademix.medium.com/a-complete-guide-to-monitor-postgresql-with-prometheus-and-grafana-5611af229882)

9. **RabbitMQ Monitoring**
   - [Monitoring with Prometheus and Grafana | RabbitMQ](https://www.rabbitmq.com/docs/prometheus)
   - [rabbitmq-prometheus/metrics.md | GitHub](https://github.com/rabbitmq/rabbitmq-prometheus/blob/master/metrics.md)
   - [RabbitMQ Monitoring Setup with Prometheus and Grafana | DevOps.dev](https://blog.devops.dev/rabbitmq-monitoring-setup-with-prometheus-and-grafana-980f1f02bbe1)

10. **TypeORM Performance**
    - [Performance Benchmarks: TypeScript ORMs & Databases | Prisma](https://www.prisma.io/blog/performance-benchmarks-comparing-query-latency-across-typescript-orms-and-databases)
    - [From Good to Great: Scaling Applications with TypeORM | DEV](https://dev.to/victor1890/from-good-to-great-scaling-applications-with-typeorm-optimization-837)

### Additional Resources

11. **Chronosphere Documentation**
    - [Prometheus metric naming recommendations](https://docs.chronosphere.io/ingest/metrics-traces/collector/mappings/prometheus/prometheus-recommendations)

12. **CloudRaft Blog**
    - [Prometheus Best Practices](https://www.cloudraft.io/blog/prometheus-best-practices)

13. **Middleware.io Blog**
    - [Prometheus Labels: Understanding and Best Practices](https://middleware.io/blog/prometheus-labels/)

14. **SigNoz Guides**
    - [What are Prometheus labels - Key Concepts and Best Practices](https://signoz.io/guides/what-are-prometheus-labels/)

---

## Conclusion

### Current Status: EXCELLENT ✅

The Birthday Message Scheduler application has achieved **comprehensive observability** with:

- **128+ custom metrics** (exceeds 100+ target)
- **Full coverage** of RED Method, Four Golden Signals, USE Method
- **Well-designed** metric names and labels following Prometheus best practices
- **Low cardinality** implementation avoiding common pitfalls
- **Production-ready** metrics across all technology stack components

### Recommendations

#### Priority 0 (Critical) - Within 2 Weeks

1. **Deploy postgres_exporter** sidecar for enhanced PostgreSQL metrics
2. **Enable rabbitmq_prometheus** plugin for detailed queue metrics
3. **Configure Prometheus scraping** for all exporters
4. **Create unified Grafana dashboards** combining all metrics

#### Priority 1 (Important) - Within 1 Month

5. **Implement SLI/SLO tracking** for availability, latency, throughput
6. **Add route-specific metrics** for API endpoint granularity
7. **Configure recording rules** for aggregated metrics
8. **Setup comprehensive alerting** using PromQL queries

#### Priority 2 (Nice to Have) - Future Enhancement

9. **Add business KPI metrics** for revenue/cost tracking
10. **Implement advanced queue metrics** for processing efficiency
11. **Create custom dashboards** for executive reporting
12. **Setup metric retention policies** for long-term storage

### Key Achievements

1. **Industry Standards Compliance:** Full adherence to RED, Four Golden Signals, USE methodologies
2. **Technology Best Practices:** Proper implementation for Fastify, PostgreSQL, RabbitMQ, TypeORM
3. **Cardinality Management:** All metrics well below cardinality limits
4. **Naming Conventions:** Consistent application of Prometheus naming standards
5. **Comprehensive Coverage:** 148+ total metrics (custom + default) providing complete observability

### Research Deliverables

This document provides:

- ✅ **Comprehensive metric categorization** (128+ custom metrics documented)
- ✅ **Priority ranking** (P0 Critical, P1 Important, P2 Nice-to-have)
- ✅ **Implementation guidance** for each category
- ✅ **PromQL examples** for custom metrics and alerting
- ✅ **Metric naming conventions** and label strategies
- ✅ **Industry standard references** (RED, Four Golden Signals, USE)
- ✅ **Cardinality management** strategies and best practices
- ✅ **Technology-specific recommendations** for Fastify, PostgreSQL, RabbitMQ

---

**Document Version:** 1.0
**Last Updated:** December 31, 2025
**Next Review:** March 31, 2026
