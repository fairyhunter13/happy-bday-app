#!/bin/bash
# Hive Session Link Script
# Links the active hive-mind session ID to Claude Code hooks
#
# Usage:
#   After running: npx claude-flow hive-mind spawn "objective"
#   After running: npx claude-flow hive-mind resume session-id
#   After running: npx claude-flow hive-mind wizard
#
# This script uses claude-flow CLI to get the session ID and writes it
# to .hive-mind/.active_session for the hooks to use.
#
# Can be called manually or integrated into a post-command hook

HIVE_DB=".hive-mind/hive.db"
ACTIVE_SESSION_FILE=".hive-mind/.active_session"

# Check if hive.db exists
if [ ! -f "$HIVE_DB" ]; then
    echo "Error: Hive database not found at $HIVE_DB"
    echo "Run 'npx claude-flow hive-mind init' first"
    exit 1
fi

# Parse command line argument for specific session
SESSION_ID_ARG="$1"

if [ -n "$SESSION_ID_ARG" ]; then
    # Validate the provided session ID using claude-flow
    SESSIONS_OUTPUT=$(npx claude-flow@alpha hive-mind sessions 2>/dev/null)
    if echo "$SESSIONS_OUTPUT" | grep -q "Session ID: $SESSION_ID_ARG"; then
        SESSION_ID="$SESSION_ID_ARG"
    else
        echo "Error: Session '$SESSION_ID_ARG' not found"
        exit 1
    fi
else
    # Get the most recent active session using claude-flow
    # Primary method: Parse from hive-mind sessions output
    SESSIONS_OUTPUT=$(npx claude-flow@alpha hive-mind sessions 2>/dev/null)
    SESSION_ID=$(echo "$SESSIONS_OUTPUT" | grep -E "^Session ID:" | head -1 | awk '{print $3}')

    # Fallback: Direct SQLite query if CLI parsing fails
    if [ -z "$SESSION_ID" ]; then
        SESSION_ID=$(sqlite3 "$HIVE_DB" "SELECT id FROM sessions
            WHERE status = 'active'
            ORDER BY created_at DESC LIMIT 1;" 2>/dev/null)
    fi
fi

if [ -z "$SESSION_ID" ]; then
    echo "No active hive-mind session found"
    echo "Start one with: npx claude-flow hive-mind spawn 'your objective'"
    exit 1
fi

# Get session details using claude-flow status
STATUS_OUTPUT=$(npx claude-flow@alpha hive-mind status 2>/dev/null)
SWARM_NAME=$(echo "$STATUS_OUTPUT" | grep -E "Swarm ID:" | head -1 | awk '{print $3}')
OBJECTIVE=$(echo "$STATUS_OUTPUT" | grep -E "Objective:" | head -1 | sed 's/Objective: //' | head -c 80)
STATUS=$(echo "$STATUS_OUTPUT" | grep -E "Status:" | head -1 | awk '{print $2}')

# Fallback to SQLite if status parsing fails
if [ -z "$SWARM_NAME" ]; then
    SWARM_NAME=$(sqlite3 "$HIVE_DB" "SELECT swarm_name FROM sessions WHERE id = '$SESSION_ID';" 2>/dev/null)
    OBJECTIVE=$(sqlite3 "$HIVE_DB" "SELECT substr(objective, 1, 80) FROM sessions WHERE id = '$SESSION_ID';" 2>/dev/null)
    STATUS=$(sqlite3 "$HIVE_DB" "SELECT status FROM sessions WHERE id = '$SESSION_ID';" 2>/dev/null)
fi

# Write session ID to active session file
mkdir -p "$(dirname "$ACTIVE_SESSION_FILE")"
echo "$SESSION_ID" > "$ACTIVE_SESSION_FILE"

# Update session metadata using SQLite (claude-flow doesn't have a direct update command)
CLAUDE_PID="${PPID:-$$}"
sqlite3 "$HIVE_DB" "UPDATE sessions SET
    metadata = json_set(
        COALESCE(metadata, '{}'),
        '\$.claudePid', '$CLAUDE_PID',
        '\$.linkedAt', datetime('now', 'localtime'),
        '\$.linkedBy', 'hive-session-link'
    ),
    updated_at = datetime('now', 'localtime')
    WHERE id = '$SESSION_ID';" 2>/dev/null

echo "Session linked to Claude Code hooks:"
echo "  Session ID: $SESSION_ID"
echo "  Swarm: $SWARM_NAME"
echo "  Status: $STATUS"
echo "  Objective: $OBJECTIVE..."
echo "  PID: $CLAUDE_PID"
echo ""
echo "Checkpoints will automatically save to this session."
