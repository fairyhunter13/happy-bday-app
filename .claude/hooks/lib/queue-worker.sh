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

# Heartbeat configuration (for autostart health monitoring)
HEARTBEAT_FILE="$QUEUE_BASE_DIR/.heartbeat"
HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-5}"
LAST_HEARTBEAT=0

# Event loop configuration
USE_EVENT_LOOP="${USE_EVENT_LOOP:-true}"           # Enable true event loop (vs polling)
EVENT_READ_TIMEOUT="${EVENT_READ_TIMEOUT:-5}"      # Timeout for blocking read (seconds)
EVENT_PIPE=""                                       # Named pipe for event IPC
EVENTS_PROCESSED=0                                  # Counter for events processed
WATCHER_RESTART_COUNT=0                             # Number of watcher restarts
MAX_WATCHER_RESTARTS=3                              # Max restarts before fallback
LAST_ORPHAN_CHECK=0                                 # Timestamp of last orphan recovery
LAST_CLEANUP=0                                      # Timestamp of last cleanup

# =============================================================================
# Event Pipe Management (for True Event Loop)
# =============================================================================

# Create named pipe for event IPC
# Returns: 0 on success, 1 on failure
create_event_pipe() {
    EVENT_PIPE="$QUEUE_BASE_DIR/.event_pipe_$$"

    # Remove stale pipe if exists
    [ -p "$EVENT_PIPE" ] && rm -f "$EVENT_PIPE" 2>/dev/null

    # Create new named pipe
    if mkfifo "$EVENT_PIPE" 2>/dev/null; then
        queue_log "info" "Created event pipe: $EVENT_PIPE"
        return 0
    else
        queue_log "error" "Failed to create event pipe: $EVENT_PIPE"
        EVENT_PIPE=""
        return 1
    fi
}

# Cleanup event pipe
cleanup_event_pipe() {
    if [ -n "$EVENT_PIPE" ] && [ -p "$EVENT_PIPE" ]; then
        rm -f "$EVENT_PIPE" 2>/dev/null
        queue_log "info" "Cleaned up event pipe"
    fi
    EVENT_PIPE=""
}

# Send event signal to pipe (for testing or manual triggers)
trigger_event() {
    if [ -n "$EVENT_PIPE" ] && [ -p "$EVENT_PIPE" ]; then
        echo "EVENT" > "$EVENT_PIPE" 2>/dev/null &
    fi
}

# =============================================================================
# Heartbeat Function (Enhanced for Event Loop)
# =============================================================================

# Update heartbeat file with current timestamp and metrics
# This allows the autostart system to detect stuck workers
worker_update_heartbeat() {
    local now
    now=$(date +%s)

    # Only update if enough time has passed
    if [ $((now - LAST_HEARTBEAT)) -ge "$HEARTBEAT_INTERVAL" ]; then
        # Enhanced heartbeat with event loop metrics
        if [ "$USE_EVENT_LOOP" = "true" ] && [ -n "$EVENT_PIPE" ]; then
            local watcher_alive="false"
            if [ -n "$INOTIFY_PID" ] && kill -0 "$INOTIFY_PID" 2>/dev/null; then
                watcher_alive="true"
            fi

            # Write JSON heartbeat
            cat > "$HEARTBEAT_FILE" 2>/dev/null <<EOF
{
  "timestamp": $now,
  "pid": $$,
  "mode": "event-loop",
  "iteration": $WORKER_ITERATION,
  "events_processed": $EVENTS_PROCESSED,
  "last_event_time": $LAST_PROCESS_TIME,
  "idle_seconds": $IDLE_SECONDS,
  "queue_size": $(queue_size),
  "processing_count": $(queue_processing_count),
  "watcher_pid": ${INOTIFY_PID:-0},
  "watcher_alive": $watcher_alive,
  "watcher_restarts": $WATCHER_RESTART_COUNT
}
EOF
        else
            # Simple timestamp for polling mode
            echo "$now" > "$HEARTBEAT_FILE" 2>/dev/null
        fi

        LAST_HEARTBEAT=$now
    fi
}

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
    cleanup_event_pipe
    rm -f "$QUEUE_WORKER_PID" 2>/dev/null
    rm -f "$HEARTBEAT_FILE" 2>/dev/null

    queue_log "info" "Worker shutdown complete (processed $WORKER_ITERATION iterations, events: $EVENTS_PROCESSED)"
    exit 0
}

# Register signal handlers
trap shutdown_handler SIGTERM SIGINT SIGHUP

