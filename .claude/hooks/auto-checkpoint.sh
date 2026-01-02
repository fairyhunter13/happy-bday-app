#!/bin/bash
# Auto-Checkpoint Hook - Multi-Instance Version
# Automatically saves checkpoint after tool operations (throttled per-instance)
#
# This hook runs after Write, Edit, Task operations and:
# 1. Gets the stable instance ID for this Claude terminal
# 2. Looks up the session for this specific instance
# 3. Checks if enough time has passed since last checkpoint (60 seconds)
# 4. Saves checkpoint with instance attribution
#
# NO FALLBACK to .active_session or "most recent" - prevents cross-contamination

HIVE_DB=".hive-mind/hive.db"
INSTANCE_DIR=".hive-mind/instances"
CHECKPOINT_INTERVAL=60  # seconds between auto-checkpoints

# Only proceed if hive.db exists
if [ ! -f "$HIVE_DB" ]; then
    exit 0
fi

# Source helper functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/session-helpers.sh" ]; then
    source "$SCRIPT_DIR/lib/session-helpers.sh"
else
    # Minimal fallback
    mkdir -p "$INSTANCE_DIR"
    get_instance_id() {
        local tty_raw=$(tty 2>/dev/null)
        local tty_id=""
        if [ -n "$tty_raw" ] && [ "$tty_raw" != "not a tty" ]; then
            tty_id=$(echo "$tty_raw" | sed 's|^/dev/||' | tr '/' '_')
        else
            tty_id="notty_${PPID:-$$}"
        fi
        local instance_file="$INSTANCE_DIR/.instance_$tty_id"
        if [ ! -f "$instance_file" ]; then
            echo "instance-$(date +%s)-$$" > "$instance_file"
        fi
        cat "$instance_file"
    }
fi

# Get stable instance ID
INSTANCE_ID=$(get_instance_id)
SESSION_ID=""

# Priority 1: Instance-specific session file (reliable for multi-instance)
if [ -f "$INSTANCE_DIR/.session_$INSTANCE_ID" ]; then
    SESSION_ID=$(cat "$INSTANCE_DIR/.session_$INSTANCE_ID" 2>/dev/null)
fi

# Priority 2: Query instance_sessions table
if [ -z "$SESSION_ID" ]; then
    SESSION_ID=$(sqlite3 "$HIVE_DB" "SELECT session_id FROM instance_sessions
        WHERE instance_id = '$INSTANCE_ID'
        AND status = 'active'
        LIMIT 1;" 2>/dev/null)
fi

# Priority 3: Environment variable (legacy)
if [ -z "$SESSION_ID" ]; then
    SESSION_ID="${HIVE_SESSION_ID:-}"
fi

# NO FALLBACK to .active_session or "most recent" - prevents cross-contamination
# If no session found for this instance, skip checkpoint

if [ -z "$SESSION_ID" ]; then
    exit 0
fi

# Instance-specific throttling - each instance has its own checkpoint timer
LAST_CHECKPOINT_FILE="$INSTANCE_DIR/.last_checkpoint_$INSTANCE_ID"
CURRENT_TIME=$(date +%s)
LAST_CHECKPOINT=0

if [ -f "$LAST_CHECKPOINT_FILE" ]; then
    LAST_CHECKPOINT=$(cat "$LAST_CHECKPOINT_FILE" 2>/dev/null || echo "0")
fi

TIME_SINCE_LAST=$((CURRENT_TIME - LAST_CHECKPOINT))

# Skip if not enough time has passed for THIS instance
if [ "$TIME_SINCE_LAST" -lt "$CHECKPOINT_INTERVAL" ]; then
    # Still update operation count even if not checkpointing
    if type touch_instance &>/dev/null; then
        touch_instance "$INSTANCE_ID"
    fi
    exit 0
fi

# Update instance-specific checkpoint timestamp
echo "$CURRENT_TIME" > "$LAST_CHECKPOINT_FILE"

# Get operation counts
INSTANCE_OP_COUNT=0
TOTAL_OP_COUNT=0

if type get_instance_stats &>/dev/null; then
    STATS=$(get_instance_stats "$INSTANCE_ID")
    INSTANCE_OP_COUNT=$(echo "$STATS" | cut -d'|' -f2)
fi

# Get total operation count across all instances for this session
TOTAL_OP_COUNT=$(sqlite3 "$HIVE_DB" "SELECT COALESCE(SUM(operation_count), 0) FROM instance_sessions
    WHERE session_id = '$SESSION_ID' AND status = 'active';" 2>/dev/null || echo "0")
TOTAL_OP_COUNT=$((TOTAL_OP_COUNT + 1))

# Save checkpoint with instance attribution
sqlite3 "$HIVE_DB" "UPDATE sessions SET
    checkpoint_data = json_set(
        COALESCE(checkpoint_data, '{}'),
        '\$.lastAutoCheckpoint', datetime('now', 'localtime'),
        '\$.savedBy', 'instance:$INSTANCE_ID',
        '\$.operationCount', $TOTAL_OP_COUNT,
        '\$.checkpointType', 'auto'
    ),
    updated_at = datetime('now', 'localtime')
    WHERE id = '$SESSION_ID';" 2>/dev/null

# Update instance tracking
if type increment_checkpoint &>/dev/null; then
    increment_checkpoint "$INSTANCE_ID"
else
    sqlite3 "$HIVE_DB" "UPDATE instance_sessions SET
        checkpoint_count = checkpoint_count + 1,
        operation_count = operation_count + 1,
        last_seen = datetime('now', 'localtime')
        WHERE instance_id = '$INSTANCE_ID';" 2>/dev/null
fi

# Log to session_logs if table exists
sqlite3 "$HIVE_DB" "INSERT INTO session_logs (session_id, log_level, message, data)
    SELECT '$SESSION_ID', 'debug', 'Auto-checkpoint',
    json_object('instanceId', '$INSTANCE_ID', 'operationCount', $TOTAL_OP_COUNT)
    WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='session_logs');" 2>/dev/null

# Silent success - don't spam output
