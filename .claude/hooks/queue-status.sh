#!/bin/bash
# =============================================================================
# Queue Status Monitoring Tool
# =============================================================================
#
# Displays real-time status of the queue system.
#
# USAGE:
#   ./queue-status.sh              # Show current status
#   ./queue-status.sh --watch      # Continuous monitoring
#   ./queue-status.sh --json       # Output in JSON format
#   ./queue-status.sh --stats      # Show detailed statistics
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Source queue library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/queue-lib.sh" ]; then
    source "$SCRIPT_DIR/lib/queue-lib.sh"
else
    echo "ERROR: queue-lib.sh not found" >&2
    exit 1
fi

# =============================================================================
# Display Functions
# =============================================================================

show_status() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo -e "${BOLD}Queue System Status${NC}"
    echo -e "Time: $timestamp"
    echo ""

    # Queue availability
    if queue_is_available; then
        echo -e "Status: ${GREEN}Available${NC}"
    else
        echo -e "Status: ${RED}Not Initialized${NC}"
        echo ""
        echo "Run: ./queue-init.sh to initialize"
        return 1
    fi

    echo ""

    # Queue sizes
    local pending processing completed failed
    pending=$(queue_size)
    processing=$(queue_processing_count)
    completed=$(ls -1 "$QUEUE_COMPLETED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
    failed=$(ls -1 "$QUEUE_FAILED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')

    echo -e "${BOLD}Queue Depths:${NC}"
    echo -e "  Pending:    ${CYAN}$pending${NC}"
    echo -e "  Processing: ${YELLOW}$processing${NC}"
    echo -e "  Completed:  ${GREEN}$completed${NC}"
    echo -e "  Failed:     ${RED}$failed${NC}"

    echo ""

    # Worker status
    echo -e "${BOLD}Worker:${NC}"
    if queue_worker_is_running; then
        local worker_pid
        worker_pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)
        echo -e "  Status: ${GREEN}Running${NC} (PID: $worker_pid)"

        # Get worker uptime
        if [ -n "$worker_pid" ]; then
            local start_time
            start_time=$(ps -p "$worker_pid" -o lstart= 2>/dev/null | head -1)
            if [ -n "$start_time" ]; then
                echo -e "  Started: $start_time"
            fi
        fi
    else
        echo -e "  Status: ${YELLOW}Not Running${NC}"
        echo -e "  (Will start automatically on next queue write)"
    fi

    echo ""

    # Statistics
    echo -e "${BOLD}Statistics:${NC}"
    local stats
    stats=$(queue_stats_get)

    if command -v jq >/dev/null 2>&1; then
        local enqueued processed failed_count retried direct
        enqueued=$(echo "$stats" | jq -r '.enqueued // 0')
        processed=$(echo "$stats" | jq -r '.processed // 0')
        failed_count=$(echo "$stats" | jq -r '.failed // 0')
        retried=$(echo "$stats" | jq -r '.retried // 0')
        direct=$(echo "$stats" | jq -r '.direct // 0')

        echo -e "  Enqueued:  $enqueued"
        echo -e "  Processed: $processed"
        echo -e "  Failed:    $failed_count"
        echo -e "  Retried:   $retried"
        echo -e "  Direct:    $direct"

        # Calculate success rate
        local total=$((processed + failed_count))
        if [ "$total" -gt 0 ]; then
            local success_rate=$((processed * 100 / total))
            echo ""
            echo -e "  Success Rate: ${success_rate}%"
        fi
    else
        echo "  $stats"
    fi

    echo ""

    # Autostart status (if autostart library is available)
    if [ "$QUEUE_AUTOSTART_AVAILABLE" = "true" ]; then
        echo -e "${BOLD}Auto-Start System:${NC}"
        echo -e "  Status: ${GREEN}Enabled${NC}"

        # Health cache status
        if type queue_health_cache_status &>/dev/null; then
            local cache_status
            cache_status=$(queue_health_cache_status)
            case "$cache_status" in
                fresh*)
                    echo -e "  Health Cache: ${GREEN}$cache_status${NC}"
                    ;;
                expired*)
                    echo -e "  Health Cache: ${YELLOW}$cache_status${NC}"
                    ;;
                *)
                    echo -e "  Health Cache: ${CYAN}$cache_status${NC}"
                    ;;
            esac
        fi

        # Heartbeat status
        if type queue_heartbeat_status &>/dev/null; then
            local hb_status
            hb_status=$(queue_heartbeat_status)
            case "$hb_status" in
                healthy*)
                    echo -e "  Heartbeat: ${GREEN}$hb_status${NC}"
                    ;;
                stale*)
                    echo -e "  Heartbeat: ${RED}$hb_status${NC}"
                    ;;
                *)
                    echo -e "  Heartbeat: ${CYAN}$hb_status${NC}"
                    ;;
            esac
        fi

        # Startup lock status
        local startup_lock_dir="$QUEUE_BASE_DIR/.startup_lock"
        if [ -d "$startup_lock_dir" ]; then
            echo -e "  Startup Lock: ${YELLOW}Active (startup in progress)${NC}"
        else
            echo -e "  Startup Lock: ${GREEN}Clear${NC}"
        fi

        echo ""
    fi

    # Recent log entries
    if [ -f "$QUEUE_WORKER_LOG" ]; then
        echo -e "${BOLD}Recent Log Entries:${NC}"
        tail -5 "$QUEUE_WORKER_LOG" 2>/dev/null | sed 's/^/  /'
    fi
}

