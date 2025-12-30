# Exporter Deployment Checklist

**Version:** 1.0
**Author:** DOCUMENTER Agent (Hive Mind)
**Date:** December 31, 2025
**Status:** Production Ready

---

## Table of Contents

1. [Pre-Deployment Verification](#pre-deployment-verification)
2. [PostgreSQL Exporter Deployment](#postgresql-exporter-deployment)
3. [RabbitMQ Prometheus Plugin Deployment](#rabbitmq-prometheus-plugin-deployment)
4. [Prometheus Configuration](#prometheus-configuration)
5. [Post-Deployment Validation](#post-deployment-validation)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Rollback Procedures](#rollback-procedures)

---

## Pre-Deployment Verification

### Environment Readiness

#### Step 1: Verify Current Metrics

**Objective:** Confirm current metrics are working before adding exporters.

```bash
# ✓ Check application metrics endpoint
curl http://localhost:3000/metrics | head -20

# Expected: Prometheus-formatted metrics starting with "birthday_scheduler_"

# ✓ Verify metric count
curl -s http://localhost:3000/metrics | grep -c "^birthday_scheduler"

# Expected: ~128 metrics

# ✓ Check Prometheus is running (if deployed)
curl http://localhost:9090/-/healthy

# Expected: HTTP 200 OK
```

**Checklist:**
- [ ] Application metrics endpoint accessible at `/metrics`
- [ ] At least 128 custom metrics present
- [ ] Prometheus server running (if applicable)
- [ ] Grafana accessible (if applicable)

---

#### Step 2: Verify Database Connectivity

**Objective:** Ensure PostgreSQL is accessible and ready for exporter.

```bash
# ✓ Test database connection
docker exec birthday-app-postgres psql -U postgres -d birthday_app -c "SELECT 1;"

# Expected: Single row with value 1

# ✓ Check PostgreSQL version
docker exec birthday-app-postgres psql -U postgres -c "SELECT version();"

# Expected: PostgreSQL 15.x

# ✓ Verify pg_stat_statements extension
docker exec birthday-app-postgres psql -U postgres -d birthday_app -c "SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';"

# If not present, install it:
docker exec birthday-app-postgres psql -U postgres -d birthday_app -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

**Checklist:**
- [ ] PostgreSQL container running
- [ ] Database `birthday_app` accessible
- [ ] PostgreSQL version 15 or higher
- [ ] `pg_stat_statements` extension installed
- [ ] No connection errors in application logs

---

#### Step 3: Verify RabbitMQ Status

**Objective:** Ensure RabbitMQ is healthy and management plugin enabled.

```bash
# ✓ Check RabbitMQ container status
docker ps | grep rabbitmq

# Expected: Container running

# ✓ Verify RabbitMQ health
docker exec birthday-app-rabbitmq rabbitmq-diagnostics ping

# Expected: "Ping succeeded"

# ✓ Check management plugin
docker exec birthday-app-rabbitmq rabbitmq-plugins list | grep management

# Expected: [E*] rabbitmq_management

# ✓ Test management UI
curl -u rabbitmq:rabbitmq_dev_password http://localhost:15672/api/overview

# Expected: JSON response with RabbitMQ stats
```

**Checklist:**
- [ ] RabbitMQ container running
- [ ] RabbitMQ health check passing
- [ ] Management plugin enabled
- [ ] Management UI accessible at port 15672
- [ ] Default credentials working

---

#### Step 4: Check Available Resources

**Objective:** Ensure sufficient resources for additional containers.

```bash
# ✓ Check Docker resources
docker system df

# ✓ Check available disk space
df -h | grep docker

# Expected: At least 5GB free

# ✓ Check memory usage
docker stats --no-stream

# Expected: Combined usage < 80% of available memory

# ✓ Verify network connectivity
docker network ls | grep birthday-app-network

# Expected: Network exists
```

**Checklist:**
- [ ] At least 5GB free disk space
- [ ] Memory usage < 80%
- [ ] Docker network `birthday-app-network` exists
- [ ] No port conflicts on 9187 (postgres-exporter)
- [ ] No port conflicts on 15692 (rabbitmq prometheus)

---

#### Step 5: Backup Current Configuration

**Objective:** Create backups before making changes.

```bash
# ✓ Backup docker-compose files
cp docker-compose.yml docker-compose.yml.backup-$(date +%Y%m%d-%H%M%S)
cp docker-compose.prod.yml docker-compose.prod.yml.backup-$(date +%Y%m%d-%H%M%S)

# ✓ Backup RabbitMQ configuration
cp scripts/rabbitmq.conf scripts/rabbitmq.conf.backup-$(date +%Y%m%d-%H%M%S)

# ✓ Backup Prometheus configuration (if exists)
if [ -f prometheus/prometheus.yml ]; then
  cp prometheus/prometheus.yml prometheus/prometheus.yml.backup-$(date +%Y%m%d-%H%M%S)
fi

# ✓ Export current Grafana dashboards (if applicable)
# Manual step via Grafana UI: Settings > JSON Model > Copy
```

**Checklist:**
- [ ] `docker-compose.yml` backed up
- [ ] `docker-compose.prod.yml` backed up
- [ ] `scripts/rabbitmq.conf` backed up
- [ ] Prometheus config backed up (if exists)
- [ ] Grafana dashboards exported (if applicable)

---

## PostgreSQL Exporter Deployment

### Development Environment

#### Step 1: Create Database User

**Objective:** Create read-only user for metrics collection.

```bash
# ✓ Connect to PostgreSQL
docker exec -it birthday-app-postgres psql -U postgres -d birthday_app

# ✓ Run SQL commands
```

```sql
-- Create metrics user
CREATE USER metrics_user WITH PASSWORD 'CHANGE_ME_SECURE_PASSWORD';

-- Grant connection
GRANT CONNECT ON DATABASE birthday_app TO metrics_user;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO metrics_user;

-- Grant SELECT on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metrics_user;

-- Grant SELECT on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO metrics_user;

-- Grant stats access
GRANT pg_read_all_stats TO metrics_user;

-- Verify permissions
\du metrics_user
```

**Checklist:**
- [ ] User `metrics_user` created
- [ ] Password set and documented
- [ ] SELECT permissions granted on all tables
- [ ] `pg_read_all_stats` role granted
- [ ] User can connect to database

---

#### Step 2: Create Custom Queries File

**Objective:** Define application-specific metrics.

```bash
# ✓ Create directory
mkdir -p postgres_exporter

# ✓ Create queries file
cat > postgres_exporter/queries.yaml << 'EOF'
# Custom queries for Birthday Scheduler
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
      COUNT(*) as count
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
EOF

# ✓ Verify file
cat postgres_exporter/queries.yaml
```

**Checklist:**
- [ ] Directory `postgres_exporter/` created
- [ ] File `queries.yaml` created
- [ ] Custom queries defined
- [ ] YAML syntax valid

---

#### Step 3: Update docker-compose.yml

**Objective:** Add postgres-exporter service.

```bash
# ✓ Edit docker-compose.yml
```

Add this service definition:

```yaml
  # PostgreSQL Exporter (Metrics)
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    container_name: birthday-postgres-exporter
    restart: unless-stopped
    environment:
      DATA_SOURCE_NAME: "postgresql://metrics_user:CHANGE_ME_SECURE_PASSWORD@postgres:5432/birthday_app?sslmode=disable"
      PG_EXPORTER_EXTEND_QUERY_PATH: "/etc/postgres_exporter/queries.yaml"
    ports:
      - "9187:9187"
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

**Checklist:**
- [ ] Service `postgres-exporter` added to `docker-compose.yml`
- [ ] Password updated in `DATA_SOURCE_NAME`
- [ ] Port 9187 mapped
- [ ] Queries file mounted
- [ ] Depends on postgres service
- [ ] Healthcheck configured

---

#### Step 4: Deploy and Verify

**Objective:** Start the exporter and verify metrics.

```bash
# ✓ Pull image
docker-compose pull postgres-exporter

# ✓ Start service
docker-compose up -d postgres-exporter

# ✓ Check logs
docker logs birthday-postgres-exporter

# Expected: "Listening on :9187"

# ✓ Verify health
docker ps | grep postgres-exporter

# Expected: Status "healthy"

# ✓ Test metrics endpoint
curl http://localhost:9187/metrics | head -30

# Expected: Metrics starting with "pg_"

# ✓ Verify custom metrics
curl http://localhost:9187/metrics | grep pg_birthday_scheduler

# Expected: Custom metrics defined in queries.yaml

# ✓ Check metric count
curl -s http://localhost:9187/metrics | grep -c "^pg_"

# Expected: ~50+ metrics
```

**Checklist:**
- [ ] Container `birthday-postgres-exporter` running
- [ ] Health check passing
- [ ] Metrics endpoint accessible at `http://localhost:9187/metrics`
- [ ] Standard PostgreSQL metrics present (pg_up, pg_database_size_bytes, etc.)
- [ ] Custom metrics present (pg_birthday_scheduler_birthdays_today, etc.)
- [ ] No errors in logs

---

### Production Environment

#### Step 5: Update docker-compose.prod.yml

**Objective:** Deploy exporter for production cluster.

```yaml
# Add for primary database
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

# Add for replica database
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
```

**Checklist:**
- [ ] Exporter added for primary database
- [ ] Exporter added for replica database
- [ ] Environment variables used for credentials
- [ ] SSL mode set to `require`
- [ ] Resource limits configured
- [ ] Different ports for each exporter (9187, 9188)

---

## RabbitMQ Prometheus Plugin Deployment

### Development Environment

#### Step 1: Update RabbitMQ Configuration

**Objective:** Enable Prometheus plugin in RabbitMQ.

```bash
# ✓ Edit scripts/rabbitmq.conf
```

Add to end of file:

```conf
# ============================================
# Prometheus Plugin Configuration
# ============================================
# Enable Prometheus metrics endpoint
prometheus.tcp.port = 15692
prometheus.path = /metrics

# Return per-object metrics (queues, exchanges, connections, channels)
prometheus.return_per_object_metrics = true

# Metric aggregation settings
# Possible values: basic, detailed, per_object
prometheus.aggregation.level = detailed
```

**Checklist:**
- [ ] Prometheus configuration added to `scripts/rabbitmq.conf`
- [ ] Port 15692 configured
- [ ] Per-object metrics enabled
- [ ] Aggregation level set to `detailed`

---

#### Step 2: Create Plugin Enable File

**Objective:** Enable plugin at container startup.

```bash
# ✓ Create enabled_plugins file
cat > scripts/enabled_plugins << 'EOF'
[rabbitmq_management,rabbitmq_prometheus,rabbitmq_management_agent].
EOF

# ✓ Verify file
cat scripts/enabled_plugins
```

**Checklist:**
- [ ] File `scripts/enabled_plugins` created
- [ ] `rabbitmq_prometheus` included in list
- [ ] File syntax valid (Erlang list format)

---

#### Step 3: Update docker-compose.yml

**Objective:** Mount plugin config and expose port.

```yaml
rabbitmq:
  image: rabbitmq:3.13-management-alpine
  container_name: birthday-app-rabbitmq
  restart: unless-stopped
  environment:
    RABBITMQ_DEFAULT_USER: rabbitmq
    RABBITMQ_DEFAULT_PASS: rabbitmq_dev_password
    RABBITMQ_DEFAULT_VHOST: /
    RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS: -rabbit quorum_cluster_size 1
  ports:
    - "5672:5672"   # AMQP port
    - "15672:15672" # Management UI
    - "15692:15692" # Prometheus metrics (NEW)
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
    - ./scripts/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
    - ./scripts/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro  # NEW
  # ... rest of config ...
```

**Checklist:**
- [ ] Port 15692 added to port mappings
- [ ] `enabled_plugins` file mounted
- [ ] Configuration file mounted

---

#### Step 4: Deploy and Verify

**Objective:** Restart RabbitMQ with Prometheus plugin.

```bash
# ✓ Restart RabbitMQ container
docker-compose restart rabbitmq

# ✓ Wait for startup (30 seconds)
sleep 30

# ✓ Check plugin status
docker exec birthday-app-rabbitmq rabbitmq-plugins list | grep prometheus

# Expected: [E*] rabbitmq_prometheus

# ✓ Verify metrics endpoint
curl http://localhost:15692/metrics | head -30

# Expected: Metrics starting with "rabbitmq_"

# ✓ Test specific metrics
curl http://localhost:15692/metrics | grep rabbitmq_queue_messages

# Expected: Queue depth metrics

# ✓ Check metric count
curl -s http://localhost:15692/metrics | grep -c "^rabbitmq_"

# Expected: ~60+ metrics
```

**Checklist:**
- [ ] RabbitMQ restarted successfully
- [ ] Plugin `rabbitmq_prometheus` enabled and running
- [ ] Metrics endpoint accessible at `http://localhost:15692/metrics`
- [ ] Queue metrics present
- [ ] Connection metrics present
- [ ] Node metrics present
- [ ] No errors in RabbitMQ logs

---

### Production Environment

#### Step 5: Update docker-compose.prod.yml

**Objective:** Enable plugin for all cluster nodes.

```yaml
# Update RabbitMQ template
x-rabbitmq-node: &rabbitmq-node
  image: rabbitmq:3.13-management-alpine
  restart: unless-stopped
  environment:
    RABBITMQ_ERLANG_COOKIE: ${RABBITMQ_ERLANG_COOKIE:-birthday_cluster_secret}
    RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
    RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
  volumes:
    - ./scripts/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
    - ./scripts/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro  # NEW
  # ... rest of config ...

services:
  rabbitmq-1:
    <<: *rabbitmq-node
    container_name: birthday-rabbitmq-1
    ports:
      - "5672:5672"
      - "15672:15672"
      - "15692:15692"  # Prometheus metrics (NEW)

  rabbitmq-2:
    <<: *rabbitmq-node
    container_name: birthday-rabbitmq-2
    ports:
      - "5673:5672"
      - "15673:15672"
      - "15693:15692"  # Prometheus metrics (NEW)

  rabbitmq-3:
    <<: *rabbitmq-node
    container_name: birthday-rabbitmq-3
    ports:
      - "5674:5672"
      - "15674:15672"
      - "15694:15692"  # Prometheus metrics (NEW)
```

**Checklist:**
- [ ] Plugin config added to all cluster nodes
- [ ] Different Prometheus ports for each node (15692, 15693, 15694)
- [ ] `enabled_plugins` mounted on all nodes

---

## Prometheus Configuration

### Step 1: Create Prometheus Config Directory

```bash
# ✓ Create directories
mkdir -p prometheus
mkdir -p prometheus/rules

# ✓ Create prometheus.yml
cat > prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'birthday-scheduler'
    environment: 'development'

scrape_configs:
  # Birthday Scheduler Application
  - job_name: 'birthday-scheduler'
    static_configs:
      - targets: ['app:3000']
        labels:
          service: 'api'
    scrape_interval: 15s

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
        labels:
          instance: 'postgres-primary'
          database: 'birthday_app'
    scrape_interval: 30s

  # RabbitMQ Prometheus Plugin
  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
        labels:
          instance: 'rabbitmq-dev'
          cluster: 'standalone'
    scrape_interval: 15s
EOF
```

**Checklist:**
- [ ] Directory `prometheus/` created
- [ ] File `prometheus.yml` created
- [ ] Application scrape job configured
- [ ] PostgreSQL scrape job configured
- [ ] RabbitMQ scrape job configured

---

### Step 2: Add Prometheus to docker-compose.yml

**Objective:** Deploy Prometheus server (if not already deployed).

```yaml
  # Prometheus (Metrics Collection)
  prometheus:
    image: prom/prometheus:latest
    container_name: birthday-prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks:
      - birthday-app-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  prometheus_data:
    driver: local
```

**Checklist:**
- [ ] Prometheus service added (if not exists)
- [ ] Configuration mounted
- [ ] Port 9090 exposed
- [ ] Volume for data persistence
- [ ] Retention set to 30 days

---

### Step 3: Deploy Prometheus

```bash
# ✓ Pull image
docker-compose pull prometheus

# ✓ Start Prometheus
docker-compose up -d prometheus

# ✓ Check logs
docker logs birthday-prometheus

# Expected: "Server is ready to receive web requests"

# ✓ Verify web UI
curl http://localhost:9090/-/healthy

# Expected: HTTP 200 OK

# ✓ Check targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Expected: All targets "up"
```

**Checklist:**
- [ ] Prometheus container running
- [ ] Web UI accessible at `http://localhost:9090`
- [ ] All targets showing as "up"
- [ ] No errors in logs

---

## Post-Deployment Validation

### Step 1: Verify All Exporters

**Objective:** Confirm all metric sources are working.

```bash
# ✓ Test application metrics
curl -s http://localhost:3000/metrics | grep -c "birthday_scheduler"
# Expected: ~128

# ✓ Test PostgreSQL metrics
curl -s http://localhost:9187/metrics | grep -c "^pg_"
# Expected: ~50

# ✓ Test RabbitMQ metrics
curl -s http://localhost:15692/metrics | grep -c "^rabbitmq_"
# Expected: ~60

# ✓ Calculate total unique metrics
echo "Total metrics: $((128 + 50 + 60)) = 238"
```

**Checklist:**
- [ ] Application metrics: ~128 metrics
- [ ] PostgreSQL metrics: ~50 metrics
- [ ] RabbitMQ metrics: ~60 metrics
- [ ] **Total: ~238 metrics** (exceeds 200+ target)

---

### Step 2: Verify Prometheus Scraping

**Objective:** Confirm Prometheus is collecting metrics.

```bash
# ✓ Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.job): \(.health)"'

# Expected output:
# birthday-scheduler: up
# postgres: up
# rabbitmq: up

# ✓ Query application metric
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=birthday_scheduler_messages_scheduled_total' \
  | jq -r '.data.result[0].value[1]'

# Expected: Numeric value

# ✓ Query PostgreSQL metric
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=pg_up' \
  | jq -r '.data.result[0].value[1]'

# Expected: "1" (database is up)

# ✓ Query RabbitMQ metric
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rabbitmq_queue_messages' \
  | jq -r '.data.result[0].value[1]'

# Expected: Numeric value
```

**Checklist:**
- [ ] All Prometheus targets showing "up" status
- [ ] Application metrics queryable
- [ ] PostgreSQL metrics queryable
- [ ] RabbitMQ metrics queryable
- [ ] No scrape errors in Prometheus logs

---

### Step 3: Validate Metric Quality

**Objective:** Ensure metrics have correct labels and values.

```bash
# ✓ Check application metric labels
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=birthday_scheduler_api_requests_total' \
  | jq -r '.data.result[0].metric'

# Expected: Labels like {method="GET", path="/api/users", status="200"}

# ✓ Check PostgreSQL database size
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=pg_database_size_bytes{datname="birthday_app"}' \
  | jq -r '.data.result[0].value[1]'

# Expected: Positive number in bytes

# ✓ Check RabbitMQ queue depth
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rabbitmq_queue_messages{queue="birthday_notifications"}' \
  | jq -r '.data.result[0].value[1]'

# Expected: Numeric value

# ✓ Verify custom PostgreSQL metrics
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=pg_birthday_scheduler_birthdays_today'

# Expected: Valid response with birthday count
```

**Checklist:**
- [ ] Metrics have appropriate labels
- [ ] Metric values are realistic
- [ ] Custom queries returning data
- [ ] No NaN or Inf values
- [ ] Timestamps are current

---

### Step 4: Test Sample Queries

**Objective:** Verify complex queries work correctly.

```bash
# ✓ Test rate calculation
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rate(birthday_scheduler_api_requests_total[5m])'

# ✓ Test aggregation
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=sum(rabbitmq_queue_messages) by (queue)'

# ✓ Test histogram percentile
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=histogram_quantile(0.95, rate(birthday_scheduler_api_response_time_seconds_bucket[5m]))'

# ✓ Test PostgreSQL cache hit ratio
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=(sum(rate(pg_stat_database_blks_hit[5m])) / (sum(rate(pg_stat_database_blks_hit[5m])) + sum(rate(pg_stat_database_blks_read[5m])))) * 100'
```

**Checklist:**
- [ ] Rate queries working
- [ ] Aggregation queries working
- [ ] Histogram percentiles calculating
- [ ] Complex multi-metric queries working

---

### Step 5: Performance Verification

**Objective:** Ensure exporters don't impact system performance.

```bash
# ✓ Check exporter resource usage
docker stats --no-stream birthday-postgres-exporter birthday-app-rabbitmq

# Expected: < 50MB memory each, < 5% CPU

# ✓ Check database impact
docker exec birthday-app-postgres psql -U postgres -d birthday_app -c "
  SELECT count(*) as active_metrics_queries
  FROM pg_stat_activity
  WHERE usename = 'metrics_user'
    AND state = 'active';
"

# Expected: 0-1 (queries are fast)

# ✓ Check RabbitMQ memory
docker exec birthday-app-rabbitmq rabbitmqctl status | grep -A5 memory

# Expected: Minimal increase from baseline

# ✓ Measure scrape duration
curl -s http://localhost:9090/api/v1/query \
  --data-urlencode 'query=scrape_duration_seconds' \
  | jq -r '.data.result[] | "\(.metric.job): \(.value[1])s"'

# Expected: All < 5 seconds
```

**Checklist:**
- [ ] Postgres exporter: < 50MB RAM, < 5% CPU
- [ ] RabbitMQ Prometheus: minimal memory increase
- [ ] Database queries completing quickly
- [ ] Scrape duration < 5 seconds for all jobs
- [ ] No performance degradation in application

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: Target Down in Prometheus

**Symptom:** Target shows "down" status in Prometheus UI

**Solutions:**

```bash
# 1. Check if exporter is running
docker ps | grep exporter

# 2. Check exporter logs
docker logs birthday-postgres-exporter
docker logs birthday-app-rabbitmq | grep prometheus

# 3. Test endpoint directly
curl http://localhost:9187/metrics  # PostgreSQL
curl http://localhost:15692/metrics # RabbitMQ

# 4. Verify network connectivity
docker exec birthday-prometheus ping postgres-exporter
docker exec birthday-prometheus ping rabbitmq

# 5. Check Prometheus config
docker exec birthday-prometheus cat /etc/prometheus/prometheus.yml

# 6. Reload Prometheus config
curl -X POST http://localhost:9090/-/reload
```

**Checklist:**
- [ ] Exporter container running
- [ ] Metrics endpoint accessible
- [ ] Network connectivity working
- [ ] Prometheus config correct
- [ ] No firewall blocking ports

---

#### Issue 2: No Data in Metrics

**Symptom:** Metrics endpoint returns empty or error

**PostgreSQL Exporter:**
```bash
# Check database connection
docker exec birthday-postgres-exporter sh -c 'echo $DATA_SOURCE_NAME'

# Test connection manually
docker exec birthday-app-postgres psql -U metrics_user -d birthday_app -c "SELECT 1;"

# Check permissions
docker exec birthday-app-postgres psql -U postgres -d birthday_app -c "
  SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
  WHERE grantee = 'metrics_user'
  LIMIT 5;
"

# Verify pg_stat_statements
docker exec birthday-app-postgres psql -U metrics_user -d birthday_app -c "SELECT COUNT(*) FROM pg_stat_statements;"
```

**RabbitMQ Plugin:**
```bash
# Check plugin status
docker exec birthday-app-rabbitmq rabbitmq-plugins list | grep prometheus

# Re-enable plugin
docker exec birthday-app-rabbitmq rabbitmq-plugins disable rabbitmq_prometheus
docker exec birthday-app-rabbitmq rabbitmq-plugins enable rabbitmq_prometheus

# Restart RabbitMQ
docker-compose restart rabbitmq
```

**Checklist:**
- [ ] Database credentials correct
- [ ] User has proper permissions
- [ ] Plugin enabled and running
- [ ] No errors in exporter logs

---

#### Issue 3: High Cardinality Warning

**Symptom:** Prometheus consuming excessive memory

**Solutions:**

```bash
# Check metric cardinality
curl http://localhost:9090/api/v1/status/tsdb | jq '.data.seriesCountByMetricName[] | select(.value > 10000)'

# For PostgreSQL: Reduce custom queries
# Edit postgres_exporter/queries.yaml to add LIMIT clauses

# For RabbitMQ: Reduce aggregation
# Edit scripts/rabbitmq.conf:
prometheus.return_per_object_metrics = false
prometheus.aggregation.level = basic

# Add metric relabeling in prometheus.yml
metric_relabel_configs:
  - source_labels: [queue]
    regex: 'temp_.*'
    action: drop
```

**Checklist:**
- [ ] No single metric > 10,000 series
- [ ] Temporary queues excluded
- [ ] Per-object metrics limited
- [ ] Prometheus memory stable

---

#### Issue 4: Slow Scraping

**Symptom:** Scrape duration > 10 seconds

**Solutions:**

```bash
# Check scrape duration per target
curl http://localhost:9090/api/v1/query \
  --data-urlencode 'query=scrape_duration_seconds' | jq

# Increase scrape interval for slow targets
# Edit prometheus.yml:
scrape_interval: 30s  # Instead of 15s

# For PostgreSQL: Optimize queries
# Add indexes, reduce query complexity

# For RabbitMQ: Reduce detail level
prometheus.aggregation.level = basic
```

**Checklist:**
- [ ] Scrape duration < 10s
- [ ] Database queries optimized
- [ ] Appropriate scrape intervals
- [ ] No timeout errors

---

## Rollback Procedures

### Scenario 1: Rollback PostgreSQL Exporter

**When:** Exporter causing issues or not needed

```bash
# 1. Stop and remove exporter
docker-compose stop postgres-exporter
docker-compose rm -f postgres-exporter

# 2. Restore original docker-compose.yml
cp docker-compose.yml.backup-TIMESTAMP docker-compose.yml

# 3. Remove Prometheus scrape config
# Edit prometheus/prometheus.yml and remove postgres job

# 4. Reload Prometheus
curl -X POST http://localhost:9090/-/reload

# 5. Clean up database user (optional)
docker exec birthday-app-postgres psql -U postgres -d birthday_app -c "
  DROP USER IF EXISTS metrics_user;
"

# 6. Remove custom queries
rm -rf postgres_exporter/
```

**Checklist:**
- [ ] Exporter stopped and removed
- [ ] docker-compose.yml restored
- [ ] Prometheus config updated
- [ ] Database user removed (optional)
- [ ] Files cleaned up

---

### Scenario 2: Rollback RabbitMQ Plugin

**When:** Plugin causing performance issues

```bash
# 1. Disable plugin
docker exec birthday-app-rabbitmq rabbitmq-plugins disable rabbitmq_prometheus

# 2. Restore original configuration
cp scripts/rabbitmq.conf.backup-TIMESTAMP scripts/rabbitmq.conf
cp scripts/enabled_plugins.backup-TIMESTAMP scripts/enabled_plugins

# 3. Restore docker-compose.yml
cp docker-compose.yml.backup-TIMESTAMP docker-compose.yml

# 4. Restart RabbitMQ
docker-compose restart rabbitmq

# 5. Remove Prometheus scrape config
# Edit prometheus/prometheus.yml and remove rabbitmq job

# 6. Reload Prometheus
curl -X POST http://localhost:9090/-/reload

# 7. Verify RabbitMQ health
docker exec birthday-app-rabbitmq rabbitmq-diagnostics ping
```

**Checklist:**
- [ ] Plugin disabled
- [ ] Configuration restored
- [ ] docker-compose.yml restored
- [ ] RabbitMQ restarted successfully
- [ ] Prometheus config updated
- [ ] RabbitMQ health verified

---

### Scenario 3: Complete Rollback

**When:** Rolling back entire exporter deployment

```bash
# 1. Stop all new services
docker-compose stop postgres-exporter prometheus

# 2. Restore all backup files
for f in *.backup-*; do
  original="${f%.backup-*}"
  cp "$f" "$original"
done

# 3. Restart affected services
docker-compose restart rabbitmq
docker-compose up -d

# 4. Verify application still works
curl http://localhost:3000/health
curl http://localhost:3000/metrics | grep birthday_scheduler

# 5. Clean up
docker-compose down --remove-orphans
docker-compose up -d
```

**Checklist:**
- [ ] All new services stopped
- [ ] Configuration files restored
- [ ] Application functioning normally
- [ ] Original 128+ metrics still working
- [ ] No errors in logs

---

## Post-Deployment Next Steps

After successful deployment and validation:

1. **Create Grafana Dashboards**
   - Import PostgreSQL dashboard (ID: 9628)
   - Import RabbitMQ dashboard (ID: 10991)
   - Create custom dashboard for Birthday Scheduler

2. **Configure Alerts**
   - Database down: `pg_up == 0`
   - High queue depth: `rabbitmq_queue_messages > 1000`
   - Low cache hit ratio: `pg_buffer_cache_hit_ratio < 99`

3. **Document Custom Queries**
   - Add business-specific PostgreSQL queries
   - Document expected metric ranges
   - Create runbook for common issues

4. **Schedule Review**
   - Weekly: Check metric cardinality
   - Monthly: Review and optimize queries
   - Quarterly: Update exporters to latest versions

5. **Training**
   - Share query examples with team
   - Document alerting procedures
   - Create dashboard walk-through

---

## Success Criteria

Deployment is successful when:

- [ ] **Metrics Count:** 200+ total metrics (128 app + 50 postgres + 60 rabbitmq)
- [ ] **All Targets Up:** 100% target availability in Prometheus
- [ ] **Performance:** < 5% impact on database/RabbitMQ performance
- [ ] **Scrape Duration:** All scrapes complete in < 10 seconds
- [ ] **Data Quality:** All metrics have valid values and labels
- [ ] **Documentation:** All deployment steps documented
- [ ] **Rollback Tested:** Rollback procedure verified
- [ ] **Team Trained:** Team can query and interpret metrics

---

**Document Version:** 1.0
**Last Updated:** December 31, 2025
**Next Review:** March 31, 2026
**Maintained By:** Platform Engineering Team
