#!/bin/bash
# =============================================================================
# Queue Worker Daemon - Production-Ready Background Queue Processor
# =============================================================================
#
# FEATURES:
# - inotify/fswatch event-driven processing (falls back to polling)
# - Priority-based processing (lower number = higher priority)
# - Exponential backoff retry with configurable max retries
# - Orphan recovery (crash-safe)
# - Graceful shutdown (SIGTERM/SIGINT handling)
# - PID lock file management (single instance)
# - Comprehensive logging with log rotation
# - Idle timeout auto-exit (resource efficient)
#
# USAGE:
#   ./queue-worker.sh              # Start worker daemon
#   ./queue-worker.sh --foreground # Run in foreground (for debugging)
#   ./queue-worker.sh --once       # Process queue once and exit
#
# =============================================================================

set -o pipefail

# =============================================================================
# Source Dependencies
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/queue-lib.sh" ]; then
    source "$SCRIPT_DIR/queue-lib.sh"
else
    echo "ERROR: queue-lib.sh not found in $SCRIPT_DIR" >&2
    exit 1
fi

# =============================================================================
# Worker State
# =============================================================================

WORKER_RUNNING=true
WORKER_ITERATION=0
IDLE_SECONDS=0
LAST_PROCESS_TIME=$(date +%s)
USE_INOTIFY=false
INOTIFY_PID=""

# =============================================================================
# Signal Handlers
# =============================================================================

# Graceful shutdown handler
shutdown_handler() {
    queue_log "info" "Received shutdown signal, processing remaining entries..."
    WORKER_RUNNING=false

    # Kill inotify/fswatch if running
    if [ -n "$INOTIFY_PID" ] && kill -0 "$INOTIFY_PID" 2>/dev/null; then
        kill "$INOTIFY_PID" 2>/dev/null
        wait "$INOTIFY_PID" 2>/dev/null
    fi

    # Process remaining entries (up to 100)
    local remaining
    remaining=$(queue_size)
    if [ "$remaining" -gt 0 ]; then
        queue_log "info" "Draining queue: $remaining entries remaining"
        process_queue_batch 100
    fi

    # Cleanup
    rm -f "$QUEUE_WORKER_PID" 2>/dev/null

    queue_log "info" "Worker shutdown complete (processed $WORKER_ITERATION iterations)"
    exit 0
}

# Register signal handlers
trap shutdown_handler SIGTERM SIGINT SIGHUP

# Cleanup on exit (catch unexpected exits)
cleanup_on_exit() {
    rm -f "$QUEUE_WORKER_PID" 2>/dev/null

    # Kill inotify/fswatch if running
    if [ -n "$INOTIFY_PID" ] && kill -0 "$INOTIFY_PID" 2>/dev/null; then
        kill "$INOTIFY_PID" 2>/dev/null
    fi
}
trap cleanup_on_exit EXIT

# =============================================================================
# Entry Processing
# =============================================================================

# Process a single queue entry
# Args: $1=processing_file_path
# Returns: 0 on success, 1 on failure (will be retried)
process_entry() {
    local processing_file="$1"
    local json_content
    local sql
    local operation
    local priority
    local retries
    local created_at
    local age

    if [ ! -f "$processing_file" ]; then
        return 1
    fi

    # Read and parse entry
    json_content=$(queue_read_entry "$processing_file")
    if [ -z "$json_content" ]; then
        queue_log "error" "Failed to read entry: $(basename "$processing_file")"
        queue_fail_entry "$processing_file" "empty or unreadable file"
        return 1
    fi

    # Extract fields
    sql=$(json_get_field "$json_content" "sql")
    operation=$(json_get_field "$json_content" "operation")
    priority=$(json_get_field "$json_content" "priority")
    retries=$(json_get_field "$json_content" "retries")
    created_at=$(json_get_field "$json_content" "created_at")

    # Validate SQL
    if [ -z "$sql" ]; then
        queue_log "error" "Entry has no SQL: $(basename "$processing_file")"
        queue_fail_entry "$processing_file" "no SQL statement"
        return 1
    fi

    # Unescape SQL (reverse JSON escaping)
    sql=$(printf '%b' "$sql" | sed 's/\\n/\n/g; s/\\t/\t/g; s/\\"/"/g; s/\\\\/\\/g')

    # Calculate age
    local now_epoch
    now_epoch=$(date +%s)
    if [ -n "$created_at" ]; then
        # Parse ISO 8601 timestamp (simplified)
        local entry_epoch
        entry_epoch=$(date -d "$created_at" +%s 2>/dev/null || \
                      date -j -f "%Y-%m-%dT%H:%M:%SZ" "$created_at" +%s 2>/dev/null || \
                      echo "$now_epoch")
        age=$((now_epoch - entry_epoch))
    else
        age=0
    fi

    queue_log "debug" "Processing: op=$operation, priority=$priority, retries=$retries, age=${age}s"

    # Execute SQL with timeout
    local output
    local result

    output=$(sqlite3 -cmd ".timeout $SQLITE_TIMEOUT" "$HIVE_DB" "$sql" 2>&1)
    result=$?

    if [ "$result" -eq 0 ]; then
        # Success - move to completed
        queue_complete_entry "$processing_file"
        queue_log "debug" "Completed: $operation (age: ${age}s)"
        return 0
    fi

    # Check error type
    if echo "$output" | grep -qiE "database is locked|busy|SQLITE_BUSY"; then
        # Recoverable - retry
        queue_log "warn" "Database busy, will retry: $operation"
        queue_retry_entry "$processing_file"
        return 1
    else
        # Non-recoverable error
        queue_log "error" "SQL error ($operation): $output"
        queue_fail_entry "$processing_file" "$output"
        return 1
    fi
}

