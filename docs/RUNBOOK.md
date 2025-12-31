# Operational Runbook

## Table of Contents

1. [System Overview](#system-overview)
2. [Deployment Procedures](#deployment-procedures)
3. [Scaling Operations](#scaling-operations)
4. [Monitoring & Observability](#monitoring--observability)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Backup & Recovery](#backup--recovery)
8. [Incident Response](#incident-response)
9. [Contacts & Escalation](#contacts--escalation)

---

## System Overview

### Architecture Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Server    │────▶│   PostgreSQL    │     │   RabbitMQ      │
│  (Fastify App)  │     │   (Database)    │     │  (Message Queue)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                 │
        │                                                 │
        ▼                                                 ▼
┌─────────────────┐                            ┌─────────────────┐
│   Scheduler     │                            │     Worker      │
│ (Cron Service)  │                            │  (Consumer)     │
└─────────────────┘                            └─────────────────┘
```

### Key Metrics

| Metric | Normal Range | Warning Threshold | Critical Threshold |
|--------|--------------|-------------------|-------------------|
| Request Rate | 10-100 req/s | >200 req/s | >500 req/s |
| Error Rate | <1% | >5% | >10% |
| P99 Response Time | <500ms | >1s | >3s |
| Queue Depth | <100 | >1000 | >5000 |
| DB Connections | 5-15 | >80% pool | >90% pool |
| Memory Usage | <1GB | >1.5GB | >2GB |

### Coverage Enforcement

The CI/CD pipeline enforces code coverage thresholds through automated checks:

**Coverage Scripts:**
- `scripts/coverage/check-thresholds.sh` - Validates coverage meets minimum requirements
- `scripts/coverage/update-history.sh` - Updates coverage history tracking (main branch only)

**CI/CD Integration:**
- Each unit test shard collects coverage with `--coverage` flag
- Coverage thresholds are checked immediately after unit tests
- Coverage reports are merged in the coverage-report job
- Coverage history is automatically tracked on push to main branch

**Local Usage:**
```bash
# Run unit tests with coverage
npm run test:unit -- --coverage

# Check coverage thresholds
npm run test:coverage:check

# Generate full coverage report
npm run test:coverage
```

---

## Deployment Procedures

### 1. Standard Deployment

**Pre-Deployment Checklist:**
- [ ] All tests passing (`npm test`)
- [ ] Code reviewed and approved
- [ ] Secrets updated in secret manager
- [ ] Database migrations reviewed
- [ ] Rollback plan prepared
- [ ] Team notified in #deployments
- [ ] Monitoring dashboard open

**Deployment Steps:**

```bash

# 1. Pull latest code

git pull origin main

# 2. Install dependencies

npm ci

# 3. Run database migrations

npm run db:migrate

# 4. Build application

npm run build

# 5. Run smoke tests

npm run test:e2e

# 6. Restart services (zero-downtime)
# Option A: PM2

pm2 reload ecosystem.config.js

# Option B: Docker

docker-compose up -d --no-deps --build api worker scheduler

# Option C: Kubernetes

kubectl rollout restart deployment/birthday-scheduler-api
kubectl rollout restart deployment/birthday-scheduler-worker
kubectl rollout restart deployment/birthday-scheduler-scheduler

# 7. Monitor deployment

kubectl rollout status deployment/birthday-scheduler-api

# 8. Verify health

curl https://api.example.com/health
curl https://api.example.com/metrics

# 9. Check logs for errors

kubectl logs -f deployment/birthday-scheduler-api --tail=100

# 10. Monitor metrics for 15 minutes
# Watch Grafana dashboard for anomalies

```

**Post-Deployment Verification:**

```bash

# Test critical endpoints

curl -X POST https://api.example.com/users -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","dateOfBirth":"1990-01-01T00:00:00Z","timezoneOffset":0}'

# Check queue is processing

rabbitmqadmin list queues

# Verify scheduler is running
# Check logs for cron execution messages

```

### 2. Hotfix Deployment

**For critical production issues:**

```bash

# 1. Create hotfix branch

git checkout -b hotfix/critical-bug main

# 2. Apply minimal fix
# ... make changes ...

# 3. Fast-track testing

npm run test:unit

# 4. Deploy immediately
# Follow standard deployment steps 4-10

# 5. Post-deployment
# Monitor closely for 30 minutes
# Create incident report
# Schedule proper fix for next release

```

### 3. Rollback Procedure

**If deployment fails:**

```bash

# Docker rollback

docker-compose down
git checkout <previous-commit>
docker-compose up -d

# Kubernetes rollback

kubectl rollout undo deployment/birthday-scheduler-api
kubectl rollout undo deployment/birthday-scheduler-worker

# Database rollback (if needed)

npm run db:migrate:rollback

# Verify rollback

curl https://api.example.com/health
```

---

## Scaling Operations

### 1. Horizontal Scaling

**Scale API Servers:**

```bash

# Kubernetes

kubectl scale deployment birthday-scheduler-api --replicas=5

# Docker Swarm

docker service scale birthday-scheduler_api=5

# PM2

pm2 scale api 5

# Verify scaling

kubectl get pods | grep api
```

**Scale Workers:**

```bash

# Increase worker count for higher throughput

kubectl scale deployment birthday-scheduler-worker --replicas=10

# Monitor queue processing

watch -n 2 'rabbitmqadmin list queues'
```

**Auto-scaling (Kubernetes HPA):**

```yaml

# hpa.yaml

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: birthday-scheduler-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: birthday-scheduler-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

```bash
kubectl apply -f hpa.yaml
kubectl get hpa
```

### 2. Vertical Scaling

**Increase Container Resources:**

```yaml

# deployment.yaml

resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

**Database Scaling:**

```bash

# AWS RDS

aws rds modify-db-instance \
  --db-instance-identifier birthday-scheduler-db \
  --db-instance-class db.t3.large \
  --apply-immediately

# PostgreSQL connection pool
# Update DATABASE_POOL_MAX environment variable

kubectl set env deployment/birthday-scheduler-api DATABASE_POOL_MAX=50
```

---

## Monitoring & Observability

This section provides comprehensive operational guidance for monitoring the Birthday Scheduler system, including strategies, procedures, and copy-paste-ready queries.

---

### Monitoring Strategy

#### The RED Method

The RED method focuses on three key metrics for request-driven services:

| Metric | Description | Key Indicators |
|--------|-------------|----------------|
| **Rate** | Request throughput | `birthday_scheduler_api_requests_total` |
| **Errors** | Failed request rate | Requests with status 4xx/5xx |
| **Duration** | Request latency distribution | p50, p95, p99 percentiles |

**Implementation:**

```promql
# Rate - Requests per second
sum(rate(birthday_scheduler_api_requests_total[5m]))

# Errors - Error rate percentage
(sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m]))
 / sum(rate(birthday_scheduler_api_requests_total[5m]))) * 100

# Duration - P99 latency
histogram_quantile(0.99, sum(rate(birthday_scheduler_api_response_time_bucket[5m])) by (le))
```

#### The Four Golden Signals

| Signal | What to Monitor | Birthday Scheduler Metric |
|--------|-----------------|---------------------------|
| **Latency** | Time to service a request | `birthday_scheduler_api_response_time` |
| **Traffic** | Demand on the system | `birthday_scheduler_api_requests_total` |
| **Errors** | Rate of failed requests | `birthday_scheduler_api_requests_total{status=~"5.."}` |
| **Saturation** | How "full" the service is | Queue depth, DB connections, CPU/Memory |

**Saturation Indicators:**

```promql
# Queue saturation
birthday_scheduler_queue_depth / 10000  # Normalized to 0-1

# Database connection saturation
birthday_scheduler_db_connections_active / birthday_scheduler_db_connections_max

# Memory saturation
birthday_scheduler_memory_used_bytes / birthday_scheduler_memory_limit_bytes

# CPU saturation
rate(birthday_scheduler_cpu_seconds_total[5m]) / birthday_scheduler_cpu_limit
```

---

### Daily Monitoring Checklist

Perform these checks at the start of each operational shift:

#### Morning Health Check (5 Key Metrics)

| # | Metric | Normal Range | Check Query |
|---|--------|--------------|-------------|
| 1 | **API Success Rate** | >99.9% | `(sum(rate(birthday_scheduler_api_requests_total{status!~"5.."}[1h])) / sum(rate(birthday_scheduler_api_requests_total[1h]))) * 100` |
| 2 | **Message Queue Depth** | <100 | `birthday_scheduler_queue_depth` |
| 3 | **DLQ Count** | 0 | `birthday_scheduler_dlq_depth` |
| 4 | **Database Connections** | <80% of pool | `birthday_scheduler_db_connections_active / birthday_scheduler_db_connections_max * 100` |
| 5 | **P99 API Latency** | <1s | `histogram_quantile(0.99, sum(rate(birthday_scheduler_api_response_time_bucket[1h])) by (le))` |

#### Daily Monitoring Procedure

```bash
# 1. Check overall system health
curl -s https://api.example.com/health | jq .

# 2. Quick Prometheus query for health summary
curl -s "http://prometheus:9090/api/v1/query?query=up{job='birthday-scheduler'}" | jq .

# 3. Check for any firing alerts
curl -s "http://alertmanager:9093/api/v2/alerts?active=true" | jq '.[] | {alertname: .labels.alertname, severity: .labels.severity}'

# 4. Verify scheduler ran successfully (check last execution)
curl -s "http://prometheus:9090/api/v1/query?query=birthday_scheduler_scheduler_last_success_time" | jq .

# 5. Review overnight message delivery
curl -s "http://prometheus:9090/api/v1/query?query=increase(birthday_scheduler_messages_sent_total[12h])" | jq .
```

#### Weekly Review Checklist

- [ ] Review error budget consumption trend
- [ ] Check for slow query patterns in database
- [ ] Analyze message retry trends
- [ ] Review capacity trends (CPU, memory, connections)
- [ ] Validate backup completion
- [ ] Check certificate expiration dates

---

### Grafana Dashboards Operational Guide

**Access:** https://grafana.example.com

#### Dashboard Navigation

```
Overview Dashboard (Start Here)
    |
    +-- API Performance Dashboard
    |       +-- Infrastructure Dashboard (drill down)
    |
    +-- Message Processing Dashboard
    |       +-- Database Dashboard (drill down)
    |
    +-- Database Dashboard
    |       +-- Infrastructure Dashboard (drill down)
    |
    +-- Infrastructure Dashboard
    |
    +-- Security Dashboard
```

#### 1. Overview Dashboard

**Purpose:** System-wide health at a glance
**URL:** `/d/overview`
**Refresh:** 30 seconds

**What to Look For:**
- All status indicators should be GREEN
- No red alert annotations on graphs
- Request rate within normal baseline (+/- 20%)
- Error rate below 1%

**Action Triggers:**
| Indicator | Yellow | Red |
|-----------|--------|-----|
| System Health | 1+ warning | 1+ critical |
| Error Rate | >1% | >5% |
| Queue Depth | >100 | >1000 |

#### 2. API Performance Dashboard

**Purpose:** HTTP API request performance analysis
**URL:** `/d/api-performance`
**When to Use:** Latency complaints, error investigations

**Key Panels:**
| Panel | Purpose | SLO |
|-------|---------|-----|
| Request Rate | Traffic volume | N/A |
| Success Rate | API availability | >99.9% |
| P50/P95/P99 Latency | Response time distribution | P99 <1s |
| Error Distribution | Error breakdown by type | <0.1% 5xx |
| Top Slow Endpoints | Identify bottlenecks | P95 <500ms |

**Variables to Adjust:**
- `$namespace` - Filter by environment (production/staging)
- `$instance` - Filter by specific pod
- `$path` - Filter by endpoint
- `$interval` - Adjust aggregation (1m for real-time, 5m for trends)

#### 3. Message Processing Dashboard

**Purpose:** Queue health and message delivery monitoring
**URL:** `/d/message-processing`
**When to Use:** Message delays, delivery failures

**Key Panels:**
| Panel | Purpose | Healthy State |
|-------|---------|---------------|
| Queue Depth | Backlog size | <100 messages |
| Processing Rate | Throughput | Matches ingest rate |
| DLQ Depth | Failed messages | 0 |
| Retry Rate | Transient failures | <5% |
| Message Latency | End-to-end time | P95 <30s |

**Troubleshooting Flow:**
1. Queue depth increasing? Check worker count and health
2. DLQ growing? Review failed message patterns
3. High retry rate? Check external API health
4. High latency? Check database and worker performance

#### 4. Database Performance Dashboard

**Purpose:** PostgreSQL connection pool and query performance
**URL:** `/d/database`
**When to Use:** Slow queries, connection issues

**Key Panels:**
| Panel | Purpose | Threshold |
|-------|---------|-----------|
| Connection Pool | Pool utilization | <80% |
| Query Latency | Response times by type | P95 <50ms |
| Active Queries | Concurrent query count | <50 |
| Slow Queries | Queries >100ms | 0 |
| Transactions | Commit/rollback rate | Rollbacks <1% |

#### 5. Infrastructure Dashboard

**Purpose:** Node.js process and system health
**URL:** `/d/infrastructure`
**When to Use:** Resource exhaustion, memory leaks

**Key Panels:**
| Panel | Purpose | Threshold |
|-------|---------|-----------|
| CPU Usage | Process CPU | <70% |
| Memory (RSS) | Total memory | <80% of limit |
| Heap Usage | V8 heap | <90% |
| Event Loop Lag | Async blocking | <100ms |
| GC Duration | Garbage collection | <100ms |
| File Descriptors | Open FDs | <80% of limit |

#### 6. Security Dashboard

**Purpose:** Authentication and security monitoring
**URL:** `/d/security`
**When to Use:** Security incidents, access issues

**Key Panels:**
- Failed Login Attempts
- Unauthorized Access Events
- Rate Limit Violations
- Security Event Timeline

---

### Prometheus Query Cookbook

#### API Performance Queries (10 queries)

```promql
# 1. Request rate by endpoint
sum(rate(birthday_scheduler_api_requests_total[5m])) by (method, path)

# 2. Overall error rate percentage
(sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m]))
 / sum(rate(birthday_scheduler_api_requests_total[5m]))) * 100

