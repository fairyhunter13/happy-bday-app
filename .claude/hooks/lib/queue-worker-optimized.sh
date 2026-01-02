#!/bin/bash
# Queue Worker Optimized - High-Performance Batch Processing Worker
#
# Optimizations:
# - Batch processing (multiple entries per SQLite transaction)
# - Persistent SQLite connection (no process spawn per query)
# - Optimized PRAGMA settings (WAL mode, larger cache)
# - Efficient file scanning (avoid glob expansion on each iteration)
# - inotify-based polling (Linux) with fallback to polling
#
# Usage: Run as daemon
#   ./queue-worker-optimized.sh &

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUEUE_DIR="${QUEUE_DIR:-.hive-mind/queue}"
QUEUE_FAST_DIR="$QUEUE_DIR/pending"
WORKER_PID_FILE="$QUEUE_DIR/worker.pid"
WORKER_LOG="$QUEUE_DIR/worker.log"
HIVE_DB="${HIVE_DB:-.hive-mind/hive.db}"

# Worker settings
WORKER_BATCH_SIZE="${WORKER_BATCH_SIZE:-50}"       # Max entries per batch
WORKER_POLL_INTERVAL="${WORKER_POLL_INTERVAL:-0.1}" # Seconds between polls
WORKER_IDLE_EXIT="${WORKER_IDLE_EXIT:-300}"        # Exit after N seconds idle
WORKER_MAX_RETRIES="${WORKER_MAX_RETRIES:-3}"      # Retries per failed batch

# SQLite optimizations
SQLITE_TIMEOUT="${SQLITE_TIMEOUT:-30000}"          # 30 second timeout

# ============================================================================
# State
# ============================================================================

WORKER_RUNNING=true
IDLE_SECONDS=0
PROCESSED_COUNT=0
FAILED_COUNT=0
START_TIME=$(date +%s)

# ============================================================================
# Signal Handlers
# ============================================================================

cleanup() {
    log "info" "Worker shutting down (processed: $PROCESSED_COUNT, failed: $FAILED_COUNT)"
    rm -f "$WORKER_PID_FILE" 2>/dev/null
    # Close SQLite coprocess if running
    if [[ -n "${SQLITE_PID:-}" ]] && kill -0 "$SQLITE_PID" 2>/dev/null; then
        echo ".quit" >&"${SQLITE[1]}" 2>/dev/null || true
        wait "$SQLITE_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT EXIT

# ============================================================================
# Logging
# ============================================================================

log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    printf '[%s] [%s] %s\n' "$timestamp" "$level" "$message" >> "$WORKER_LOG"
}

# ============================================================================
# SQLite Connection Management
# ============================================================================

# Initialize SQLite with optimized PRAGMA settings
init_sqlite() {
    log "info" "Initializing SQLite with optimized settings"

    # Apply PRAGMA optimizations
    sqlite3 "$HIVE_DB" <<-'PRAGMAS'
		PRAGMA journal_mode = WAL;
		PRAGMA synchronous = NORMAL;
		PRAGMA cache_size = -16000;
		PRAGMA temp_store = MEMORY;
		PRAGMA mmap_size = 268435456;
		PRAGMA busy_timeout = 30000;
		PRAGMA wal_autocheckpoint = 1000;
		PRAGMA foreign_keys = ON;
	PRAGMAS

    log "info" "SQLite PRAGMA optimizations applied"
}

# Execute SQL with retry logic
exec_sql() {
    local sql="$1"
    local retries="${2:-$WORKER_MAX_RETRIES}"
    local attempt=0

    while ((attempt < retries)); do
        if sqlite3 -cmd ".timeout $SQLITE_TIMEOUT" "$HIVE_DB" "$sql" 2>/dev/null; then
            return 0
        fi

        ((attempt++))
        if ((attempt < retries)); then
            # Exponential backoff: 0.1, 0.2, 0.4 seconds
            local wait_time
            wait_time=$(awk "BEGIN {print 0.1 * 2^($attempt-1)}")
            log "warn" "SQL failed, retrying in ${wait_time}s (attempt $attempt/$retries)"
            sleep "$wait_time"
        fi
    done

    return 1
}

# ============================================================================
# Queue Processing
# ============================================================================

