# Queue System Developer Integration Guide

## Overview

This guide explains how to integrate the queue system into your application code.

## Before and After Examples

### Before: Direct SQLite Execution

```bash
#!/bin/bash

# Problem: Synchronous, can fail on lock contention
update_session() {
    local session_id="$1"
    local activity_json="$2"
    
    sqlite3 .hive-mind/hive.db \
        "UPDATE sessions SET last_activity = '$activity_json' WHERE id = '$session_id';"
    
    if [ $? -ne 0 ]; then
        echo "WARN: Session update failed, retrying..."
        # Manual retry logic (fragile)
        sleep 0.5
        sqlite3 .hive-mind/hive.db \
            "UPDATE sessions SET last_activity = '$activity_json' WHERE id = '$session_id';"
    fi
}
```

### After: Using Queue

```bash
#!/bin/bash

# Source queue library (once per script)
source ./.claude/hooks/lib/queue-lib.sh

# Fast, reliable, guaranteed delivery
update_session() {
    local session_id="$1"
    local activity_json="$2"
    
    queue_db_write \
        "UPDATE sessions SET last_activity = '$activity_json' WHERE id = '$session_id';" \
        "update_session" \
        3 \
        "{\"session_id\": \"$session_id\"}"
    
    # Always succeeds (queued for processing)
    return 0
}
```

## Integration Patterns

### Pattern 1: Session Updates

```bash
#!/bin/bash
source ./.claude/hooks/lib/queue-lib.sh

HIVE_DB=".hive-mind/hive.db"

# After user activity (login, post, etc.)
handle_user_activity() {
    local session_id="$1"
    local activity="$2"
    
    # Queue session update (high priority)
    queue_db_write \
        "UPDATE sessions SET last_activity = datetime('now') WHERE id = '$session_id';" \
        "update_session" \
        3 \
        "{\"activity\": \"$activity\"}"
    
    # Return immediately without waiting
    return 0
}
```

### Pattern 2: Batch Inserts

```bash
#!/bin/bash
source ./.claude/hooks/lib/queue-lib.sh

# Batch user notifications
send_birthday_notifications() {
    local recipients=("$@")
    local values=""
    
    # Build multi-row insert
    for recipient in "${recipients[@]}"; do
        values+="('$recipient', 'birthday', datetime('now')), "
    done
    
    # Remove trailing comma
    values="${values%, }"
    
    # Single queue entry for all inserts (efficient)
    queue_db_write \
        "INSERT INTO notifications (user_id, type, created_at) VALUES $values;" \
        "bulk_notify" \
        2 \
        "{\"count\": ${#recipients[@]}}"
}
```

### Pattern 3: Conditional Writes

```bash
#!/bin/bash
source ./.claude/hooks/lib/queue-lib.sh

# Update with validation SQL
process_payment() {
    local transaction_id="$1"
    local amount="$2"
    
    # Complex SQL with conditions
    local sql="
        UPDATE transactions SET 
            status = 'completed',
            processed_at = datetime('now')
        WHERE id = '$transaction_id' 
            AND status = 'pending'
            AND amount = $amount;
    "
    
    # Queue with high priority
    queue_db_write \
        "$sql" \
        "payment_processing" \
        1 \
        "{\"transaction_id\": \"$transaction_id\", \"amount\": $amount}"
}
```

### Pattern 4: Error Recovery with Metadata

```bash
#!/bin/bash
source ./.claude/hooks/lib/queue-lib.sh

# Capture context for error handling
handle_critical_update() {
    local operation_id="$1"
    local sql="$2"
    local context="$3"  # JSON
    
    # Queue with full context
    queue_db_write \
        "$sql" \
        "critical_update" \
        1 \
        "{
            \"operation_id\": \"$operation_id\",
            \"context\": $context,
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }"
}
```

## API Reference

### queue_db_write()

Main function to enqueue database writes.

```bash
queue_db_write "SQL" "operation_type" "priority" "metadata"
```

**Parameters:**
- `$1` SQL (required): SQL statement
- `$2` operation_type (optional): Operation name for logging
- `$3` priority (optional, 1-10): Processing priority
- `$4` metadata (optional): JSON metadata

