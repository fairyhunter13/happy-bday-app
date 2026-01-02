# New Grafana Dashboards - Implementation Summary

**Created:** January 1, 2026  
**Objective:** Create comprehensive Grafana dashboard templates for Birthday Scheduler monitoring

## Overview

Three new specialized Grafana dashboards have been created to provide comprehensive monitoring coverage for the Birthday Scheduler application. These dashboards leverage the 100+ metrics available in `metrics.service.ts`.

---

## 1. API Overview Dashboard

**File:** `api-overview.json`  
**Size:** 16KB  
**Panels:** 11 panels  
**Focus:** API request performance, errors, and latency

### Key Metrics Monitored

#### Request Metrics
- **API Request Rate (Total)** - Overall requests per second
- **API Requests by Status Range** - Breakdown by 2xx, 3xx, 4xx, 5xx
- **Active API Requests** - Currently processing requests

#### Error Tracking
- **API Error Rate** - Errors per second by error code
- **API Success Rate** - Gauge showing success percentage (SLO: >99%)
- **Validation Errors** - Request validation failures
- **API Timeouts** - Request timeout events

#### Performance Metrics
- **API Response Time Percentiles** - p50, p95, p99 latency distribution
- **Slow API Requests** - Requests exceeding latency threshold
- **Circuit Breaker Trips** - Circuit breaker activations (1-hour window)
- **API Health Score** - Composite health score (0-100)

### Metric Names Used
```
birthday_scheduler_api_requests_total
birthday_scheduler_api_errors_total
birthday_scheduler_api_response_time_seconds_bucket
birthday_scheduler_api_requests_by_status_range_total
birthday_scheduler_api_slow_requests_total
birthday_scheduler_api_timeouts_total
birthday_scheduler_api_validation_errors_total
birthday_scheduler_api_circuit_breaker_trips_total
birthday_scheduler_api_active_requests
birthday_scheduler_api_health_score
```

### Variables
- `$datasource` - Prometheus datasource
- `$namespace` - Kubernetes namespace filter
- `$instance` - Instance/pod multi-select filter
- `$interval` - Time aggregation (1m, 5m, 10m, 30m, 1h)

### SLO Thresholds
- **Success Rate:** >99% (green), 95-99% (yellow), <95% (red)
- **Response Time p99:** <1s target
- **Slow Requests:** Alert when >1 req/s
- **Timeouts:** Alert when >0.1 req/s

---

## 2. Birthday Processing Dashboard

**File:** `birthday-processing.json`  
**Size:** 20KB  
**Panels:** 16 panels  
**Focus:** Birthday processing, message delivery, and scheduler performance

### Key Metrics Monitored

#### Birthday Metrics
- **Birthdays Today** - Current count of birthdays
- **Birthdays Pending Processing** - Queue backlog
- **Birthdays Remaining Today** - Still to process
- **Birthday Processing Completions** - Processing rate

#### Message Flow
- **Message Processing Flow** - Scheduled → Sent → Failed
- **Message Success Rate** - Delivery success gauge (SLO: >95%)
- **Message Channels** - Breakdown by email, SMS, push
- **Birthday Greeting Types** - Greeting type distribution
- **Message Strategy Distribution** - By delivery strategy

#### Scheduler Performance
- **Scheduler Job Status** - Scheduled, Executed, Failed, Skipped
- **Scheduler Active/Pending Jobs** - Current job states
- **Scheduler Job Lag** - Lag behind schedule (seconds)
- **Scheduler Consecutive Failures** - Failure streak tracking
- **Scheduler Backlog Size** - Backlog items count

#### Processing Details
- **Birthday Scan Completions** - Scan success/error rate
- **Scheduled Message Dispatches** - Dispatch rate
- **Timezone Processing** - Timezone processing completions

