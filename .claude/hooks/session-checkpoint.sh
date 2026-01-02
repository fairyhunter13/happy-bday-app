#!/bin/bash
# Session Checkpoint Hook (Stop Hook) - Multi-Instance Version
# Saves comprehensive checkpoint when Claude Code exits and detaches instance
#
# This hook:
# 1. Gets the stable instance ID for this Claude terminal
# 2. Looks up the session for this specific instance
# 3. Saves final checkpoint with instance statistics
# 4. Detaches the instance (marks as 'detached', not 'active')
# 5. Cleans up instance-specific files
#
# Note: This only detaches the current instance, not the entire session.
#       Other instances can continue working on the same session.

HIVE_DB=".hive-mind/hive.db"
INSTANCE_DIR=".hive-mind/instances"

# Only proceed if hive.db exists
if [ ! -f "$HIVE_DB" ]; then
    exit 0
fi

# Source helper functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/session-helpers.sh" ]; then
    source "$SCRIPT_DIR/lib/session-helpers.sh"
else
    # Minimal fallback
    mkdir -p "$INSTANCE_DIR"
    get_instance_id() {
        local tty_raw=$(tty 2>/dev/null)
        local tty_id=""
        if [ -n "$tty_raw" ] && [ "$tty_raw" != "not a tty" ]; then
            tty_id=$(echo "$tty_raw" | sed 's|^/dev/||' | tr '/' '_')
        else
            tty_id="notty_${PPID:-$$}"
        fi
        local instance_file="$INSTANCE_DIR/.instance_$tty_id"
        if [ ! -f "$instance_file" ]; then
            echo "instance-$(date +%s)-$$" > "$instance_file"
        fi
        cat "$instance_file"
    }
fi

# Get stable instance ID
INSTANCE_ID=$(get_instance_id)
SESSION_ID=""
DETECTION_METHOD=""

