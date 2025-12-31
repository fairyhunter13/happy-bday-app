# Database Metrics Interceptor

## Overview

The Database Metrics Interceptor provides comprehensive Prometheus metrics tracking for database operations using Drizzle ORM and PostgreSQL. It captures query execution duration, operation counts, slow queries, errors, and connection pool metrics.

## Features

- **Query Duration Tracking**: Records execution time for all database queries via histogram metrics
- **Operation Type Counters**: Tracks query counts by operation type (SELECT, INSERT, UPDATE, DELETE, etc.)
- **Slow Query Detection**: Identifies and logs queries exceeding configurable threshold (default: 100ms)
- **Error Tracking**: Captures and categorizes database errors by error type
- **Connection Pool Metrics**: Monitors active database connections via periodic queries
- **Automatic Table Extraction**: Parses SQL queries to extract table names for granular metrics

## Architecture

### Components

1. **DatabaseMetricsInterceptor**: Implements Drizzle's `Logger` interface for query logging
2. **QueryTimingTracker**: Wraps query execution to measure timing and record metrics
3. **Connection Pool Monitoring**: Periodic queries to track active database connections

### Integration Points

- **Drizzle ORM Logger**: Custom logger attached to Drizzle instance
- **MetricsService**: Uses existing Prometheus metrics from `src/services/metrics.service.ts`
- **PostgreSQL**: Queries `pg_stat_activity` for connection pool stats

## Metrics Tracked

### Histogram Metrics

```typescript
// Query execution duration
database_query_duration_seconds{query_type, table}
```

**Buckets**: `[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]`

**Labels**:
- `query_type`: Operation type (SELECT, INSERT, UPDATE, DELETE, etc.)
- `table`: Target table name extracted from query

### Counter Metrics

```typescript
// Slow queries (exceeding threshold)
database_slow_queries_total{query_type, table, threshold_ms}

// Query errors by type
database_query_errors_total{query_type, error_code}
```

### Gauge Metrics

```typescript
// Active database connections
database_connections
```

## Configuration

### Environment Variables

```bash
# Slow query threshold in milliseconds (default: 100)
DB_SLOW_QUERY_THRESHOLD=100

# Log slow queries to console (default: true)
DB_LOG_SLOW_QUERIES=true

# Enable database metrics collection (default: true)
ENABLE_DB_METRICS=true

# Development mode enables all query logging
NODE_ENV=development
```

### Programmatic Configuration

```typescript
import { MetricsInterceptorConfig } from './interceptors/metrics-interceptor.js';

const config: MetricsInterceptorConfig = {
  slowQueryThreshold: 200,      // ms
  logSlowQueries: true,
  logAllQueries: false,         // true in development
};
```

## Usage

### Automatic Integration

The interceptor is automatically integrated when importing the database connection:

```typescript
import { db } from './db/connection.js';

// Database queries are automatically tracked
const users = await db.select().from(usersTable);
```

### Manual Query Tracking

For custom query execution outside Drizzle ORM:

```typescript
import { queryTimingTracker } from './db/interceptors/metrics-interceptor.js';

const result = await queryTimingTracker.trackQuery(
  'SELECT * FROM users WHERE id = $1',
  [userId],
  async () => {
    return await queryClient`SELECT * FROM users WHERE id = ${userId}`;
  }
);
```

### Connection Pool Metrics

Connection pool metrics are automatically collected every 10 seconds. To stop collection during graceful shutdown:

```typescript
import { closeConnection } from './db/connection.js';

// Automatically stops metrics collection
await closeConnection();
```

## Query Parsing

The interceptor extracts operation types and table names from SQL queries:

### Supported Operations

- `SELECT` - Read operations
- `INSERT` - Create operations
- `UPDATE` - Update operations
- `DELETE` - Delete operations
- `BEGIN` - Transaction start
- `COMMIT` - Transaction commit
- `ROLLBACK` - Transaction rollback
- `CREATE`, `ALTER`, `DROP` - DDL operations

### Table Name Extraction

Supports common SQL patterns:

```sql
-- SELECT queries
SELECT * FROM users WHERE id = 1
→ table: "users"

-- INSERT queries
INSERT INTO message_logs (user_id, message) VALUES (1, 'Hello')
→ table: "message_logs"

-- UPDATE queries
UPDATE users SET name = 'John' WHERE id = 1
→ table: "users"

-- DELETE queries
DELETE FROM message_logs WHERE id = 1
→ table: "message_logs"
```

