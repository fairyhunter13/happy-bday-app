# Disaster Recovery Playbook

**Last Updated:** 2026-01-04
**Version:** 1.0
**Owner:** DevOps Team

---

## Purpose

This playbook provides step-by-step procedures to recover from catastrophic failures in the Birthday Message Scheduler system. Use this guide during emergencies to minimize downtime and data loss.

---

## Table of Contents

1. [Database Failure Recovery](#database-failure-recovery)
2. [RabbitMQ Cluster Failure](#rabbitmq-cluster-failure)
3. [Complete System Failure](#complete-system-failure)
4. [Data Corruption Recovery](#data-corruption-recovery)
5. [Recovery Time Objectives (RTO/RPO)](#recovery-time-objectives-rtorpo)

---

## Database Failure Recovery

### Detection

**Symptoms:**
- API returns 500 errors with database connection failures
- Health check endpoint (`/health`) shows `database: unhealthy`
- Application logs show `ECONNREFUSED` or `Connection terminated` errors
- Prometheus alert: `PostgresDatabaseDown`

**Verification:**
```bash
# Check if PostgreSQL is responding
pg_isready -h localhost -p 5432 -U postgres

# Check PostgreSQL logs
docker logs birthday-app-postgres --tail 100

# Check connection from application container
docker exec birthday-app-api node -e "require('pg').Pool({connectionString: process.env.DATABASE_URL}).query('SELECT 1')"
```

### Recovery Steps

#### Scenario 1: PostgreSQL Container Crash

1. **Check container status:**
   ```bash
   docker ps -a | grep postgres
   ```

2. **Restart PostgreSQL container:**
   ```bash
   docker-compose restart postgres
   ```

3. **Wait for health check:**
   ```bash
   # Should return "accepting connections"
   docker exec birthday-app-postgres pg_isready
   ```

4. **Verify application reconnection:**
   ```bash
   curl http://localhost:3000/health
   ```

**Expected Recovery Time:** 2-5 minutes

#### Scenario 2: Data Corruption

1. **Stop dependent services immediately:**
   ```bash
   docker-compose stop api workers
   ```

2. **Assess corruption extent:**
   ```bash
   # Check PostgreSQL logs for corruption messages
   docker logs birthday-app-postgres | grep -i "corrupt\|invalid\|error"

   # Run PostgreSQL integrity check
   docker exec birthday-app-postgres psql -U postgres -d birthday_app -c "
   SELECT schemaname, tablename
   FROM pg_tables
   WHERE schemaname = 'public';
   "
   ```

3. **Restore from latest backup:**
   ```bash
   # List available backups
   ls -lh /backups/postgres/

   # Restore from backup (use latest backup file)
   ./scripts/restore-database.sh /backups/postgres/birthday_app_2026-01-04_00-00.dump
   ```

4. **Verify data integrity:**
   ```bash
   docker exec birthday-app-postgres psql -U postgres -d birthday_app -c "
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM message_logs;
   SELECT MAX(created_at) FROM users;
   "
   ```

5. **Restart application services:**
   ```bash
   docker-compose up -d api workers
   ```

6. **Monitor for errors:**
   ```bash
   docker logs -f birthday-app-api
   ```

**Expected Recovery Time:** 15-30 minutes (depending on backup size)

#### Scenario 3: Disk Full

1. **Identify disk usage:**
   ```bash
   df -h
   docker system df
   ```

2. **Clean up space:**
   ```bash
   # Remove old Docker images/containers
   docker system prune -a --volumes -f

   # Remove old logs
   find /var/log -name "*.log" -mtime +7 -delete
   ```

3. **Expand volume (if cloud provider):**
   ```bash
   # AWS EBS example
   aws ec2 modify-volume --volume-id vol-xxx --size 100

   # Resize filesystem
   sudo resize2fs /dev/xvda1
   ```

4. **Restart PostgreSQL:**
   ```bash
   docker-compose restart postgres
   ```

**Expected Recovery Time:** 10-20 minutes

### Post-Recovery Verification

1. **Verify all tables accessible:**
   ```sql
   SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

2. **Check recent data:**
   ```sql
   SELECT COUNT(*) as total_users, MAX(created_at) as latest_user FROM users;
   SELECT COUNT(*) as total_logs, MAX(created_at) as latest_log FROM message_logs;
   ```

3. **Test CRUD operations:**
   ```bash
   # Create test user
   curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{"firstName":"Test","lastName":"Recovery","email":"test-recovery@example.com","timezone":"UTC"}'

   # Verify created
   curl http://localhost:3000/api/users?email=test-recovery@example.com
   ```

---

## RabbitMQ Cluster Failure

### Detection

**Symptoms:**
- Workers cannot process messages
- Message queue depth increasing
- RabbitMQ Management UI unreachable (http://localhost:15672)
- Prometheus alert: `RabbitMQDown` or `RabbitMQQueueDown`

**Verification:**
```bash
# Check RabbitMQ status
docker exec birthday-app-rabbitmq rabbitmq-diagnostics ping

# Check queue status
curl -u rabbitmq:rabbitmq_dev_password http://localhost:15672/api/queues
```

### Recovery Steps

#### Scenario 1: RabbitMQ Container Crash

1. **Restart RabbitMQ:**
   ```bash
   docker-compose restart rabbitmq
   ```

2. **Wait for startup (typically 30-60 seconds):**
   ```bash
   # Watch logs
   docker logs -f birthday-app-rabbitmq
   ```

3. **Verify queue restoration:**
   ```bash
   # Check queues restored
   curl -u rabbitmq:rabbitmq_dev_password http://localhost:15672/api/queues
   ```

4. **Restart workers to reconnect:**
   ```bash
   docker-compose restart workers
   ```

**Expected Recovery Time:** 2-5 minutes

#### Scenario 2: Queue Corruption or Loss

1. **Stop workers to prevent further issues:**
   ```bash
   docker-compose stop workers
   ```

2. **Check queue status:**
   ```bash
   docker exec birthday-app-rabbitmq rabbitmqctl list_queues name messages consumers
   ```

3. **Recreate queues if necessary:**
   ```bash
   # Connect to RabbitMQ
   docker exec -it birthday-app-rabbitmq sh

   # Delete corrupted queue
   rabbitmqctl delete_queue birthday-messages

   # Queue will be auto-recreated by application on worker restart
   exit
   ```

4. **Restart workers:**
   ```bash
   docker-compose up -d workers
   ```

5. **Trigger missed message scheduling:**
   ```bash
   # Trigger daily scheduler to requeue any missed messages
   curl -X POST http://localhost:3000/api/internal/trigger-scheduler
   ```

**Expected Recovery Time:** 10-15 minutes

### Post-Recovery Verification

1. **Verify queues exist:**
   ```bash
   curl -u rabbitmq:rabbitmq_dev_password http://localhost:15672/api/queues | jq '.[] | {name, messages, consumers}'
   ```

2. **Check worker connectivity:**
   ```bash
   docker logs birthday-app-workers | grep -i "connected to rabbitmq"
   ```

3. **Test message publishing:**
   ```bash
   # Create a test user with birthday today (will queue message)
   curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d "{\"firstName\":\"Queue\",\"lastName\":\"Test\",\"email\":\"queue-test@example.com\",\"timezone\":\"UTC\",\"birthdayDate\":\"$(date -u +%Y-%m-%d)\"}"
   ```

---

## Complete System Failure

### Detection

**Symptoms:**
- All services unreachable
- Server not responding to ping
- Cloud provider console shows instance stopped/terminated
- Monitoring dashboard completely offline

**Verification:**
```bash
# From another machine
ping <server-ip>
curl http://<server-ip>:3000/health
ssh user@<server-ip>
```

### Recovery Steps

#### Cloud Provider Instance Failure

1. **Check instance status in cloud provider console:**
   - AWS: EC2 Dashboard → Instance State
   - GCP: Compute Engine → VM instances
   - Azure: Virtual machines → Status

2. **Attempt instance restart:**
   ```bash
   # AWS CLI example
   aws ec2 start-instances --instance-ids i-xxxxx

   # Or from console: Instance → Actions → Instance State → Start
   ```

3. **If instance won't start, check system logs:**
   ```bash
   # AWS: Instance → Actions → Monitor and troubleshoot → Get system log
   # Look for kernel panic, disk errors, etc.
   ```

4. **If instance is unrecoverable, launch from AMI/snapshot:**
   ```bash
   # Restore from latest snapshot
   # 1. Create volume from latest EBS snapshot
   # 2. Launch new instance
   # 3. Attach restored volume
   # 4. Start services
   ```

5. **Verify all services started:**
   ```bash
   docker-compose ps
   curl http://localhost:3000/health
   ```

**Expected Recovery Time:** 15-45 minutes (depending on cloud provider)

#### Complete Datacenter Failure

1. **Activate disaster recovery site (if available)**

2. **Restore from backups at DR site:**
   ```bash
   # Restore database
   ./scripts/restore-database.sh /dr-backups/latest.dump

   # Pull latest Docker images
   docker-compose pull

   # Start all services
   docker-compose up -d
   ```

3. **Update DNS to point to DR site:**
   ```bash
   # Update A record to DR IP
   # Update process depends on DNS provider
   ```

4. **Verify all services operational:**
   ```bash
   ./scripts/health-check-all.sh
   ```

**Expected Recovery Time:** 1-4 hours (depending on DR preparedness)

### Post-Recovery Verification

1. **Check all service health:**
   ```bash
   curl http://localhost:3000/health | jq
   curl http://localhost:3000/ready | jq
   ```

2. **Verify metrics collection:**
   ```bash
   curl http://localhost:9090/-/healthy  # Prometheus
   curl http://localhost:3001/api/health  # Grafana
   ```

3. **Test end-to-end flow:**
   ```bash
   # Create user → Schedule message → Worker processes
   ./scripts/e2e-test.sh
   ```

---

## Data Corruption Recovery

### Detection

**Symptoms:**
- Database query errors: "invalid input syntax"
- Foreign key constraint violations
- Duplicate key violations where there shouldn't be
- Data inconsistencies reported by users

**Verification:**
```sql
-- Check for orphaned message logs (user deleted but logs remain)
SELECT COUNT(*) FROM message_logs ml
LEFT JOIN users u ON ml.user_id = u.id
WHERE u.id IS NULL;

-- Check for duplicate emails (should be impossible with UNIQUE constraint)
SELECT email, COUNT(*) FROM users
GROUP BY email HAVING COUNT(*) > 1;

-- Check for future timestamps (data entry errors)
SELECT * FROM users WHERE created_at > NOW();
```

### Recovery Steps

1. **Identify corruption scope:**
   ```sql
   -- Get summary of data quality issues
   SELECT
     'orphaned_logs' as issue,
     COUNT(*) as count
   FROM message_logs ml
   LEFT JOIN users u ON ml.user_id = u.id
   WHERE u.id IS NULL
   UNION ALL
   SELECT
     'invalid_timezones' as issue,
     COUNT(*) as count
   FROM users
   WHERE timezone NOT IN (SELECT name FROM pg_timezone_names)
   UNION ALL
   SELECT
     'future_dates' as issue,
     COUNT(*) as count
   FROM users
   WHERE created_at > NOW();
   ```

2. **Stop application to prevent further corruption:**
   ```bash
   docker-compose stop api workers
   ```

3. **Create point-in-time backup before fixing:**
   ```bash
   ./scripts/backup-database.sh emergency-before-fix-$(date +%Y%m%d-%H%M%S)
   ```

4. **Fix data issues (example: orphaned logs):**
   ```sql
   BEGIN;

   -- Delete orphaned message logs
   DELETE FROM message_logs
   WHERE user_id NOT IN (SELECT id FROM users);

   -- Verify deletion
   SELECT COUNT(*) FROM message_logs;

   -- If count looks correct, commit
   COMMIT;
   -- If something wrong, ROLLBACK;
   ```

5. **Verify data integrity:**
   ```sql
   -- Run all integrity checks again
   -- Should return 0 for all corruption checks
   ```

6. **Restart services:**
   ```bash
   docker-compose up -d
   ```

**Expected Recovery Time:** 30-60 minutes (varies by corruption extent)

### Point-in-Time Recovery (PITR)

If corruption is extensive and data fix is risky:

1. **Determine recovery point:**
   ```bash
   # Review application logs to find last known good timestamp
   tail -1000 /var/log/birthday-app/app.log | grep "CORRUPT"
   ```

2. **Restore to point before corruption:**
   ```bash
   # PostgreSQL PITR (requires WAL archiving enabled)
   ./scripts/restore-pitr.sh "2026-01-04 10:00:00"
   ```

3. **Replay transactions after recovery point:**
   ```bash
   # Application may need to re-process any requests that occurred
   # after recovery point timestamp
   ```

---

## Recovery Time Objectives (RTO/RPO)

| Failure Type | RTO (Target) | RTO (Maximum) | RPO | Notes |
|--------------|--------------|---------------|-----|-------|
| PostgreSQL Container Crash | 5 min | 15 min | 0 (no data loss) | Automatic restart |
| RabbitMQ Container Crash | 5 min | 15 min | 0 (no data loss) | Durable queues |
| Database Corruption | 30 min | 2 hours | 5 min (backup frequency) | Restore from backup |
| Complete System Failure | 1 hour | 4 hours | 5 min (backup frequency) | Cloud instance recovery |
| Data Corruption | 1 hour | 4 hours | Variable (depends on detection) | PITR or data fix |
| Datacenter Failure | 4 hours | 24 hours | 1 hour (DR sync lag) | Requires DR site |

### RTO/RPO Definitions

- **RTO (Recovery Time Objective):** Maximum acceptable time to restore service
- **RPO (Recovery Point Objective):** Maximum acceptable data loss (time)

---

## Backup Strategy

### Automated Backups

| Backup Type | Frequency | Retention | Location |
|-------------|-----------|-----------|----------|
| Database Full | Daily at 00:00 UTC | 30 days | S3 / Local volume |
| Database WAL | Continuous | 7 days | S3 / Local volume |
| RabbitMQ Config | Daily | 7 days | S3 / Local volume |
| Application Config | On change | 30 days | Git repository |

### Backup Verification

Run weekly backup restoration tests:

```bash
# Test database restore
./scripts/test-backup-restore.sh

# Verify restored data matches production count
```

### Backup Commands

```bash
# Manual database backup
./scripts/backup-database.sh

# Restore from specific backup
./scripts/restore-database.sh /backups/birthday_app_2026-01-04.dump

# List available backups
./scripts/list-backups.sh
```

---

## Communication Plan

### During Incident

1. **Notify stakeholders:**
   - Post in #incidents Slack channel
   - Update status page (if public-facing)
   - Email management if > 1 hour outage expected

2. **Incident communication template:**
   ```
   INCIDENT: [Database/RabbitMQ/Complete System] Failure
   STATUS: [Investigating/Recovering/Resolved]
   IMPACT: [Users cannot X, Messages delayed, etc.]
   ETA: [Expected resolution time]
   LAST UPDATE: [Timestamp]
   ```

### Post-Incident

1. **Create incident report** (within 24 hours)
2. **Schedule postmortem** (within 1 week)
3. **Document lessons learned**
4. **Update playbook** with improvements

---

## Related Documentation

- [Incident Response Playbook](./incident-response.md)
- [Security Incident Playbook](./security-incident.md)
- [Runbook - Operational Procedures](../RUNBOOK.md)
- [Monitoring Dashboards](../monitoring/README.md)

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-04 | 1.0 | Initial disaster recovery playbook | Claude Code |

---

**Emergency Contact:** [On-call rotation in PagerDuty/OpsGenie]

**Last Tested:** [Date of last DR drill]
