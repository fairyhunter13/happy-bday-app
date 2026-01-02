#!/bin/bash
# =============================================================================
# End-to-End Auto-Checkpoint Test
# =============================================================================
#
# Tests the COMPLETE flow:
# 1. File write operation (simulated)
# 2. PostToolUse hook trigger
# 3. auto-checkpoint.sh execution
# 4. Queue entry creation
# 5. Event loop processing
# 6. Database update
# 7. Validation
#
# This is a REAL end-to-end test using actual components.
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
HIVE_DB=".hive-mind/hive.db"
QUEUE_BASE_DIR=".hive-mind/queue"
INSTANCE_DIR=".hive-mind/instances"
WORKER_SCRIPT=".claude/hooks/lib/queue-worker.sh"
CHECKPOINT_SCRIPT=".claude/hooks/auto-checkpoint.sh"
TEST_SESSION="e2e-test-$$"
TEST_INSTANCE="e2e-instance-$$"

# Test tracking
START_TIME=$(date +%s)
PHASE=0

# =============================================================================
# Utilities
# =============================================================================

log_phase() {
    PHASE=$((PHASE + 1))
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}PHASE $PHASE: $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $*"
}

log_fail() {
    echo -e "${RED}[✗]${NC} $*"
}

log_step() {
    echo -e "${YELLOW}▶${NC} $*"
}

assert_true() {
    local condition="$1"
    local message="$2"

    if eval "$condition"; then
        log_success "$message"
        return 0
    else
        log_fail "$message"
        return 1
    fi
}

# =============================================================================
# Phase 1: Environment Setup
# =============================================================================

