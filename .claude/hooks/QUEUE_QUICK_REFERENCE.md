# Queue System - Quick Reference Card

## For Hook Developers

### Using the Queue in Hooks

```bash
#!/bin/bash
# Your hook script

# 1. Source the queue library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/queue-lib.sh"

# 2. Use queue_db_write instead of sqlite3
# Old way:
# sqlite3 "$HIVE_DB" "UPDATE sessions SET ..."

# New way (non-blocking):
queue_db_write "UPDATE sessions SET status = 'active' WHERE id = '$SESSION_ID';" "update_session" 5

# That's it! The queue handles everything else.
```

### Priority Guidelines

| Priority | Type | Example Use Cases |
|----------|------|-------------------|
| 1-2 | Critical | Session initialization, critical errors |
| 3-4 | High | Checkpoints, important state changes |
| 5-6 | Medium | Agent spawns, task tracking (DEFAULT) |
| 7-8 | Low | Logging, metrics, debug info |
| 9-10 | Lowest | Cleanup, maintenance operations |

### Fallback Pattern

```bash
# Recommended pattern for safety
if [ "$QUEUE_AVAILABLE" = "true" ]; then
    queue_db_write "$SQL" "$operation" "$priority"
else
    # Fallback to direct write
    sqlite3 "$HIVE_DB" "$SQL" 2>/dev/null
fi
```

## For Operators

### Common Commands

```bash
# Check queue status
./.claude/hooks/queue-status.sh

# Start worker
./.claude/hooks/queue-worker-start.sh start

# Stop worker
./.claude/hooks/queue-worker-start.sh stop

# View logs
./.claude/hooks/queue-worker-start.sh logs 50

# Run cleanup
./.claude/hooks/queue-cleanup.sh

# Reset queue (WARNING: deletes all entries)
./.claude/hooks/queue-init.sh --reset
```

### Quick Diagnostics

```bash
# Is the queue working?
./.claude/hooks/queue-status.sh --json | jq '{pending: .queue.pending, worker: .worker.running}'

# How many entries processed?
cat .hive-mind/queue/stats.json | jq .

# Any failed entries?
ls .hive-mind/queue/failed/*.json 2>/dev/null | wc -l

# View a failed entry
ls .hive-mind/queue/failed/*.json | head -1 | xargs jq .
```

### Emergency Procedures

#### Worker Not Processing

```bash
# 1. Check worker status
./.claude/hooks/queue-worker-start.sh status

# 2. If not running, start it
./.claude/hooks/queue-worker-start.sh start

# 3. If still not working, clear locks and restart
rm -f .hive-mind/queue/.lock .hive-mind/queue/worker.pid
./.claude/hooks/queue-worker-start.sh restart
```

#### Queue Growing Too Large

```bash
# 1. Check queue depth
./.claude/hooks/queue-status.sh

# 2. Process immediately (single-pass)
./.claude/hooks/lib/queue-worker.sh --once

# 3. If still large, increase batch size temporarily
QUEUE_BATCH_SIZE=100 ./.claude/hooks/lib/queue-worker.sh --once
```

#### Orphaned Entries

```bash
# Recover orphaned entries
./.claude/hooks/queue-cleanup.sh --recover
```

## Environment Variables

```bash
# Enable/disable queue (default: true)
export USE_QUEUE=true

# Worker configuration
export QUEUE_POLL_INTERVAL=0.1    # Polling interval (seconds)
export QUEUE_BATCH_SIZE=10         # Entries per batch
export QUEUE_MAX_RETRIES=3         # Retry attempts
export QUEUE_IDLE_EXIT=300         # Idle timeout (seconds)

# Database configuration
export HIVE_DB=".hive-mind/hive.db"
export SQLITE_TIMEOUT=10000         # SQLite timeout (ms)
```

## File Locations

```
.claude/hooks/
├── lib/
│   ├── queue-lib.sh           # Core library (source this)
│   ├── queue-writer.sh        # Wrapper (backward compat)
│   └── queue-worker.sh        # Worker daemon
├── queue-init.sh              # Initialize/verify queue
├── queue-status.sh            # Monitor queue
├── queue-cleanup.sh           # Maintenance
└── queue-worker-start.sh      # Worker management

.hive-mind/queue/
├── pending/                   # Waiting to process
├── processing/                # Currently processing
├── completed/                 # Successfully done
├── failed/                    # Failed (needs review)
├── worker.log                 # Worker log file
└── stats.json                 # Statistics
```

## API Reference

### queue_db_write

Write SQL to queue (non-blocking).

```bash
queue_db_write SQL [OPERATION] [PRIORITY] [METADATA]
```

