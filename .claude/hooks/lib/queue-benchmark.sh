#!/bin/bash
# Queue Benchmark - Performance Testing for Queue Implementations
#
# Compares performance of:
# - Direct SQLite writes
# - Original queue implementation (queue-writer.sh)
# - Optimized queue implementation (queue-ultrafast.sh)
#
# Usage:
#   ./queue-benchmark.sh [iterations]

# Note: Avoid set -u for Bash 3.2 compatibility on macOS
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ITERATIONS="${1:-100}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# Setup
# ============================================================================

setup() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Queue Performance Benchmark${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "Iterations: $ITERATIONS"
    echo "Bash version: $BASH_VERSION"
    echo "Date: $(date)"
    echo ""

    # Create test database
    TEST_DIR=$(mktemp -d)
    TEST_DB="$TEST_DIR/test.db"
    TEST_QUEUE="$TEST_DIR/queue"

    export HIVE_DB="$TEST_DB"
    export QUEUE_DIR="$TEST_QUEUE"

    # Initialize test database
    sqlite3 "$TEST_DB" <<-'SQL'
		CREATE TABLE sessions (
		    id TEXT PRIMARY KEY,
		    checkpoint_data TEXT DEFAULT '{}',
		    updated_at TEXT
		);
		CREATE TABLE session_logs (
		    id INTEGER PRIMARY KEY AUTOINCREMENT,
		    session_id TEXT,
		    log_level TEXT,
		    message TEXT,
		    data TEXT
		);
		INSERT INTO sessions (id, checkpoint_data) VALUES ('test-session', '{}');
	SQL

    mkdir -p "$TEST_QUEUE/pending"

    echo -e "Test database: ${CYAN}$TEST_DB${NC}"
    echo -e "Test queue: ${CYAN}$TEST_QUEUE${NC}"
    echo ""
}

cleanup() {
    rm -rf "$TEST_DIR" 2>/dev/null || true
}

trap cleanup EXIT

# ============================================================================
# Timing Functions
# ============================================================================

# Get high-resolution time in microseconds
get_time_us() {
    if [[ -n "${EPOCHREALTIME:-}" ]]; then
        # Bash 5.0+: Use builtin (microsecond precision)
        echo "${EPOCHREALTIME//./}"
    else
        # Fallback: date with nanoseconds (macOS gdate, Linux date)
        if command -v gdate >/dev/null 2>&1; then
            gdate +%s%N | cut -c1-16
        else
            date +%s%N 2>/dev/null | cut -c1-16 || echo "$(($(date +%s) * 1000000))"
        fi
    fi
}