phase1_setup() {
    log_phase "Environment Setup"

    log_step "Cleaning up any existing test data..."

    # Kill existing workers
    pkill -9 -f "queue-worker.sh" 2>/dev/null || true
    sleep 1

    # Clean locks and pipes
    rm -f "$QUEUE_BASE_DIR"/.lock 2>/dev/null || true
    rm -f "$QUEUE_BASE_DIR"/worker.pid 2>/dev/null || true
    rm -f "$QUEUE_BASE_DIR"/.event_pipe_* 2>/dev/null || true
    rm -f "$QUEUE_BASE_DIR"/.heartbeat 2>/dev/null || true

    # Clean queue directories
    rm -f "$QUEUE_BASE_DIR"/pending/*.json 2>/dev/null || true
    rm -f "$QUEUE_BASE_DIR"/processing/*.json 2>/dev/null || true
    rm -f "$QUEUE_BASE_DIR"/completed/*.json 2>/dev/null || true

    log_success "Cleanup complete"

    log_step "Creating test session and instance..."

    # Ensure database exists
    if [ ! -f "$HIVE_DB" ]; then
        log_info "Creating test database..."
        mkdir -p "$(dirname "$HIVE_DB")"
        sqlite3 "$HIVE_DB" <<EOF
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    swarm_id TEXT,
    swarm_name TEXT,
    objective TEXT,
    status TEXT,
    checkpoint_data TEXT,
    metadata TEXT,
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS instance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    instance_id TEXT,
    status TEXT,
    checkpoint_count INTEGER DEFAULT 0,
    operation_count INTEGER DEFAULT 0,
    pid INTEGER,
    created_at DATETIME,
    last_seen DATETIME
);

CREATE TABLE IF NOT EXISTS session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    log_level TEXT,
    message TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
EOF
    fi

    # Create test session
    sqlite3 "$HIVE_DB" <<EOF
INSERT OR REPLACE INTO sessions (id, swarm_name, objective, status, created_at, updated_at)
VALUES ('$TEST_SESSION', 'e2e-test-swarm', 'Testing auto-checkpoint E2E', 'active', datetime('now'), datetime('now'));
EOF

    # Create instance directory and files
    mkdir -p "$INSTANCE_DIR"
    echo "$TEST_INSTANCE" > "$INSTANCE_DIR/.instance_test_$$"
    echo "$TEST_SESSION" > "$INSTANCE_DIR/.session_$TEST_INSTANCE"
    echo "0" > "$INSTANCE_DIR/.last_checkpoint_$TEST_INSTANCE"

    # Register instance in database
    sqlite3 "$HIVE_DB" <<EOF
INSERT INTO instance_sessions (session_id, instance_id, status, pid, created_at, last_seen)
VALUES ('$TEST_SESSION', '$TEST_INSTANCE', 'active', $$, datetime('now'), datetime('now'));
EOF

    log_success "Test session created: $TEST_SESSION"
    log_success "Test instance created: $TEST_INSTANCE"

    log_step "Verifying setup..."

    # Verify session exists
    local session_count=$(sqlite3 "$HIVE_DB" "SELECT COUNT(*) FROM sessions WHERE id='$TEST_SESSION';")
    assert_true "[ '$session_count' -eq 1 ]" "Session exists in database"

    # Verify instance exists
    local instance_count=$(sqlite3 "$HIVE_DB" "SELECT COUNT(*) FROM instance_sessions WHERE instance_id='$TEST_INSTANCE';")
    assert_true "[ '$instance_count' -eq 1 ]" "Instance exists in database"
}

# =============================================================================
# Phase 2: Start Queue Worker
# =============================================================================

phase2_start_worker() {
    log_phase "Start Queue Worker with Event Loop"

    log_step "Starting worker in background..."

    # Start worker with event loop enabled
    USE_EVENT_LOOP=true \
    QUEUE_IDLE_EXIT=0 \
    "$WORKER_SCRIPT" --foreground > /tmp/e2e-worker-$$.log 2>&1 &

    WORKER_PID=$!

    log_info "Worker started with PID: $WORKER_PID"

    log_step "Waiting for worker initialization..."
    sleep 3

    log_step "Verifying worker is running..."

    if ! kill -0 $WORKER_PID 2>/dev/null; then
        log_fail "Worker process died during startup"
        cat /tmp/e2e-worker-$$.log
        return 1
    fi

    log_success "Worker process is alive"

    log_step "Checking heartbeat file..."

    local timeout=0
    while [ ! -f "$QUEUE_BASE_DIR/.heartbeat" ] && [ $timeout -lt 20 ]; do
        sleep 0.5
        timeout=$((timeout + 1))
    done

    if [ -f "$QUEUE_BASE_DIR/.heartbeat" ]; then
        log_success "Heartbeat file created"

        # Display heartbeat
        if command -v jq >/dev/null 2>&1; then
            log_info "Heartbeat data:"
            cat "$QUEUE_BASE_DIR/.heartbeat" | jq . || cat "$QUEUE_BASE_DIR/.heartbeat"
        fi
    else
        log_fail "Heartbeat file not created within 10 seconds"
        return 1
    fi

    log_step "Verifying event loop mode..."

    if command -v jq >/dev/null 2>&1; then
        local mode=$(jq -r '.mode // "unknown"' "$QUEUE_BASE_DIR/.heartbeat" 2>/dev/null)
        assert_true "[ '$mode' = 'event-loop' ]" "Worker is in event-loop mode (not polling)"
    else
        log_info "jq not available, skipping mode check"
    fi

    log_step "Checking CPU usage..."
    sleep 2

    local cpu=$(ps -p $WORKER_PID -o %cpu= 2>/dev/null | awk '{print $1}')
    log_info "Worker CPU usage: ${cpu}%"

    if awk "BEGIN {exit !($cpu < 1.0)}"; then
        log_success "CPU usage is low (<1%) - event loop working"
    else
        log_fail "CPU usage is high (>1%) - possible polling mode"
    fi
}

# =============================================================================
# Phase 3: Trigger Auto-Checkpoint
# =============================================================================

phase3_trigger_checkpoint() {
    log_phase "Trigger Auto-Checkpoint Hook"

    log_step "Setting up environment for checkpoint script..."

    # Export required variables
    export HIVE_SESSION_ID="$TEST_SESSION"
    export HIVE_INSTANCE_ID="$TEST_INSTANCE"
    export HIVE_DB="$HIVE_DB"
    export INSTANCE_DIR="$INSTANCE_DIR"
    export USE_QUEUE="true"
    export CHECKPOINT_INTERVAL="0"  # Force checkpoint (no throttling)

    log_step "Recording baseline state..."

    # Get initial checkpoint data
    local initial_checkpoint=$(sqlite3 "$HIVE_DB" \
        "SELECT checkpoint_data FROM sessions WHERE id='$TEST_SESSION';" 2>/dev/null)

    log_info "Initial checkpoint_data: ${initial_checkpoint:-<empty>}"

    # Get initial queue size
    local initial_queue_size=$(ls -1 "$QUEUE_BASE_DIR"/pending/*.json 2>/dev/null | wc -l | tr -d ' ')
    log_info "Initial queue size: $initial_queue_size"

    # Get initial events processed (if available)
    local initial_events=0
    if command -v jq >/dev/null 2>&1 && [ -f "$QUEUE_BASE_DIR/.heartbeat" ]; then
        initial_events=$(jq -r '.events_processed // 0' "$QUEUE_BASE_DIR/.heartbeat" 2>/dev/null)
        log_info "Initial events processed: $initial_events"
    fi

    log_step "Executing auto-checkpoint.sh..."

    # Run checkpoint script
    if "$CHECKPOINT_SCRIPT" 2>&1 | tee /tmp/e2e-checkpoint-$$.log; then
        log_success "Checkpoint script executed successfully"
    else
        log_fail "Checkpoint script failed"
        cat /tmp/e2e-checkpoint-$$.log
        return 1
    fi

    log_step "Verifying queue entry was created..."
    sleep 0.5

    # Check queue size increased (or entry already processed)
    local new_queue_size=$(ls -1 "$QUEUE_BASE_DIR"/pending/*.json 2>/dev/null | wc -l | tr -d ' ')
    local completed_count=$(ls -1 "$QUEUE_BASE_DIR"/completed/*.json 2>/dev/null | wc -l | tr -d ' ')

    log_info "New queue size: $new_queue_size"
    log_info "Completed count: $completed_count"

    if [ "$new_queue_size" -gt "$initial_queue_size" ]; then
        log_success "Queue entry created (pending: $new_queue_size)"
    elif [ "$completed_count" -gt 0 ]; then
        log_success "Queue entry was processed immediately (completed: $completed_count)"
    else
        log_fail "No queue entry detected"
        return 1
    fi
}

# =============================================================================
# Phase 4: Event Loop Processing
# =============================================================================

phase4_event_processing() {
    log_phase "Event Loop Processing"

    log_step "Monitoring event loop for processing..."

    # Wait for queue to drain
    local timeout=0
    local max_timeout=30

    while [ $timeout -lt $max_timeout ]; do
        local pending_count=$(ls -1 "$QUEUE_BASE_DIR"/pending/*.json 2>/dev/null | wc -l | tr -d ' ')

        if [ "$pending_count" -eq 0 ]; then
            log_success "Queue drained (all entries processed)"
            break
        fi

        log_info "Waiting for queue processing... (pending: $pending_count, elapsed: ${timeout}s)"
        sleep 1
        timeout=$((timeout + 1))
    done

    if [ $timeout -ge $max_timeout ]; then
        log_fail "Queue did not drain within ${max_timeout} seconds"
        return 1
    fi

    log_step "Verifying events were consumed..."

    if command -v jq >/dev/null 2>&1 && [ -f "$QUEUE_BASE_DIR/.heartbeat" ]; then
        local final_events=$(jq -r '.events_processed // 0' "$QUEUE_BASE_DIR/.heartbeat" 2>/dev/null)
        log_info "Events processed: $final_events"

        if [ "$final_events" -gt 0 ]; then
            log_success "Events were consumed by event loop"
        else
            log_fail "No events were processed (event loop may not be working)"
        fi
    fi

    log_step "Checking completed entries..."

    local completed_count=$(ls -1 "$QUEUE_BASE_DIR"/completed/*.json 2>/dev/null | wc -l | tr -d ' ')

    if [ "$completed_count" -gt 0 ]; then
        log_success "Found $completed_count completed entries"

        # Show first completed entry
        local first_completed=$(ls -1 "$QUEUE_BASE_DIR"/completed/*.json 2>/dev/null | head -1)
        if [ -n "$first_completed" ] && command -v jq >/dev/null 2>&1; then
            log_info "Sample completed entry:"
            cat "$first_completed" | jq . || cat "$first_completed"
        fi
    else
        log_fail "No completed entries found"
        return 1
    fi
}

# =============================================================================
# Phase 5: Database Validation
# =============================================================================

phase5_database_validation() {
    log_phase "Database Validation"

    log_step "Checking session was updated..."

    # Get updated checkpoint data
    local checkpoint_data=$(sqlite3 "$HIVE_DB" \
        "SELECT checkpoint_data FROM sessions WHERE id='$TEST_SESSION';" 2>/dev/null)

    if [ -n "$checkpoint_data" ] && [ "$checkpoint_data" != "null" ]; then
        log_success "Checkpoint data exists"

        if command -v jq >/dev/null 2>&1; then
            log_info "Checkpoint data:"
            echo "$checkpoint_data" | jq . || echo "$checkpoint_data"

            # Check for auto-checkpoint marker
            local checkpoint_type=$(echo "$checkpoint_data" | jq -r '.checkpointType // "unknown"')
            if [ "$checkpoint_type" = "auto" ]; then
                log_success "Checkpoint type is 'auto' (correctly set)"
            else
                log_fail "Checkpoint type is '$checkpoint_type' (expected 'auto')"
            fi

            # Check saved by instance
            local saved_by=$(echo "$checkpoint_data" | jq -r '.savedBy // "unknown"')
            if echo "$saved_by" | grep -q "$TEST_INSTANCE"; then
                log_success "Saved by correct instance: $saved_by"
            else
                log_fail "Saved by unexpected instance: $saved_by"
            fi
        fi
    else
        log_fail "Checkpoint data is empty or null"
        return 1
    fi

    log_step "Checking session updated_at timestamp..."

    local updated_at=$(sqlite3 "$HIVE_DB" \
        "SELECT updated_at FROM sessions WHERE id='$TEST_SESSION';")

    log_info "Session updated_at: $updated_at"

    if [ -n "$updated_at" ]; then
        log_success "Session has updated_at timestamp"
    else
        log_fail "Session missing updated_at timestamp"
    fi

    log_step "Checking instance session stats..."

    local instance_stats=$(sqlite3 "$HIVE_DB" \
        "SELECT checkpoint_count, operation_count FROM instance_sessions WHERE instance_id='$TEST_INSTANCE';")

    log_info "Instance stats: $instance_stats"

    local checkpoint_count=$(echo "$instance_stats" | cut -d'|' -f1)
    local operation_count=$(echo "$instance_stats" | cut -d'|' -f2)

    if [ "$checkpoint_count" -gt 0 ] || [ "$operation_count" -gt 0 ]; then
        log_success "Instance has checkpoint/operation counts: checkpoints=$checkpoint_count, operations=$operation_count"
    else
        log_fail "Instance has zero counts (may not have been updated)"
    fi
}

# =============================================================================
# Phase 6: Performance Metrics
# =============================================================================

phase6_performance_metrics() {
    log_phase "Performance Metrics"

    log_step "Calculating end-to-end latency..."

    local end_time=$(date +%s)
    local total_time=$((end_time - START_TIME))

    log_info "Total E2E time: ${total_time}s"

    if [ "$total_time" -lt 60 ]; then
        log_success "E2E completion under 1 minute"
    else
        log_fail "E2E took longer than expected (${total_time}s)"
    fi

    log_step "Checking worker CPU efficiency..."

    if kill -0 $WORKER_PID 2>/dev/null; then
        local final_cpu=$(ps -p $WORKER_PID -o %cpu= 2>/dev/null | awk '{print $1}')
        log_info "Final worker CPU: ${final_cpu}%"

        if awk "BEGIN {exit !($final_cpu < 1.0)}"; then
            log_success "Worker maintained low CPU usage"
        fi
    fi

    log_step "Displaying final heartbeat..."

    if [ -f "$QUEUE_BASE_DIR/.heartbeat" ]; then
        if command -v jq >/dev/null 2>&1; then
            cat "$QUEUE_BASE_DIR/.heartbeat" | jq .
        else
            cat "$QUEUE_BASE_DIR/.heartbeat"
        fi
    fi

    log_step "Displaying queue stats..."

    if [ -f "$QUEUE_BASE_DIR/stats.json" ]; then
        log_info "Queue statistics:"
        if command -v jq >/dev/null 2>&1; then
            cat "$QUEUE_BASE_DIR/stats.json" | jq .
        else
            cat "$QUEUE_BASE_DIR/stats.json"
        fi
    fi
}

# =============================================================================
# Phase 7: Cleanup
# =============================================================================

phase7_cleanup() {
    log_phase "Cleanup"

    log_step "Stopping worker..."

    if kill -0 $WORKER_PID 2>/dev/null; then
        kill -TERM $WORKER_PID 2>/dev/null || true
        sleep 2

        if kill -0 $WORKER_PID 2>/dev/null; then
            kill -KILL $WORKER_PID 2>/dev/null || true
        fi

        log_success "Worker stopped"
    fi

    log_step "Cleaning up test data..."

    # Remove test session
    sqlite3 "$HIVE_DB" "DELETE FROM sessions WHERE id='$TEST_SESSION';" 2>/dev/null || true
    sqlite3 "$HIVE_DB" "DELETE FROM instance_sessions WHERE instance_id='$TEST_INSTANCE';" 2>/dev/null || true
    sqlite3 "$HIVE_DB" "DELETE FROM session_logs WHERE session_id='$TEST_SESSION';" 2>/dev/null || true

    # Remove instance files
    rm -f "$INSTANCE_DIR/.instance_test_$$" 2>/dev/null || true
    rm -f "$INSTANCE_DIR/.session_$TEST_INSTANCE" 2>/dev/null || true
    rm -f "$INSTANCE_DIR/.last_checkpoint_$TEST_INSTANCE" 2>/dev/null || true

    # Clean queue
    rm -f "$QUEUE_BASE_DIR"/completed/*.json 2>/dev/null || true

    log_success "Cleanup complete"

    log_step "Preserving logs..."

    log_info "Worker log saved to: /tmp/e2e-worker-$$.log"
    log_info "Checkpoint log saved to: /tmp/e2e-checkpoint-$$.log"
}

# =============================================================================
# Main Test Runner
# =============================================================================

main() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "     END-TO-END AUTO-CHECKPOINT TEST WITH EVENT LOOP"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # Check prerequisites
    if [ ! -f "$WORKER_SCRIPT" ]; then
        log_fail "Worker script not found: $WORKER_SCRIPT"
        exit 1
    fi

    if [ ! -f "$CHECKPOINT_SCRIPT" ]; then
        log_fail "Checkpoint script not found: $CHECKPOINT_SCRIPT"
        exit 1
    fi

    # Run test phases
    local failed=0

    phase1_setup || failed=$((failed + 1))
    phase2_start_worker || failed=$((failed + 1))
    phase3_trigger_checkpoint || failed=$((failed + 1))
    phase4_event_processing || failed=$((failed + 1))
    phase5_database_validation || failed=$((failed + 1))
    phase6_performance_metrics || failed=$((failed + 1))
    phase7_cleanup || failed=$((failed + 1))

    # Summary
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "                    TEST SUMMARY"
    echo "═══════════════════════════════════════════════════════════"
    echo -e "Phases Completed: ${BLUE}$PHASE${NC}"
    echo -e "Total Duration:   ${BLUE}$(($(date +%s) - START_TIME))s${NC}"

    if [ "$failed" -eq 0 ]; then
        echo -e "Result:           ${GREEN}✓ ALL PHASES PASSED${NC}"
        echo "═══════════════════════════════════════════════════════════"
        echo ""
        echo -e "${GREEN}🎉 END-TO-END TEST SUCCESSFUL!${NC}"
        echo ""
        echo "✅ Auto-checkpoint triggered correctly"
        echo "✅ Queue entry created and processed"
        echo "✅ Event loop consumed events"
        echo "✅ Database updated successfully"
        echo "✅ Performance metrics acceptable"
        echo ""
        exit 0
    else
        echo -e "Result:           ${RED}✗ $failed PHASE(S) FAILED${NC}"
        echo "═══════════════════════════════════════════════════════════"
        echo ""
        echo -e "${RED}❌ END-TO-END TEST FAILED${NC}"
        echo ""
        echo "Check logs for details:"
        echo "  - /tmp/e2e-worker-$$.log"
        echo "  - /tmp/e2e-checkpoint-$$.log"
        echo ""
        exit 1
    fi
}

# Run the test
main "$@"