# 3. P50, P95, P99 latency
histogram_quantile(0.50, sum(rate(birthday_scheduler_api_response_time_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(birthday_scheduler_api_response_time_bucket[5m])) by (le))
histogram_quantile(0.99, sum(rate(birthday_scheduler_api_response_time_bucket[5m])) by (le))

# 4. Slowest endpoints (top 10)
topk(10, histogram_quantile(0.95, sum(rate(birthday_scheduler_api_response_time_bucket[5m])) by (le, path)))

# 5. Error rate by endpoint
sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])) by (path)
 / sum(rate(birthday_scheduler_api_requests_total[5m])) by (path) * 100

# 6. Request count by status code
sum(increase(birthday_scheduler_api_requests_total[1h])) by (status)

# 7. API availability (non-5xx requests)
sum(rate(birthday_scheduler_api_requests_total{status!~"5.."}[5m]))
 / sum(rate(birthday_scheduler_api_requests_total[5m])) * 100

# 8. Request throughput trend (compared to yesterday)
sum(rate(birthday_scheduler_api_requests_total[5m]))
 / sum(rate(birthday_scheduler_api_requests_total[5m] offset 1d))

# 9. Active requests gauge
birthday_scheduler_api_active_requests

# 10. API health score
birthday_scheduler_api_health_score
```

#### Message Queue Queries (10 queries)

```promql
# 1. Current queue depth
birthday_scheduler_queue_depth