# Cleanup on exit (catch unexpected exits)
cleanup_on_exit() {
    cleanup_event_pipe
    rm -f "$QUEUE_WORKER_PID" 2>/dev/null
    rm -f "$HEARTBEAT_FILE" 2>/dev/null

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
# Writes events to named pipe (if USE_EVENT_LOOP=true) or stdout (legacy)
start_file_watcher() {
    local watcher
    watcher=$(detect_file_watcher)

    if [ -z "$watcher" ]; then
        return 1
    fi

    # Determine output destination
    local output_dest
    if [ "$USE_EVENT_LOOP" = "true" ] && [ -n "$EVENT_PIPE" ] && [ -p "$EVENT_PIPE" ]; then
        output_dest="$EVENT_PIPE"
        queue_log "info" "File watcher will write events to: $EVENT_PIPE"
    else
        output_dest="/dev/null"  # Legacy mode: events not consumed
    fi

    case "$watcher" in
        inotifywait)
            # Linux: use inotifywait
            # Output simple "EVENT" signal for each file creation
            inotifywait -m -q -e create -e moved_to --format "EVENT" "$QUEUE_PENDING_DIR" 2>/dev/null > "$output_dest" &
            ;;
        fswatch)
            # macOS: use fswatch
            # Convert fswatch output to simple "EVENT" signals
            fswatch -0 -r --event Created "$QUEUE_PENDING_DIR" 2>/dev/null | \
                while IFS= read -r -d $'\0' path; do
                    echo "EVENT"
                done > "$output_dest" &
            ;;
    esac

    INOTIFY_PID=$!
    queue_log "info" "File watcher started (PID: $INOTIFY_PID, type: $watcher)"
    return 0
}

# =============================================================================
# Maintenance Task Handler
# =============================================================================

# Handle periodic maintenance tasks (orphan recovery, cleanup, etc.)
# Called on timeout when no events are received
handle_maintenance_tasks() {
    local now
    now=$(date +%s)

    # Orphan recovery (every 60 seconds)
    if [ $((now - LAST_ORPHAN_CHECK)) -ge 60 ]; then
        queue_recover_orphans
        LAST_ORPHAN_CHECK=$now
        queue_log "debug" "Orphan recovery completed"
    fi

    # Cleanup old entries (every 5 minutes = 300 seconds)
    if [ $((now - LAST_CLEANUP)) -ge 300 ]; then
        queue_cleanup_old 24
        LAST_CLEANUP=$now
        queue_log "debug" "Cleanup completed"
    fi

    # Update heartbeat
    worker_update_heartbeat

    # Check idle timeout
    if [ "$QUEUE_IDLE_EXIT" -gt 0 ] && [ "$IDLE_SECONDS" -ge "$QUEUE_IDLE_EXIT" ]; then
        queue_log "info" "Idle timeout reached (${QUEUE_IDLE_EXIT}s), exiting"
        WORKER_RUNNING=false
    fi
}

# Restart file watcher if it died
# Returns: 0 if watcher restarted or running, 1 if max restarts reached
restart_file_watcher() {
    # Check if watcher is alive
    if [ -n "$INOTIFY_PID" ] && kill -0 "$INOTIFY_PID" 2>/dev/null; then
        return 0  # Still running
    fi

    # Watcher is dead, try to restart
    WATCHER_RESTART_COUNT=$((WATCHER_RESTART_COUNT + 1))

    if [ "$WATCHER_RESTART_COUNT" -gt "$MAX_WATCHER_RESTARTS" ]; then
        queue_log "error" "File watcher failed $WATCHER_RESTART_COUNT times, giving up"
        return 1
    fi

    queue_log "warn" "File watcher died (restart attempt $WATCHER_RESTART_COUNT/$MAX_WATCHER_RESTARTS)"

    # Wait a bit before restart
    sleep 1

    # Try to restart
    if start_file_watcher; then
        queue_log "info" "File watcher restarted successfully (PID: $INOTIFY_PID)"
        return 0
    else
        queue_log "error" "Failed to restart file watcher"
        return 1
    fi
}

# =============================================================================
# Worker Main Loops
# =============================================================================

