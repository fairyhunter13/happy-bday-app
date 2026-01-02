#!/bin/bash
# Queue System Installation & Setup Script
# Installs the queue-based SQLite write system for hive-mind hooks
#
# Usage:
#   ./queue-install.sh [--migrate] [--test] [--uninstall]
#
# Options:
#   --migrate    Migrate existing hooks to use queue system
#   --test       Run test suite after installation
#   --uninstall  Remove queue system and restore original hooks
#   --help       Show this help message

set -e

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR"
LIB_DIR="$HOOKS_DIR/lib"
QUEUE_DIR=".hive-mind/queue"
BACKUP_DIR=".hive-mind/backups/queue-migration-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Utility Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check for required commands
    local missing=()

    if ! command -v sqlite3 >/dev/null 2>&1; then
        missing+=("sqlite3")
    fi

    if ! command -v base64 >/dev/null 2>&1; then
        missing+=("base64")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required commands: ${missing[*]}"
        exit 1
    fi

    # Check if lib files exist
    if [ ! -f "$LIB_DIR/queue-lib.sh" ]; then
        log_error "queue-lib.sh not found in $LIB_DIR"
        exit 1
    fi

    if [ ! -f "$LIB_DIR/queue-writer.sh" ]; then
        log_error "queue-writer.sh not found in $LIB_DIR"
        exit 1
    fi

    if [ ! -f "$LIB_DIR/queue-worker.sh" ]; then
        log_error "queue-worker.sh not found in $LIB_DIR"
        exit 1
    fi

    # Check if worker is executable
    if [ ! -x "$LIB_DIR/queue-worker.sh" ]; then
        chmod +x "$LIB_DIR/queue-worker.sh"
        log_info "Made queue-worker.sh executable"
    fi

    log_success "Prerequisites check passed"
}

# ============================================================================
# Installation
# ============================================================================

install_queue_system() {
    log_info "Installing queue system..."

    # Create queue directory
    mkdir -p "$QUEUE_DIR"
    log_info "Created queue directory: $QUEUE_DIR"

    # Initialize queue files
    touch "$QUEUE_DIR/pending.queue"
    touch "$QUEUE_DIR/worker.log"
    echo '{"enqueued":0,"processed":0,"failed":0,"retried":0}' > "$QUEUE_DIR/stats.json"

    log_success "Queue system files initialized"

    # Create README in queue directory
    cat > "$QUEUE_DIR/README.md" << 'EOF'
# Hive-Mind Queue Directory

This directory contains the queue system for non-blocking SQLite writes.

## Files

- `pending.queue` - Queue of pending write operations
- `worker.log` - Worker daemon log file
- `worker.pid` - PID file for running worker
- `stats.json` - Statistics (enqueued, processed, failed, retried)
- `failed.log` - Failed operations for manual inspection

## Structure

The queue system consists of three components:

1. **queue-lib.sh** - Core library functions
2. **queue-writer.sh** - Fast non-blocking write interface
3. **queue-worker.sh** - Background daemon for processing queue

## Usage

Hooks automatically use the queue system. The worker is started on-demand
and exits after 5 minutes of inactivity.

## Monitoring

Check queue status:
```bash
source .claude/hooks/lib/queue-writer.sh
queue_status
```

## Maintenance

Queue cleanup runs automatically. Old logs are archived when they exceed 1MB.
EOF

    log_success "Queue system installed successfully"
}

# ============================================================================
# Migration
# ============================================================================

backup_hooks() {
    log_info "Backing up existing hooks..."

    mkdir -p "$BACKUP_DIR"

    # Backup hooks that will be modified
    local hooks=(
        "auto-checkpoint.sh"
        "session-checkpoint.sh"
        "session-start.sh"
        "task-agent-tracker.sh"
        "hive-session-link.sh"
    )

    for hook in "${hooks[@]}"; do
        if [ -f "$HOOKS_DIR/$hook" ]; then
            cp "$HOOKS_DIR/$hook" "$BACKUP_DIR/"
            log_info "Backed up: $hook"
        fi
    done

    if [ -f "$LIB_DIR/session-helpers.sh" ]; then
        cp "$LIB_DIR/session-helpers.sh" "$BACKUP_DIR/"
        log_info "Backed up: lib/session-helpers.sh"
    fi

    log_success "Backups saved to: $BACKUP_DIR"
}

