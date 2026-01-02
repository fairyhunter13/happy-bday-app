#!/bin/bash
# Session Helpers Library - Multi-Instance Session Tracking
# Shared functions for instance ID generation, session registration, and coordination
#
# Usage: source this file in other hooks
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/session-helpers.sh"

HIVE_DB="${HIVE_DB:-.hive-mind/hive.db}"
INSTANCE_DIR="${INSTANCE_DIR:-.hive-mind/instances}"

# Ensure instance directory exists
mkdir -p "$INSTANCE_DIR" 2>/dev/null

# ============================================================================
# Instance ID Generation
# ============================================================================

# Get or create stable instance ID for this Claude terminal
# Uses TTY as basis for identification (stable across hook invocations)
get_instance_id() {
    # Get TTY identifier
    local tty_raw=$(tty 2>/dev/null)
    local tty_id=""

    if [ -n "$tty_raw" ] && [ "$tty_raw" != "not a tty" ]; then
        # Convert /dev/ttys000 to ttys000
        tty_id=$(echo "$tty_raw" | sed 's|^/dev/||' | tr '/' '_')
    else
        # Fallback for non-TTY environments (CI, background processes)
        # Use a combination that's somewhat stable
        tty_id="notty_${PPID:-$$}"
    fi

    local instance_file="$INSTANCE_DIR/.instance_$tty_id"

    if [ ! -f "$instance_file" ]; then
        # Generate new instance ID with timestamp and random component
        local random_part=$(openssl rand -hex 4 2>/dev/null || echo "$$")
        local new_id="instance-$(date +%s)-$random_part"
        echo "$new_id" > "$instance_file"
    fi

    cat "$instance_file" 2>/dev/null
}

# Get the TTY identifier (for file naming)
get_tty_id() {
    local tty_raw=$(tty 2>/dev/null)

    if [ -n "$tty_raw" ] && [ "$tty_raw" != "not a tty" ]; then
        echo "$tty_raw" | sed 's|^/dev/||' | tr '/' '_'
    else
        echo "notty_${PPID:-$$}"
    fi
}

# ============================================================================
# Database Schema Management
# ============================================================================