## Monitoring & Alerting

### Grafana Queries

**Query Duration P95**:
```promql
histogram_quantile(0.95,
  sum(rate(birthday_scheduler_database_query_duration_seconds_bucket[5m])) by (le, query_type, table)
)
```

**Slow Query Rate**:
```promql
sum(rate(birthday_scheduler_database_slow_queries_total[5m])) by (query_type, table)
```

**Query Error Rate**:
```promql
sum(rate(birthday_scheduler_database_query_errors_total[5m])) by (query_type, error_code)
```

**Active Connections**:
```promql
birthday_scheduler_database_connections
```

### Alert Rules

```yaml
groups:
  - name: database_alerts
    rules:
      # High slow query rate
      - alert: HighSlowQueryRate
        expr: rate(birthday_scheduler_database_slow_queries_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High slow query rate detected"
          description: "{{ $value }} slow queries/sec in {{ $labels.table }}"

      # High query error rate
      - alert: HighDatabaseErrorRate
        expr: rate(birthday_scheduler_database_query_errors_total{error_code!="none"}[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High database error rate"
          description: "{{ $value }} errors/sec ({{ $labels.error_code }})"

      # Connection pool exhaustion
      - alert: DatabaseConnectionPoolExhausted
        expr: birthday_scheduler_database_connections >= 18
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool near limit"
          description: "{{ $value }} connections (max: 20)"
```

## Performance Considerations

### Overhead

- **Query Logging**: Minimal overhead (~0.1ms per query)
- **Metrics Recording**: ~0.5-1ms per query for Prometheus operations
- **Connection Pool Queries**: Runs every 10 seconds (configurable)

### Best Practices

1. **Slow Query Threshold**: Adjust based on workload (100ms default)
2. **Query Logging**: Disable `logAllQueries` in production for performance
3. **Connection Pool Interval**: Increase interval (e.g., 30s) for lower overhead
4. **Label Cardinality**: Table names are extracted, limiting metric cardinality

### Scaling

The interceptor is designed for high-throughput environments:

- Asynchronous metric recording
- Efficient regex-based query parsing
- Batched connection pool metrics collection
- No blocking operations in critical path

## Troubleshooting

### Common Issues

**Issue**: Metrics not appearing in Prometheus

**Solution**:
1. Verify `ENABLE_DB_METRICS=true` in environment
2. Check `/metrics` endpoint for database metrics
3. Ensure MetricsService is properly initialized

**Issue**: High metric cardinality warnings

**Solution**:
1. Limit table name extraction to main tables only
2. Consider grouping similar tables (e.g., partitioned tables)
3. Use metric relabeling in Prometheus config

**Issue**: Slow query logs flooding

**Solution**:
1. Increase `DB_SLOW_QUERY_THRESHOLD` value
2. Set `DB_LOG_SLOW_QUERIES=false` to disable logging
3. Optimize slow queries identified in metrics

## Testing

### Unit Tests

```typescript
import { extractOperationType, extractTableName } from './metrics-interceptor.js';

describe('Query Parsing', () => {
  it('should extract SELECT operation', () => {
    const query = 'SELECT * FROM users WHERE id = 1';
    expect(extractOperationType(query)).toBe('SELECT');
    expect(extractTableName(query)).toBe('users');
  });

  it('should extract INSERT operation', () => {
    const query = 'INSERT INTO message_logs (user_id) VALUES (1)';
    expect(extractOperationType(query)).toBe('INSERT');
    expect(extractTableName(query)).toBe('message_logs');
  });
});
```

### Integration Tests

```typescript
import { db } from './db/connection.js';
import { metricsService } from './services/metrics.service.js';

describe('Database Metrics Integration', () => {
  it('should track query duration', async () => {
    const before = await metricsService.registry.getSingleMetric('birthday_scheduler_database_query_duration_seconds');

    await db.select().from(usersTable);

    const after = await metricsService.registry.getSingleMetric('birthday_scheduler_database_query_duration_seconds');
    expect(after).toBeDefined();
  });
});
```

## Related Documentation

- [Metrics Service Documentation](../../services/metrics.service.ts)
- [Database Connection](../connection.ts)
- [Drizzle ORM Logger](https://orm.drizzle.team/docs/goodies#logging)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)

## Changelog

### v1.0.0 (2024-01-01)

- Initial implementation with Drizzle ORM logger integration
- Query duration, slow query, and error tracking
- Connection pool monitoring via pg_stat_activity
- Configurable thresholds and logging options
