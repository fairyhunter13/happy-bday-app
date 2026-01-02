# Queue System API Reference

## Complete API Documentation

### Source

All functions are defined in: `.claude/hooks/lib/queue-lib.sh`

## Core Functions

### queue_db_write()

Main function to enqueue database write operations.

**Signature:**
```bash
queue_db_write "SQL" "operation_type" "priority" "metadata"
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| SQL | string | required | SQL statement to execute |
| operation_type | string | "generic" | Operation identifier for logging |
| priority | int | 5 | Priority level (1-10, lower = higher) |
| metadata | JSON | "{}" | Additional context data |

**Returns:**
- `0` - Success (queued or executed)
- `1` - Failure (check logs)

**Examples:**
```bash
# Minimal
queue_db_write "UPDATE users SET active = 1 WHERE id = 'abc';"

# With operation type
queue_db_write \
    "INSERT INTO logs VALUES ('message');" \
    "insert_log"

# Full parameters
queue_db_write \
    "DELETE FROM temp WHERE id = 123;" \
    "cleanup_temp" \
    8 \
    '{"threshold": 30, "count": 5}'
```

### queue_enqueue()

Alternative function with reordered parameters.

**Signature:**
```bash
queue_enqueue "operation_type" "priority" "SQL" "metadata"
```

**Returns:** Same as `queue_db_write()`

**Examples:**
```bash
queue_enqueue "session_update" 3 \
    "UPDATE sessions SET last_activity = datetime('now') WHERE id = 'abc';" \
    '{"session_id": "abc"}'
```

## Convenience Wrappers

### queue_update_session()

Update sessions table (high priority).

**Signature:**
```bash
queue_update_session "session_id" "SET_CLAUSE"
```

**Example:**
```bash
queue_update_session "sess_123" "verified = 1, last_activity = datetime('now')"
```

**Internally uses:**
- Operation: `update_session`
- Priority: 3

### queue_update_instance()

Update instance_sessions table.

**Signature:**
```bash
queue_update_instance "instance_id" "SET_CLAUSE"
```

**Example:**
```bash
queue_update_instance "inst_456" "status = 'processing', updated_at = datetime('now')"
```

**Internally uses:**
- Operation: `update_instance`
- Priority: 4

### queue_insert_log()

Insert into session_logs (low priority).

**Signature:**
```bash
queue_insert_log "session_id" "level" "message" "data_json"
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| session_id | string | Session identifier |
| level | string | Log level (info, warn, error, debug) |
| message | string | Log message |
| data_json | JSON | Optional additional data |

**Example:**
```bash
queue_insert_log "sess_123" "info" "User logged in successfully" \
    '{"ip": "192.168.1.1", "user_agent": "Mozilla/5.0"}'
```

**Internally uses:**
- Operation: `insert_log`
- Priority: 7

## Queue Status Functions

### queue_size()

Get count of pending entries.

**Signature:**
```bash
count=$(queue_size)
```

**Returns:** Integer count (printed to stdout)

**Example:**
```bash
pending=$(queue_size)
if [ "$pending" -gt 100 ]; then
    echo "Queue backlog: $pending entries"
fi
```

### queue_processing_count()

Get count of entries currently being processed.

**Signature:**
```bash
count=$(queue_processing_count)
```

**Returns:** Integer count (printed to stdout)

### queue_stats_get()

Get queue statistics as JSON.

**Signature:**
```bash
stats=$(queue_stats_get)
```

**Returns:** JSON object with keys:
- `enqueued`: Total enqueued
- `processed`: Successfully processed
- `failed`: Failed after retries
- `retried`: Retry attempts
- `direct`: Direct executions (fallback)

**Example:**
```bash
stats=$(queue_stats_get)
enqueued=$(echo "$stats" | jq .enqueued)
processed=$(echo "$stats" | jq .processed)
success_rate=$((processed * 100 / enqueued))
echo "Success rate: ${success_rate}%"
```

## Worker Management

### queue_worker_is_running()

Check if worker daemon is alive.

**Signature:**
```bash
if queue_worker_is_running; then
    echo "Worker is running"
fi
```

**Returns:**
- 0 - Worker is running
- 1 - Worker is not running

### queue_ensure_worker()

Start worker if not already running (non-blocking).

**Signature:**
```bash
queue_ensure_worker
```

**Behavior:**
- If worker running: does nothing
- If worker not running: starts it in background
- Non-blocking (returns immediately)

**Example:**
```bash
# Called automatically by queue_db_write(), but can be explicit
queue_ensure_worker && echo "Worker started"
```

### queue_stop_worker()

Stop worker gracefully (processes remaining entries).

**Signature:**
```bash
queue_stop_worker
```

**Behavior:**
1. Sends SIGTERM to worker
2. Waits up to 5 seconds for graceful shutdown
3. Force kills if needed
4. Cleans up PID file

**Example:**
```bash
queue_stop_worker
echo "Worker stopped"
```

## Directory & File Operations

### queue_init_dirs()

Initialize queue directories and files.

**Signature:**
```bash
queue_init_dirs
```

**Returns:**
- 0 - Success
- 1 - Failure

**Creates:**
- `.hive-mind/queue/pending/`
- `.hive-mind/queue/processing/`
- `.hive-mind/queue/completed/`
- `.hive-mind/queue/failed/`
- `.hive-mind/queue/.tmp/`
- `.hive-mind/queue/.seq` (sequence file)
- `.hive-mind/queue/stats.json`

### queue_is_available()

Check if queue system is initialized and available.

