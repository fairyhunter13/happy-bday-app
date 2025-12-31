# Metrics Documentation

This document provides a comprehensive reference for all Prometheus metrics exposed by the Birthday Message Scheduler application, including operational guidance for monitoring, alerting, and troubleshooting.

## Table of Contents

### Getting Started
- [Overview](#overview)
- [Quick Reference](#quick-reference)
- [Monitoring Strategy](#monitoring-strategy)

### Metric Reference
- [Counter Metrics](#counter-metrics) - 105 cumulative metrics
- [Gauge Metrics](#gauge-metrics) - 117 current value metrics
- [Histogram Metrics](#histogram-metrics) - 36 distribution metrics
- [Summary Metrics](#summary-metrics) - 10 percentile metrics
- [Queue Metrics Deep-Dive](#queue-metrics-deep-dive) - RabbitMQ specifics

### Operational Guidance
- [SLO and Threshold Reference](#slo-and-threshold-reference)
- [Metric Interpretation Guide](#metric-interpretation-guide)
- [Alerting Rules](#alerting-rules)
- [Troubleshooting Decision Trees](#troubleshooting-decision-trees)

### Implementation
- [Grafana Query Examples](#grafana-query-examples)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Dashboard Integration](#dashboard-integration)

### Best Practices
- [Adding New Metrics](#adding-new-metrics) - Complete step-by-step guide
- [Cardinality Warnings](#cardinality-warnings)
- [Instrumentation Status](#instrumentation-status)
- [References](#references)

---

## Overview

This document provides comprehensive documentation for all Prometheus metrics exposed by the Birthday Message Scheduler application. It includes metric definitions, interpretation guidelines, alert configurations, and best practices for adding new metrics.

| Category | Count | Description |
|----------|-------|-------------|
| **Counter Metrics** | 105 | Cumulative values that only increase |
| **Gauge Metrics** | 117 | Values that can increase or decrease |
| **Histogram Metrics** | 36 | Distribution of values with buckets |
| **Summary Metrics** | 10 | Percentile-based distributions |
| **Total** | 268 | Complete observability coverage |

**Last Updated**: 2025-12-31
**Metrics Service Location**: `/src/services/metrics.service.ts`
**Alert Rules Location**: `/grafana/alerts/alert-rules.yaml`

### Quick Reference

- **Metrics Endpoint:** `/metrics` (Prometheus exposition format)
- **Default Labels:** `service`, `environment`, `version`
- **Scrape Interval:** 15s (recommended)
- **Retention:** 15 days (Prometheus default)
- **Metric Prefix:** `birthday_scheduler_`

---

## Monitoring Strategy

### The RED Method

The RED method focuses on three key metrics for request-driven services:

| Signal | Metric | Description | Target |
|--------|--------|-------------|--------|
| **Rate** | `rate(api_requests_total[5m])` | Requests per second | Baseline + 50% headroom |
| **Errors** | `rate(api_requests_total{status=~"5.."}[5m])` | Error rate percentage | < 0.1% |
| **Duration** | `histogram_quantile(0.99, api_response_time_seconds_bucket)` | Request latency | P99 < 2s |

**When to use RED:** For API endpoints, external service calls, and any request/response patterns.

### The Four Golden Signals

Google SRE's golden signals for comprehensive service health:

| Signal | Primary Metric | Description | Investigation Trigger |
|--------|---------------|-------------|----------------------|
| **Latency** | `api_response_time_seconds` | Time to serve requests | P99 > 2s for 5m |
| **Traffic** | `api_requests_total` | Demand on your system | 2x baseline for 10m |
| **Errors** | `messages_failed_total` | Rate of failed requests | > 5% for 2m |
| **Saturation** | `queue_depth`, `database_connections` | System fullness | > 80% capacity for 5m |

**When to use Golden Signals:** For overall system health dashboards and SLO tracking.

### Observability Layers

```
+------------------+     +------------------+     +------------------+
|   Application    |     |   Infrastructure |     |   Business       |
|   Metrics        |     |   Metrics        |     |   Metrics        |
+------------------+     +------------------+     +------------------+
| - API latency    |     | - CPU/Memory     |     | - Birthdays/day  |
| - Error rates    |     | - Disk I/O       |     | - Messages sent  |
| - Queue depth    |     | - Network        |     | - User growth    |
+------------------+     +------------------+     +------------------+
         |                        |                        |
         +------------------------+------------------------+
                                  |
                         [Unified Dashboard]
```

---

## SLO and Threshold Reference

### Service Level Objectives (SLOs)

| SLO | Target | Measurement | Error Budget (30d) |
|-----|--------|-------------|-------------------|
| **API Availability** | 99.9% | Successful requests / Total requests | 43.2 minutes |
| **Message Delivery** | 99% | Messages delivered / Messages sent | 7.2 hours |
| **Latency (P99)** | < 2s | 99th percentile response time | N/A |
| **Throughput** | > 100 msg/s | Messages processed per second | N/A |
| **Scheduler Accuracy** | 95% | On-time deliveries / Scheduled | N/A |

### Threshold Reference Table

#### API Performance Thresholds

| Metric | Normal | Warning | Critical | Action |
|--------|--------|---------|----------|--------|
| `api_response_time_seconds` (P99) | < 500ms | 500ms - 2s | > 2s | Scale horizontally, optimize queries |
| `api_error_rate` | < 0.1% | 0.1% - 5% | > 5% | Check dependencies, review logs |
| `api_requests_per_second` | Baseline | 1.5x baseline | 2x baseline | Auto-scale, investigate traffic source |
| `api_active_requests` | < 100 | 100 - 500 | > 500 | Check for slow endpoints, increase workers |

#### Queue Performance Thresholds

| Metric | Normal | Warning | Critical | Action |
|--------|--------|---------|----------|--------|
| `queue_depth` | < 100 | 100 - 1000 | > 1000 | Scale workers, check consumer health |
| `dlq_depth` | 0 | 1 - 100 | > 100 | Investigate failed messages, fix root cause |
| `message_age_seconds` | < 60s | 60s - 300s | > 300s | Increase consumer count, check processing time |
| `consumer_count` | >= 2 | 1 | 0 | Restart consumers, check connectivity |
| `queue_consumer_utilization` | < 70% | 70% - 90% | > 90% | Add consumers, optimize processing |

#### Database Performance Thresholds

| Metric | Normal | Warning | Critical | Action |
|--------|--------|---------|----------|--------|
| `database_query_duration_seconds` (P95) | < 100ms | 100ms - 1s | > 1s | Add indexes, optimize queries |
| `database_connections` (active) | < 50% pool | 50% - 80% | > 80% | Increase pool size, check connection leaks |
| `replication_lag` | < 1s | 1s - 30s | > 30s | Check network, replica health |
| `index_hit_ratio` | > 99% | 95% - 99% | < 95% | Add missing indexes, tune queries |
| `buffer_cache_hit_ratio` | > 99% | 95% - 99% | < 95% | Increase shared_buffers |

#### Resource Thresholds

| Metric | Normal | Warning | Critical | Action |
|--------|--------|---------|----------|--------|
| Memory usage | < 70% | 70% - 85% | > 85% | Scale up, investigate memory leaks |
| CPU usage | < 60% | 60% - 80% | > 80% | Scale out, optimize hot paths |
| Disk usage | < 70% | 70% - 85% | > 85% | Cleanup, expand storage |
| File descriptors | < 50% | 50% - 80% | > 80% | Increase limits, check connection leaks |

#### Business Metric Thresholds

| Metric | Normal | Warning | Critical | Action |
|--------|--------|---------|----------|--------|
| `message_delivery_success_rate` | > 99% | 95% - 99% | < 95% | Check email service, validate addresses |
| `birthdays_pending` | < 100 | 100 - 500 | > 500 | Scale scheduler, check processing |
| `cache_hit_rate` | > 90% | 80% - 90% | < 80% | Review cache keys, increase TTL |

---

## Metric Interpretation Guide

### Baseline Expectations

Understanding what "normal" looks like for your system:

#### Traffic Patterns

| Time Period | Expected Pattern | Variance |
|-------------|-----------------|----------|
| **Weekdays (9am-5pm)** | Peak traffic | +30-50% |
| **Weekdays (night)** | Low traffic | -60-80% |
| **Weekends** | Moderate traffic | -20-40% |
| **Holidays** | High birthday volume | +100-200% |
| **New Year's Day** | Highest volume | +300-500% |

#### Seasonal Considerations

- **January 1st**: Highest birthday volume globally
- **September**: Elevated births (US)
- **Month start/end**: Potential billing-related spikes
- **Leap year (Feb 29)**: Special handling required

### Common Patterns

#### Healthy System Indicators

```
API Response Time: Stable P99 < 500ms
Queue Depth:       Sawtooth pattern (fills/drains)
Error Rate:        < 0.1% with no spikes
Worker Utilization: 40-60% average
Cache Hit Rate:    > 95% stable
```

#### Warning Patterns

| Pattern | Metric Behavior | Likely Cause |
|---------|-----------------|--------------|
| **Gradual latency increase** | P99 climbing over hours | Memory leak, connection exhaustion |
| **Queue depth not draining** | Monotonic increase | Consumer failure, processing bottleneck |
| **Periodic spikes** | Regular intervals | Scheduled job interference, cron conflicts |
| **Error bursts** | Sudden error increase | Dependency failure, deployment issue |

### Anomaly Indicators

| Anomaly | Detection Query | Investigation Priority |
|---------|-----------------|----------------------|
| **Latency spike** | P99 > 3x baseline | High - User impact |
| **Error rate spike** | Errors > 10x baseline | Critical - Service degradation |
| **Traffic drop** | Rate < 50% baseline | High - Potential outage |
| **Zero consumers** | `consumer_count == 0` | Critical - Message loss risk |
| **DLQ growth** | `increase(dlq_depth[1h]) > 10` | Medium - Data quality issue |

### Correlation Guide

When investigating issues, check these metric correlations:

| Primary Symptom | Related Metrics to Check |
|-----------------|-------------------------|
| High latency | `database_query_duration`, `queue_wait_time`, `external_api_latency` |
| High error rate | `circuit_breaker_open`, `database_connections`, `rate_limit_hits_total` |
| Queue backup | `consumer_count`, `active_workers`, `message_processing_latency` |
| Memory growth | `cache_hit_rate`, `active_connections`, `gc_events_total` |

---

## Counter Metrics

Counters are cumulative metrics that only increase (or reset on restart).

### Original Counters (10 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `messages_scheduled_total` | `message_type` | Total messages scheduled for delivery |
| `messages_sent_total` | `message_type`, `status` | Total messages sent successfully |
| `messages_failed_total` | `message_type`, `reason` | Total message delivery failures |
| `api_requests_total` | `method`, `path`, `status` | Total API requests received |
| `user_activity_total` | `action` | Total user activity events |
| `message_retries_total` | `message_type` | Total message retry attempts |
| `external_api_calls_total` | `service`, `status` | Total external API calls |
| `security_events_total` | `event_type` | Total security events |
| `rate_limit_hits_total` | `endpoint` | Total rate limit violations |
| `auth_failures_total` | `reason` | Total authentication failures |

### Business Counters (25 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `birthdays_processed_total` | `status` | Total birthdays processed today |
| `message_template_usage_total` | `template_name` | Message template usage by name |
| `user_creations_total` | - | Total user creation events |
| `user_deletions_total` | - | Total user deletion events |
| `configuration_changes_total` | `config_type` | Configuration changes by type |
| `feature_usage_total` | `feature_name` | Feature usage tracking |
| `message_delivery_by_hour_total` | `hour` | Messages delivered by hour |
| `birthday_greeting_types_total` | `greeting_type` | Birthday greeting types sent |
| `notification_preferences_changed_total` | `preference` | Notification preferences changed |
| `user_logins_total` | `method` | User login events |
| `subscription_events_total` | `event_type` | Subscription events |
| `webhook_deliveries_total` | `status` | Webhook deliveries |
| `email_bounces_total` | `bounce_type` | Email bounces |
| `sms_delivery_status_total` | `status` | SMS delivery status |
| `push_notification_status_total` | `status` | Push notification status |
| `user_updates_total` | `field` | User updates by field |
| `messages_by_channel_total` | `channel` | Messages sent by channel type |
| `messages_by_priority_total` | `priority` | Messages sent by priority |
| `user_timezone_changes_total` | - | User timezone changes |
| `birthday_date_updates_total` | - | Birthday date updates |
| `user_opt_ins_total` | - | Opt-in events |
| `user_opt_outs_total` | - | Opt-out events |
| `message_personalization_usage_total` | `type` | Message personalization usage |
| `bulk_operations_total` | `operation` | Bulk operations performed |
| `data_export_requests_total` | - | Data export requests |

### Queue Counters (20 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `publisher_confirms_total` | - | Publisher confirms received |
| `message_acks_total` | `queue` | Message acknowledgments |
| `message_nacks_total` | `queue` | Message negative acknowledgments |
| `message_redeliveries_total` | `queue` | Message redeliveries |
| `queue_bindings_created_total` | `exchange` | Queue bindings created |
| `channel_opens_total` | - | Channel opens |
| `channel_closes_total` | `reason` | Channel closes |
| `connection_recoveries_total` | - | Connection recoveries |
| `queue_purges_total` | `queue` | Queue purges |
| `exchange_declarations_total` | `type` | Exchange declarations |
| `dlq_messages_added_total` | `source_queue` | Dead letter queue additions |
| `dlq_messages_processed_total` | - | DLQ messages processed |
| `queue_overflow_events_total` | `queue` | Queue overflow events |
| `message_expirations_total` | `queue` | Message expiration events |
| `message_priority_upgrades_total` | - | Message priority upgrades |
| `queue_consumer_restarts_total` | `queue` | Queue consumer restarts |
| `message_deduplications_total` | - | Message deduplication events |
| `message_batching_events_total` | - | Message batching events |
| `queue_failover_events_total` | - | Queue failover events |
| `message_compression_events_total` | - | Message compression events |

### Performance Counters (5 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `cache_hits_total` | `cache_name` | Cache hits |
| `cache_misses_total` | `cache_name` | Cache misses |
| `cache_evictions_total` | `cache_name` | Cache evictions |
| `connection_pool_timeouts_total` | `pool` | Connection pool timeouts |
| `gc_events_total` | `gc_type` | Garbage collection events |

### Database Counters (15 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `database_deadlocks_total` | - | Database deadlocks |
| `database_commits_total` | - | Transaction commits |
| `database_rollbacks_total` | - | Transaction rollbacks |
| `database_checkpoints_total` | - | Checkpoint completions |
| `database_seq_scans_total` | `table` | Table sequential scans |
| `database_query_errors_total` | `error_type` | Query errors by type |
| `database_connection_errors_total` | `error_type` | Connection errors |
| `database_slow_queries_total` | `query_type` | Slow queries |
| `database_prepared_statements_total` | - | Prepared statement executions |
| `database_index_scans_total` | `table` | Index scans |
| `database_full_table_scans_total` | `table` | Full table scans |
| `database_constraint_violations_total` | `constraint` | Constraint violations |
| `database_migrations_total` | `status` | Migration executions |
| `database_vacuum_operations_total` | - | Vacuum operations |
| `database_analyze_operations_total` | - | Analyze operations |

### HTTP Client Counters (5 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `http_client_retries_total` | `service` | HTTP client retry attempts |
| `http_client_timeouts_total` | `service` | HTTP client timeouts |
| `http_connection_reuse_total` | - | HTTP connection reuse |
| `http_dns_lookups_total` | - | HTTP DNS lookups |
| `http_tls_handshakes_total` | - | HTTP TLS handshakes |

### API Performance Counters (10 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `api_errors_total` | `endpoint`, `error_code` | API errors by endpoint |
| `api_requests_by_status_range_total` | `range` | Requests by status range (2xx, 4xx, 5xx) |
| `api_slow_requests_total` | `endpoint` | Slow requests exceeding threshold |
| `api_timeouts_total` | `endpoint` | API request timeouts |
| `api_validation_errors_total` | `endpoint` | Validation errors |
| `api_payload_errors_total` | `endpoint` | Payload parsing errors |
| `api_circuit_breaker_trips_total` | `service` | Circuit breaker trips |
| `api_client_retries_total` | `client` | Client retries |
| `api_cors_rejections_total` | - | CORS rejections |
| `api_content_negotiation_failures_total` | - | Content negotiation failures |

### Scheduler Counters (15 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `scheduler_jobs_scheduled_total` | `job_type` | Jobs scheduled |
| `scheduler_jobs_executed_total` | `job_type` | Jobs executed |
| `scheduler_job_failures_total` | `job_type`, `reason` | Job failures |
| `scheduler_jobs_skipped_total` | `job_type` | Jobs skipped (overlap) |
| `scheduler_job_cancellations_total` | `job_type` | Job cancellations |
| `scheduler_job_timeouts_total` | `job_type` | Job timeouts |
| `scheduler_recovery_events_total` | - | Recovery events |
| `scheduler_missed_executions_total` | `job_type` | Missed executions |
| `scheduler_job_retries_total` | `job_type` | Job retries |
| `scheduler_cron_parse_errors_total` | - | Cron parse errors |
| `birthday_scan_completions_total` | - | Birthday scan completions |
| `birthday_scan_errors_total` | `error_type` | Birthday scan errors |
| `timezone_processing_completions_total` | `timezone` | Timezone processing completions |
| `scheduled_message_dispatches_total` | - | Scheduled message dispatches |
| `scheduler_health_checks_total` | `status` | Health check executions |

---

## Gauge Metrics

Gauges represent current values that can increase or decrease.

### Original Gauges (7 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `queue_depth` | `queue_name` | Current queue depth |
| `active_workers` | - | Number of active workers |
| `database_connections` | `state` | Database connections (active/idle) |
| `circuit_breaker_open` | `service` | Circuit breaker state (1=open, 0=closed) |
| `dlq_depth` | `queue_name` | Dead letter queue depth |
| `active_users` | - | Number of active users |
| `pending_messages` | `message_type` | Pending messages count |

### Business Gauges (20 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `birthdays_today` | - | Number of birthdays today |
| `birthdays_pending` | - | Pending birthdays to process |
| `user_timezone_distribution` | `timezone` | User timezone distribution |
| `peak_hour_messaging_load` | - | Peak hour messaging load |
| `active_message_templates` | - | Active message templates count |
| `users_by_tier` | `tier` | Users by subscription tier |
| `scheduled_jobs_count` | `job_type` | Scheduled jobs count |
| `failed_jobs_retry_queue` | - | Failed jobs in retry queue |
| `active_webhooks_count` | - | Active webhooks count |
| `notification_queue_backlog` | - | Notification queue backlog |
| `total_registered_users` | - | Total registered users |
| `users_by_timezone` | `timezone` | Users by timezone count |
| `messages_in_send_queue` | - | Messages in send queue |
| `average_message_delivery_time` | - | Average message delivery time |
| `daily_active_users` | - | Daily active users (DAU) |
| `weekly_active_users` | - | Weekly active users (WAU) |
| `monthly_active_users` | - | Monthly active users (MAU) |
| `message_delivery_success_rate` | - | Message delivery success rate |
| `user_engagement_score` | - | User engagement score |
| `platform_health_score` | - | Platform health score (0-100) |

### Performance Gauges (10 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `cache_hit_rate` | `cache_name` | Cache hit rate percentage |
| `connection_pool_wait_time` | `pool` | Connection pool wait time |
| `batch_processing_size` | - | Current batch processing size |
| `event_loop_utilization` | - | Event loop utilization percentage |
| `compression_ratio` | - | Memory compression ratio |
| `payload_size_bytes` | - | Current payload size in bytes |
| `node_active_handles` | - | Node.js active handles count |
| `node_active_requests` | - | Node.js active requests count |
| `node_event_loop_lag` | - | Node.js event loop lag |
| `memory_pool_utilization` | `pool` | Memory pool utilization |

### Queue Gauges (20 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `message_age_seconds` | `queue` | Message age in seconds |
| `consumer_count` | `queue` | Active consumer count |
| `channel_count` | - | Active channel count |
| `exchange_bindings_count` | `exchange` | Exchange bindings count |
| `prefetch_count` | - | Prefetch count setting |
| `ack_rate` | `queue` | Message ack rate |
| `nack_rate` | `queue` | Message nack rate |
| `redelivery_rate` | `queue` | Redelivery rate |
| `queue_memory_usage` | `queue` | Queue memory usage |
| `unacked_messages_count` | `queue` | Unacked messages count |
| `queue_messages_ready` | `queue` | Queue messages ready |
| `queue_messages_unacked` | `queue` | Queue messages unacked |
| `queue_publish_rate` | - | Queue message publish rate |
| `queue_delivery_rate` | - | Queue message delivery rate |
| `queue_consumer_utilization` | `queue` | Queue consumer utilization |
| `dlq_oldest_message_age` | `queue` | DLQ oldest message age |
| `queue_connection_count` | - | Queue connection count |
| `queue_message_size_average` | `queue` | Queue message size average |
| `queue_high_watermark` | `queue` | Queue high watermark |
| `queue_redelivery_backoff` | `queue` | Queue redelivery backoff |

### Database Gauges (20 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `index_hit_ratio` | - | Index hit ratio |
| `buffer_cache_hit_ratio` | - | Buffer cache hit ratio |
| `replication_lag` | - | Database replication lag |
| `active_transactions` | - | Active database transactions |
| `lock_wait_count` | - | Database lock wait count |
| `database_table_size` | `table` | Database table size |
| `database_index_size` | `index` | Database index size |
| `database_row_estimates` | `table` | Database row estimates |
| `database_connection_age` | - | Database connection age |
| `database_query_queue_length` | - | Database query queue length |
| `database_pool_size` | - | Connection pool size |
| `database_pool_idle_connections` | - | Pool idle connections |
| `database_pool_waiting_requests` | - | Pool waiting requests |
| `database_query_execution_queue` | - | Query execution queue size |
| `database_connection_latency` | - | Connection latency |
| `database_transactions_in_progress` | - | Transactions in progress |
| `database_replication_slots_active` | - | Active replication slots |
| `database_wal_size` | - | WAL size |
| `database_cache_size` | - | Cache size |
| `database_temp_files_size` | - | Temp files size |

### System Gauges (10 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `process_open_file_descriptors` | - | Process open file descriptors |
| `process_max_file_descriptors` | - | Process max file descriptors |
| `process_start_time` | - | Process start time |
| `process_uptime_seconds` | - | Process uptime seconds |
| `v8_heap_space_size` | `space` | V8 heap space size |
| `v8_heap_statistics` | `stat` | V8 heap statistics |
| `v8_external_memory` | - | V8 external memory |
| `system_load_average` | `period` | System load average |
| `system_free_memory` | - | System free memory |
| `system_total_memory` | - | System total memory |

### API Performance Gauges (10 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `api_active_requests` | - | Current active API requests |
| `api_request_queue_length` | - | API request queue length |
| `api_average_response_time` | `endpoint` | Average response time (rolling) |
| `api_error_rate` | - | API error rate percentage |
| `api_requests_per_second` | - | API requests per second |
| `api_payload_size_average` | - | API payload size average |
| `api_connection_pool_utilization` | - | Connection pool utilization |
| `api_rate_limit_remaining` | `endpoint` | Rate limit remaining |
| `api_circuit_breaker_state` | `service` | Circuit breaker state (0/0.5/1) |
| `api_health_score` | - | API health score (0-100) |

### Scheduler Gauges (15 metrics)

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `scheduler_next_execution_time` | `job_type` | Next execution timestamp |
| `scheduler_job_lag` | `job_type` | Job lag (seconds behind) |
| `scheduler_active_jobs` | - | Active scheduled jobs |
| `scheduler_pending_jobs` | - | Pending scheduled jobs |
| `scheduler_running_jobs` | - | Running scheduled jobs |
| `scheduler_thread_pool_size` | - | Thread pool size |
| `scheduler_thread_pool_active` | - | Thread pool active |
| `scheduler_lock_status` | `job_type` | Lock status |
| `birthdays_remaining_today` | - | Birthdays remaining today |
| `scheduler_backlog_size` | - | Scheduler backlog size |
| `scheduler_current_timezone_offset` | - | Current timezone being processed |
| `scheduler_last_successful_run` | `job_type` | Last successful run timestamp |
| `scheduler_consecutive_failures` | `job_type` | Consecutive failures |
| `scheduler_execution_window_remaining` | - | Execution window remaining |
| `scheduler_resource_utilization` | - | Resource utilization |

---

## Histogram Metrics

Histograms track value distributions across configurable buckets.

### Original Histograms (6 metrics)

| Metric Name | Buckets | Description |
|-------------|---------|-------------|
| `message_delivery_duration_seconds` | 0.01, 0.05, 0.1, 0.5, 1, 5, 10 | Message delivery duration |
| `api_response_time_seconds` | 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5 | API response time |
| `scheduler_execution_duration_seconds` | 0.1, 0.5, 1, 5, 10, 30, 60 | Scheduler execution duration |
| `external_api_latency_seconds` | 0.01, 0.05, 0.1, 0.5, 1, 5, 10 | External API latency |
| `database_query_duration_seconds` | 0.001, 0.01, 0.05, 0.1, 0.5, 1 | Database query duration |
| `message_time_to_delivery_seconds` | 1, 5, 10, 60, 300, 900, 3600 | Time from schedule to delivery |

### Performance Histograms (5 metrics)

| Metric Name | Buckets | Description |
|-------------|---------|-------------|
| `batch_processing_duration_seconds` | 0.1, 0.5, 1, 5, 10, 30 | Batch processing duration |
| `gc_pause_time_seconds` | 0.001, 0.005, 0.01, 0.05, 0.1 | GC pause time |
| `connection_pool_acquisition_time_seconds` | 0.001, 0.01, 0.05, 0.1, 0.5 | Pool acquisition time |
| `cache_operation_duration_seconds` | 0.0001, 0.001, 0.01, 0.1 | Cache operation duration |
| `serialization_duration_seconds` | 0.0001, 0.001, 0.01, 0.1 | Serialization duration |

### Queue Histograms (5 metrics)

| Metric Name | Buckets | Description |
|-------------|---------|-------------|
| `message_publish_duration_seconds` | 0.001, 0.01, 0.05, 0.1, 0.5 | Message publish duration |
| `message_consume_duration_seconds` | 0.01, 0.05, 0.1, 0.5, 1, 5 | Message consume duration |
| `queue_wait_time_seconds` | 0.1, 1, 5, 10, 30, 60 | Queue wait time |
| `channel_operation_duration_seconds` | 0.001, 0.01, 0.05, 0.1 | Channel operation duration |
| `message_processing_latency_seconds` | 0.01, 0.05, 0.1, 0.5, 1, 5 | Message processing latency |

### Database Histograms (5 metrics)

| Metric Name | Buckets | Description |
|-------------|---------|-------------|
| `transaction_duration_seconds` | 0.01, 0.05, 0.1, 0.5, 1, 5 | Transaction duration |
| `lock_wait_time_seconds` | 0.01, 0.1, 1, 5, 10 | Lock wait time |
| `checkpoint_duration_seconds` | 0.1, 1, 5, 10, 30 | Checkpoint duration |
| `connection_establishment_time_seconds` | 0.01, 0.05, 0.1, 0.5, 1 | Connection establishment time |
| `query_planning_time_seconds` | 0.001, 0.01, 0.05, 0.1 | Query planning time |

### HTTP Client Histograms (5 metrics)

| Metric Name | Buckets | Description |
|-------------|---------|-------------|
| `http_request_duration_seconds` | 0.01, 0.05, 0.1, 0.5, 1, 5, 10 | HTTP request duration |
| `dns_lookup_duration_seconds` | 0.001, 0.01, 0.05, 0.1 | DNS lookup duration |
| `tcp_connection_duration_seconds` | 0.01, 0.05, 0.1, 0.5 | TCP connection duration |
| `tls_handshake_duration_seconds` | 0.01, 0.05, 0.1, 0.5 | TLS handshake duration |
| `http_first_byte_duration_seconds` | 0.01, 0.05, 0.1, 0.5, 1 | Time to first byte |

### API Performance Histograms (5 metrics)

| Metric Name | Buckets | Description |
|-------------|---------|-------------|
| `api_request_size_bytes` | 100, 1K, 10K, 100K, 1M | API request size |
| `api_response_size_bytes` | 100, 1K, 10K, 100K, 1M | API response size |
| `api_request_body_parsing_seconds` | 0.0001, 0.001, 0.01, 0.1 | Body parsing time |
| `api_response_serialization_seconds` | 0.0001, 0.001, 0.01, 0.1 | Response serialization time |
| `api_middleware_duration_seconds` | 0.0001, 0.001, 0.01, 0.1 | Middleware duration |

### Scheduler Histograms (5 metrics)

| Metric Name | Buckets | Description |
|-------------|---------|-------------|
| `birthday_scan_duration_seconds` | 1, 5, 10, 30, 60, 300 | Birthday scan duration |
| `timezone_processing_duration_seconds` | 0.1, 0.5, 1, 5, 10 | Timezone processing duration |
| `scheduler_lock_acquisition_seconds` | 0.01, 0.1, 1, 5, 10 | Lock acquisition time |
| `scheduler_job_queue_time_seconds` | 0.1, 1, 5, 10, 30, 60 | Job queue time |
| `scheduler_recovery_duration_seconds` | 0.1, 1, 5, 10, 30 | Recovery duration |

### Business Histograms (5 metrics)

| Metric Name | Buckets | Description |
|-------------|---------|-------------|
| `user_registration_duration_seconds` | 0.1, 0.25, 0.5, 1, 2, 5, 10, 30 | User registration duration |
| `message_personalization_duration_seconds` | 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5 | Message personalization duration |
| `bulk_operation_duration_seconds` | 0.5, 1, 2, 5, 10, 30, 60, 120, 300 | Bulk operation duration |
| `user_data_export_duration_seconds` | 1, 2, 5, 10, 30, 60, 120, 300, 600 | User data export duration |
| `template_rendering_duration_seconds` | 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25 | Template rendering duration |

---

## Summary Metrics

Summaries provide quantile-based distributions (p50, p90, p99).

### Original Summary Metrics (10 metrics)

| Metric Name | Quantiles | Description |
|-------------|-----------|-------------|
| `api_response_time_summary` | 0.5, 0.9, 0.95, 0.99 | API response time percentiles |
| `message_processing_time_summary` | 0.5, 0.9, 0.95, 0.99 | Message processing percentiles |
| `database_query_time_summary` | 0.5, 0.9, 0.95, 0.99 | Database query percentiles |
| `scheduler_execution_summary` | 0.5, 0.9, 0.95, 0.99 | Scheduler execution percentiles |
| `queue_latency_summary` | 0.5, 0.9, 0.95, 0.99 | Queue latency percentiles |
| `external_api_summary` | 0.5, 0.9, 0.95, 0.99 | External API percentiles |
| `batch_processing_summary` | 0.5, 0.9, 0.95, 0.99 | Batch processing percentiles |
| `connection_time_summary` | 0.5, 0.9, 0.95, 0.99 | Connection time percentiles |
| `gc_pause_summary` | 0.5, 0.9, 0.95, 0.99 | GC pause percentiles |
| `event_loop_lag_summary` | 0.5, 0.9, 0.95, 0.99 | Event loop lag percentiles |

### Extended Summary Metrics (5 new metrics)

| Metric Name | Quantiles | Description |
|-------------|-----------|-------------|
| `scheduler_execution_quantiles` | 0.5, 0.9, 0.95, 0.99 | Scheduler execution time quantiles |
| `message_queue_latency_quantiles` | 0.5, 0.9, 0.95, 0.99 | Message queue latency quantiles |
| `database_connection_quantiles` | 0.5, 0.9, 0.95, 0.99 | Database connection acquisition time quantiles |
| `business_operation_quantiles` | 0.5, 0.9, 0.95, 0.99 | Business operation duration quantiles |
| `end_to_end_delivery_quantiles` | 0.5, 0.9, 0.95, 0.99 | End-to-end message delivery time quantiles |

---

## Queue Metrics Deep-Dive

### RabbitMQ Queue Instrumentation

The queue metrics system provides comprehensive monitoring of RabbitMQ operations through the `QueueMetricsInstrumentation` class.

#### Architecture

```
+-------------------+     +------------------------+     +------------------+
| MessagePublisher  |---->| QueueMetricsInstrument |---->| MetricsService   |
+-------------------+     +------------------------+     +------------------+
        |                          |                            |
        v                          v                            v
+-------------------+     +------------------------+     +------------------+
| MessageConsumer   |---->| Event Handlers         |---->| Prometheus       |
+-------------------+     +------------------------+     +------------------+
```

#### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `queueDepthInterval` | 30000ms | Queue depth monitoring interval |
| `trackConsumerCount` | true | Enable consumer count tracking |
| `trackConnectionStatus` | true | Enable connection status monitoring |
| `trackMessageDetails` | true | Enable detailed message tracking |

#### Key Queue Metrics Explained

| Metric | Type | What It Measures | When to Investigate |
|--------|------|------------------|---------------------|
| `queue_depth` | Gauge | Messages waiting in queue | Sustained > 1000 |
| `message_age_seconds` | Gauge | Age of oldest message | > 5 minutes |
| `consumer_count` | Gauge | Active consumers | < 2 or drops suddenly |
| `ack_rate` | Gauge | Message acknowledgment rate | Declining trend |
| `nack_rate` | Gauge | Negative acknowledgment rate | > 1% of ack rate |
| `redelivery_rate` | Gauge | Message redelivery rate | > 5% of deliveries |
| `dlq_depth` | Gauge | Dead letter queue depth | Any increase |
| `unacked_messages_count` | Gauge | Unacknowledged messages | Sustained > prefetch |

#### Message Lifecycle Metrics

```
[Publish] --> message_publish_duration_seconds
    |
    v
[Queue] --> queue_wait_time_seconds, message_age_seconds
    |
    v
[Consume] --> message_consume_duration_seconds
    |
    +--[Success]--> message_acks_total
    |
    +--[Retry]--> message_nacks_total, message_redeliveries_total
    |
    +--[Fail]--> dlq_messages_added_total
```

#### Queue Health Indicators

| State | Metrics Pattern | Meaning |
|-------|-----------------|---------|
| **Healthy** | `queue_depth` stable, `ack_rate` > `publish_rate` | Processing keeping up |
| **Backing up** | `queue_depth` increasing, `ack_rate` < `publish_rate` | Need more consumers |
| **Consumer issues** | `nack_rate` high, `redelivery_rate` high | Processing failures |
| **Degraded** | `dlq_depth` increasing | Persistent failures |
| **Critical** | `consumer_count` = 0, `queue_depth` growing | Consumer failure |

#### Publisher Confirm Tracking

```promql
# Publisher confirm success rate
sum(rate(birthday_scheduler_publisher_confirms_total{status="success"}[5m]))
/
sum(rate(birthday_scheduler_publisher_confirms_total[5m]))
```

#### Consumer Health Metrics

```promql
# Consumer utilization
birthday_scheduler_queue_consumer_utilization{queue="birthday_messages"}

# Redelivery ratio (should be < 5%)
rate(birthday_scheduler_message_redeliveries_total[5m])
/
rate(birthday_scheduler_message_acks_total[5m])
```

---

## Alerting Rules

### Critical Alerts (P0) - Immediate Action Required

| Alert | Condition | Duration | Description | Runbook |
|-------|-----------|----------|-------------|---------|
| **ServiceDown** | `up{job="birthday-scheduler"} == 0` | 1m | Service not responding to health checks | Check pod status, logs |
| **HighErrorRate** | Error rate > 5% | 2m | Significant request failures | Check dependencies, review errors |
| **DatabaseConnectionPoolExhausted** | Available connections = 0 | 30s | All DB connections in use | Increase pool, check leaks |
| **QueueDepthCritical** | `queue_depth > 10000` | 2m | Severe message backlog | Scale workers, check consumers |
| **CircuitBreakerOpen** | `circuit_breaker_state == 1` | 1m | External service protection triggered | Check dependency health |
| **DLQDepthHigh** | `dlq_depth > 100` | 5m | Failed messages accumulating | Investigate failures, manual retry |
| **HTTP5xxSpike** | > 100 5xx errors in 5m | 1m | Sudden server error increase | Check logs, recent deploys |
| **OutOfMemoryRisk** | Memory > 95% | 1m | OOM kill imminent | Scale up, restart pods |
| **MessageDeliveryFailureCritical** | Failure rate > 10% | 2m | Users not receiving notifications | Check email service |
| **DatabaseReplicationLagCritical** | Lag > 30s | 2m | Stale data risk | Check replica health |

### Warning Alerts (P1) - Action Required Within Hours

| Alert | Condition | Duration | Description | Runbook |
|-------|-----------|----------|-------------|---------|
| **HighLatency** | P99 > 5s | 5m | User experience degradation | Optimize slow endpoints |
| **MemoryUsageHigh** | Memory > 85% | 10m | Approaching memory limits | Investigate leaks, scale |
| **CPUUsageHigh** | CPU > 80% | 10m | Processing capacity limited | Optimize or scale |
| **QueueDepthWarning** | `queue_depth > 1000` | 10m | Message backlog building | Add consumers |
| **RetryRateHigh** | Retry rate > 10% | 10m | Transient failures elevated | Check dependencies |
| **SlowDatabaseQueries** | P95 > 1s | 5m | Database performance degraded | Add indexes, optimize |
| **DatabaseConnectionPoolLow** | Available < 20% | 5m | Pool exhaustion approaching | Increase pool size |
| **DiskUsageHigh** | Disk > 80% | 15m | Storage running low | Cleanup, expand |
| **RequestRateAnomalyHigh** | Rate > 2x baseline | 10m | Unusual traffic spike | Investigate source |
| **CacheHitRateLow** | Hit rate < 80% | 15m | Increased database load | Review cache strategy |
| **ExternalAPISlowResponse** | P95 > 2s | 5m | Dependency slow | Consider caching |

### SLO Alerts

| Alert | Condition | Duration | Description | Runbook |
|-------|-----------|----------|-------------|---------|
| **MessageDeliveryRateLow** | Delivery rate < 99% | 15m | Below delivery SLO | Check email provider |
| **APIAvailabilityLow** | Availability < 99.9% | 15m | Below availability SLO | Prioritize error fixes |
| **ErrorBudgetExhausted** | Budget > 100% consumed | 5m | Monthly error budget depleted | Freeze non-critical changes |
| **ErrorBudgetBurnRateHigh** | Burn rate > 14.4x | 5m | Budget exhausted in < 2 hours | Immediate investigation |
| **LatencySLOViolation** | P99 > 2s | 10m | Latency target missed | Performance optimization |
| **ThroughputSLOViolation** | Processing < 100/s | 15m | Capacity below target | Scale workers |
| **SchedulerAccuracySLOViolation** | On-time < 95% | 30m | Scheduling delays | Check scheduler health |

### Informational Alerts (P2) - Awareness

| Alert | Condition | Duration | Description | Runbook |
|-------|-----------|----------|-------------|---------|
| **HighRequestRate** | Rate > 1.5x 7d avg | 30m | Elevated traffic | Monitor capacity |
| **NewSecurityEvent** | Security event detected | 0m | Security activity | Review logs |
| **RateLimitTriggered** | > 10 limited requests | 5m | Rate limiting active | Check client behavior |
| **AuthFailureSpike** | Failures > 3x baseline | 10m | Auth anomaly | Security review |
| **WorkerScalingNeeded** | Workers > 90% utilized | 15m | Workers at capacity | Plan scaling |
| **CertificateExpiryWarning** | Expiry < 7 days | 1h | Certificate renewal needed | Renew certificate |
| **NewVersionDeployed** | Build info changed | 0m | Deployment detected | Monitor for regressions |
| **BirthdayMessageVolumeSpike** | Volume > 2x normal | 15m | High birthday volume | Monitor capacity |

### Alert Configuration Details

#### Alert File Structure

The alert rules are defined in `/grafana/alerts/alert-rules.yaml` with the following structure:

```yaml
groups:
  - name: critical_alerts
    interval: 30s
    rules:
      - alert: AlertName
        expr: PromQL expression
        for: duration
        labels:
          severity: critical|warning|info
          component: api|database|queue|etc
        annotations:
          summary: Brief description
          description: Detailed description with templating
          runbook: Link to runbook documentation
```

#### Notification Configuration

Alerts are routed based on severity:

```yaml
alerting:
  contactpoints:
    - name: pagerduty-critical
      type: pagerduty
      settings:
        integrationKey: "${PAGERDUTY_KEY}"
        severity: critical

    - name: email-team
      type: email
      settings:
        addresses: "team@example.com"

  notification_policies:
    - match:
        severity: critical
      receiver: pagerduty-critical
      continue: true

    - match:
        severity: warning|info
      receiver: email-team
```

#### Alert Severity Levels

| Severity | Response Time | Notification | Example |
|----------|--------------|--------------|---------|
| **Critical** | Immediate (< 5 min) | PagerDuty + Email | Service down, high error rate |
| **Warning** | Within business hours | Email only | High latency, elevated errors |
| **Info** | Awareness only | Email only | Traffic spike, new deployment |

#### Adding New Alerts

When adding new alerts to `/grafana/alerts/alert-rules.yaml`:

1. **Choose appropriate severity**:
   - Critical: Service impact, user-facing issues
   - Warning: Potential issues, performance degradation
   - Info: Informational, trend awareness

2. **Set appropriate thresholds**:
   - Base on SLO requirements
   - Consider false positive rate
   - Test with historical data

3. **Include clear annotations**:
   - Summary: One-line description
   - Description: Include current value with `{{ $value }}`
   - Runbook: Link to response procedures

4. **Test alert expression**:
   ```bash
   # Test in Prometheus UI
   # Navigate to /graph
   # Enter PromQL expression
   # Verify it returns expected results
   ```

5. **Document response procedure**:
   - Add to runbook documentation
   - Include troubleshooting steps
   - List required permissions/access

#### Alert Best Practices

**Good Alert Characteristics:**
- Actionable: Clear action required
- Scoped: Specific component/service
- Calibrated: Threshold based on data
- Documented: Runbook exists
- Tested: Verified with test alerts

**Poor Alert Characteristics:**
- Noisy: Frequent false positives
- Vague: No clear action
- Too sensitive: Triggers too easily
- Undocumented: No runbook
- Untested: Never verified

**Example Good Alert:**
```yaml
- alert: QueueDepthCritical
  expr: rabbitmq_queue_messages{queue="birthday_messages"} > 5000
  for: 5m
  labels:
    severity: critical
    component: queue
  annotations:
    summary: "Message queue depth is critically high"
    description: "Queue depth is {{ $value }} messages (threshold: 5000)"
    runbook: "https://docs.example.com/runbooks/queue-overflow"
```

**Example Poor Alert:**
```yaml
# ❌ Too vague, no threshold, no runbook
- alert: SomethingWrong
  expr: some_metric > 0
  labels:
    severity: critical
  annotations:
    summary: "Something is wrong"
```

#### Alert Tuning

If an alert is too noisy or not firing when it should:

1. **Adjust threshold**: Based on historical data
2. **Adjust duration**: Reduce false positives
3. **Add context**: More specific labels
4. **Split alert**: Separate critical from warning

Example tuning progression:
```yaml
# Initial (too noisy - fires every 30s)
expr: error_rate > 0.01
for: 30s

# Adjusted threshold (still noisy)
expr: error_rate > 0.05
for: 30s

# Adjusted duration (better)
expr: error_rate > 0.05
for: 5m

# Final (good balance)
expr: error_rate > 0.10
for: 5m
labels:
  severity: warning  # Reduced from critical
```

#### Alert Testing

Before deploying new alerts:

```bash
# 1. Test PromQL in Prometheus UI
# Navigate to Prometheus → Graph
# Enter your expression
# Verify it returns expected time series

# 2. Trigger test alert
# Temporarily lower threshold
# Create condition that triggers alert
# Verify notification arrives

# 3. Verify alert routing
# Check AlertManager UI
# Confirm alert appears
# Verify correct receiver gets notification

# 4. Test resolution
# Fix condition
# Verify alert auto-resolves
# Confirm resolution notification
```

---

## Troubleshooting Decision Trees

### High Latency Investigation

```
High API Latency Detected
         |
         v
+------------------+
| Check DB Latency |
+------------------+
         |
    +----+----+
    |         |
   High      Normal
    |         |
    v         v
+--------+  +------------------+
| DB     |  | Check Queue      |
| Issues |  | Processing Time  |
+--------+  +------------------+
    |              |
    v         +----+----+
- Index      |         |
  missing   High     Normal
- Slow       |         |
  queries    v         v
- Lock    +--------+  +----------------+
  waits   | Queue  |  | Check External |
          | Issues |  | API Latency    |
          +--------+  +----------------+
              |              |
              v         +----+----+
          - Scale      |         |
            consumers High     Normal
          - Check      |         |
            prefetch   v         v
                   +--------+  +--------+
                   | Depend |  | Code   |
                   | Issue  |  | Issue  |
                   +--------+  +--------+
```

### High Error Rate Investigation

```
Error Rate > 5%
      |
      v
+---------------------+
| Check Error Types   |
+---------------------+
      |
  +---+---+---+
  |   |   |   |
  v   v   v   v
4xx 5xx DB  Ext
  |   |   |   |
  v   v   v   v
Client Server DB  Dependency
Errors Errors Down Issue
  |     |     |     |
  v     v     v     v
Check  Check Check Check
Rate   Logs  Pool  Circuit
Limit  OOM   Conn  Breaker
```

### Queue Backup Investigation

```
Queue Depth > 1000
        |
        v
+-------------------+
| Check Consumer    |
| Count             |
+-------------------+
        |
   +----+----+
   |         |
   0       > 0
   |         |
   v         v
Consumer  Check Processing
Failure   Time per Message
   |              |
   v         +----+----+
Restart    |         |
Consumer  High     Normal
   |       |         |
   v       v         v
Check    Scale    Check
Logs     Workers  Publish
         |        Rate
         v         |
      +------+     v
      | Add  |  Traffic
      | More |  Spike?
      | Pods |     |
      +------+     v
              Rate Limit
              or Scale
```

### DLQ Growth Investigation

```
DLQ Depth Increasing
         |
         v
+---------------------+
| Sample DLQ Messages |
+---------------------+
         |
    +----+----+----+
    |    |    |    |
    v    v    v    v
Malformed Data Timeout Retry
Message   Issue Error  Exhausted
    |       |     |        |
    v       v     v        v
Fix     Check   Increase Fix
Schema  Source  Timeout  Root
        Data    Config   Cause
```

### Memory Growth Investigation

```
Memory Usage > 85%
        |
        v
+-------------------+
| Check Memory Type |
+-------------------+
        |
   +----+----+
   |         |
 Heap     External
   |         |
   v         v
+--------+ +------------+
| Check  | | Check      |
| GC     | | Buffer     |
| Events | | Allocations|
+--------+ +------------+
   |              |
   v              v
Frequent?    Large Payloads?
   |              |
   v              v
Memory       Implement
Leak?        Streaming
   |
   v
Profile with
--inspect
```

---

## Grafana Query Examples

### API Performance Queries

```promql
# Request rate (requests per second)
sum(rate(birthday_scheduler_api_requests_total[5m]))

# Error rate percentage
100 * sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m]))
    / sum(rate(birthday_scheduler_api_requests_total[5m]))

# P95 latency by endpoint
histogram_quantile(0.95,
  sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le, path)
)

# P99 latency overall
histogram_quantile(0.99,
  sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le)
)

# Request rate by endpoint
sum(rate(birthday_scheduler_api_requests_total[5m])) by (path)

# Slow request count
sum(increase(birthday_scheduler_api_slow_requests_total[1h])) by (endpoint)
```

### Queue Performance Queries

```promql
# Queue depth over time
birthday_scheduler_queue_depth{queue_name="birthday_messages"}

# Message processing rate
sum(rate(birthday_scheduler_message_acks_total[5m]))

# Consumer utilization
birthday_scheduler_queue_consumer_utilization{queue="birthday_messages"}

# Average message age
avg(birthday_scheduler_message_age_seconds)

# DLQ growth rate
rate(birthday_scheduler_dlq_messages_added_total[1h])

# Redelivery ratio
rate(birthday_scheduler_message_redeliveries_total[5m])
  / rate(birthday_scheduler_message_acks_total[5m])

# Publisher confirm success rate
sum(rate(birthday_scheduler_publisher_confirms_total{status="success"}[5m]))
  / sum(rate(birthday_scheduler_publisher_confirms_total[5m]))

# Queue wait time P95
histogram_quantile(0.95,
  sum(rate(birthday_scheduler_queue_wait_time_seconds_bucket[5m])) by (le)
)
```

### Database Performance Queries

```promql
# Active connections
birthday_scheduler_database_connections{state="active"}

# Connection pool utilization
(birthday_scheduler_database_pool_size - birthday_scheduler_database_pool_idle_connections)
  / birthday_scheduler_database_pool_size * 100

# Query duration P95
histogram_quantile(0.95,
  sum(rate(birthday_scheduler_database_query_duration_seconds_bucket[5m])) by (le)
)

# Slow query count
sum(increase(birthday_scheduler_database_slow_queries_total[1h]))

# Transaction rate
sum(rate(birthday_scheduler_database_commits_total[5m]))

# Index hit ratio
birthday_scheduler_index_hit_ratio

# Replication lag
birthday_scheduler_replication_lag
```

### Business Metrics Queries

```promql
# Messages sent per hour
sum(increase(birthday_scheduler_messages_sent_total[1h]))

# Message delivery success rate
sum(rate(birthday_scheduler_messages_sent_total{status_code="200"}[1h]))
  / sum(rate(birthday_scheduler_messages_scheduled_total[1h])) * 100

# Birthdays processed today
sum(birthday_scheduler_birthdays_processed_total{status="success"})

# Active users (DAU/WAU/MAU)
birthday_scheduler_daily_active_users
birthday_scheduler_weekly_active_users
birthday_scheduler_monthly_active_users

# User growth rate
increase(birthday_scheduler_user_creations_total[24h])
  - increase(birthday_scheduler_user_deletions_total[24h])

# Message template popularity
topk(5, sum(rate(birthday_scheduler_message_template_usage_total[24h])) by (template_name))
```

### System Health Queries

```promql
# Memory usage percentage
(birthday_scheduler_memory_used_bytes / birthday_scheduler_memory_limit_bytes) * 100

# CPU usage
rate(birthday_scheduler_cpu_seconds_total[5m])

# Event loop lag
birthday_scheduler_node_event_loop_lag

# GC pause time P99
histogram_quantile(0.99,
  sum(rate(birthday_scheduler_gc_pause_time_seconds_bucket[5m])) by (le)
)

# Open file descriptors utilization
birthday_scheduler_process_open_file_descriptors
  / birthday_scheduler_process_max_file_descriptors * 100

# Cache hit rate
sum(rate(birthday_scheduler_cache_hits_total[5m]))
  / (sum(rate(birthday_scheduler_cache_hits_total[5m]))
     + sum(rate(birthday_scheduler_cache_misses_total[5m]))) * 100
```

### SLO Tracking Queries

```promql
# API availability (30 day)
sum(increase(birthday_scheduler_api_requests_total{status!~"5.."}[30d]))
  / sum(increase(birthday_scheduler_api_requests_total[30d])) * 100

# Error budget consumed (percentage of 0.1% budget)
(1 - (
  sum(increase(birthday_scheduler_api_requests_total{status!~"5.."}[30d]))
  / sum(increase(birthday_scheduler_api_requests_total[30d]))
)) / 0.001 * 100

# Error budget burn rate (14.4 = will exhaust in 2h)
(1 - (
  sum(rate(birthday_scheduler_api_requests_total{status!~"5.."}[1h]))
  / sum(rate(birthday_scheduler_api_requests_total[1h]))
)) / (0.001 / 720)

# Message delivery SLO (99% target)
sum(rate(birthday_scheduler_messages_delivered_total[1h]))
  / sum(rate(birthday_scheduler_messages_sent_total[1h])) * 100
```

### Alerting Condition Queries

```promql
# Circuit breaker status (returns services with open breakers)
birthday_scheduler_circuit_breaker_state == 1

# Workers at zero
birthday_scheduler_active_workers == 0

# Connection pool exhausted
birthday_scheduler_database_pool_idle_connections == 0

# Rate limiting active
increase(birthday_scheduler_rate_limit_hits_total[5m]) > 0
```

---

## Usage Examples

### Recording Metrics in Code

```typescript
import { metricsService } from '@/services/metrics.service';

// Increment counter
metricsService.messagesScheduledTotal.inc({ message_type: 'birthday' });

// Set gauge value
metricsService.queueDepth.set({ queue_name: 'messages' }, 42);

// Observe histogram value
metricsService.apiResponseTime.observe({ endpoint: '/api/users' }, 0.125);

// Start/end timer (histogram)
const end = metricsService.databaseQueryDuration.startTimer({ query_type: 'select' });
// ... execute query ...
end(); // Automatically records duration
```

### Queue Metrics Instrumentation

```typescript
import { queueMetricsInstrumentation } from '@/services/queue/queue-metrics';

// Initialize instrumentation
await queueMetricsInstrumentation.initialize();

// Instrument publishing
await queueMetricsInstrumentation.instrumentPublish(
  () => publisher.publish(message),
  'birthday-exchange',
  'birthday.send',
  messageId
);

// Instrument consumption
await queueMetricsInstrumentation.instrumentConsume(
  () => processMessage(msg),
  msg,
  'birthday_messages'
);

// Update queue depth manually
queueMetricsInstrumentation.updateQueueDepth('birthday_messages', 42);
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `METRICS_ENABLED` | `true` | Enable/disable metrics collection |
| `METRICS_PREFIX` | `birthday_scheduler_` | Metric name prefix |
| `METRICS_DEFAULT_LABELS` | `{}` | Default labels for all metrics |
| `METRICS_COLLECT_DEFAULT` | `true` | Collect Node.js default metrics |

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'happy-bday-app'
    scrape_interval: 15s
    static_configs:
      - targets: ['api:3000', 'worker:3001']
    metrics_path: /metrics
```

### Alert Manager Configuration

```yaml
# alertmanager.yml
route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
    - match:
        severity: warning
      receiver: 'slack-warnings'

receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: '<key>'
  - name: 'slack-warnings'
    slack_configs:
      - channel: '#alerts'
```

---

## Instrumentation Status

### Fully Instrumented

- API routes and middleware
- Message scheduling and delivery
- Queue operations (RabbitMQ)
- Worker health and processing
- Circuit breaker events
- Rate limiting
- Authentication events
- Connection management
- Publisher confirms and acknowledgments

### Partially Instrumented (Needs Enhancement)

- Database operations (query-level metrics need interceptor)
- Cache operations (hit/miss tracking)
- External HTTP client calls
- Batch processing details

### Not Yet Instrumented

- Individual query execution times (requires Drizzle interceptor)
- Per-table operation counts
- Connection pool wait times (requires driver hooks)

---

## Dashboard Integration

### Grafana Dashboard Setup

The application provides comprehensive Prometheus metrics that integrate seamlessly with Grafana for visualization and monitoring.

#### Dashboard JSON Location

- **Main Dashboard:** `grafana/dashboards/birthday-scheduler-main.json`
- **Performance Dashboard:** `grafana/dashboards/birthday-scheduler-performance.json`
- **Queue Dashboard:** `grafana/dashboards/birthday-scheduler-queue.json`
- **Business Metrics Dashboard:** `grafana/dashboards/birthday-scheduler-business.json`
- **Alert Status Dashboard:** `grafana/dashboards/birthday-scheduler-alerts.json`

#### Import Steps

1. Navigate to Grafana Home
2. Click "Create" → "Import"
3. Upload JSON file or paste URL
4. Select Prometheus data source
5. Click "Import"

#### Key Panels to Monitor

| Dashboard | Panels | Purpose |
|-----------|--------|---------|
| **Main** | Request Rate, Error Rate, P99 Latency, Active Requests | Overall system health |
| **Performance** | CPU Usage, Memory Usage, GC Events, Event Loop Lag | Resource utilization |
| **Queue** | Queue Depth, Consumer Count, Message Age, DLQ Growth | Queue health |
| **Business** | Messages Sent, Delivery Success Rate, Active Users, Birthdays Today | Business KPIs |
| **Alerts** | Active Alerts, Alert Trends, SLO Status, Error Budget | Alert status and trends |

#### Alert Thresholds (Default Configuration)

| Metric | Warning | Critical | Notes |
|--------|---------|----------|-------|
| Error Rate | > 1% | > 5% | Triggers when error rate exceeds thresholds |
| API Latency (P99) | > 1s | > 2s | Request latency percentile |
| Queue Depth | > 1000 | > 10000 | Message backlog accumulation |
| Memory Usage | > 85% | > 95% | Process memory consumption |
| CPU Usage | > 80% | > 90% | CPU utilization percentage |
| Message Delivery Rate | < 99% | < 95% | Delivery success percentage |
| Database Connections | > 80% | > 95% | Connection pool exhaustion |
| DLQ Depth | > 100 | > 1000 | Dead letter queue growth |
| Scheduler Lag | > 60s | > 300s | Job execution delay |
| Cache Hit Rate | < 80% | < 60% | Cache effectiveness |

#### Dashboard Variables (Templating)

For flexible dashboards, configure these Grafana template variables:

```yaml
- name: environment
  type: query
  datasource: Prometheus
  query: label_values(birthday_scheduler_api_requests_total, environment)

- name: job_type
  type: query
  datasource: Prometheus
  query: label_values(birthday_scheduler_scheduler_jobs_executed_total, job_type)

- name: queue_name
  type: query
  datasource: Prometheus
  query: label_values(birthday_scheduler_queue_depth, queue_name)

- name: service_name
  type: query
  datasource: Prometheus
  query: label_values(birthday_scheduler_external_api_calls_total, api_name)
```

#### Recommended Panel Configurations

**Request Rate Panel:**
```promql
sum(rate(birthday_scheduler_api_requests_total[5m])) by (path)
```

**Error Rate Panel:**
```promql
100 * sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m]))
    / sum(rate(birthday_scheduler_api_requests_total[5m]))
```

**Queue Depth Panel:**
```promql
birthday_scheduler_queue_depth{queue_name="$queue_name"}
```

**Message Delivery Success Rate:**
```promql
sum(rate(birthday_scheduler_messages_sent_total[1h]))
  / sum(rate(birthday_scheduler_messages_scheduled_total[1h])) * 100
```

---

## Cardinality Warnings

### Understanding High-Cardinality Labels

High-cardinality labels (labels with many unique values) can cause performance issues in Prometheus:

- **Memory usage increases** - Each unique label combination creates a separate time series
- **Query performance degrades** - Large numbers of series slow down queries
- **Scraped data grows** - Larger metrics payloads increase bandwidth and storage

#### Current Label Cardinality

| Metric | Label | Cardinality | Type | Notes |
|--------|-------|-------------|------|-------|
| `api_requests_total` | `path` | Medium | Endpoint paths | Finite, URL-based |
| `api_requests_total` | `method` | Very Low (4-7) | HTTP methods | GET, POST, PUT, DELETE, etc. |
| `messages_scheduled_total` | `message_type` | Low | Message types | Fixed set of types |
| `messages_scheduled_total` | `timezone` | Medium (300-400) | Timezone identifiers | Fixed IANA timezone list |
| `external_api_calls_total` | `api_name` | Low | Service names | Known external services |
| `queue_depth` | `queue_name` | Very Low (1-10) | Queue names | Fixed queue definitions |
| `database_connections` | `state` | Very Low (2-3) | Connection state | active, idle, waiting |

#### High-Cardinality Labels to Avoid

**Unsafe Labels** - DO NOT use these as label values:

```
- User IDs (billions of unique values)
- Message IDs (unbounded growth)
- Request IDs (unbounded growth)
- Email addresses (unbounded growth)
- IP addresses (high cardinality)
- Custom JSON in labels (arbitrary growth)
- Auto-incrementing IDs (unbounded growth)
```

**Example of Unsafe Code:**
```typescript
// WRONG - High cardinality!
metricsService.messagesScheduledTotal.inc({
  user_id: userId,  // Millions of unique values
  request_id: requestId,  // Unbounded growth
});

// CORRECT - Use low-cardinality labels
metricsService.messagesScheduledTotal.inc({
  message_type: 'birthday',  // Fixed set
  priority: 'high',  // Bounded values
});
```

#### Recommended Label Practices

1. **Keep label cardinality low**
   - Use at most 10-15 unique values per label
   - Exception: timezone label (~400 values) is acceptable for business reasons

2. **Use fixed, enumerated values**
   - Status codes: 200, 201, 400, 401, 403, 404, 500, 502, 503
   - Methods: GET, POST, PUT, DELETE, PATCH
   - Types: email, sms, push, webhook

3. **Aggregate before recording**
   ```typescript
   // Instead of recording user_id, record user_segment
   const segment = getUserSegment(user); // e.g., 'premium', 'free'
   metricsService.userActivityTotal.inc({ segment });
   ```

4. **Use metric name prefixes for variation**
   ```typescript
   // Instead of: metric.observe({variant: 'v1'|'v2'|'v3'})
   // Use separate metrics:
   metricsService.apiResponseTimeV1.observe(duration);
   metricsService.apiResponseTimeV2.observe(duration);
   ```

5. **Document all label values**
   - Maintain a label value reference in the metric definition
   - Example: Document all possible `message_type` values

#### Cardinality Monitoring

Monitor cardinality using these Prometheus queries:

```promql
# Total series count
count(count by (__name__) (up))

# Series count by metric
topk(20, count by (__name__) ({job="happy-bday-app"}))

# High-cardinality labels
topk(20, count by (__name__, job, __name__) (
  count by (__name__, job, le) ({job="happy-bday-app"})
))

# Cardinality explosion detection
# (daily increase > 10%)
rate(count(count by (__name__) (up))[1d] offset 1d) /
  count(count by (__name__) (up)) > 1.1
```

#### Cardinality Limits

Current configuration limits:

| Limit | Value | Reason |
|-------|-------|--------|
| Max label names per metric | 10 | Prevents metadata explosion |
| Max label value cardinality | 1000 | Prevents runaway growth |
| Max time series per scrape | 50000 | Prometheus storage protection |
| Max sample time series | 100000 | Prevents OOM |

If you encounter cardinality warnings:

1. Check recent metric additions
2. Review label values for unbounded cardinality
3. Consider removing or consolidating labels
4. Use metric relabeling to drop high-cardinality labels
5. Consider splitting into separate metrics

#### Prometheus Configuration for Cardinality

```yaml
# prometheus.yml
metric_relabel_configs:
  # Drop user_id labels (high cardinality)
  - source_labels: [__name__]
    regex: '.*_user_id'
    action: drop

  # Keep only essential labels
  - action: keep_labels
    regex: '__name__|job|instance|method|status|path'
```

---

## Adding New Metrics

### Step-by-Step Guide

Follow this process when adding new metrics to the application:

#### 1. Choose the Right Metric Type

| Metric Type | Use When | Example |
|-------------|----------|---------|
| **Counter** | Value only increases (or resets) | Total requests, total errors, total messages sent |
| **Gauge** | Value can go up or down | Current queue depth, active connections, memory usage |
| **Histogram** | You need distribution/percentiles with fixed buckets | Request latency, message size, processing duration |
| **Summary** | You need percentiles calculated on client side | Response time quantiles, processing time percentiles |

**Decision Tree:**
```
Does the value only increase? → Counter
Can the value increase or decrease? → Gauge
Do you need latency/duration percentiles? → Histogram (preferred) or Summary
Do you need to track sizes or counts with distribution? → Histogram
```

#### 2. Define the Metric in MetricsService

Add the metric declaration to `/src/services/metrics.service.ts`:

```typescript
// In the class property declarations section
export class MetricsService {
  // ... existing metrics ...

  // Add your metric property
  public readonly myNewMetric: Counter; // or Gauge, Histogram, Summary
}
```

#### 3. Initialize the Metric in Constructor

Add initialization in the constructor:

```typescript
constructor() {
  // ... existing initialization ...

  // Initialize your metric
  this.myNewMetric = new Counter({
    name: 'birthday_scheduler_my_new_metric_total',
    help: 'Clear description of what this metric measures',
    labelNames: ['label1', 'label2'], // Keep cardinality low!
    registers: [this.registry],
  });
}
```

#### 4. Metric Naming Best Practices

Follow Prometheus naming conventions:

```
birthday_scheduler_<subsystem>_<metric_name>_<unit>_<type>
```

**Examples:**
```typescript
// Counter - must end in _total
'birthday_scheduler_messages_sent_total'
'birthday_scheduler_api_requests_total'
'birthday_scheduler_cache_hits_total'

// Gauge - no suffix required
'birthday_scheduler_queue_depth'
'birthday_scheduler_active_workers'
'birthday_scheduler_memory_usage_bytes'

// Histogram - should include unit
'birthday_scheduler_api_response_time_seconds'
'birthday_scheduler_message_size_bytes'
'birthday_scheduler_batch_processing_duration_seconds'

// Summary - should include unit
'birthday_scheduler_processing_time_quantiles'
```

**Naming Rules:**
- Use lowercase with underscores (snake_case)
- Start with application prefix: `birthday_scheduler_`
- Include subsystem if applicable: `database_`, `queue_`, `api_`
- Add unit suffix: `_seconds`, `_bytes`, `_count`
- Counters must end in `_total`
- Be descriptive but concise
- Use base units (seconds not milliseconds, bytes not MB)

#### 5. Configure Histogram Buckets

For histogram metrics, choose appropriate buckets:

```typescript
// Fast operations (< 100ms)
buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1]

// API responses (100ms - 5s)
buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]

// Database queries (1ms - 1s)
buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1]

// Message processing (10ms - 10s)
buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10]

// Batch operations (100ms - 5 minutes)
buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300]

// Long-running jobs (1s - 1 hour)
buckets: [1, 5, 10, 30, 60, 300, 900, 1800, 3600]
```

#### 6. Add Recording Method (Optional)

Create a convenience method for recording the metric:

```typescript
/**
 * Record my new metric
 * @param label1 - Description of label1
 * @param label2 - Description of label2
 * @param value - Value to record (for gauges/histograms)
 */
recordMyNewMetric(label1: string, label2: string, value?: number): void {
  if (value !== undefined) {
    // For Histogram or Gauge
    this.myNewMetric.observe({ label1, label2 }, value);
  } else {
    // For Counter
    this.myNewMetric.inc({ label1, label2 });
  }
}
```

#### 7. Instrument Your Code

Add metric recording at the appropriate location:

```typescript
// Counter example
metricsService.messagesScheduledTotal.inc({
  message_type: 'birthday',
  timezone: 'UTC'
});

// Gauge example
metricsService.queueDepth.set({ queue_name: 'messages' }, depth);

// Histogram with timer
const end = metricsService.apiResponseTime.startTimer({
  method: 'GET',
  path: '/api/users'
});
// ... execute operation ...
end(); // Automatically records duration

// Histogram with manual observation
metricsService.databaseQueryDuration.observe(
  { query_type: 'select', table: 'users' },
  durationInSeconds
);

// Summary
metricsService.messageProcessingQuantiles.observe(
  { message_type: 'birthday' },
  processingTimeSeconds
);
```

#### 8. Update Documentation

Add the metric to this document:

1. **Add to metric list** in the appropriate category section
2. **Document labels** and their possible values
3. **Add interpretation guide** - what's normal, what's concerning
4. **Provide query examples** for common use cases
5. **Define alert thresholds** if applicable

#### 9. Create Grafana Panels

Add visualization in Grafana dashboards:

```promql
# Rate for counters
rate(birthday_scheduler_my_new_metric_total[5m])

# Current value for gauges
birthday_scheduler_my_new_metric{label1="value"}

# Percentiles for histograms
histogram_quantile(0.99,
  rate(birthday_scheduler_my_new_metric_bucket[5m])
)

# Summary quantiles (already calculated)
birthday_scheduler_my_new_metric_quantiles{quantile="0.99"}
```

#### 10. Add Alerts (If Needed)

Define alert rules in `/grafana/alerts/alert-rules.yaml`:

```yaml
- alert: MyNewMetricHigh
  expr: rate(birthday_scheduler_my_new_metric_total[5m]) > 100
  for: 5m
  labels:
    severity: warning
    component: my_component
  annotations:
    summary: "My new metric is too high"
    description: "Rate is {{ $value }} (threshold: 100)"
    runbook: "https://docs.example.com/runbooks/my-new-metric"
```

### Complete Example: Adding a Cache Warming Metric

Here's a complete example of adding a new metric:

```typescript
// 1. Add property declaration
export class MetricsService {
  public readonly cacheWarmingDuration: Histogram;
}

// 2. Initialize in constructor
constructor() {
  this.cacheWarmingDuration = new Histogram({
    name: 'birthday_scheduler_cache_warming_duration_seconds',
    help: 'Cache warming operation duration in seconds',
    labelNames: ['cache_name', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [this.registry],
  });
}

// 3. Add recording method
recordCacheWarming(cacheName: string, status: string, durationSeconds: number): void {
  this.cacheWarmingDuration.observe({ cache_name: cacheName, status }, durationSeconds);
}

// 4. Instrument code
const startTime = Date.now();
try {
  await warmCache('user-profiles');
  const duration = (Date.now() - startTime) / 1000;
  metricsService.recordCacheWarming('user-profiles', 'success', duration);
} catch (error) {
  const duration = (Date.now() - startTime) / 1000;
  metricsService.recordCacheWarming('user-profiles', 'error', duration);
  throw error;
}
```

### Label Best Practices

#### Good Label Usage

```typescript
// ✅ Low cardinality, bounded values
metricsService.messagesScheduledTotal.inc({
  message_type: 'birthday',  // Limited set: birthday, reminder, notification
  timezone: 'America/New_York'  // ~400 values (IANA timezones)
});

// ✅ Status codes grouped
metricsService.apiRequestsTotal.inc({
  method: 'GET',  // Limited: GET, POST, PUT, DELETE, PATCH
  path: '/api/users',  // Limited to defined routes
  status: '200'  // Limited to HTTP status codes
});
```

#### Bad Label Usage (Avoid!)

```typescript
// ❌ Unbounded cardinality - user_id
metricsService.messagesScheduledTotal.inc({
  user_id: userId,  // Could be millions of unique values!
  message_type: 'birthday'
});

// ❌ Unbounded cardinality - request_id
metricsService.apiRequestsTotal.inc({
  request_id: uuid(),  // Infinite unique values!
  method: 'GET'
});

// ❌ Dynamic values - email addresses
metricsService.userActivityTotal.inc({
  user_email: email  // High cardinality!
});

// ❌ Full paths with IDs
metricsService.apiRequestsTotal.inc({
  path: `/api/users/${userId}/profile`  // Unbounded!
});
```

**Instead, aggregate or use separate metrics:**

```typescript
// ✅ Aggregate into segments
const segment = getUserSegment(userId); // 'free', 'premium', 'enterprise'
metricsService.userActivityTotal.inc({
  user_segment: segment,
  activity_type: 'login'
});

// ✅ Use path templates
const pathTemplate = route.pattern; // '/api/users/:id/profile'
metricsService.apiRequestsTotal.inc({
  path: pathTemplate,
  method: 'GET'
});
```

### Testing Your Metrics

#### 1. Local Testing

```bash
# Start the application
npm run dev

# Check metrics endpoint
curl http://localhost:3000/metrics | grep my_new_metric

# Trigger the code path
curl http://localhost:3000/api/trigger-action

# Verify metric value changed
curl http://localhost:3000/metrics | grep my_new_metric
```

#### 2. Prometheus Query Testing

```promql
# Check if metric exists
birthday_scheduler_my_new_metric_total

# Check labels
birthday_scheduler_my_new_metric_total{label1="test"}

# Check rate
rate(birthday_scheduler_my_new_metric_total[5m])

# Check cardinality
count(birthday_scheduler_my_new_metric_total)
```

#### 3. Verify in Grafana

1. Go to Explore
2. Select Prometheus data source
3. Enter your metric query
4. Verify data appears
5. Add to dashboard if needed

### Common Mistakes to Avoid

| Mistake | Problem | Solution |
|---------|---------|----------|
| High cardinality labels | Memory explosion | Use bounded label values |
| Wrong metric type | Incorrect data | Counter for increasing, Gauge for current value |
| Missing units in name | Confusion about scale | Always include `_seconds`, `_bytes`, etc. |
| Too many labels | Query complexity | Max 4-5 labels per metric |
| Generic names | Unclear purpose | Be specific: `users_active` not `count` |
| No documentation | Hard to use | Document in this file |
| No alerts | Issues missed | Add alerts for critical metrics |
| Wrong buckets | Poor percentiles | Choose buckets that match your SLO |

### Metric Review Checklist

Before committing new metrics:

- [ ] Metric name follows naming conventions
- [ ] Metric type is appropriate for use case
- [ ] Labels have low cardinality (< 100 unique values per label)
- [ ] No user IDs, emails, or unbounded values in labels
- [ ] Histogram buckets match expected value distribution
- [ ] Documentation added to METRICS.md
- [ ] Recording method added (if complex)
- [ ] Code instrumented correctly
- [ ] Tested locally and verified in /metrics endpoint
- [ ] Grafana dashboard panel created (if needed)
- [ ] Alert rules defined (if critical)
- [ ] Query examples provided
- [ ] Normal/warning/critical thresholds documented

---

## System Metrics (from SystemMetricsService)

The application includes a comprehensive `SystemMetricsService` that collects system-level metrics beyond Prometheus defaults. These metrics provide deep visibility into Node.js runtime behavior and system resource utilization.

### System Load Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `system_load_average` | Gauge | `period` (1m, 5m, 15m) | System load average over different time periods |
| `system_memory_free_bytes` | Gauge | - | System free memory in bytes |
| `system_memory_total_bytes` | Gauge | - | System total memory in bytes |
| `system_uptime_seconds` | Gauge | - | System uptime in seconds |
| `system_cpu_count` | Gauge | - | Number of CPU cores available |
| `process_uptime_seconds` | Gauge | - | Process uptime in seconds |
| `process_memory_rss_bytes` | Gauge | - | Process Resident Set Size (physical memory) in bytes |
| `process_cpu_usage_percent` | Gauge | - | Process CPU usage percentage (0-100 per CPU core) |

### Event Loop Metrics

| Metric Name | Type | Description | Normal Range |
|-------------|------|-------------|---------------|
| `nodejs_eventloop_utilization` | Gauge | Event loop utilization (0-1, where 1 = 100% busy) | < 0.7 |
| `nodejs_eventloop_active` | Gauge | Event loop active time percentage (0-1) | Variable |
| `nodejs_eventloop_idle` | Gauge | Event loop idle time percentage (0-1) | Variable |
| `nodejs_active_handles_total` | Gauge | Active handles (files, sockets, timers, etc.) | Depends on workload |
| `nodejs_active_requests_total` | Gauge | Active requests (pending I/O operations) | Depends on workload |

### Garbage Collection Monitoring

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `nodejs_gc_pause_seconds` | Gauge | `gc_type` (scavenge, mark-sweep-compact, incremental-marking, process-weak-callbacks) | GC pause duration in seconds |
| `nodejs_gc_runs_total` | Gauge | `gc_type` | Total number of GC runs by type |

**GC Type Mapping:**
- `scavenge` (1) - Minor GC, fast collection of young generation
- `mark-sweep-compact` (2) - Major GC, full heap collection
- `incremental-marking` (4) - Incremental marking phase
- `process-weak-callbacks` (8) - Weak reference callback processing

### V8 Heap Detailed Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `nodejs_heap_space_used_bytes` | Gauge | `space` (NewSpace, OldSpace, CodeSpace, MapSpace, etc.) | Heap space used in bytes by space name |
| `nodejs_heap_space_size_bytes` | Gauge | `space` | Heap space total size in bytes by space name |
| `nodejs_heap_space_available_bytes` | Gauge | `space` | Heap space available in bytes by space name |
| `nodejs_external_memory_bytes` | Gauge | - | External memory used by V8 (C++ objects bound to JavaScript) |
| `nodejs_array_buffer_memory_bytes` | Gauge | - | Memory allocated for ArrayBuffers and SharedArrayBuffers |

### System Metrics Collection Configuration

The SystemMetricsService is configured with:
- **Collection Interval:** 15 seconds
- **GC Monitoring:** Enabled (PerformanceObserver with 'gc' entry type)
- **Event Loop Utilization Tracking:** Enabled
- **Heap Space Tracking:** Enabled

### System Metrics Usage Example

```typescript
import { systemMetricsService } from '@/services/system-metrics.service';

// Start metrics collection
systemMetricsService.start();

// Later: get system snapshot for debugging
const snapshot = systemMetricsService.getSnapshot();
console.log('Memory:', snapshot.memory);
console.log('Load Average:', snapshot.loadAverage);

// Stop on shutdown
await systemMetricsService.stop();
```

### Interpreting System Metrics

**Event Loop Utilization (0-1):**
- < 0.5: Good, event loop is not blocking
- 0.5-0.7: Acceptable, some blocking work
- > 0.7: Warning, significant blocking or high traffic

**GC Pause Time:**
- < 50ms: Normal for scavenge GC
- 50-200ms: Expected for mark-sweep
- > 200ms: Potential performance issue

**Heap Space Usage:**
- Monitor `NewSpace` for short-lived objects
- Track `OldSpace` for potential memory leaks
- `External` memory for C++ binding overhead

---

## References

- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Prometheus Metric Types](https://prometheus.io/docs/concepts/metric_types/)
- [Node.js Metrics with prom-client](https://github.com/siimon/prom-client)
- [Google SRE Book - Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
- [RED Method](https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/)
- [Grafana Dashboard Design](../plan/07-monitoring/grafana-dashboards-research.md)
- [Alert Rules](../grafana/alerts/alert-rules.yaml)
- [Queue Metrics Implementation](../src/services/queue/queue-metrics.ts)
- [System Metrics Implementation](../src/services/system-metrics.service.ts)
- [Metrics Service](../src/services/metrics.service.ts)
- [Prometheus Naming Best Practices](https://prometheus.io/docs/practices/naming/)
- [Avoiding High Cardinality](https://prometheus.io/docs/practices/naming/#labels)