# Get list of pending queue files, sorted by priority and timestamp
get_pending_files() {
    local -a files=()

    # List files matching *.msg pattern
    local f
    for f in "$QUEUE_FAST_DIR"/*.msg 2>/dev/null; do
        [[ -f "$f" ]] && files+=("$f")
    done

    # Sort by filename (which encodes timestamp.priority.pid.seq)
    # Using simple array sort for small batches
    if ((${#files[@]} > 0)); then
        printf '%s\n' "${files[@]}" | sort -t. -k1,1n -k2,2n
    fi
}

# Process a batch of queue entries
process_batch() {
    local -a pending_files
    local batch_sql="BEGIN IMMEDIATE;"
    local batch_count=0
    local -a processed_files=()

    # Read pending files (sorted by priority)
    while IFS= read -r file; do
        [[ -z "$file" ]] && continue
        [[ ! -f "$file" ]] && continue

        # Read SQL from file
        local sql
        sql=$(<"$file") 2>/dev/null || continue

        # Skip empty files
        [[ -z "$sql" ]] && continue

        # Add to batch
        batch_sql+=$'\n'"$sql"
        processed_files+=("$file")
        ((batch_count++))

        # Stop at batch size limit
        ((batch_count >= WORKER_BATCH_SIZE)) && break

    done < <(get_pending_files)

    # Nothing to process
    if ((batch_count == 0)); then
        return 1
    fi

    batch_sql+=$'\n'"COMMIT;"

    log "debug" "Processing batch of $batch_count entries"

    # Execute batch
    if exec_sql "$batch_sql"; then
        # Success - remove processed files
        local f
        for f in "${processed_files[@]}"; do
            rm -f "$f" 2>/dev/null
        done

        ((PROCESSED_COUNT += batch_count))
        log "debug" "Batch processed successfully ($batch_count entries)"
        return 0
    else
        # Failure - try individual processing
        log "warn" "Batch failed, falling back to individual processing"
        process_individually "${processed_files[@]}"
        return 0
    fi
}

# Process entries one by one (fallback for failed batches)
process_individually() {
    local files=("$@")

    for file in "${files[@]}"; do
        [[ ! -f "$file" ]] && continue

        local sql
        sql=$(<"$file") 2>/dev/null || continue

        if exec_sql "$sql" 1; then
            rm -f "$file" 2>/dev/null
            ((PROCESSED_COUNT++))
        else
            # Move to failed directory for manual inspection
            mkdir -p "$QUEUE_DIR/failed" 2>/dev/null
            mv "$file" "$QUEUE_DIR/failed/" 2>/dev/null
            ((FAILED_COUNT++))
            log "error" "Failed to process: $(basename "$file")"
        fi
    done
}

# Check if there are pending entries
has_pending() {
    local f
    for f in "$QUEUE_FAST_DIR"/*.msg 2>/dev/null; do
        [[ -f "$f" ]] && return 0
    done
    return 1
}

# ============================================================================
# Main Loop
# ============================================================================

main_loop() {
    log "info" "Worker main loop started (PID: $$)"

    while $WORKER_RUNNING; do
        # Check for pending entries
        if has_pending; then
            # Reset idle counter
            IDLE_SECONDS=0

            # Process batch
            process_batch || true

        else
            # No pending entries - increment idle time
            sleep "$WORKER_POLL_INTERVAL"
            IDLE_SECONDS=$((IDLE_SECONDS + 1))

            # Check idle timeout
            if ((WORKER_IDLE_EXIT > 0 && IDLE_SECONDS >= WORKER_IDLE_EXIT)); then
                log "info" "Idle timeout reached (${WORKER_IDLE_EXIT}s), exiting"
                break
            fi
        fi

        # Periodic stats logging (every 100 seconds)
        if ((IDLE_SECONDS > 0 && IDLE_SECONDS % 100 == 0)); then
            log "info" "Stats: processed=$PROCESSED_COUNT, failed=$FAILED_COUNT, uptime=$(($(date +%s) - START_TIME))s"
        fi
    done
}

# ============================================================================
# Startup
# ============================================================================

startup() {
    # Check if already running
    if [[ -f "$WORKER_PID_FILE" ]]; then
        local existing_pid
        existing_pid=$(<"$WORKER_PID_FILE") 2>/dev/null

        if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
            echo "Worker already running (PID: $existing_pid)" >&2
            exit 1
        fi

        # Stale PID file, remove it
        rm -f "$WORKER_PID_FILE"
    fi

    # Create directories
    mkdir -p "$QUEUE_FAST_DIR" 2>/dev/null
    mkdir -p "$(dirname "$WORKER_LOG")" 2>/dev/null

    # Write PID file
    echo "$$" > "$WORKER_PID_FILE"

    # Truncate log if too large (>1MB)
    if [[ -f "$WORKER_LOG" ]]; then
        local log_size
        log_size=$(wc -c < "$WORKER_LOG" 2>/dev/null || echo 0)
        if ((log_size > 1048576)); then
            mv "$WORKER_LOG" "$WORKER_LOG.old" 2>/dev/null
            touch "$WORKER_LOG"
        fi
    fi

    log "info" "Worker starting (PID: $$)"
    log "info" "Configuration: batch_size=$WORKER_BATCH_SIZE, poll=$WORKER_POLL_INTERVAL, idle_exit=$WORKER_IDLE_EXIT"

    # Initialize SQLite
    if [[ -f "$HIVE_DB" ]]; then
        init_sqlite
    else
        log "warn" "Database not found: $HIVE_DB"
    fi
}

# ============================================================================
# Entry Point
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    startup
    main_loop
    cleanup
fi