**Signature:**
```bash
if queue_is_available; then
    echo "Queue is ready"
fi
```

**Returns:**
- 0 - Queue available
- 1 - Queue not available

## Entry Management Functions

### queue_list_pending()

List pending entries (sorted by priority and sequence).

**Signature:**
```bash
files=$(queue_list_pending [batch_size])
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| batch_size | int | 10 | Number of entries to list |

**Returns:** File paths (one per line) to pending entries

### queue_claim_entry()

Move entry from pending to processing (atomic).

**Signature:**
```bash
processing_file=$(queue_claim_entry "/path/to/pending/file")
```

**Returns:**
- stdout: Path to processing file (success)
- exit code 1 (failure)

### queue_read_entry()

Read and return queue entry JSON.

**Signature:**
```bash
json=$(queue_read_entry "/path/to/entry/file")
```

**Returns:** JSON content of entry

### queue_complete_entry()

Mark entry as successfully processed.

**Signature:**
```bash
queue_complete_entry "/path/to/processing/file"
```

**Side effects:**
- Moves file to `completed/`
- Increments `processed` stats

### queue_fail_entry()

Mark entry as failed.

**Signature:**
```bash
queue_fail_entry "/path/to/processing/file" "error message"
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| file | string | Path to processing file |
| error_msg | string | Error description |

**Side effects:**
- Moves file to `failed/`
- Appends error info to entry
- Increments `failed` stats

### queue_retry_entry()

Retry entry (return to pending with retry count).

**Signature:**
```bash
queue_retry_entry "/path/to/processing/file"
```

**Behavior:**
- Increments retry count
- Lowers priority (increases priority number)
- Returns to pending queue
- Fails if max retries exceeded

**Side effects:**
- Increments `retried` stats
- May move to failed if max retries reached

## JSON Utilities

### json_escape_string()

Escape string for safe JSON embedding.

**Signature:**
```bash
escaped=$(json_escape_string "string with 'quotes' and \"escapes\"")
```

**Returns:** Escaped string safe for JSON

**Handles:**
- Backslashes
- Quotes
- Newlines
- Tabs
- Control characters

### json_get_field()

Extract field from JSON string.

**Signature:**
```bash
value=$(json_get_field '{"name":"John","age":30}' "name")
```

**Returns:** Field value

### queue_format_json()

Create properly formatted queue entry JSON.

**Signature:**
```bash
json=$(queue_format_json "SQL" "operation" "priority" "metadata" "seq")
```

**Returns:** Complete JSON entry

## SQL Execution

### queue_exec_sql()

Execute SQL directly (used by worker, can also be called manually).

**Signature:**
```bash
queue_exec_sql "SQL" [max_retries]
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| SQL | string | required | SQL to execute |
| max_retries | int | 3 | Retry on locked DB |

**Returns:**
- 0 - Success
- 1 - Failure

**Behavior:**
- Retries with exponential backoff on "database locked"
- Fails immediately on other errors

### queue_exec_sql_direct()

Alias for `queue_exec_sql()`.

## Maintenance Functions

### queue_cleanup_old()

Delete old completed/failed entries.

**Signature:**
```bash
queue_cleanup_old [retention_hours]
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| retention_hours | int | 24 | Keep entries from last N hours |

**Side effects:**
- Deletes files older than retention period
- Rotates log if >1MB
- Cleans stale tmp files

### queue_reset()

Reset queue to initial state (WARNING: destructive).

**Signature:**
```bash
queue_reset
```

**Side effects:**
- Stops worker
- Deletes all pending entries
- Deletes all processing entries
- Deletes all completed entries
- Deletes all failed entries
- Resets sequence counter to 0
- Resets stats to zero

## Logging

### queue_log()

Write to queue worker log.

**Signature:**
```bash
queue_log "level" "message"
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| level | string | Log level (info, warn, error, debug) |
| message | string | Log message |

**Example:**
```bash
queue_log "info" "Starting batch process"
queue_log "error" "Database write failed: connection timeout"
```

## Configuration Variables

### Environment Variables

All configuration via environment variables:

```bash
# Queue directories
export QUEUE_BASE_DIR=".hive-mind/queue"

# Worker behavior
export QUEUE_POLL_INTERVAL="0.1"        # seconds
export QUEUE_BATCH_SIZE="10"            # entries
export QUEUE_MAX_RETRIES="3"            # attempts
export QUEUE_IDLE_EXIT="300"            # seconds
export QUEUE_PROCESSING_TIMEOUT="30"    # seconds (orphan recovery)

# Database
export HIVE_DB=".hive-mind/hive.db"
export SQLITE_TIMEOUT="10000"           # milliseconds
export SQLITE_BUSY_TIMEOUT="5000"       # milliseconds

# Feature flags
export USE_QUEUE="true"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error/Failure |

## Concurrency & Thread Safety

All functions are:
- **Atomic**: File operations are atomic (write to temp, then move)
- **Lock-free for enqueue**: Uses atomic file operations
- **Serialized sequence generation**: Uses flock for sequence numbers
- **Safe for concurrent access**: Multiple scripts can queue simultaneously

## Performance Characteristics

| Operation | Typical Time | Notes |
|-----------|--------------|-------|
| `queue_db_write()` | <1ms | Fast path, atomic |
| `queue_ensure_worker()` | <100ms | Starts daemon if needed |
| `queue_size()` | <10ms | Directory listing |
| `queue_stats_get()` | <5ms | File read |
| Worker processing | ~200 entries/sec | Configurable batch size |

---

**Last Updated**: 2024-01-01
**Version**: 1.0.0
