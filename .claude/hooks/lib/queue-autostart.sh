#!/bin/bash
# =============================================================================
# Queue Auto-Start Library - Production-Ready Worker Lifecycle Management
# =============================================================================
#
# DESIGN PRINCIPLES:
# - Sub-millisecond overhead: Cached health checks for fast path
# - Race-condition safe: Atomic mkdir-based locking (no flock)
# - Self-healing: Heartbeat monitoring with automatic recovery
# - macOS compatible: Uses POSIX-compliant operations only
#
# USAGE:
#   source queue-autostart.sh
#   queue_ensure_worker_fast  # Call from queue_db_write()
#
# DEPENDENCIES:
#   - QUEUE_BASE_DIR must be set (from queue-lib.sh)
#   - QUEUE_WORKER_PID must be set (from queue-lib.sh)
#   - QUEUE_WORKER_LOG must be set (from queue-lib.sh)
#
# =============================================================================

# Prevent double-sourcing
if [ -n "$QUEUE_AUTOSTART_LOADED" ]; then
    return 0
fi
QUEUE_AUTOSTART_LOADED=1

# =============================================================================
# Configuration
# =============================================================================

# Health check cache TTL (seconds)
# After a successful health check, skip checks for this duration
HEALTH_CACHE_TTL="${HEALTH_CACHE_TTL:-5}"

# Heartbeat timeout (seconds)
# If worker heartbeat is older than this, consider worker stuck
HEARTBEAT_TIMEOUT="${HEARTBEAT_TIMEOUT:-30}"

# Startup lock timeout (seconds)
# If startup lock is older than this, consider it stale
STARTUP_LOCK_TIMEOUT="${STARTUP_LOCK_TIMEOUT:-10}"

# Heartbeat interval (seconds)
# Worker updates heartbeat at this interval
HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-5}"

# Startup wait timeout (seconds)
# Max time to wait for worker to write PID file
STARTUP_WAIT_TIMEOUT="${STARTUP_WAIT_TIMEOUT:-2}"

# =============================================================================
# Computed Paths (set after QUEUE_BASE_DIR is available)
# =============================================================================

_autostart_init_paths() {
    HEALTH_CACHE_FILE="${QUEUE_BASE_DIR}/.health_cache"
    HEARTBEAT_FILE="${QUEUE_BASE_DIR}/.heartbeat"
    STARTUP_LOCK_DIR="${QUEUE_BASE_DIR}/.startup_lock"
}

# =============================================================================
# Cached Health Check (Fast Path - < 0.5ms)
# =============================================================================

# Main entry point for fast health checking
# Returns: 0 if worker healthy (possibly cached), 1 if unhealthy
queue_health_check_cached() {
    _autostart_init_paths

    # Fast path: check if cache file exists and is fresh
    if [ -f "$HEALTH_CACHE_FILE" ]; then
        local cache_time now age

        # Read cache timestamp
        cache_time=$(cat "$HEALTH_CACHE_FILE" 2>/dev/null) || cache_time=0

        # Get current time
        now=$(date +%s)
        age=$((now - cache_time))

        # If cache is fresh, assume worker is healthy
        if [ "$age" -lt "$HEALTH_CACHE_TTL" ]; then
            return 0  # Cache hit - worker assumed healthy
        fi
    fi

    # Cache miss or expired - do full health check
    if queue_health_check_full; then
        # Update cache with current timestamp
        date +%s > "$HEALTH_CACHE_FILE" 2>/dev/null
        return 0
    fi

    return 1  # Worker unhealthy
}

# =============================================================================
# Full Health Check (Comprehensive Verification)
# =============================================================================

