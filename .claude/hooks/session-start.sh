#!/bin/bash
# Session Start Hook - Multi-Instance Version
# Initializes hive-mind session tracking with instance isolation
#
# This hook:
# 1. Gets stable instance ID based on TTY (survives across hook invocations)
# 2. Looks up session for this instance using multi-fallback strategy
# 3. Registers instance with session for multi-instance coordination
# 4. Exports HIVE_SESSION_ID and HIVE_INSTANCE_ID for downstream hooks

HIVE_DB=".hive-mind/hive.db"
INSTANCE_DIR=".hive-mind/instances"
ACTIVE_SESSION_FILE=".hive-mind/.active_session"

# Only proceed if hive.db exists
if [ ! -f "$HIVE_DB" ]; then
    exit 0
fi

# Source helper functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/session-helpers.sh" ]; then
    source "$SCRIPT_DIR/lib/session-helpers.sh"
else
    # Minimal fallback if helper library not found
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

# Get stable instance ID for this Claude terminal
INSTANCE_ID=$(get_instance_id)
SESSION_ID=""
DETECTION_METHOD=""

# Priority 1: Check instance-specific session file (most reliable for multi-instance)
if [ -f "$INSTANCE_DIR/.session_$INSTANCE_ID" ]; then
    SESSION_ID=$(cat "$INSTANCE_DIR/.session_$INSTANCE_ID" 2>/dev/null)
    DETECTION_METHOD="instance-file"
fi

# Priority 2: Query instance_sessions table
if [ -z "$SESSION_ID" ]; then
    if type ensure_schema &>/dev/null; then
        ensure_schema
    fi
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

# Priority 4: Check .active_session file (legacy, with registration)
if [ -z "$SESSION_ID" ] && [ -f "$ACTIVE_SESSION_FILE" ]; then
    SESSION_ID=$(cat "$ACTIVE_SESSION_FILE" 2>/dev/null)
    DETECTION_METHOD="global-file-legacy"
    # Register this instance with the session to avoid future fallback
    if [ -n "$SESSION_ID" ]; then
        if type register_instance_session &>/dev/null; then
            register_instance_session "$SESSION_ID" "$INSTANCE_ID"
        fi
        echo "$SESSION_ID" > "$INSTANCE_DIR/.session_$INSTANCE_ID"
    fi
fi

# NO FALLBACK to "most recent active session" - this prevents cross-contamination
# If no session is found, the user needs to run hive-mind spawn/resume

if [ -n "$SESSION_ID" ]; then
    # Verify session exists and is active
    SESSION_STATUS=$(sqlite3 "$HIVE_DB" "SELECT status FROM sessions WHERE id = '$SESSION_ID';" 2>/dev/null)

    if [ "$SESSION_STATUS" = "active" ]; then
        # Register/update instance tracking
        if type register_instance_session &>/dev/null; then
            register_instance_session "$SESSION_ID" "$INSTANCE_ID"
        fi

        # Export to CLAUDE_ENV_FILE if available
        if [ -n "$CLAUDE_ENV_FILE" ]; then
            echo "export HIVE_SESSION_ID=\"$SESSION_ID\"" >> "$CLAUDE_ENV_FILE"
            echo "export HIVE_INSTANCE_ID=\"$INSTANCE_ID\"" >> "$CLAUDE_ENV_FILE"
        fi

        # Initialize instance-specific checkpoint timestamp
        echo "$(date +%s)" > "$INSTANCE_DIR/.last_checkpoint_$INSTANCE_ID"

        # Update database with instance tracking
        sqlite3 "$HIVE_DB" "UPDATE sessions SET
            metadata = json_set(
                COALESCE(metadata, '{}'),
                '\$.lastInstanceId', '$INSTANCE_ID',
                '\$.sessionStartedAt', datetime('now', 'localtime'),
                '\$.trackedBy', 'session-start-hook'
            ),
            status = 'active',
            updated_at = datetime('now', 'localtime')
            WHERE id = '$SESSION_ID';" 2>/dev/null

        # Get session details for display
        SWARM_NAME=$(sqlite3 "$HIVE_DB" "SELECT swarm_name FROM sessions WHERE id = '$SESSION_ID';" 2>/dev/null)
        OBJECTIVE=$(sqlite3 "$HIVE_DB" "SELECT substr(objective, 1, 60) FROM sessions WHERE id = '$SESSION_ID';" 2>/dev/null)

        # Count active instances on this session
        INSTANCE_COUNT=1
        if type count_active_instances &>/dev/null; then
            INSTANCE_COUNT=$(count_active_instances "$SESSION_ID")
        fi

        echo "Hive-Mind Session Active"
        echo "  Session: $SESSION_ID"
        echo "  Instance: $INSTANCE_ID"
        echo "  Swarm: $SWARM_NAME"
        echo "  Detection: $DETECTION_METHOD"
        if [ "$INSTANCE_COUNT" -gt 1 ]; then
            echo "  Multi-instance: $INSTANCE_COUNT active instances on this session"
        fi
        echo "  Auto-checkpoint: Enabled (every 60s + on exit)"

        # Clean up stale instances periodically (1 hour old)
        if type cleanup_stale_instances &>/dev/null; then
            cleanup_stale_instances 1 2>/dev/null
        fi
    else
        echo "Warning: Session $SESSION_ID is not active (status: $SESSION_STATUS)"
        echo "  Run 'npx claude-flow@alpha hive-mind resume $SESSION_ID' to reactivate"
    fi
else
    echo "No active hive-mind session for this instance."
    echo "To start or resume a session:"
    echo "  npx claude-flow@alpha hive-mind spawn 'your objective'"
    echo "  npx claude-flow@alpha hive-mind resume <session-id>"
fi