# 2. Queue growth rate (messages/minute)
deriv(birthday_scheduler_queue_depth[5m]) * 60

# 3. Message processing rate
sum(rate(birthday_scheduler_messages_sent_total[5m]))

# 4. Message failure rate
sum(rate(birthday_scheduler_messages_failed_total[5m]))
 / sum(rate(birthday_scheduler_messages_processed_total[5m])) * 100

# 5. DLQ depth
birthday_scheduler_dlq_depth

# 6. Retry rate by reason
sum(rate(birthday_scheduler_message_retries_total[5m])) by (retry_reason)

# 7. Message delivery latency P95
histogram_quantile(0.95, sum(rate(birthday_scheduler_message_delivery_duration_bucket[5m])) by (le))

# 8. Consumer count
birthday_scheduler_consumer_count

# 9. Messages processed per worker
sum(rate(birthday_scheduler_messages_processed_total[5m])) by (instance)
 / birthday_scheduler_active_workers

# 10. Queue time to drain estimate (minutes)
birthday_scheduler_queue_depth / (sum(rate(birthday_scheduler_messages_processed_total[5m])) * 60)
```

#### Database Queries (10 queries)

```promql
# 1. Connection pool utilization
birthday_scheduler_db_connections_active
 / birthday_scheduler_db_connections_max * 100

# 2. Available connections
birthday_scheduler_db_connections_max - birthday_scheduler_db_connections_active

# 3. Query latency by type (P95)
histogram_quantile(0.95, sum(rate(birthday_scheduler_database_query_duration_bucket[5m])) by (le, query_type))

# 4. Slow queries count (>100ms)
increase(birthday_scheduler_database_slow_queries_total[1h])

# 5. Transaction rate
sum(rate(birthday_scheduler_database_commits_total[5m]))

# 6. Rollback rate
sum(rate(birthday_scheduler_database_rollbacks_total[5m]))
 / sum(rate(birthday_scheduler_database_commits_total[5m])) * 100

# 7. Connection wait time
birthday_scheduler_connection_pool_wait_time

# 8. Active transactions
birthday_scheduler_active_transactions

# 9. Index hit ratio
birthday_scheduler_index_hit_ratio

# 10. Replication lag (if applicable)
birthday_scheduler_db_replication_lag_seconds
```

#### Infrastructure Queries (10 queries)

```promql
# 1. CPU usage percentage
rate(birthday_scheduler_cpu_seconds_total[5m]) * 100

# 2. Memory usage (RSS in GB)
birthday_scheduler_process_resident_memory_bytes / 1024 / 1024 / 1024

# 3. Heap utilization percentage
birthday_scheduler_nodejs_heap_size_used_bytes
 / birthday_scheduler_nodejs_heap_size_total_bytes * 100

# 4. Event loop lag
birthday_scheduler_nodejs_eventloop_lag_seconds

# 5. GC pause time (major collections)
rate(birthday_scheduler_nodejs_gc_duration_seconds_sum{kind="major"}[5m])

# 6. Open file descriptors
birthday_scheduler_process_open_fds

# 7. Active handles
birthday_scheduler_nodejs_active_handles_total

# 8. Memory growth rate (leak detection)
deriv(birthday_scheduler_nodejs_heap_size_used_bytes[1h])

# 9. Process uptime
birthday_scheduler_process_uptime_seconds

# 10. System load average
birthday_scheduler_system_load_average
```

#### Business Metrics Queries (5 queries)

```promql
# 1. Birthdays processed today
increase(birthday_scheduler_birthdays_processed_total[24h])

# 2. Message delivery success rate
sum(rate(birthday_scheduler_messages_delivered_total[1h]))
 / sum(rate(birthday_scheduler_messages_sent_total[1h])) * 100

# 3. Active users (daily)
birthday_scheduler_daily_active_users

# 4. Messages sent by hour
sum(increase(birthday_scheduler_messages_sent_total[1h])) by (hour)

# 5. Template usage distribution
sum(increase(birthday_scheduler_message_template_usage_total[24h])) by (template_name)
```

---

### Alert Response Procedures

#### Critical Alerts (P0 - Immediate Response)

##### 1. ServiceDown

**Alert:** `up{job="birthday-scheduler"} == 0`
**Severity:** Critical | **Response Time:** 5 minutes

**Symptoms:**
- Health check failures
- No metrics being scraped
- User-facing errors

**Diagnosis:**

```bash
# 1. Check pod status
kubectl get pods -l app=birthday-scheduler

# 2. Check recent events
kubectl describe pod <pod-name> | grep -A 20 Events

# 3. Check logs for crash
kubectl logs deployment/birthday-scheduler-api --tail=200 | grep -i "error\|fatal\|crash"

# 4. Check node health
kubectl get nodes
kubectl describe node <node-name>
```

**Resolution:**

```bash
# Restart pods
kubectl rollout restart deployment/birthday-scheduler-api

# If node issue, drain and cordon
kubectl drain <node-name> --ignore-daemonsets
kubectl cordon <node-name>

# Scale up if capacity issue
kubectl scale deployment/birthday-scheduler-api --replicas=5
```

##### 2. HighErrorRate

**Alert:** Error rate >5% for 2 minutes
**Severity:** Critical | **Response Time:** 5 minutes

**Symptoms:**
- Users seeing errors
- API returning 500s
- Spike in error logs

**Diagnosis:**

```bash
# 1. Identify error distribution
curl -s "http://prometheus:9090/api/v1/query?query=sum(increase(birthday_scheduler_api_requests_total{status=~'5..'}[5m]))%20by%20(status,path)" | jq .