# Performs all health checks in sequence
# Returns: 0 if worker is healthy, 1 if not
queue_health_check_full() {
    _autostart_init_paths

    local now pid heartbeat_time age

    now=$(date +%s)

    # Check 1: PID file must exist
    if [ ! -f "$QUEUE_WORKER_PID" ]; then
        return 1
    fi

    # Check 2: Read PID and verify it's not empty
    pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)
    if [ -z "$pid" ]; then
        rm -f "$QUEUE_WORKER_PID" 2>/dev/null
        return 1
    fi

    # Check 3: Process must be alive (kill -0 doesn't send signal)
    if ! kill -0 "$pid" 2>/dev/null; then
        # Process is dead - clean up stale PID file
        rm -f "$QUEUE_WORKER_PID" 2>/dev/null
        rm -f "$HEARTBEAT_FILE" 2>/dev/null
        return 1
    fi

    # Check 4: Heartbeat must be fresh (if heartbeat file exists)
    # Note: On first startup, heartbeat file may not exist yet
    if [ -f "$HEARTBEAT_FILE" ]; then
        heartbeat_time=$(cat "$HEARTBEAT_FILE" 2>/dev/null) || heartbeat_time=0
        age=$((now - heartbeat_time))

        if [ "$age" -gt "$HEARTBEAT_TIMEOUT" ]; then
            # Worker is stuck - it's not updating its heartbeat
            _autostart_log "warn" "Worker heartbeat stale (${age}s > ${HEARTBEAT_TIMEOUT}s), killing PID $pid"
            kill -KILL "$pid" 2>/dev/null
            rm -f "$QUEUE_WORKER_PID" 2>/dev/null
            rm -f "$HEARTBEAT_FILE" 2>/dev/null
            return 1
        fi
    fi

    # All checks passed
    return 0
}

# =============================================================================
# Atomic Startup (Race-Condition Safe)
# =============================================================================

# Atomically start worker with protection against concurrent starters
# Uses mkdir as atomic lock primitive (works on all POSIX systems)
# Returns: 0 if worker is running (started by us or someone else), 1 on failure
queue_atomic_start_worker() {
    _autostart_init_paths

    local start_time elapsed lock_mtime lock_age

    start_time=$(date +%s)

    # Try to acquire startup lock using atomic mkdir
    while true; do
        # Attempt to create lock directory (atomic operation)
        if mkdir "$STARTUP_LOCK_DIR" 2>/dev/null; then
            # We acquired the lock - we're responsible for starting
            break
        fi

        # Lock exists - check if it's stale
        if [ -d "$STARTUP_LOCK_DIR" ]; then
            # Get lock directory modification time
            # macOS uses -f %m, Linux uses -c %Y
            lock_mtime=$(stat -f %m "$STARTUP_LOCK_DIR" 2>/dev/null || \
                         stat -c %Y "$STARTUP_LOCK_DIR" 2>/dev/null || \
                         echo 0)
            lock_age=$(($(date +%s) - lock_mtime))

            if [ "$lock_age" -gt "$STARTUP_LOCK_TIMEOUT" ]; then
                # Stale lock - force remove and retry
                _autostart_log "warn" "Removing stale startup lock (age: ${lock_age}s)"
                rm -rf "$STARTUP_LOCK_DIR" 2>/dev/null
                continue
            fi
        fi

        # Check if we've been waiting too long
        elapsed=$(($(date +%s) - start_time))
        if [ "$elapsed" -gt "$STARTUP_LOCK_TIMEOUT" ]; then
            # Timeout - force remove lock and retry
            _autostart_log "warn" "Startup lock timeout, forcing removal"
            rm -rf "$STARTUP_LOCK_DIR" 2>/dev/null
            continue
        fi

        # Wait a bit before retrying
        sleep 0.1

        # Check if worker was started by the other process
        if queue_health_check_full; then
            return 0  # Worker started by another process
        fi
    done

    # We have the lock - double-check worker isn't already running
    if queue_health_check_full; then
        rmdir "$STARTUP_LOCK_DIR" 2>/dev/null
        return 0
    fi

    # Actually start the worker
    _queue_do_start_worker
    local result=$?

    # Release the lock
    rmdir "$STARTUP_LOCK_DIR" 2>/dev/null

    return $result
}

# Internal function to actually start the worker process
_queue_do_start_worker() {
    local script_dir worker_script pid waited

    # Find worker script
    script_dir="$(dirname "${BASH_SOURCE[0]}")"
    worker_script="$script_dir/queue-worker.sh"

    # Fallback to other locations
    if [ ! -f "$worker_script" ]; then
        worker_script="$(dirname "$script_dir")/queue-worker.sh"
    fi

    if [ ! -f "$worker_script" ]; then
        _autostart_log "error" "Worker script not found"
        return 1
    fi

    # Ensure worker is executable
    if [ ! -x "$worker_script" ]; then
        chmod +x "$worker_script" 2>/dev/null || {
            _autostart_log "error" "Cannot make worker script executable"
            return 1
        }
    fi

    # Start worker in background, fully detached from this process
    # - nohup: Ignore SIGHUP
    # - </dev/null: Detach from stdin
    # - >>log: Append to log file
    # - 2>&1: Redirect stderr to stdout
    # - &: Background
    nohup "$worker_script" </dev/null >>"$QUEUE_WORKER_LOG" 2>&1 &
    disown 2>/dev/null || true

    # Wait for worker to write PID file (indicates successful startup)
    waited=0
    while [ "$waited" -lt $((STARTUP_WAIT_TIMEOUT * 10)) ]; do
        if [ -f "$QUEUE_WORKER_PID" ]; then
            pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                _autostart_log "info" "Worker started successfully (PID: $pid)"
                # Update health cache
                date +%s > "$HEALTH_CACHE_FILE" 2>/dev/null
                return 0
            fi
        fi
        sleep 0.1
        waited=$((waited + 1))
    done

    _autostart_log "error" "Worker failed to start within ${STARTUP_WAIT_TIMEOUT}s"
    return 1
}