**Returns:**
- 0: Success (queued or executed)
- 1: Failure (check logs)

**Examples:**
```bash
# Simple update
queue_db_write "UPDATE users SET active = 1 WHERE id = 'abc';"

# With operation type
queue_db_write \
    "INSERT INTO logs VALUES ('msg');" \
    "log_insert"

# Full parameters
queue_db_write \
    "DELETE FROM temp WHERE age > 30;" \
    "cleanup_temp" \
    8 \
    '{"age_threshold": 30}'
```

### Convenience Wrappers

#### queue_update_session()
```bash
queue_update_session "session_id" "SET_CLAUSE"

# Example:
queue_update_session "abc123" "last_activity = datetime('now'), verified = 1"
```

#### queue_update_instance()
```bash
queue_update_instance "instance_id" "SET_CLAUSE"

# Example:
queue_update_instance "inst_456" "status = 'active', updated_at = datetime('now')"
```

#### queue_insert_log()
```bash
queue_insert_log "session_id" "level" "message" "data_json"

# Example:
queue_insert_log "abc123" "info" "User login successful" '{"ip": "192.168.1.1"}'
```

### Utility Functions

```bash
# Get queue size (pending entries)
count=$(queue_size)
echo "Pending entries: $count"

# Get processing count
processing=$(queue_processing_count)
echo "Currently processing: $processing"

# Check if worker is running
if queue_worker_is_running; then
    echo "Worker is active"
fi

# Get stats JSON
stats=$(queue_stats_get)
echo "Stats: $stats"
```

## Error Handling Strategies

### Strategy 1: Fire-and-Forget

Use for non-critical updates where eventual delivery is acceptable:

```bash
# Post a greeting
queue_db_write "INSERT INTO greetings (user_id, message) VALUES ('user123', 'Happy Birthday!');"

# Don't check result - queue handles it
```

### Strategy 2: Verify Enqueue

Check if write was successfully queued:

```bash
if queue_db_write "INSERT INTO important VALUES (...);" "import_op" 1; then
    echo "Write queued"
else
    echo "ERROR: Could not queue write"
    exit 1
fi
```

### Strategy 3: Monitor After Enqueue

Queue write and monitor completion:

```bash
# Queue the write
queue_db_write "$sql" "critical_op" 1 "$metadata"

# Give worker time to process
sleep 2

# Check if it completed
pending=$(queue_size)
if [ "$pending" -eq 0 ]; then
    echo "All writes processed"
fi
```

### Strategy 4: Fallback to Direct Execution

For absolutely critical operations:

```bash
# Try queue first
if ! queue_db_write "$sql" "critical" 1; then
    echo "Queue failed, executing directly"
    sqlite3 .hive-mind/hive.db "$sql" || {
        echo "FATAL: Could not execute write"
        exit 1
    }
fi
```

## Testing

### Unit Test Example

```bash
#!/bin/bash
set -e

source ./.claude/hooks/lib/queue-lib.sh

# Test helper
assert_queue_success() {
    local sql="$1"
    if ! queue_db_write "$sql" "test"; then
        echo "FAIL: queue_db_write returned 1"
        return 1
    fi
    echo "PASS: Write queued"
}

assert_queue_size() {
    local expected="$1"
    local actual=$(queue_size)
    if [ "$actual" -ne "$expected" ]; then
        echo "FAIL: Expected $expected pending, got $actual"
        return 1
    fi
    echo "PASS: Queue size is $expected"
}

# Run tests
echo "Testing queue_db_write..."
assert_queue_success "INSERT INTO test_table VALUES (1);"
assert_queue_size 1

# Process once
./.claude/hooks/queue-worker-start.sh once

# Verify completion
sleep 1
assert_queue_size 0

echo "All tests passed!"
```

### Integration Test Example

```bash
#!/bin/bash
set -e

source ./.claude/hooks/lib/queue-lib.sh

# Create test database
sqlite3 .hive-mind/hive.db "CREATE TABLE IF NOT EXISTS test_integration (id INTEGER PRIMARY KEY, value TEXT);"

# Queue a write
queue_db_write \
    "INSERT INTO test_integration (value) VALUES ('integration_test');" \
    "test" \
    5

echo "Entry queued, processing..."

# Start worker and wait
./.claude/hooks/queue-worker-start.sh start
sleep 3

# Verify data exists
result=$(sqlite3 .hive-mind/hive.db "SELECT value FROM test_integration WHERE value = 'integration_test';")

if [ "$result" = "integration_test" ]; then
    echo "PASS: Data was successfully written to database"
else
    echo "FAIL: Data was not found in database"
    exit 1
fi
```

