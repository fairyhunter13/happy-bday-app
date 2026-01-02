# Queue System Integration Guide

## Overview

The queue system provides non-blocking SQLite writes for hive-mind hooks, eliminating database lock contention when multiple hooks run concurrently.

## Architecture

```
┌─────────────┐
│   Hook A    │──┐
└─────────────┘  │
                 │    ┌──────────────┐      ┌───────────────┐      ┌──────────┐
┌─────────────┐  ├───→│ Queue Writer │─────→│ Queue File    │─────→│  Worker  │─────→ SQLite DB
│   Hook B    │──┤    │ (fast)       │      │ (FIFO)        │      │ (daemon) │
└─────────────┘  │    └──────────────┘      └───────────────┘      └──────────┘
                 │
┌─────────────┐  │
│   Hook C    │──┘
└─────────────┘
```

### Components

1. **queue-lib.sh** - Core library with queue operations, locking, and utilities
2. **queue-writer.sh** - High-level write interface with convenience functions
3. **queue-worker.sh** - Background daemon that processes queue sequentially
4. **queue-install.sh** - Installation and migration tool

## Quick Start

### Installation

```bash
cd .claude/hooks
./queue-install.sh --install --test
```

### Basic Usage

#### In Your Hook Script

```bash
#!/bin/bash
# Source the queue writer
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/queue-writer.sh"

# Queue a write operation
queue_write "UPDATE sessions SET status = 'active' WHERE id = '$SESSION_ID';" \
    "update_session" \
    3  # priority: 1-10, lower = higher priority
```

#### Drop-in Replacement

Replace this:
```bash
sqlite3 "$HIVE_DB" "UPDATE sessions SET checkpoint_data = '...', updated_at = datetime('now') WHERE id = '$SESSION_ID';"
```

With this:
```bash
queue_update_session "$SESSION_ID" "checkpoint_data = '...', updated_at = datetime('now')"
```

## Migration Guide

### Step 1: Backup

```bash
./queue-install.sh --migrate  # Creates automatic backup
```

### Step 2: Update Hook Scripts

#### Example: auto-checkpoint.sh

**Before:**
```bash
#!/bin/bash
HIVE_DB=".hive-mind/hive.db"

# Direct SQLite write (blocking)
sqlite3 "$HIVE_DB" "UPDATE sessions SET
    checkpoint_data = json_set(
        COALESCE(checkpoint_data, '{}'),
        '$.lastAutoCheckpoint', datetime('now', 'localtime')
    ),
    updated_at = datetime('now', 'localtime')
    WHERE id = '$SESSION_ID';" 2>/dev/null
```

**After:**
```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/queue-writer.sh"

# Non-blocking queued write
queue_update_session "$SESSION_ID" "
    checkpoint_data = json_set(
        COALESCE(checkpoint_data, '{}'),
        '$.lastAutoCheckpoint', datetime('now', 'localtime')
    ),
    updated_at = datetime('now', 'localtime')
"
```

### Step 3: Keep SELECT Queries Direct

**Don't queue read operations:**
```bash
# Read operations stay direct (fast)
SESSION_ID=$(sqlite3 "$HIVE_DB" "SELECT session_id FROM instance_sessions
    WHERE instance_id = '$INSTANCE_ID' LIMIT 1;" 2>/dev/null)
```

## API Reference

### High-Level Functions

#### queue_write
Queue a SQL write operation.

```bash
queue_write <sql> [operation_type] [priority] [metadata_json]

# Examples:
queue_write "UPDATE sessions SET status = 'active';" "update_session" 3
queue_write "INSERT INTO logs VALUES (...);" "insert_log" 7 '{"source":"hook"}'
```

#### queue_update_session
Update sessions table (high priority).

```bash
queue_update_session <session_id> <updates>

# Example:
queue_update_session "$SESSION_ID" "status = 'active', updated_at = datetime('now')"
```

#### queue_update_instance
Update instance_sessions table.

```bash
queue_update_instance <instance_id> <updates>

# Example:
queue_update_instance "$INSTANCE_ID" "last_seen = datetime('now'), operation_count = operation_count + 1"
```

#### queue_insert_log
Insert into session_logs (low priority).

