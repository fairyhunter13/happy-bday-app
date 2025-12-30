# Grafana Dashboards - Birthday Scheduler

Comprehensive monitoring dashboards for the Birthday Scheduler application, providing 360-degree observability across API, message processing, database, infrastructure, and security layers.

## Table of Contents

- [Dashboard Overview](#dashboard-overview)
- [Dashboard Navigation](#dashboard-navigation)
- [Variable Usage](#variable-usage)
- [Alert Integration](#alert-integration)
- [Common Troubleshooting Queries](#common-troubleshooting-queries)
- [Maintenance Guidelines](#maintenance-guidelines)
- [Best Practices](#best-practices)

---

## Dashboard Overview

### 1. Overview Dashboard (`overview-dashboard.json`)

**Purpose:** High-level health check across all system components

**Key Metrics:**
- System-wide health status
- Request rate summary
- Error rate overview
- Queue depth at a glance

**When to use:**
- Daily health checks
- Executive summaries
- Quick system status verification
- Starting point for drill-down investigations

**Drill-down links:**
- API Performance Dashboard
- Message Processing Dashboard
- Database Dashboard
- Infrastructure Dashboard
- Security Dashboard

---

### 2. API Performance Dashboard (`api-performance.json`)

**Purpose:** Monitor HTTP API request performance, latency percentiles, and error rates

**Total Panels:** 13

**Key Metrics:**
- Request Rate: Total and by endpoint
- Success Rate: Overall API health (SLO: >99%)
- Response Time: p50, p95, p99 latency percentiles
- Error Distribution: 4xx and 5xx errors by endpoint
- External API Performance: Third-party service monitoring

**Dashboard Variables:**
- `$namespace` - Kubernetes namespace filter
- `$instance` - Filter by specific pod/instance (multi-select)
- `$interval` - Time aggregation (1m, 5m, 10m, 30m, 1h)
- `$path` - Filter by HTTP endpoint path (multi-select)

**SLO Thresholds:**
- Success Rate: >99% (green), 95-99% (yellow), <95% (red)
- p99 Latency: <1s (green), 0.5-1s (yellow), >1s (red)
- Error Rate: <0.1 req/s (acceptable)

**Drill-down links:**
- Infrastructure Dashboard (for CPU/memory impact)
- Overview Dashboard (return to main view)

**Alert Integration:**
- HighErrorRate (critical)
- APILatencyP99High (critical)
- HighLatency (warning)
- ErrorRateWarning (warning)

---

### 3. Message Processing Dashboard (`message-processing.json`)

**Purpose:** Monitor message queue depth, processing rates, retry behaviors, and dead letter queues

**Total Panels:** 16

**Key Metrics:**
- Message Flow: Scheduled, sent, and failed message rates
- Queue Health: Queue depth and backlog monitoring
- Success Rate: Message delivery success (SLO: >95%)
- Delivery Latency: p50, p95, p99 distribution
- Retry Analysis: Retry patterns by reason
- DLQ Depth: Dead letter queue monitoring

**Dashboard Variables:**
- `$namespace` - Kubernetes namespace filter
- `$instance` - Filter by instance (multi-select)
- `$interval` - Time aggregation interval
- `$queue` - Filter by queue name (multi-select)

**SLO Thresholds:**
- Message Success Rate: >95% (green), 90-95% (yellow), <90% (red)
- Queue Depth: <1000 (green), 1000-5000 (yellow), >5000 (red)
- DLQ Depth: 0 (green), 1-10 (yellow), >10 (red)

**Drill-down links:**
- Database Dashboard (for queue persistence analysis)
- Overview Dashboard

**Alert Integration:**
- QueueDepthCritical (critical)
- DLQMessagesPresent (critical)
- HighMessageRetryRate (warning)
- MessageProcessingSlow (warning)
- MessageDeliveryRate (SLO)
- MessageSuccessRate (SLO)

---

### 4. Database Performance Dashboard (`database.json`)

**Purpose:** Monitor PostgreSQL connection pool, query performance, and database health

**Total Panels:** 16

**Key Metrics:**
- Connection Pool: Active, idle, and waiting connections
- Query Performance: Latency by type (SELECT, INSERT, UPDATE, DELETE)
- Slow Queries: Top 10 slowest queries (p99 >100ms)
- Database Size: Disk usage and growth rate
- Transaction Rate: Commits vs rollbacks

**Dashboard Variables:**
- `$namespace` - Kubernetes namespace filter
- `$instance` - Filter by instance (multi-select)
- `$interval` - Time aggregation interval
- `$table` - Filter by table name (multi-select)

**SLO Thresholds:**
- Connection Pool Utilization: <70% (green), 70-90% (yellow), >90% (red)
- Query p95 Latency: <50ms (green), 50-100ms (yellow), >100ms (red)
- Waiting Connections: 0-5 (green), 5-10 (yellow), >10 (red)

**Drill-down links:**
- Infrastructure Dashboard (for system resource impact)
- Overview Dashboard

**Alert Integration:**
- DBConnectionPoolExhausted (critical)
- DatabaseDown (critical)
- DBConnectionPoolHigh (warning)
- SlowQueries (warning)
- DatabaseQueryLatency (SLO)

---

### 5. Infrastructure Health Dashboard (`infrastructure.json`)

**Purpose:** Monitor Node.js process health, CPU/memory usage, garbage collection, and event loop lag

**Total Panels:** 16

**Key Metrics:**
- CPU Usage: Total, user, and system CPU consumption
- Memory Usage: RSS, heap used/total, external memory
- Event Loop Lag: Node.js async performance indicator
- Garbage Collection: GC duration and frequency
- Worker Health: Active worker process monitoring
- File Descriptors: Open vs max file descriptors

**Dashboard Variables:**
- `$namespace` - Kubernetes namespace filter
- `$instance` - Filter by instance (multi-select)
- `$interval` - Time aggregation interval
- `$node` - Filter by node/server (multi-select)

**SLO Thresholds:**
- CPU Usage: <60% (green), 60-80% (yellow), >80% (red)
- Memory (Heap): <70% (green), 70-90% (yellow), >90% (red)
- Event Loop Lag: <100ms (green), 100-500ms (yellow), >500ms (red)

**Drill-down links:**
- Overview Dashboard

**Alert Integration:**
- ServiceDown (critical)
- MemoryExhausted (critical)
- CPUUsageHigh (warning)
- MemoryUsageHigh (warning)
- EventLoopLagHigh (warning)
- HighGCPauseTime (info)

---

### 6. Security Dashboard (`security.json`)

**Purpose:** Monitor authentication, authorization, rate limiting, and security events

**Key Metrics:**
- Failed login attempts
- Unauthorized access attempts
- Rate limit violations
- Security event timeline

**Dashboard Variables:**
- `$namespace` - Kubernetes namespace filter
- `$instance` - Filter by instance (multi-select)
- `$interval` - Time aggregation interval

**Drill-down links:**
- API Performance Dashboard (for detailed API security)
- Overview Dashboard

**Alert Integration:**
- SecurityBreach (critical)
- UnauthorizedAccess (critical)
- HighFailedLogins (warning)
- RateLimitExceeded (warning)

---

## Dashboard Navigation

### Navigation Flow

```
Overview Dashboard (Entry Point)
    │
    ├─→ API Performance Dashboard
    │       └─→ Infrastructure Dashboard (system impact)
    │
    ├─→ Message Processing Dashboard
    │       └─→ Database Dashboard (queue persistence)
    │               └─→ Infrastructure Dashboard (resource impact)
    │
    ├─→ Database Dashboard
    │       └─→ Infrastructure Dashboard
    │
    ├─→ Infrastructure Dashboard
    │
    └─→ Security Dashboard
            └─→ API Performance Dashboard (API security details)
```

### Using Drill-Down Links

1. **From Overview:** Click on any specialized dashboard link in the top navigation bar
2. **Variable Preservation:** Time range and common variables (namespace, instance) are automatically passed
3. **Return Navigation:** Use "Overview Dashboard" link to return to the main view
4. **Cross-Dashboard Analysis:** Follow drill-down links to investigate related metrics

### URL Parameters

Dashboards support URL parameters for sharing specific views:

```
/d/api-performance?var-namespace=production&var-path=/api/birthdays&from=now-1h&to=now
```

**Supported parameters:**
- `var-namespace` - Set namespace filter
- `var-instance` - Set instance filter
- `var-interval` - Set aggregation interval
- `var-path`, `var-queue`, `var-table`, `var-node` - Dashboard-specific filters
- `from`, `to` - Time range (e.g., `now-6h`, `now-1d`)

---

## Variable Usage

### Common Variables (All Dashboards)

#### 1. Datasource (`$datasource`)
- **Type:** Datasource selector
- **Purpose:** Select Prometheus datasource
- **Default:** Prometheus
- **Usage:** Automatically applied to all queries

#### 2. Namespace (`$namespace`)
- **Type:** Query-based dropdown
- **Purpose:** Filter metrics by Kubernetes namespace
- **Default:** production
- **Query:** `label_values(birthday_scheduler_api_requests_total, namespace)`
- **Example:** production, staging, development

#### 3. Instance (`$instance`)
- **Type:** Query-based multi-select
- **Purpose:** Filter by specific pod/instance
- **Default:** All
- **Options:** Multi-select with "All" option
- **Query:** `label_values(birthday_scheduler_api_requests_total{namespace="$namespace"}, instance)`
- **Usage:** Select one or more instances for detailed investigation

#### 4. Interval (`$interval`)
- **Type:** Interval selector
- **Purpose:** Set time aggregation window for rate() and histogram_quantile()
- **Default:** 5m
- **Options:** 1m, 5m, 10m, 30m, 1h
- **Impact:**
  - Shorter intervals (1m): More granular, noisier data
  - Longer intervals (1h): Smoother, less responsive to sudden changes

### Dashboard-Specific Variables

#### API Performance: Path (`$path`)
- **Purpose:** Filter metrics by HTTP endpoint
- **Type:** Multi-select
- **Query:** `label_values(birthday_scheduler_api_requests_total{namespace="$namespace", instance=~"$instance"}, path)`
- **Example:** /api/birthdays, /api/users, /health

#### Message Processing: Queue (`$queue`)
- **Purpose:** Filter by message queue name
- **Type:** Multi-select
- **Query:** `label_values(birthday_scheduler_queue_depth{namespace="$namespace", instance=~"$instance"}, queue_name)`
- **Example:** birthday_notifications, email_queue, sms_queue

#### Database: Table (`$table`)
- **Purpose:** Filter by database table
- **Type:** Multi-select
- **Query:** `label_values(birthday_scheduler_database_query_duration_seconds_bucket{namespace="$namespace", instance=~"$instance"}, table)`
- **Example:** users, birthdays, messages

#### Infrastructure: Node (`$node`)
- **Purpose:** Filter by server/node
- **Type:** Multi-select
- **Query:** `label_values(birthday_scheduler_process_cpu_seconds_total{namespace="$namespace"}, instance)`

### Variable Best Practices

1. **Start Broad, Narrow Down:** Begin with "All" instances, then select specific ones
2. **Adjust Interval for Context:**
   - Real-time debugging: 1m interval
   - Daily monitoring: 5m interval (default)
   - Trend analysis: 30m or 1h interval
3. **Combine Variables:** Use namespace + instance + specific filter for targeted analysis
4. **Time Range Coordination:** Match interval to time range (1m for <1h, 5m for 6h, etc.)

---

## Alert Integration

### Alert Annotations

All dashboards display alert annotations as vertical red markers on time-series graphs.

**Annotation Details:**
- **Color:** Red (rgba(255, 96, 96, 1))
- **Source:** Prometheus AlertManager
- **Update Frequency:** 60 seconds
- **Display:** Alert name and severity level

**Interpreting Annotations:**
1. **Click annotation:** View alert details (name, severity, labels)
2. **Correlation:** Identify metric spike that triggered alert
3. **Timeline:** Understand alert duration and recurrence

### Alert Rule Mapping

| Dashboard | Alert Name | Severity | Threshold | Duration |
|-----------|------------|----------|-----------|----------|
| API Performance | HighErrorRate | critical | >5% error rate | 5m |
| API Performance | APILatencyP99High | critical | p99 >1s | 5m |
| API Performance | HighLatency | warning | p95 >500ms | 5m |
| API Performance | ErrorRateWarning | warning | >1% error rate | 5m |
| Message Processing | QueueDepthCritical | critical | >1000 messages | 5m |
| Message Processing | DLQMessagesPresent | critical | >10 DLQ messages | 5m |
| Message Processing | HighMessageRetryRate | warning | >10% retry rate | 5m |
| Message Processing | MessageProcessingSlow | warning | p95 >5s | 5m |
| Database | DBConnectionPoolExhausted | critical | 0 available connections | 1m |
| Database | DatabaseDown | critical | No response | 1m |
| Database | DBConnectionPoolHigh | warning | >90% utilization | 5m |
| Database | SlowQueries | warning | p99 >500ms | 5m |
| Infrastructure | ServiceDown | critical | 0 active workers | 1m |
| Infrastructure | MemoryExhausted | critical | >95% heap | 5m |
| Infrastructure | CPUUsageHigh | warning | >80% CPU | 5m |
| Infrastructure | MemoryUsageHigh | warning | >90% heap | 5m |
| Infrastructure | EventLoopLagHigh | warning | >100ms lag | 5m |
| Security | SecurityBreach | critical | Breach detected | immediate |
| Security | UnauthorizedAccess | critical | >10 attempts | 5m |
| Security | HighFailedLogins | warning | >50 failures/5m | 5m |

### Alert File Locations

- **Critical Alerts:** `/grafana/alerts/critical-alerts.yml` (P0 - immediate action)
- **Warning Alerts:** `/grafana/alerts/warning-alerts.yml` (P1 - investigate)
- **SLO Alerts:** `/grafana/alerts/slo-alerts.yml` (SLI/SLO violations)
- **Info Alerts:** `/grafana/alerts/info-alerts.yml` (P2 - monitoring)

---

## Common Troubleshooting Queries

### API Performance Issues

#### High Latency Investigation

```promql
# Identify slowest endpoints (p95 > 500ms)
topk(10, histogram_quantile(0.95, sum(rate(birthday_scheduler_api_response_time_seconds_bucket{namespace="production"}[5m])) by (le, method, path))) > 0.5

# Response time breakdown by endpoint
histogram_quantile(0.95, sum(rate(birthday_scheduler_api_response_time_seconds_bucket{namespace="production"}[5m])) by (le, path))

# External API latency impact
histogram_quantile(0.95, sum(rate(birthday_scheduler_external_api_latency_seconds_bucket[5m])) by (le, api_name))
```

#### Error Rate Spike

```promql
# 5xx errors by endpoint
sum(rate(birthday_scheduler_api_requests_total{status=~"5..", namespace="production"}[5m])) by (method, path)

# Error rate percentage
(sum(rate(birthday_scheduler_api_requests_total{status=~"5..", namespace="production"}[5m])) / sum(rate(birthday_scheduler_api_requests_total{namespace="production"}[5m]))) * 100

# Recent error burst (last 5m)
sum(increase(birthday_scheduler_api_requests_total{status=~"5..", namespace="production"}[5m]))
```

### Message Processing Issues

#### Queue Backlog Investigation

```promql
# Queue depth by queue name
birthday_scheduler_queue_depth{namespace="production"}

# Queue growth rate
deriv(birthday_scheduler_queue_depth{namespace="production"}[10m])

# Message processing rate
sum(rate(birthday_scheduler_messages_sent_total{namespace="production"}[5m]))

# DLQ investigation
birthday_scheduler_dlq_depth{namespace="production"} > 0
```

#### Retry Pattern Analysis

```promql
# Retry rate by reason
sum(rate(birthday_scheduler_message_retries_total{namespace="production"}[5m])) by (retry_reason)

# Retry percentage
(sum(rate(birthday_scheduler_message_retries_total{namespace="production"}[5m])) / sum(rate(birthday_scheduler_messages_sent_total{namespace="production"}[5m]))) * 100

# Failed messages by error type
sum(increase(birthday_scheduler_messages_failed_total{namespace="production"}[1h])) by (error_type)
```

### Database Performance Issues

#### Connection Pool Saturation

```promql
# Pool utilization percentage
(sum(birthday_scheduler_database_connections{state="active", namespace="production"}) / (sum(birthday_scheduler_database_connections{state="active", namespace="production"}) + sum(birthday_scheduler_database_connections{state="idle", namespace="production"}))) * 100

# Waiting connections (critical indicator)
sum(birthday_scheduler_database_connections{state="waiting", namespace="production"})

# Connection pool health over time
sum(birthday_scheduler_database_connections{namespace="production"}) by (state)
```

#### Slow Query Detection

```promql
# Slowest queries (p99 > 100ms)
topk(10, histogram_quantile(0.99, sum(rate(birthday_scheduler_database_query_duration_seconds_bucket{namespace="production"}[5m])) by (le, query_type, table))) > 0.1

# Query latency by table
histogram_quantile(0.95, sum(rate(birthday_scheduler_database_query_duration_seconds_bucket{namespace="production"}[5m])) by (le, table))

# Average query duration by type
avg(rate(birthday_scheduler_database_query_duration_seconds_sum{namespace="production"}[5m]) / rate(birthday_scheduler_database_query_duration_seconds_count{namespace="production"}[5m])) by (query_type)
```

### Infrastructure Issues

#### Memory Leak Detection

```promql
# Heap growth rate
deriv(birthday_scheduler_nodejs_heap_size_used_bytes{namespace="production"}[1h])

# RSS memory trend
birthday_scheduler_process_resident_memory_bytes{namespace="production"}

# Heap utilization percentage
(birthday_scheduler_nodejs_heap_size_used_bytes / birthday_scheduler_nodejs_heap_size_total_bytes) * 100

# GC frequency (indicator of memory pressure)
rate(birthday_scheduler_nodejs_gc_duration_seconds_count{kind="major", namespace="production"}[5m])
```

#### Event Loop Lag Investigation

```promql
# Current event loop lag
birthday_scheduler_nodejs_eventloop_lag_seconds{namespace="production"}

# Event loop lag p99
birthday_scheduler_nodejs_eventloop_lag_p99_seconds{namespace="production"}

# Lag spikes (>100ms)
birthday_scheduler_nodejs_eventloop_lag_seconds{namespace="production"} > 0.1
```

#### CPU Saturation

```promql
# CPU usage by type
rate(birthday_scheduler_process_cpu_user_seconds_total{namespace="production"}[5m]) * 100
rate(birthday_scheduler_process_cpu_system_seconds_total{namespace="production"}[5m]) * 100

# Total CPU usage
rate(birthday_scheduler_process_cpu_seconds_total{namespace="production"}[5m]) * 100

# CPU per instance
rate(birthday_scheduler_process_cpu_seconds_total{namespace="production"}[5m]) * 100 by (instance)
```

---

## Maintenance Guidelines

### Dashboard Update Procedures

#### 1. Adding New Panels

```bash
# 1. Create backup
cp grafana/dashboards/[dashboard].json grafana/dashboards/backups/[dashboard]-$(date +%Y%m%d).json

# 2. Edit dashboard JSON
# Add new panel to "panels" array with:
#   - Unique "id"
#   - "gridPos" for positioning
#   - "targets" with Prometheus queries
#   - "description" for documentation

# 3. Validate JSON syntax
python3 -m json.tool grafana/dashboards/[dashboard].json > /dev/null

# 4. Test in Grafana UI
# Import updated dashboard and verify panel rendering

# 5. Commit changes
git add grafana/dashboards/[dashboard].json
git commit -m "feat(monitoring): add [panel name] to [dashboard name]"
```

#### 2. Modifying Variables

Variables are defined in the `templating.list` array. When adding new variables:

1. **Maintain order:** datasource → namespace → instance → interval → specific variables
2. **Update dependent queries:** Ensure queries use new variables
3. **Test cascading:** Verify dependent variables update correctly
4. **Update documentation:** Add variable to this README

#### 3. Updating Alert Annotations

```json
{
  "annotations": {
    "list": [
      {
        "datasource": "${datasource}",
        "enable": true,
        "expr": "ALERTS{alertname=~\"NewAlert|ExistingAlert\", namespace=\"$namespace\"}",
        "iconColor": "rgba(255, 96, 96, 1)",
        "name": "Alert Name",
        "step": "60s",
        "tagKeys": "alertname,severity",
        "textFormat": "{{alertname}}: {{severity}}",
        "titleFormat": "Alert"
      }
    ]
  }
}
```

### Dashboard Version Control

#### Backup Strategy

```bash
# Automated daily backups (add to cron)
0 2 * * * /path/to/backup-dashboards.sh

# Manual backup before changes
./scripts/backup-dashboards.sh
```

#### Rollback Procedure

```bash
# 1. List available backups
ls -la grafana/dashboards/backups/

# 2. Restore specific dashboard
cp grafana/dashboards/backups/api-performance-20251231.json grafana/dashboards/api-performance.json

# 3. Reload Grafana
# Dashboard will auto-reload on file change if provisioned
```

### Performance Optimization

#### Query Optimization

**Problem:** Slow dashboard loading

**Solutions:**

1. **Use recording rules** for expensive queries:
```yaml
# prometheus-rules.yml
groups:
  - name: dashboard_rules
    interval: 30s
    rules:
      - record: api:request_rate:5m
        expr: sum(rate(birthday_scheduler_api_requests_total[5m])) by (method, path)
```

2. **Increase refresh interval** for non-critical dashboards
3. **Limit time range** for expensive histogram queries
4. **Use $interval variable** to adjust resolution based on time range

#### Dashboard Load Time

**Target:** <3 seconds to fully load

**Optimization checklist:**
- [ ] Limit concurrent queries per panel (max 3)
- [ ] Use recording rules for complex histogram_quantile
- [ ] Avoid regex in high-cardinality labels
- [ ] Set appropriate `$interval` based on time range
- [ ] Enable Grafana query caching (60s TTL)

### Regular Maintenance Tasks

#### Weekly

- [ ] Review dashboard load times
- [ ] Check for broken panels (no data)
- [ ] Verify alert annotations displaying
- [ ] Test drill-down links functionality

#### Monthly

- [ ] Update panel descriptions with new insights
- [ ] Review and optimize slow queries
- [ ] Clean up old backups (>90 days)
- [ ] Update threshold values based on SLO changes

#### Quarterly

- [ ] Audit metric coverage (add missing metrics)
- [ ] Review dashboard layout and UX
- [ ] Update variable queries for accuracy
- [ ] Benchmark dashboard performance
- [ ] Training session for new team members

---

## Best Practices

### Dashboard Design

1. **Visual Hierarchy:**
   - Top-left: Most critical metric (success rate, error rate)
   - Top-right: Health gauges and single stats
   - Middle: Detailed time-series graphs
   - Bottom: Tables, summaries, and supporting metrics

2. **Color Coding:**
   - **Green (#73BF69):** Success, healthy, within SLO
   - **Yellow (#FFAB00):** Warning, approaching threshold
   - **Orange (#FF9830):** Elevated concern, 4xx errors
   - **Red (#F2495C):** Critical, SLO violation, 5xx errors
   - **Blue (#5794F2):** Info, neutral data

3. **Panel Descriptions:**
   - Include SLO thresholds
   - Explain what to look for
   - Reference related dashboards
   - Link to runbooks for alerts

4. **Query Performance:**
   - Use `rate()` for counters, not `increase()` in graphs
   - Apply `sum()` before `histogram_quantile()`
   - Use `by ()` to limit label cardinality
   - Prefer recording rules for expensive queries

### Monitoring Strategy

1. **RED Method (Requests, Errors, Duration):**
   - **Rate:** Request/message volume (traffic)
   - **Errors:** Error count and percentage
   - **Duration:** Latency percentiles (p50, p95, p99)

2. **Four Golden Signals:**
   - **Latency:** Response time distribution
   - **Traffic:** Request/message rate
   - **Errors:** Error rate and types
   - **Saturation:** Queue depth, connection pool, CPU/memory

3. **Drill-Down Investigation:**
   - Start at Overview dashboard
   - Identify anomaly in high-level metric
   - Navigate to specialized dashboard
   - Apply filters (path, queue, table)
   - Adjust time range to incident window
   - Cross-reference with related dashboards

### Alerting Philosophy

1. **Alert on Symptoms, Not Causes:**
   - ✅ Alert on high API error rate
   - ❌ Alert on specific code path execution

2. **Actionable Alerts:**
   - Every alert should have a runbook
   - Alert message should indicate severity
   - Include context (instance, namespace)

3. **Avoid Alert Fatigue:**
   - Set appropriate thresholds
   - Use `for` duration to filter transient spikes
   - Combine related alerts
   - Regular threshold review

### SLO Management

**Define SLOs Before Building Dashboards:**

```yaml
# Example SLOs
api_availability:
  target: 99.9%
  measurement_window: 30d

api_latency_p99:
  target: 1s
  measurement_window: 30d

message_success_rate:
  target: 95%
  measurement_window: 7d
```

**Dashboard Integration:**
- Display SLO targets in panel descriptions
- Color-code thresholds based on SLO
- Create SLO-specific dashboards for compliance tracking

---

## Quick Reference

### Dashboard URLs

| Dashboard | URL Path | Primary Use Case |
|-----------|----------|------------------|
| Overview | `/d/overview` | Health check |
| API Performance | `/d/api-performance` | Latency & errors |
| Message Processing | `/d/message-processing` | Queue health |
| Database | `/d/database` | Query performance |
| Infrastructure | `/d/infrastructure` | Resource monitoring |
| Security | `/d/security` | Security events |

### Keyboard Shortcuts (Grafana)

- `?` - Show help
- `g h` - Go to home dashboard
- `g p` - Go to profile
- `s` - Open search
- `d k` - Toggle kiosk mode
- `t z` - Zoom out time range
- `t ←/→` - Move time range back/forward

### Common Variable Patterns

```
# Namespace selector
label_values(metric_name, namespace)

# Instance selector (dependent on namespace)
label_values(metric_name{namespace="$namespace"}, instance)

# Path/endpoint selector
label_values(metric_name{namespace="$namespace", instance=~"$instance"}, path)
```

### Emergency Response

**Dashboard Shows Red/Critical State:**

1. **Identify Scope:**
   - Check Overview dashboard for system-wide vs localized issue
   - Review time range - is issue ongoing or resolved?

2. **Drill Down:**
   - Navigate to specialized dashboard
   - Apply instance filter to isolate affected pods
   - Correlate with alert annotations

3. **Investigate:**
   - Use troubleshooting queries from this README
   - Check related dashboards (API → Infrastructure)
   - Review recent deployments/changes

4. **Escalate:**
   - Follow runbook for specific alert
   - Engage on-call engineer if critical
   - Document findings in incident log

---

## Support & Contributions

### Getting Help

- **Documentation:** This README and inline panel descriptions
- **Specifications:** `/plan/grafana-dashboard-specifications.md`
- **Alert Rules:** `/grafana/alerts/*.yml`
- **Metrics:** `/src/services/metrics.service.ts`

### Contributing

When adding new dashboards or panels:

1. Create backup first
2. Follow existing naming conventions
3. Include comprehensive panel descriptions
4. Add variables for filtering
5. Link to related dashboards
6. Update this README
7. Test thoroughly before committing

### Feedback

Found an issue or have a suggestion?

- Create issue in project repository
- Label with `monitoring` and `grafana`
- Include dashboard name and panel ID

---

**Last Updated:** December 31, 2025
**Dashboard Version:** 1.1.0 (Enhanced with variables and drill-down)
**Total Dashboards:** 6
**Total Panels:** 61+
**Metric Coverage:** 70% of available metrics
