#!/bin/bash
# Simple Queue Benchmark - Measures actual overhead with minimal instrumentation
#
# Usage: ./queue-bench-simple.sh [iterations]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ITERATIONS="${1:-100}"

echo "=============================================="
echo "Queue Performance Benchmark (Simple)"
echo "=============================================="
echo ""
echo "Iterations: $ITERATIONS"
echo "Bash: $BASH_VERSION"
echo ""

# Create test environment
TEST_DIR=$(mktemp -d)
export HIVE_DB="$TEST_DIR/test.db"
export QUEUE_DIR="$TEST_DIR/queue"
mkdir -p "$QUEUE_DIR/pending"

# Create test database
sqlite3 "$HIVE_DB" "CREATE TABLE sessions (id TEXT, updated_at TEXT); INSERT INTO sessions (id) VALUES ('test');"

cleanup() { rm -rf "$TEST_DIR" 2>/dev/null; }
trap cleanup EXIT

# Helper: time N iterations
time_iterations() {
    local name="$1"
    local setup="$2"
    local cmd="$3"
    local cleanup_cmd="${4:-true}"

    # Setup
    eval "$setup" 2>/dev/null || true

    # Time with /usr/bin/time or date
    local start_s start_ns end_s end_ns

    # Use date for timing (portable)
    start_s=$(date +%s)

    for ((i=0; i<ITERATIONS; i++)); do
        eval "$cmd" 2>/dev/null || true
    done

    end_s=$(date +%s)
    local elapsed=$((end_s - start_s))

    # Calculate per-op time
    if [ "$elapsed" -eq 0 ]; then
        echo "$name: < 1 second total (< $(( 1000 / ITERATIONS )) ms per op)"
    else
        local ms_per_op=$(( (elapsed * 1000) / ITERATIONS ))
        echo "$name: ${elapsed}s total (~${ms_per_op}ms per op)"
    fi

    # Cleanup
    eval "$cleanup_cmd" 2>/dev/null || true
}

echo "----------------------------------------------"
echo "Benchmark 1: Direct SQLite Write"
echo "----------------------------------------------"
time_iterations \
    "Direct SQLite" \
    "" \
    "sqlite3 \"\$HIVE_DB\" \"UPDATE sessions SET updated_at = datetime('now') WHERE id = 'test';\""

echo ""
echo "----------------------------------------------"
echo "Benchmark 2: Raw File Write"
echo "----------------------------------------------"
time_iterations \
    "File printf" \
    "" \
    "printf '%s' 'test data' > \"\$TEST_DIR/test.tmp\"" \
    "rm -f \"\$TEST_DIR/test.tmp\""

echo ""
echo "----------------------------------------------"
echo "Benchmark 3: Atomic File Create (unique name)"
echo "----------------------------------------------"
SEQ=0
time_iterations \
    "Atomic create" \
    "" \
    "SEQ=\$((SEQ+1)); printf '%s' 'test' > \"\$QUEUE_DIR/pending/\$SEQ.msg\"" \
    "rm -f \"\$QUEUE_DIR/pending\"/*.msg"

echo ""
echo "----------------------------------------------"
echo "Benchmark 4: Ultrafast Queue (if available)"
echo "----------------------------------------------"
if [ -f "$SCRIPT_DIR/queue-ultrafast.sh" ]; then
    # Source in subshell to avoid polluting environment
    (
        source "$SCRIPT_DIR/queue-ultrafast.sh" 2>/dev/null

        start_s=$(date +%s)

        for ((i=0; i<ITERATIONS; i++)); do
            queue_fast "UPDATE sessions SET updated_at = datetime('now');" 5 2>/dev/null || true
        done

        end_s=$(date +%s)
        elapsed=$((end_s - start_s))

        if [ "$elapsed" -eq 0 ]; then
            echo "Ultrafast Queue: < 1 second total (< $(( 1000 / ITERATIONS )) ms per op)"
        else
            ms_per_op=$(( (elapsed * 1000) / ITERATIONS ))
            echo "Ultrafast Queue: ${elapsed}s total (~${ms_per_op}ms per op)"
        fi

        pending=$(queue_fast_pending_count 2>/dev/null || echo "?")
        echo "  -> Pending entries: $pending"
    )
    rm -f "$QUEUE_DIR/pending"/*.msg 2>/dev/null
else
    echo "queue-ultrafast.sh not found, skipping"
fi

echo ""
echo "----------------------------------------------"
echo "Benchmark 5: Minimal Queue (if available)"
echo "----------------------------------------------"
if [ -f "$SCRIPT_DIR/queue-minimal.sh" ]; then
    (
        source "$SCRIPT_DIR/queue-minimal.sh" 2>/dev/null
        queue_minimal_init 2>/dev/null

        start_s=$(date +%s)

        for ((i=0; i<ITERATIONS; i++)); do
            queue_minimal "UPDATE sessions SET updated_at = datetime('now');" 5 2>/dev/null || true
        done

        end_s=$(date +%s)
        elapsed=$((end_s - start_s))

        if [ "$elapsed" -eq 0 ]; then
            echo "Minimal Queue: < 1 second total (< $(( 1000 / ITERATIONS )) ms per op)"
        else
            ms_per_op=$(( (elapsed * 1000) / ITERATIONS ))
            echo "Minimal Queue: ${elapsed}s total (~${ms_per_op}ms per op)"
        fi

        count=$(ls -1 "$QUEUE_DIR/pending"/*.msg 2>/dev/null | wc -l | tr -d ' ')
        echo "  -> Pending entries: $count"
    )
    rm -f "$QUEUE_DIR/pending"/*.msg 2>/dev/null
else
    echo "queue-minimal.sh not found, skipping"
fi

echo ""
echo "----------------------------------------------"
echo "Benchmark 6: Original Queue Writer (if available)"
echo "----------------------------------------------"
if [ -f "$SCRIPT_DIR/queue-lib.sh" ] && [ -f "$SCRIPT_DIR/queue-writer.sh" ]; then
    (
        source "$SCRIPT_DIR/queue-lib.sh" 2>/dev/null
        source "$SCRIPT_DIR/queue-writer.sh" 2>/dev/null

        queue_init 2>/dev/null || true

        start_s=$(date +%s)

        for ((i=0; i<ITERATIONS; i++)); do
            queue_enqueue "test" 5 "UPDATE sessions SET updated_at = datetime('now');" "{}" 2>/dev/null || true
        done

        end_s=$(date +%s)
        elapsed=$((end_s - start_s))

        if [ "$elapsed" -eq 0 ]; then
            echo "Original Queue: < 1 second total (< $(( 1000 / ITERATIONS )) ms per op)"
        else
            ms_per_op=$(( (elapsed * 1000) / ITERATIONS ))
            echo "Original Queue: ${elapsed}s total (~${ms_per_op}ms per op)"
        fi
    )
else
    echo "queue-lib.sh/queue-writer.sh not found, skipping"
fi

echo ""
echo "=============================================="
echo "Summary"
echo "=============================================="
echo ""
echo "Target performance:"
echo "  Queue write: < 1ms per operation"
echo "  Ideal: File I/O baseline + minimal overhead"
echo ""
echo "Optimization strategies:"
echo "  1. Use queue-ultrafast.sh (atomic file, no locking)"
echo "  2. Avoid process spawns in hot path"
echo "  3. Cache timestamps, batch operations"
echo ""