# SAFEGUARD: Check if the Claude process for this instance is still running
# This prevents false detachments when hooks run in child processes
INSTANCE_PID=$(sqlite3 "$HIVE_DB" "SELECT pid FROM instance_sessions
    WHERE instance_id = '$INSTANCE_ID' AND status = 'active';" 2>/dev/null)

if [ -n "$INSTANCE_PID" ] && ps -p "$INSTANCE_PID" >/dev/null 2>&1; then
    # Process is still running - check if it's actually a Claude process
    PROCESS_NAME=$(ps -p "$INSTANCE_PID" -o comm= 2>/dev/null)
    if [ "$PROCESS_NAME" = "claude" ]; then
        # Claude is still running, don't detach
        # This is a false trigger (e.g., child process exit, interrupted operation)
        exit 0
    fi
fi

# Priority 1: Instance-specific session file
if [ -f "$INSTANCE_DIR/.session_$INSTANCE_ID" ]; then
    SESSION_ID=$(cat "$INSTANCE_DIR/.session_$INSTANCE_ID" 2>/dev/null)
    DETECTION_METHOD="instance-file"
fi

# Priority 2: Query instance_sessions table
if [ -z "$SESSION_ID" ]; then
    SESSION_ID=$(sqlite3 "$HIVE_DB" "SELECT session_id FROM instance_sessions
        WHERE instance_id = '$INSTANCE_ID'
        AND status = 'active'
        LIMIT 1;" 2>/dev/null)
    if [ -n "$SESSION_ID" ]; then
        DETECTION_METHOD="instance-db"
    fi
fi

# Priority 3: HIVE_SESSION_ID environment variable (legacy)
if [ -z "$SESSION_ID" ] && [ -n "$HIVE_SESSION_ID" ]; then
    SESSION_ID="$HIVE_SESSION_ID"
    DETECTION_METHOD="environment"
fi

# NO FALLBACK to .active_session or "most recent" - prevents cross-contamination

if [ -n "$SESSION_ID" ]; then
    # Get instance statistics before detaching
    INSTANCE_STATS=""
    CHECKPOINT_COUNT=0
    OP_COUNT=0

    if type get_instance_stats &>/dev/null; then
        INSTANCE_STATS=$(get_instance_stats "$INSTANCE_ID")
        CHECKPOINT_COUNT=$(echo "$INSTANCE_STATS" | cut -d'|' -f1)
        OP_COUNT=$(echo "$INSTANCE_STATS" | cut -d'|' -f2)
    else
        STATS=$(sqlite3 "$HIVE_DB" "SELECT checkpoint_count, operation_count FROM instance_sessions
            WHERE instance_id = '$INSTANCE_ID';" 2>/dev/null)
        CHECKPOINT_COUNT=$(echo "$STATS" | cut -d'|' -f1)
        OP_COUNT=$(echo "$STATS" | cut -d'|' -f2)
    fi

    # Get session statistics
    SWARM_ID=$(sqlite3 "$HIVE_DB" "SELECT swarm_id FROM sessions WHERE id = '$SESSION_ID';" 2>/dev/null)
    AGENT_COUNT=$(sqlite3 "$HIVE_DB" "SELECT COUNT(*) FROM agents WHERE swarm_id = '$SWARM_ID';" 2>/dev/null)
    TASK_COUNT=$(sqlite3 "$HIVE_DB" "SELECT COUNT(*) FROM tasks WHERE swarm_id = '$SWARM_ID';" 2>/dev/null)
    OBJECTIVE=$(sqlite3 "$HIVE_DB" "SELECT substr(objective, 1, 80) FROM sessions WHERE id = '$SESSION_ID';" 2>/dev/null)

    # Count remaining active instances (excluding current)
    REMAINING_INSTANCES=0
    if type count_active_instances &>/dev/null; then
        TOTAL_INSTANCES=$(count_active_instances "$SESSION_ID")
        REMAINING_INSTANCES=$((TOTAL_INSTANCES - 1))
    else
        REMAINING_INSTANCES=$(sqlite3 "$HIVE_DB" "SELECT COUNT(*) FROM instance_sessions
            WHERE session_id = '$SESSION_ID' AND status = 'active' AND instance_id != '$INSTANCE_ID';" 2>/dev/null)
    fi

    # Get total operation count across all instances
    TOTAL_OP_COUNT=$(sqlite3 "$HIVE_DB" "SELECT COALESCE(SUM(operation_count), 0) FROM instance_sessions
        WHERE session_id = '$SESSION_ID';" 2>/dev/null || echo "$OP_COUNT")

    # Save final checkpoint with instance attribution
    sqlite3 "$HIVE_DB" "UPDATE sessions SET
        checkpoint_data = json_set(
            COALESCE(checkpoint_data, '{}'),
            '\$.lastCheckpoint', datetime('now', 'localtime'),
            '\$.savedBy', 'stop:$INSTANCE_ID',
            '\$.sessionDetection', '$DETECTION_METHOD',
            '\$.savedAt', datetime('now', 'localtime'),
            '\$.checkpointType', 'final',
            '\$.agentCount', ${AGENT_COUNT:-0},
            '\$.taskCount', ${TASK_COUNT:-0},
            '\$.operationCount', ${TOTAL_OP_COUNT:-0},
            '\$.swarmId', '$SWARM_ID',
            '\$.remainingInstances', ${REMAINING_INSTANCES:-0}
        ),
        updated_at = datetime('now', 'localtime')
        WHERE id = '$SESSION_ID';" 2>/dev/null

    # Mark instance as detached (not active)
    if type detach_instance &>/dev/null; then
        detach_instance "$INSTANCE_ID"
    else
        sqlite3 "$HIVE_DB" "UPDATE instance_sessions SET
            status = 'detached',
            last_seen = datetime('now', 'localtime')
            WHERE instance_id = '$INSTANCE_ID';" 2>/dev/null
    fi

    # Log detachment to session_logs
    sqlite3 "$HIVE_DB" "INSERT INTO session_logs (session_id, log_level, message, data)
        SELECT '$SESSION_ID', 'info', 'Instance detached',
        json_object('instanceId', '$INSTANCE_ID', 'checkpoints', ${CHECKPOINT_COUNT:-0},
                    'operations', ${OP_COUNT:-0}, 'remainingInstances', ${REMAINING_INSTANCES:-0})
        WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='session_logs');" 2>/dev/null

    # Output status
    echo "Hive-mind checkpoint saved"
    echo "  Session: $SESSION_ID"
    echo "  Instance: $INSTANCE_ID (detached)"
    echo "  Detection: $DETECTION_METHOD"
    echo "  This instance: Checkpoints: ${CHECKPOINT_COUNT:-0} | Operations: ${OP_COUNT:-0}"
    echo "  Session totals: Agents: ${AGENT_COUNT:-0} | Tasks: ${TASK_COUNT:-0}"

    if [ "${REMAINING_INSTANCES:-0}" -gt 0 ]; then
        echo "  Note: $REMAINING_INSTANCES other instance(s) still active on this session"
    fi

    # Cleanup instance-specific files
    rm -f "$INSTANCE_DIR/.session_$INSTANCE_ID" 2>/dev/null
    rm -f "$INSTANCE_DIR/.last_checkpoint_$INSTANCE_ID" 2>/dev/null
    # Keep .instance_{tty} file for reuse on next Claude start
fi