# True event-driven loop with blocking reads on named pipe
worker_loop_event_driven() {
    queue_log "info" "Using TRUE event-driven mode (blocking reads on pipe)"

    # Create event pipe
    if ! create_event_pipe; then
        queue_log "warn" "Failed to create event pipe, falling back to polling"
        worker_loop_polling
        return
    fi

    # Start file watcher
    if ! start_file_watcher; then
        queue_log "warn" "Failed to start file watcher, falling back to polling"
        cleanup_event_pipe
        worker_loop_polling
        return
    fi

    # Initialize timestamps
    LAST_ORPHAN_CHECK=$(date +%s)
    LAST_CLEANUP=$(date +%s)

    # Initial heartbeat
    worker_update_heartbeat

    # Process any existing entries first
    local existing
    existing=$(queue_size)
    if [ "$existing" -gt 0 ]; then
        queue_log "info" "Processing $existing existing entries before event loop"
        process_queue_batch 100
    fi

    queue_log "info" "Event loop started (timeout: ${EVENT_READ_TIMEOUT}s)"

    # Event loop - BLOCKS on reading from pipe
    local event
    while $WORKER_RUNNING; do
        WORKER_ITERATION=$((WORKER_ITERATION + 1))

        # BLOCKING READ with timeout
        # This is the key difference from polling - the process sleeps here
        # until an event arrives or timeout expires
        if read -t "$EVENT_READ_TIMEOUT" event < "$EVENT_PIPE" 2>/dev/null; then
            # ✅ EVENT RECEIVED! Process immediately
            EVENTS_PROCESSED=$((EVENTS_PROCESSED + 1))
            IDLE_SECONDS=0

            queue_log "debug" "Event #$EVENTS_PROCESSED received, processing queue"

            # Process queue batch
            local processed
            processed=$(process_queue_batch)

            if [ "$processed" -gt 0 ]; then
                LAST_PROCESS_TIME=$(date +%s)
                queue_log "debug" "Processed $processed entries"
            fi

            # Update heartbeat after processing
            worker_update_heartbeat

        else
            # TIMEOUT (no events for EVENT_READ_TIMEOUT seconds)
            # This is NOT an error - it's expected for maintenance
            IDLE_SECONDS=$((IDLE_SECONDS + EVENT_READ_TIMEOUT))

            queue_log "debug" "Event loop timeout (idle: ${IDLE_SECONDS}s)"

            # Run maintenance tasks
            handle_maintenance_tasks

            # Check if watcher is still alive, restart if needed
            if ! restart_file_watcher; then
                # Max restarts reached, fallback to polling
                queue_log "warn" "File watcher unstable, falling back to polling"
                cleanup_event_pipe
                worker_loop_polling
                return
            fi
        fi

        # Check for broken pipe (worker restart scenario)
        if [ ! -p "$EVENT_PIPE" ]; then
            queue_log "error" "Event pipe disappeared, recreating..."

            # Try to recreate pipe and watcher
            if create_event_pipe && start_file_watcher; then
                queue_log "info" "Event pipe and watcher recreated"
            else
                queue_log "error" "Failed to recreate event infrastructure, falling back to polling"
                worker_loop_polling
                return
            fi
        fi
    done

    queue_log "info" "Event loop exiting normally"
}

# Polling-based main loop (fallback)
worker_loop_polling() {
    queue_log "info" "Using polling mode (interval: ${QUEUE_POLL_INTERVAL}s)"

    # Initial heartbeat
    worker_update_heartbeat

    while $WORKER_RUNNING; do
        WORKER_ITERATION=$((WORKER_ITERATION + 1))

        # Update heartbeat (allows autostart to detect stuck workers)
        worker_update_heartbeat

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

# Legacy "event-driven" loop (actually still polling, kept for compatibility)
# This function is DEPRECATED and will be removed in a future version
# Use worker_loop_event_driven() for true event-driven processing
worker_loop_events_legacy() {
    queue_log "warn" "Using LEGACY event mode (still polling, not true event loop)"

    # Initial heartbeat
    worker_update_heartbeat

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

        # Update heartbeat (allows autostart to detect stuck workers)
        worker_update_heartbeat

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
    queue_log "info" "Config: event_loop=$USE_EVENT_LOOP, poll_interval=${QUEUE_POLL_INTERVAL}s, batch_size=$QUEUE_BATCH_SIZE, max_retries=$QUEUE_MAX_RETRIES, idle_exit=${QUEUE_IDLE_EXIT}s"

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

    # Choose worker loop mode
    if [ "$USE_EVENT_LOOP" = "true" ]; then
        # TRUE EVENT LOOP MODE (blocking reads on named pipe)
        local watcher
        watcher=$(detect_file_watcher)

        if [ -n "$watcher" ]; then
            queue_log "info" "Event loop mode: TRUE event-driven (watcher: $watcher)"
            worker_loop_event_driven
        else
            queue_log "warn" "Event loop mode: No file watcher available (fswatch/inotify not found)"
            queue_log "warn" "Falling back to polling mode"
            worker_loop_polling
        fi
    else
        # POLLING MODE (legacy, but reliable)
        queue_log "info" "Event loop mode: Disabled (using polling)"
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
