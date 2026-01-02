#!/bin/bash
# =============================================================================
# Agent Lifecycle Cleanup - Production-Ready Cleanup Script
# =============================================================================
#
# PURPOSE:
# Safely cleanup expired temporary agents while protecting permanent swarm agents.
# Enforces strict safety checks to prevent accidental deletion of core swarm.
#
# SAFETY GUARANTEES:
# - Never deletes protected agents (metadata.lifecycle.protected = true)
# - Never deletes active/spawned agents unless expired
# - Verifies exactly 9 permanent agents (1 Queen + 8 Workers) before cleanup
# - Aborts if permanent agent count != 9
# - Soft deletes only (sets status='deleted', deleted_at=NOW)
# - Full audit trail in .hive-mind/logs/cleanup.log
# - Rollback on error
#
# USAGE:
#   ./agent-lifecycle-cleanup.sh [OPTIONS] <trigger>
#
# ARGUMENTS:
#   trigger: periodic, session_end, task_complete, manual
#
# OPTIONS:
#   --dry-run       Show what would be deleted without deleting
#   --verbose       Show detailed output
#   --help          Show this help message
#
# EXAMPLES:
#   ./agent-lifecycle-cleanup.sh periodic
#   ./agent-lifecycle-cleanup.sh --dry-run task_complete
#   ./agent-lifecycle-cleanup.sh --verbose session_end
#
# =============================================================================

set -o pipefail

# =============================================================================
# Configuration & Constants
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HIVE_DB="${HIVE_DB:-.hive-mind/hive.db}"
LOG_DIR="${LOG_DIR:-.hive-mind/logs}"
CLEANUP_LOG="$LOG_DIR/cleanup.log"
SESSION_DIR=".hive-mind/sessions"
ACTIVE_SESSION_FILE=".hive-mind/.active_session"

# Required permanent agent count (1 Queen + 8 Workers)
REQUIRED_PERMANENT_COUNT=9

# Idle threshold for ephemeral agents (seconds)
IDLE_THRESHOLD=3600  # 1 hour

# Mode flags
DRY_RUN=false
VERBOSE=false
CLEANUP_TRIGGER=""

# Counters for summary
DELETED_COUNT=0
SKIPPED_COUNT=0
ERROR_COUNT=0

# =============================================================================
# Color Codes (for output)
# =============================================================================

if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# =============================================================================
# Logging Functions
# =============================================================================

# Initialize log directory
init_logging() {
    mkdir -p "$LOG_DIR" 2>/dev/null || {
        echo "ERROR: Failed to create log directory: $LOG_DIR" >&2
        return 1
    }

    # Ensure log file exists
    touch "$CLEANUP_LOG" 2>/dev/null || {
        echo "ERROR: Failed to create cleanup log: $CLEANUP_LOG" >&2
        return 1
    }
}

# Log message to file and optionally stdout
# Args: $1=level, $2=message, $3=to_stdout (optional)
log_message() {
    local level="$1"
    local message="$2"
    local to_stdout="${3:-false}"
    local timestamp

    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Write to log file
    echo "[$timestamp] [$level] [trigger=$CLEANUP_TRIGGER] $message" >> "$CLEANUP_LOG" 2>/dev/null

    # Optionally write to stdout
    if [ "$to_stdout" = "true" ] || [ "$VERBOSE" = "true" ]; then
        case "$level" in
            ERROR)   echo -e "${RED}[ERROR]${NC} $message" >&2 ;;
            WARN)    echo -e "${YELLOW}[WARN]${NC} $message" ;;
            SUCCESS) echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
            INFO)    echo -e "${BLUE}[INFO]${NC} $message" ;;
            *)       echo "[$level] $message" ;;
        esac
    fi
}

# =============================================================================
# Database Helper Functions
# =============================================================================

# Execute SQL read query
# Args: $1=sql
# Returns: query result on stdout
db_read() {
    local sql="$1"

    if [ ! -f "$HIVE_DB" ]; then
        log_message "ERROR" "Database not found: $HIVE_DB" true
        return 1
    fi

    sqlite3 -cmd ".timeout 5000" "$HIVE_DB" "$sql" 2>/dev/null
}

# Execute SQL write query with rollback on error
# Args: $1=sql
db_write() {
    local sql="$1"
    local result

    if [ ! -f "$HIVE_DB" ]; then
        log_message "ERROR" "Database not found: $HIVE_DB" true
        return 1
    fi

    # Execute with explicit transaction
    result=$(sqlite3 -cmd ".timeout 5000" "$HIVE_DB" "BEGIN TRANSACTION; $sql COMMIT;" 2>&1)

    if [ $? -ne 0 ]; then
        log_message "ERROR" "Database write failed: $result" true
        # Attempt rollback
        sqlite3 "$HIVE_DB" "ROLLBACK;" 2>/dev/null
        return 1
    fi

    return 0
}

