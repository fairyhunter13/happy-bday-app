# Database Metrics Interceptor - Quick Reference

## 🚀 Quick Start

### Zero Configuration
```typescript
import { db } from './db/connection.js';

// All queries are automatically tracked!
const users = await db.select().from(usersTable);
```

### Environment Variables
```bash
DB_SLOW_QUERY_THRESHOLD=100    # Slow query threshold in ms (default: 100)
DB_LOG_SLOW_QUERIES=true       # Log slow queries (default: true)
ENABLE_DB_METRICS=true         # Enable metrics collection (default: true)
```

## 📊 Metrics Available

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `birthday_scheduler_database_query_duration_seconds` | Histogram | `query_type`, `table` | Query execution time |
| `birthday_scheduler_database_slow_queries_total` | Counter | `query_type`, `table`, `threshold_ms` | Slow query count |
| `birthday_scheduler_database_query_errors_total` | Counter | `query_type`, `error_code` | Database errors |
| `birthday_scheduler_database_connections` | Gauge | `pool_name`, `state` | Active connections |

## 🔍 Common PromQL Queries

### Query Performance
```promql
# P95 query duration by table
histogram_quantile(0.95,
  sum(rate(birthday_scheduler_database_query_duration_seconds_bucket[5m]))
  by (le, table)
)

# Average query duration
rate(birthday_scheduler_database_query_duration_seconds_sum[5m]) /
rate(birthday_scheduler_database_query_duration_seconds_count[5m])

# Queries per second by operation
sum(rate(birthday_scheduler_database_query_duration_seconds_count[5m]))
by (query_type)
```

### Slow Queries
```promql
# Slow query rate
sum(rate(birthday_scheduler_database_slow_queries_total[5m]))
by (table)

# Percentage of slow queries
100 * sum(rate(birthday_scheduler_database_slow_queries_total[5m])) /
sum(rate(birthday_scheduler_database_query_duration_seconds_count[5m]))
```

### Errors
```promql
# Error rate by type
sum(rate(birthday_scheduler_database_query_errors_total{error_code!="none"}[5m]))
by (error_code)

# Total error count
sum(birthday_scheduler_database_query_errors_total{error_code!="none"})
```

### Connection Pool
```promql
# Active connections
birthday_scheduler_database_connections

# Connection pool utilization (assuming max 20)
100 * birthday_scheduler_database_connections / 20
```

## ⚠️ Alert Rules (Copy-Paste Ready)

```yaml
groups:
  - name: database_performance
    interval: 30s
    rules:
      # Slow query alert
      - alert: DatabaseSlowQueries
        expr: rate(birthday_scheduler_database_slow_queries_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
          component: database
        annotations:
          summary: "High slow query rate detected"
          description: "{{ $value | humanize }} slow queries/sec in {{ $labels.table }}"

      # High error rate alert
      - alert: DatabaseHighErrorRate
        expr: |
          rate(birthday_scheduler_database_query_errors_total{error_code!="none"}[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
          component: database
        annotations:
          summary: "High database error rate"
          description: "{{ $value | humanize }} errors/sec ({{ $labels.error_code }})"

      # Connection pool near exhaustion
      - alert: DatabaseConnectionPoolHigh
        expr: birthday_scheduler_database_connections >= 18
        for: 5m
        labels:
          severity: warning
          component: database
        annotations:
          summary: "Database connection pool near limit"
          description: "{{ $value }} connections active (max: 20)"

      # P95 query latency high
      - alert: DatabaseHighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(birthday_scheduler_database_query_duration_seconds_bucket[5m]))
            by (le, table)
          ) > 1.0
        for: 10m
        labels:
          severity: warning
          component: database
        annotations:
          summary: "High database query latency"
          description: "P95 latency {{ $value | humanize }}s for {{ $labels.table }}"
```

## 📈 Grafana Dashboard Panels