show_status_json() {
    local pending processing completed failed
    pending=$(queue_size)
    processing=$(queue_processing_count)
    completed=$(ls -1 "$QUEUE_COMPLETED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
    failed=$(ls -1 "$QUEUE_FAILED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')

    local worker_running="false"
    local worker_pid=""
    if queue_worker_is_running; then
        worker_running="true"
        worker_pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)
    fi

    local stats
    stats=$(queue_stats_get)

    if command -v jq >/dev/null 2>&1; then
        jq -n \
            --arg timestamp "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
            --argjson pending "$pending" \
            --argjson processing "$processing" \
            --argjson completed "$completed" \
            --argjson failed "$failed" \
            --argjson worker_running "$worker_running" \
            --arg worker_pid "$worker_pid" \
            --argjson stats "$stats" \
            '{
                timestamp: $timestamp,
                queue: {
                    pending: $pending,
                    processing: $processing,
                    completed: $completed,
                    failed: $failed
                },
                worker: {
                    running: $worker_running,
                    pid: $worker_pid
                },
                stats: $stats
            }'
    else
        # Fallback without jq
        cat << EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "queue": {
    "pending": $pending,
    "processing": $processing,
    "completed": $completed,
    "failed": $failed
  },
  "worker": {
    "running": $worker_running,
    "pid": "$worker_pid"
  },
  "stats": $stats
}
EOF
    fi
}

show_stats() {
    echo -e "${BOLD}Detailed Queue Statistics${NC}"
    echo ""

    # Queue stats
    echo -e "${BOLD}Queue Metrics:${NC}"
    local stats
    stats=$(queue_stats_get)
    echo "  Raw: $stats"

    echo ""

    # Directory sizes
    echo -e "${BOLD}Directory Sizes:${NC}"
    for dir in pending processing completed failed; do
        local path="$QUEUE_BASE_DIR/$dir"
        if [ -d "$path" ]; then
            local count size
            count=$(ls -1 "$path"/*.json 2>/dev/null | wc -l | tr -d ' ')
            size=$(du -sh "$path" 2>/dev/null | cut -f1)
            echo "  $dir: $count files ($size)"
        fi
    done

    echo ""

    # Log file size
    if [ -f "$QUEUE_WORKER_LOG" ]; then
        local log_size
        log_size=$(du -sh "$QUEUE_WORKER_LOG" 2>/dev/null | cut -f1)
        echo -e "${BOLD}Log File:${NC} $log_size"
    fi

    echo ""

    # Oldest pending entry
    local oldest_pending
    oldest_pending=$(ls -1t "$QUEUE_PENDING_DIR"/*.json 2>/dev/null | tail -1)
    if [ -n "$oldest_pending" ] && [ -f "$oldest_pending" ]; then
        local entry_time
        entry_time=$(stat -f %m "$oldest_pending" 2>/dev/null || stat -c %Y "$oldest_pending" 2>/dev/null)
        local now
        now=$(date +%s)
        local age=$((now - entry_time))
        echo -e "${BOLD}Oldest Pending Entry:${NC} $(basename "$oldest_pending") (age: ${age}s)"
    fi

    # Processing entries
    local processing_count
    processing_count=$(queue_processing_count)
    if [ "$processing_count" -gt 0 ]; then
        echo ""
        echo -e "${BOLD}Currently Processing:${NC}"
        for file in "$QUEUE_PROCESSING_DIR"/*.json; do
            [ -f "$file" ] || continue
            echo "  $(basename "$file")"
        done
    fi
}

watch_status() {
    local interval="${1:-2}"
    echo "Watching queue status (Ctrl+C to stop)..."
    echo ""

    while true; do
        clear
        show_status
        sleep "$interval"
    done
}

show_help() {
    cat << EOF
Queue Status Monitoring Tool

Usage:
  $0 [OPTIONS]

Options:
  --status, -s    Show current status (default)
  --watch, -w     Continuous monitoring (refresh every 2s)
  --json, -j      Output in JSON format
  --stats         Show detailed statistics
  --help, -h      Show this help message

Examples:
  $0              # Show current status
  $0 --watch      # Watch continuously
  $0 --json       # Get JSON output (for scripting)
  $0 --stats      # Show detailed statistics

EOF
}

# =============================================================================
# Main
# =============================================================================

main() {
    local action="status"

    while [ $# -gt 0 ]; do
        case "$1" in
            --status|-s)
                action="status"
                ;;
            --watch|-w)
                action="watch"
                ;;
            --json|-j)
                action="json"
                ;;
            --stats)
                action="stats"
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1" >&2
                show_help
                exit 1
                ;;
        esac
        shift
    done

    case "$action" in
        status)
            show_status
            ;;
        watch)
            watch_status
            ;;
        json)
            show_status_json
            ;;
        stats)
            show_stats
            ;;
    esac
}

main "$@"