# =============================================================================
# Session & Swarm Identification
# =============================================================================

# Get current session ID
get_session_id() {
    local session_id=""
    local claude_pid="${HIVE_CLAUDE_PID:-${PPID:-$$}}"

    # Method 1: PID-specific session file
    if [ -f "$SESSION_DIR/.session_$claude_pid" ]; then
        session_id=$(cat "$SESSION_DIR/.session_$claude_pid" 2>/dev/null)
    fi

    # Method 2: Active session file
    if [ -z "$session_id" ] && [ -f "$ACTIVE_SESSION_FILE" ]; then
        session_id=$(cat "$ACTIVE_SESSION_FILE" 2>/dev/null)
    fi

    # Method 3: Most recent active session from database
    if [ -z "$session_id" ]; then
        session_id=$(db_read "SELECT id FROM sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1;")
    fi

    echo "$session_id"
}

# Get swarm ID for session
# Args: $1=session_id
get_swarm_id() {
    local session_id="$1"

    if [ -z "$session_id" ]; then
        return 1
    fi

    db_read "SELECT swarm_id FROM sessions WHERE id = '$session_id';"
}

# =============================================================================
# Safety Verification Functions
# =============================================================================

# Verify permanent agent count
# Args: $1=swarm_id
# Returns: 0 if count is exactly 9, 1 otherwise
verify_permanent_agent_count() {
    local swarm_id="$1"
    local permanent_count

    if [ -z "$swarm_id" ]; then
        log_message "ERROR" "No swarm ID provided for verification" true
        return 1
    fi

    # Count permanent agents (queen and worker roles)
    # Permanent agents are identified by role, not metadata
    # This is the most reliable method
    permanent_count=$(db_read "
        SELECT COUNT(*) FROM agents
        WHERE swarm_id = '$swarm_id'
        AND status != 'deleted'
        AND role IN ('queen', 'worker');
    ")

    if [ -z "$permanent_count" ]; then
        log_message "ERROR" "Failed to query permanent agent count" true
        return 1
    fi

    log_message "INFO" "Permanent agent count: $permanent_count (required: $REQUIRED_PERMANENT_COUNT)"

    if [ "$permanent_count" -ne "$REQUIRED_PERMANENT_COUNT" ]; then
        log_message "ERROR" "Permanent agent count mismatch: found $permanent_count, expected $REQUIRED_PERMANENT_COUNT" true
        log_message "ERROR" "Aborting cleanup to prevent corruption of permanent swarm" true
        return 1
    fi

    log_message "SUCCESS" "Permanent agent count verified: $permanent_count" "$VERBOSE"
    return 0
}

# Check if agent is protected
# Args: $1=agent_id, $2=metadata_json
is_agent_protected() {
    local agent_id="$1"
    local metadata="$2"

    # Check for protected flag in metadata (both true and 1)
    if echo "$metadata" | grep -q '"protected"[[:space:]]*:[[:space:]]*\(true\|1\)'; then
        log_message "INFO" "Agent $agent_id is protected" "$VERBOSE"
        return 0
    fi

    # Also check for "lifecycle":"permanent"
    if echo "$metadata" | grep -q '"lifecycle"[[:space:]]*:[[:space:]]*"permanent"'; then
        log_message "INFO" "Agent $agent_id has permanent lifecycle" "$VERBOSE"
        return 0
    fi

    return 1
}

# Check if agent has expired
# Args: $1=metadata_json
is_agent_expired() {
    local metadata="$1"
    local expires_at
    local now

    # Extract expires_at from metadata
    expires_at=$(echo "$metadata" | grep -o '"expires_at"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')

    if [ -z "$expires_at" ]; then
        # No expiry set
        return 1
    fi

    # Convert to Unix timestamp
    local expires_ts
    expires_ts=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$expires_at" "+%s" 2>/dev/null || \
                 date -d "$expires_at" "+%s" 2>/dev/null)

    if [ -z "$expires_ts" ]; then
        log_message "WARN" "Failed to parse expires_at: $expires_at"
        return 1
    fi

    now=$(date +%s)

    if [ "$now" -gt "$expires_ts" ]; then
        return 0  # Expired
    fi

    return 1  # Not expired
}

# Check if agent is idle
# Args: $1=last_active_timestamp
is_agent_idle() {
    local last_active="$1"
    local now
    local last_active_ts

    if [ -z "$last_active" ]; then
        return 0  # No activity recorded, consider idle
    fi

    # Parse timestamp
    last_active_ts=$(date -j -f "%Y-%m-%d %H:%M:%S" "$last_active" "+%s" 2>/dev/null || \
                     date -d "$last_active" "+%s" 2>/dev/null)

    if [ -z "$last_active_ts" ]; then
        return 0  # Can't parse, consider idle
    fi

    now=$(date +%s)
    local idle_time=$((now - last_active_ts))

    if [ "$idle_time" -gt "$IDLE_THRESHOLD" ]; then
        return 0  # Idle
    fi

    return 1  # Not idle
}

# Check if cleanup trigger matches
# Args: $1=agent_cleanup_trigger
does_trigger_match() {
    local agent_trigger="$1"

    # If agent has no trigger, it can be cleaned by any trigger
    if [ -z "$agent_trigger" ]; then
        return 0
    fi

    # Check if triggers match
    if [ "$agent_trigger" = "$CLEANUP_TRIGGER" ]; then
        return 0
    fi

    # "manual" trigger matches everything
    if [ "$CLEANUP_TRIGGER" = "manual" ]; then
        return 0
    fi

    return 1
}

# =============================================================================
# Cleanup Logic
# =============================================================================

# Find agents eligible for cleanup
# Args: $1=swarm_id
# Outputs: agent_id|metadata|status|last_active (one per line)
find_cleanup_candidates() {
    local swarm_id="$1"

    db_read "
        SELECT id, metadata, status, last_active
        FROM agents
        WHERE swarm_id = '$swarm_id'
        AND status != 'deleted'
        AND role = 'task-agent'
        AND (
            metadata LIKE '%\"lifecycle\":\"temporary\"%'
            OR metadata NOT LIKE '%\"protected\":1%'
        )
        ORDER BY created_at ASC;
    " | while IFS='|' read -r agent_id metadata status last_active; do
        echo "$agent_id|$metadata|$status|$last_active"
    done
}

# Soft delete agent
# Args: $1=agent_id, $2=reason
soft_delete_agent() {
    local agent_id="$1"
    local reason="$2"
    local now

    now=$(date '+%Y-%m-%d %H:%M:%S')

    if [ "$DRY_RUN" = "true" ]; then
        log_message "INFO" "[DRY-RUN] Would delete agent: $agent_id (reason: $reason)" true
        DELETED_COUNT=$((DELETED_COUNT + 1))
        return 0
    fi

    # Build SQL for soft delete with metadata update
    local sql="
        UPDATE agents
        SET status = 'deleted',
            metadata = json_set(
                metadata,
                '\$.deleted_at', '$now',
                '\$.deletion_reason', '$reason',
                '\$.deleted_by_trigger', '$CLEANUP_TRIGGER'
            )
        WHERE id = '$agent_id';
    "

    if db_write "$sql"; then
        log_message "SUCCESS" "Deleted agent: $agent_id (reason: $reason)" true
        DELETED_COUNT=$((DELETED_COUNT + 1))
        return 0
    else
        log_message "ERROR" "Failed to delete agent: $agent_id" true
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    fi
}

# Process cleanup candidates
# Args: $1=swarm_id
process_cleanup() {
    local swarm_id="$1"
    local candidates

    log_message "INFO" "Finding cleanup candidates for swarm: $swarm_id"

    candidates=$(find_cleanup_candidates "$swarm_id")

    if [ -z "$candidates" ]; then
        log_message "INFO" "No cleanup candidates found" true
        return 0
    fi

    # Process each candidate
    echo "$candidates" | while IFS='|' read -r agent_id metadata status last_active; do
        local skip_reason=""

        # Safety check: Protected agents
        if is_agent_protected "$agent_id" "$metadata"; then
            skip_reason="protected"
        # Check: Cleanup trigger match
        elif ! does_trigger_match "$(echo "$metadata" | grep -o '"cleanup_trigger"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')"; then
            skip_reason="trigger mismatch"
        # Check: Expired agents
        elif is_agent_expired "$metadata"; then
            soft_delete_agent "$agent_id" "expired"
            continue
        # Check: Idle ephemeral agents (status != active/spawned)
        elif [ "$status" != "active" ] && [ "$status" != "spawned" ] && is_agent_idle "$last_active"; then
            soft_delete_agent "$agent_id" "idle"
            continue
        else
            skip_reason="not eligible"
        fi

        # Log skip
        if [ -n "$skip_reason" ]; then
            log_message "INFO" "Skipped agent: $agent_id ($skip_reason)" "$VERBOSE"
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        fi
    done
}

# =============================================================================
# Summary & Verification
# =============================================================================

# Print summary
print_summary() {
    local swarm_id="$1"
    local remaining_temp
    local permanent_count

    echo ""
    echo "======================================================================"
    echo "                    CLEANUP SUMMARY"
    echo "======================================================================"
    echo "Trigger:           $CLEANUP_TRIGGER"
    echo "Swarm ID:          $swarm_id"
    echo "Mode:              $([ "$DRY_RUN" = "true" ] && echo "DRY RUN" || echo "LIVE")"
    echo "----------------------------------------------------------------------"
    echo "Deleted:           $DELETED_COUNT agent(s)"
    echo "Skipped:           $SKIPPED_COUNT agent(s)"
    echo "Errors:            $ERROR_COUNT"
    echo "----------------------------------------------------------------------"

    # Get current counts
    permanent_count=$(db_read "
        SELECT COUNT(*) FROM agents
        WHERE swarm_id = '$swarm_id'
        AND status != 'deleted'
        AND role IN ('queen', 'worker');
    ")

    remaining_temp=$(db_read "
        SELECT COUNT(*) FROM agents
        WHERE swarm_id = '$swarm_id'
        AND status != 'deleted'
        AND role = 'task-agent';
    ")

    echo "Permanent Agents:  $permanent_count (required: $REQUIRED_PERMANENT_COUNT)"
    echo "Remaining Temp:    $remaining_temp"
    echo "======================================================================"
    echo ""

    # Log summary
    log_message "INFO" "Cleanup completed: deleted=$DELETED_COUNT, skipped=$SKIPPED_COUNT, errors=$ERROR_COUNT"
}

# =============================================================================
# Argument Parsing
# =============================================================================

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] <trigger>

Safely cleanup expired temporary agents while protecting permanent swarm agents.

ARGUMENTS:
  trigger           Cleanup trigger: periodic, session_end, task_complete, manual

OPTIONS:
  --dry-run         Show what would be deleted without actually deleting
  --verbose         Show detailed output
  --help            Show this help message

EXAMPLES:
  $(basename "$0") periodic
  $(basename "$0") --dry-run task_complete
  $(basename "$0") --verbose session_end

SAFETY FEATURES:
  - Verifies exactly 9 permanent agents (1 Queen + 8 Workers) before cleanup
  - Never deletes protected agents (metadata.lifecycle.protected = true)
  - Never deletes active/spawned agents unless expired
  - Soft deletes only (sets status='deleted', deleted_at=NOW)
  - Full audit trail in .hive-mind/logs/cleanup.log
  - Rollback on error

EOF
}

parse_arguments() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            periodic|session_end|task_complete|manual)
                CLEANUP_TRIGGER="$1"
                shift
                ;;
            *)
                echo "ERROR: Unknown argument: $1" >&2
                show_help
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    if [ -z "$CLEANUP_TRIGGER" ]; then
        echo "ERROR: Missing required argument: trigger" >&2
        show_help
        exit 1
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    local session_id
    local swarm_id

    # Parse arguments
    parse_arguments "$@"

    # Initialize logging
    if ! init_logging; then
        echo "ERROR: Failed to initialize logging" >&2
        exit 1
    fi

    log_message "INFO" "====== Cleanup started (trigger: $CLEANUP_TRIGGER) ======" true

    if [ "$DRY_RUN" = "true" ]; then
        log_message "INFO" "Running in DRY-RUN mode - no changes will be made" true
    fi

    # Get session and swarm IDs
    session_id=$(get_session_id)
    if [ -z "$session_id" ]; then
        log_message "ERROR" "No active session found" true
        exit 1
    fi
    log_message "INFO" "Found session: $session_id"

    swarm_id=$(get_swarm_id "$session_id")
    if [ -z "$swarm_id" ]; then
        log_message "ERROR" "No swarm found for session: $session_id" true
        exit 1
    fi
    log_message "INFO" "Found swarm: $swarm_id"

    # SAFETY CHECK: Verify permanent agent count
    if ! verify_permanent_agent_count "$swarm_id"; then
        log_message "ERROR" "Safety check failed - aborting cleanup" true
        exit 1
    fi

    # Pre-cleanup count verification
    local before_temp_count
    before_temp_count=$(db_read "
        SELECT COUNT(*) FROM agents
        WHERE swarm_id = '$swarm_id'
        AND status != 'deleted'
        AND metadata LIKE '%\"type\":\"ephemeral\"%';
    ")
    log_message "INFO" "Temporary agents before cleanup: $before_temp_count"

    # Execute cleanup
    process_cleanup "$swarm_id"

    # Post-cleanup verification
    if ! verify_permanent_agent_count "$swarm_id"; then
        log_message "ERROR" "Post-cleanup verification failed - permanent agent count changed!" true
        log_message "ERROR" "This should never happen - investigate immediately!" true
        exit 1
    fi

    # Print summary
    print_summary "$swarm_id"

    log_message "INFO" "====== Cleanup completed ======" true

    # Return error code if there were errors
    if [ "$ERROR_COUNT" -gt 0 ]; then
        exit 1
    fi

    exit 0
}

# Execute main if not sourced
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
