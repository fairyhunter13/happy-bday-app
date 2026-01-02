#!/bin/bash
# =============================================================================
# Queue Cleanup and Maintenance Tool
# =============================================================================
#
# Performs maintenance tasks on the queue system:
# - Archive/purge old completed entries
# - Clean up failed entries
# - Recover orphaned processing entries
# - Rotate log files
#
# USAGE:
#   ./queue-cleanup.sh                    # Run all cleanup tasks
#   ./queue-cleanup.sh --archive          # Archive completed entries
#   ./queue-cleanup.sh --purge-failed     # Remove old failed entries
#   ./queue-cleanup.sh --recover          # Recover orphaned entries
#   ./queue-cleanup.sh --dry-run          # Show what would be done
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

# Configuration
DRY_RUN=false
RETENTION_HOURS="${RETENTION_HOURS:-24}"
ARCHIVE_DIR="$QUEUE_BASE_DIR/archive"

# =============================================================================
# Cleanup Functions
# =============================================================================

archive_completed() {
    local hours="${1:-$RETENTION_HOURS}"
    local archived=0

    log_info "Archiving completed entries older than ${hours} hours..."

    if [ ! -d "$QUEUE_COMPLETED_DIR" ]; then
        log_warn "Completed directory not found"
        return 0
    fi

    # Create archive directory with date
    local archive_subdir="$ARCHIVE_DIR/$(date +%Y-%m-%d)"
    if ! $DRY_RUN; then
        mkdir -p "$archive_subdir" 2>/dev/null
    fi

    # Calculate cutoff time
    local cutoff
    cutoff=$(date -d "-${hours} hours" +%s 2>/dev/null || \
             date -v-${hours}H +%s 2>/dev/null || \
             echo "$(($(date +%s) - hours * 3600))")

    for file in "$QUEUE_COMPLETED_DIR"/*.json; do
        [ -f "$file" ] || continue

        local file_time
        file_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)

        if [ "$file_time" -lt "$cutoff" ]; then
            if $DRY_RUN; then
                log_info "Would archive: $(basename "$file")"
            else
                mv "$file" "$archive_subdir/" 2>/dev/null
            fi
            archived=$((archived + 1))
        fi
    done

    if [ "$archived" -gt 0 ]; then
        if $DRY_RUN; then
            log_info "Would archive $archived file(s)"
        else
            log_success "Archived $archived file(s) to $archive_subdir"
        fi
    else
        log_info "No files to archive"
    fi
}

purge_failed() {
    local hours="${1:-$((RETENTION_HOURS * 7))}"  # 7x longer retention for failed
    local purged=0

    log_info "Purging failed entries older than ${hours} hours..."

    if [ ! -d "$QUEUE_FAILED_DIR" ]; then
        log_warn "Failed directory not found"
        return 0
    fi

    local cutoff
    cutoff=$(date -d "-${hours} hours" +%s 2>/dev/null || \
             date -v-${hours}H +%s 2>/dev/null || \
             echo "$(($(date +%s) - hours * 3600))")

    for file in "$QUEUE_FAILED_DIR"/*.json; do
        [ -f "$file" ] || continue

        local file_time
        file_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)

        if [ "$file_time" -lt "$cutoff" ]; then
            if $DRY_RUN; then
                log_info "Would purge: $(basename "$file")"
            else
                rm -f "$file"
            fi
            purged=$((purged + 1))
        fi
    done

    if [ "$purged" -gt 0 ]; then
        if $DRY_RUN; then
            log_info "Would purge $purged file(s)"
        else
            log_success "Purged $purged failed file(s)"
        fi
    else
        log_info "No failed entries to purge"
    fi
}

recover_orphans() {
    local timeout="${1:-$QUEUE_PROCESSING_TIMEOUT}"
    local recovered=0

    log_info "Recovering orphaned entries (timeout: ${timeout}s)..."

    if [ ! -d "$QUEUE_PROCESSING_DIR" ]; then
        log_warn "Processing directory not found"
        return 0
    fi

    local now
    now=$(date +%s)

    for file in "$QUEUE_PROCESSING_DIR"/*.json; do
        [ -f "$file" ] || continue

        local file_time
        file_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)
        local age=$((now - file_time))

        if [ "$age" -gt "$timeout" ]; then
            if $DRY_RUN; then
                log_info "Would recover: $(basename "$file") (age: ${age}s)"
            else
                queue_retry_entry "$file"
            fi
            recovered=$((recovered + 1))
        fi
    done

    if [ "$recovered" -gt 0 ]; then
        if $DRY_RUN; then
            log_info "Would recover $recovered file(s)"
        else
            log_success "Recovered $recovered orphaned file(s)"
        fi
    else
        log_info "No orphaned entries found"
    fi
}

rotate_logs() {
    log_info "Rotating log files..."

    if [ ! -f "$QUEUE_WORKER_LOG" ]; then
        log_info "No log file to rotate"
        return 0
    fi

    local log_size
    log_size=$(stat -f %z "$QUEUE_WORKER_LOG" 2>/dev/null || stat -c %s "$QUEUE_WORKER_LOG" 2>/dev/null || echo "0")

    # Rotate if larger than 1MB
    if [ "$log_size" -gt 1048576 ]; then
        if $DRY_RUN; then
            log_info "Would rotate log file (size: $((log_size / 1024))KB)"
        else
            local rotate_name="$QUEUE_WORKER_LOG.$(date +%Y%m%d-%H%M%S)"
            mv "$QUEUE_WORKER_LOG" "$rotate_name"
            gzip "$rotate_name" 2>/dev/null || true
            touch "$QUEUE_WORKER_LOG"
            log_success "Rotated log file (was $((log_size / 1024))KB)"
        fi
    else
        log_info "Log file size OK ($((log_size / 1024))KB)"
    fi

    # Remove old rotated logs (keep 7 days)
    if ! $DRY_RUN; then
        find "$QUEUE_BASE_DIR" -name "worker.log.*" -mtime +7 -delete 2>/dev/null || true
    fi
}

cleanup_tmp() {
    log_info "Cleaning up temporary files..."

    if [ ! -d "$QUEUE_TMP_DIR" ]; then
        return 0
    fi

    local cleaned=0

    for file in "$QUEUE_TMP_DIR"/*.tmp; do
        [ -f "$file" ] || continue

        local file_time
        file_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)
        local now
        now=$(date +%s)
        local age=$((now - file_time))

        # Clean tmp files older than 1 hour
        if [ "$age" -gt 3600 ]; then
            if $DRY_RUN; then
                log_info "Would clean: $(basename "$file")"
            else
                rm -f "$file"
            fi
            cleaned=$((cleaned + 1))
        fi
    done

    if [ "$cleaned" -gt 0 ]; then
        if $DRY_RUN; then
            log_info "Would clean $cleaned temp file(s)"
        else
            log_success "Cleaned $cleaned stale temp file(s)"
        fi
    fi
}

run_all_cleanup() {
    log_info "Running all cleanup tasks..."
    echo ""

    recover_orphans
    echo ""

    archive_completed
    echo ""

    purge_failed
    echo ""

    rotate_logs
    echo ""

    cleanup_tmp
    echo ""

    log_success "All cleanup tasks completed"
}

show_status() {
    echo "Queue Cleanup Status"
    echo ""

    # Count files in each directory
    echo "Current file counts:"
    for dir in pending processing completed failed; do
        local path="$QUEUE_BASE_DIR/$dir"
        if [ -d "$path" ]; then
            local count
            count=$(ls -1 "$path"/*.json 2>/dev/null | wc -l | tr -d ' ')
            local size
            size=$(du -sh "$path" 2>/dev/null | cut -f1)
            echo "  $dir: $count files ($size)"
        fi
    done

    echo ""

    # Log file size
    if [ -f "$QUEUE_WORKER_LOG" ]; then
        local log_size
        log_size=$(du -sh "$QUEUE_WORKER_LOG" 2>/dev/null | cut -f1)
        echo "Log file: $log_size"
    fi

    # Archive size
    if [ -d "$ARCHIVE_DIR" ]; then
        local archive_size
        archive_size=$(du -sh "$ARCHIVE_DIR" 2>/dev/null | cut -f1)
        echo "Archive: $archive_size"
    fi
}

show_help() {
    cat << EOF
Queue Cleanup and Maintenance Tool

Usage:
  $0 [OPTIONS]

Options:
  --all, -a           Run all cleanup tasks (default)
  --archive           Archive old completed entries
  --purge-failed      Remove old failed entries
  --recover           Recover orphaned processing entries
  --rotate-logs       Rotate log files
  --clean-tmp         Clean temporary files
  --status            Show current status
  --dry-run, -n       Show what would be done without doing it
  --hours=N           Set retention hours (default: 24)
  --help, -h          Show this help message

Examples:
  $0                  # Run all cleanup tasks
  $0 --dry-run        # Preview what would be cleaned
  $0 --archive        # Only archive completed entries
  $0 --hours=48       # Use 48-hour retention

Environment Variables:
  RETENTION_HOURS     Default retention period (default: 24)

EOF
}

# =============================================================================
# Main
# =============================================================================

main() {
    local action="all"

    while [ $# -gt 0 ]; do
        case "$1" in
            --all|-a)
                action="all"
                ;;
            --archive)
                action="archive"
                ;;
            --purge-failed)
                action="purge"
                ;;
            --recover)
                action="recover"
                ;;
            --rotate-logs)
                action="rotate"
                ;;
            --clean-tmp)
                action="tmp"
                ;;
            --status)
                action="status"
                ;;
            --dry-run|-n)
                DRY_RUN=true
                log_warn "Dry run mode - no changes will be made"
                ;;
            --hours=*)
                RETENTION_HOURS="${1#*=}"
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

    # Check if queue is available
    if ! queue_is_available && [ "$action" != "status" ]; then
        log_error "Queue system not initialized. Run ./queue-init.sh first."
        exit 1
    fi

    case "$action" in
        all)
            run_all_cleanup
            ;;
        archive)
            archive_completed
            ;;
        purge)
            purge_failed
            ;;
        recover)
            recover_orphans
            ;;
        rotate)
            rotate_logs
            ;;
        tmp)
            cleanup_tmp
            ;;
        status)
            show_status
            ;;
    esac
}

main "$@"
