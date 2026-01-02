#!/bin/bash
# Session Linker Hook
# Extracts session ID from hive-mind spawn/resume/wizard command output
# and registers the current Claude instance with that session
#
# This hook is called by PostToolUse:Bash and receives JSON via stdin:
# {
#   "tool_input": { "command": "npx claude-flow hive-mind resume session-xxx" },
#   "tool_result": "... Session ID: session-xxx ..."
# }

# Read input from stdin
INPUT=$(cat)

# Extract the command that was run
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only process hive-mind session commands
if ! echo "$CMD" | grep -qE "hive-mind (spawn|resume|wizard)"; then
    exit 0
fi

# Extract session ID from the command output
RESULT=$(echo "$INPUT" | jq -r '.tool_result // empty' 2>/dev/null)
SESSION_ID=$(echo "$RESULT" | grep -oE "session-[0-9]+-[a-z0-9]+" | head -1)

if [ -z "$SESSION_ID" ]; then
    # Try alternative pattern (Session ID: xxx)
    SESSION_ID=$(echo "$RESULT" | grep -oE "Session ID: session-[0-9]+-[a-z0-9]+" | head -1 | sed 's/Session ID: //')
fi

if [ -z "$SESSION_ID" ]; then
    exit 0
fi

# Source helper functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/session-helpers.sh" ]; then
    source "$SCRIPT_DIR/lib/session-helpers.sh"
else
    # Fallback: minimal implementation
    HIVE_DB=".hive-mind/hive.db"
    INSTANCE_DIR=".hive-mind/instances"
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

# Register this instance with the session
if type register_instance_session &>/dev/null; then
    register_instance_session "$SESSION_ID" "$INSTANCE_ID" "$$"
else
    # Fallback: just write files
    echo "$SESSION_ID" > "$INSTANCE_DIR/.session_$INSTANCE_ID"
fi

# Also write to legacy .active_session for backward compatibility
mkdir -p .hive-mind
echo "$SESSION_ID" > ".hive-mind/.active_session"

# Output status
echo "Session linked: $SESSION_ID"
echo "  Instance: $INSTANCE_ID"

# Get instance count if helpers are available
if type count_active_instances &>/dev/null; then
    INSTANCE_COUNT=$(count_active_instances "$SESSION_ID")
    if [ "$INSTANCE_COUNT" -gt 1 ]; then
        echo "  Multi-instance: $INSTANCE_COUNT instances on this session"
    fi
fi