### Metric Names Used
```
birthday_scheduler_birthdays_today
birthday_scheduler_birthdays_pending
birthday_scheduler_birthdays_remaining_today
birthday_scheduler_messages_scheduled_total
birthday_scheduler_messages_sent_total
birthday_scheduler_messages_failed_total
birthday_scheduler_birthdays_processed_total
birthday_scheduler_birthday_scan_completions_total
birthday_scheduler_birthday_scan_errors_total
birthday_scheduler_scheduler_jobs_scheduled_total
birthday_scheduler_scheduler_jobs_executed_total
birthday_scheduler_scheduler_job_failures_total
birthday_scheduler_scheduler_jobs_skipped_total
birthday_scheduler_scheduler_active_jobs
birthday_scheduler_scheduler_pending_jobs
birthday_scheduler_scheduler_running_jobs
birthday_scheduler_scheduler_job_lag
birthday_scheduler_scheduler_consecutive_failures
birthday_scheduler_scheduler_backlog_size
birthday_scheduler_messages_by_channel_total
birthday_scheduler_birthday_greeting_types_total
birthday_scheduler_birthday_messages_by_strategy_total
birthday_scheduler_scheduled_message_dispatches_total
birthday_scheduler_timezone_processing_completions_total
```

### Variables
- `$datasource` - Prometheus datasource
- `$namespace` - Kubernetes namespace filter
- `$instance` - Instance/pod multi-select filter
- `$interval` - Time aggregation (1m, 5m, 10m, 30m, 1h)

### Alerts Configured
- **High Scheduler Lag** - Alert when lag >60 seconds

### SLO Thresholds
- **Message Success Rate:** >95% (green), 90-95% (yellow), <90% (red)
- **Birthdays Pending:** <20 (green), 20-50 (yellow), >50 (red)
- **Scheduler Consecutive Failures:** 0 (green), 1-2 (yellow), >3 (red)

---

## 3. System Health Dashboard

**File:** `system-health.json`  
**Size:** 20KB  
**Panels:** 19 panels  
**Focus:** System resources, Node.js performance, and infrastructure health

### Key Metrics Monitored

#### Memory Management
- **Memory Usage** - RSS, Heap Used, Heap Total
- **V8 Heap Space Size** - Breakdown by space name
- **Memory Pool Utilization** - Pool utilization percentage
- **System Memory** - System-wide free vs total memory

#### CPU Performance
- **CPU Usage** - Total, User, System CPU
- **System Load Average** - System load average

#### Node.js Performance
- **Event Loop Lag** - Event loop lag in ms (target: <100ms)
- **Event Loop Utilization** - Utilization percentage
- **Node.js Active Handles** - File descriptors, timers, etc.
- **Node.js Active Requests** - Active async requests
- **Garbage Collection Events** - GC frequency by type

#### Resource Tracking
- **Database Connections** - Connection pool status
- **Active Workers** - Worker process count
- **File Descriptors** - Open vs max file descriptors
- **Process Uptime** - Process uptime in seconds

#### Cache Performance
- **Cache Hit Rate** - Hit rate percentage
- **Cache Operations** - Hits, Misses, Evictions

#### Connection Management
- **Connection Pool Wait Time** - Wait time in ms
- **Connection Pool Timeouts** - Timeout events (1-hour window)

### Metric Names Used
```
birthday_scheduler_process_resident_memory_bytes
birthday_scheduler_nodejs_heap_size_used_bytes
birthday_scheduler_nodejs_heap_size_total_bytes
birthday_scheduler_process_cpu_seconds_total
birthday_scheduler_process_cpu_user_seconds_total
birthday_scheduler_process_cpu_system_seconds_total
birthday_scheduler_database_connections
birthday_scheduler_database_pool_size
birthday_scheduler_database_pool_idle_connections
birthday_scheduler_active_workers
birthday_scheduler_node_event_loop_lag
birthday_scheduler_event_loop_utilization
birthday_scheduler_node_active_handles
birthday_scheduler_node_active_requests
birthday_scheduler_process_uptime_seconds
birthday_scheduler_cache_hit_rate
birthday_scheduler_cache_hits_total
birthday_scheduler_cache_misses_total
birthday_scheduler_cache_evictions_total
birthday_scheduler_process_open_file_descriptors
birthday_scheduler_process_max_file_descriptors
birthday_scheduler_gc_events_total
birthday_scheduler_v8_heap_space_size
birthday_scheduler_memory_pool_utilization
birthday_scheduler_system_load_average
birthday_scheduler_system_free_memory
birthday_scheduler_system_total_memory
birthday_scheduler_connection_pool_wait_time
birthday_scheduler_connection_pool_timeouts_total
```

