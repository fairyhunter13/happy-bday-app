# Troubleshooting Guide

## Quick Reference

| Symptom | Likely Cause | Quick Fix | Page |
|---------|--------------|-----------|------|
| Service won't start | Missing env vars | Check .env file | [Startup Issues](#startup-issues) |
| High error rate | External API down | Check circuit breaker | [API Errors](#api-errors) |
| Queue backing up | Workers overwhelmed | Scale workers | [Queue Issues](#queue-issues) |
| Slow responses | Database bottleneck | Check slow queries | [Performance](#performance-issues) |
| Memory leak | Worker not cleaning up | Restart workers | [Memory Issues](#memory-issues) |

---

## Startup Issues

### Problem: Application Won't Start

**Error:** `Cannot connect to database`

**Diagnosis:**

```bash
# Check if database is accessible
psql $DATABASE_URL -c "SELECT 1"

# Check database credentials
echo $DATABASE_URL | sed 's/:.*@/:****@/'

# Check network connectivity
nc -zv <db-host> 5432
```

**Solutions:**

1. **Database not running:**
   ```bash
   # Start database
   docker-compose up -d postgres
   # Or
   systemctl start postgresql
   ```

2. **Wrong credentials:**
   ```bash
   # Update DATABASE_URL in .env
   DATABASE_URL=postgresql://correct_user:correct_pass@host:5432/db
   ```

3. **Network/firewall issue:**
   ```bash
   # Check firewall rules
   sudo ufw status
   # Allow PostgreSQL port
   sudo ufw allow 5432/tcp
   ```

---

**Error:** `AMQP connection refused`

**Diagnosis:**

```bash
# Check RabbitMQ status
sudo systemctl status rabbitmq-server

# Test connection
telnet localhost 5672

# Check RabbitMQ management UI
curl http://localhost:15672
```

**Solutions:**

1. **RabbitMQ not running:**
   ```bash
   # Start RabbitMQ
   docker-compose up -d rabbitmq
   # Or
   sudo systemctl start rabbitmq-server
   ```

2. **Wrong credentials:**
   ```bash
   # Check credentials
   rabbitmqctl list_users

   # Update RABBITMQ_URL
   RABBITMQ_URL=amqp://user:password@localhost:5672
   ```

3. **Port conflict:**
   ```bash
   # Check what's using port 5672
   sudo lsof -i :5672

   # Stop conflicting service or change port
   ```

---

**Error:** `Missing required environment variable`

**Diagnosis:**

```bash
# Check if .env file exists
ls -la .env

# Verify all required variables
cat .env | grep -E "DATABASE_URL|RABBITMQ_URL|PORT"

# Check environment variables are loaded
node -e "console.log(process.env.DATABASE_URL)"
```

**Solutions:**

```bash
# Copy example env file
cp .env.example .env

# Fill in required values
vim .env

# Verify
npm run dev
```

---

## API Errors

### Problem: High Error Rate (5xx errors)

**Symptoms:**
- Alert: HighErrorRate
- Users getting 500 errors
- Error logs increasing

**Diagnosis:**

```bash
# Check error logs
kubectl logs deployment/birthday-scheduler-api | grep -i error | tail -50

# Check error rate
curl http://localhost:3000/metrics | grep http_requests_total

# Identify error patterns
kubectl logs deployment/birthday-scheduler-api \
  | jq 'select(.level == "error")' \
  | jq -r '.msg' \
  | sort | uniq -c | sort -rn
```

**Common Causes & Solutions:**

1. **External API timeout:**
   ```bash
   # Check circuit breaker state
   curl http://localhost:3000/metrics | grep circuit_breaker_state

   # If open, wait for reset (30s) or fix external service
   # Check external service status
   curl -v https://external-api.example.com/health
   ```

2. **Database connection pool exhausted:**
   ```bash
   # Check active connections
   psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

   # Increase pool size
   export DATABASE_POOL_MAX=50
   kubectl set env deployment/birthday-scheduler-api DATABASE_POOL_MAX=50

   # Restart
   kubectl rollout restart deployment/birthday-scheduler-api
   ```

3. **Unhandled exception:**
   ```bash
   # Find stack traces
   kubectl logs deployment/birthday-scheduler-api | grep -A 10 "Error:"

   # Deploy hotfix if code issue
   git checkout -b hotfix/error-handling
   # Fix code...
   npm test
   # Deploy
   ```

---

### Problem: Rate Limit Exceeded

**Symptoms:**
- 429 Too Many Requests errors
- Alert: RateLimitExceeded

**Diagnosis:**

```bash
# Check rate limit metrics
curl http://localhost:3000/metrics | grep rate_limit

# Identify offending IPs/users
kubectl logs deployment/birthday-scheduler-api \
  | jq 'select(.msg | contains("rate limit"))' \
  | jq -r '.req.remoteAddress' \
  | sort | uniq -c | sort -rn
```

**Solutions:**

1. **Legitimate traffic spike:**
   ```bash
   # Increase rate limit temporarily
   kubectl set env deployment/birthday-scheduler-api \
     RATE_LIMIT_MAX=200 \
     RATE_LIMIT_TIME_WINDOW=60000
   ```

2. **Abusive client:**
   ```bash
   # Block at load balancer/firewall
   sudo ufw deny from <IP_ADDRESS>

   # Or add to nginx block list
   # /etc/nginx/conf.d/blockips.conf
   deny <IP_ADDRESS>;
   ```

3. **Bot traffic:**
   ```bash
   # Add CAPTCHA or authentication
   # Implement bot detection
   # Use Cloudflare Bot Management
   ```

---

## Queue Issues

### Problem: Queue Depth Increasing

**Symptoms:**
- Alert: QueueDepthHigh
- Messages not being processed
- Queue depth >1000

**Diagnosis:**

```bash
# Check queue stats
rabbitmqadmin list queues

# Check worker count
kubectl get pods | grep worker | wc -l

# Check worker logs for errors
kubectl logs deployment/birthday-scheduler-worker --tail=100

# Check message processing rate
curl http://localhost:3000/metrics | grep messages_processed
```

**Solutions:**

1. **Workers not running:**
   ```bash
   # Check worker status
   kubectl get pods | grep worker

   # Start workers
   kubectl scale deployment birthday-scheduler-worker --replicas=5
   ```

2. **Workers overwhelmed:**
   ```bash
   # Scale up workers
   kubectl scale deployment birthday-scheduler-worker --replicas=10

   # Monitor queue drainage
   watch -n 5 'rabbitmqadmin list queues'
   ```

3. **Message processing errors:**
   ```bash
   # Check dead letter queue
   rabbitmqadmin get queue=birthday_messages_dlq count=10

   # Review failed messages
   # Fix underlying issue
   # Requeue messages
   rabbitmqadmin publish exchange=amq.default \
     routing_key=birthday_messages \
     payload="$(rabbitmqadmin get queue=birthday_messages_dlq)"
   ```

---

### Problem: Messages Not Being Processed

**Symptoms:**
- Queue depth stable but messages not sending
- No worker activity in logs

**Diagnosis:**

```bash
# Check worker pods
kubectl get pods -l app=worker

# Check worker logs
kubectl logs deployment/birthday-scheduler-worker

# Check RabbitMQ consumers
rabbitmqadmin list consumers

# Check circuit breaker
curl http://localhost:3000/metrics | grep circuit_breaker_state
```

**Solutions:**

1. **No workers connected:**
   ```bash
   # Restart workers
   kubectl rollout restart deployment/birthday-scheduler-worker

   # Verify connection
   rabbitmqadmin list consumers
   ```

2. **Circuit breaker open:**
   ```bash
   # Check external service
   curl https://message-service.example.com/health

   # Wait for circuit reset (30s) or fix service
   # Monitor metrics
   watch -n 5 'curl -s http://localhost:3000/metrics | grep circuit_breaker'
   ```

3. **Worker crashed:**
   ```bash
   # Check for OOM kills
   kubectl describe pods | grep -A 5 OOMKilled

   # Increase worker memory
   kubectl set resources deployment/birthday-scheduler-worker \
     --limits=memory=2Gi \
     --requests=memory=1Gi
   ```

---

## Performance Issues

### Problem: Slow API Response Times

**Symptoms:**
- Alert: HighResponseTime
- P99 latency >1s
- Users reporting slow app

**Diagnosis:**

```bash
# Check response time metrics
curl http://localhost:3000/metrics | grep http_request_duration

# Identify slow endpoints
kubectl logs deployment/birthday-scheduler-api \
  | jq 'select(.responseTime > 1000)' \
  | jq -r '.req.url' \
  | sort | uniq -c | sort -rn

# Check database performance
psql $DATABASE_URL -c "SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;"

# Check CPU/memory
kubectl top pods
```

**Solutions:**

1. **Slow database queries:**
   ```bash
   # Find slow queries
   psql $DATABASE_URL -c "SELECT query, mean_exec_time
     FROM pg_stat_statements
     WHERE mean_exec_time > 100
     ORDER BY mean_exec_time DESC;"

   # Add missing indexes
   psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY
     idx_users_date_of_birth ON users(date_of_birth);"

   # Analyze tables
   psql $DATABASE_URL -c "ANALYZE VERBOSE users;"
   ```

2. **High CPU usage:**
   ```bash
   # Scale horizontally
   kubectl scale deployment birthday-scheduler-api --replicas=5

   # Or scale vertically
   kubectl set resources deployment/birthday-scheduler-api \
     --limits=cpu=2000m \
     --requests=cpu=1000m
   ```

3. **External API latency:**
   ```bash
   # Reduce timeout
   kubectl set env deployment/birthday-scheduler-api \
     CIRCUIT_BREAKER_TIMEOUT=2000

   # Implement caching
   # Add Redis for response caching
   ```

---

### Problem: Database Connection Issues

**Symptoms:**
- "Connection pool exhausted" errors
- Alert: DatabaseConnectionPoolHigh
- Intermittent database errors

**Diagnosis:**

```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*), state
  FROM pg_stat_activity
  GROUP BY state;"

# Check connection pool metrics
curl http://localhost:3000/metrics | grep db_pool

# Check long-running queries
psql $DATABASE_URL -c "SELECT pid, query_start, state, query
  FROM pg_stat_activity
  WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '1 minute';"
```

**Solutions:**

1. **Pool exhausted:**
   ```bash
   # Increase pool size
   kubectl set env deployment/birthday-scheduler-api DATABASE_POOL_MAX=50

   # Restart
   kubectl rollout restart deployment/birthday-scheduler-api
   ```

2. **Long-running queries:**
   ```bash
   # Kill long queries
   psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE state != 'idle'
     AND query_start < NOW() - INTERVAL '5 minutes';"
   ```

3. **Connection leaks:**
   ```bash
   # Check application code for missing connection.release()
   # Deploy fix
   # Restart application
   kubectl rollout restart deployment/birthday-scheduler-api
   ```

---

## Memory Issues

### Problem: High Memory Usage / Memory Leaks

**Symptoms:**
- Alert: HighMemoryUsage
- Pods being OOMKilled
- Memory steadily increasing

**Diagnosis:**

```bash
# Check memory usage
kubectl top pods

# Check for OOM kills
kubectl get pods -o json | jq '.items[] | select(.status.containerStatuses[].lastState.terminated.reason == "OOMKilled")'

# Enable heap snapshot
kubectl exec -it deployment/birthday-scheduler-api -- node --expose-gc --inspect

# Take heap snapshot
# Connect Chrome DevTools to inspect://localhost:9229
# Take heap snapshot and analyze
```

**Solutions:**

1. **Increase memory limit:**
   ```bash
   kubectl set resources deployment/birthday-scheduler-api \
     --limits=memory=2Gi \
     --requests=memory=1Gi
   ```

2. **Memory leak in code:**
   ```bash
   # Profile application
   # Identify leak source
   # Deploy fix

   # Common causes:
   # - Unclosed database connections
   # - Event listener leaks
   # - Large in-memory caches
   # - Circular references
   ```

3. **Temporary workaround:**
   ```bash
   # Periodic pod restarts (not ideal)
   kubectl rollout restart deployment/birthday-scheduler-api

   # Or set up CronJob to restart daily
   ```

---

## Debugging Tools

### Enable Debug Mode

```bash
# Set debug log level
kubectl set env deployment/birthday-scheduler-api LOG_LEVEL=debug

# Watch debug logs
kubectl logs -f deployment/birthday-scheduler-api
```

### Log Analysis

```bash
# Parse JSON logs
kubectl logs deployment/birthday-scheduler-api | jq '.'

# Filter by level
kubectl logs deployment/birthday-scheduler-api | jq 'select(.level == "error")'

# Group by error message
kubectl logs deployment/birthday-scheduler-api \
  | jq -r 'select(.level == "error") | .msg' \
  | sort | uniq -c | sort -rn

# Time-based filtering
kubectl logs --since=1h deployment/birthday-scheduler-api
```

### Performance Profiling

```bash
# CPU profiling
node --prof dist/index.js

# Generate report
node --prof-process isolate-0x*.log > profile.txt

# Heap profiling
node --expose-gc --heap-prof dist/index.js

# Memory profiling with clinic
npx clinic doctor -- node dist/index.js
```

### Database Debugging

```bash
# Enable query logging
psql $DATABASE_URL -c "ALTER DATABASE birthday_scheduler SET log_statement = 'all';"

# View slow queries
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Explain query plan
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM users WHERE date_of_birth = '1990-01-01';"

# Check table bloat
psql $DATABASE_URL -c "SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Queue Debugging

```bash
# RabbitMQ management CLI
rabbitmqctl list_queues name messages consumers
rabbitmqctl list_exchanges
rabbitmqctl list_bindings

# Check consumer performance
rabbitmqadmin list channels name prefetch_count messages_unacknowledged

# Purge queue (careful!)
rabbitmqadmin purge queue name=birthday_messages
```

### Network Debugging

```bash
# Test external API connectivity
curl -v https://message-service.example.com/health

# DNS resolution
nslookup message-service.example.com

# Trace route
traceroute message-service.example.com

# Check latency
ping -c 5 message-service.example.com

# Network diagnostics from pod
kubectl exec -it deployment/birthday-scheduler-api -- curl -v https://external-api.com
```

---

## Common Error Messages

### Error: `ECONNREFUSED`

**Meaning:** Cannot connect to service

**Check:**
1. Service is running
2. Correct host/port
3. Network connectivity
4. Firewall rules

---

### Error: `ETIMEDOUT`

**Meaning:** Connection timed out

**Check:**
1. Service is responsive
2. Network latency
3. Timeout configuration
4. Circuit breaker state

---

### Error: `ENOTFOUND`

**Meaning:** DNS resolution failed

**Check:**
1. Hostname is correct
2. DNS server is working
3. Network connectivity

---

### Error: `Pool is draining`

**Meaning:** Database connection pool shutting down

**Solution:**
- Application is shutting down
- Wait for graceful shutdown
- Or increase shutdown timeout

---

### Error: `Channel closed by server`

**Meaning:** RabbitMQ closed connection

**Check:**
1. RabbitMQ logs for reason
2. Heartbeat settings
3. Message size limits
4. Queue resource limits

---

## Emergency Procedures

### Complete Service Outage

```bash
# 1. Check all components
kubectl get pods --all-namespaces
docker ps

# 2. Check recent changes
git log --since="1 hour ago"
kubectl rollout history deployment/birthday-scheduler-api

# 3. Rollback if recent deployment
kubectl rollout undo deployment/birthday-scheduler-api

# 4. Check infrastructure
# - Database: psql $DATABASE_URL -c "SELECT 1"
# - RabbitMQ: rabbitmqctl status
# - Network: ping <services>

# 5. Restore from backup if needed
# See RUNBOOK.md - Backup & Recovery section
```

### Data Corruption

```bash
# 1. Stop all writes
kubectl scale deployment birthday-scheduler-api --replicas=0
kubectl scale deployment birthday-scheduler-worker --replicas=0

# 2. Assess damage
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE <corruption_check>;"

# 3. Restore from backup
# See RUNBOOK.md - Backup & Recovery section

# 4. Verify data integrity
# Run data validation queries

# 5. Restart services
kubectl scale deployment birthday-scheduler-api --replicas=3
kubectl scale deployment birthday-scheduler-worker --replicas=5
```

---

**Last Updated:** 2025-12-30
**Version:** 1.0.0
**Owner:** DevOps Team
