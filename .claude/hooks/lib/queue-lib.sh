#!/bin/bash
# =============================================================================
# Queue Library - Production-Ready Directory-Based SQLite Write Queue
# =============================================================================
#
# DESIGN PRINCIPLES:
# - ZERO data loss: All writes are atomic (write to .tmp, then mv)
# - Lock-free enqueue: Uses atomic file operations, no flock for writes
# - Sequential processing: flock for sequence numbers only
# - Fast path: <1ms for queue_db_write()
#
# DIRECTORY STRUCTURE:
#   .hive-mind/queue/
#   ├── pending/     # Queue entries waiting to be processed
#   ├── processing/  # Entries currently being processed
#   ├── completed/   # Successfully processed entries (archived)
#   ├── failed/      # Failed entries for manual inspection
#   ├── .tmp/        # Temporary files for atomic writes
#   ├── .seq         # Sequence number file (flock protected)
#   ├── .lock        # Worker lock file
#   ├── worker.pid   # Worker PID file
#   ├── worker.log   # Worker log file
#   └── stats.json   # Queue statistics
#
# QUEUE ENTRY FORMAT (JSON):
#   {
#     "seq": 1234567890123,      # Unique sequence number (timestamp + counter)
#     "priority": 5,             # 1-10, lower = higher priority
#     "operation": "update_session",
#     "sql": "UPDATE sessions ...",
#     "metadata": {...},
#     "created_at": "2024-01-01T12:00:00Z",
#     "retries": 0
#   }
#
# USAGE:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/queue-lib.sh"
#   queue_db_write "UPDATE sessions SET ..." "update_session" 3
#
# =============================================================================

set -o pipefail

# =============================================================================
# Configuration & Constants
# =============================================================================

# Queue directories
QUEUE_BASE_DIR="${QUEUE_BASE_DIR:-.hive-mind/queue}"
QUEUE_PENDING_DIR="$QUEUE_BASE_DIR/pending"
QUEUE_PROCESSING_DIR="$QUEUE_BASE_DIR/processing"
QUEUE_COMPLETED_DIR="$QUEUE_BASE_DIR/completed"
QUEUE_FAILED_DIR="$QUEUE_BASE_DIR/failed"
QUEUE_TMP_DIR="$QUEUE_BASE_DIR/.tmp"

# Queue files
QUEUE_SEQ_FILE="$QUEUE_BASE_DIR/.seq"
QUEUE_LOCK_FILE="$QUEUE_BASE_DIR/.lock"
QUEUE_WORKER_PID="$QUEUE_BASE_DIR/worker.pid"
QUEUE_WORKER_LOG="$QUEUE_BASE_DIR/worker.log"
QUEUE_STATS_FILE="$QUEUE_BASE_DIR/stats.json"

# Database
HIVE_DB="${HIVE_DB:-.hive-mind/hive.db}"

# Worker configuration
QUEUE_POLL_INTERVAL="${QUEUE_POLL_INTERVAL:-0.1}"       # seconds
QUEUE_BATCH_SIZE="${QUEUE_BATCH_SIZE:-10}"              # entries per batch
QUEUE_MAX_RETRIES="${QUEUE_MAX_RETRIES:-3}"             # retry attempts
QUEUE_IDLE_EXIT="${QUEUE_IDLE_EXIT:-300}"               # seconds before worker exits
QUEUE_PROCESSING_TIMEOUT="${QUEUE_PROCESSING_TIMEOUT:-30}"  # seconds before orphan recovery

# SQLite configuration
SQLITE_TIMEOUT="${SQLITE_TIMEOUT:-10000}"               # milliseconds
SQLITE_BUSY_TIMEOUT="${SQLITE_BUSY_TIMEOUT:-5000}"      # milliseconds

# Feature flags
USE_QUEUE="${USE_QUEUE:-true}"                          # Enable queue system

# =============================================================================
# Directory Initialization
# =============================================================================