migrate_session_helpers() {
    log_info "Migrating session-helpers.sh..."

    local helpers_file="$LIB_DIR/session-helpers.sh"

    if [ ! -f "$helpers_file" ]; then
        log_warn "session-helpers.sh not found, skipping"
        return
    fi

    # Add queue library source at the top
    local temp_file=$(mktemp)

    cat > "$temp_file" << 'EOF'
#!/bin/bash
# Session Helpers Library - Multi-Instance Session Tracking
# Enhanced with queue-based writes for improved concurrency
#
# Usage: source this file in other hooks
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/session-helpers.sh"

# Source queue writer for non-blocking database writes
SCRIPT_DIR_HELPERS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR_HELPERS/queue-writer.sh" ]; then
    source "$SCRIPT_DIR_HELPERS/queue-writer.sh"
    QUEUE_ENABLED=true
else
    QUEUE_ENABLED=false
fi

EOF

    # Append original content (skip shebang and first comment block)
    sed -n '/^HIVE_DB=/,$p' "$helpers_file" >> "$temp_file"

    # Replace direct sqlite3 calls with queued writes
    sed -i.bak 's/sqlite3 "$HIVE_DB"/queue_write/g' "$temp_file"

    # Restore some read-only queries (SELECT)
    sed -i.bak 's/queue_write.*SELECT/sqlite3 "$HIVE_DB" "SELECT/g' "$temp_file"

    # Install migrated file
    mv "$temp_file" "$helpers_file"
    rm -f "$temp_file.bak"

    log_success "session-helpers.sh migrated to use queue system"
}

migrate_hooks() {
    log_info "Migrating hooks to use queue system..."

    backup_hooks

    # This is a simplified migration - in production, you'd want more sophisticated replacement
    log_warn "Manual migration recommended - automatic migration is basic"
    log_info "To manually migrate a hook:"
    log_info "  1. Source queue-writer.sh at the top"
    log_info "  2. Replace 'sqlite3 \$HIVE_DB \"UPDATE|INSERT|DELETE...\"' with 'queue_write \"...\"'"
    log_info "  3. Keep SELECT queries as direct sqlite3 calls"

    log_success "Migration preparation complete - see backup in $BACKUP_DIR"
}

# ============================================================================
# Testing
# ============================================================================

run_tests() {
    log_info "Running queue system tests..."

    # Source the libraries
    source "$LIB_DIR/queue-lib.sh"
    source "$LIB_DIR/queue-writer.sh"

    # Test 1: Queue initialization
    log_info "Test 1: Queue initialization"
    if queue_init; then
        log_success "✓ Queue initialized"
    else
        log_error "✗ Queue initialization failed"
        return 1
    fi

    # Test 2: Queue operations
    log_info "Test 2: Queue write and read"
    queue_reset

    local test_sql="UPDATE test SET value = 1 WHERE id = 1;"
    if queue_enqueue "test_op" 5 "$test_sql" '{"test":"data"}'; then
        log_success "✓ Enqueued test operation"
    else
        log_error "✗ Failed to enqueue"
        return 1
    fi

    local size=$(queue_size)
    if [ "$size" -eq 1 ]; then
        log_success "✓ Queue size correct: $size"
    else
        log_error "✗ Queue size incorrect: $size (expected 1)"
        return 1
    fi

    # Test 3: Dequeue
    log_info "Test 3: Dequeue operation"
    local batch=$(queue_dequeue_batch 1)
    if [ -n "$batch" ]; then
        log_success "✓ Dequeued batch"
    else
        log_error "✗ Failed to dequeue"
        return 1
    fi

    size=$(queue_size)
    if [ "$size" -eq 0 ]; then
        log_success "✓ Queue empty after dequeue"
    else
        log_error "✗ Queue not empty: $size"
        return 1
    fi

    # Test 4: Stats
    log_info "Test 4: Statistics tracking"
    local stats=$(queue_stats_get)
    if echo "$stats" | grep -q "enqueued"; then
        log_success "✓ Statistics available"
    else
        log_error "✗ Statistics unavailable"
        return 1
    fi

    # Test 5: Worker management
    log_info "Test 5: Worker management"
    if queue_worker_is_running; then
        log_warn "Worker already running - stopping for test"
        queue_stop_worker
        sleep 1
    fi

    queue_start_worker_background
    sleep 1

    if queue_worker_is_running; then
        log_success "✓ Worker started successfully"
        queue_stop_worker
        sleep 1
        if ! queue_worker_is_running; then
            log_success "✓ Worker stopped successfully"
        else
            log_warn "Worker still running after stop"
        fi
    else
        log_error "✗ Worker failed to start"
        return 1
    fi

    log_success "All tests passed!"
}