# Process a batch of queue entries
# Args: $1=batch_size (optional)
# Returns: number of successfully processed entries
process_queue_batch() {
    local batch_size="${1:-$QUEUE_BATCH_SIZE}"
    local processed_count=0
    local pending_files

    # Get list of pending files (sorted by priority_seq)
    pending_files=$(queue_list_pending "$batch_size")

    if [ -z "$pending_files" ]; then
        return 0
    fi

    # Process each entry
    while IFS= read -r pending_file; do
        [ -n "$pending_file" ] || continue
        [ -f "$pending_file" ] || continue

        # Claim entry (move to processing/)
        local processing_file
        processing_file=$(queue_claim_entry "$pending_file")

        if [ -z "$processing_file" ]; then
            # Another worker claimed it
            continue
        fi

        # Process entry
        if process_entry "$processing_file"; then
            processed_count=$((processed_count + 1))
        fi

        # Check if we should stop
        if ! $WORKER_RUNNING; then
            break
        fi
    done <<< "$pending_files"

    echo "$processed_count"
}

# =============================================================================
# Event-Driven Processing (inotify/fswatch)
# =============================================================================

# Check if inotifywait or fswatch is available
detect_file_watcher() {
    if command -v inotifywait >/dev/null 2>&1; then
        echo "inotifywait"
        return 0
    elif command -v fswatch >/dev/null 2>&1; then
        echo "fswatch"
        return 0
    fi
    return 1
}

# Start file watcher in background
# Writes to stdout when new files appear in pending/
start_file_watcher() {
    local watcher
    watcher=$(detect_file_watcher)

    if [ -z "$watcher" ]; then
        return 1
    fi

    case "$watcher" in
        inotifywait)
            # Linux: use inotifywait
            inotifywait -m -e create -e moved_to "$QUEUE_PENDING_DIR" 2>/dev/null &
            ;;
        fswatch)
            # macOS: use fswatch
            fswatch -0 --event Created "$QUEUE_PENDING_DIR" 2>/dev/null | while IFS= read -r -d '' file; do
                echo "CREATE $file"
            done &
            ;;
    esac

    INOTIFY_PID=$!
    return 0
}

# =============================================================================
# Worker Main Loops
# =============================================================================

# Polling-based main loop (fallback)
worker_loop_polling() {
    queue_log "info" "Using polling mode (interval: ${QUEUE_POLL_INTERVAL}s)"

    while $WORKER_RUNNING; do
        WORKER_ITERATION=$((WORKER_ITERATION + 1))

        # Periodic maintenance (every 100 iterations)
        if [ $((WORKER_ITERATION % 100)) -eq 0 ]; then
            queue_recover_orphans
            queue_cleanup_old 24
            queue_log "debug" "Maintenance completed (iteration: $WORKER_ITERATION)"
        fi

        # Check queue
        local queue_length
        queue_length=$(queue_size)

        if [ "$queue_length" -eq 0 ]; then
            # Queue empty
            IDLE_SECONDS=$((IDLE_SECONDS + 1))

            # Check idle timeout
            if [ "$QUEUE_IDLE_EXIT" -gt 0 ] && [ "$IDLE_SECONDS" -ge "$QUEUE_IDLE_EXIT" ]; then
                queue_log "info" "Idle timeout reached (${QUEUE_IDLE_EXIT}s), exiting"
                break
            fi

            sleep "$QUEUE_POLL_INTERVAL"
            continue
        fi

        # Reset idle counter
        IDLE_SECONDS=0

        # Process batch
        local processed
        processed=$(process_queue_batch)

        if [ "$processed" -gt 0 ]; then
            LAST_PROCESS_TIME=$(date +%s)

            # Log stats periodically
            if [ $((WORKER_ITERATION % 50)) -eq 0 ]; then
                local stats
                stats=$(queue_stats_get)
                queue_log "info" "Stats: $stats"
            fi
        fi

        # Brief sleep between batches
        sleep "$QUEUE_POLL_INTERVAL"
    done
}