# Initialize queue directories (idempotent, safe to call multiple times)
# Returns: 0 on success, 1 on failure
queue_init_dirs() {
    local dirs=(
        "$QUEUE_BASE_DIR"
        "$QUEUE_PENDING_DIR"
        "$QUEUE_PROCESSING_DIR"
        "$QUEUE_COMPLETED_DIR"
        "$QUEUE_FAILED_DIR"
        "$QUEUE_TMP_DIR"
    )

    for dir in "${dirs[@]}"; do
        if ! mkdir -p "$dir" 2>/dev/null; then
            # Check if it exists (another process might have created it)
            if [ ! -d "$dir" ]; then
                echo "ERROR: Failed to create directory: $dir" >&2
                return 1
            fi
        fi
    done

    # Initialize sequence file if missing (atomic creation)
    if [ ! -f "$QUEUE_SEQ_FILE" ]; then
        echo "0" > "$QUEUE_TMP_DIR/.seq.init.$$" 2>/dev/null
        mv "$QUEUE_TMP_DIR/.seq.init.$$" "$QUEUE_SEQ_FILE" 2>/dev/null || true
    fi

    # Initialize stats file if missing
    if [ ! -f "$QUEUE_STATS_FILE" ]; then
        echo '{"enqueued":0,"processed":0,"failed":0,"retried":0,"direct":0}' \
            > "$QUEUE_TMP_DIR/.stats.init.$$" 2>/dev/null
        mv "$QUEUE_TMP_DIR/.stats.init.$$" "$QUEUE_STATS_FILE" 2>/dev/null || true
    fi

    return 0
}

# Check if queue system is available and initialized
# Returns: 0 if available, 1 if not
queue_is_available() {
    [ -d "$QUEUE_PENDING_DIR" ] && [ -d "$QUEUE_TMP_DIR" ]
}

# =============================================================================
# Sequence Number Generation (Lock-Protected)
# =============================================================================

# Generate unique sequence number using flock
# Format: TIMESTAMP_COUNTER (ensures uniqueness and ordering)
# Returns: sequence number on stdout, 0 on success, 1 on failure
queue_next_seq() {
    local seq_fd
    local timestamp counter seq_num

    # Ensure directory exists
    [ -d "$QUEUE_BASE_DIR" ] || queue_init_dirs || return 1

    # Open file descriptor for flock (use fd 9 to avoid conflicts)
    exec 9>>"$QUEUE_SEQ_FILE" 2>/dev/null || return 1

    # Acquire exclusive lock with timeout (1 second max)
    if ! flock -w 1 9 2>/dev/null; then
        exec 9>&-
        # Fallback: use timestamp + random
        echo "$(date +%s%N)_$$"
        return 0
    fi

    # Read current counter
    counter=$(cat "$QUEUE_SEQ_FILE" 2>/dev/null || echo "0")
    counter=$((counter + 1))

    # Get high-precision timestamp
    timestamp=$(date +%s%N 2>/dev/null || echo "$(date +%s)000000000")

    # Write new counter
    echo "$counter" > "$QUEUE_SEQ_FILE"

    # Release lock and close fd
    flock -u 9 2>/dev/null
    exec 9>&-

    # Return unique sequence: timestamp_counter
    seq_num="${timestamp}_${counter}"
    echo "$seq_num"
    return 0
}

# =============================================================================
# JSON Utilities (Safe Escaping)
# =============================================================================

# Escape string for JSON (handles all special characters)
# This is critical for preventing SQL injection and JSON parsing errors
json_escape_string() {
    local str="$1"

    # Use jq if available for proper JSON escaping
    if command -v jq >/dev/null 2>&1; then
        printf '%s' "$str" | jq -Rs .
        return 0
    fi

    # Fallback: manual escaping (simplified for macOS compatibility)
    # Just escape the critical characters: backslash, quotes, newlines
    local result="$str"
    result="${result//\\/\\\\}"  # Backslash first
    result="${result//\"/\\\"}"  # Double quotes
    result="${result//$'\n'/\\n}"  # Newlines
    result="${result//$'\r'/\\r}"  # Carriage returns
    result="${result//$'\t'/\\t}"  # Tabs
    printf '%s' "$result"
}

