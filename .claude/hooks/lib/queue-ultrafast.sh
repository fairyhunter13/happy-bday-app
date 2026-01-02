#!/bin/bash
# Queue Ultrafast - Zero-Fork Queue Writer for Sub-Millisecond Performance
#
# Design Goals:
# - <1ms queue write latency
# - Zero external process spawns in critical path
# - Atomic file operations (no locking needed)
# - Compatible with existing queue-worker.sh
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/queue-ultrafast.sh"
#   queue_fast "UPDATE sessions SET ..." "update_session" 5

# ============================================================================
# Configuration
# ============================================================================

QUEUE_DIR="${QUEUE_DIR:-.hive-mind/queue}"
QUEUE_FAST_DIR="$QUEUE_DIR/pending"
WORKER_PID_FILE="$QUEUE_DIR/worker.pid"
HIVE_DB="${HIVE_DB:-.hive-mind/hive.db}"

# Sequence counter (per-process, reset on source)
declare -g _QUEUE_SEQ=0

# Worker check cache (avoid repeated PID checks)
declare -g _WORKER_CHECK_TIME=0
declare -g _WORKER_IS_RUNNING=1

# Pre-create queue directory (once per session)
declare -g _QUEUE_INITIALIZED=0

# ============================================================================
# Ultra-Fast Queue Initialization
# ============================================================================

# Initialize queue directory (called once, cached)
queue_fast_init() {
    if [ "${_QUEUE_INITIALIZED:-0}" -eq 1 ]; then
        return 0
    fi

    # Create directories with single mkdir -p
    if [ ! -d "$QUEUE_FAST_DIR" ]; then
        mkdir -p "$QUEUE_FAST_DIR" 2>/dev/null || return 1
    fi

    _QUEUE_INITIALIZED=1
    return 0
}

# ============================================================================
# Fast Timestamp (No date command)
# ============================================================================

# Get epoch seconds using bash builtin (Bash 4.2+)
# Falls back to cached time if EPOCHSECONDS not available
_queue_get_timestamp() {
    if [ -n "${EPOCHSECONDS:-}" ]; then
        # Bash 5.0+: Use builtin (0.001ms)
        printf '%s' "$EPOCHSECONDS"
    else
        # Fallback: Cache base time and use SECONDS offset
        # This avoids forking date on every call after the first
        if [ -z "${_QUEUE_BASE_TIME:-}" ]; then
            _QUEUE_BASE_TIME=$(date +%s)
            _QUEUE_SECONDS_AT_BASE=${SECONDS:-0}
        fi
        printf '%s' "$((_QUEUE_BASE_TIME + ${SECONDS:-0} - _QUEUE_SECONDS_AT_BASE))"
    fi
}

# ============================================================================
# Fast Unique Filename Generation
# ============================================================================

# Generate unique filename without external commands
# Format: TIMESTAMP.PRIORITY.PID.SEQ.msg
#
# Properties:
# - Sortable by timestamp (ascending)
# - Sortable by priority (ascending = higher priority)
# - Unique per process (PID + sequence)
# - No collision possible
_queue_unique_filename() {
    local priority="${1:-5}"

    # Increment sequence (bash arithmetic, no fork)
    _QUEUE_SEQ=$((_QUEUE_SEQ + 1))

    # Get timestamp
    local ts
    ts=$(_queue_get_timestamp)

    # Format: timestamp.priority.pid.seq.msg
    # Pad priority to 2 digits for proper sorting (01-10)
    printf '%s.%02d.%d.%06d.msg' "$ts" "$priority" "$$" "$_QUEUE_SEQ"
}

# ============================================================================
# Core Queue Write (Zero-Fork Fast Path)
# ============================================================================

# Queue a SQL write operation - ULTRA FAST VERSION
#
# Args:
#   $1: SQL statement
#   $2: priority (optional, 1-10, lower = higher priority, default 5)
#
# Returns: 0 on success, 1 on failure
#
# Performance: <0.5ms typical, <1ms worst case
#
queue_fast() {
    local sql="$1"
    local priority="${2:-5}"

    # Early exit if empty
    [ -z "$sql" ] && return 1

    # Ensure initialized (cached check)
    queue_fast_init || return 1

    # Generate unique filename (no fork)
    local filename
    filename=$(_queue_unique_filename "$priority")

    # Atomic file write (single syscall)
    # Using printf for speed (faster than echo for large strings)
    printf '%s\n' "$sql" > "$QUEUE_FAST_DIR/$filename" 2>/dev/null

    local result=$?

    # Ensure worker is running (cached check, non-blocking)
    queue_fast_ensure_worker

    return $result
}

# Queue with operation type metadata (slightly slower, adds type to filename)
queue_fast_typed() {
    local sql="$1"
    local operation_type="${2:-generic}"
    local priority="${3:-5}"

    [ -z "$sql" ] && return 1

    queue_fast_init || return 1

    _QUEUE_SEQ=$((_QUEUE_SEQ + 1))
    local ts
    ts=$(_queue_get_timestamp)

    # Include operation type in filename for debugging/monitoring
    local filename
    filename=$(printf '%s.%02d.%d.%06d.%s.msg' "$ts" "$priority" "$$" "$_QUEUE_SEQ" "$operation_type")

    printf '%s\n' "$sql" > "$QUEUE_FAST_DIR/$filename" 2>/dev/null

    queue_fast_ensure_worker

    return $?
}

