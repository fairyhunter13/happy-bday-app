#!/bin/bash
# Queue Minimal - Absolute Minimum Overhead Queue Write
#
# This is the fastest possible queue write implementation:
# - Single file write operation
# - No worker management (assumes worker is already running or will be started separately)
# - No timestamp generation (uses static counter)
# - No initialization check (assumes directory exists)
#
# IMPORTANT: Call queue_minimal_init ONCE at session start
# Then use queue_minimal for all writes
#
# Usage:
#   source queue-minimal.sh
#   queue_minimal_init  # Call once
#   queue_minimal "UPDATE sessions SET ..." 5  # Call many times

# ============================================================================
# Configuration (modify before sourcing if needed)
# ============================================================================

: "${QUEUE_MINIMAL_DIR:=.hive-mind/queue/pending}"

# ============================================================================
# State (reset per source)
# ============================================================================

_QM_COUNTER=0
_QM_PID=$$
_QM_INITIALIZED=""

# ============================================================================
# One-time Initialization
# ============================================================================

# Call this ONCE per session (e.g., in session-start hook)
queue_minimal_init() {
    mkdir -p "$QUEUE_MINIMAL_DIR" 2>/dev/null
    _QM_INITIALIZED="1"
}

# ============================================================================
# Core Queue Write - MINIMAL VERSION
# ============================================================================

# Queue SQL statement with minimal overhead
# Args: $1 = SQL, $2 = priority (optional, default 5)
#
# This function does ONLY:
#   1. Increment counter (bash arithmetic)
#   2. Write file (single syscall)
#
# NO: timestamp, worker check, locking, stats, validation
#
queue_minimal() {
    _QM_COUNTER=$((_QM_COUNTER + 1))
    printf '%s\n' "$1" > "$QUEUE_MINIMAL_DIR/${2:-5}.$_QM_PID.$_QM_COUNTER.msg"
}

# Slightly safer version that checks initialization
queue_minimal_safe() {
    [ -z "$_QM_INITIALIZED" ] && queue_minimal_init
    queue_minimal "$@"
}

# ============================================================================
# Batch Write (for multiple statements)
# ============================================================================

# Write multiple SQL statements as a single file
# Usage: queue_minimal_batch priority sql1 sql2 sql3 ...
queue_minimal_batch() {
    local priority="${1:-5}"
    shift
    _QM_COUNTER=$((_QM_COUNTER + 1))

    {
        echo "BEGIN TRANSACTION;"
        for sql in "$@"; do
            echo "$sql"
        done
        echo "COMMIT;"
    } > "$QUEUE_MINIMAL_DIR/${priority}.$_QM_PID.$_QM_COUNTER.msg"
}

# ============================================================================
# Worker Starter (call separately, not in hot path)
# ============================================================================

# Start worker if not running - DO NOT call in hot path!
queue_minimal_start_worker() {
    local script_dir="${BASH_SOURCE[0]%/*}"
    local worker="$script_dir/queue-worker-optimized.sh"
    [ ! -f "$worker" ] && worker="$script_dir/queue-worker.sh"
    [ -f "$worker" ] && nohup "$worker" </dev/null >/dev/null 2>&1 &
}

# Check if worker is running
queue_minimal_worker_running() {
    local pid_file=".hive-mind/queue/worker.pid"
    [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file" 2>/dev/null)" 2>/dev/null
}

# ============================================================================
# Exports
# ============================================================================

export -f queue_minimal queue_minimal_safe queue_minimal_init
export -f queue_minimal_batch queue_minimal_start_worker queue_minimal_worker_running