# Create JSON queue entry
# Args: $1=sql, $2=operation, $3=priority, $4=metadata, $5=seq
# Returns: JSON string on stdout
queue_format_json() {
    local sql="$1"
    local operation="${2:-generic}"
    local priority="${3:-5}"
    local metadata="${4:-{}}"
    local seq="$5"
    local created_at

    # ISO 8601 timestamp
    created_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')

    # Use jq for proper JSON construction if available
    if command -v jq >/dev/null 2>&1; then
        # Ensure metadata is valid JSON (default to empty object if not)
        local metadata_json="$metadata"
        if ! echo "$metadata_json" | jq . >/dev/null 2>&1; then
            metadata_json="{}"
        fi

        jq -n \
            --arg seq "$seq" \
            --argjson priority "$priority" \
            --arg operation "$operation" \
            --arg sql "$sql" \
            --argjson metadata "$metadata_json" \
            --arg created_at "$created_at" \
            '{seq:$seq, priority:$priority, operation:$operation, sql:$sql, metadata:$metadata, created_at:$created_at, retries:0}'
        return 0
    fi

    # Fallback: manual JSON construction
    local sql_escaped
    sql_escaped=$(json_escape_string "$sql")

    # Construct JSON (using here-doc to avoid quoting issues)
    cat <<EOF
{"seq":"$seq","priority":$priority,"operation":"$operation","sql":"$sql_escaped","metadata":$metadata,"created_at":"$created_at","retries":0}
EOF
}

# Parse JSON field (simple grep-based extraction for speed)
# Args: $1=json, $2=field_name
# Returns: field value on stdout
json_get_field() {
    local json="$1"
    local field="$2"

    # Use grep + sed for speed (avoid jq startup overhead)
    echo "$json" | grep -oE "\"$field\":[^,}]+" | head -1 | sed 's/.*://' | sed 's/^"//' | sed 's/"$//'
}

# =============================================================================
# Core Queue Operations
# =============================================================================

# Main entry point: Queue a database write (FAST PATH - must be <1ms)
# Args: $1=sql, $2=operation_type (optional), $3=priority (optional), $4=metadata (optional)
# Returns: 0 on success (queued or direct), 1 on failure
queue_db_write() {
    local sql="$1"
    local operation="${2:-generic}"
    local priority="${3:-5}"
    local metadata="${4:-{}}"

    # Validate input
    if [ -z "$sql" ]; then
        return 1
    fi

    # Check if queue is disabled
    if [ "$USE_QUEUE" != "true" ]; then
        queue_exec_sql_direct "$sql"
        return $?
    fi

    # Initialize if needed (fast path: skip if already exists)
    if ! queue_is_available; then
        queue_init_dirs || {
            # Queue unavailable - fallback to direct write
            queue_log "warn" "Queue unavailable, using direct write"
            queue_exec_sql_direct "$sql"
            return $?
        }
    fi

    # Generate unique sequence number
    local seq
    seq=$(queue_next_seq) || {
        queue_log "warn" "Sequence generation failed, using direct write"
        queue_exec_sql_direct "$sql"
        return $?
    }

    # Create JSON entry
    local json_entry
    json_entry=$(queue_format_json "$sql" "$operation" "$priority" "$metadata" "$seq")

    # Atomic write: create in .tmp, then move to pending
    local tmp_file="$QUEUE_TMP_DIR/q_${seq}.tmp"
    local pending_file="$QUEUE_PENDING_DIR/${priority}_${seq}.json"

    # Write to temp file
    if ! printf '%s\n' "$json_entry" > "$tmp_file" 2>/dev/null; then
        # Disk full or permission error
        queue_log "error" "Failed to write tmp file: $tmp_file"
        rm -f "$tmp_file" 2>/dev/null
        queue_exec_sql_direct "$sql"
        return $?
    fi

    # Atomic move to pending (this is the commit point)
    if ! mv "$tmp_file" "$pending_file" 2>/dev/null; then
        queue_log "error" "Failed to move to pending: $pending_file"
        rm -f "$tmp_file" 2>/dev/null
        queue_exec_sql_direct "$sql"
        return $?
    fi

    # Update stats (non-blocking, fire-and-forget)
    queue_stats_increment "enqueued" &

    # Ensure worker is running (non-blocking)
    queue_ensure_worker &

    return 0
}

