# Queue System Usage Guide

## Quick Start

### 1. Initialize Queue (One-Time)

```bash
./.claude/hooks/queue-init.sh
```

### 2. Use in Your Scripts

Source the queue library and start enqueueing:

```bash
#!/bin/bash

# Source the queue library
source ./.claude/hooks/lib/queue-lib.sh

# Queue a database write
queue_db_write "UPDATE sessions SET last_activity = datetime('now') WHERE id = 'abc123';" \
    "update_session" \
    3 \
    '{"session_id": "abc123"}'

echo "Write queued for processing"
```

### 3. Monitor Queue

```bash
# Check status once
./.claude/hooks/queue-status.sh

# Watch continuously (updates every 2 seconds)
./.claude/hooks/queue-status.sh --watch

# Get JSON output (for scripting/monitoring)
./.claude/hooks/queue-status.sh --json
```

## Core Functions

### queue_db_write() - Main Enqueue Function

Queue a database write operation:

```bash
queue_db_write "SQL" "operation_type" "priority" "metadata"
```

**Parameters:**
- `SQL` (required): SQL statement to execute
- `operation_type` (optional, default: "generic"): Type of operation
- `priority` (optional, default: 5): Priority level 1-10 (lower = higher priority)
- `metadata` (optional, default: "{}"): JSON metadata

**Returns:**
- 0 on success (queued or executed)
- 1 on failure

**Example:**
```bash
queue_db_write \
    "INSERT INTO session_logs (session_id, level, message) VALUES ('abc', 'info', 'Login successful');" \
    "insert_log" \
    7 \
    '{"session_id": "abc"}'
```

### Convenience Functions

#### Update Session (High Priority)
```bash
queue_update_session "session_id" "column1 = value1, column2 = value2"

# Example:
queue_update_session "abc123" "last_activity = datetime('now')"
```

#### Update Instance Session
```bash
queue_update_instance "instance_id" "column = value"

# Example:
queue_update_instance "inst_456" "status = 'active'"
```

#### Insert Log Entry (Low Priority)
```bash
queue_insert_log "session_id" "log_level" "message" "data_json"

# Example:
queue_insert_log "abc123" "info" "User logged in" '{"ip": "192.168.1.1"}'
```

## Priority Levels

Choose priority based on operation criticality:

| Priority | Use Case | Example | Max Wait |
|----------|----------|---------|----------|
| 1 | Critical auth/payment | UPDATE sessions SET verified = 1 | 5s |
| 3 | Session state | UPDATE sessions SET last_activity = now() | 10s |
| 5 | General operations | UPDATE instance_sessions SET value = X | 20s |
| 7 | Logging | INSERT INTO session_logs | 30s |
| 10 | Analytics/archival | INSERT INTO analytics | 60s |

## Monitoring the Queue

### Check Status Once

```bash
./.claude/hooks/queue-status.sh

# Output:
Queue System Status
Status: Available

Queue Depths:
  Pending:    5
  Processing: 1
  Completed:  1243
  Failed:     0

Worker:
  Status: Running (PID: 12345)
```

### Watch Continuously

```bash
./.claude/hooks/queue-status.sh --watch

# Refreshes every 2 seconds, Ctrl+C to stop
```

### Get Detailed Statistics

```bash
./.claude/hooks/queue-status.sh --stats

# Shows:
# - Directory sizes
# - Oldest pending entry age
# - Currently processing entries
# - Log file size
```

### Get JSON Output

```bash
./.claude/hooks/queue-status.sh --json

# Returns:
{
  "timestamp": "2024-01-01T12:00:00Z",
  "queue": {
    "pending": 5,
    "processing": 1,
    "completed": 1243,
    "failed": 0
  },
  "worker": {
    "running": true,
    "pid": "12345"
  },
  "stats": {
    "enqueued": 1248,
    "processed": 1243,
    "failed": 5,
    "retried": 10,
    "direct": 0
  }
}
```

## Managing the Worker

### Start Worker

```bash
./.claude/hooks/queue-worker-start.sh start

# Or run in foreground for debugging:
./.claude/hooks/queue-worker-start.sh start --foreground
```

### Stop Worker

```bash
./.claude/hooks/queue-worker-start.sh stop

# Gracefully shuts down and processes remaining entries
```

### Restart Worker

```bash
./.claude/hooks/queue-worker-start.sh restart
```

### Check Worker Status

```bash
./.claude/hooks/queue-worker-start.sh status

# Shows PID, uptime, resource usage
```

### View Worker Logs

```bash
# Show last 50 lines
./.claude/hooks/queue-worker-start.sh logs

# Show last 100 lines
./.claude/hooks/queue-worker-start.sh logs 100

# Follow logs in real-time (like 'tail -f')
./.claude/hooks/queue-worker-start.sh follow
```

### Process Queue Once (No Daemon)

```bash
./.claude/hooks/queue-worker-start.sh once

# Useful for testing or one-off processing
```

## Error Handling

### Automatic Retries

Failed entries are automatically retried up to 3 times with exponential backoff:
- 1st retry: 100ms wait
- 2nd retry: 200ms wait
- 3rd retry: 400ms wait

Each retry decreases priority (increases priority number) to avoid blocking high-priority operations.