# ============================================================================
# Uninstallation
# ============================================================================

uninstall_queue_system() {
    log_warn "Uninstalling queue system..."

    # Stop worker if running
    source "$LIB_DIR/queue-writer.sh" 2>/dev/null || true
    queue_stop_worker 2>/dev/null || true

    # Find most recent backup
    local latest_backup=$(ls -td .hive-mind/backups/queue-migration-* 2>/dev/null | head -1)

    if [ -n "$latest_backup" ]; then
        log_info "Restoring from backup: $latest_backup"

        # Restore hooks
        if [ -f "$latest_backup/session-helpers.sh" ]; then
            cp "$latest_backup/session-helpers.sh" "$LIB_DIR/"
            log_info "Restored session-helpers.sh"
        fi

        for hook in auto-checkpoint.sh session-checkpoint.sh session-start.sh; do
            if [ -f "$latest_backup/$hook" ]; then
                cp "$latest_backup/$hook" "$HOOKS_DIR/"
                log_info "Restored $hook"
            fi
        done

        log_success "Hooks restored from backup"
    else
        log_warn "No backup found - hooks not restored"
    fi

    # Remove queue directory
    if [ -d "$QUEUE_DIR" ]; then
        rm -rf "$QUEUE_DIR"
        log_success "Removed queue directory"
    fi

    log_success "Queue system uninstalled"
}

# ============================================================================
# Status Check
# ============================================================================

show_status() {
    log_info "Queue System Status"
    echo ""

    # Check if installed
    if [ -d "$QUEUE_DIR" ]; then
        echo "  Status: Installed"
        echo "  Queue directory: $QUEUE_DIR"

        # Source libraries
        if [ -f "$LIB_DIR/queue-writer.sh" ]; then
            source "$LIB_DIR/queue-lib.sh"
            source "$LIB_DIR/queue-writer.sh"

            echo "  Pending entries: $(queue_size)"

            if queue_worker_is_running; then
                local worker_pid=$(cat "$QUEUE_DIR/worker.pid" 2>/dev/null)
                echo "  Worker: Running (PID: $worker_pid)"
            else
                echo "  Worker: Not running"
            fi

            echo ""
            echo "Statistics:"
            queue_stats_get | sed 's/^/  /'
        fi
    else
        echo "  Status: Not installed"
    fi

    echo ""
}

# ============================================================================
# Help
# ============================================================================

show_help() {
    cat << EOF
Queue System Installation & Setup Script

Usage:
  $0 [OPTIONS]

Options:
  --install     Install queue system (default)
  --migrate     Install and migrate existing hooks
  --test        Run test suite
  --status      Show queue system status
  --uninstall   Remove queue system and restore backups
  --help        Show this help message

Examples:
  # Install queue system
  $0 --install

  # Install and migrate hooks
  $0 --install --migrate

  # Install, migrate, and test
  $0 --install --migrate --test

  # Check status
  $0 --status

  # Uninstall
  $0 --uninstall

EOF
}

# ============================================================================
# Main
# ============================================================================

main() {
    local do_install=false
    local do_migrate=false
    local do_test=false
    local do_uninstall=false
    local do_status=false

    # Parse arguments
    if [ $# -eq 0 ]; then
        do_install=true
    fi

    while [ $# -gt 0 ]; do
        case "$1" in
            --install)
                do_install=true
                ;;
            --migrate)
                do_migrate=true
                do_install=true
                ;;
            --test)
                do_test=true
                ;;
            --uninstall)
                do_uninstall=true
                ;;
            --status)
                do_status=true
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
        shift
    done

    # Execute actions
    if $do_status; then
        show_status
        exit 0
    fi

    if $do_uninstall; then
        uninstall_queue_system
        exit 0
    fi

    if $do_install; then
        check_prerequisites
        install_queue_system

        if $do_migrate; then
            migrate_hooks
        fi

        if $do_test; then
            run_tests
        fi

        echo ""
        log_success "Queue system setup complete!"
        echo ""
        echo "Next steps:"
        echo "  - Queue system is ready to use"
        echo "  - Worker starts automatically on first write"
        echo "  - Check status: $0 --status"
        echo ""
    fi

    if $do_test && ! $do_install; then
        run_tests
    fi
}

# Run main
main "$@"
