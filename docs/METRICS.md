# Prometheus Metrics and Monitoring

Comprehensive monitoring and observability for the Birthday Message Scheduler using Prometheus metrics.

## Overview

This implementation provides production-ready Prometheus metrics for monitoring all aspects of the birthday message scheduler, including:

- Message throughput and delivery
- Queue depth and worker health
- API performance and errors
- Database connections
- Circuit breaker status
- Scheduler job execution

## Metrics Endpoint

### GET /metrics

Returns metrics in Prometheus exposition format.

```bash
curl http://localhost:3000/metrics
```

**Response**: `text/plain; version=0.0.4`

### GET /metrics/summary

Returns metrics summary in JSON format (for debugging).

```bash
curl http://localhost:3000/metrics/summary
```

**Response**: `application/json`

## Available Metrics

### Counter Metrics

Monotonically increasing counters for events.

#### `birthday_scheduler_messages_scheduled_total`
Total number of messages scheduled.

**Labels**:
- `message_type`: BIRTHDAY, ANNIVERSARY
- `timezone`: User timezone (e.g., America/New_York)

**Example**:
```promql
rate(birthday_scheduler_messages_scheduled_total[5m])
```

#### `birthday_scheduler_messages_sent_total`
Total number of messages successfully sent.

**Labels**:
- `message_type`: BIRTHDAY, ANNIVERSARY
- `status_code`: HTTP status code (200, 201, etc.)

**Example**:
```promql
sum(rate(birthday_scheduler_messages_sent_total[5m])) by (message_type)
```

#### `birthday_scheduler_messages_failed_total`
Total number of messages that failed to send.

**Labels**:
- `message_type`: BIRTHDAY, ANNIVERSARY
- `error_type`: timeout, network, validation, rate_limit, etc.
- `retry_count`: Number of retries attempted

**Example**:
```promql
sum(rate(birthday_scheduler_messages_failed_total[5m])) by (error_type)
```

#### `birthday_scheduler_api_requests_total`
Total number of API requests.

**Labels**:
- `method`: HTTP method (GET, POST, etc.)
- `path`: Normalized request path
- `status`: HTTP status code

**Example**:
```promql
rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])
```

### Gauge Metrics

Current state measurements.

#### `birthday_scheduler_queue_depth`
Current depth of message queue.

**Labels**:
- `queue_name`: Name of the queue

**Example**:
```promql
birthday_scheduler_queue_depth{queue_name="birthday_messages"}
```

#### `birthday_scheduler_active_workers`
Number of active worker processes.

**Labels**:
- `worker_type`: Type of worker (message_consumer, etc.)

**Example**:
```promql
birthday_scheduler_active_workers
```

#### `birthday_scheduler_database_connections`
Number of active database connections.

**Labels**:
- `pool_name`: Database pool name
- `state`: active, idle

**Example**:
```promql
sum(birthday_scheduler_database_connections) by (state)
```

#### `birthday_scheduler_circuit_breaker_open`
Circuit breaker status (1 = open, 0 = closed).

**Labels**:
- `service_name`: Name of the service

**Example**:
```promql
birthday_scheduler_circuit_breaker_open{service_name="message_api"}
```

### Histogram Metrics

Distribution of observed values.

#### `birthday_scheduler_message_delivery_duration_seconds`
Duration of message delivery in seconds.

**Labels**:
- `message_type`: BIRTHDAY, ANNIVERSARY
- `status`: success, failure

**Buckets**: 0.1, 0.5, 1, 2, 5, 10, 30

**Example**:
```promql
histogram_quantile(0.95, sum(rate(birthday_scheduler_message_delivery_duration_seconds_bucket[5m])) by (le, message_type))
```

#### `birthday_scheduler_api_response_time_seconds`
API response time in seconds.

**Labels**:
- `method`: HTTP method
- `path`: Request path
- `status`: HTTP status code

**Buckets**: 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5

**Example**:
```promql
histogram_quantile(0.99, sum(rate(birthday_scheduler_api_response_time_seconds_bucket[5m])) by (le))
```

#### `birthday_scheduler_scheduler_execution_duration_seconds`
Scheduler job execution duration in seconds.

**Labels**:
- `job_type`: daily_precalculation, enqueue_messages, recovery_job
- `status`: success, failure

**Buckets**: 0.1, 0.5, 1, 5, 10, 30, 60, 120

**Example**:
```promql
birthday_scheduler_scheduler_execution_duration_seconds{job_type="daily_precalculation"}
```

### Summary Metrics

Quantiles and aggregations.

#### `birthday_scheduler_message_processing_quantiles`
Message processing time quantiles.

**Labels**:
- `message_type`: BIRTHDAY, ANNIVERSARY

**Quantiles**: 0.5, 0.9, 0.95, 0.99

**Example**:
```promql
birthday_scheduler_message_processing_quantiles{quantile="0.99"}
```

## Default Labels

All metrics include default labels:
- `service`: birthday-message-scheduler
- `environment`: development, staging, production
- `version`: Application version