# 2. Check recent deployments
git log --oneline -10
kubectl rollout history deployment/birthday-scheduler-api

# 3. Check dependencies
curl https://api.example.com/health/detailed | jq .

# 4. Review error logs
kubectl logs deployment/birthday-scheduler-api --tail=500 | jq 'select(.level == "error")'
```

**Resolution:**

```bash
# If recent deployment, rollback
kubectl rollout undo deployment/birthday-scheduler-api

# If dependency issue, check circuit breaker
curl https://api.example.com/metrics | grep circuit_breaker

# If database issue
kubectl exec -it postgres-0 -- psql -c "SELECT * FROM pg_stat_activity WHERE state != 'idle';"
```

##### 3. DatabaseConnectionPoolExhausted

**Alert:** No available database connections
**Severity:** Critical | **Response Time:** 2 minutes

**Symptoms:**
- API timeouts
- "too many connections" errors
- Database query failures

**Diagnosis:**

```bash
# 1. Check connection count
kubectl exec -it postgres-0 -- psql -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Check long-running queries
kubectl exec -it postgres-0 -- psql -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;"

# 3. Check pool metrics
curl https://api.example.com/metrics | grep db_connections
```

**Resolution:**

```bash
# Kill long-running queries
kubectl exec -it postgres-0 -- psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state != 'idle' AND query_start < NOW() - INTERVAL '5 minutes';"

# Increase pool size (temporary)
kubectl set env deployment/birthday-scheduler-api DATABASE_POOL_MAX=50

# Restart pods to reset connections
kubectl rollout restart deployment/birthday-scheduler-api
```

##### 4. QueueDepthCritical

**Alert:** Queue depth >10000 messages
**Severity:** Critical | **Response Time:** 10 minutes

**Symptoms:**
- Message delays
- Queue backing up
- Worker lag

**Diagnosis:**

```bash
# 1. Check queue stats
rabbitmqadmin list queues name messages consumers

# 2. Check worker count and health
kubectl get pods -l app=birthday-scheduler-worker
kubectl top pods -l app=birthday-scheduler-worker

# 3. Check processing rate
curl https://api.example.com/metrics | grep messages_processed
```

**Resolution:**

```bash
# Scale up workers
kubectl scale deployment/birthday-scheduler-worker --replicas=20

# Check for stuck consumers
rabbitmqadmin list consumers

# If consumer stuck, restart workers
kubectl rollout restart deployment/birthday-scheduler-worker

# Monitor queue drain
watch -n 5 'rabbitmqadmin list queues name messages'
```

##### 5. CircuitBreakerOpen

**Alert:** Circuit breaker in open state
**Severity:** Critical | **Response Time:** 5 minutes

**Symptoms:**
- External API calls failing
- Messages not delivering
- Immediate rejections

**Diagnosis:**

```bash
# 1. Check circuit breaker state
curl https://api.example.com/metrics | grep circuit_breaker_state

# 2. Test external service directly
curl -v https://external-api.example.com/health

# 3. Check failure reason in logs
kubectl logs deployment/birthday-scheduler-worker | grep -i "circuit\|external" | tail -50
```

**Resolution:**

```bash
# Wait for automatic half-open (30s)
# Or restart workers to reset circuit breaker
kubectl rollout restart deployment/birthday-scheduler-worker

# If external service down, contact vendor
# Document in incident log

# Verify circuit closed
watch -n 5 'curl -s https://api.example.com/metrics | grep circuit_breaker_state'
```

##### 6. DLQDepthHigh

**Alert:** DLQ >100 messages
**Severity:** Critical | **Response Time:** 15 minutes

**Symptoms:**
- Messages permanently failing
- Manual intervention required
- Potential data loss

**Diagnosis:**

```bash
# 1. Check DLQ depth
rabbitmqadmin list queues name=birthday_messages_dlq

# 2. Sample failed messages
rabbitmqadmin get queue=birthday_messages_dlq count=10

# 3. Analyze failure patterns
kubectl logs deployment/birthday-scheduler-worker | grep -i "dlq\|dead.letter" | tail -100
```

**Resolution:**

```bash
# Review messages and determine fix
# Option A: Requeue after fixing root cause
rabbitmqadmin publish exchange=birthday_exchange routing_key=birthday_messages payload="<message>"

# Option B: Archive for later analysis
rabbitmqadmin get queue=birthday_messages_dlq count=1000 > dlq_backup.json

# Option C: Purge if messages are stale
rabbitmqadmin purge queue name=birthday_messages_dlq
```

#### Warning Alerts (P1 - Respond Within Hours)

##### 7. HighLatency

**Alert:** P99 latency >5 seconds
**Severity:** Warning | **Response Time:** 1 hour

**Investigation:**

```promql
# Find slow endpoints
topk(10, histogram_quantile(0.99, sum(rate(birthday_scheduler_api_response_time_bucket[5m])) by (le, path)))

# Check database query times
histogram_quantile(0.99, sum(rate(birthday_scheduler_database_query_duration_bucket[5m])) by (le, query_type))

# Check external API latency
histogram_quantile(0.99, sum(rate(birthday_scheduler_external_api_duration_bucket[5m])) by (le, api))
```

##### 8. MemoryUsageHigh

**Alert:** Memory >85%
**Severity:** Warning | **Response Time:** 2 hours

**Investigation:**

```bash
# Check memory breakdown
kubectl top pods -l app=birthday-scheduler-api

# Check heap growth (memory leak indicator)
curl "http://prometheus:9090/api/v1/query?query=deriv(birthday_scheduler_nodejs_heap_size_used_bytes[1h])"

# Check GC pressure
curl "http://prometheus:9090/api/v1/query?query=rate(birthday_scheduler_nodejs_gc_duration_seconds_count{kind='major'}[5m])"
```

##### 9. SlowDatabaseQueries

**Alert:** P95 query time >1 second
**Severity:** Warning | **Response Time:** 2 hours

**Investigation:**

```sql
-- Find slow queries
SELECT query, calls, total_time/calls as avg_time, rows
FROM pg_stat_statements
ORDER BY total_time/calls DESC
LIMIT 20;

-- Check for missing indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Check table bloat
SELECT schemaname, tablename, n_dead_tup, n_live_tup,
       round(n_dead_tup::numeric/n_live_tup::numeric * 100, 2) as dead_ratio
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY dead_ratio DESC;
```

##### 10. RetryRateHigh

**Alert:** Retry rate >10%
**Severity:** Warning | **Response Time:** 2 hours

**Investigation:**

```promql
# Breakdown by retry reason
sum(rate(birthday_scheduler_message_retries_total[5m])) by (retry_reason)

# Check external API health
sum(rate(birthday_scheduler_external_api_calls_total{status!="200"}[5m])) by (api_name, status)