**Parameters**:
- `SQL` (required): SQL statement to execute
- `OPERATION` (optional): Operation type (e.g., "update_session", "insert_log")
- `PRIORITY` (optional): Priority 1-10 (default: 5)
- `METADATA` (optional): JSON metadata (default: {})

**Returns**: 0 on success, 1 on failure

**Example**:
```bash
queue_db_write "UPDATE sessions SET status = 'active';" "update_session" 3
```

### queue_size

Get number of pending entries.

```bash
count=$(queue_size)
```

### queue_worker_is_running

Check if worker is running.

```bash
if queue_worker_is_running; then
    echo "Worker is running"
fi
```

### queue_stats_get

Get queue statistics (JSON).

```bash
stats=$(queue_stats_get)
echo "$stats" | jq .
```

## Monitoring

### Health Checks

```bash
# 1. Queue size should be low (< 100 normally)
queue_size

# 2. Worker should be running
queue_worker_is_running

# 3. No stuck processing entries
ls .hive-mind/queue/processing/*.json | wc -l

# 4. Low failed count (< 1% of processed)
failed=$(ls .hive-mind/queue/failed/*.json 2>/dev/null | wc -l)
processed=$(cat .hive-mind/queue/stats.json | jq -r .processed)
echo "Failed rate: $((failed * 100 / (processed + 1)))%"
```

### Alerts

Set up monitoring for:
- Queue depth > 1000
- Worker not running for > 5 minutes
- Failed entries > 100
- Processing entries older than 1 minute

## Performance Tuning

### For High Throughput

```bash
# Increase batch size
export QUEUE_BATCH_SIZE=50

# Reduce poll interval
export QUEUE_POLL_INTERVAL=0.05

# Disable idle exit
export QUEUE_IDLE_EXIT=0
```

### For Low Latency

```bash
# Reduce batch size (more responsive)
export QUEUE_BATCH_SIZE=5

# Faster polling
export QUEUE_POLL_INTERVAL=0.05
```

### For Resource Constrained

```bash
# Enable idle exit (worker exits when queue empty)
export QUEUE_IDLE_EXIT=60

# Smaller batches
export QUEUE_BATCH_SIZE=5
```

## Debugging

### Enable Verbose Logging

```bash
# Run worker in foreground with debug output
./.claude/hooks/lib/queue-worker.sh --foreground
```

### Trace a Specific Entry

```bash
# 1. Enqueue with unique operation
queue_db_write "SELECT 1;" "debug_trace_12345" 5

# 2. Watch logs
tail -f .hive-mind/queue/worker.log | grep "debug_trace_12345"

# 3. Check if completed
ls .hive-mind/queue/completed/*debug_trace_12345* 2>/dev/null
```

### Manual Entry Inspection

```bash
# View a pending entry
ls .hive-mind/queue/pending/*.json | head -1 | xargs jq .

# View a failed entry with error
ls .hive-mind/queue/failed/*.json | head -1 | xargs jq .
```

## Best Practices

### DO

✅ Use queue for all non-critical database writes
✅ Set appropriate priority for your operations
✅ Handle queue unavailable (fallback to direct write)
✅ Monitor queue depth and worker status
✅ Run periodic cleanup
✅ Use descriptive operation names

### DON'T

❌ Use queue for reads (use direct sqlite3)
❌ Queue writes in critical path requiring immediate feedback
❌ Assume queue is always available
❌ Ignore failed entries
❌ Run multiple workers simultaneously (single instance only)
❌ Directly modify queue files (use API)

## Examples

### Simple Hook Integration

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/queue-lib.sh"

# Get data
SESSION_ID=$(cat .hive-mind/.active_session)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Queue write
queue_db_write \
    "UPDATE sessions SET updated_at = '$TIMESTAMP' WHERE id = '$SESSION_ID';" \
    "update_session" \
    5
```

### Batch Operations

```bash
# Enqueue multiple operations
queue_db_write "INSERT INTO logs (msg) VALUES ('start');" "log" 7
queue_db_write "UPDATE sessions SET status = 'active';" "update" 3
queue_db_write "INSERT INTO logs (msg) VALUES ('end');" "log" 7

# Worker will process in priority order (3, then 7, then 7)
```

### Conditional Queueing

```bash
# Only use queue if available
if queue_is_available && [ "$USE_QUEUE" = "true" ]; then
    queue_db_write "$SQL" "$operation" "$priority"
else
    sqlite3 "$HIVE_DB" "$SQL"
fi
```

---

**Quick Reference Version**: 1.0
**Last Updated**: 2026-01-02
