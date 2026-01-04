# Incident Response Playbook

**Last Updated:** 2026-01-04
**Version:** 1.0
**Owner:** DevOps Team

---

## Purpose

This playbook defines procedures for responding to operational incidents in the Birthday Message Scheduler system. Use this guide to systematically investigate, communicate, and resolve production issues.

---

## Table of Contents

1. [Incident Classification](#incident-classification)
2. [Response Procedures](#response-procedures)
3. [Common Incidents](#common-incidents)
4. [Communication Protocols](#communication-protocols)
5. [Post-Incident Review](#post-incident-review)

---

## Incident Classification

### Severity Levels

| Priority | Impact | Response Time | Examples |
|----------|--------|---------------|----------|
| **P0 - Critical** | Complete system outage | Immediate (< 5 min) | API down, database unavailable, all messages failing |
| **P1 - High** | Major functionality degraded | < 15 minutes | High error rate (>5%), significant latency (>2s p95) |
| **P2 - Medium** | Minor functionality affected | < 1 hour | Isolated failures, non-critical feature broken |
| **P3 - Low** | Minimal impact | < 4 hours | Monitoring alerts, minor performance degradation |

### Escalation Criteria

**Upgrade to P0 if:**
- User-facing services completely unavailable for >5 minutes
- Data loss or corruption detected
- Security breach suspected

**Upgrade to P1 if:**
- P2 incident persists >30 minutes
- Error rate increases >10%
- Multiple P2 incidents occurring simultaneously

---

## Response Procedures

### Initial Assessment (First 5 Minutes)

1. **Acknowledge the incident:**
   ```bash
   # Post in #incidents channel
   INCIDENT: [Brief description]
   STATUS: Investigating
   SEVERITY: P[0-3]
   RESPONDER: @your-name
   STARTED: [timestamp]
   ```

2. **Verify incident scope:**
   ```bash
   # Check system health
   curl http://localhost:3000/health | jq
   curl http://localhost:3000/ready | jq

   # Check metrics
   open http://localhost:3001  # Grafana

   # Check recent logs
   docker logs --tail 100 birthday-app-api
   ```

3. **Determine impact:**
   - How many users affected?
   - Which features broken?
   - Any data at risk?

### Investigation (5-15 Minutes)

1. **Check monitoring dashboards:**
   - [System Overview](http://localhost:3001/d/overview)
   - [API Performance](http://localhost:3001/d/api-performance)
   - [Queue Health](http://localhost:3001/d/queue-health)

2. **Review recent changes:**
   ```bash
   # Check recent deployments
   git log --oneline -10

   # Check recent configuration changes
   git log --oneline -- docker-compose.yml .env prometheus/
   ```

3. **Analyze error patterns:**
   ```bash
   # Count error types
   docker logs birthday-app-api --since 15m | grep ERROR | awk '{print $NF}' | sort | uniq -c | sort -rn

   # Get stack traces
   docker logs birthday-app-api --since 15m | grep -A 10 "stack.*Error"
   ```

### Resolution

Follow appropriate incident-specific procedure (see [Common Incidents](#common-incidents))

### Communication Updates

Post updates every **15 minutes** for P0/P1, **30 minutes** for P2:

```
UPDATE: [What's been done, what's in progress]
STATUS: [Investigating/Mitigating/Resolved]
IMPACT: [Current user impact]
ETA: [Expected resolution time]
TIME: [timestamp]
```

---

## Common Incidents

### Incident 1: High API Latency

**Alert:** `APILatencyHigh` - API p95 latency > 500ms for 5 minutes

**Detection:**
```bash
# Check current latency
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/users

# Create curl-format.txt if needed:
cat > curl-format.txt <<'EOF'
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_starttransfer:  %{time_starttransfer}\n
time_total:  %{time_total}\n
EOF
```

**Investigation Steps:**

1. **Check system resources:**
   ```bash
   # Container resource usage
   docker stats --no-stream

   # Check CPU/memory limits
   docker inspect birthday-app-api | jq '.[0].HostConfig | {Memory, NanoCpus}'
   ```

2. **Check database performance:**
   ```sql
   -- Connect to database
   docker exec -it birthday-app-postgres psql -U postgres -d birthday_app

   -- Top 10 slowest queries
   SELECT
     query,
     calls,
     mean_exec_time,
     max_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;

   -- Active connections
   SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

   -- Long-running queries
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active'
   AND now() - pg_stat_activity.query_start > interval '5 seconds';
   ```

3. **Check queue depth:**
   ```bash
   # RabbitMQ queue depth
   curl -s -u rabbitmq:rabbitmq_dev_password http://localhost:15672/api/queues | jq '.[] | {name, messages, consumers}'
   ```

4. **Check for external API issues:**
   ```bash
   # Test external API (SendGrid)
   curl -w "@curl-format.txt" -o /dev/null -s https://api.sendgrid.com/v3/mail/send

   # Check circuit breaker status
   docker logs birthday-app-api | grep "circuit.*open"
   ```

**Resolution:**

**If database slow queries:**
```sql
-- Identify missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
AND correlation < 0.1;  -- Low correlation = needs index

-- Add index for slow query (example)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_message_logs_user_id ON message_logs(user_id);
```

**If high queue depth:**
```bash
# Scale workers horizontally
docker-compose up -d --scale workers=10

# Monitor processing rate
watch -n 1 'curl -s -u rabbitmq:rabbitmq_dev_password http://localhost:15672/api/queues | jq ".[] | {name, messages}"'
```

**If memory leak:**
```bash
# Identify high memory container
docker stats --no-stream | sort -k 4 -h

# Restart affected service
docker-compose restart api

# Enable heap snapshot for debugging (for next occurrence)
# Add to docker-compose.yml: NODE_OPTIONS="--max-old-space-size=512 --heapsnapshot-signal=SIGUSR2"
```

**If external API slow:**
```bash
# Check circuit breaker opened
docker logs birthday-app-api | tail -50 | grep circuit

# Verify circuit breaker will auto-recover after timeout
# Monitor for "circuit closed" message
```

**Expected Resolution Time:** 5-30 minutes

---

### Incident 2: Message Delivery Failures

**Alert:** `MessageDeliveryFailed` - >10 failed deliveries in 5 minutes

**Investigation:**

1. **Check SendGrid API status:**
   ```bash
   # SendGrid status page
   curl -s https://status.sendgrid.com/api/v2/status.json | jq

   # Or check: https://status.sendgrid.com/
   ```

2. **Review failed message logs:**
   ```sql
   -- Failed messages in last hour
   SELECT
     id,
     user_id,
     status,
     error_message,
     api_response_code,
     retry_count,
     created_at
   FROM message_logs
   WHERE status = 'FAILED'
   AND created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

3. **Check for rate limiting:**
   ```bash
   # Look for 429 responses
   docker logs birthday-app-workers | grep "429\|rate.*limit"
   ```

4. **Verify SendGrid API key:**
   ```bash
   # Test API key (from environment or secrets)
   curl -X POST https://api.sendgrid.com/v3/mail/send \
     -H "Authorization: Bearer ${SENDGRID_API_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"test@example.com"},"subject":"Test","content":[{"type":"text/plain","value":"Test"}]}'

   # Should return 202 Accepted or specific error
   ```

**Resolution:**

**If SendGrid is down:**
```bash
# Enable DLQ processing
# Messages automatically go to DLQ after max retries

# Wait for SendGrid recovery, then replay DLQ
curl -X POST http://localhost:3000/api/internal/replay-dlq
```

**If rate limited:**
```bash
# Reduce worker concurrency temporarily
# Edit docker-compose.yml: QUEUE_CONCURRENCY: 5 (from 10)
docker-compose up -d workers

# Monitor rate limit headers
docker logs -f birthday-app-workers | grep "x-ratelimit"
```

**If API key invalid:**
```bash
# Rotate API key in SendGrid dashboard
# Update secret/environment variable
# Restart workers
docker-compose restart workers
```

**If network issues:**
```bash
# Check DNS resolution
docker exec birthday-app-workers nslookup api.sendgrid.com

# Check connectivity
docker exec birthday-app-workers curl -v https://api.sendgrid.com

# Check firewall/security groups if in cloud
```

**Expected Resolution Time:** 10-45 minutes (depends on external service)

---

### Incident 3: Database Connection Pool Exhaustion

**Alert:** `DatabasePoolExhausted` - All connections in use

**Investigation:**

1. **Check pool status:**
   ```sql
   -- Current connections by state
   SELECT
     state,
     count(*),
     max(now() - state_change) as max_duration
   FROM pg_stat_activity
   GROUP BY state;

   -- Connections by application
   SELECT
     application_name,
     count(*),
     state
   FROM pg_stat_activity
   GROUP BY application_name, state;
   ```

2. **Identify connection leaks:**
   ```sql
   -- Long-running idle transactions (connection leaks)
   SELECT
     pid,
     now() - state_change AS duration,
     state,
     query
   FROM pg_stat_activity
   WHERE state = 'idle in transaction'
   AND now() - state_change > interval '1 minute';
   ```

3. **Check configured pool size:**
   ```bash
   # Application pool size
   docker exec birthday-app-api node -e "console.log(process.env.DATABASE_POOL_MAX)"

   # PostgreSQL max connections
   docker exec birthday-app-postgres psql -U postgres -c "SHOW max_connections;"
   ```

**Resolution:**

**Immediate mitigation:**
```sql
-- Kill idle transactions (use with caution)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
AND now() - state_change > interval '5 minutes';
```

**Long-term fix:**
```bash
# Increase pool size (if PostgreSQL can handle it)
# Edit docker-compose.yml or .env:
# DATABASE_POOL_MAX=20 (from 10)

# Increase PostgreSQL max_connections
# Add to docker-compose.yml postgres command:
# -c max_connections=200

# Restart services
docker-compose up -d postgres api workers
```

**If connection leak in code:**
```bash
# Enable connection leak detection
# Add to application: pool.on('error', ...), pool.on('connect', ...)
# Review code for missing .release() or .end() calls
# Add automated tests for connection lifecycle
```

**Expected Resolution Time:** 5-15 minutes

---

### Incident 4: Queue Overflow

**Alert:** `RabbitMQQueueDepthHigh` - Queue depth > 10,000 messages

**Investigation:**

1. **Check queue metrics:**
   ```bash
   # Current queue depth and consumer count
   curl -s -u rabbitmq:rabbitmq_dev_password http://localhost:15672/api/queues | \
     jq '.[] | {name, messages, consumers, message_rate_in: .message_stats.publish_details.rate, message_rate_out: .message_stats.deliver_get_details.rate}'
   ```

2. **Check worker health:**
   ```bash
   # How many workers running?
   docker ps | grep worker | wc -l

   # Worker logs for errors
   docker logs birthday-app-workers --tail 100 | grep -i error
   ```

3. **Check message processing time:**
   ```bash
   # Average processing time from application logs
   docker logs birthday-app-workers | grep "processed.*message" | tail -100
   ```

**Resolution:**

**Scale workers immediately:**
```bash
# Increase worker replicas
docker-compose up -d --scale workers=20

# Verify workers connected
curl -s -u rabbitmq:rabbitmq_dev_password http://localhost:15672/api/queues/birthday-messages | jq '.consumers'
```

**If workers are failing to process:**
```bash
# Check for systematic failures
docker logs birthday-app-workers | grep -A 5 "Failed to process"

# Inspect DLQ for failed messages
curl -s -u rabbitmq:rabbitmq_dev_password http://localhost:15672/api/queues/birthday-messages-dlq | jq '.messages'

# Temporarily pause queue to investigate
curl -X PUT -u rabbitmq:rabbitmq_dev_password http://localhost:15672/api/queues/birthday-messages \
  -H "Content-Type: application/json" \
  -d '{"auto_delete":false,"durable":true,"arguments":{}}'

# Resume after fix
```

**If external API is rate limiting:**
```bash
# Reduce worker concurrency
# Edit docker-compose.yml: QUEUE_CONCURRENCY: 2
docker-compose up -d workers

# Messages will process slower but within rate limits
```

**Expected Resolution Time:** 10-30 minutes

---

### Incident 5: Memory Leak

**Alert:** `ContainerMemoryHigh` - Container memory > 80% for 10 minutes

**Investigation:**

1. **Identify high-memory container:**
   ```bash
   docker stats --no-stream | sort -k 4 -h
   ```

2. **Check memory trend:**
   ```bash
   # View Grafana memory dashboard
   open http://localhost:3001/d/system-resources

   # Or check Prometheus directly
   curl -s 'http://localhost:9090/api/v1/query?query=container_memory_usage_bytes' | jq
   ```

3. **Capture heap snapshot (Node.js):**
   ```bash
   # If NODE_OPTIONS includes --heapsnapshot-signal=SIGUSR2
   docker exec birthday-app-api kill -USR2 1

   # Copy heap snapshot for analysis
   docker cp birthday-app-api:/app/Heap.*.heapsnapshot ./
   ```

**Resolution:**

**Immediate mitigation:**
```bash
# Restart leaking container
docker-compose restart api  # or workers

# Monitor memory after restart
docker stats birthday-app-api
```

**Investigation (post-restart):**
```bash
# Analyze heap snapshot with Chrome DevTools
# 1. Open Chrome DevTools
# 2. Memory tab → Load heap snapshot
# 3. Look for retained objects, detached DOM nodes, etc.

# Common Node.js memory leak patterns:
# - Event listeners not removed
# - Global variables accumulating data
# - Closures retaining large objects
# - Caches without size limits
```

**Long-term fix:**
```javascript
// Add to application code:

// 1. Limit cache size
const cache = new Map();
const MAX_CACHE_SIZE = 1000;
if (cache.size > MAX_CACHE_SIZE) {
  const firstKey = cache.keys().next().value;
  cache.delete(firstKey);
}

// 2. Remove event listeners
process.on('SIGTERM', () => {
  eventEmitter.removeAllListeners();
});

// 3. Enable --max-old-space-size
// docker-compose.yml: NODE_OPTIONS="--max-old-space-size=512"
```

**Expected Resolution Time:** 5 minutes (restart), hours (root cause analysis)

---

## Communication Protocols

### Internal Communication

**Slack Channels:**
- `#incidents` - Active incident coordination
- `#alerts` - Automated monitoring alerts
- `#postmortems` - Post-incident analysis

**Incident Update Template:**
```
🚨 INCIDENT UPDATE - P[0-3]

TITLE: [Brief description]
STATUS: [Investigating/Mitigating/Resolved/Monitoring]
IMPACT: [What users can't do]
CURRENT ACTIONS: [What we're doing right now]
ETA: [When we expect resolution]
UPDATED: [HH:MM UTC]
```

### External Communication

**Status Page Updates (if customer-facing):**

```markdown
[TIMESTAMP] - Investigating
We are currently investigating reports of [issue description].
We will provide updates as we learn more.

[TIMESTAMP] - Identified
We have identified the issue as [root cause].
Our team is working on a fix. Estimated resolution: [TIME].

[TIMESTAMP] - Monitoring
The issue has been resolved.
We are monitoring the situation to ensure stability.

[TIMESTAMP] - Resolved
This incident has been fully resolved.
A full postmortem will be published within 48 hours.
```

### Escalation Contacts

| Role | Contact | Escalate When |
|------|---------|---------------|
| On-call Engineer | PagerDuty | All P0/P1 incidents |
| Engineering Lead | Phone/Slack | P0 >30min or P1 >1hr |
| CTO | Phone | P0 >1hr or data breach |
| Customer Support | Email | Any customer-facing issue |

---

## Post-Incident Review

### Incident Report (Within 24 Hours)

Create incident report with:

1. **Timeline:**
   - Detection time
   - Response time
   - Resolution time
   - Communication timeline

2. **Root Cause Analysis:**
   - What happened?
   - Why did it happen?
   - How was it detected?

3. **Impact Assessment:**
   - Users affected
   - Duration of impact
   - Data loss (if any)
   - Revenue impact (if applicable)

4. **Response Evaluation:**
   - What went well?
   - What went poorly?
   - Response time vs. SLA

### Postmortem Meeting (Within 1 Week)

**Agenda:**
1. Present incident timeline
2. Discuss root cause
3. Review response effectiveness
4. Identify action items
5. Assign owners and due dates

**Action Items Template:**
```markdown
## Action Items

| # | Action | Owner | Due Date | Priority |
|---|--------|-------|----------|----------|
| 1 | Add index on users.email | @dev | 2026-01-10 | P0 |
| 2. Add alert for queue depth > 5000 | @devops | 2026-01-08 | P1 |
| 3 | Update runbook with new procedure | @oncall | 2026-01-07 | P2 |
```

### Preventive Measures

- Update monitoring alerts
- Add automated tests
- Improve documentation
- Enhance observability
- Conduct chaos engineering tests

---

## Related Documentation

- [Disaster Recovery Playbook](./disaster-recovery.md)
- [Security Incident Playbook](./security-incident.md)
- [Runbook - Operational Procedures](../RUNBOOK.md)
- [Monitoring & Alerting](../monitoring/README.md)

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-04 | 1.0 | Initial incident response playbook | Claude Code |

---

**Emergency Hotline:** [On-call rotation phone number]

**Incident Commander Rotation:** [Link to PagerDuty schedule]