# Check network errors
sum(rate(birthday_scheduler_http_client_timeouts_total[5m]))
```

---

### Queue Monitoring Deep-Dive

#### Queue Health Assessment

```promql
# Overall queue health score (0-100)
# Score = 100 - (queue_depth_penalty + dlq_penalty + retry_penalty)
100 - (
  (clamp_max(birthday_scheduler_queue_depth / 100, 50)) +
  (clamp_max(birthday_scheduler_dlq_depth * 5, 30)) +
  (clamp_max(sum(rate(birthday_scheduler_message_retries_total[5m])) * 100, 20))
)
```

#### Queue Metrics to Monitor

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Queue Depth | <100 | 100-1000 | >1000 |
| DLQ Depth | 0 | 1-10 | >10 |
| Consumer Count | >0 | N/A | 0 |
| Message Age (oldest) | <1m | 1-5m | >5m |
| Processing Rate | Matches ingest | <ingest | <<ingest |

#### DLQ Investigation Procedure

```bash
# Step 1: Get DLQ message count
rabbitmqadmin list queues name=birthday_messages_dlq

# Step 2: Sample messages to understand failure pattern
rabbitmqadmin get queue=birthday_messages_dlq count=5 ackmode=ack_requeue_false

# Step 3: Parse message headers for death reason
# Look for x-death header which contains:
# - queue: original queue
# - reason: rejection reason (rejected, expired, maxlen)
# - count: number of deaths
# - time: timestamp of death

# Step 4: Categorize failures
kubectl logs deployment/birthday-scheduler-worker | grep "message.failed\|dlq" | jq -r '.error_type' | sort | uniq -c

# Step 5: Resolution based on failure type:
# - validation_error: Fix data, requeue manually
# - external_api_error: Wait for API recovery, requeue
# - timeout: Increase timeout, requeue
# - permanent_failure: Archive and document
```

#### Consumer Diagnostics

```promql
# Consumer lag
birthday_scheduler_queue_depth / (sum(rate(birthday_scheduler_messages_processed_total[1m])) + 0.001)

# Consumer efficiency (messages/second/consumer)
sum(rate(birthday_scheduler_messages_processed_total[5m])) / birthday_scheduler_consumer_count

# Consumer utilization
birthday_scheduler_queue_consumer_utilization

# Prefetch utilization
birthday_scheduler_unacked_messages_count / birthday_scheduler_prefetch_count
```

#### Queue Troubleshooting Decision Tree

```
Queue Depth Increasing?
    |
    +-- Yes --> Consumers Running?
    |               |
    |               +-- No --> Start consumers
    |               |
    |               +-- Yes --> Consumer Errors?
    |                               |
    |                               +-- Yes --> Check logs, fix errors
    |                               |
    |                               +-- No --> Scale consumers
    |
    +-- No --> DLQ Growing?
                    |
                    +-- Yes --> Investigate failures
                    |
                    +-- No --> System healthy
```

---

### Database Monitoring

#### Connection Pool Management

```promql
# Pool utilization percentage
birthday_scheduler_db_connections_active / birthday_scheduler_db_connections_max * 100

# Wait queue length
birthday_scheduler_db_pool_waiting_requests

# Connection acquisition time (P95)
histogram_quantile(0.95, rate(birthday_scheduler_connection_pool_acquisition_time_bucket[5m]))
```

**Healthy Pool Configuration:**

| Pool Size | Service Replicas | Connections/Replica | Total Max |
|-----------|-----------------|---------------------|-----------|
| 20 | 3 | 20 | 60 |
| 50 | 5 | 50 | 250 |
| 100 | 10 | 100 | 1000 |

**Warning:** PostgreSQL default max_connections = 100. Adjust server config accordingly.

#### Slow Query Detection

```sql
-- Enable pg_stat_statements if not enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 slowest queries by average time
SELECT
    LEFT(query, 100) as query_preview,
    calls,
    round(total_exec_time::numeric / calls, 2) as avg_ms,
    round(total_exec_time::numeric, 2) as total_ms,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time / calls DESC
LIMIT 10;

-- Queries with high I/O
SELECT
    LEFT(query, 100) as query_preview,
    shared_blks_read + local_blks_read as blocks_read,
    shared_blks_hit + local_blks_hit as blocks_hit
FROM pg_stat_statements
ORDER BY shared_blks_read + local_blks_read DESC
LIMIT 10;
```

#### Lock Contention Monitoring

```sql
-- Current locks
SELECT
    pg_locks.pid,
    pg_stat_activity.usename,
    pg_locks.locktype,
    pg_locks.mode,
    pg_locks.granted,
    pg_stat_activity.query,
    age(now(), pg_stat_activity.query_start) as duration
FROM pg_locks
JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
WHERE pg_locks.granted = false
ORDER BY pg_stat_activity.query_start;

-- Blocking queries
SELECT
    blocked.pid AS blocked_pid,
    blocked.query AS blocked_query,
    blocking.pid AS blocking_pid,
    blocking.query AS blocking_query
FROM pg_locks blocked_locks
JOIN pg_stat_activity blocked ON blocked_locks.pid = blocked.pid
JOIN pg_locks blocking_locks ON blocked_locks.locktype = blocking_locks.locktype
    AND blocked_locks.relation = blocking_locks.relation
    AND blocked_locks.pid != blocking_locks.pid
JOIN pg_stat_activity blocking ON blocking_locks.pid = blocking.pid
WHERE NOT blocked_locks.granted;
```

#### Database Health Queries

```promql
# Index hit ratio (should be >99%)
birthday_scheduler_index_hit_ratio

# Buffer cache hit ratio (should be >95%)
birthday_scheduler_buffer_cache_hit_ratio

# Replication lag
birthday_scheduler_db_replication_lag_seconds

# Transaction rollback ratio
sum(rate(birthday_scheduler_database_rollbacks_total[5m]))
 / (sum(rate(birthday_scheduler_database_commits_total[5m])) + 0.001) * 100

# Deadlock rate
rate(birthday_scheduler_database_deadlocks_total[5m])
```

---

### Metric-Driven Troubleshooting Trees

#### High API Latency Investigation

```
P99 Latency > 1s
    |
    +-- Check: Database Query Latency
    |       Query: histogram_quantile(0.99, rate(birthday_scheduler_database_query_duration_bucket[5m]))
    |       |
    |       +-- High (>100ms) --> Database Investigation
    |       |       - Check slow queries
    |       |       - Check connection pool
    |       |       - Check index usage
    |       |
    |       +-- Normal --> Check: External API Latency
    |               Query: histogram_quantile(0.99, rate(birthday_scheduler_external_api_duration_bucket[5m]))
    |               |
    |               +-- High (>500ms) --> External API Investigation
    |               |       - Check circuit breaker
    |               |       - Check timeout settings
    |               |       - Contact vendor
    |               |
    |               +-- Normal --> Check: Application Processing
    |                       Query: birthday_scheduler_nodejs_eventloop_lag_seconds
    |                       |
    |                       +-- High (>100ms) --> CPU/GC Investigation
    |                       |       - Check CPU usage
    |                       |       - Check GC pause time
    |                       |       - Profile application
    |                       |
    |                       +-- Normal --> Network Investigation