```bash
queue_insert_log <session_id> <level> <message> [data_json]

# Example:
queue_insert_log "$SESSION_ID" "info" "Checkpoint saved" '{"count":42}'
```

#### queue_write_batch
Queue multiple operations in a transaction.

```bash
queue_write_batch "$(cat <<EOF
UPDATE sessions SET status = 'active';
INSERT INTO logs VALUES (...);
UPDATE metrics SET count = count + 1;
EOF
)" "batch_operation" 5
```

### Worker Management

#### queue_status
Show queue system status.

```bash
queue_status
# Output:
# Queue Status:
#   Directory: .hive-mind/queue
#   Pending entries: 5
#   Worker: running (PID: 12345)
# Statistics:
#   {"enqueued":150,"processed":145,"failed":0,"retried":2}
```

#### queue_ensure_worker
Ensure worker is running (called automatically by queue_write).

```bash
queue_ensure_worker
```

#### queue_stop_worker
Stop worker gracefully.

```bash
queue_stop_worker
```

### Maintenance

#### queue_cleanup
Clean up old logs and stale locks.

```bash
queue_cleanup [retention_hours]
```

#### queue_reset
Clear all queue state (for testing).

```bash
queue_reset
```

## Configuration

### Environment Variables

Set in your hook or shell environment:

```bash
# Queue directory (default: .hive-mind/queue)
export QUEUE_DIR=".hive-mind/queue"

# Worker poll interval in seconds (default: 0.1)
export WORKER_POLL_INTERVAL="0.1"

# Batch size for processing (default: 10)
export WORKER_BATCH_SIZE="10"

# Max retries for failed operations (default: 3)
export WORKER_MAX_RETRIES="3"

# Worker idle exit timeout in seconds (default: 300 = 5 min)
export WORKER_IDLE_EXIT="300"

# SQLite timeout in milliseconds (default: 10000)
export SQLITE_TIMEOUT="10000"
```

## Priority Levels

Use priority to control order of execution:

| Priority | Use Case                | Examples                          |
|----------|-------------------------|-----------------------------------|
| 1-2      | Critical/urgent         | Session creation, final checkpoint |
| 3-4      | High priority           | Session updates, instance tracking |
| 5-6      | Normal                  | General updates                   |
| 7-8      | Low priority            | Logging, statistics               |
| 9-10     | Background/maintenance  | Cleanup, archival                 |

## Performance Characteristics

### Write Latency

- **queue_write**: ~1-2ms (just appends to file)
- **Direct sqlite3**: 10-100ms (can block on locks)
- **Improvement**: 10-50x faster hook execution

### Throughput

- **Sequential processing**: ~100-1000 ops/sec (depends on SQL complexity)
- **Concurrent writes**: No limit (all queue independently)

### Memory

- **Queue file**: ~200 bytes per entry
- **Worker process**: ~5-10 MB
- **Total overhead**: Minimal (<20 MB)

## Troubleshooting

### Worker Not Starting

```bash
# Check logs
tail -f .hive-mind/queue/worker.log

# Manually start worker
.claude/hooks/lib/queue-worker.sh

# Check if worker is running
ps aux | grep queue-worker
```

### Queue Building Up

```bash
# Check queue size
source .claude/hooks/lib/queue-writer.sh
queue_status

# Check for database locks
lsof .hive-mind/hive.db

# Increase batch size
export WORKER_BATCH_SIZE="50"
queue_restart_worker
```

### Failed Operations

```bash
# Check failed operations log
cat .hive-mind/queue/failed.log

# Review worker errors
grep ERROR .hive-mind/queue/worker.log
```

### Testing Queue System

```bash
# Run built-in tests
./queue-install.sh --test

# Manual test
source .claude/hooks/lib/queue-writer.sh
queue_reset
queue_write "UPDATE test SET value = 1;" "test" 5
queue_status
queue_wait_drain 10  # Wait up to 10 seconds for queue to empty
queue_status
```

## Advanced Usage

### Custom Operation Types

Group related operations for monitoring:

```bash
queue_write "$sql" "checkpoint_final" 2
queue_write "$sql" "metrics_update" 7
queue_write "$sql" "cleanup" 9
```

### Batch Operations

For multiple related writes:

