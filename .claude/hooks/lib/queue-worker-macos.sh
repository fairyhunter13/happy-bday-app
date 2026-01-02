#!/bin/bash
# =============================================================================
# Queue Worker - macOS Compatible (mkdir-based locking)
# =============================================================================
# This is a simplified worker for macOS that uses mkdir instead of flock
# =============================================================================

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source queue library
if [ -f "$SCRIPT_DIR/queue-lib.sh" ]; then
    source "$SCRIPT_DIR/queue-lib.sh"
else
    echo "ERROR: queue-lib.sh not found" >&2
    exit 1
fi

# Worker state
WORKER_RUNNING=true
LOCK_DIR="$QUEUE_BASE_DIR/.worker.lock"

# Cleanup on exit
cleanup() {
    WORKER_RUNNING=false
    rm -rf "$LOCK_DIR" 2>/dev/null
    rm -f "$QUEUE_WORKER_PID" 2>/dev/null
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Worker stopped" >> "$QUEUE_WORKER_LOG"
}
trap cleanup EXIT SIGTERM SIGINT

# Acquire lock using mkdir (atomic on macOS)
acquire_lock() {
    if mkdir "$LOCK_DIR" 2>/dev/null; then
        echo $$ > "$LOCK_DIR/pid"
        echo $$ > "$QUEUE_WORKER_PID"
        return 0
    else
        # Check if lock is stale
        if [ -f "$LOCK_DIR/pid" ]; then
            local pid=$(cat "$LOCK_DIR/pid" 2>/dev/null)
            if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
                # Stale lock, remove it
                rm -rf "$LOCK_DIR"
                mkdir "$LOCK_DIR" 2>/dev/null && echo $$ > "$LOCK_DIR/pid" && return 0
            fi
        fi
        echo "Another worker is running" >&2
        return 1
    fi
}

# Process single entry
process_entry() {
    local pending_file="$1"
    local processing_file="$QUEUE_PROCESSING_DIR/$(basename "$pending_file")"

    # Atomic claim
    if ! mv "$pending_file" "$processing_file" 2>/dev/null; then
        return 1  # Another worker claimed it
    fi

    # Read entry
    local json=$(cat "$processing_file" 2>/dev/null)
    local sql=$(echo "$json" | grep -o '"sql":"[^"]*"' | sed 's/"sql":"//;s/"$//' | sed 's/\\"/"/g')

    if [ -z "$sql" ]; then
        mv "$processing_file" "$QUEUE_FAILED_DIR/$(basename "$processing_file")"
        return 1
    fi

    # Execute SQL
    if sqlite3 -cmd ".timeout $SQLITE_TIMEOUT" "$HIVE_DB" "$sql" 2>/dev/null; then
        mv "$processing_file" "$QUEUE_COMPLETED_DIR/$(basename "$processing_file")"
        return 0
    else
        # Retry logic
        local retries=$(echo "$json" | grep -o '"retries":[0-9]*' | cut -d':' -f2)
        retries=${retries:-0}

        if [ "$retries" -lt "$QUEUE_MAX_RETRIES" ]; then
            # Increment retry count
            retries=$((retries + 1))
            echo "$json" | sed "s/\"retries\":[0-9]*/\"retries\":$retries/" > "$pending_file"
            rm -f "$processing_file"
        else
            mv "$processing_file" "$QUEUE_FAILED_DIR/$(basename "$processing_file")"
        fi
        return 1
    fi
}

# Main worker loop
worker_loop() {
    local idle_count=0
    local max_idle=30  # 30 iterations * 0.1s = 3 seconds of idle before exit

    while $WORKER_RUNNING; do
        local processed=0

        # Process pending entries (sorted by priority)
        for file in "$QUEUE_PENDING_DIR"/*.json; do
            [ -f "$file" ] || continue

            if process_entry "$file"; then
                processed=$((processed + 1))
                idle_count=0
            fi

            # Process up to batch size
            [ "$processed" -ge "$QUEUE_BATCH_SIZE" ] && break
        done

        # Check for idle timeout
        if [ "$processed" -eq 0 ]; then
            idle_count=$((idle_count + 1))
            if [ "$idle_count" -ge "$max_idle" ]; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] No work for ${max_idle} iterations, exiting" >> "$QUEUE_WORKER_LOG"
                break
            fi
        fi

        # Poll interval
        sleep "${QUEUE_POLL_INTERVAL:-0.1}"
    done
}

# Main
main() {
    # Try to acquire lock
    if ! acquire_lock; then
        exit 1
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Worker started (PID: $$)" >> "$QUEUE_WORKER_LOG"

    # Run worker loop
    worker_loop

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Worker finished" >> "$QUEUE_WORKER_LOG"
}

main "$@"