```

#### High Error Rate Investigation

```
Error Rate > 5%
    |
    +-- Check: Error Distribution by Status
    |       Query: sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])) by (status)
    |       |
    |       +-- 500 Internal Server Error
    |       |       Check: Application logs for exceptions
    |       |       Check: Memory usage for OOM
    |       |       Check: Database connection errors
    |       |
    |       +-- 502 Bad Gateway
    |       |       Check: Upstream service health
    |       |       Check: Load balancer config
    |       |
    |       +-- 503 Service Unavailable
    |       |       Check: Service health
    |       |       Check: Resource limits
    |       |       Check: Circuit breaker state
    |       |
    |       +-- 504 Gateway Timeout
    |               Check: Request timeout settings
    |               Check: Database query times
    |               Check: External API latency
    |
    +-- Check: Error Distribution by Endpoint
            Query: sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])) by (path)
            |
            +-- Single endpoint affected --> Code bug or dependency issue
            |
            +-- All endpoints affected --> Infrastructure or database issue
```

#### Memory Leak Detection

```
Memory Growing Steadily
    |
    +-- Check: Heap Growth Rate
    |       Query: deriv(birthday_scheduler_nodejs_heap_size_used_bytes[1h])
    |       |
    |       +-- Positive (>1MB/hour) --> Possible Memory Leak
    |               |
    |               +-- Check: GC Frequency
    |               |       Query: rate(birthday_scheduler_nodejs_gc_duration_seconds_count[5m])
    |               |       |
    |               |       +-- High --> GC unable to keep up
    |               |       |       - Profile heap with --inspect
    |               |       |       - Check for closure leaks
    |               |       |       - Check event listener cleanup
    |               |       |
    |               |       +-- Normal --> External allocations
    |               |               - Check native modules
    |               |               - Check buffer allocations
    |               |
    |               +-- Check: Active Handles
    |                       Query: birthday_scheduler_nodejs_active_handles_total
    |                       |
    |                       +-- Growing --> Handle leak
    |                               - Check timer cleanup
    |                               - Check socket cleanup
    |                               - Check file descriptor cleanup
    |
    +-- Stable or Declining --> Normal operation, sawtooth pattern expected
```

---

### SLO Tracking Procedures

#### Defined SLOs

| SLO | Target | Measurement Window | Error Budget (30d) |
|-----|--------|-------------------|-------------------|
| API Availability | 99.9% | Rolling 30 days | 43.2 minutes |
| API Latency (P99) | <2 seconds | Rolling 30 days | N/A |
| Message Delivery Rate | 99% | Rolling 7 days | 1% failures |
| Message On-Time Rate | 95% | Rolling 7 days | 5% late |

#### SLI Measurement Queries

```promql
# SLI: API Availability
(
  sum(increase(birthday_scheduler_api_requests_total{status!~"5.."}[30d]))
  / sum(increase(birthday_scheduler_api_requests_total[30d]))
) * 100

# SLI: API Latency (% requests under 2s)
(
  sum(increase(birthday_scheduler_api_response_time_bucket{le="2"}[30d]))
  / sum(increase(birthday_scheduler_api_response_time_count[30d]))
) * 100

# SLI: Message Delivery Rate
(
  sum(increase(birthday_scheduler_messages_delivered_total[7d]))
  / sum(increase(birthday_scheduler_messages_sent_total[7d]))
) * 100

# SLI: Message On-Time Rate
(
  sum(increase(birthday_scheduler_messages_on_time_total[7d]))
  / sum(increase(birthday_scheduler_messages_scheduled_total[7d]))
) * 100
```

#### Error Budget Calculation

```promql
# Error Budget Consumed (API Availability)
# Target: 99.9% = 0.1% error budget
(
  1 - (
    sum(increase(birthday_scheduler_api_requests_total{status!~"5.."}[30d]))
    / sum(increase(birthday_scheduler_api_requests_total[30d]))
  )
) / 0.001 * 100

# Error Budget Burn Rate (hourly)
# If >1, budget will be exhausted before month end
(
  1 - (
    sum(rate(birthday_scheduler_api_requests_total{status!~"5.."}[1h]))
    / sum(rate(birthday_scheduler_api_requests_total[1h]))
  )
) / (0.001 / 720)

# Time to Error Budget Exhaustion (hours)
# At current burn rate
(
  1 - (
    (
      1 - (
        sum(increase(birthday_scheduler_api_requests_total{status!~"5.."}[30d]))
        / sum(increase(birthday_scheduler_api_requests_total[30d]))
      )
    ) / 0.001
  )
) / (
  (
    1 - (
      sum(rate(birthday_scheduler_api_requests_total{status!~"5.."}[1h]))
      / sum(rate(birthday_scheduler_api_requests_total[1h]))
    )
  ) / (0.001 / 720)
) * 720
```

#### Weekly SLO Review Procedure

1. **Generate SLO Report:**

```bash
# Query all SLIs
for sli in availability latency delivery ontime; do
  curl -s "http://prometheus:9090/api/v1/query?query=sli_${sli}_percentage" | jq '.data.result[0].value[1]'
done
```

2. **Review Error Budget Status:**
   - Green (>50% remaining): Continue normal operations
   - Yellow (25-50% remaining): Increase monitoring, reduce risky changes
   - Red (<25% remaining): Freeze non-critical changes, focus on reliability

3. **Document Findings:**
   - Record SLO values in tracking spreadsheet
   - Note any incidents that impacted SLOs
   - Plan remediation for recurring issues

---

### Post-Incident Analysis

#### Metric Review Checklist

After any P0 or P1 incident, review these metrics:

**Timeline Construction:**

```promql
# Get time series around incident (replace timestamps)
# Error rate during incident window
sum(rate(birthday_scheduler_api_requests_total{status=~"5.."}[1m]))
  [2h:1m] @ <incident_end_timestamp>

# Latency during incident window
histogram_quantile(0.99, sum(rate(birthday_scheduler_api_response_time_bucket[1m])) by (le))
  [2h:1m] @ <incident_end_timestamp>
```

**Pre-Incident Baseline:**

```bash
# Compare incident period to 7-day average
# Request rate
curl "http://prometheus:9090/api/v1/query?query=avg_over_time(sum(rate(birthday_scheduler_api_requests_total[5m]))[7d:5m])"

# Error rate baseline
curl "http://prometheus:9090/api/v1/query?query=avg_over_time((sum(rate(birthday_scheduler_api_requests_total{status=~'5..'}[5m]))/sum(rate(birthday_scheduler_api_requests_total[5m])))[7d:5m])"
```

**Impact Assessment:**

| Metric | Query | Document |
|--------|-------|----------|
| Total failed requests | `sum(increase(birthday_scheduler_api_requests_total{status=~"5.."}[<duration>]))` | Number of user-facing errors |
| Total affected users | Estimate from request count | User impact scope |
| SLO impact | Error budget burn during incident | Budget consumed |
| Revenue impact | Business calculation | Financial impact |

**Root Cause Indicators:**

```promql
# Did deployment cause it?
changes(kube_deployment_status_observed_generation{deployment="birthday-scheduler-api"}[1h])