# Alias for backward compatibility
queue_write() {
    queue_db_write "$@"
}

# Enqueue with explicit parameters (alias)
queue_enqueue() {
    local operation="$1"
    local priority="$2"
    local sql="$3"
    local metadata="${4:-{}}"

    queue_db_write "$sql" "$operation" "$priority" "$metadata"
}

# =============================================================================
# Queue Reading Operations (for Worker)
# =============================================================================

# Get list of pending entries sorted by priority and sequence
# Args: $1=batch_size (optional)
# Returns: list of file paths on stdout (one per line)
queue_list_pending() {
    local batch_size="${1:-$QUEUE_BATCH_SIZE}"

    if [ ! -d "$QUEUE_PENDING_DIR" ]; then
        return 1
    fi

    # List files sorted by name (priority_seq format ensures correct order)
    # Lower priority number = higher priority
    ls -1 "$QUEUE_PENDING_DIR"/*.json 2>/dev/null | sort | head -n "$batch_size"
}

# Move entry from pending to processing (atomic)
# Args: $1=pending_file_path
# Returns: processing file path on stdout, 0 on success
queue_claim_entry() {
    local pending_file="$1"
    local filename
    local processing_file

    if [ ! -f "$pending_file" ]; then
        return 1
    fi

    filename=$(basename "$pending_file")
    processing_file="$QUEUE_PROCESSING_DIR/$filename"

    # Atomic move (if another worker claims first, this fails gracefully)
    if mv "$pending_file" "$processing_file" 2>/dev/null; then
        echo "$processing_file"
        return 0
    fi

    return 1
}

# Read and parse queue entry
# Args: $1=file_path
# Returns: JSON content on stdout
queue_read_entry() {
    local file_path="$1"

    if [ -f "$file_path" ]; then
        cat "$file_path" 2>/dev/null
    else
        return 1
    fi
}

# Mark entry as completed (move to completed/)
# Args: $1=processing_file_path
queue_complete_entry() {
    local processing_file="$1"
    local filename
    local completed_file

    if [ ! -f "$processing_file" ]; then
        return 1
    fi

    filename=$(basename "$processing_file")
    completed_file="$QUEUE_COMPLETED_DIR/$filename"

    mv "$processing_file" "$completed_file" 2>/dev/null
    queue_stats_increment "processed"
    return 0
}

# Mark entry as failed (move to failed/)
# Args: $1=processing_file_path, $2=error_message
queue_fail_entry() {
    local processing_file="$1"
    local error_msg="${2:-unknown error}"
    local filename
    local failed_file
    local json_content

    if [ ! -f "$processing_file" ]; then
        return 1
    fi

    filename=$(basename "$processing_file")
    failed_file="$QUEUE_FAILED_DIR/$filename"

    # Append error info to entry
    json_content=$(cat "$processing_file" 2>/dev/null)
    if [ -n "$json_content" ]; then
        # Add error field (simple append before closing brace)
        local error_escaped
        error_escaped=$(json_escape_string "$error_msg")
        json_content=$(echo "$json_content" | sed "s/}$/,\"error\":\"$error_escaped\",\"failed_at\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"}/" )
        echo "$json_content" > "$failed_file"
    else
        mv "$processing_file" "$failed_file" 2>/dev/null
    fi

    rm -f "$processing_file" 2>/dev/null
    queue_stats_increment "failed"
    return 0
}

# Requeue entry for retry (move back to pending with incremented retry count)
# Args: $1=processing_file_path
queue_retry_entry() {
    local processing_file="$1"
    local filename
    local json_content
    local retries
    local priority
    local seq

    if [ ! -f "$processing_file" ]; then
        return 1
    fi

    json_content=$(cat "$processing_file" 2>/dev/null)
    retries=$(json_get_field "$json_content" "retries")
    retries=${retries:-0}
    retries=$((retries + 1))

    if [ "$retries" -ge "$QUEUE_MAX_RETRIES" ]; then
        queue_fail_entry "$processing_file" "max retries exceeded"
        return 1
    fi

    # Update retry count in JSON
    json_content=$(echo "$json_content" | sed "s/\"retries\":[0-9]*/\"retries\":$retries/")

    # Lower priority on retry (add 1 to priority, max 10)
    priority=$(json_get_field "$json_content" "priority")
    priority=${priority:-5}
    [ "$priority" -lt 10 ] && priority=$((priority + 1))
    json_content=$(echo "$json_content" | sed "s/\"priority\":[0-9]*/\"priority\":$priority/")

    # Generate new filename with updated priority
    seq=$(json_get_field "$json_content" "seq")
    filename="${priority}_${seq}.json"

    # Write updated entry back to pending
    echo "$json_content" > "$QUEUE_PENDING_DIR/$filename"
    rm -f "$processing_file"

    queue_stats_increment "retried"
    return 0
}