```bash
local batch=$(cat <<EOF
UPDATE sessions SET status = 'active' WHERE id = '$SESSION_ID';
UPDATE instance_sessions SET last_seen = datetime('now') WHERE session_id = '$SESSION_ID';
INSERT INTO session_logs (session_id, message) VALUES ('$SESSION_ID', 'Batch update');
EOF
)

queue_write_batch "$batch" "session_activation" 3
```

### Conditional Writes

Only queue if operation is needed:

```bash
# Check state first (direct read)
local status=$(sqlite3 "$HIVE_DB" "SELECT status FROM sessions WHERE id = '$SESSION_ID';")

# Conditionally queue write
if [ "$status" != "active" ]; then
    queue_update_session "$SESSION_ID" "status = 'active', activated_at = datetime('now')"
fi
```

## Integration Examples

### Complete Hook Example

```bash
#!/bin/bash
# example-hook.sh - Using queue system

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/queue-writer.sh"

HIVE_DB=".hive-mind/hive.db"

# Get instance ID (direct read)
INSTANCE_ID=$(get_instance_id)

# Get session ID (direct read)
SESSION_ID=$(sqlite3 "$HIVE_DB" "SELECT session_id FROM instance_sessions
    WHERE instance_id = '$INSTANCE_ID' AND status = 'active' LIMIT 1;" 2>/dev/null)

if [ -z "$SESSION_ID" ]; then
    exit 0
fi

# Perform some work...
OPERATION_COUNT=$((OPERATION_COUNT + 1))

# Queue write operations (non-blocking)
queue_update_instance "$INSTANCE_ID" "
    operation_count = operation_count + 1,
    last_seen = datetime('now')
"

queue_update_session "$SESSION_ID" "
    checkpoint_data = json_set(
        COALESCE(checkpoint_data, '{}'),
        '$.lastOperation', datetime('now'),
        '$.operationCount', $OPERATION_COUNT
    ),
    updated_at = datetime('now')
"

queue_insert_log "$SESSION_ID" "debug" "Operation completed" "{\"count\":$OPERATION_COUNT}"

# Hook completes immediately, writes happen in background
```

## Monitoring

### Queue Metrics

```bash
# Show statistics
source .claude/hooks/lib/queue-writer.sh
queue_stats_get

# Output:
# {"enqueued":1523,"processed":1518,"failed":2,"retried":5}
```

### Worker Health

```bash
# Check if worker is healthy
if queue_worker_is_running; then
    echo "Worker is running"
    worker_pid=$(cat .hive-mind/queue/worker.pid)
    echo "PID: $worker_pid"
    echo "Uptime: $(ps -p $worker_pid -o etime=)"
else
    echo "Worker is not running"
fi
```

### Log Analysis

```bash
# Recent errors
grep ERROR .hive-mind/queue/worker.log | tail -10

# Processing rate
grep "Successfully processed" .hive-mind/queue/worker.log | tail -20

# Failed operations
cat .hive-mind/queue/failed.log
```

## Best Practices

1. **Use queue for writes, direct for reads**
   - Reads are fast and don't cause locks
   - Writes should be queued to avoid contention

2. **Set appropriate priorities**
   - Critical operations: 1-3
   - Normal operations: 4-6
   - Logging/stats: 7-10

3. **Batch related operations**
   - Use transactions for multiple related writes
   - Reduces queue overhead

4. **Monitor queue size**
   - If queue grows consistently, increase `WORKER_BATCH_SIZE`
   - Or reduce `WORKER_POLL_INTERVAL`

5. **Handle failures gracefully**
   - Failed operations are logged to `failed.log`
   - Review and replay manually if needed

6. **Test before deploying**
   - Use `queue-install.sh --test` to verify
   - Test in development environment first

## Rollback

If you need to rollback:

```bash
# Uninstall and restore original hooks
./queue-install.sh --uninstall

# Backups are in .hive-mind/backups/queue-migration-*
```

## Support

For issues or questions:

1. Check worker logs: `.hive-mind/queue/worker.log`
2. Check failed operations: `.hive-mind/queue/failed.log`
3. Run diagnostics: `./queue-install.sh --test`
4. Review queue status: `queue_status`