# Did resource exhaustion cause it?
max_over_time(birthday_scheduler_memory_used_bytes[1h]) / birthday_scheduler_memory_limit_bytes

# Did dependency failure cause it?
max_over_time(birthday_scheduler_circuit_breaker_state[1h])

# Did database cause it?
max_over_time(birthday_scheduler_db_connections_active[1h]) / birthday_scheduler_db_connections_max
```

#### Post-Incident Report Template

```markdown
## Incident Report: [TITLE]

### Summary
- **Date:** YYYY-MM-DD
- **Duration:** HH:MM - HH:MM (X minutes)
- **Severity:** P0/P1/P2
- **Impact:** [User impact description]

### Timeline
| Time | Event |
|------|-------|
| HH:MM | [Event description] |

### Metrics During Incident
- Error Rate Peak: X%
- Latency P99 Peak: Xs
- Failed Requests: N
- Error Budget Consumed: X%

### Root Cause
[Description of what caused the incident]

### Detection
- Alert fired: [Alert name] at HH:MM
- Detection time: X minutes

### Resolution
[Description of how the incident was resolved]

### Prevention
| Action Item | Owner | Due Date |
|-------------|-------|----------|
| [Action] | [Name] | YYYY-MM-DD |

### Lessons Learned
- [Lesson 1]
- [Lesson 2]
```

---

### Log Analysis

**Access Logs:**

```bash
# Kubernetes
kubectl logs -f deployment/birthday-scheduler-api --tail=100

# Filter errors
kubectl logs deployment/birthday-scheduler-api | grep -i error

# JSON parsing
kubectl logs deployment/birthday-scheduler-api | jq 'select(.level == "error")'

# Docker
docker logs -f birthday-scheduler-api --tail=100

# PM2
pm2 logs api
```

**Log Levels:**
- **DEBUG** - Detailed trace information
- **INFO** - General informational messages
- **WARN** - Warning messages (potential issues)
- **ERROR** - Error messages (action required)
- **FATAL** - Critical failures (immediate action)

---

### Health Checks

**Endpoints:**

```bash
# Application health
curl https://api.example.com/health

# Detailed health check
curl https://api.example.com/health/detailed

# Database health
curl https://api.example.com/health/db

# Queue health
curl https://api.example.com/health/queue

# Readiness check
curl https://api.example.com/ready

# Liveness check
curl https://api.example.com/alive
```

---

## Troubleshooting

### Problem: Messages Not Sending

**Symptoms:**
- Messages queued but not delivered
- Queue depth increasing
- No errors in logs

**Diagnosis:**

```bash

# 1. Check workers are running

kubectl get pods | grep worker

# 2. Check worker logs

kubectl logs deployment/birthday-scheduler-worker --tail=50

# 3. Check queue status

rabbitmqadmin list queues

# 4. Check external API circuit breaker

curl https://api.example.com/metrics | grep circuit_breaker

# 5. Test external API manually

curl https://message-service.example.com/send -H "Authorization: Bearer $API_KEY"
```

**Resolution:**

```bash

# If workers not running

kubectl scale deployment birthday-scheduler-worker --replicas=5

# If circuit breaker open
# Wait for automatic recovery (30s) or
# Fix external service issue

# If external API credentials invalid
# Update secret manager

kubectl rollout restart deployment/birthday-scheduler-worker

# If queue connection lost

kubectl rollout restart deployment/birthday-scheduler-worker
```

### Problem: Queue Backing Up

**Symptoms:**
- Queue depth > 1000
- Alert: HighQueueDepth
- Messages delayed

**Diagnosis:**

```bash

# Check queue stats

rabbitmqadmin list queues

# Check worker count

kubectl get pods | grep worker | wc -l

# Check worker CPU/memory

kubectl top pods | grep worker

# Check message processing rate

curl https://api.example.com/metrics | grep messages_processed
```

**Resolution:**

```bash

# Scale up workers

kubectl scale deployment birthday-scheduler-worker --replicas=20

# Increase worker resources

kubectl set resources deployment/birthday-scheduler-worker \
  --limits=cpu=2000m,memory=2Gi \
  --requests=cpu=1000m,memory=1Gi

# If queue overflow
# Increase queue max length in RabbitMQ
# Set up additional DLX (dead letter exchange)

# Monitor until queue drains

watch -n 5 'rabbitmqadmin list queues'
```

### Problem: Database Performance Issues

**Symptoms:**
- Slow API responses
- Database CPU high
- Connection pool warnings

**Diagnosis:**

```bash

# Check active queries

psql $DATABASE_URL -c "SELECT pid, query, state, query_start FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"

# Check slow queries

psql $DATABASE_URL -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check connection pool

curl https://api.example.com/metrics | grep db_pool

# Check table sizes

psql $DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

**Resolution:**

```bash

# Kill long-running queries

psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state != 'idle' AND query_start < NOW() - INTERVAL '5 minutes';"

# Increase connection pool

kubectl set env deployment/birthday-scheduler-api DATABASE_POOL_MAX=50

# Add database indexes (if missing)

psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY idx_users_date_of_birth ON users(date_of_birth);"

# Vacuum database

psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Scale database instance
# See Vertical Scaling section

```

### Problem: Worker Crashes

**Symptoms:**
- Workers restarting frequently
- Alert: WorkerCrashRecovery
- Unprocessed messages

**Diagnosis:**

```bash

# Check worker logs

kubectl logs deployment/birthday-scheduler-worker --tail=200

# Check recent restarts

kubectl describe pods | grep -A 5 "Restart Count"

# Check resource limits

kubectl describe deployment birthday-scheduler-worker | grep -A 5 "Limits"

# Check OOM kills

kubectl get pods -o json | jq '.items[] | select(.status.containerStatuses[].lastState.terminated.reason == "OOMKilled")'
```

**Resolution:**

```bash

# Increase memory limits

kubectl set resources deployment/birthday-scheduler-worker \
  --limits=memory=2Gi \
  --requests=memory=1Gi

# Fix memory leak (if code issue)
# Deploy hotfix with fix

# Reduce worker concurrency

kubectl set env deployment/birthday-scheduler-worker WORKER_CONCURRENCY=5

# Monitor for stability

kubectl logs -f deployment/birthday-scheduler-worker
```

### Problem: Circuit Breaker Stuck Open

**Symptoms:**
- Alert: CircuitBreakerOpen
- External API calls failing
- Messages not sending

**Diagnosis:**

```bash

# Check circuit breaker state

curl https://api.example.com/metrics | grep circuit_breaker_state

# Test external service

curl -v https://message-service.example.com/health

# Check circuit breaker config

kubectl describe configmap birthday-scheduler-config | grep -A 5 CIRCUIT

# Check logs for errors

kubectl logs deployment/birthday-scheduler-worker | grep -i "circuit\|external"
```

**Resolution:**

```bash

# If external service is healthy
# Wait for automatic half-open (30s reset timeout)

# If external service is down
# Contact external service provider
# Implement graceful degradation

# Manual circuit breaker reset (if needed)
# Restart workers to reset state

kubectl rollout restart deployment/birthday-scheduler-worker

# Verify circuit closed

curl https://api.example.com/metrics | grep circuit_breaker_state
```