# Get queue size (pending entries count)
queue_size() {
    if [ -d "$QUEUE_PENDING_DIR" ]; then
        ls -1 "$QUEUE_PENDING_DIR"/*.json 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

# Get processing count
queue_processing_count() {
    if [ -d "$QUEUE_PROCESSING_DIR" ]; then
        ls -1 "$QUEUE_PROCESSING_DIR"/*.json 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

# =============================================================================
# Orphan Recovery (Crash Recovery)
# =============================================================================

# Recover orphaned entries (stuck in processing/)
# This handles the case where a worker crashes mid-processing
queue_recover_orphans() {
    local timeout="${1:-$QUEUE_PROCESSING_TIMEOUT}"
    local now
    local file_time
    local age

    now=$(date +%s)

    if [ ! -d "$QUEUE_PROCESSING_DIR" ]; then
        return 0
    fi

    for file in "$QUEUE_PROCESSING_DIR"/*.json; do
        [ -f "$file" ] || continue

        # Get file modification time
        file_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)
        age=$((now - file_time))

        if [ "$age" -gt "$timeout" ]; then
            queue_log "warn" "Recovering orphaned entry: $(basename "$file") (age: ${age}s)"
            queue_retry_entry "$file"
        fi
    done
}

# =============================================================================
# SQL Execution
# =============================================================================

# Execute SQL directly (fallback path, bypasses queue)
# Args: $1=sql, $2=max_retries (optional)
# Returns: 0 on success, 1 on failure
queue_exec_sql_direct() {
    local sql="$1"
    local max_retries="${2:-3}"
    local retry_count=0
    local output
    local result

    if [ -z "$sql" ]; then
        return 1
    fi

    if [ ! -f "$HIVE_DB" ]; then
        queue_log "error" "Database not found: $HIVE_DB"
        return 1
    fi

    while [ "$retry_count" -le "$max_retries" ]; do
        # Execute with timeout and WAL mode
        output=$(sqlite3 -cmd ".timeout $SQLITE_TIMEOUT" "$HIVE_DB" "$sql" 2>&1)
        result=$?

        if [ "$result" -eq 0 ]; then
            queue_stats_increment "direct"
            return 0
        fi

        # Check if it's a recoverable error (busy/locked)
        if echo "$output" | grep -qiE "database is locked|busy|SQLITE_BUSY"; then
            retry_count=$((retry_count + 1))
            if [ "$retry_count" -le "$max_retries" ]; then
                # Exponential backoff: 0.1, 0.2, 0.4 seconds
                local wait_time
                wait_time=$(awk "BEGIN {printf \"%.2f\", 0.1 * (2 ^ ($retry_count - 1))}")
                sleep "$wait_time"
                continue
            fi
        else
            # Non-recoverable error
            queue_log "error" "SQL execution failed: $output"
            return 1
        fi
    done

    queue_log "error" "SQL failed after $max_retries retries: database locked"
    return 1
}

# Execute SQL from queue entry (used by worker)
queue_exec_sql() {
    queue_exec_sql_direct "$@"
}

# =============================================================================
# Statistics Tracking
# =============================================================================

# Increment a stats counter (fire-and-forget, non-blocking)
# Args: $1=counter_name, $2=increment (optional, default 1)
queue_stats_increment() {
    local counter="$1"
    local increment="${2:-1}"

    [ -f "$QUEUE_STATS_FILE" ] || return 0

    # Use jq if available (more reliable)
    if command -v jq >/dev/null 2>&1; then
        local tmp_stats="$QUEUE_TMP_DIR/.stats.$$"
        jq ".$counter += $increment" "$QUEUE_STATS_FILE" > "$tmp_stats" 2>/dev/null && \
            mv "$tmp_stats" "$QUEUE_STATS_FILE" 2>/dev/null
        rm -f "$tmp_stats" 2>/dev/null
    else
        # Fallback: sed-based increment
        local current
        current=$(grep -oE "\"$counter\":[0-9]+" "$QUEUE_STATS_FILE" 2>/dev/null | cut -d':' -f2)
        current=${current:-0}
        local new_value=$((current + increment))
        sed -i.bak "s/\"$counter\":[0-9]*/\"$counter\":$new_value/" "$QUEUE_STATS_FILE" 2>/dev/null
        rm -f "$QUEUE_STATS_FILE.bak" 2>/dev/null
    fi
}