# =============================================================================
# Fast Ensure Worker (Main Entry Point for queue_db_write)
# =============================================================================

# Ensures worker is running with minimal overhead
# Uses cached health check, starts worker in background if needed
# This function NEVER blocks the caller for more than ~1ms
queue_ensure_worker_fast() {
    _autostart_init_paths

    # Use cached health check (sub-millisecond on cache hit)
    if queue_health_check_cached; then
        return 0  # Worker is healthy
    fi

    # Worker needs starting - do it in background so we don't block
    # The background process will handle locking and startup
    queue_atomic_start_worker &
    disown 2>/dev/null || true

    return 0  # Return immediately, startup happens asynchronously
}

# =============================================================================
# Heartbeat Functions (Called by Worker)
# =============================================================================

# Updates heartbeat file with current timestamp
# Should be called periodically by worker (every HEARTBEAT_INTERVAL seconds)
queue_update_heartbeat() {
    _autostart_init_paths
    date +%s > "$HEARTBEAT_FILE" 2>/dev/null
}

# Removes heartbeat file (called during worker shutdown)
queue_clear_heartbeat() {
    _autostart_init_paths
    rm -f "$HEARTBEAT_FILE" 2>/dev/null
}

# =============================================================================
# Cache Management
# =============================================================================

# Invalidates health cache (forces next check to do full verification)
queue_invalidate_health_cache() {
    _autostart_init_paths
    rm -f "$HEALTH_CACHE_FILE" 2>/dev/null
}

# Gets current cache status for debugging
queue_health_cache_status() {
    _autostart_init_paths

    if [ ! -f "$HEALTH_CACHE_FILE" ]; then
        echo "not_initialized"
        return
    fi

    local cache_time now age
    cache_time=$(cat "$HEALTH_CACHE_FILE" 2>/dev/null) || cache_time=0
    now=$(date +%s)
    age=$((now - cache_time))

    if [ "$age" -lt "$HEALTH_CACHE_TTL" ]; then
        echo "fresh:${age}s"
    else
        echo "expired:${age}s"
    fi
}

# =============================================================================
# Heartbeat Status
# =============================================================================

# Gets current heartbeat status for debugging
queue_heartbeat_status() {
    _autostart_init_paths

    if [ ! -f "$HEARTBEAT_FILE" ]; then
        echo "not_initialized"
        return
    fi

    local hb_time now age
    hb_time=$(cat "$HEARTBEAT_FILE" 2>/dev/null) || hb_time=0
    now=$(date +%s)
    age=$((now - hb_time))

    if [ "$age" -lt "$HEARTBEAT_TIMEOUT" ]; then
        echo "healthy:${age}s"
    else
        echo "stale:${age}s"
    fi
}

# =============================================================================
# Logging
# =============================================================================

# Internal logging function
_autostart_log() {
    local level="$1"
    local message="$2"
    local timestamp

    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Log to queue worker log if available, otherwise stderr
    if [ -n "$QUEUE_WORKER_LOG" ] && [ -d "$(dirname "$QUEUE_WORKER_LOG")" ]; then
        echo "[$timestamp] [autostart] [$level] $message" >> "$QUEUE_WORKER_LOG" 2>/dev/null
    fi

    # Also log warnings and errors to stderr
    if [ "$level" = "error" ] || [ "$level" = "warn" ]; then
        echo "[$timestamp] [autostart] [$level] $message" >&2
    fi
}

# =============================================================================
# Exports
# =============================================================================

export -f queue_health_check_cached
export -f queue_health_check_full
export -f queue_atomic_start_worker
export -f queue_ensure_worker_fast
export -f queue_update_heartbeat
export -f queue_clear_heartbeat
export -f queue_invalidate_health_cache
export -f queue_health_cache_status
export -f queue_heartbeat_status
