#!/bin/bash
# Task Agent Tracker Hook
# Tracks Task tool spawns in the hive-mind database
#
# This hook receives the Task tool input via stdin and:
# 1. Extracts model, subagent_type, and description from JSON input
# 2. Creates an agent record in the hive-mind database
# 3. Associates the agent with the active swarm session
#
# Called by: PostToolUse:Task hook in .claude/settings.json

HIVE_DB=".hive-mind/hive.db"
ACTIVE_SESSION_FILE=".hive-mind/.active_session"
SESSION_DIR=".hive-mind/sessions"

# Read input from stdin
INPUT=$(cat)

# Only proceed if hive.db exists
if [ ! -f "$HIVE_DB" ]; then
    exit 0
fi

# Extract fields from JSON input
MODEL=$(echo "$INPUT" | jq -r '.tool_input.model // "default"' 2>/dev/null)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // "general-purpose"' 2>/dev/null)
DESC=$(echo "$INPUT" | jq -r '.tool_input.description // "task"' 2>/dev/null | head -c 100)

# Generate unique agent ID
AGENT_ID="task-agent-$(date +%s)-$$"

# Get current Claude Code PID
CLAUDE_PID="${HIVE_CLAUDE_PID:-${PPID:-$$}}"

# Find active session - multiple fallback methods
SESSION_ID=""

# Method 1: Check PID-specific session file
if [ -f "$SESSION_DIR/.session_$CLAUDE_PID" ]; then
    SESSION_ID=$(cat "$SESSION_DIR/.session_$CLAUDE_PID" 2>/dev/null)
fi

# Method 2: Check .active_session file
if [ -z "$SESSION_ID" ] && [ -f "$ACTIVE_SESSION_FILE" ]; then
    SESSION_ID=$(cat "$ACTIVE_SESSION_FILE" 2>/dev/null)
fi

# Method 3: Query database for most recent active session
if [ -z "$SESSION_ID" ]; then
    SESSION_ID=$(sqlite3 "$HIVE_DB" "SELECT id FROM sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null)
fi

# Exit if no session found
if [ -z "$SESSION_ID" ]; then
    exit 0
fi

# Get swarm ID for this session
SWARM_ID=$(sqlite3 "$HIVE_DB" "SELECT swarm_id FROM sessions WHERE id = '$SESSION_ID';" 2>/dev/null)

# Exit if no swarm found
if [ -z "$SWARM_ID" ]; then
    exit 0
fi

# Escape single quotes in description for SQL
DESC_ESCAPED=$(echo "$DESC" | sed "s/'/''/g")

# Insert agent record into database
# Using separate datetime() calls to avoid comma escaping issues
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

sqlite3 "$HIVE_DB" "INSERT OR REPLACE INTO agents (id, swarm_id, name, type, role, metadata, status, created_at)
VALUES (
    '$AGENT_ID',
    '$SWARM_ID',
    '$DESC_ESCAPED',
    '$AGENT_TYPE',
    'task-agent',
    json_object('model', '$MODEL', 'spawnedAt', '$TIMESTAMP', 'source', 'claude-code-task', 'sessionId', '$SESSION_ID'),
    'spawned',
    '$TIMESTAMP'
);" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "Task agent tracked: $AGENT_TYPE (model: $MODEL)"
fi
