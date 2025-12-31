# PostgreSQL Exporter Deployment Guide

**Version:** 1.0
**Author:** DOCUMENTER Agent (Hive Mind)
**Date:** December 31, 2025
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Deployment Options](#deployment-options)
3. [Configuration](#configuration)
4. [Prometheus Integration](#prometheus-integration)
5. [Sample Queries](#sample-queries)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### What is postgres_exporter?

The `postgres_exporter` is a Prometheus exporter for PostgreSQL database metrics. It exposes database health, performance, and operational metrics via an HTTP endpoint that Prometheus can scrape.

**Official Repository:** [prometheus-community/postgres_exporter](https://github.com/prometheus-community/postgres_exporter)

### Metrics Provided

The exporter provides **~50 critical PostgreSQL metrics** including:

**Database Health:**
- `pg_up` - Database availability (1=up, 0=down)
- `pg_database_size_bytes` - Database size in bytes
- `pg_stat_database_*` - Database-wide statistics

**Query Performance:**
- `pg_stat_statements_*` - Query execution statistics (requires pg_stat_statements extension)
- `pg_stat_user_tables_*` - Table-level statistics
- `pg_statio_user_tables_*` - I/O statistics per table

**Connection Management:**
- `pg_stat_activity_count` - Active connections by state
- `pg_settings_max_connections` - Max connections configured

**Replication:**
- `pg_replication_lag` - Replication lag in seconds
- `pg_stat_replication_*` - Replication slot statistics

**Storage & I/O:**
- `pg_stat_bgwriter_*` - Background writer statistics
- `pg_locks_count` - Lock counts by mode and type

**Cache Efficiency:**
- `pg_stat_database_blks_hit` - Buffer cache hits
- `pg_stat_database_blks_read` - Disk reads

### Why Deploy postgres_exporter?

While the application already tracks **128+ custom metrics**, postgres_exporter provides:

1. **Deep Database Internals** - Access to PostgreSQL internal counters not visible via SQL
2. **Zero Application Changes** - No code modifications required
3. **Standard Metrics** - Industry-standard naming and labels
4. **Grafana Compatibility** - Works with pre-built PostgreSQL dashboards
5. **Low Overhead** - Minimal impact on database performance

**Metrics Expansion:** 148 (current) + 50 (postgres_exporter) = **~200 total metrics**

---

## Deployment Options

### Option A: Docker Compose Sidecar (RECOMMENDED)

Best for: Development, staging, and production environments using Docker Compose.

**Advantages:**
- Simple configuration
- Automatic service discovery
- Easy scaling with application
- Isolated from application containers

**Implementation:**

#### Step 1: Add to docker-compose.yml

```yaml
services:
  # ... existing services ...

  # PostgreSQL Exporter (Metrics)
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    container_name: birthday-postgres-exporter
    restart: unless-stopped
    environment:
      DATA_SOURCE_NAME: "postgresql://metrics_user:metrics_password@postgres:5432/birthday_app?sslmode=disable"
      # Optional: Custom query file
      PG_EXPORTER_EXTEND_QUERY_PATH: "/etc/postgres_exporter/queries.yaml"
      # Disable default metrics (optional)
      PG_EXPORTER_DISABLE_DEFAULT_METRICS: "false"
      # Disable settings metrics (reduces cardinality)
      PG_EXPORTER_DISABLE_SETTINGS_METRICS: "false"
    ports:
      - "9187:9187"  # Prometheus scrape endpoint
    volumes:
      - ./postgres_exporter/queries.yaml:/etc/postgres_exporter/queries.yaml:ro
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - birthday-app-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:9187/"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### Step 2: Production Configuration (docker-compose.prod.yml)

```yaml
services:
  # PostgreSQL Exporter for Primary Database
  postgres-exporter-primary:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    container_name: birthday-postgres-exporter-primary
    restart: unless-stopped
    environment:
      DATA_SOURCE_NAME: "postgresql://metrics_user:${METRICS_PASSWORD}@postgres-primary:5432/${DATABASE_NAME}?sslmode=require"
      PG_EXPORTER_EXTEND_QUERY_PATH: "/etc/postgres_exporter/queries.yaml"
    ports:
      - "9187:9187"
    volumes:
      - ./postgres_exporter/queries.yaml:/etc/postgres_exporter/queries.yaml:ro
    depends_on:
      postgres-primary:
        condition: service_healthy
    networks:
      - birthday-network
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 128M
        reservations:
          cpus: '0.1'
          memory: 64M

  # PostgreSQL Exporter for Read Replica
  postgres-exporter-replica:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    container_name: birthday-postgres-exporter-replica
    restart: unless-stopped
    environment:
      DATA_SOURCE_NAME: "postgresql://metrics_user:${METRICS_PASSWORD}@postgres-replica:5432/${DATABASE_NAME}?sslmode=require"
      PG_EXPORTER_EXTEND_QUERY_PATH: "/etc/postgres_exporter/queries.yaml"
    ports:
      - "9188:9187"
    volumes:
      - ./postgres_exporter/queries.yaml:/etc/postgres_exporter/queries.yaml:ro
    depends_on:
      postgres-replica:
        condition: service_healthy
    networks:
      - birthday-network
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 128M
        reservations:
          cpus: '0.1'
          memory: 64M
```

---

### Option B: Kubernetes DaemonSet

Best for: Kubernetes production deployments with high availability.

**Advantages:**
- Automatic scaling with PostgreSQL pods
- Native Kubernetes service discovery
- Pod-level resource management
- Built-in health checks

**Implementation:**

#### Step 1: Create Secret for Database Credentials

```yaml

# postgres-exporter-secret.yaml

apiVersion: v1
kind: Secret
metadata:
  name: postgres-exporter-secret
  namespace: birthday-app
type: Opaque
stringData:
  DATA_SOURCE_NAME: "postgresql://metrics_user:CHANGE_ME@postgres-service:5432/birthday_app?sslmode=require"
```

Apply:
```bash
kubectl apply -f postgres-exporter-secret.yaml
```

#### Step 2: Deploy as DaemonSet

```yaml

# postgres-exporter-daemonset.yaml

apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: postgres-exporter
  namespace: birthday-app
  labels:
    app: postgres-exporter
spec:
  selector:
    matchLabels:
      app: postgres-exporter
  template:
    metadata:
      labels:
        app: postgres-exporter
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9187"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: postgres-exporter
        image: prometheuscommunity/postgres-exporter:v0.15.0
        ports:
        - containerPort: 9187
          name: metrics
          protocol: TCP
        env:
        - name: DATA_SOURCE_NAME
          valueFrom:
            secretKeyRef:
              name: postgres-exporter-secret
              key: DATA_SOURCE_NAME
        resources:
          requests:
            cpu: 100m
            memory: 64Mi
          limits:
            cpu: 250m
            memory: 128Mi
        livenessProbe:
          httpGet:
            path: /
            port: 9187
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 9187
          initialDelaySeconds: 5
          periodSeconds: 5
      restartPolicy: Always
```

Apply:
```bash
kubectl apply -f postgres-exporter-daemonset.yaml
```

#### Step 3: Create Service

```yaml

# postgres-exporter-service.yaml

apiVersion: v1
kind: Service
metadata:
  name: postgres-exporter
  namespace: birthday-app
  labels:
    app: postgres-exporter
spec:
  type: ClusterIP
  ports:
  - port: 9187
    targetPort: 9187
    protocol: TCP
    name: metrics
  selector:
    app: postgres-exporter
```

Apply:
```bash
kubectl apply -f postgres-exporter-service.yaml
```

---

### Option C: Standalone Installation

Best for: Bare-metal deployments or testing environments.

**Advantages:**
- No container overhead
- Direct system integration
- Full control over process

**Implementation:**

#### Step 1: Download Binary

```bash

# Download latest release

VERSION="0.15.0"
wget https://github.com/prometheus-community/postgres_exporter/releases/download/v${VERSION}/postgres_exporter-${VERSION}.linux-amd64.tar.gz

# Extract

tar -xzf postgres_exporter-${VERSION}.linux-amd64.tar.gz
cd postgres_exporter-${VERSION}.linux-amd64/

# Move to system path

sudo mv postgres_exporter /usr/local/bin/
sudo chmod +x /usr/local/bin/postgres_exporter
```

#### Step 2: Create System User

```bash
sudo useradd --no-create-home --shell /bin/false postgres_exporter
```

#### Step 3: Create Systemd Service

```ini

# /etc/systemd/system/postgres_exporter.service

[Unit]
Description=PostgreSQL Exporter for Prometheus
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=postgres_exporter
Group=postgres_exporter
Environment="DATA_SOURCE_NAME=postgresql://metrics_user:metrics_password@localhost:5432/birthday_app?sslmode=disable"
ExecStart=/usr/local/bin/postgres_exporter \
  --web.listen-address=:9187 \
  --web.telemetry-path=/metrics

SyslogIdentifier=postgres_exporter
Restart=always
RestartSec=10s

[Install]
WantedBy=multi-user.target
```

#### Step 4: Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable postgres_exporter
sudo systemctl start postgres_exporter
sudo systemctl status postgres_exporter
```

---

## Configuration

### Database User Setup

**Security Best Practice:** Create a dedicated read-only user for metrics collection.

#### Step 1: Create Metrics User

```sql
-- Connect as superuser
psql -U postgres -d birthday_app

-- Create read-only metrics user
CREATE USER metrics_user WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';

-- Grant connection permission
GRANT CONNECT ON DATABASE birthday_app TO metrics_user;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO metrics_user;

-- Grant SELECT on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metrics_user;

-- Grant SELECT on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO metrics_user;

-- Enable pg_stat_statements extension (optional but recommended)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Grant access to pg_stat_statements
GRANT pg_read_all_stats TO metrics_user;
```

#### Step 2: Verify Permissions

```sql
-- Test connection as metrics_user
psql -U metrics_user -d birthday_app -c "SELECT 1;"

-- Verify table access
psql -U metrics_user -d birthday_app -c "SELECT COUNT(*) FROM users;"

-- Check pg_stat_statements access
psql -U metrics_user -d birthday_app -c "SELECT COUNT(*) FROM pg_stat_statements;"
```

### Connection String Format

The `DATA_SOURCE_NAME` environment variable uses PostgreSQL connection URI format:

```
postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...]
```

**Examples:**

```bash

# Local development (no SSL)

DATA_SOURCE_NAME="postgresql://metrics_user:password@localhost:5432/birthday_app?sslmode=disable"

# Production with SSL

DATA_SOURCE_NAME="postgresql://metrics_user:password@postgres.example.com:5432/birthday_app?sslmode=require"

# Using environment variable password (secure)

DATA_SOURCE_NAME="postgresql://metrics_user:${POSTGRES_PASSWORD}@postgres:5432/birthday_app?sslmode=require"

# Multiple databases (use multiple exporter instances)

DATA_SOURCE_NAME="postgresql://metrics_user:password@postgres:5432/birthday_app,template1?sslmode=disable"

# Connection pooling settings

DATA_SOURCE_NAME="postgresql://metrics_user:password@postgres:5432/birthday_app?pool_max_conns=10&pool_min_conns=2"
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_SOURCE_NAME` | (required) | PostgreSQL connection string |
| `PG_EXPORTER_WEB_LISTEN_ADDRESS` | `:9187` | Address to listen on for web interface and telemetry |
| `PG_EXPORTER_WEB_TELEMETRY_PATH` | `/metrics` | Path under which to expose metrics |
| `PG_EXPORTER_EXTEND_QUERY_PATH` | (none) | Path to custom queries YAML file |
| `PG_EXPORTER_DISABLE_DEFAULT_METRICS` | `false` | Disable built-in metrics |
| `PG_EXPORTER_DISABLE_SETTINGS_METRICS` | `false` | Disable pg_settings metrics |
| `PG_EXPORTER_AUTO_DISCOVER_DATABASES` | `false` | Discover all databases automatically |
| `PG_EXPORTER_INCLUDE_DATABASES` | (all) | Comma-separated list of databases to monitor |
| `PG_EXPORTER_EXCLUDE_DATABASES` | (none) | Comma-separated list of databases to exclude |

### Custom Queries

Create `postgres_exporter/queries.yaml` for application-specific metrics:

```yaml

# Custom queries for Birthday Scheduler application

pg_birthday_scheduler:
  query: |
    SELECT
      COUNT(*) FILTER (WHERE birthday = CURRENT_DATE) as birthdays_today,
      COUNT(*) FILTER (WHERE birthday > CURRENT_DATE AND birthday <= CURRENT_DATE + INTERVAL '7 days') as birthdays_next_week,
      COUNT(*) as total_users
    FROM users
    WHERE active = true
  metrics:
    - birthdays_today:
        usage: "GAUGE"
        description: "Number of birthdays today"
    - birthdays_next_week:
        usage: "GAUGE"
        description: "Number of birthdays in the next 7 days"
    - total_users:
        usage: "GAUGE"
        description: "Total active users"

pg_message_logs_stats:
  query: |
    SELECT
      status,
      COUNT(*) as count,
      AVG(EXTRACT(EPOCH FROM (delivered_at - scheduled_at))) as avg_delivery_time_seconds
    FROM message_logs
    WHERE created_at > NOW() - INTERVAL '1 hour'
    GROUP BY status
  metrics:
    - status:
        usage: "LABEL"
        description: "Message status"
    - count:
        usage: "GAUGE"
        description: "Number of messages by status"
    - avg_delivery_time_seconds:
        usage: "GAUGE"
        description: "Average delivery time in seconds"

pg_table_sizes:
  query: |
    SELECT
      schemaname,
      tablename,
      pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
      pg_relation_size(schemaname||'.'||tablename) as table_size_bytes,
      pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename) as index_size_bytes
    FROM pg_tables
    WHERE schemaname = 'public'
  metrics:
    - schemaname:
        usage: "LABEL"
        description: "Schema name"
    - tablename:
        usage: "LABEL"
        description: "Table name"
    - size_bytes:
        usage: "GAUGE"
        description: "Total size including indexes"
    - table_size_bytes:
        usage: "GAUGE"
        description: "Table size excluding indexes"
    - index_size_bytes:
        usage: "GAUGE"
        description: "Total index size"

pg_query_performance:
  query: |
    SELECT
      queryid,
      LEFT(query, 100) as query_snippet,
      calls,
      total_exec_time,
      mean_exec_time,
      max_exec_time,
      rows
    FROM pg_stat_statements
    ORDER BY total_exec_time DESC
    LIMIT 10
  metrics:
    - queryid:
        usage: "LABEL"
        description: "Query ID from pg_stat_statements"
    - query_snippet:
        usage: "LABEL"
        description: "First 100 characters of query"
    - calls:
        usage: "COUNTER"
        description: "Number of times executed"
    - total_exec_time:
        usage: "COUNTER"
        description: "Total execution time in milliseconds"
    - mean_exec_time:
        usage: "GAUGE"
        description: "Mean execution time in milliseconds"
    - max_exec_time:
        usage: "GAUGE"
        description: "Maximum execution time in milliseconds"
    - rows:
        usage: "COUNTER"
        description: "Total rows returned"
```

---

## Prometheus Integration

### Scrape Configuration

Add to `prometheus/prometheus.yml`:

```yaml
scrape_configs:
  # Birthday Scheduler Application Metrics
  - job_name: 'birthday-scheduler'
    static_configs:
      - targets: ['app:3000']
    scrape_interval: 15s
    scrape_timeout: 10s

  # PostgreSQL Exporter (Development)
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
        labels:
          instance: 'postgres-primary'
          environment: 'development'
          database: 'birthday_app'
    scrape_interval: 30s
    scrape_timeout: 10s

  # PostgreSQL Exporter (Production - Primary)
  - job_name: 'postgres-primary'
    static_configs:
      - targets: ['postgres-exporter-primary:9187']
        labels:
          instance: 'postgres-primary'
          environment: 'production'
          database: 'birthday_app'
          role: 'primary'
    scrape_interval: 30s
    scrape_timeout: 10s

  # PostgreSQL Exporter (Production - Replica)
  - job_name: 'postgres-replica'
    static_configs:
      - targets: ['postgres-exporter-replica:9187']
        labels:
          instance: 'postgres-replica'
          environment: 'production'
          database: 'birthday_app'
          role: 'replica'
    scrape_interval: 30s
    scrape_timeout: 10s
```

### Service Discovery (Kubernetes)

For Kubernetes deployments, use automatic service discovery:

```yaml
scrape_configs:
  - job_name: 'kubernetes-postgres-exporter'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - birthday-app
    relabel_configs:
      # Only scrape pods with prometheus.io/scrape annotation
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      # Use the port from prometheus.io/port annotation
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        target_label: __address__
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
      # Set instance label to pod name
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: instance
      # Set job label to app label
      - source_labels: [__meta_kubernetes_pod_label_app]
        target_label: job
```

### Verification

After deployment, verify metrics are being scraped:

```bash

# Check exporter health

curl http://localhost:9187/

# View metrics endpoint

curl http://localhost:9187/metrics

# Verify Prometheus target

curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="postgres")'

# Query a metric

curl -G http://localhost:9090/api/v1/query --data-urlencode 'query=pg_up'
```

---

## Sample Queries

### Database Availability

```promql

# Database up status (1=up, 0=down)

pg_up{instance="postgres-primary"}

# Database uptime percentage (last 24 hours)

avg_over_time(pg_up{instance="postgres-primary"}[24h]) * 100
```

### Database Size Monitoring

```promql

# Database size in GB

pg_database_size_bytes{datname="birthday_app"} / 1024 / 1024 / 1024

# Database growth rate (bytes per second)

rate(pg_database_size_bytes{datname="birthday_app"}[1h])

# Database size growth percentage (last 24 hours)

(
  pg_database_size_bytes{datname="birthday_app"}
  - pg_database_size_bytes{datname="birthday_app"} offset 24h
) / pg_database_size_bytes{datname="birthday_app"} offset 24h * 100
```

### Query Performance

```promql

# Top 10 slowest queries by total execution time

topk(10,
  rate(pg_stat_statements_total_exec_time{datname="birthday_app"}[5m])
)

# Queries with mean execution time > 100ms

pg_stat_statements_mean_exec_time{datname="birthday_app"} > 100

# Query call rate (queries per second)

rate(pg_stat_statements_calls{datname="birthday_app"}[5m])
```

### Connection Pool Metrics

```promql

# Active connections by state

pg_stat_activity_count{datname="birthday_app"}

# Connection utilization percentage

(
  pg_stat_activity_count{datname="birthday_app",state="active"}
  / pg_settings_max_connections
) * 100

# Idle connections

pg_stat_activity_count{datname="birthday_app",state="idle"}

# Long-running queries (> 5 minutes)

pg_stat_activity_max_tx_duration{datname="birthday_app",state="active"} > 300
```

### Cache Hit Ratio

```promql

# Buffer cache hit ratio (should be > 99%)

(
  sum(rate(pg_stat_database_blks_hit{datname="birthday_app"}[5m]))
  /
  (
    sum(rate(pg_stat_database_blks_hit{datname="birthday_app"}[5m]))
    + sum(rate(pg_stat_database_blks_read{datname="birthday_app"}[5m]))
  )
) * 100

# Index hit ratio (should be > 99%)

(
  sum(rate(pg_stat_user_tables_idx_blks_hit[5m]))
  /
  (
    sum(rate(pg_stat_user_tables_idx_blks_hit[5m]))
    + sum(rate(pg_stat_user_tables_idx_blks_read[5m]))
  )
) * 100
```

### Replication Lag

```promql

# Replication lag in seconds

pg_replication_lag{application_name="postgres-replica"}

# Alert if replication lag > 10 seconds

pg_replication_lag{application_name="postgres-replica"} > 10
```

### Table Statistics

```promql

# Table sizes in GB

pg_stat_user_tables_size_bytes / 1024 / 1024 / 1024

# Sequential scans (high values may indicate missing indexes)

rate(pg_stat_user_tables_seq_scan[5m])

# Dead tuples (high values indicate autovacuum issues)

pg_stat_user_tables_n_dead_tup

# Table bloat percentage

(
  pg_stat_user_tables_n_dead_tup
  / (pg_stat_user_tables_n_live_tup + pg_stat_user_tables_n_dead_tup)
) * 100
```

### Lock Monitoring

```promql

# Lock count by mode

pg_locks_count

# Blocked queries

pg_stat_activity_count{wait_event_type="Lock"}

# Deadlock count

rate(pg_stat_database_deadlocks{datname="birthday_app"}[5m])
```

### Transaction Metrics

```promql

# Transaction rate (commits + rollbacks per second)

rate(pg_stat_database_xact_commit{datname="birthday_app"}[5m])
+ rate(pg_stat_database_xact_rollback{datname="birthday_app"}[5m])

# Rollback ratio (should be < 1%)

(
  rate(pg_stat_database_xact_rollback{datname="birthday_app"}[5m])
  /
  (
    rate(pg_stat_database_xact_commit{datname="birthday_app"}[5m])
    + rate(pg_stat_database_xact_rollback{datname="birthday_app"}[5m])
  )
) * 100
```

---

## Security Best Practices

### 1. Use Read-Only User

Never grant write permissions to the metrics user:

```sql
-- ✅ Good: Read-only permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metrics_user;

-- ❌ Bad: Write permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO metrics_user;
```

### 2. Secure Connection Strings

Store credentials securely:

**Docker Compose:**
```yaml

# Use environment variables

environment:
  DATA_SOURCE_NAME: "postgresql://metrics_user:${METRICS_PASSWORD}@postgres:5432/birthday_app?sslmode=require"
```

**Kubernetes:**
```yaml

# Use secrets

env:
  - name: DATA_SOURCE_NAME
    valueFrom:
      secretKeyRef:
        name: postgres-exporter-secret
        key: DATA_SOURCE_NAME
```

**Systemd:**
```ini

# Use environment file

EnvironmentFile=/etc/postgres_exporter/environment
```

### 3. Enable SSL/TLS

Always use SSL in production:

```bash

# Require SSL

DATA_SOURCE_NAME="postgresql://metrics_user:password@postgres:5432/birthday_app?sslmode=require"

# Verify certificate

DATA_SOURCE_NAME="postgresql://metrics_user:password@postgres:5432/birthday_app?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca-cert.pem"
```

### 4. Network Isolation

Restrict network access:

**Docker Compose:**
```yaml
networks:
  monitoring:
    internal: true  # No external access
```

**Kubernetes:**
```yaml

# Use NetworkPolicy

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-exporter-policy
spec:
  podSelector:
    matchLabels:
      app: postgres-exporter
  ingress:
    - from:
      - podSelector:
          matchLabels:
            app: prometheus
      ports:
      - protocol: TCP
        port: 9187
```

### 5. Regular Password Rotation

Rotate credentials periodically:

```bash

# Change password

psql -U postgres -d birthday_app -c "ALTER USER metrics_user WITH PASSWORD 'NEW_PASSWORD';"

# Update connection string

docker-compose restart postgres-exporter
```

### 6. Audit Logging

Enable PostgreSQL audit logging for the metrics user:

```sql
-- Install pgaudit extension
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Configure audit logging
ALTER SYSTEM SET pgaudit.log = 'READ';
ALTER SYSTEM SET pgaudit.role = 'metrics_user';
SELECT pg_reload_conf();
```

---

## Troubleshooting

### Exporter Won't Start

**Symptom:** Container exits immediately

**Solutions:**

```bash

# Check logs

docker logs birthday-postgres-exporter

# Common issues:
# 1. Invalid connection string

docker exec birthday-postgres-exporter sh -c 'echo $DATA_SOURCE_NAME'

# 2. Database not reachable

docker exec birthday-postgres-exporter ping postgres

# 3. Wrong credentials

docker exec -it postgres psql -U metrics_user -d birthday_app

# 4. Port already in use

netstat -tulpn | grep 9187
```

### No Metrics Appearing

**Symptom:** `/metrics` endpoint returns empty or error

**Solutions:**

```bash

# Verify exporter is running

curl http://localhost:9187/

# Check metrics endpoint

curl http://localhost:9187/metrics | head -20

# Verify database connection

docker exec birthday-postgres-exporter wget -O- http://localhost:9187/metrics | grep pg_up

# Check Prometheus targets

curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="postgres")'
```

### Permission Denied Errors

**Symptom:** Metrics show errors about missing permissions

**Solutions:**

```sql
-- Verify user exists
SELECT usename, usecreatedb, usesuper FROM pg_user WHERE usename = 'metrics_user';

-- Check granted permissions
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'metrics_user';

-- Grant missing permissions
GRANT pg_read_all_stats TO metrics_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metrics_user;
```

### High Cardinality Issues

**Symptom:** Prometheus running out of memory

**Solutions:**

```bash

# Disable high-cardinality metrics

docker run -e PG_EXPORTER_DISABLE_SETTINGS_METRICS=true ...

# Exclude specific databases

docker run -e PG_EXPORTER_EXCLUDE_DATABASES=template0,template1 ...

# Limit query results
# Edit queries.yaml to add LIMIT clauses

```

### Slow Query Performance

**Symptom:** Metrics scraping takes > 10 seconds

**Solutions:**

```sql
-- Create indexes for pg_stat_statements queries
CREATE INDEX IF NOT EXISTS idx_pg_stat_statements_queryid ON pg_stat_statements(queryid);

-- Reduce pg_stat_statements.max
ALTER SYSTEM SET pg_stat_statements.max = 5000;
SELECT pg_reload_conf();

-- Reset pg_stat_statements
SELECT pg_stat_statements_reset();
```

### SSL Connection Issues

**Symptom:** "SSL connection required" error

**Solutions:**

```bash

# Check PostgreSQL SSL configuration

docker exec postgres grep ssl /var/lib/postgresql/data/postgresql.conf

# Enable SSL in connection string

DATA_SOURCE_NAME="postgresql://metrics_user:password@postgres:5432/birthday_app?sslmode=require"

# Disable SSL for testing (NOT for production)

DATA_SOURCE_NAME="postgresql://metrics_user:password@postgres:5432/birthday_app?sslmode=disable"
```

### Memory Issues

**Symptom:** Exporter consuming too much memory

**Solutions:**

```yaml

# Set resource limits (Docker Compose)

deploy:
  resources:
    limits:
      memory: 128M

# Reduce scrape frequency

scrape_interval: 60s  # Instead of 30s

# Disable unused metrics

environment:
  PG_EXPORTER_DISABLE_DEFAULT_METRICS: "false"
  PG_EXPORTER_DISABLE_SETTINGS_METRICS: "true"
```

### Custom Queries Not Working

**Symptom:** Custom metrics not appearing

**Solutions:**

```bash

# Verify YAML syntax

yamllint postgres_exporter/queries.yaml

# Check file is mounted

docker exec birthday-postgres-exporter cat /etc/postgres_exporter/queries.yaml

# Test query manually

docker exec postgres psql -U metrics_user -d birthday_app -c "SELECT COUNT(*) FROM users;"

# Check exporter logs

docker logs birthday-postgres-exporter 2>&1 | grep -i error
```

---

## Next Steps

After successful deployment:

1. **Configure Prometheus Scraping** - See [Prometheus Integration](#prometheus-integration)
2. **Create Grafana Dashboards** - Import pre-built PostgreSQL dashboards
3. **Set Up Alerts** - Configure critical database alerts
4. **Deploy RabbitMQ Exporter** - See `rabbitmq-prometheus-deployment.md`
5. **Review Deployment Checklist** - Follow `exporter-deployment-checklist.md`

---

**Document Version:** 1.0
**Last Updated:** December 31, 2025
**Next Review:** March 31, 2026
**Maintained By:** Platform Engineering Team