# Get queue statistics
queue_stats_get() {
    if [ -f "$QUEUE_STATS_FILE" ]; then
        cat "$QUEUE_STATS_FILE"
    else
        echo '{"enqueued":0,"processed":0,"failed":0,"retried":0,"direct":0}'
    fi
}

# =============================================================================
# Worker Management
# =============================================================================

# Check if worker is running
queue_worker_is_running() {
    if [ ! -f "$QUEUE_WORKER_PID" ]; then
        return 1
    fi

    local worker_pid
    worker_pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)

    if [ -z "$worker_pid" ]; then
        rm -f "$QUEUE_WORKER_PID" 2>/dev/null
        return 1
    fi

    # Check if process is alive
    if kill -0 "$worker_pid" 2>/dev/null; then
        return 0
    else
        # Stale PID file
        rm -f "$QUEUE_WORKER_PID" 2>/dev/null
        return 1
    fi
}

# Ensure worker is running (non-blocking)
queue_ensure_worker() {
    if queue_worker_is_running; then
        return 0
    fi

    # Start worker in background
    local worker_script
    worker_script="$(dirname "${BASH_SOURCE[0]}")/queue-worker.sh"

    if [ -f "$worker_script" ] && [ -x "$worker_script" ]; then
        nohup "$worker_script" </dev/null >/dev/null 2>&1 &
        disown 2>/dev/null || true
    fi
}

# Stop worker gracefully
queue_stop_worker() {
    if ! queue_worker_is_running; then
        return 0
    fi

    local worker_pid
    worker_pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)

    if [ -n "$worker_pid" ]; then
        # Send SIGTERM for graceful shutdown
        kill -TERM "$worker_pid" 2>/dev/null

        # Wait up to 5 seconds
        local waited=0
        while [ "$waited" -lt 50 ]; do
            if ! kill -0 "$worker_pid" 2>/dev/null; then
                rm -f "$QUEUE_WORKER_PID" 2>/dev/null
                return 0
            fi
            sleep 0.1
            waited=$((waited + 1))
        done

        # Force kill
        kill -KILL "$worker_pid" 2>/dev/null
        rm -f "$QUEUE_WORKER_PID" 2>/dev/null
    fi

    return 0
}

# =============================================================================
# Logging
# =============================================================================

# Log message to queue log file
# Args: $1=level, $2=message
queue_log() {
    local level="$1"
    local message="$2"
    local timestamp

    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Ensure log directory exists
    [ -d "$QUEUE_BASE_DIR" ] || return 0

    echo "[$timestamp] [$level] $message" >> "$QUEUE_WORKER_LOG" 2>/dev/null
}