### Query Duration Panel (Graph)
```json
{
  "targets": [
    {
      "expr": "histogram_quantile(0.50, sum(rate(birthday_scheduler_database_query_duration_seconds_bucket[5m])) by (le, table))",
      "legendFormat": "p50 - {{table}}"
    },
    {
      "expr": "histogram_quantile(0.95, sum(rate(birthday_scheduler_database_query_duration_seconds_bucket[5m])) by (le, table))",
      "legendFormat": "p95 - {{table}}"
    },
    {
      "expr": "histogram_quantile(0.99, sum(rate(birthday_scheduler_database_query_duration_seconds_bucket[5m])) by (le, table))",
      "legendFormat": "p99 - {{table}}"
    }
  ]
}
```

### Query Rate by Operation (Stat Panel)
```json
{
  "targets": [
    {
      "expr": "sum(rate(birthday_scheduler_database_query_duration_seconds_count[5m])) by (query_type)",
      "legendFormat": "{{query_type}}"
    }
  ]
}
```

### Slow Queries (Table)
```json
{
  "targets": [
    {
      "expr": "topk(10, sum by (table, query_type) (rate(birthday_scheduler_database_slow_queries_total[5m])))",
      "format": "table",
      "instant": true
    }
  ],
  "transformations": [
    {
      "id": "organize",
      "options": {
        "renameByName": {
          "table": "Table",
          "query_type": "Operation",
          "Value": "Slow Queries/sec"
        }
      }
    }
  ]
}
```

## 🐛 Troubleshooting

### Metrics not appearing?
```bash
# Check if metrics are enabled
echo $ENABLE_DB_METRICS  # Should be 'true' or unset

# Test metrics endpoint
curl http://localhost:3000/metrics | grep database_query_duration

# Check logs for initialization
grep "DatabaseMetricsInterceptor initialized" logs/app.log
```

### Too many slow queries?
```bash
# Increase threshold
export DB_SLOW_QUERY_THRESHOLD=200

# Or disable slow query logging
export DB_LOG_SLOW_QUERIES=false
```

### High metric cardinality?
```promql
# Check number of unique tables
count(count by (table) (birthday_scheduler_database_query_duration_seconds_count))

# Should be < 20 for optimal performance
```

## 💡 Best Practices

### Development
```bash
NODE_ENV=development           # Enables all query logging
DB_SLOW_QUERY_THRESHOLD=50    # Lower threshold for dev
```

### Production
```bash
NODE_ENV=production           # Disables verbose logging
DB_SLOW_QUERY_THRESHOLD=100   # Standard threshold
DB_LOG_SLOW_QUERIES=true      # Keep slow query logging
```

### High Traffic
```bash
DB_SLOW_QUERY_THRESHOLD=200   # Higher threshold
# Consider query sampling in future version
```

## 📝 Example Queries for Common Tasks

### Find slowest queries today
```promql
topk(5,
  sum by (table, query_type) (
    increase(birthday_scheduler_database_query_duration_seconds_sum[24h])
  )
)
```

### Identify error-prone operations
```promql
topk(5,
  sum by (query_type, error_code) (
    increase(birthday_scheduler_database_query_errors_total{error_code!="none"}[24h])
  )
)
```

### Connection pool usage pattern (daily)
```promql
avg_over_time(birthday_scheduler_database_connections[24h])
```

### Query volume by hour
```promql
sum by (query_type) (
  increase(birthday_scheduler_database_query_duration_seconds_count[1h])
)
```

## 🔧 Manual Usage (Advanced)

### Track custom queries
```typescript
import { queryTimingTracker } from './db/interceptors/metrics-interceptor.js';

await queryTimingTracker.trackQuery(
  'EXPLAIN ANALYZE SELECT * FROM users',
  [],
  async () => {
    return await queryClient`EXPLAIN ANALYZE SELECT * FROM users`;
  }
);
```

### Stop/Start metrics collection
```typescript
import { stopMetrics } from './db/connection.js';

// Temporarily disable
stopMetrics();

// Re-enable requires restart
```

## 📚 Related Resources

- [Full Documentation](./README.md)
- [MetricsService](../../services/metrics.service.ts)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Grafana Dashboard Examples](https://grafana.com/grafana/dashboards/)

---

**Last Updated**: 2024-01-01
**Version**: 1.0.0