### Variables
- `$datasource` - Prometheus datasource
- `$namespace` - Kubernetes namespace filter
- `$instance` - Instance/pod multi-select filter
- `$interval` - Time aggregation (1m, 5m, 10m, 30m, 1h)

### Alerts Configured
- **High CPU Usage** - Alert when CPU >80% for 5 minutes
- **High Event Loop Lag** - Alert when lag >100ms for 5 minutes

### Performance Targets
- **CPU Usage:** <60% (green), 60-80% (yellow), >80% (red)
- **Memory (Heap):** <70% (green), 70-90% (yellow), >90% (red)
- **Event Loop Lag:** <100ms (green), 100-500ms (yellow), >500ms (red)
- **Cache Hit Rate:** Target >80%

---

## Common Features Across All Dashboards

### Templating Variables
All dashboards include:
- **Datasource selector** - Choose Prometheus instance
- **Namespace filter** - Filter by Kubernetes namespace
- **Instance filter** - Multi-select for specific pods
- **Interval selector** - Adjustable time aggregation window

### Annotations
Each dashboard displays:
- **Alert Annotations** - Red markers showing when alerts fired
- **Alert Details** - Alert name and severity level
- **Context Integration** - Correlate metrics with alert events

### Navigation Links
- **Back to Overview** - Return to main overview dashboard
- **Related Dashboards** - Cross-links to related specialized dashboards

