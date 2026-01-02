#!/bin/bash
# =============================================================================
# Queue Initialization Script
# =============================================================================
#
# Initializes the queue directory structure and files.
# Safe to run multiple times (idempotent).
#
# USAGE:
#   ./queue-init.sh              # Initialize queue
#   ./queue-init.sh --verify     # Verify installation
#   ./queue-init.sh --reset      # Reset queue (WARNING: clears all data)
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Source queue library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/queue-lib.sh" ]; then
    source "$SCRIPT_DIR/lib/queue-lib.sh"
else
    log_error "queue-lib.sh not found"
    exit 1
fi

# =============================================================================
# Functions
# =============================================================================

init_queue() {
    log_info "Initializing queue system..."

    # Create directories
    if queue_init_dirs; then
        log_success "Queue directories created"
    else
        log_error "Failed to create queue directories"
        return 1
    fi

    # Verify structure
    local dirs=(
        "$QUEUE_PENDING_DIR"
        "$QUEUE_PROCESSING_DIR"
        "$QUEUE_COMPLETED_DIR"
        "$QUEUE_FAILED_DIR"
        "$QUEUE_TMP_DIR"
    )

    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            log_success "Directory exists: $(basename "$dir")/"
        else
            log_error "Missing directory: $dir"
            return 1
        fi
    done

    # Verify files
    if [ -f "$QUEUE_SEQ_FILE" ]; then
        log_success "Sequence file initialized"
    fi

    if [ -f "$QUEUE_STATS_FILE" ]; then
        log_success "Stats file initialized"
    fi

    # Make worker executable
    local worker_script="$SCRIPT_DIR/lib/queue-worker.sh"
    if [ -f "$worker_script" ]; then
        chmod +x "$worker_script"
        log_success "Worker script is executable"
    else
        log_warn "Worker script not found: $worker_script"
    fi

    echo ""
    log_success "Queue system initialized successfully!"
    echo ""
    echo "Queue directory: $QUEUE_BASE_DIR"
    echo ""
    echo "Next steps:"
    echo "  - Queue writes are now available via queue_db_write()"
    echo "  - Worker starts automatically on first write"
    echo "  - Check status: ./queue-status.sh"
    echo ""
}

verify_queue() {
    log_info "Verifying queue installation..."

    local errors=0

    # Check directories
    local dirs=(
        "$QUEUE_BASE_DIR:Base directory"
        "$QUEUE_PENDING_DIR:Pending directory"
        "$QUEUE_PROCESSING_DIR:Processing directory"
        "$QUEUE_COMPLETED_DIR:Completed directory"
        "$QUEUE_FAILED_DIR:Failed directory"
        "$QUEUE_TMP_DIR:Temp directory"
    )

    for entry in "${dirs[@]}"; do
        local dir="${entry%%:*}"
        local desc="${entry#*:}"
        if [ -d "$dir" ]; then
            log_success "$desc"
        else
            log_error "$desc missing: $dir"
            errors=$((errors + 1))
        fi
    done

    # Check files
    if [ -f "$QUEUE_SEQ_FILE" ]; then
        log_success "Sequence file"
    else
        log_error "Sequence file missing"
        errors=$((errors + 1))
    fi

    if [ -f "$QUEUE_STATS_FILE" ]; then
        log_success "Stats file"
    else
        log_error "Stats file missing"
        errors=$((errors + 1))
    fi

    # Check worker script
    local worker_script="$SCRIPT_DIR/lib/queue-worker.sh"
    if [ -f "$worker_script" ] && [ -x "$worker_script" ]; then
        log_success "Worker script executable"
    else
        log_error "Worker script not executable: $worker_script"
        errors=$((errors + 1))
    fi

    # Check database
    if [ -f "$HIVE_DB" ]; then
        log_success "Database exists: $HIVE_DB"
    else
        log_warn "Database not found: $HIVE_DB (will use fallback)"
    fi

    echo ""
    if [ "$errors" -eq 0 ]; then
        log_success "Verification passed!"
        return 0
    else
        log_error "Verification failed with $errors error(s)"
        return 1
    fi
}

reset_queue() {
    log_warn "Resetting queue system (this will delete all queue data)..."
    echo ""
    read -p "Are you sure? (y/N) " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Reset cancelled"
        return 0
    fi

    # Stop worker
    if queue_worker_is_running; then
        log_info "Stopping worker..."
        queue_stop_worker
    fi

    # Reset queue
    queue_reset
    log_success "Queue reset complete"

    echo ""
    echo "Queue is now empty and ready for use."
}

show_help() {
    cat << EOF
Queue Initialization Script

Usage:
  $0 [OPTIONS]

Options:
  --init, -i      Initialize queue system (default)
  --verify, -v    Verify queue installation
  --reset, -r     Reset queue (WARNING: clears all data)
  --help, -h      Show this help message

Examples:
  $0              # Initialize queue
  $0 --verify     # Verify installation
  $0 --reset      # Reset queue (interactive confirmation)

EOF
}

# =============================================================================
# Main
# =============================================================================

main() {
    local action="init"

    while [ $# -gt 0 ]; do
        case "$1" in
            --init|-i)
                action="init"
                ;;
            --verify|-v)
                action="verify"
                ;;
            --reset|-r)
                action="reset"
                ;;
            --help|-h)
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

    case "$action" in
        init)
            init_queue
            ;;
        verify)
            verify_queue
            ;;
        reset)
            reset_queue
            ;;
    esac
}

main "$@"
