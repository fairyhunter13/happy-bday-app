# Grafana Dashboard Design Research
## Comprehensive Research for 4 Specialized Dashboards

**Research Completed:** 2025-12-31
**Target Application:** Happy Birthday App (Fastify + PostgreSQL + RabbitMQ)
**Monitoring Stack:** Prometheus + Grafana

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Principles & Best Practices](#design-principles--best-practices)
3. [Dashboard 1: API Performance](#dashboard-1-api-performance)
4. [Dashboard 2: Message Processing](#dashboard-2-message-processing)
5. [Dashboard 3: Database Monitoring](#dashboard-3-database-monitoring)
6. [Dashboard 4: Infrastructure Monitoring](#dashboard-4-infrastructure-monitoring)
5. [Dashboard Structure & JSON Schema](#dashboard-structure--json-schema)
6. [Implementation Recommendations](#implementation-recommendations)
7. [References & Sources](#references--sources)

---

## Executive Summary

This research document provides comprehensive guidance for implementing 4 production-grade Grafana dashboards based on industry best practices, the RED method, Four Golden Signals, and USE methodology. Each dashboard is designed for specific monitoring concerns while maintaining consistency in design patterns.

### Dashboard Overview

- **API Performance**: Request rate, latency percentiles, error tracking (RED method)
- **Message Processing**: Queue depth, processing rate, retry patterns (Queue-specific metrics)
- **Database**: Connection pools, query performance, replication health (Database-specific metrics)
- **Infrastructure**: CPU, memory, disk, network, event loop (USE method + Four Golden Signals)

---

## Design Principles & Best Practices

### 1. Narrative-Driven Design

According to [Grafana's official best practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/), dashboards should tell a coherent story or answer specific questions. Design with logical progression from broad overview to specific details.

**Key Principles:**
- Each visualization serves a clear purpose
- Minimize cognitive load - graphs should be self-explanatory
- Organize panels hierarchically reflecting service or data flow
- Use drill-down patterns linking overview to detailed views

### 2. Panel Layout Guidelines

**Hierarchical Organization:**
- Arrange panels reflecting service or data flow hierarchy
- Use row-based layouts to group related metrics by service/component
- Place most critical metrics (SLO-relevant) at the top
- Follow reading patterns: left-to-right, top-to-bottom

**Visual Design:**
- Normalize measurements for fair comparison (e.g., CPU as percentage)
- Use separate Y-axes for metrics with different units
- Apply consistent color coding: blue for healthy, red for problematic
- Avoid stacking visualizations (they obscure important data)

### 3. Template Variables for Scalability

Use variables to eliminate dashboard duplication:
- **Environment filters**: `$environment` (prod, staging, dev)
- **Instance selectors**: `$instance` for multi-instance deployments
- **Time ranges**: Standardized time selection across dashboards
- **Data source variables**: Enable dashboard reuse across environments

### 4. Visualization Type Selection

Based on [Grafana's visualization guide](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/):

| Visualization | Use Case |
|--------------|----------|
| **Time Series** | Default for metrics over time (lines, areas, bars) |
| **Stat Panel** | Single large KPI values with optional sparklines |
| **Gauge** | Single value with thresholds and visual ranges |
| **Heatmap** | Distribution of values over time (latency percentiles) |
| **Table** | Detailed multi-dimensional data (top queries, error logs) |
| **Bar Chart** | Comparing multiple metrics at a point in time |

### 5. Monitoring Methodologies

**RED Method** (Service-Level Monitoring):
- **Rate**: Requests per second
- **Errors**: Failed request count/percentage
- **Duration**: Latency distribution (p50, p95, p99)

Source: [Building a RED Dashboard](https://deepwiki.com/grafana/intro-to-prometheus-breakouts/5.1-building-a-red-dashboard)

**USE Method** (Infrastructure Resources):
- **Utilization**: Resource busyness percentage
- **Saturation**: Work queue depth or system load
- **Errors**: Error event counts

Source: [Four Golden Signals](https://www.sysdig.com/blog/golden-signals-kubernetes)

**Four Golden Signals** (User-Facing Systems):
- Latency, Traffic, Errors, Saturation

---

## Dashboard 1: API Performance

### Purpose

Monitor HTTP API health using the RED method: request Rate, Error rate, and Duration (latency).

### Technology Context

- **Framework**: Fastify with `fastify-metrics` plugin
- **Metrics Plugin**: [fastify-metrics](https://github.com/SkeLLLa/fastify-metrics)
- **Default Metrics**: `http_request_duration_seconds` (histogram), `http_request_summary_seconds` (summary)
- **Labels**: `method`, `route`, `status_code`

### Panel Structure

#### Row 1: Overview (Single Stat Panels)
**Panel 1.1: Total Request Rate**
- **Visualization**: Stat panel with sparkline
- **Metric**: Total requests per second across all endpoints
- **PromQL**:
```
  sum(rate(http_request_duration_seconds_count[5m]))
  ```
- **Thresholds**:
  - Green: < 1000 req/s
  - Yellow: 1000-5000 req/s
  - Red: > 5000 req/s

**Panel 1.2: Overall Error Rate**
- **Visualization**: Stat panel with percentage
- **Metric**: Percentage of 5xx errors
- **PromQL**:
```
  sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]))
  /
  sum(rate(http_request_duration_seconds_count[5m])) * 100
  ```
- **Thresholds**:
  - Green: < 0.1%
  - Yellow: 0.1-1%
  - Red: > 1%

**Panel 1.3: P99 Latency**
- **Visualization**: Stat panel with gauge
- **Metric**: 99th percentile latency
- **PromQL**:
```
  histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
  ```
- **Thresholds**:
  - Green: < 200ms
  - Yellow: 200-500ms
  - Red: > 500ms

#### Row 2: Request Rate by Endpoint
**Panel 2.1: Requests per Second by Route**
- **Visualization**: Time series (stacked area)
- **Metric**: Request rate broken down by route
- **PromQL**:
```
  sum by (route) (rate(http_request_duration_seconds_count[5m]))
  ```
- **Legend**: `{{route}}`
- **Display**: Stacked to show total volume with route composition

#### Row 3: Latency Analysis
**Panel 3.1: Latency Percentiles (Multi-Line)**
- **Visualization**: Time series (lines)
- **Metrics**: p50, p90, p95, p99
- **PromQL**:
```
  # P50
  histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

  # P90
  histogram_quantile(0.90, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

  # P95
  histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

  # P99
  histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
  ```
- **Legend**: `P50`, `P90`, `P95`, `P99`
- **Y-Axis**: Seconds
- **Color Scheme**: Blue (p50) → Yellow (p90) → Orange (p95) → Red (p99)

**Panel 3.2: Latency Heatmap**
- **Visualization**: Heatmap
- **Metric**: Request duration distribution
- **PromQL**:
```
  sum(increase(http_request_duration_seconds_bucket[1m])) by (le)
  ```
- **Purpose**: Visualize latency distribution patterns and outliers over time
- **Reference**: [Grafana Histograms and Heatmaps](https://grafana.com/docs/grafana/latest/fundamentals/intro-histograms/)

#### Row 4: Error Analysis
**Panel 4.1: HTTP Status Codes**
- **Visualization**: Time series (stacked bars)
- **Metric**: Request count by status code range
- **PromQL**:
```
  sum by (status_code) (rate(http_request_duration_seconds_count[5m]))
  ```
- **Color Mapping**:
  - 2xx: Green
  - 3xx: Blue
  - 4xx: Yellow
  - 5xx: Red

**Panel 4.2: Error Rate by Endpoint**
- **Visualization**: Table
- **Metric**: Error percentage per endpoint, sorted by error count
- **PromQL**:
```
  # Error Rate
  sum by (route) (rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]))
  /
  sum by (route) (rate(http_request_duration_seconds_count[5m])) * 100

  # Total Errors
  sum by (route) (rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]))
  ```
- **Columns**: Route, Error Rate %, Total Errors/s
- **Sort**: By error rate descending

#### Row 5: Endpoint Performance
**Panel 5.1: Top 10 Slowest Endpoints (P95)**
- **Visualization**: Bar gauge (horizontal)
- **Metric**: P95 latency by route
- **PromQL**:
```
  topk(10,
    histogram_quantile(0.95,
      sum by (route, le) (rate(http_request_duration_seconds_bucket[5m]))
    )
  )
  ```
- **Display**: Horizontal bars with threshold colors
- **Thresholds**: < 100ms (green), 100-300ms (yellow), > 300ms (red)

### Dashboard Variables

```json
{
  "templating": {
    "list": [
      {
        "name": "instance",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(http_request_duration_seconds_count, instance)",
        "multi": false,
        "includeAll": false
      },
      {
        "name": "route",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(http_request_duration_seconds_count, route)",
        "multi": true,
        "includeAll": true
      },
      {
        "name": "status_code",
        "type": "custom",
        "query": "2xx,3xx,4xx,5xx",
        "multi": true,
        "includeAll": true
      }
    ]
  }
}
```

### Best Practices for API Dashboard

1. **Histogram Buckets**: Configure based on SLOs ([Histogram Buckets in Prometheus](https://last9.io/blog/histogram-buckets-in-prometheus/))
   - For SLO "99% of requests under 300ms", include buckets: `[0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 3, 5]`

2. **Use P95 for Primary SLO**: [Percentile best practices](https://oneuptime.com/blog/post/2025-09-15-p50-vs-p95-vs-p99-latency-percentiles/view)
   - P50: Detect broad regressions
   - P95: Tune system performance (primary SLO)
   - P99: Expose architectural bottlenecks

3. **Recording Rules**: Create for performance ([Essential Prometheus Queries](https://last9.io/blog/prometheus-query-examples/))
```
   - record: api:http_request_duration_seconds:p95
     expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))
   ```

4. **Anomaly Detection**: Alert when P95 exceeds baseline ([Practical Anomaly Detection](https://grigorkh.medium.com/practical-anomaly-detection-with-prometheus-and-promql-d3027b97da96))
```
   # Alert if P95 latency exceeds 4σ above 1h baseline
   histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
   >
   (avg_over_time(histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))[1h:5m])
   + 4 * stddev_over_time(histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))[1h:5m]))
   ```

---

## Dashboard 2: Message Processing

### Purpose

Monitor RabbitMQ message queue health, throughput, and processing efficiency.

### Technology Context

- **Message Broker**: RabbitMQ with Prometheus plugin
- **Exporter**: `rabbitmq_prometheus` plugin (port 15692)
- **Official Guide**: [RabbitMQ Prometheus Monitoring](https://www.rabbitmq.com/docs/prometheus)
- **Scrape Interval**: Minimum 15s, statistics collection: 10s

### Panel Structure

#### Row 1: Queue Health Overview
**Panel 1.1: Total Messages in All Queues**
- **Visualization**: Stat panel with trend
- **Metric**: Sum of messages across all queues
- **PromQL**:
```
  sum(rabbitmq_detailed_queue_messages)
  ```
- **Thresholds**:
  - Green: < 1000 messages
  - Yellow: 1000-10000 messages
  - Red: > 10000 messages

**Panel 1.2: Queue Processing Rate**
- **Visualization**: Stat panel
- **Metric**: Messages delivered per second
- **PromQL**:
```
  sum(rate(rabbitmq_detailed_queue_messages_delivered_ack_total[5m]))
  ```

**Panel 1.3: Active Consumers**
- **Visualization**: Stat panel
- **Metric**: Total active consumers
- **PromQL**:
```
  sum(rabbitmq_detailed_queue_consumers)
  ```
- **Thresholds**:
  - Red: = 0 (no consumers)
  - Yellow: 1-2 consumers
  - Green: >= 3 consumers

#### Row 2: Queue Depth Monitoring
**Panel 2.1: Queue Depth by Queue**
- **Visualization**: Time series (multi-line)
- **Metric**: Messages ready per queue
- **PromQL**:
```
  sum by (queue) (rabbitmq_detailed_queue_messages_ready)
  ```
- **Legend**: `{{queue}}`
- **Alert Threshold**: Queue depth growing consistently (saturation)

**Panel 2.2: Queue Growth Rate**
- **Visualization**: Time series
- **Metric**: Rate of queue depth change
- **PromQL**:
```
  deriv(rabbitmq_detailed_queue_messages[5m])
  ```
- **Purpose**: Detect queues filling faster than draining
- **Alert**: Positive derivative sustained for > 10 minutes

#### Row 3: Message Throughput
**Panel 3.1: Message Publish Rate**
- **Visualization**: Time series (stacked area)
- **Metric**: Messages published per second by exchange
- **PromQL**:
```
  sum by (exchange) (rate(rabbitmq_detailed_exchange_messages_published_total[5m]))
  ```
- **Legend**: `{{exchange}}`

**Panel 3.2: Message Delivery Rate**
- **Visualization**: Time series
- **Metric**: Messages delivered and acknowledged
- **PromQL**:
```
  sum by (queue) (rate(rabbitmq_detailed_queue_messages_delivered_ack_total[5m]))
  ```

**Panel 3.3: Message Acknowledgment Rate**
- **Visualization**: Time series
- **Metric**: Message ack rate vs delivery rate
- **PromQL**:
```
  # Delivery rate
  sum(rate(rabbitmq_detailed_queue_messages_delivered_ack_total[5m]))

  # Ack rate
  sum(rate(rabbitmq_detailed_queue_messages_acked_total[5m]))
  ```
- **Purpose**: Identify processing lag or consumer issues

#### Row 4: Retry and Error Analysis
**Panel 4.1: Message Redelivery Rate**
- **Visualization**: Time series
- **Metric**: Messages redelivered (retries)
- **PromQL**:
```
  sum by (queue) (rate(rabbitmq_detailed_queue_messages_redelivered_total[5m]))
  ```
- **Alert**: High redelivery rate indicates processing failures

**Panel 4.2: Unroutable Messages (DLQ Candidates)**
- **Visualization**: Time series
- **Metric**: Messages that couldn't be routed
- **PromQL**:
```
  sum by (exchange) (rate(rabbitmq_detailed_exchange_messages_unroutable_returned_total[5m]))
  ```
- **Color**: Red (these are errors)

**Panel 4.3: DLQ Depth**
- **Visualization**: Stat panel + time series
- **Metric**: Messages in Dead Letter Queue
- **PromQL**:
```
  sum(rabbitmq_detailed_queue_messages{queue=~".*dlq.*|.*dead.*"})
  ```
- **Alert**: DLQ accumulation requires investigation

#### Row 5: Consumer Performance
**Panel 5.1: Consumer Utilization**
- **Visualization**: Gauge per queue
- **Metric**: Percentage of time consumers are active
- **PromQL**:
```
  (sum by (queue) (rabbitmq_detailed_queue_consumer_utilisation)) * 100
  ```
- **Thresholds**:
  - Green: > 80% (healthy)
  - Yellow: 50-80% (underutilized)
  - Red: < 50% (consumer issues)

**Panel 5.2: Unacknowledged Messages**
- **Visualization**: Time series by queue
- **Metric**: Messages delivered but not yet acknowledged
- **PromQL**:
```
  sum by (queue) (rabbitmq_detailed_queue_messages_unacked)
  ```
- **Purpose**: Detect slow processing or hung consumers

#### Row 6: Resource Usage
**Panel 6.1: Queue Memory Usage**
- **Visualization**: Time series
- **Metric**: Memory consumed by messages per queue
- **PromQL**:
```
  sum by (queue) (rabbitmq_detailed_queue_messages_ram_bytes + rabbitmq_detailed_queue_messages_persistent_bytes)
  ```

**Panel 6.2: Connection Churn**
- **Visualization**: Time series
- **Metric**: Rate of connections/channels opened
- **PromQL**:
```
  rate(rabbitmq_detailed_connections_opened_total[5m])
  rate(rabbitmq_detailed_channels_opened_total[5m])
  ```
- **Alert**: High churn indicates connection pool issues

### Dashboard Variables

```json
{
  "templating": {
    "list": [
      {
        "name": "queue",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(rabbitmq_detailed_queue_messages, queue)",
        "multi": true,
        "includeAll": true
      },
      {
        "name": "exchange",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(rabbitmq_detailed_exchange_messages_published_total, exchange)",
        "multi": true,
        "includeAll": true
      },
      {
        "name": "vhost",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(rabbitmq_detailed_queue_messages, vhost)",
        "multi": false,
        "includeAll": false
      }
    ]
  }
}
```

### Best Practices for Message Queue Dashboard

1. **Use Detailed Endpoint Efficiently**: [RabbitMQ Prometheus docs](https://www.rabbitmq.com/docs/prometheus)
   - `/metrics/detailed` is "up to 60x more efficient" for specific metric queries
   - Use for dashboards querying specific queues

2. **Configuration for Large Deployments**:
```
   prometheus.tcp.idle_timeout = 120000
   prometheus.tcp.request_timeout = 120000
   ```

3. **Color Conventions** (from official dashboards):
   - Green: Healthy queue operation
   - Blue: Under-utilization or degradation
   - Red: Outside acceptable thresholds

4. **Reference Dashboards**:
   - [RabbitMQ Overview Dashboard](https://grafana.com/grafana/dashboards/10991-rabbitmq-overview/)
   - [RabbitMQ Queue Dashboard](https://grafana.com/grafana/dashboards/17308-rabbitmq-queue/)

---

## Dashboard 3: Database Monitoring

### Purpose

Monitor PostgreSQL database performance, connection health, query efficiency, and replication status.

### Technology Context

- **Database**: PostgreSQL 13-17
- **Exporter**: [postgres_exporter](https://github.com/prometheus-community/postgres_exporter) (port 9187)
- **Key Extensions**: `pg_stat_statements`, `pg_stat_activity`, `pg_stat_database`
- **Collection Timeout**: Default 1 minute

### Panel Structure

#### Row 1: Database Health Overview
**Panel 1.1: Active Connections**
- **Visualization**: Stat panel with gauge
- **Metric**: Current active database connections
- **PromQL**:
```
  sum(pg_stat_activity_count)
  ```
- **Thresholds** (assuming max_connections=100):
  - Green: < 70 connections
  - Yellow: 70-90 connections
  - Red: > 90 connections

**Panel 1.2: Cache Hit Ratio**
- **Visualization**: Stat panel with percentage
- **Metric**: Buffer cache hit ratio (target: > 99%)
- **PromQL**:
```
  sum(pg_stat_database_blks_hit)
  /
  (sum(pg_stat_database_blks_hit) + sum(pg_stat_database_blks_read)) * 100
  ```
- **Thresholds**:
  - Green: > 99%
  - Yellow: 95-99%
  - Red: < 95%

**Panel 1.3: Transaction Rate**
- **Visualization**: Stat panel with trend
- **Metric**: Transactions per second
- **PromQL**:
```
  sum(rate(pg_stat_database_xact_commit[5m]))
  ```

#### Row 2: Connection Pool Monitoring
**Panel 2.1: Connection States**
- **Visualization**: Time series (stacked area)
- **Metric**: Connections by state (active, idle, idle in transaction)
- **PromQL**:
```
  sum by (state) (pg_stat_activity_count)
  ```
- **Legend**: `{{state}}`
- **Colors**:
  - Active: Green
  - Idle: Blue
  - Idle in transaction: Yellow (potential issue)
  - Idle in transaction (aborted): Red

**Panel 2.2: Connection Pool Utilization**
- **Visualization**: Gauge
- **Metric**: Percentage of max connections used
- **PromQL**:
```
  (sum(pg_stat_activity_count) / pg_settings_max_connections) * 100
  ```
- **Alert**: > 80% utilization

**Panel 2.3: Long-Running Transactions**
- **Visualization**: Table
- **Metric**: Transactions running > 1 minute
- **Purpose**: Identify potential locks or runaway queries
- **Note**: Requires custom exporter query or application-level instrumentation

#### Row 3: Query Performance
**Panel 3.1: Query Latency (Application-Level)**
- **Visualization**: Time series
- **Metric**: Database query duration from application metrics
- **PromQL**:
```
  # Assuming application exports postgres_query_duration_seconds
  histogram_quantile(0.95,
    sum by (le, query_type) (rate(postgres_query_duration_seconds_bucket[5m]))
  )
  ```
- **Note**: Requires instrumentation in Node.js application

**Panel 3.2: Slow Query Count**
- **Visualization**: Stat panel + time series
- **Metric**: Queries exceeding threshold (e.g., > 1 second)
- **PromQL**:
```
  # From pg_stat_statements if exported
  count(pg_stat_statements_mean_exec_time_seconds > 1)
  ```

**Panel 3.3: Top Queries by Execution Time**
- **Visualization**: Table
- **Metrics**: Query text, mean time, total calls
- **Source**: `pg_stat_statements` view
- **Note**: Best displayed via PostgreSQL data source query, not PromQL

#### Row 4: Database I/O and Performance
**Panel 4.1: Disk Read vs Cache Hit**
- **Visualization**: Time series
- **Metrics**: Blocks read from disk vs blocks read from cache
- **PromQL**:
```
  # Disk reads
  sum(rate(pg_stat_database_blks_read[5m]))

  # Cache hits
  sum(rate(pg_stat_database_blks_hit[5m]))
  ```
- **Purpose**: Visualize I/O efficiency

**Panel 4.2: Tuple Operations**
- **Visualization**: Time series (stacked)
- **Metrics**: Rows inserted, updated, deleted per second
- **PromQL**:
```
  sum(rate(pg_stat_database_tup_inserted[5m]))
  sum(rate(pg_stat_database_tup_updated[5m]))
  sum(rate(pg_stat_database_tup_deleted[5m]))
  ```

**Panel 4.3: Deadlocks**
- **Visualization**: Stat panel + time series
- **Metric**: Deadlock occurrences
- **PromQL**:
```
  sum(rate(pg_stat_database_deadlocks[5m]))
  ```
- **Alert**: Any deadlock should trigger investigation

#### Row 5: Replication Health
**Panel 5.1: Replication Lag**
- **Visualization**: Time series by replica
- **Metric**: Write lag in seconds
- **PromQL**:
```
  pg_stat_replication_write_lag
  ```
- **Thresholds**:
  - Green: < 1 second
  - Yellow: 1-5 seconds
  - Red: > 5 seconds

**Panel 5.2: Replication Slot Status**
- **Visualization**: Table
- **Metrics**: Slot name, active status, lag bytes
- **Source**: `pg_replication_slots` via postgres_exporter

#### Row 6: Maintenance and Health
**Panel 6.1: Database Size**
- **Visualization**: Time series
- **Metric**: Database size growth
- **PromQL**:
```
  pg_database_size_bytes
  ```

**Panel 6.2: Autovacuum Activity**
- **Visualization**: Time series
- **Metric**: Autovacuum and autoanalyze operations
- **Purpose**: Ensure regular maintenance is running

**Panel 6.3: Table Bloat Estimate**
- **Visualization**: Table or bar chart
- **Metric**: Estimated bloat percentage per table
- **Note**: Requires custom query or bloat monitoring extension

### Dashboard Variables

```json
{
  "templating": {
    "list": [
      {
        "name": "database",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(pg_stat_database_xact_commit, datname)",
        "multi": false,
        "includeAll": false
      },
      {
        "name": "instance",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(pg_stat_activity_count, instance)",
        "multi": false,
        "includeAll": false
      }
    ]
  }
}
```

### Best Practices for Database Dashboard

1. **Use pg_stat_statements**: [PostgreSQL Monitoring Wiki](https://wiki.postgresql.org/wiki/Monitoring)
   - Enable extension: `CREATE EXTENSION pg_stat_statements;`
   - Configure: `shared_preload_libraries = 'pg_stat_statements'`
   - Track query performance over time

2. **Key Metrics to Monitor**: [PostgreSQL Monitoring Tools 2025](https://uptrace.dev/tools/postgresql-monitoring-tools)
   - Query execution time
   - Cache hit ratio (target >99%)
   - Active connections
   - Transaction rate
   - Replication lag
   - Table bloat
   - Vacuum activity
   - Resource usage (CPU, memory, disk I/O)

3. **Non-Superuser Setup**: [postgres_exporter docs](https://github.com/prometheus-community/postgres_exporter)
```
   -- Grant pg_monitor role (PostgreSQL 10+)
   GRANT pg_monitor TO prometheus_user;
   ```

4. **Connection Pool Monitoring**: Use PgBouncer metrics if connection pooling is enabled
   - `SHOW STATS` command provides pool metrics
   - Monitor pool exhaustion and wait times

5. **Reference Dashboards**:
   - [PostgreSQL Monitoring Dashboard](https://grafana.com/grafana/dashboards/24298-postgresql-monitoring-dashboard/)
   - [PostgreSQL Performance Analysis](https://grafana.com/grafana/dashboards/10521-postgresql-performance-analysis/)

---

## Dashboard 4: Infrastructure Monitoring

### Purpose

Monitor system resources, Node.js runtime health, and infrastructure saturation using the USE method and Four Golden Signals.

### Technology Context

- **Runtime**: Node.js with prom-client default metrics
- **Metrics Library**: [prom-client](https://github.com/siimon/prom-client)
- **Collection**: `collectDefaultMetrics()` with default prefix
- **Platform**: Linux (some metrics are Linux-specific)

### Panel Structure

#### Row 1: System Overview (Four Golden Signals)
**Panel 1.1: Latency (Event Loop Lag)**
- **Visualization**: Stat panel + sparkline
- **Metric**: Event loop lag in milliseconds
- **PromQL**:
```
  nodejs_eventloop_lag_seconds * 1000
  ```
- **Thresholds**:
  - Green: < 10ms
  - Yellow: 10-50ms
  - Red: > 50ms
- **Purpose**: Primary saturation indicator for Node.js

**Panel 1.2: Traffic (Requests/sec)**
- **Visualization**: Stat panel
- **Metric**: Total request throughput
- **PromQL**:
```
  sum(rate(http_request_duration_seconds_count[5m]))
  ```

**Panel 1.3: Errors (Process Crashes)**
- **Visualization**: Stat panel
- **Metric**: Process restarts or error rate
- **PromQL**:
```
  changes(process_start_time_seconds[1h])
  ```
- **Alert**: Any process restart

**Panel 1.4: Saturation (CPU + Memory)**
- **Visualization**: Dual gauge
- **Metrics**: CPU usage percentage + Memory usage percentage
- **PromQL**:
```
  # CPU (user + system)
  rate(process_cpu_user_seconds_total[5m]) + rate(process_cpu_system_seconds_total[5m])

  # Memory percentage
  (process_resident_memory_bytes / machine_total_memory_bytes) * 100
  ```

#### Row 2: CPU Monitoring (USE Method)
**Panel 2.1: CPU Utilization**
- **Visualization**: Time series (stacked area)
- **Metrics**: User CPU + System CPU
- **PromQL**:
```
  # User CPU time
  rate(process_cpu_user_seconds_total[5m])

  # System CPU time
  rate(process_cpu_system_seconds_total[5m])
  ```
- **Legend**: User CPU, System CPU
- **Y-Axis**: Percentage (0-100%)

**Panel 2.2: CPU Saturation (Event Loop Utilization)**
- **Visualization**: Time series
- **Metric**: Event Loop Utilization (ELU)
- **Note**: Requires Node.js v12.19.0+ with ELU metrics
- **Purpose**: Percentage of time event loop is busy (saturation)

**Panel 2.3: CPU Errors**
- **Visualization**: Stat panel
- **Metric**: CPU-related errors (if any)
- **Note**: Typically none; include for completeness

#### Row 3: Memory Monitoring (USE Method)
**Panel 3.1: Memory Utilization**
- **Visualization**: Time series
- **Metrics**: Heap used, heap total, RSS, external memory
- **PromQL**:
```
  # Heap used
  nodejs_heap_size_used_bytes

  # Heap total
  nodejs_heap_size_total_bytes

  # Resident Set Size
  process_resident_memory_bytes

  # External memory (buffers, C++ objects)
  nodejs_external_memory_bytes
  ```
- **Legend**: Heap Used, Heap Total, RSS, External

**Panel 3.2: Memory Saturation (Heap Limit)**
- **Visualization**: Gauge
- **Metric**: Heap usage as percentage of limit
- **PromQL**:
```
  (nodejs_heap_size_used_bytes / nodejs_heap_space_size_total_bytes{space="total"}) * 100
  ```
- **Thresholds**:
  - Green: < 70%
  - Yellow: 70-85%
  - Red: > 85% (potential OOM)

**Panel 3.3: Garbage Collection Activity**
- **Visualization**: Time series
- **Metric**: GC duration and frequency
- **PromQL**:
```
  # GC duration histogram
  rate(nodejs_gc_duration_seconds_sum[5m])

  # GC count by type
  rate(nodejs_gc_duration_seconds_count[5m])
  ```
- **Purpose**: High GC frequency indicates memory pressure

#### Row 4: Disk and I/O (USE Method)
**Panel 4.1: Disk Space Utilization**
- **Visualization**: Gauge per mount point
- **Metric**: Disk usage percentage
- **Note**: Requires node_exporter or custom metrics (not in prom-client defaults)
- **PromQL**:
```
  # If using node_exporter
  (node_filesystem_size_bytes - node_filesystem_avail_bytes)
  /
  node_filesystem_size_bytes * 100
  ```

**Panel 4.2: File Descriptor Saturation**
- **Visualization**: Time series
- **Metric**: Open file descriptors vs limit
- **PromQL**:
```
  # Open FDs (Linux only)
  process_open_fds

  # Max FDs
  process_max_fds
  ```
- **Alert**: `process_open_fds / process_max_fds > 0.8`

**Panel 4.3: I/O Errors**
- **Visualization**: Stat panel
- **Metric**: Disk I/O errors (if available)
- **Note**: Typically requires OS-level monitoring

#### Row 5: Network Monitoring
**Panel 5.1: Network I/O**
- **Visualization**: Time series
- **Metrics**: Bytes received and transmitted
- **Note**: Requires node_exporter or custom instrumentation
- **PromQL**:
```
  # If using node_exporter
  rate(node_network_receive_bytes_total[5m])
  rate(node_network_transmit_bytes_total[5m])
  ```

**Panel 5.2: Socket Descriptors**
- **Visualization**: Time series
- **Metric**: Active socket connections
- **Purpose**: Detect connection leaks

#### Row 6: Node.js Runtime Health
**Panel 6.1: Active Handles**
- **Visualization**: Time series
- **Metric**: Number of active handles (timers, sockets, etc.)
- **PromQL**:
```
  nodejs_active_handles_total
  ```
- **Alert**: Unbounded growth indicates resource leak

**Panel 6.2: Active Requests**
- **Visualization**: Time series
- **Metric**: Number of active async requests
- **PromQL**:
```
  nodejs_active_requests_total
  ```

**Panel 6.3: Process Uptime**
- **Visualization**: Stat panel
- **Metric**: Process uptime in days
- **PromQL**:
```
  (time() - process_start_time_seconds) / 86400
  ```

**Panel 6.4: Node.js Version**
- **Visualization**: Text panel
- **Metric**: Node.js version info
- **Purpose**: Ensure version consistency across instances

#### Row 7: Heap Breakdown (Advanced)
**Panel 7.1: Heap Spaces**
- **Visualization**: Time series (stacked area)
- **Metrics**: Heap space usage by type
- **PromQL**:
```
  sum by (space) (nodejs_heap_space_size_used_bytes)
  ```
- **Legend**: `{{space}}` (new_space, old_space, code_space, map_space, large_object_space)
- **Purpose**: Identify specific memory allocation patterns

### Dashboard Variables

```json
{
  "templating": {
    "list": [
      {
        "name": "instance",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(process_cpu_user_seconds_total, instance)",
        "multi": false,
        "includeAll": false
      },
      {
        "name": "job",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(process_cpu_user_seconds_total, job)",
        "multi": false,
        "includeAll": false
      }
    ]
  }
}
```

### Best Practices for Infrastructure Dashboard

1. **Enable Default Metrics**: [prom-client documentation](https://github.com/siimon/prom-client)
```typescript
   const promClient = require('prom-client');
   promClient.collectDefaultMetrics({
     prefix: 'nodejs_',
     eventLoopMonitoringPrecision: 10 // milliseconds
   });
   ```

2. **Event Loop Monitoring**: [Node.js Performance Monitoring](https://betterstack.com/community/guides/scaling-nodejs/nodejs-prometheus/)
   - Event Loop Lag is the primary saturation metric for Node.js
   - Monitor Event Loop Utilization (ELU) if available
   - Alert on sustained lag > 50ms

3. **USE Method Application**: [Four Golden Signals](https://www.sysdig.com/blog/golden-signals-kubernetes)
   - **Utilization**: CPU %, Memory %, Disk %, FD usage
   - **Saturation**: Event loop lag, GC frequency, memory pressure
   - **Errors**: Process crashes, OOM kills, unhandled rejections

4. **Combine with node_exporter**: For comprehensive infrastructure monitoring
   - OS-level CPU, memory, disk, network metrics
   - More detailed than process-level metrics from prom-client

5. **Memory Leak Detection**:
   - Monitor heap growth over time
   - Alert on unbounded `nodejs_active_handles_total` growth
   - Track `nodejs_external_memory_bytes` for native module leaks

6. **GC Tuning**: Monitor GC patterns
   - Frequent scavenges (young generation): Normal for high-throughput apps
   - Frequent mark-sweep (old generation): Indicates memory pressure
   - Long GC pauses: Impact request latency

---

## Dashboard Structure & JSON Schema

### Basic Dashboard JSON Template

Based on [Grafana's Dashboard JSON Model](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/view-dashboard-json-model/):

```json
{
  "dashboard": {
    "id": null,
    "uid": "api-performance",
    "title": "API Performance Dashboard",
    "tags": ["api", "performance", "red-method"],
    "timezone": "browser",
    "schemaVersion": 39,
    "version": 1,
    "refresh": "30s",
    "time": {
      "from": "now-6h",
      "to": "now"
    },
    "timepicker": {
      "refresh_intervals": ["5s", "10s", "30s", "1m", "5m", "15m"],
      "time_options": ["5m", "15m", "1h", "6h", "12h", "24h", "2d", "7d"]
    },
    "templating": {
      "list": []
    },
    "annotations": {
      "list": []
    },
    "panels": [],
    "editable": true,
    "fiscalYearStartMonth": 0,
    "graphTooltip": 1,
    "links": []
  }
}
```

### Panel JSON Structure

```json
{
  "id": 1,
  "gridPos": {
    "x": 0,
    "y": 0,
    "w": 6,
    "h": 4
  },
  "type": "timeseries",
  "title": "Request Rate",
  "datasource": {
    "type": "prometheus",
    "uid": "${datasource}"
  },
  "targets": [
    {
      "expr": "sum(rate(http_request_duration_seconds_count[5m]))",
      "refId": "A",
      "legendFormat": "Requests/s"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "color": {
        "mode": "palette-classic"
      },
      "custom": {
        "axisLabel": "Requests per Second",
        "drawStyle": "line",
        "fillOpacity": 10,
        "showPoints": "never"
      },
      "thresholds": {
        "mode": "absolute",
        "steps": [
          { "value": null, "color": "green" },
          { "value": 1000, "color": "yellow" },
          { "value": 5000, "color": "red" }
        ]
      },
      "unit": "reqps"
    }
  },
  "options": {
    "legend": {
      "displayMode": "list",
      "placement": "bottom"
    },
    "tooltip": {
      "mode": "multi"
    }
  }
}
```

### Grid Layout System

- Dashboard width: 24 columns
- Grid height unit: 30 pixels
- gridPos properties:
  - `x`: Horizontal position (0-23)
  - `y`: Vertical position
  - `w`: Width in columns (1-24)
  - `h`: Height in grid units

**Common Panel Sizes**:
- Full width: `w: 24`
- Half width: `w: 12`
- Third width: `w: 8`
- Quarter width: `w: 6`
- Stat panels: `w: 6, h: 4`
- Time series: `w: 12, h: 8`
- Tables: `w: 24, h: 10`

### Row Structure

```json
{
  "type": "row",
  "collapsed": false,
  "title": "Request Rate Analysis",
  "gridPos": {
    "x": 0,
    "y": 0,
    "w": 24,
    "h": 1
  },
  "panels": []
}
```

### Template Variable Examples

```json
{
  "templating": {
    "list": [
      {
        "name": "datasource",
        "type": "datasource",
        "query": "prometheus",
        "current": {
          "value": "Prometheus",
          "text": "Prometheus"
        }
      },
      {
        "name": "instance",
        "type": "query",
        "datasource": "${datasource}",
        "query": "label_values(http_request_duration_seconds_count, instance)",
        "refresh": 1,
        "multi": false,
        "includeAll": false,
        "current": {
          "value": "",
          "text": ""
        }
      },
      {
        "name": "interval",
        "type": "interval",
        "query": "1m,5m,10m,30m,1h",
        "auto": true,
        "auto_count": 30,
        "auto_min": "10s",
        "current": {
          "value": "5m",
          "text": "5m"
        }
      }
    ]
  }
}
```

---

## Implementation Recommendations

### 1. Dashboard Development Workflow

Based on [GitOps for Grafana](https://grafana.co.za/dashboards-as-code-gitops-for-grafana/):

**Repository Structure**:
```
grafana/
├── dashboards/
│   ├── prod/
│   │   ├── api-performance.json
│   │   ├── message-processing.json
│   │   ├── database.json
│   │   └── infrastructure.json
│   ├── staging/
│   │   └── (same structure)
│   └── dev/
│       └── (same structure)
└── alerts/
    ├── critical-alerts.yml
    ├── warning-alerts.yml
    └── slo-alerts.yml
```

**Git Workflow**:
1. Develop dashboards in dev/ environment
2. Test and iterate with team feedback
3. Create PR to promote to staging/
4. After validation, promote to prod/
5. Use Git Sync (Grafana 12+) or Terraform for deployment

### 2. Incremental Implementation Plan

**Phase 1: Foundation (Week 1)**
- Implement fastify-metrics plugin
- Enable postgres_exporter
- Configure RabbitMQ Prometheus plugin
- Enable prom-client default metrics
- Verify metric collection in Prometheus

**Phase 2: API Performance Dashboard (Week 2)**
- Create basic RED method panels (rate, errors, duration)
- Add latency percentiles (p50, p95, p99)
- Implement histogram buckets aligned with SLOs
- Add template variables (instance, route)
- Test with load testing

**Phase 3: Message Processing Dashboard (Week 2)**
- Create queue depth monitoring
- Add throughput panels (publish/delivery rates)
- Implement retry and DLQ tracking
- Add consumer utilization metrics
- Configure alerts for queue saturation

**Phase 4: Database Dashboard (Week 3)**
- Enable pg_stat_statements extension
- Create connection pool panels
- Add cache hit ratio and transaction rate
- Implement replication lag monitoring (if applicable)
- Add slow query tracking

**Phase 5: Infrastructure Dashboard (Week 3)**
- Create USE method panels (utilization, saturation, errors)
- Add Node.js runtime metrics (heap, GC, event loop)
- Implement resource monitoring (CPU, memory, FDs)
- Add uptime and version tracking

**Phase 6: Refinement (Week 4)**
- Add SLO panels and error budgets
- Implement recording rules for performance
- Configure comprehensive alerting
- Create dashboard links and navigation
- Document dashboard usage

### 3. SLO and Alerting Strategy

Based on [Grafana SLO Documentation](https://grafana.com/docs/grafana-cloud/alerting-and-irm/slo/introduction/):

**Example SLOs**:
```yaml

# API Availability SLO

- name: api_availability
  target: 99.9%  # 43.2 minutes downtime per month
  window: 28d
  indicator:
    success_metric: sum(rate(http_request_duration_seconds_count{status_code!~"5.."}[5m]))
    total_metric: sum(rate(http_request_duration_seconds_count[5m]))

# API Latency SLO

- name: api_latency_p95
  target: 95%  # 95% of requests under 200ms
  window: 28d
  indicator:
    success_metric: |
      histogram_quantile(0.95,
        sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
      ) < 0.2
```

**Burn Rate Alerts**:
- **Fast burn** (1h window): Exhausting 5% of monthly budget in 1 hour
- **Slow burn** (6h window): Exhausting 5% of monthly budget in 6 hours

### 4. Performance Optimization

**Recording Rules**:
```yaml
groups:
  - name: api_performance
    interval: 30s
    rules:
      # Pre-calculate percentiles
      - record: api:http_request_duration_seconds:p95
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)
          )

      - record: api:http_request_duration_seconds:p99
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)
          )

      # Pre-calculate error rate
      - record: api:http_request_error_rate
        expr: |
          sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m])) by (route)
          /
          sum(rate(http_request_duration_seconds_count[5m])) by (route)
```

**Benefits**:
- Faster dashboard rendering
- Reduced Prometheus query load
- Consistent metric calculation across panels

### 5. Dashboard Maturity Levels

Based on [Grafana Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/):

**Level 1: Basic**
- Ad-hoc dashboard creation
- No version control
- Unrestricted editing
- Dashboard sprawl

**Level 2: Organized** (Current Target)
- Methodical organization (RED, USE, Four Golden Signals)
- JSON in version control (Git)
- Hierarchical design with drill-downs
- Template variables for filtering
- Meaningful visual conventions

**Level 3: Advanced** (Future State)
- Automated dashboard generation (Jsonnet, Grafonnet)
- CI/CD deployment pipeline
- Read-only browser access (edit via Git PR)
- Regular dashboard audits
- Comprehensive documentation
- Separate dev/staging/prod environments

### 6. Accessibility and Usability

**Color Blindness Considerations**:
- Use both color AND pattern/shape for differentiation
- Test dashboards with color blindness simulators
- Prefer Grafana's accessible color palettes

**Mobile Responsiveness**:
- Design for 24-column grid (auto-responsive)
- Test critical dashboards on mobile devices
- Use stat panels for mobile-friendly KPIs

**Documentation**:
- Add text panels explaining dashboard purpose
- Include links to runbooks and documentation
- Use panel descriptions (visible on hover)

### 7. Testing and Validation

**Load Testing**:
- Use k6 or Artillery to generate realistic traffic
- Verify metrics accuracy during load tests
- Validate alert thresholds under stress

**Dashboard Review Checklist**:
- [ ] All panels load within 5 seconds
- [ ] Template variables filter correctly
- [ ] Thresholds align with SLOs
- [ ] No data gaps or missing metrics
- [ ] Color coding is consistent
- [ ] Legends are descriptive
- [ ] Panel titles are clear
- [ ] Time ranges are appropriate
- [ ] Links to related dashboards work
- [ ] Documentation is complete

---

## References & Sources

### Official Documentation

- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)
- [Grafana Visualizations Guide](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/)
- [Grafana Dashboard JSON Model](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/view-dashboard-json-model/)
- [Grafana SLO Documentation](https://grafana.com/docs/grafana-cloud/alerting-and-irm/slo/introduction/)
- [Introduction to Histograms and Heatmaps](https://grafana.com/docs/grafana/latest/fundamentals/intro-histograms/)

### Monitoring Methodologies

- [Building a RED Dashboard](https://deepwiki.com/grafana/intro-to-prometheus-breakouts/5.1-building-a-red-dashboard)
- [Four Golden Signals of Monitoring](https://www.sysdig.com/blog/golden-signals-kubernetes)
- [Monitoring Golden Signals Dashboard](https://grafana.com/grafana/dashboards/21073-monitoring-golden-signals/)
- [P50 vs P95 vs P99 Latency Percentiles](https://oneuptime.com/blog/post/2025-09-15-p50-vs-p95-vs-p99-latency-percentiles/view)

### Technology-Specific Resources

**RabbitMQ:**
- [RabbitMQ Prometheus Monitoring](https://www.rabbitmq.com/docs/prometheus)
- [RabbitMQ Overview Dashboard](https://grafana.com/grafana/dashboards/10991-rabbitmq-overview/)
- [RabbitMQ Queue Dashboard](https://grafana.com/grafana/dashboards/17308-rabbitmq-queue/)
- [RabbitMQ Monitoring with Prometheus and Grafana](https://dev.to/fidelisesq/rabbitmq-monitoring-with-prometheus-and-grafana-4kj6)

**PostgreSQL:**
- [PostgreSQL Exporter (GitHub)](https://github.com/prometheus-community/postgres_exporter)
- [PostgreSQL Monitoring Tools 2025](https://uptrace.dev/tools/postgresql-monitoring-tools)
- [PostgreSQL Monitoring Dashboard](https://grafana.com/grafana/dashboards/24298-postgresql-monitoring-dashboard/)
- [PostgreSQL Performance Analysis Dashboard](https://grafana.com/grafana/dashboards/10521-postgresql-performance-analysis/)
- [PostgreSQL Monitoring Wiki](https://wiki.postgresql.org/wiki/Monitoring)
- [PostgreSQL Monitoring with Prometheus](https://www.sysdig.com/blog/postgresql-monitoring)

**Fastify/Node.js:**
- [fastify-metrics Plugin (GitHub)](https://github.com/SkeLLLa/fastify-metrics)
- [prom-client (GitHub)](https://github.com/siimon/prom-client)
- [Monitoring Node.js Apps with Prometheus](https://betterstack.com/community/guides/scaling-nodejs/nodejs-prometheus/)
- [Node.js Application Monitoring with Prometheus and Grafana](https://codersociety.com/blog/articles/nodejs-application-monitoring-with-prometheus-and-grafana)

### Prometheus/PromQL

- [Histogram Buckets in Prometheus](https://last9.io/blog/histogram-buckets-in-prometheus/)
- [Essential Prometheus Queries](https://last9.io/blog/prometheus-query-examples/)
- [Prometheus Metrics Types Deep Dive](https://last9.io/blog/prometheus-metrics-types-a-deep-dive/)
- [Practical Anomaly Detection with PromQL](https://grigorkh.medium.com/practical-anomaly-detection-with-prometheus-and-promql-d3027b97da96)
- [Introduction to Prometheus Metrics Types](https://chronosphere.io/learn/an-introduction-to-the-four-primary-types-of-prometheus-metrics/)

### DevOps & GitOps

- [Dashboards as Code: GitOps for Grafana](https://grafana.co.za/dashboards-as-code-gitops-for-grafana/)
- [Git Sync for Development and Production](https://grafana.com/docs/grafana-cloud/as-code/observability-as-code/provision-resources/git-sync-deployment-scenarios/dev-prod/)
- [Creating and Managing Dashboards using Terraform and GitHub Actions](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/dashboards-github-action/)

### Community Dashboards

- [Server Metrics - CPU/Memory/Disk/Network](https://grafana.com/grafana/dashboards/15334-server-metrics-cpu-memory-disk-network/)
- [grafana-dashboard GitHub Topic](https://github.com/topics/grafana-dashboard)
- [grafana-dashboards GitHub Topic](https://github.com/topics/grafana-dashboards)

---

## Appendix: Quick Start Checklist

### Prerequisites

- [ ] Prometheus server running and scraping metrics
- [ ] Grafana instance configured with Prometheus data source
- [ ] Application instrumented with metrics exporters

### Metrics Implementation

- [ ] `fastify-metrics` plugin installed and configured
- [ ] `prom-client` default metrics enabled
- [ ] `postgres_exporter` deployed and scraping PostgreSQL
- [ ] RabbitMQ Prometheus plugin enabled
- [ ] Metrics accessible at `/metrics` endpoints

### Dashboard Creation

- [ ] Create dashboard JSON files in version control
- [ ] Define template variables for filtering
- [ ] Implement RED method panels for API dashboard
- [ ] Configure queue monitoring for message processing
- [ ] Set up database connection pool monitoring
- [ ] Add infrastructure USE method panels
- [ ] Configure threshold colors and alerts
- [ ] Test dashboards with real traffic

### Production Readiness

- [ ] Document dashboard purpose and usage
- [ ] Configure SLO-based alerting
- [ ] Implement recording rules for performance
- [ ] Set up GitOps deployment pipeline
- [ ] Train team on dashboard navigation
- [ ] Schedule regular dashboard reviews
- [ ] Monitor dashboard performance (query times)

---

**End of Research Document**

*This research provides a comprehensive foundation for implementing production-grade Grafana dashboards. Each dashboard is designed following industry best practices and can be incrementally implemented over 4 weeks.*