### Color Coding Standards
- **Green (#73BF69)** - Success, healthy, within SLO
- **Yellow (#FFAB00)** - Warning, approaching threshold
- **Orange (#FF9830)** - Elevated concern
- **Red (#F2495C)** - Critical, SLO violation, errors
- **Blue (#5794F2)** - Info, neutral data

---

## Dashboard Integration with Existing Dashboards

### Existing Dashboards (Preserved)
1. `overview-dashboard.json` - System-wide overview
2. `api-performance.json` - Detailed API metrics
3. `message-processing.json` - Message queue metrics
4. `database.json` - Database performance
5. `infrastructure.json` - Infrastructure health
6. `security.json` - Security events

### New Dashboards (Added)
7. `api-overview.json` - **NEW** - Focused API overview
8. `birthday-processing.json` - **NEW** - Birthday-specific processing
9. `system-health.json` - **NEW** - System resource health

### Navigation Flow
```
Overview Dashboard (Entry Point)
    │
    ├─→ API Overview Dashboard (NEW)
    │       └─→ API Performance Dashboard (detailed)
    │
    ├─→ Birthday Processing Dashboard (NEW)
    │       └─→ Message Processing Dashboard (queue details)
    │
    └─→ System Health Dashboard (NEW)
            └─→ Infrastructure Dashboard (detailed)
```

---

## Metrics Coverage

### Total Available Metrics (from metrics.service.ts)
- **Counters:** ~110 metrics
- **Gauges:** ~90 metrics
- **Histograms/Summaries:** ~20 metrics
- **Total:** 220+ metrics

### Metrics Used in New Dashboards
- **API Overview:** 10 unique metrics
- **Birthday Processing:** 23 unique metrics
- **System Health:** 28 unique metrics
- **Total Coverage:** 61 unique metrics across new dashboards

### Categories Covered
✅ API Performance  
✅ Birthday Processing  
✅ Scheduler Operations  
✅ Message Delivery  
✅ System Resources (CPU, Memory)  
✅ Node.js Performance  
✅ Cache Performance  
✅ Database Connections  
✅ Garbage Collection  
✅ Event Loop Health  

---

## Deployment Instructions

### 1. Validate JSON Files
```bash
# Validate JSON syntax
python3 -m json.tool grafana/dashboards/api-overview.json > /dev/null
python3 -m json.tool grafana/dashboards/birthday-processing.json > /dev/null
python3 -m json.tool grafana/dashboards/system-health.json > /dev/null
```

### 2. Import to Grafana

#### Option A: Grafana UI
1. Navigate to Grafana → Dashboards → Import
2. Upload each JSON file
3. Select Prometheus datasource
4. Click "Import"

#### Option B: Provisioning (Automated)
```yaml
# grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1
providers:
  - name: 'Birthday Scheduler'
    orgId: 1
    folder: 'Birthday Scheduler'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

### 3. Configure Prometheus
Ensure Prometheus is scraping metrics from the Birthday Scheduler application:
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'birthday-scheduler'
    static_configs:
      - targets: ['birthday-scheduler:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### 4. Verify Metrics
```bash
# Check metrics endpoint
curl http://birthday-scheduler:3000/metrics | grep birthday_scheduler_
```

---

## Testing Checklist

### Dashboard Functionality
- [ ] All panels render without errors
- [ ] Variables populate correctly (namespace, instance)
- [ ] Time range selection works
- [ ] Interval adjustment updates queries
- [ ] Annotations display (if alerts exist)

### Data Validation
- [ ] Metrics return data (not empty graphs)
- [ ] Calculations are correct (rates, percentiles)
- [ ] Thresholds trigger color changes
- [ ] Gauges show proper ranges (0-100%)

### Navigation
- [ ] Cross-dashboard links work
- [ ] Variables persist across navigation
- [ ] Time range syncs when following links
- [ ] "Back to Overview" links function

### Alerts
- [ ] Alert annotations appear on graphs
- [ ] Alert thresholds match expectations
- [ ] Alert frequency is appropriate (60s)

---

## Maintenance

### Regular Updates
- **Weekly:** Review dashboard performance, check for slow queries
- **Monthly:** Update thresholds based on SLO changes
- **Quarterly:** Add new metrics as application evolves

### Backup Strategy
```bash
# Backup before making changes
cp grafana/dashboards/api-overview.json grafana/dashboards/backups/api-overview-$(date +%Y%m%d).json
```

### Performance Optimization
If dashboards load slowly:
1. Use recording rules for expensive queries
2. Increase refresh interval (30s → 1m)
3. Limit time range for histogram queries
4. Adjust `$interval` for better resolution

---

## Next Steps

### Recommended Enhancements
1. **Add Recording Rules** - Pre-calculate expensive queries
   ```yaml
   # Example recording rule
   - record: api:request_rate:5m
     expr: sum(rate(birthday_scheduler_api_requests_total[5m])) by (method, path)
   ```

2. **Create Alert Rules** - Define alerts for critical metrics
   - High scheduler lag (>60s)
   - High CPU usage (>80%)
   - High event loop lag (>100ms)

3. **Add More Dashboards** - Expand coverage
   - Queue depth and message processing details
   - Database query performance breakdown
   - External API dependency monitoring

4. **Implement SLO Dashboards** - Track SLO compliance
   - API availability SLO (99.9%)
   - Message delivery SLO (95%)
   - Response time SLO (p99 <1s)

---

## Troubleshooting

### No Data in Panels
**Cause:** Prometheus not scraping metrics or wrong job name  
**Solution:** Check Prometheus targets, verify metrics endpoint

### Variables Not Populating
**Cause:** Label values don't exist in metrics  
**Solution:** Verify metric labels match variable queries

### Slow Dashboard Loading
**Cause:** Too many expensive queries  
**Solution:** Use recording rules, increase interval, limit time range

### Alerts Not Showing
**Cause:** Alert annotations query incorrect  
**Solution:** Verify ALERTS query matches your AlertManager setup

---

## References

- **Metrics Source:** `/src/services/metrics.service.ts`
- **Existing Dashboards:** `/grafana/dashboards/README.md`
- **Grafana Docs:** https://grafana.com/docs/grafana/latest/
- **Prometheus Queries:** https://prometheus.io/docs/prometheus/latest/querying/basics/

---

**End of Summary**
