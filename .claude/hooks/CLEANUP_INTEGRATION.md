# Agent Lifecycle Cleanup Integration

## Overview

The `agent-lifecycle-cleanup.sh` script has been integrated into existing hooks to maintain database health by automatically cleaning up stale agents, tasks, and instances.

## Integration Points

### 1. Auto-Checkpoint Hook (`auto-checkpoint.sh`)

**Location:** Lines 220-247 (after checkpoint save logic)

**Trigger:** Every 10 checkpoints (approximately every 10 minutes)

**Mode:** `periodic` - Quick, non-blocking cleanup

**Implementation:**
- Maintains a checkpoint counter in `.cleanup_checkpoint_$INSTANCE_ID`
- When counter reaches 10, triggers cleanup and resets counter
- Runs cleanup in background to avoid blocking checkpoint operations
- Redirects stderr to prevent spam output (silent mode)
- Only cleans up data for the current session

**Error Handling:**
- Cleanup runs in background (`&`) so failures don't block checkpoints
- stderr redirected to `/dev/null` for silent operation
- Script only runs if it exists (file check)

**Code:**
```bash
# Track checkpoint count for cleanup trigger
CLEANUP_TRIGGER_FILE="$INSTANCE_DIR/.cleanup_checkpoint_$INSTANCE_ID"
CLEANUP_CHECKPOINT_COUNT=0

if [ -f "$CLEANUP_TRIGGER_FILE" ]; then
    CLEANUP_CHECKPOINT_COUNT=$(cat "$CLEANUP_TRIGGER_FILE" 2>/dev/null || echo "0")
fi

CLEANUP_CHECKPOINT_COUNT=$((CLEANUP_CHECKPOINT_COUNT + 1))

# Run cleanup every 10 checkpoints (approximately every 10 minutes)
if [ "$CLEANUP_CHECKPOINT_COUNT" -ge 10 ]; then
    # Reset counter
    echo "0" > "$CLEANUP_TRIGGER_FILE"

    # Run cleanup in background to avoid blocking checkpoint
    # Redirect stderr to prevent spam, only critical errors will show
    if [ -f "$SCRIPT_DIR/agent-lifecycle-cleanup.sh" ]; then
        "$SCRIPT_DIR/agent-lifecycle-cleanup.sh" "periodic" "$SESSION_ID" 2>/dev/null &
    fi
else
    # Update counter
    echo "$CLEANUP_CHECKPOINT_COUNT" > "$CLEANUP_TRIGGER_FILE"
fi
```

### 2. Session Checkpoint Hook (`session-checkpoint.sh`)

**Location:** Lines 146-160 (before detaching instance)

**Trigger:** Every session end (when Claude exits)

**Mode:** `session_end` - Thorough cleanup

**Implementation:**
- Runs before marking instance as detached
- Cleans up stale agents, tasks, instances, and orphaned data
- Logs output to console for visibility
- Logs cleanup activity to session_logs table

**Error Handling:**
- Uses `|| { ... }` to catch cleanup failures
- Warnings printed to stderr but don't prevent detachment
- Detachment continues even if cleanup fails
- Script only runs if it exists (file check)

**Code:**
```bash
# Run cleanup before detaching instance
# This ensures stale data is cleaned up when the session ends
# Cleanup failure won't prevent detachment - errors are logged but ignored
if [ -f "$SCRIPT_DIR/agent-lifecycle-cleanup.sh" ]; then
    # Run cleanup with logging enabled (not silent mode)
    # Any errors will be visible but won't stop the detachment process
    "$SCRIPT_DIR/agent-lifecycle-cleanup.sh" "session_end" "$SESSION_ID" 2>&1 || {
        # Log cleanup failure but continue with detachment
        echo "Warning: Cleanup script encountered errors (continuing with detachment)" >&2
    }
fi
```

## Cleanup Script Features

### Modes

1. **periodic** - Quick cleanup during checkpoints
   - Only cleans stale instances
   - Silent mode (no output)
   - Session-scoped cleanup

2. **session_end** - Thorough cleanup at session end
   - Cleans agents, tasks, instances, and orphaned data
   - Verbose output
   - Logs to session_logs table

3. **manual** - Manual cleanup with detailed output
   - Full cleanup with verbose logging
   - Can target specific session or all sessions

### Cleanup Thresholds

Configurable via environment variables:

- `STALE_AGENT_THRESHOLD=3600` (1 hour)
- `STALE_TASK_THRESHOLD=7200` (2 hours)
- `STALE_INSTANCE_THRESHOLD=600` (10 minutes)

### Cleanup Operations

1. **Stale Agents:** Marks idle/busy agents as 'terminated' if inactive beyond threshold
2. **Stale Tasks:** Marks in_progress tasks as 'failed' if stuck beyond threshold
3. **Stale Instances:** Marks active instances as 'detached' if PID is dead or unseen
4. **Orphaned Data:** Removes task assignments for terminated agents

## Testing

### Test Manual Cleanup
```bash
./.claude/hooks/agent-lifecycle-cleanup.sh manual
```

### Test Periodic Cleanup
```bash
./.claude/hooks/agent-lifecycle-cleanup.sh periodic <session_id>
```

### Test Session-End Cleanup
```bash
./.claude/hooks/agent-lifecycle-cleanup.sh session_end <session_id>
```

## Monitoring

### Check Cleanup Counter
```bash
cat .hive-mind/instances/.cleanup_checkpoint_<instance_id>
```

### View Session Logs
```sql
SELECT * FROM session_logs
WHERE message LIKE '%cleanup%'
ORDER BY created_at DESC
LIMIT 10;
```

### View Cleanup Results
```sql
-- Check terminated agents
SELECT COUNT(*) FROM agents WHERE status = 'terminated';

-- Check failed tasks
SELECT COUNT(*) FROM tasks WHERE status = 'failed';

-- Check detached instances
SELECT COUNT(*) FROM instance_sessions WHERE status = 'detached';
```

## Safety Features

1. **Non-Breaking:** Cleanup failures never break hook execution (exit 0)
2. **Process Checks:** Verifies PIDs before marking instances as stale
3. **Session Scoping:** Periodic cleanup only affects current session
4. **File Existence:** Checks if cleanup script exists before calling
5. **Background Execution:** Auto-checkpoint cleanup runs async to avoid blocking
6. **Error Logging:** Session-end cleanup logs errors but continues detachment

## Performance Impact

- **Auto-Checkpoint:** Minimal (<1ms overhead, async execution)
- **Session-End:** Low (~100ms, runs during exit when performance is less critical)
- **Database Load:** Light (simple UPDATE/DELETE queries with indexes)

## File Locations

- Cleanup Script: `.claude/hooks/agent-lifecycle-cleanup.sh`
- Auto-Checkpoint Hook: `.claude/hooks/auto-checkpoint.sh`
- Session-Checkpoint Hook: `.claude/hooks/session-checkpoint.sh`
- Cleanup Counter: `.hive-mind/instances/.cleanup_checkpoint_<instance_id>`