### Manual Inspection

View failed entries:

```bash
# List failed entries
ls -la .hive-mind/queue/failed/

# View a failed entry
cat .hive-mind/queue/failed/1704067200000000000_1.json | jq .

# Shows:
{
  "seq": "1704067200000000000_1",
  "priority": 8,
  "operation": "update_session",
  "sql": "UPDATE sessions SET col = 'val' WHERE id = 'abc';",
  "created_at": "2024-01-01T12:00:00Z",
  "retries": 3,
  "error": "database is locked",
  "failed_at": "2024-01-01T12:00:15Z"
}
```

### Manual Retry

To manually retry a failed entry:

```bash
# Move failed entry back to pending with fresh retry count
mv .hive-mind/queue/failed/FILENAME .hive-mind/queue/pending/FILENAME
```

### Clear Failed Entries

```bash
# WARNING: This deletes failed entries!
rm -f .hive-mind/queue/failed/*.json
```

## Disabling the Queue

To temporarily disable the queue and use direct SQLite:

```bash
# Disable queue
export USE_QUEUE=false

# queue_db_write will now execute SQL directly
source ./.claude/hooks/lib/queue-lib.sh
queue_db_write "UPDATE sessions SET ..."  # Executes immediately
```

## Performance Tips

### 1. Batch Operations When Possible

Instead of:
```bash
queue_db_write "INSERT INTO logs VALUES ('a');"
queue_db_write "INSERT INTO logs VALUES ('b');"
queue_db_write "INSERT INTO logs VALUES ('c');"
```

Do:
```bash
queue_db_write "INSERT INTO logs VALUES ('a'), ('b'), ('c');"
```

### 2. Use Appropriate Priorities

```bash
# High priority for critical updates
queue_db_write "$sql" "auth_update" 2

# Low priority for analytics
queue_db_write "$sql" "analytics" 9
```

### 3. Monitor Peak Times

```bash
# Watch queue during peak activity
watch -n 1 "./.claude/hooks/queue-status.sh --json" | jq .queue
```

### 4. Increase Batch Size for High Load

```bash
export QUEUE_BATCH_SIZE="50"  # Process 50 entries per batch
```

## Troubleshooting

### Worker Not Running

```bash
# Check if worker is alive
./.claude/hooks/queue-worker-start.sh status

# If not running, start it
./.claude/hooks/queue-worker-start.sh start

# Check logs for errors
./.claude/hooks/queue-worker-start.sh logs 50
```

### Entries Stuck in Processing

```bash
# This shouldn't happen (orphan recovery), but if it does:

# 1. Check age
ls -la .hive-mind/queue/processing/

# 2. Force recovery (move to pending)
mv .hive-mind/queue/processing/* .hive-mind/queue/pending/

# 3. Restart worker
./.claude/hooks/queue-worker-start.sh restart
```

### High Failed Count

```bash
# Check what's failing
ls -la .hive-mind/queue/failed/ | head -10

# View first failure
cat .hive-mind/queue/failed/$(ls -1 .hive-mind/queue/failed/ | head -1) | jq .

# Check logs
./.claude/hooks/queue-worker-start.sh logs 100
```

## Common Issues

### Problem: "database is locked"
- Normal during high concention. Queue handles retries automatically.
- Monitor with: `watch "./.claude/hooks/queue-status.sh"`

### Problem: Queue keeps growing
- Worker may not be running: `queue-worker-start.sh start`
- Check logs: `queue-worker-start.sh logs 50`
- Try restart: `queue-worker-start.sh restart`

### Problem: Entries disappear
- They likely moved to completed/: `ls .hive-mind/queue/completed/`
- Very old entries auto-deleted after 24 hours (configurable)

## Examples

### Example: Session Update on Login

```bash
#!/bin/bash
source ./.claude/hooks/lib/queue-lib.sh

session_id="sess_${RANDOM}"
queue_db_write \
    "INSERT INTO sessions (id, user_id, created_at) VALUES ('$session_id', 'user123', datetime('now'));" \
    "create_session" \
    2 \
    "{\"user_id\": \"user123\", \"ip\": \"$REMOTE_ADDR\"}"

echo "Session created (will be saved asynchronously)"
```

### Example: Batch Greeting Notifications

```bash
#!/bin/bash
source ./.claude/hooks/lib/queue-lib.sh

# Queue multiple updates
for user_id in 1 2 3 4 5; do
    queue_db_write \
        "INSERT INTO notifications (user_id, type, created_at) VALUES ($user_id, 'birthday', datetime('now'));" \
        "notification" \
        1 \
        "{\"user_id\": $user_id, \"type\": \"birthday\"}"
done

echo "5 notifications queued"
```

### Example: Monitor Queue with Alerts

```bash
#!/bin/bash

# Check every 10 seconds
while true; do
    pending=$(./.claude/hooks/queue-status.sh --json | jq .queue.pending)
    
    if [ "$pending" -gt 100 ]; then
        echo "WARNING: Queue backlog ($pending entries)"
        ./.claude/hooks/queue-worker-start.sh status
    fi
    
    sleep 10
done
```

---

**Last Updated**: 2024-01-01
**Difficulty**: Beginner to Intermediate