## Performance Considerations

### 1. SQL Statement Size

Queue entries include full SQL statements. Keep them reasonable:

```bash
# Good: Simple, focused operations
queue_db_write "UPDATE users SET active = 1 WHERE id = 'abc';"

# Bad: Extremely long SQL (avoidable)
# If SQL is > 1KB, consider batching logic differently
```

### 2. JSON Metadata Size

Keep metadata minimal:

```bash
# Good: Just identify the operation
queue_db_write "$sql" "op" 5 '{"user_id": "abc123"}'

# Bad: Duplicate data already in SQL
queue_db_write "$sql" "op" 5 '{"full_user_object": {...}}'
```

### 3. Batch Frequency

Queue multiple related operations together when possible:

```bash
# Instead of 3 queue calls
queue_db_write "INSERT INTO notifications VALUES ('a');"
queue_db_write "INSERT INTO notifications VALUES ('b');"
queue_db_write "INSERT INTO notifications VALUES ('c');"

# Do 1 queue call
queue_db_write "INSERT INTO notifications VALUES ('a'), ('b'), ('c');"
```

## Migration Guide

### Step 1: Identify Direct SQL Calls

Find all `sqlite3` calls in your scripts:

```bash
grep -r "sqlite3.*hive.db" .claude/hooks/
grep -r "sqlite3.*\$HIVE_DB" .claude/hooks/
```

### Step 2: Prioritize for Conversion

Focus on high-frequency operations:
1. Session updates
2. User activity logging
3. Notification inserts
4. Batch operations

### Step 3: Add Queue Library

At the start of scripts using database:

```bash
#!/bin/bash
source ./.claude/hooks/lib/queue-lib.sh
```

### Step 4: Convert Operations

Replace direct `sqlite3` calls:

```bash
# Old
result=$(sqlite3 $HIVE_DB "SELECT COUNT(*) FROM sessions WHERE id = '$sid';")

# For reads, keep as-is (queue is only for writes)
# For writes, convert:

# Old
sqlite3 $HIVE_DB "UPDATE sessions SET active = 1 WHERE id = '$sid';"

# New
queue_db_write "UPDATE sessions SET active = 1 WHERE id = '$sid';" "update_session" 3
```

### Step 5: Test

Run integration tests to verify:
```bash
# Test script
./test_queue_integration.sh

# Monitor
watch "./.claude/hooks/queue-status.sh"
```

## Best Practices

### 1. Always Use Appropriate Priority

```bash
# Auth operations: 1-2
queue_db_write "$sql" "auth" 2

# Session state: 3-4
queue_db_write "$sql" "session" 3

# General ops: 5-6
queue_db_write "$sql" "general" 5

# Logging: 7-8
queue_db_write "$sql" "log" 7

# Analytics: 9-10
queue_db_write "$sql" "analytics" 9
```

### 2. Include Metadata for Debugging

```bash
queue_db_write \
    "$sql" \
    "operation_name" \
    5 \
    "{
        \"source\": \"script.sh\",
        \"user_id\": \"$user_id\",
        \"timestamp\": \"$(date -u +%s)\"
    }"
```

### 3. Validate SQL Before Queueing

```bash
# For critical operations, validate syntax
if echo "$sql" | grep -qE "^(INSERT|UPDATE|DELETE) "; then
    queue_db_write "$sql" "critical" 1
else
    echo "ERROR: Invalid SQL statement"
    return 1
fi
```

### 4. Handle Failures Gracefully

```bash
# Queue with error handling
if ! queue_db_write "$sql" "critical" 1; then
    # Log and retry later
    echo "Failed to queue write: $sql" >> .hive-mind/queue_errors.log
    return 1
fi
```

---

**Last Updated**: 2024-01-01
**Difficulty**: Intermediate
