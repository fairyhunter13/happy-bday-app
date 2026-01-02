#!/bin/bash
# =============================================================================
# Queue Writer - Backward Compatibility Wrapper
# =============================================================================
#
# This file provides backward compatibility with the original queue-writer.sh
# interface. It sources queue-lib.sh and re-exports functions with the
# original names.
#
# USAGE (same as before):
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/queue-writer.sh"
#   queue_write "UPDATE sessions SET ..." "update_session" 5
#
# =============================================================================

# Source the main queue library
SCRIPT_DIR_WRITER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR_WRITER/queue-lib.sh" ]; then
    source "$SCRIPT_DIR_WRITER/queue-lib.sh"
else
    echo "ERROR: queue-lib.sh not found in $SCRIPT_DIR_WRITER" >&2
    exit 1
fi

# =============================================================================
# Backward Compatibility Aliases
# =============================================================================

# Original interface: queue_write SQL [operation] [priority] [metadata]
# New interface:      queue_db_write SQL [operation] [priority] [metadata]
# Both are available - queue_write is an alias for queue_db_write

# queue_write is already exported from queue-lib.sh

# =============================================================================
# Additional Convenience Wrappers (Legacy Support)
# =============================================================================

# Queue multiple SQL operations in a batch (transactional)
# Args:
#   $1: Array of SQL statements (one per line)
#   $2: operation type (optional)
#   $3: priority (optional)
# Returns: 0 on success
queue_write_batch() {
    local sql_batch="$1"
    local operation_type="${2:-batch}"
    local priority="${3:-5}"

    if [ -z "$sql_batch" ]; then
        return 1
    fi

    # Wrap in transaction
    local sql="BEGIN TRANSACTION;
${sql_batch}
COMMIT;"

    queue_db_write "$sql" "$operation_type" "$priority"
}

# Replace direct sqlite3 call with queued write
# Usage: queue_replace_sqlite3 "UPDATE sessions SET ..."
# This is a convenience function for migration
queue_replace_sqlite3() {
    local sql="$1"

    # Detect operation type from SQL
    local operation_type="generic"
    if echo "$sql" | grep -qiE "^UPDATE sessions"; then
        operation_type="update_session"
    elif echo "$sql" | grep -qiE "^UPDATE instance_sessions"; then
        operation_type="update_instance"
    elif echo "$sql" | grep -qiE "^INSERT INTO session_logs"; then
        operation_type="insert_log"
    elif echo "$sql" | grep -qiE "^INSERT"; then
        operation_type="insert"
    fi

    queue_db_write "$sql" "$operation_type" 5
}

# =============================================================================
# Worker Management (Legacy Interface)
# =============================================================================

# These functions are re-exported from queue-lib.sh for backward compatibility

# Start worker in background (non-blocking)
queue_start_worker_background() {
    queue_ensure_worker
}

# Restart worker
queue_restart_worker() {
    queue_stop_worker
    sleep 0.5
    queue_ensure_worker
}

# =============================================================================
# Status and Diagnostics (Legacy Interface)
# =============================================================================

# Get queue status (formatted output)
queue_status() {
    echo "Queue Status:"
    echo "  Directory: $QUEUE_BASE_DIR"
    echo "  Pending entries: $(queue_size)"
    echo "  Processing: $(queue_processing_count)"

    if queue_worker_is_running; then
        local worker_pid
        worker_pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)
        echo "  Worker: running (PID: $worker_pid)"
    else
        echo "  Worker: not running"
    fi

    echo ""
    echo "Statistics:"
    queue_stats_get | sed 's/^/  /'

    if [ -f "$QUEUE_WORKER_LOG" ]; then
        echo ""
        echo "Recent log entries (last 5):"
        tail -5 "$QUEUE_WORKER_LOG" 2>/dev/null | sed 's/^/  /'
    fi
}

# Wait for queue to drain (useful for testing)
queue_wait_drain() {
    local timeout="${1:-30}"
    local waited=0

    while [ "$(queue_size)" -gt 0 ] && [ "$waited" -lt "$timeout" ]; do
        sleep 0.5
        waited=$((waited + 1))
    done

    if [ "$(queue_size)" -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

# =============================================================================
# Legacy Aliases (for direct replacement)
# =============================================================================

# queue_init is now queue_init_dirs
queue_init() {
    queue_init_dirs
}

# queue_is_available remains the same

# queue_enqueue has slightly different signature in legacy:
# Old: queue_enqueue operation priority sql metadata
# New: queue_enqueue operation priority sql metadata
# Both are the same, so no change needed

# =============================================================================
# Export Functions
# =============================================================================

export -f queue_write_batch queue_replace_sqlite3
export -f queue_start_worker_background queue_restart_worker
export -f queue_status queue_wait_drain
export -f queue_init