---

## Maintenance Procedures

### 1. Database Maintenance

**Weekly Tasks:**

```bash

# Vacuum and analyze

psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Reindex if needed

psql $DATABASE_URL -c "REINDEX DATABASE birthday_scheduler;"

# Check for bloat

psql $DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

**Monthly Tasks:**

```bash

# Update statistics

psql $DATABASE_URL -c "ANALYZE VERBOSE;"

# Check for unused indexes

psql $DATABASE_URL -c "SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE idx_scan = 0 AND indexrelname NOT LIKE 'pg_%';"

# Archive old data (if applicable)

psql $DATABASE_URL -c "DELETE FROM message_logs WHERE created_at < NOW() - INTERVAL '90 days';"
```

### 2. Queue Maintenance

**Daily Tasks:**

```bash

# Check queue health

rabbitmqadmin list queues

# Purge dead letter queue (review first)

rabbitmqadmin purge queue name=birthday_messages_dlq
```

**Weekly Tasks:**

```bash

# Check queue policies

rabbitmqadmin list policies

# Review dead letter messages

rabbitmqadmin get queue=birthday_messages_dlq count=10
```

### 3. Log Rotation

**Configuration:**

```bash

# /etc/logrotate.d/birthday-scheduler

/var/log/birthday-scheduler/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 app app
    postrotate
        docker kill -s USR1 $(docker ps -q --filter name=birthday-scheduler)
    endscript
}
```

### 4. Dependency Updates

**Monthly:**

```bash

# Check for updates

npm outdated

# Update dependencies

npm update

# Audit security

npm audit

# Fix vulnerabilities

npm audit fix

# Test

npm test

# Deploy
# Follow standard deployment procedure

```

---

## Backup & Recovery

### 1. Database Backup

**Automated Backups (Daily):**

```bash

#!/bin/bash
# backup-database.sh

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/birthday_scheduler_${TIMESTAMP}.sql.gz"

# Create backup

pg_dump $DATABASE_URL | gzip > $BACKUP_FILE

# Upload to S3

aws s3 cp $BACKUP_FILE s3://backups/birthday-scheduler/

# Retain last 30 days

find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Verify backup

if [ $? -eq 0 ]; then
    echo "Backup successful: $BACKUP_FILE"
else
    echo "Backup failed!" | mail -s "Backup Failed" ops@example.com
fi
```

**Cron Schedule:**

```bash

# Daily at 2 AM

0 2 * * * /usr/local/bin/backup-database.sh
```

### 2. Database Restore

**From Backup:**

```bash

# 1. Stop application (prevent writes)

kubectl scale deployment birthday-scheduler-api --replicas=0
kubectl scale deployment birthday-scheduler-worker --replicas=0

# 2. Download backup

aws s3 cp s3://backups/birthday-scheduler/birthday_scheduler_20250130_020000.sql.gz .

# 3. Restore database

gunzip < birthday_scheduler_20250130_020000.sql.gz | psql $DATABASE_URL

# 4. Verify data

psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# 5. Restart application

kubectl scale deployment birthday-scheduler-api --replicas=3
kubectl scale deployment birthday-scheduler-worker --replicas=5

# 6. Verify functionality

curl https://api.example.com/health
```

### 3. Point-in-Time Recovery (PITR)

**AWS RDS:**

```bash

# Restore to specific time

aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier birthday-scheduler-db \
  --target-db-instance-identifier birthday-scheduler-db-restored \
  --restore-time 2025-01-30T14:30:00Z

# Wait for restore

aws rds wait db-instance-available \
  --db-instance-identifier birthday-scheduler-db-restored

# Update application connection
# Point to restored database

```

---

## Incident Response

### Incident Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| P1 - Critical | Service down, data loss | 15 minutes | Immediate |
| P2 - High | Degraded performance, partial outage | 30 minutes | 1 hour |
| P3 - Medium | Non-critical feature broken | 2 hours | 4 hours |
| P4 - Low | Minor issue, workaround available | 1 business day | None |

### Incident Response Process

**1. Detection & Alerting**
- Alert fires in PagerDuty
- On-call engineer acknowledges

**2. Initial Response**
```bash

# Assess severity
# Check dashboards: https://grafana.example.com
# Review recent deployments: git log --since="1 hour ago"
# Check error logs: kubectl logs deployment/birthday-scheduler-api | grep ERROR

```

**3. Communication**
```bash

# Update status page: https://status.example.com
# Notify team via email or PagerDuty
# Create incident ticket

```

**4. Mitigation**
```bash

# Apply immediate fix or rollback
# See Rollback Procedure section

# Monitor recovery
# Watch metrics in Grafana

```

**5. Resolution**
```bash

# Verify service restored

curl https://api.example.com/health

# Update status page: "Incident resolved"
# Close incident ticket

```

**6. Post-Mortem**
```markdown

# Incident Report Template

## Incident Summary

- **Date:** 2025-01-30
- **Duration:** 14:00 - 14:45 UTC (45 minutes)
- **Severity:** P1 - Critical
- **Impact:** Service completely down, 100% error rate

## Timeline

- 14:00 - Alert fired: ServiceDown
- 14:05 - On-call acknowledged, began investigation
- 14:15 - Root cause identified: bad deployment
- 14:20 - Rollback initiated
- 14:30 - Service restored
- 14:45 - Monitoring confirmed stable

## Root Cause

Database migration contained syntax error, preventing application startup.

## Resolution

Rolled back to previous version, fixed migration, redeployed.

## Action Items

- [ ] Add migration validation in CI/CD
- [ ] Improve pre-deployment testing
- [ ] Update runbook with this scenario
```

---

## Contacts & Escalation

### Primary Contacts

**On-Call Rotation:**
- **Week 1:** Alice (alice@example.com, +1-555-0101)
- **Week 2:** Bob (bob@example.com, +1-555-0102)
- **Week 3:** Carol (carol@example.com, +1-555-0103)

**Team Leads:**
- **Engineering Lead:** David (david@example.com, +1-555-0201)
- **DevOps Lead:** Eve (eve@example.com, +1-555-0202)
- **Product Manager:** Frank (frank@example.com, +1-555-0203)

### Escalation Path

1. **L1 - On-Call Engineer** (0-15 minutes)
   - Acknowledge alert
   - Initial diagnosis
   - Apply standard fixes

2. **L2 - Engineering Lead** (15-30 minutes)
   - Complex technical issues
   - Deployment decisions
   - Code hotfixes

3. **L3 - VP Engineering** (30-60 minutes)
   - Business impact decisions
   - Major incident coordination
   - External communications

### External Vendors

**Infrastructure:**
- AWS Support: +1-866-765-4527
- PostgreSQL Support: support@postgres.com
- RabbitMQ Support: support@rabbitmq.com

**Monitoring:**
- Grafana Cloud: support@grafana.com
- PagerDuty: +1-650-989-2974

---

**Last Updated:** 2025-12-31
**Version:** 2.0.0
**Owner:** DevOps Team
