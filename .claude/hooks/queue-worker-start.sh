#!/bin/bash
# =============================================================================
# Queue Worker Launcher
# =============================================================================
#
# Manages the queue worker daemon lifecycle.
#
# USAGE:
#   ./queue-worker-start.sh start      # Start worker daemon
#   ./queue-worker-start.sh stop       # Stop worker gracefully
#   ./queue-worker-start.sh restart    # Restart worker
#   ./queue-worker-start.sh status     # Check worker status
#   ./queue-worker-start.sh logs       # View worker logs
#
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Source queue library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/queue-lib.sh" ]; then
    source "$SCRIPT_DIR/lib/queue-lib.sh"
else
    echo -e "${RED}ERROR:${NC} queue-lib.sh not found" >&2
    exit 1
fi

WORKER_SCRIPT="$SCRIPT_DIR/lib/queue-worker.sh"

# =============================================================================
# Functions
# =============================================================================

start_worker() {
    echo -e "${BLUE}Starting queue worker...${NC}"

    # Check if already running
    if queue_worker_is_running; then
        local pid
        pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)
        echo -e "${YELLOW}Worker already running (PID: $pid)${NC}"
        return 0
    fi

    # Initialize queue if needed
    if ! queue_is_available; then
        echo "Initializing queue directories..."
        queue_init_dirs || {
            echo -e "${RED}Failed to initialize queue${NC}"
            return 1
        }
    fi

    # Check worker script
    if [ ! -f "$WORKER_SCRIPT" ]; then
        echo -e "${RED}Worker script not found: $WORKER_SCRIPT${NC}"
        return 1
    fi

    if [ ! -x "$WORKER_SCRIPT" ]; then
        chmod +x "$WORKER_SCRIPT"
    fi

    # Start worker in background
    nohup "$WORKER_SCRIPT" </dev/null >> "$QUEUE_WORKER_LOG" 2>&1 &
    local worker_pid=$!

    # Wait a moment and verify
    sleep 0.5

    if kill -0 "$worker_pid" 2>/dev/null; then
        echo -e "${GREEN}Worker started (PID: $worker_pid)${NC}"
        echo ""
        echo "Log file: $QUEUE_WORKER_LOG"
        echo "PID file: $QUEUE_WORKER_PID"
    else
        echo -e "${RED}Worker failed to start${NC}"
        echo "Check log file: $QUEUE_WORKER_LOG"
        return 1
    fi
}

stop_worker() {
    echo -e "${BLUE}Stopping queue worker...${NC}"

    if ! queue_worker_is_running; then
        echo -e "${YELLOW}Worker is not running${NC}"
        return 0
    fi

    local pid
    pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)

    # Send SIGTERM
    echo "Sending SIGTERM to PID $pid..."
    kill -TERM "$pid" 2>/dev/null

    # Wait for graceful shutdown
    local waited=0
    while [ "$waited" -lt 100 ]; do  # 10 seconds max
        if ! kill -0 "$pid" 2>/dev/null; then
            echo -e "${GREEN}Worker stopped gracefully${NC}"
            rm -f "$QUEUE_WORKER_PID" 2>/dev/null
            return 0
        fi
        sleep 0.1
        waited=$((waited + 1))
    done

    # Force kill
    echo -e "${YELLOW}Forcing worker shutdown...${NC}"
    kill -KILL "$pid" 2>/dev/null
    rm -f "$QUEUE_WORKER_PID" 2>/dev/null
    echo -e "${GREEN}Worker stopped${NC}"
}

restart_worker() {
    stop_worker
    echo ""
    sleep 1
    start_worker
}

show_status() {
    echo -e "${BLUE}Queue Worker Status${NC}"
    echo ""

    if queue_worker_is_running; then
        local pid
        pid=$(cat "$QUEUE_WORKER_PID" 2>/dev/null)
        echo -e "Status: ${GREEN}Running${NC}"
        echo "PID: $pid"

        # Show process info
        if [ -n "$pid" ]; then
            echo ""
            echo "Process Info:"
            ps -p "$pid" -o pid,ppid,user,%cpu,%mem,start,time,command 2>/dev/null || true
        fi

        # Queue stats
        echo ""
        echo "Queue:"
        echo "  Pending:    $(queue_size)"
        echo "  Processing: $(queue_processing_count)"
    else
        echo -e "Status: ${YELLOW}Not Running${NC}"
    fi

    # Stats
    echo ""
    echo "Statistics:"
    local stats
    stats=$(queue_stats_get)
    if command -v jq >/dev/null 2>&1; then
        echo "$stats" | jq -r 'to_entries | .[] | "  \(.key): \(.value)"'
    else
        echo "  $stats"
    fi
}

show_logs() {
    local lines="${1:-50}"

    if [ ! -f "$QUEUE_WORKER_LOG" ]; then
        echo "No log file found"
        return 1
    fi

    echo -e "${BLUE}Worker Log (last $lines lines):${NC}"
    echo ""
    tail -n "$lines" "$QUEUE_WORKER_LOG"
}

follow_logs() {
    if [ ! -f "$QUEUE_WORKER_LOG" ]; then
        echo "No log file found"
        return 1
    fi

    echo -e "${BLUE}Following worker log (Ctrl+C to stop):${NC}"
    echo ""
    tail -f "$QUEUE_WORKER_LOG"
}

run_once() {
    echo -e "${BLUE}Processing queue once...${NC}"

    if [ ! -f "$WORKER_SCRIPT" ] || [ ! -x "$WORKER_SCRIPT" ]; then
        chmod +x "$WORKER_SCRIPT" 2>/dev/null || {
            echo -e "${RED}Worker script not executable${NC}"
            return 1
        }
    fi

    "$WORKER_SCRIPT" --once
}

show_help() {
    cat << EOF
Queue Worker Launcher

Usage:
  $0 COMMAND [OPTIONS]

Commands:
  start         Start worker daemon in background
  stop          Stop worker gracefully
  restart       Restart worker
  status        Show worker status and queue info
  logs [N]      Show last N log lines (default: 50)
  follow        Follow log in real-time
  once          Process queue once and exit
  help          Show this help message

Options:
  --foreground  Run worker in foreground (for debugging)

Examples:
  $0 start              # Start worker
  $0 stop               # Stop worker
  $0 logs 100           # Show last 100 log lines
  $0 follow             # Follow logs
  $0 once               # Process queue once

Environment Variables:
  QUEUE_POLL_INTERVAL   Polling interval (default: 0.1s)
  QUEUE_BATCH_SIZE      Batch size (default: 10)
  QUEUE_MAX_RETRIES     Max retries (default: 3)
  QUEUE_IDLE_EXIT       Idle timeout (default: 300s)

EOF
}

# =============================================================================
# Main
# =============================================================================

main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        start)
            if [ "$1" = "--foreground" ] || [ "$1" = "-f" ]; then
                echo -e "${BLUE}Running worker in foreground...${NC}"
                exec "$WORKER_SCRIPT" --foreground
            else
                start_worker
            fi
            ;;
        stop)
            stop_worker
            ;;
        restart)
            restart_worker
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "${1:-50}"
            ;;
        follow)
            follow_logs
            ;;
        once)
            run_once
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}Unknown command: $command${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