# Event-driven main loop (with inotify/fswatch)
worker_loop_events() {
    queue_log "info" "Using event-driven mode"

    # Start file watcher
    if ! start_file_watcher; then
        queue_log "warn" "Failed to start file watcher, falling back to polling"
        worker_loop_polling
        return
    fi

    queue_log "info" "File watcher started (PID: $INOTIFY_PID)"

    # Process any existing entries first
    local existing
    existing=$(queue_size)
    if [ "$existing" -gt 0 ]; then
        queue_log "info" "Processing $existing existing entries"
        process_queue_batch 100
    fi

    # Event loop
    local poll_counter=0

    while $WORKER_RUNNING; do
        WORKER_ITERATION=$((WORKER_ITERATION + 1))
        poll_counter=$((poll_counter + 1))

        # Periodic maintenance (every 100 iterations)
        if [ $((WORKER_ITERATION % 100)) -eq 0 ]; then
            queue_recover_orphans
            queue_cleanup_old 24
        fi

        # Check if watcher is still alive
        if ! kill -0 "$INOTIFY_PID" 2>/dev/null; then
            queue_log "warn" "File watcher died, restarting..."
            if ! start_file_watcher; then
                queue_log "error" "Failed to restart file watcher, switching to polling"
                worker_loop_polling
                return
            fi
        fi

        # Check queue
        local queue_length
        queue_length=$(queue_size)

        if [ "$queue_length" -gt 0 ]; then
            IDLE_SECONDS=0
            local processed
            processed=$(process_queue_batch)

            if [ "$processed" -gt 0 ]; then
                LAST_PROCESS_TIME=$(date +%s)
            fi
        else
            IDLE_SECONDS=$((IDLE_SECONDS + 1))

            # Check idle timeout
            if [ "$QUEUE_IDLE_EXIT" -gt 0 ] && [ "$IDLE_SECONDS" -ge "$QUEUE_IDLE_EXIT" ]; then
                queue_log "info" "Idle timeout reached (${QUEUE_IDLE_EXIT}s), exiting"
                break
            fi
        fi

        # Sleep (shorter when using events)
        sleep 0.5
    done
}

# =============================================================================
# Worker Management
# =============================================================================

# Check if another worker is already running
check_already_running() {
    if [ -f "$QUEUE_WORKER_PID" ]; then
        local existing_pid
        existing_pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)

        if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
            echo "Worker already running (PID: $existing_pid)" >&2
            exit 1
        else
            # Stale PID file
            rm -f "$QUEUE_WORKER_PID"
        fi
    fi
}

# Acquire worker lock (single instance)
acquire_worker_lock() {
    # Use flock on lock file
    exec 8>"$QUEUE_LOCK_FILE" 2>/dev/null || return 1

    if ! flock -n 8 2>/dev/null; then
        queue_log "warn" "Another worker instance is running"
        exec 8>&-
        return 1
    fi

    # Write PID
    echo "$$" > "$QUEUE_WORKER_PID"
    return 0
}

# =============================================================================
# Main Entry Point
# =============================================================================

main() {
    local foreground=false
    local run_once=false

    # Parse arguments
    while [ $# -gt 0 ]; do
        case "$1" in
            --foreground|-f)
                foreground=true
                ;;
            --once|-o)
                run_once=true
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --foreground, -f  Run in foreground (for debugging)"
                echo "  --once, -o        Process queue once and exit"
                echo "  --help, -h        Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1" >&2
                exit 1
                ;;
        esac
        shift
    done

    # Check if already running
    check_already_running

    # Initialize queue directories
    if ! queue_init_dirs; then
        echo "Failed to initialize queue directories" >&2
        exit 1
    fi

    # Acquire lock
    if ! acquire_worker_lock; then
        echo "Failed to acquire worker lock (another instance running?)" >&2
        exit 1
    fi

    # Log startup
    queue_log "info" "Queue worker starting (PID: $$)"
    queue_log "info" "Config: poll_interval=${QUEUE_POLL_INTERVAL}s, batch_size=$QUEUE_BATCH_SIZE, max_retries=$QUEUE_MAX_RETRIES, idle_exit=${QUEUE_IDLE_EXIT}s"

    # Run once mode
    if $run_once; then
        queue_log "info" "Running in single-pass mode"
        queue_recover_orphans
        process_queue_batch 100
        queue_log "info" "Single-pass complete, exiting"
        rm -f "$QUEUE_WORKER_PID"
        exit 0
    fi

    # Recover any orphaned entries from previous crash
    queue_recover_orphans

    # Choose event loop
    local watcher
    watcher=$(detect_file_watcher)

    if [ -n "$watcher" ]; then
        USE_INOTIFY=true
        worker_loop_events
    else
        USE_INOTIFY=false
        worker_loop_polling
    fi

    # Cleanup
    rm -f "$QUEUE_WORKER_PID"
    queue_log "info" "Worker exiting normally"
    exit 0
}

# Run main if executed directly (not sourced)
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