# Ensure database schema is up to date (creates instance_sessions table if missing)
ensure_schema() {
    if [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    # Check if instance_sessions table exists
    local has_table=$(sqlite3 "$HIVE_DB" "SELECT name FROM sqlite_master
        WHERE type='table' AND name='instance_sessions';" 2>/dev/null)

    if [ -z "$has_table" ]; then
        sqlite3 "$HIVE_DB" "
            CREATE TABLE IF NOT EXISTS instance_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                instance_id TEXT NOT NULL,
                pid INTEGER,
                tty TEXT,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                checkpoint_count INTEGER DEFAULT 0,
                operation_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                FOREIGN KEY (session_id) REFERENCES sessions(id),
                UNIQUE(instance_id)
            );
            CREATE INDEX IF NOT EXISTS idx_instance_sessions_session
                ON instance_sessions(session_id);
            CREATE INDEX IF NOT EXISTS idx_instance_sessions_active
                ON instance_sessions(status);
        " 2>/dev/null
    fi
}

# ============================================================================
# Session Registration and Lookup
# ============================================================================

# Get session ID for current instance
# Returns: session ID or empty string
get_session_for_instance() {
    local instance_id="${1:-$(get_instance_id)}"

    if [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    # Priority 1: Check instance-specific session file
    local session_file="$INSTANCE_DIR/.session_$instance_id"
    if [ -f "$session_file" ]; then
        cat "$session_file" 2>/dev/null
        return 0
    fi

    # Priority 2: Query database
    ensure_schema
    local session_id=$(sqlite3 "$HIVE_DB" "SELECT session_id FROM instance_sessions
        WHERE instance_id = '$instance_id'
        AND status = 'active'
        LIMIT 1;" 2>/dev/null)

    if [ -n "$session_id" ]; then
        # Cache to file for faster lookup next time
        echo "$session_id" > "$session_file"
        echo "$session_id"
        return 0
    fi

    return 1
}

# Register instance with a session
# Usage: register_instance_session <session_id> [instance_id] [pid]
register_instance_session() {
    local session_id="$1"
    local instance_id="${2:-$(get_instance_id)}"
    # Use PPID (parent process = Claude) instead of $$ (this shell subprocess)
    # This ensures we track the actual Claude process, not hook subprocesses
    local pid="${3:-$PPID}"
    local tty_name=$(tty 2>/dev/null || echo "unknown")

    if [ -z "$session_id" ] || [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    # Ensure schema is up to date
    ensure_schema

    # Write to instance-specific session file (fast lookup)
    echo "$session_id" > "$INSTANCE_DIR/.session_$instance_id"

    # Insert or update instance registration in database
    sqlite3 "$HIVE_DB" "INSERT INTO instance_sessions
        (session_id, instance_id, pid, tty, started_at, last_seen, status)
        VALUES ('$session_id', '$instance_id', $pid, '$tty_name',
                datetime('now', 'localtime'), datetime('now', 'localtime'), 'active')
        ON CONFLICT(instance_id) DO UPDATE SET
            session_id = '$session_id',
            pid = $pid,
            last_seen = datetime('now', 'localtime'),
            status = 'active';" 2>/dev/null

    # Also update child_pids in sessions table for backward compatibility
    update_child_pids "$session_id" "$pid"

    return 0
}

# Update child_pids array in sessions table (backward compatibility)
update_child_pids() {
    local session_id="$1"
    local pid="$2"

    if [ -z "$session_id" ] || [ -z "$pid" ] || [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    local current_pids=$(sqlite3 "$HIVE_DB" "SELECT child_pids FROM sessions WHERE id = '$session_id';" 2>/dev/null)

    if [ -z "$current_pids" ] || [ "$current_pids" = "null" ]; then
        current_pids="[]"
    fi

    # Check if PID already present
    if echo "$current_pids" | grep -qE "[\[,]$pid[\],]"; then
        return 0  # Already present
    fi

    # Add PID to array
    local new_pids=$(echo "$current_pids" | sed "s/\]$/,$pid]/" | sed 's/\[,/[/')
    sqlite3 "$HIVE_DB" "UPDATE sessions SET child_pids = '$new_pids',
        updated_at = datetime('now', 'localtime') WHERE id = '$session_id';" 2>/dev/null
}

# ============================================================================
# Instance Activity Tracking
# ============================================================================

# Update last_seen timestamp and increment operation count
touch_instance() {
    local instance_id="${1:-$(get_instance_id)}"

    if [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    sqlite3 "$HIVE_DB" "UPDATE instance_sessions SET
        last_seen = datetime('now', 'localtime'),
        operation_count = operation_count + 1
        WHERE instance_id = '$instance_id';" 2>/dev/null
}

# Increment checkpoint count for instance
increment_checkpoint() {
    local instance_id="${1:-$(get_instance_id)}"

    if [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    sqlite3 "$HIVE_DB" "UPDATE instance_sessions SET
        checkpoint_count = checkpoint_count + 1,
        operation_count = operation_count + 1,
        last_seen = datetime('now', 'localtime')
        WHERE instance_id = '$instance_id';" 2>/dev/null
}

# Get instance statistics
# Returns: checkpoint_count|operation_count|started_at|last_seen
get_instance_stats() {
    local instance_id="${1:-$(get_instance_id)}"

    if [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    sqlite3 "$HIVE_DB" "SELECT checkpoint_count, operation_count,
        datetime(started_at), datetime(last_seen) FROM instance_sessions
        WHERE instance_id = '$instance_id';" 2>/dev/null
}

# ============================================================================
# Instance Lifecycle Management
# ============================================================================

# Mark instance as detached (on session stop/exit)
detach_instance() {
    local instance_id="${1:-$(get_instance_id)}"

    if [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    sqlite3 "$HIVE_DB" "UPDATE instance_sessions SET
        status = 'detached',
        last_seen = datetime('now', 'localtime')
        WHERE instance_id = '$instance_id';" 2>/dev/null

    # Remove session file but keep instance file
    rm -f "$INSTANCE_DIR/.session_$instance_id" 2>/dev/null
    rm -f "$INSTANCE_DIR/.last_checkpoint_$instance_id" 2>/dev/null
}

# Count active instances for a session
count_active_instances() {
    local session_id="$1"

    if [ -z "$session_id" ] || [ ! -f "$HIVE_DB" ]; then
        echo "0"
        return 1
    fi

    sqlite3 "$HIVE_DB" "SELECT COUNT(*) FROM instance_sessions
        WHERE session_id = '$session_id' AND status = 'active';" 2>/dev/null || echo "0"
}

# Get all active instances for a session
get_session_instances() {
    local session_id="$1"

    if [ -z "$session_id" ] || [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    sqlite3 "$HIVE_DB" "SELECT instance_id, pid, datetime(last_seen), checkpoint_count, operation_count
        FROM instance_sessions
        WHERE session_id = '$session_id' AND status = 'active'
        ORDER BY last_seen DESC;" 2>/dev/null
}

# Clean up stale instances (not seen in specified time)
# Usage: cleanup_stale_instances [hours]
cleanup_stale_instances() {
    local hours="${1:-1}"

    if [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    sqlite3 "$HIVE_DB" "UPDATE instance_sessions SET status = 'expired'
        WHERE status = 'active'
        AND datetime(last_seen) < datetime('now', '-$hours hour', 'localtime');" 2>/dev/null
}

# ============================================================================
# Checkpoint Throttling (per-instance)
# ============================================================================

# Check if enough time has passed since last checkpoint for this instance
# Returns: 0 if checkpoint is due, 1 if should skip
should_checkpoint() {
    local instance_id="${1:-$(get_instance_id)}"
    local interval="${2:-60}"  # Default 60 seconds

    local last_checkpoint_file="$INSTANCE_DIR/.last_checkpoint_$instance_id"
    local current_time=$(date +%s)
    local last_checkpoint=0

    if [ -f "$last_checkpoint_file" ]; then
        last_checkpoint=$(cat "$last_checkpoint_file" 2>/dev/null || echo "0")
    fi

    local time_since=$((current_time - last_checkpoint))

    if [ "$time_since" -ge "$interval" ]; then
        return 0  # Checkpoint is due
    else
        return 1  # Skip checkpoint
    fi
}

# Record that a checkpoint was just made
record_checkpoint_time() {
    local instance_id="${1:-$(get_instance_id)}"
    local last_checkpoint_file="$INSTANCE_DIR/.last_checkpoint_$instance_id"

    echo "$(date +%s)" > "$last_checkpoint_file"
}

# ============================================================================
# Utility Functions
# ============================================================================

# Check if hive database exists and is accessible
is_hive_db_available() {
    [ -f "$HIVE_DB" ] && sqlite3 "$HIVE_DB" "SELECT 1;" >/dev/null 2>&1
}

# Log message to session logs table
log_session_event() {
    local session_id="$1"
    local level="${2:-info}"
    local message="$3"
    local data="${4:-{}}"

    if [ -z "$session_id" ] || [ ! -f "$HIVE_DB" ]; then
        return 1
    fi

    sqlite3 "$HIVE_DB" "INSERT INTO session_logs (session_id, log_level, message, data)
        VALUES ('$session_id', '$level', '$message', '$data');" 2>/dev/null
}
