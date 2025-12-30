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

### 1. Grafana Dashboards

**Access:** https://grafana.example.com

**Key Dashboards:**
- **Overview Dashboard** - System health, request rate, errors
- **API Performance** - Response times, throughput
- **Worker Performance** - Message processing, queue depth
- **Database Performance** - Connections, query times
- **Business Metrics** - Messages sent, success rate

### 2. Prometheus Queries

**Useful Queries:**

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Queue depth
rabbitmq_queue_messages{queue="birthday_messages"}

# Database connections
pg_stat_database_numbackends{datname="birthday_scheduler"}

# Memory usage
process_resident_memory_bytes / 1024 / 1024 / 1024

# Circuit breaker state
circuit_breaker_state
```

### 3. Log Analysis

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

### 4. Health Checks

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
- Alert fires in PagerDuty/Slack
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
# Notify team in #incidents Slack channel
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

**Slack Channels:**
- #incidents - Active incident discussion
- #deployments - Deployment notifications
- #ops-alerts - Automated alerts
- #postmortems - Incident reviews

---

**Last Updated:** 2025-12-30
**Version:** 1.0.0
**Owner:** DevOps Team