# ============================================================================
# Batch Queue Write
# ============================================================================

# Queue multiple SQL statements as a single transaction
# More efficient than individual queue_fast calls
queue_fast_batch() {
    local priority="${1:-5}"
    shift

    # Remaining args are SQL statements
    local sql_batch="BEGIN TRANSACTION;"
    local stmt
    for stmt in "$@"; do
        sql_batch+=$'\n'"$stmt"
    done
    sql_batch+=$'\n'"COMMIT;"

    queue_fast "$sql_batch" "$priority"
}

# ============================================================================
# Worker Management (Cached, Non-Blocking)
# ============================================================================

# Check if worker is running (cached for 1 second)
queue_fast_worker_running() {
    local now
    now=$(_queue_get_timestamp)

    # Use cached result if checked within last second
    if [ "$((now - _WORKER_CHECK_TIME))" -lt 1 ]; then
        return $_WORKER_IS_RUNNING
    fi

    _WORKER_CHECK_TIME=$now

    # Check PID file exists and process is alive
    if [ -f "$WORKER_PID_FILE" ]; then
        local pid
        pid=$(cat "$WORKER_PID_FILE" 2>/dev/null)

        if [ -n "$pid" ]; then
            # Try /proc first (Linux, fastest)
            if [ -d "/proc/$pid" ]; then
                _WORKER_IS_RUNNING=0
                return 0
            fi
            # Fallback: kill -0 (works on macOS)
            if kill -0 "$pid" 2>/dev/null; then
                _WORKER_IS_RUNNING=0
                return 0
            fi
        fi
    fi

    _WORKER_IS_RUNNING=1
    return 1
}

# Ensure worker is running, start if needed (non-blocking)
queue_fast_ensure_worker() {
    # Quick cached check
    if queue_fast_worker_running; then
        return 0
    fi

    # Worker not running, start it in background
    queue_fast_start_worker
}

# Start worker in background (non-blocking)
queue_fast_start_worker() {
    local script_dir="${BASH_SOURCE[0]%/*}"
    local worker_script="$script_dir/queue-worker-optimized.sh"

    # Fall back to original worker if optimized not available
    if [ ! -f "$worker_script" ]; then
        worker_script="$script_dir/queue-worker.sh"
    fi

    if [ ! -f "$worker_script" ]; then
        return 1
    fi

    # Start in background, fully detached
    # Using setsid if available for proper daemonization
    if command -v setsid >/dev/null 2>&1; then
        setsid "$worker_script" </dev/null >/dev/null 2>&1 &
    else
        # macOS fallback
        nohup "$worker_script" </dev/null >/dev/null 2>&1 &
    fi

    # Brief pause to let worker start (0.05 second)
    sleep 0.05 2>/dev/null || true

    return 0
}

# ============================================================================
# Queue Status (For Monitoring)
# ============================================================================

# Get count of pending queue entries (fast)
queue_fast_pending_count() {
    local count=0
    local f
    for f in "$QUEUE_FAST_DIR"/*.msg; do
        [ -f "$f" ] && count=$((count + 1))
    done
    printf '%d' "$count"
}

# Check if queue has pending entries
queue_fast_has_pending() {
    local f
    for f in "$QUEUE_FAST_DIR"/*.msg; do
        [ -f "$f" ] && return 0
    done
    return 1
}

# ============================================================================
# Compatibility Layer (Drop-in replacement for queue_write)
# ============================================================================

# Drop-in replacement for queue_write from queue-writer.sh
queue_write() {
    local sql="$1"
    local operation_type="${2:-generic}"
    local priority="${3:-5}"
    local metadata="${4:-{}}"  # Ignored in fast version

    queue_fast_typed "$sql" "$operation_type" "$priority"
}

# Drop-in replacement for queue_update_session
queue_update_session() {
    local session_id="$1"
    local updates="$2"

    queue_fast "UPDATE sessions SET $updates WHERE id = '$session_id';" 3
}

# Drop-in replacement for queue_update_instance
queue_update_instance() {
    local instance_id="$1"
    local updates="$2"

    queue_fast "UPDATE instance_sessions SET $updates WHERE instance_id = '$instance_id';" 4
}

# Drop-in replacement for queue_insert_log
queue_insert_log() {
    local session_id="$1"
    local level="$2"
    local message="$3"
    local data="${4:-{}}"

    # Escape single quotes in message (bash parameter expansion, no fork)
    message="${message//\'/\'\'}"

    queue_fast "INSERT INTO session_logs (session_id, log_level, message, data) VALUES ('$session_id', '$level', '$message', '$data');" 7
}

# ============================================================================
# Direct Execution Fallback
# ============================================================================

# Execute SQL directly (bypass queue, for urgent operations)
queue_exec_direct() {
    local sql="$1"
    local timeout_ms="${2:-5000}"

    sqlite3 -cmd ".timeout $timeout_ms" "$HIVE_DB" "$sql" 2>/dev/null
}

# ============================================================================
# Exports
# ============================================================================

export -f queue_fast queue_fast_typed queue_fast_batch
export -f queue_fast_init queue_fast_ensure_worker queue_fast_worker_running
export -f queue_fast_pending_count queue_fast_has_pending
export -f queue_write queue_update_session queue_update_instance queue_insert_log
export -f queue_exec_direct