## Grafana Dashboard

A pre-configured Grafana dashboard is available at `grafana/dashboard.json`.

### Dashboard Panels

1. **Message Throughput** - Rate of scheduled, sent, and failed messages
2. **Error Rate** - Percentage of failed messages
3. **Message Delivery Latency** - p50, p95, p99 latency percentiles
4. **Queue Depth** - Current queue depth with alerts
5. **Circuit Breaker Status** - Real-time circuit breaker state
6. **Active Workers** - Number of active worker processes
7. **Database Connections** - Connection pool usage
8. **API Response Time** - p95 API response time
9. **Scheduler Job Duration** - Job execution time by type

### Alerts Configured

1. **High Queue Depth**: Triggers when queue depth > 1000 for 5 minutes
2. **High Error Rate**: Triggers when error rate > 5%
3. **Circuit Breaker Open**: Triggers when circuit breaker opens

### Importing the Dashboard

1. Open Grafana
2. Go to Dashboards → Import
3. Upload `grafana/dashboard.json`
4. Select your Prometheus datasource
5. Click Import

## Prometheus Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'birthday-scheduler'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

## Alerting Rules

Example Prometheus alerting rules:

```yaml
groups:
  - name: birthday_scheduler
    interval: 30s
    rules:
      # High error rate
      - alert: HighMessageErrorRate
        expr: |
          (
            rate(birthday_scheduler_messages_failed_total[5m])
            /
            (rate(birthday_scheduler_messages_sent_total[5m]) + rate(birthday_scheduler_messages_failed_total[5m]))
          ) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High message error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

      # High queue depth
      - alert: HighQueueDepth
        expr: birthday_scheduler_queue_depth > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Message queue depth is high"
          description: "Queue {{ $labels.queue_name }} has {{ $value }} messages"

      # Circuit breaker open
      - alert: CircuitBreakerOpen
        expr: birthday_scheduler_circuit_breaker_open == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker is open"
          description: "Circuit breaker for {{ $labels.service_name }} is open"

      # No active workers
      - alert: NoActiveWorkers
        expr: birthday_scheduler_active_workers == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "No active workers"
          description: "No active {{ $labels.worker_type }} workers detected"

      # Database connection issues
      - alert: NoDatabaseConnections
        expr: birthday_scheduler_database_connections{state="active"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "No active database connections"
          description: "Database pool {{ $labels.pool_name }} has no active connections"
```

## Usage Examples

### Recording Metrics in Code

```typescript
import { metricsService } from './services/metrics.service.js';

// Record a scheduled message
metricsService.recordMessageScheduled('BIRTHDAY', 'America/New_York');

// Record a sent message
metricsService.recordMessageSent('BIRTHDAY', 200);

// Record a failed message
metricsService.recordMessageFailed('ANNIVERSARY', 'timeout', 1);

// Set queue depth
metricsService.setQueueDepth('birthday_messages', 150);

// Set active workers
metricsService.setActiveWorkers('message_consumer', 5);

// Record message delivery duration
const startTime = Date.now();
// ... send message ...
const duration = (Date.now() - startTime) / 1000;
metricsService.recordMessageDeliveryDuration('BIRTHDAY', 'success', duration);

// Set circuit breaker status
metricsService.setCircuitBreakerStatus('message_api', false);
```

### Querying Metrics

```bash
# Get all metrics
curl http://localhost:3000/metrics

# Get metrics summary (JSON)
curl http://localhost:3000/metrics/summary | jq .

# Query specific metrics (if Prometheus is running)
curl 'http://localhost:9090/api/v1/query?query=birthday_scheduler_queue_depth'
```

## Monitoring Best Practices

1. **Set up alerts** for critical metrics (queue depth, error rate, circuit breaker)
2. **Monitor trends** over time to identify patterns
3. **Use dashboards** for real-time visibility
4. **Track SLOs** (Service Level Objectives) based on metrics
5. **Regular reviews** of metric data for optimization opportunities

## Performance Considerations

- Metrics are collected in-memory with minimal overhead
- Histogram buckets are optimized for typical latencies
- Default Node.js metrics are included for system monitoring
- Metrics endpoint is lightweight and fast (< 100ms response time)

## Troubleshooting

### High Memory Usage

Check if metric cardinality is too high:
```promql
count(birthday_scheduler_messages_scheduled_total) by (__name__)
```

### Missing Metrics

1. Verify metrics endpoint is accessible: `curl http://localhost:3000/metrics`
2. Check Prometheus targets: `http://localhost:9090/targets`
3. Review application logs for metric recording errors

### Incorrect Metric Values

1. Verify metric is being recorded in code
2. Check metric labels match query
3. Review metric type (counter vs gauge vs histogram)

## Future Enhancements

- [ ] Add custom SLO/SLI tracking
- [ ] Implement distributed tracing integration
- [ ] Add more granular error categorization
- [ ] Create additional dashboards for specific use cases
- [ ] Implement metric retention policies
- [ ] Add metric federation for multi-instance deployments