# =============================================================================
# Cleanup and Maintenance
# =============================================================================

# Clean up old completed/failed entries
# Args: $1=retention_hours (optional, default 24)
queue_cleanup_old() {
    local retention_hours="${1:-24}"
    local cutoff

    cutoff=$(date -d "-${retention_hours} hours" +%s 2>/dev/null || \
             date -v-${retention_hours}H +%s 2>/dev/null || \
             echo "$(($(date +%s) - retention_hours * 3600))")

    for dir in "$QUEUE_COMPLETED_DIR" "$QUEUE_FAILED_DIR"; do
        [ -d "$dir" ] || continue

        for file in "$dir"/*.json; do
            [ -f "$file" ] || continue

            local file_time
            file_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)

            if [ "$file_time" -lt "$cutoff" ]; then
                rm -f "$file"
            fi
        done
    done

    # Rotate log if too large (>1MB)
    if [ -f "$QUEUE_WORKER_LOG" ]; then
        local log_size
        log_size=$(stat -f %z "$QUEUE_WORKER_LOG" 2>/dev/null || stat -c %s "$QUEUE_WORKER_LOG" 2>/dev/null || echo "0")

        if [ "$log_size" -gt 1048576 ]; then
            mv "$QUEUE_WORKER_LOG" "$QUEUE_WORKER_LOG.old" 2>/dev/null
            touch "$QUEUE_WORKER_LOG"
        fi
    fi

    # Clean up stale tmp files (older than 1 hour)
    find "$QUEUE_TMP_DIR" -name "*.tmp" -mmin +60 -delete 2>/dev/null || true
}

# Reset queue (for testing only)
queue_reset() {
    queue_stop_worker
    rm -rf "$QUEUE_PENDING_DIR"/* 2>/dev/null
    rm -rf "$QUEUE_PROCESSING_DIR"/* 2>/dev/null
    rm -rf "$QUEUE_COMPLETED_DIR"/* 2>/dev/null
    rm -rf "$QUEUE_FAILED_DIR"/* 2>/dev/null
    rm -rf "$QUEUE_TMP_DIR"/* 2>/dev/null
    echo "0" > "$QUEUE_SEQ_FILE"
    echo '{"enqueued":0,"processed":0,"failed":0,"retried":0,"direct":0}' > "$QUEUE_STATS_FILE"
}

# =============================================================================
# Convenience Wrappers
# =============================================================================

# Update sessions table (high priority)
queue_update_session() {
    local session_id="$1"
    local updates="$2"
    local sql="UPDATE sessions SET $updates WHERE id = '$session_id';"
    queue_db_write "$sql" "update_session" 3
}

# Update instance_sessions table
queue_update_instance() {
    local instance_id="$1"
    local updates="$2"
    local sql="UPDATE instance_sessions SET $updates WHERE instance_id = '$instance_id';"
    queue_db_write "$sql" "update_instance" 4
}

# Insert into session_logs (low priority)
queue_insert_log() {
    local session_id="$1"
    local level="$2"
    local message="$3"
    local data="${4:-{}}"

    # Escape quotes in message
    message=$(echo "$message" | sed "s/'/''/g")

    local sql="INSERT INTO session_logs (session_id, log_level, message, data)
        VALUES ('$session_id', '$level', '$message', '$data');"
    queue_db_write "$sql" "insert_log" 7
}

# =============================================================================
# Export Functions
# =============================================================================

export -f queue_init_dirs queue_is_available
export -f queue_next_seq json_escape_string queue_format_json json_get_field
export -f queue_db_write queue_write queue_enqueue
export -f queue_list_pending queue_claim_entry queue_read_entry
export -f queue_complete_entry queue_fail_entry queue_retry_entry
export -f queue_size queue_processing_count queue_recover_orphans
export -f queue_exec_sql_direct queue_exec_sql
export -f queue_stats_increment queue_stats_get
export -f queue_worker_is_running queue_ensure_worker queue_stop_worker
export -f queue_log queue_cleanup_old queue_reset
export -f queue_update_session queue_update_instance queue_insert_log
