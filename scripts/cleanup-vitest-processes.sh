#!/bin/bash
# =============================================================================
# Cleanup Orphaned Vitest Processes
# =============================================================================
#
# PURPOSE:
# Kill orphaned vitest worker processes that were not properly terminated
# after test runs. These can accumulate and consume significant memory/CPU.
#
# USAGE:
#   ./scripts/cleanup-vitest-processes.sh [--dry-run] [--force]
#
# OPTIONS:
#   --dry-run    Show what would be killed without actually killing
#   --force      Skip confirmation prompt
#   --help       Show this help message
#
# EXAMPLES:
#   ./scripts/cleanup-vitest-processes.sh --dry-run
#   ./scripts/cleanup-vitest-processes.sh --force
#
# WHEN TO USE:
# - After experiencing high memory usage
# - If you see multiple "node (vitest X)" processes in Activity Monitor
# - After interrupted git push operations
# - Periodically via cron (e.g., daily at midnight)
#
# CRON EXAMPLE (add to crontab):
#   0 0 * * * /path/to/happy-bday-app/scripts/cleanup-vitest-processes.sh --force
#
# =============================================================================

set -euo pipefail

# Parse arguments
DRY_RUN=false
FORCE=false

show_help() {
    cat << 'EOF'
Usage: cleanup-vitest-processes.sh [OPTIONS]

Kill orphaned vitest worker processes.

OPTIONS:
  --dry-run    Show what would be killed without actually killing
  --force      Skip confirmation prompt
  --help       Show this help message

EXAMPLES:
  ./scripts/cleanup-vitest-processes.sh --dry-run
  ./scripts/cleanup-vitest-processes.sh --force
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            show_help
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run with --help for usage information"
            exit 1
            ;;
    esac
done

# Find vitest processes
echo "Searching for vitest processes..."
VITEST_PIDS=$(pgrep -f "vitest" || true)

if [ -z "$VITEST_PIDS" ]; then
    echo "✓ No vitest processes found"
    exit 0
fi

# Count and display processes
PROCESS_COUNT=$(echo "$VITEST_PIDS" | wc -l | tr -d ' ')
echo "Found $PROCESS_COUNT vitest process(es):"
echo ""

# Show details
ps -p "$VITEST_PIDS" -o pid,ppid,%cpu,%mem,etime,command || true
echo ""

# Calculate total memory
TOTAL_MEM=$(ps -p "$VITEST_PIDS" -o %mem= | awk '{sum+=$1} END {print sum}')
echo "Total memory usage: ${TOTAL_MEM}%"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] Would kill the following PIDs:"
    echo "$VITEST_PIDS"
    echo ""
    echo "Run without --dry-run to actually kill these processes"
    exit 0
fi

# Confirm unless --force
if [ "$FORCE" != true ]; then
    echo "⚠️  This will terminate all vitest processes listed above."
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted"
        exit 0
    fi
fi

# Kill processes
echo "Killing vitest processes..."
if pkill -f "vitest"; then
    echo "✓ Vitest processes terminated"

    # Verify cleanup
    sleep 2
    REMAINING=$(pgrep -f "vitest" || true)
    if [ -n "$REMAINING" ]; then
        echo "⚠️  Warning: Some processes survived SIGTERM, trying SIGKILL..."
        pkill -9 -f "vitest" || true
        sleep 1
        STILL_REMAINING=$(pgrep -f "vitest" || true)
        if [ -n "$STILL_REMAINING" ]; then
            echo "❌ Error: Failed to kill some processes:"
            ps -p "$STILL_REMAINING" -o pid,command
            exit 1
        else
            echo "✓ All processes killed with SIGKILL"
        fi
    fi

    echo "✓ Cleanup completed successfully"
else
    echo "✓ No vitest processes to kill (already terminated)"
fi

# Show memory savings
echo ""
echo "Freed approximately ${TOTAL_MEM}% of system memory"