# Calculate statistics from array of timings
calc_stats() {
    local count=$#

    if [ "$count" -eq 0 ]; then
        echo "0 0 0 0 0 0"
        return
    fi

    # Sort timings using temp file (Bash 3.2 compatible)
    local sorted_str
    sorted_str=$(printf '%s\n' "$@" | sort -n)

    # Read into array (Bash 3.2 compatible)
    local i=0 sum=0 min=0 max=0
    local sorted_arr=()
    while IFS= read -r val; do
        sorted_arr[i]=$val
        ((sum += val)) || true
        if [ "$i" -eq 0 ]; then
            min=$val
        fi
        max=$val
        ((i++)) || true
    done <<< "$sorted_str"

    local actual_count=${#sorted_arr[@]}
    if [ "$actual_count" -eq 0 ]; then
        echo "0 0 0 0 0 0"
        return
    fi

    # Mean
    local mean=$((sum / actual_count))

    # Median (middle element)
    local median_idx=$((actual_count / 2))
    local median=${sorted_arr[$median_idx]}

    # P95
    local p95_idx=$((actual_count * 95 / 100))
    [ "$p95_idx" -ge "$actual_count" ] && p95_idx=$((actual_count - 1))
    local p95=${sorted_arr[$p95_idx]}

    # P99
    local p99_idx=$((actual_count * 99 / 100))
    [ "$p99_idx" -ge "$actual_count" ] && p99_idx=$((actual_count - 1))
    local p99=${sorted_arr[$p99_idx]}

    echo "$mean $median $min $max $p95 $p99"
}

print_stats() {
    local name="$1"
    local mean="$2"
    local median="$3"
    local min="$4"
    local max="$5"
    local p95="$6"
    local p99="$7"

    # Convert microseconds to milliseconds with 3 decimal places
    local mean_ms=$(awk "BEGIN {printf \"%.3f\", $mean/1000}")
    local median_ms=$(awk "BEGIN {printf \"%.3f\", $median/1000}")
    local min_ms=$(awk "BEGIN {printf \"%.3f\", $min/1000}")
    local max_ms=$(awk "BEGIN {printf \"%.3f\", $max/1000}")
    local p95_ms=$(awk "BEGIN {printf \"%.3f\", $p95/1000}")
    local p99_ms=$(awk "BEGIN {printf \"%.3f\", $p99/1000}")

    # Color based on performance
    local color="$GREEN"
    if (( $(awk "BEGIN {print ($mean > 10000)}") )); then
        color="$RED"
    elif (( $(awk "BEGIN {print ($mean > 1000)}") )); then
        color="$YELLOW"
    fi

    printf "%-30s %s%8s ms%s  median: %8s ms  min: %8s ms  max: %8s ms  P95: %8s ms  P99: %8s ms\n" \
        "$name" "$color" "$mean_ms" "$NC" "$median_ms" "$min_ms" "$max_ms" "$p95_ms" "$p99_ms"
}

# ============================================================================
# Benchmarks
# ============================================================================

# Benchmark 1: Direct SQLite Write
benchmark_direct_sqlite() {
    echo -e "\n${YELLOW}Benchmark: Direct SQLite Write${NC}"

    local -a timings=()
    local i start end duration

    for ((i = 0; i < ITERATIONS; i++)); do
        start=$(get_time_us)

        sqlite3 "$TEST_DB" "UPDATE sessions SET updated_at = datetime('now') WHERE id = 'test-session';" 2>/dev/null

        end=$(get_time_us)
        duration=$((end - start))
        timings+=("$duration")
    done

    local stats
    stats=$(calc_stats "${timings[@]}")
    read -r mean median min max p95 p99 <<< "$stats"
    print_stats "Direct SQLite" "$mean" "$median" "$min" "$max" "$p95" "$p99"
}

# Benchmark 2: Original Queue Writer
benchmark_original_queue() {
    echo -e "\n${YELLOW}Benchmark: Original Queue Writer${NC}"

    # Source original queue library
    if [[ ! -f "$SCRIPT_DIR/queue-writer.sh" ]]; then
        echo -e "${RED}queue-writer.sh not found, skipping${NC}"
        return
    fi

    source "$SCRIPT_DIR/queue-lib.sh"
    source "$SCRIPT_DIR/queue-writer.sh"

    # Initialize
    queue_init >/dev/null 2>&1

    local -a timings=()
    local i start end duration

    for ((i = 0; i < ITERATIONS; i++)); do
        start=$(get_time_us)

        queue_enqueue "update_session" 5 "UPDATE sessions SET updated_at = datetime('now') WHERE id = 'test-session';" "{}" >/dev/null 2>&1

        end=$(get_time_us)
        duration=$((end - start))
        timings+=("$duration")
    done

    local stats
    stats=$(calc_stats "${timings[@]}")
    read -r mean median min max p95 p99 <<< "$stats"
    print_stats "Original Queue" "$mean" "$median" "$min" "$max" "$p95" "$p99"

    # Clean up queue
    queue_reset >/dev/null 2>&1 || true
}

# Benchmark 3: Ultrafast Queue
benchmark_ultrafast_queue() {
    echo -e "\n${YELLOW}Benchmark: Ultrafast Queue${NC}"

    # Source ultrafast queue library
    if [[ ! -f "$SCRIPT_DIR/queue-ultrafast.sh" ]]; then
        echo -e "${RED}queue-ultrafast.sh not found, skipping${NC}"
        return
    fi

    # Reset state
    unset _QUEUE_INITIALIZED _QUEUE_SEQ _WORKER_CHECK_TIME _WORKER_IS_RUNNING 2>/dev/null || true

    source "$SCRIPT_DIR/queue-ultrafast.sh"

    # Initialize
    queue_fast_init >/dev/null 2>&1

    local -a timings=()
    local i start end duration

    for ((i = 0; i < ITERATIONS; i++)); do
        start=$(get_time_us)

        queue_fast "UPDATE sessions SET updated_at = datetime('now') WHERE id = 'test-session';" 5

        end=$(get_time_us)
        duration=$((end - start))
        timings+=("$duration")
    done

    local stats
    stats=$(calc_stats "${timings[@]}")
    read -r mean median min max p95 p99 <<< "$stats"
    print_stats "Ultrafast Queue" "$mean" "$median" "$min" "$max" "$p95" "$p99"

    # Show pending count
    local pending
    pending=$(queue_fast_pending_count)
    echo -e "  Pending entries: ${CYAN}$pending${NC}"

    # Clean up queue files
    rm -f "$QUEUE_DIR/pending"/*.msg 2>/dev/null || true
}

# Benchmark 4: Ultrafast Queue (typed)
benchmark_ultrafast_typed() {
    echo -e "\n${YELLOW}Benchmark: Ultrafast Queue (typed)${NC}"

    if [[ ! -f "$SCRIPT_DIR/queue-ultrafast.sh" ]]; then
        echo -e "${RED}queue-ultrafast.sh not found, skipping${NC}"
        return
    fi

    # Reset state
    unset _QUEUE_INITIALIZED _QUEUE_SEQ _WORKER_CHECK_TIME _WORKER_IS_RUNNING 2>/dev/null || true

    source "$SCRIPT_DIR/queue-ultrafast.sh"
    queue_fast_init >/dev/null 2>&1

    local -a timings=()
    local i start end duration

    for ((i = 0; i < ITERATIONS; i++)); do
        start=$(get_time_us)

        queue_fast_typed "UPDATE sessions SET updated_at = datetime('now') WHERE id = 'test-session';" "update_session" 5

        end=$(get_time_us)
        duration=$((end - start))
        timings+=("$duration")
    done

    local stats
    stats=$(calc_stats "${timings[@]}")
    read -r mean median min max p95 p99 <<< "$stats"
    print_stats "Ultrafast Typed" "$mean" "$median" "$min" "$max" "$p95" "$p99"

    rm -f "$QUEUE_DIR/pending"/*.msg 2>/dev/null || true
}

# Benchmark 5: File I/O baseline
benchmark_file_io() {
    echo -e "\n${YELLOW}Benchmark: Raw File I/O (baseline)${NC}"

    local test_file="$TEST_DIR/test.msg"
    local test_content="UPDATE sessions SET updated_at = datetime('now') WHERE id = 'test-session';"

    local -a timings=()
    local i start end duration

    for ((i = 0; i < ITERATIONS; i++)); do
        start=$(get_time_us)

        printf '%s\n' "$test_content" > "$test_file"

        end=$(get_time_us)
        duration=$((end - start))
        timings+=("$duration")

        rm -f "$test_file"
    done

    local stats
    stats=$(calc_stats "${timings[@]}")
    read -r mean median min max p95 p99 <<< "$stats"
    print_stats "Raw File Write" "$mean" "$median" "$min" "$max" "$p95" "$p99"
}

# Benchmark 6: printf to unique file
benchmark_unique_file() {
    echo -e "\n${YELLOW}Benchmark: Unique File Write (atomic)${NC}"

    local counter=0
    local -a timings=()
    local i start end duration

    for ((i = 0; i < ITERATIONS; i++)); do
        ((counter++))
        start=$(get_time_us)

        printf '%s\n' "UPDATE sessions SET updated_at = datetime('now') WHERE id = 'test-session';" \
            > "$TEST_DIR/$EPOCHSECONDS.$counter.msg" 2>/dev/null || \
            > "$TEST_DIR/$(date +%s).$counter.msg"

        end=$(get_time_us)
        duration=$((end - start))
        timings+=("$duration")
    done

    local stats
    stats=$(calc_stats "${timings[@]}")
    read -r mean median min max p95 p99 <<< "$stats"
    print_stats "Atomic File Create" "$mean" "$median" "$min" "$max" "$p95" "$p99"

    rm -f "$TEST_DIR"/*.msg 2>/dev/null || true
}

# ============================================================================
# Worker Processing Benchmark
# ============================================================================

benchmark_worker_processing() {
    echo -e "\n${YELLOW}Benchmark: Worker Batch Processing${NC}"

    # Create test entries
    local num_entries=100
    echo "  Creating $num_entries test entries..."

    mkdir -p "$QUEUE_DIR/pending"
    for ((i = 0; i < num_entries; i++)); do
        printf 'INSERT INTO session_logs (session_id, log_level, message) VALUES ('\''test-session'\'', '\''info'\'', '\''Test message %d'\'');\n' "$i" \
            > "$QUEUE_DIR/pending/$(date +%s).05.$$.$(printf '%06d' $i).msg"
    done

    # Time batch processing
    local start end duration

    if [[ -f "$SCRIPT_DIR/queue-worker-optimized.sh" ]]; then
        # Source worker functions
        source "$SCRIPT_DIR/queue-worker-optimized.sh" 2>/dev/null || true

        start=$(get_time_us)

        # Process all pending
        while has_pending 2>/dev/null; do
            process_batch 2>/dev/null || break
        done

        end=$(get_time_us)
        duration=$((end - start))

        local duration_ms=$(awk "BEGIN {printf \"%.3f\", $duration/1000}")
        local per_entry_ms=$(awk "BEGIN {printf \"%.3f\", $duration/1000/$num_entries}")

        echo -e "  Total time: ${GREEN}${duration_ms} ms${NC}"
        echo -e "  Per entry:  ${GREEN}${per_entry_ms} ms${NC}"
        echo -e "  Throughput: ${CYAN}$(awk "BEGIN {printf \"%.0f\", $num_entries/($duration/1000000)}") entries/sec${NC}"
    else
        echo -e "${RED}queue-worker-optimized.sh not found, skipping${NC}"
    fi

    # Clean up
    rm -f "$QUEUE_DIR/pending"/*.msg 2>/dev/null || true
}

# ============================================================================
# Summary
# ============================================================================

print_summary() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Performance Summary${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "Target Performance:"
    echo -e "  Queue write:      ${GREEN}< 1 ms${NC}"
    echo -e "  Worker processing: ${GREEN}< 10 ms per batch${NC}"
    echo -e "  Total hook overhead: ${GREEN}< 10 ms${NC}"
    echo ""
    echo "Recommendations:"
    echo "  1. Use queue-ultrafast.sh for hook writes"
    echo "  2. Use queue-worker-optimized.sh for background processing"
    echo "  3. Consider tmpfs for queue directory on high-load systems"
    echo "  4. Increase WORKER_BATCH_SIZE for higher throughput"
    echo ""
}

# ============================================================================
# Main
# ============================================================================

main() {
    setup

    echo -e "${BLUE}Running Benchmarks...${NC}"
    echo "========================================="

    benchmark_file_io
    benchmark_unique_file
    benchmark_direct_sqlite
    benchmark_original_queue
    benchmark_ultrafast_queue
    benchmark_ultrafast_typed
    benchmark_worker_processing

    print_summary

    echo -e "${GREEN}Benchmark complete!${NC}"
}

main "$@"
