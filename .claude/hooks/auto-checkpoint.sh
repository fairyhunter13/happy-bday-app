#!/bin/bash
# =============================================================================
# Auto-Checkpoint Hook - Queue-Enabled Multi-Instance Version
# =============================================================================
#
# Automatically saves checkpoint after tool operations (throttled per-instance).
# Uses queue-based writes for non-blocking operation.
#
# FEATURES:
# - Non-blocking: Uses queue for database writes (<1ms latency)
# - Fallback: Falls back to direct write if queue unavailable
# - Per-instance throttling: Each instance has its own checkpoint timer
# - Multi-instance safe: No cross-contamination between instances
# - Feature flag: USE_QUEUE=true/false to toggle queue usage
#
# Called by: PostToolUse:Write,Edit,Task hook in .claude/settings.json
#
# =============================================================================

set -o pipefail

# Configuration
HIVE_DB="${HIVE_DB:-.hive-mind/hive.db}"
INSTANCE_DIR="${INSTANCE_DIR:-.hive-mind/instances}"
CHECKPOINT_INTERVAL="${CHECKPOINT_INTERVAL:-60}"  # seconds between auto-checkpoints

# Feature flag for queue usage (default: enabled)
USE_QUEUE="${USE_QUEUE:-true}"

# Only proceed if hive.db exists
if [ ! -f "$HIVE_DB" ]; then
    exit 0
fi

# =============================================================================
# Source Libraries
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUEUE_AVAILABLE=false

# Source queue library if available
if [ "$USE_QUEUE" = "true" ] && [ -f "$SCRIPT_DIR/lib/queue-lib.sh" ]; then
    source "$SCRIPT_DIR/lib/queue-lib.sh" 2>/dev/null && QUEUE_AVAILABLE=true
fi

# Source session helpers
if [ -f "$SCRIPT_DIR/lib/session-helpers.sh" ]; then
    source "$SCRIPT_DIR/lib/session-helpers.sh"
else
    # Minimal fallback implementation
    mkdir -p "$INSTANCE_DIR" 2>/dev/null

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

    get_instance_stats() {
        echo "0|0|now|now"
    }

    touch_instance() {
        return 0
    }

    increment_checkpoint() {
        return 0
    }
fi

# =============================================================================
# Helper Functions
# =============================================================================

# Execute SQL using queue or direct write
db_write() {
    local sql="$1"
    local operation="${2:-generic}"
    local priority="${3:-5}"

    if [ "$QUEUE_AVAILABLE" = "true" ]; then
        # Use queue for non-blocking write
        queue_db_write "$sql" "$operation" "$priority"
    else
        # Direct write (blocking)
        sqlite3 "$HIVE_DB" "$sql" 2>/dev/null
    fi
}

# Execute SQL read (always direct, no queue)
db_read() {
    local sql="$1"
    sqlite3 "$HIVE_DB" "$sql" 2>/dev/null
}

# =============================================================================
# Get Instance and Session
# =============================================================================

# Get stable instance ID
INSTANCE_ID=$(get_instance_id)
SESSION_ID=""

# Priority 1: Instance-specific session file (reliable for multi-instance)
if [ -f "$INSTANCE_DIR/.session_$INSTANCE_ID" ]; then
    SESSION_ID=$(cat "$INSTANCE_DIR/.session_$INSTANCE_ID" 2>/dev/null)
fi

# Priority 2: Query instance_sessions table
if [ -z "$SESSION_ID" ]; then
    SESSION_ID=$(db_read "SELECT session_id FROM instance_sessions
        WHERE instance_id = '$INSTANCE_ID'
        AND status = 'active'
        LIMIT 1;")
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

# =============================================================================
# Throttling Check
# =============================================================================

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

# =============================================================================
# Save Checkpoint
# =============================================================================

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
TOTAL_OP_COUNT=$(db_read "SELECT COALESCE(SUM(operation_count), 0) FROM instance_sessions
    WHERE session_id = '$SESSION_ID' AND status = 'active';")
TOTAL_OP_COUNT=${TOTAL_OP_COUNT:-0}
TOTAL_OP_COUNT=$((TOTAL_OP_COUNT + 1))

# Save checkpoint with instance attribution (high priority)
CHECKPOINT_SQL="UPDATE sessions SET
    checkpoint_data = json_set(
        COALESCE(checkpoint_data, '{}'),
        '\$.lastAutoCheckpoint', datetime('now', 'localtime'),
        '\$.savedBy', 'instance:$INSTANCE_ID',
        '\$.operationCount', $TOTAL_OP_COUNT,
        '\$.checkpointType', 'auto'
    ),
    updated_at = datetime('now', 'localtime')
    WHERE id = '$SESSION_ID';"

db_write "$CHECKPOINT_SQL" "update_checkpoint" 3

# Update instance tracking (medium priority)
if type increment_checkpoint &>/dev/null; then
    increment_checkpoint "$INSTANCE_ID"
else
    INSTANCE_SQL="UPDATE instance_sessions SET
        checkpoint_count = checkpoint_count + 1,
        operation_count = operation_count + 1,
        last_seen = datetime('now', 'localtime')
        WHERE instance_id = '$INSTANCE_ID';"

    db_write "$INSTANCE_SQL" "update_instance" 5
fi

# Log to session_logs if table exists (low priority)
LOG_SQL="INSERT INTO session_logs (session_id, log_level, message, data)
    SELECT '$SESSION_ID', 'debug', 'Auto-checkpoint',
    json_object('instanceId', '$INSTANCE_ID', 'operationCount', $TOTAL_OP_COUNT)
    WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='session_logs');"

db_write "$LOG_SQL" "insert_log" 7

# =============================================================================
# Periodic Cleanup (Every 10 Checkpoints)
# =============================================================================

# Track checkpoint count for cleanup trigger
CLEANUP_TRIGGER_FILE="$INSTANCE_DIR/.cleanup_checkpoint_$INSTANCE_ID"
CLEANUP_CHECKPOINT_COUNT=0

if [ -f "$CLEANUP_TRIGGER_FILE" ]; then
    CLEANUP_CHECKPOINT_COUNT=$(cat "$CLEANUP_TRIGGER_FILE" 2>/dev/null || echo "0")
fi

CLEANUP_CHECKPOINT_COUNT=$((CLEANUP_CHECKPOINT_COUNT + 1))

# Run cleanup every 10 checkpoints (approximately every 10 minutes)
if [ "$CLEANUP_CHECKPOINT_COUNT" -ge 10 ]; then
    # Reset counter
    echo "0" > "$CLEANUP_TRIGGER_FILE"

    # Run cleanup in background to avoid blocking checkpoint
    # Redirect stderr to prevent spam, only critical errors will show
    if [ -f "$SCRIPT_DIR/agent-lifecycle-cleanup.sh" ]; then
        "$SCRIPT_DIR/agent-lifecycle-cleanup.sh" "periodic" "$SESSION_ID" 2>/dev/null &
    fi
else
    # Update counter
    echo "$CLEANUP_CHECKPOINT_COUNT" > "$CLEANUP_TRIGGER_FILE"
fi

# Silent success - don't spam output
