#!/bin/bash
# =============================================================================
# Task Agent Tracker Hook - Queue-Enabled Version
# =============================================================================
#
# Tracks Task tool spawns in the hive-mind database.
# Uses queue-based writes for non-blocking operation.
#
# FEATURES:
# - Non-blocking: Uses queue for database writes (<1ms latency)
# - Fallback: Falls back to direct write if queue unavailable
# - Feature flag: USE_QUEUE=true/false to toggle queue usage
# - Backward compatible: Works with existing database schema
#
# Called by: PostToolUse:Task hook in .claude/settings.json
#
# =============================================================================

set -o pipefail

# Configuration
HIVE_DB="${HIVE_DB:-.hive-mind/hive.db}"
ACTIVE_SESSION_FILE=".hive-mind/.active_session"
SESSION_DIR=".hive-mind/sessions"

# Feature flag for queue usage (default: enabled)
USE_QUEUE="${USE_QUEUE:-true}"

# =============================================================================
# Source Queue Library (if available)
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUEUE_AVAILABLE=false

if [ "$USE_QUEUE" = "true" ] && [ -f "$SCRIPT_DIR/lib/queue-lib.sh" ]; then
    source "$SCRIPT_DIR/lib/queue-lib.sh" 2>/dev/null && QUEUE_AVAILABLE=true
fi

# =============================================================================
# Helper Functions
# =============================================================================

# Execute SQL using queue or direct write
db_write() {
    local sql="$1"
    local operation="${2:-generic}"
    local priority="${3:-5}"

    if [ "$QUEUE_AVAILABLE" = "true" ]; then
        # Use queue for non-blocking write
        queue_db_write "$sql" "$operation" "$priority"
    else
        # Direct write (blocking)
        sqlite3 "$HIVE_DB" "$sql" 2>/dev/null
    fi
}

# Execute SQL read (always direct, no queue)
db_read() {
    local sql="$1"
    sqlite3 "$HIVE_DB" "$sql" 2>/dev/null
}

# =============================================================================
# Main Logic
# =============================================================================

# Read input from stdin
INPUT=$(cat)

# Only proceed if hive.db exists
if [ ! -f "$HIVE_DB" ]; then
    exit 0
fi

# Extract fields from JSON input (use jq if available, fallback to grep)
if command -v jq >/dev/null 2>&1; then
    MODEL=$(echo "$INPUT" | jq -r '.tool_input.model // "default"' 2>/dev/null)
    AGENT_TYPE=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // "general-purpose"' 2>/dev/null)
    DESC=$(echo "$INPUT" | jq -r '.tool_input.description // "task"' 2>/dev/null | head -c 100)
else
    # Fallback to grep-based extraction
    MODEL=$(echo "$INPUT" | grep -o '"model"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    MODEL=${MODEL:-default}
    AGENT_TYPE=$(echo "$INPUT" | grep -o '"subagent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
    AGENT_TYPE=${AGENT_TYPE:-general-purpose}
    DESC=$(echo "$INPUT" | grep -o '"description"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/' | head -c 100)
    DESC=${DESC:-task}
fi

# Generate unique agent ID
AGENT_ID="task-agent-$(date +%s)-$$"

# Get current Claude Code PID
CLAUDE_PID="${HIVE_CLAUDE_PID:-${PPID:-$$}}"

# =============================================================================
# Find Active Session
# =============================================================================

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
    SESSION_ID=$(db_read "SELECT id FROM sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1;")
fi

# Exit if no session found
if [ -z "$SESSION_ID" ]; then
    exit 0
fi

# Get swarm ID for this session
SWARM_ID=$(db_read "SELECT swarm_id FROM sessions WHERE id = '$SESSION_ID';")

# Exit if no swarm found
if [ -z "$SWARM_ID" ]; then
    exit 0
fi

# =============================================================================
# Insert Agent Record
# =============================================================================

# Escape single quotes in description for SQL
DESC_ESCAPED=$(echo "$DESC" | sed "s/'/''/g")

# Get timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# =============================================================================
# Lifecycle Metadata
# =============================================================================
# Task agents are ephemeral - they exist only for the duration of a task.
# This metadata helps the hive-mind system:
# - Track agent lifetime and cleanup expired agents
# - Identify which agents are protected from cleanup
# - Understand spawn relationships and dependencies
# - Set appropriate TTL based on task complexity

# Calculate lifecycle parameters
TTL=3600  # Default: 1 hour (can be adjusted based on task complexity)
EXPIRES_AT=$(date -u -v+1H '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d '+1 hour' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null)
INSTANCE_ID="${HIVE_INSTANCE_ID:-$(hostname)-$$}"

# Build metadata JSON with lifecycle information
# Uses jq to properly structure nested JSON objects
if command -v jq >/dev/null 2>&1; then
    METADATA=$(jq -n \
        --arg model "$MODEL" \
        --arg spawnedAt "$TIMESTAMP" \
        --arg source "claude-code-task" \
        --arg sessionId "$SESSION_ID" \
        --arg lifecycleType "ephemeral" \
        --argjson ttl "$TTL" \
        --arg expiresAt "$EXPIRES_AT" \
        --arg cleanupTrigger "task_complete" \
        --arg spawnedBy "claude-code-task" \
        --arg instanceId "$INSTANCE_ID" \
        '{
            model: $model,
            spawnedAt: $spawnedAt,
            source: $source,
            sessionId: $sessionId,
            lifecycle: {
                type: $lifecycleType,
                ttl: $ttl,
                expires_at: $expiresAt,
                cleanup_trigger: $cleanupTrigger,
                protected: false
            },
            spawn_context: {
                spawned_by: $spawnedBy,
                session_id: $sessionId,
                instance_id: $instanceId
            }
        }')
else
    # Fallback: Basic JSON without nested objects if jq not available
    METADATA="{\"model\":\"$MODEL\",\"spawnedAt\":\"$TIMESTAMP\",\"source\":\"claude-code-task\",\"sessionId\":\"$SESSION_ID\"}"
fi

# Build SQL statement
SQL="INSERT OR REPLACE INTO agents (id, swarm_id, name, type, role, metadata, status, created_at)
VALUES (
    '$AGENT_ID',
    '$SWARM_ID',
    '$DESC_ESCAPED',
    '$AGENT_TYPE',
    'task-agent',
    '$METADATA',
    'spawned',
    '$TIMESTAMP'
);"

# Execute write (queued or direct)
if db_write "$SQL" "insert_agent" 5; then
    echo "Task agent tracked: $AGENT_TYPE (model: $MODEL)"
fi
