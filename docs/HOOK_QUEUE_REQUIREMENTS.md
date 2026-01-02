# PostToolUse:Task Hook Queue System Requirements

## Executive Summary

This document specifies the exact requirements for implementing a queue-based system to handle database writes from PostToolUse:Task hooks in the Claude Code environment. The analysis is based on reverse-engineering the existing hook implementations, queue system architecture, and database schema.

**Key Finding**: The current hooks are partially queue-enabled but have several empty SQL statements in the pending queue, indicating incomplete implementation or testing artifacts.

---

## Part 1: Current Hook Behavior Analysis

### 1.1 Task Agent Tracker Hook (`.claude/hooks/task-agent-tracker.sh`)

**Invocation Trigger**: PostToolUse:Task hook (defined in `.claude/settings.json` lines 86-96)

**Execution Context**:
- Receives stdin with tool invocation JSON
- Called AFTER Task tool is invoked
- Called in synchronous context (blocks Task tool completion)
- No timeout configured

**Data Capture Pipeline**:

```
STDIN (JSON)
  ↓
Extract fields:
  - model: Task tool's model parameter (jq or grep fallback)
  - subagent_type: Agent type being spawned
  - description: Task description (truncated to 100 chars)
  ↓
Find Active Session:
  1. Try .hive-mind/sessions/.session_<PID> file (most reliable)
  2. Try .hive-mind/.active_session file (fallback)
  3. Query DB for latest active session (last resort)
  ↓
Get Swarm ID:
  - Query: SELECT swarm_id FROM sessions WHERE id = '$SESSION_ID'
  ↓
Generate Agent Record & Insert
```

**Extracted Data Fields**:

| Field | Source | Format | Max Length | Required |
|-------|--------|--------|-----------|----------|
| AGENT_ID | Generated | `task-agent-$(date +%s)-$$` | 50 | Yes |
| SESSION_ID | File/DB | UUID-like string | 50 | Yes |
| SWARM_ID | DB Query | UUID-like string | 50 | Yes |
| MODEL | Tool Input | String | Any | No (defaults to "default") |
| AGENT_TYPE | Tool Input | String | 100 | No (defaults to "general-purpose") |
| DESC | Tool Input | String (truncated) | 100 | No (defaults to "task") |
| TIMESTAMP | System | YYYY-MM-DD HH:MM:SS | - | Yes |

**Database Operations**:

1. **Session Lookup Queries** (read-only, no queue):
   ```sql
   SELECT id FROM sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1;
   SELECT swarm_id FROM sessions WHERE id = '$SESSION_ID';
   ```

2. **Agent Insert Query** (write, should be queued):
   ```sql
   INSERT OR REPLACE INTO agents
   (id, swarm_id, name, type, role, metadata, status, created_at)
   VALUES (
     '$AGENT_ID',
     '$SWARM_ID',
     '$DESC_ESCAPED',
     '$AGENT_TYPE',
     'task-agent',
     '$METADATA',
     'spawned',
     '$TIMESTAMP'
   );
   ```

**Metadata Structure** (Embedded JSON):

```json
{
  "model": "string",
  "spawnedAt": "ISO8601",
  "source": "claude-code-task",
  "sessionId": "string",
  "lifecycle": {
    "type": "ephemeral",
    "ttl": 3600,
    "expires_at": "ISO8601",
    "cleanup_trigger": "task_complete",
    "protected": false
  },
  "spawn_context": {
    "spawned_by": "claude-code-task",
    "session_id": "string",
    "instance_id": "hostname-pid"
  }
}
```

**Critical Requirements**:

1. SESSION_ID **MUST** be found before attempting insert (exits if not found)
2. SWARM_ID **MUST** exist in database (exits if not found)
3. Metadata is properly JSON-escaped for SQL embedding
4. Single quotes in DESC are escaped to double single quotes (`''`)
5. Function returns 0 on success (silent unless queue available)

---

### 1.2 Auto-Checkpoint Hook (`.claude/hooks/auto-checkpoint.sh`)

**Invocation Trigger**: PostToolUse:Write, Edit, MultiEdit, Task hooks (lines 73-96)

**Execution Context**:
- Called AFTER file operations or task spawning
- Includes per-instance throttling (default: 60 seconds between checkpoints)
- Executed in multiple instances simultaneously (multi-instance safe)
- Called via separate hook invocation (not in same context as task-tracker)

**Instance Identification**:

```
Priority 1: TTY-based instance ID
  - Extract TTY identifier
  - Create .hive-mind/instances/.instance_<tty_id>
  - Format: instance-<timestamp>-<pid>

Priority 2: Fallback to notty_<pid>
```

**Data Capture Pipeline**:

```
Get Instance ID
  ↓
Check Session Assignment:
  1. Try .hive-mind/instances/.session_<INSTANCE_ID> file
  2. Query instance_sessions table
  3. Use $HIVE_SESSION_ID env var (legacy)
  4. FAIL if no session found (prevents cross-contamination)
  ↓
Throttling Check:
  - Read .hive-mind/instances/.last_checkpoint_<INSTANCE_ID>
  - Skip if < 60 seconds elapsed
  ↓
If Checkpoint:
  1. Write timestamp to throttle file
  2. Get operation count
  3. Update sessions with checkpoint data
  4. Update instance_sessions tracking
  5. Insert to session_logs
  6. Every 10 checkpoints: trigger cleanup
```

**Database Operations**:

1. **Session Lookup** (read-only):
   ```sql
   SELECT session_id FROM instance_sessions
     WHERE instance_id = '$INSTANCE_ID'
     AND status = 'active'
     LIMIT 1;
   ```

2. **Operation Count** (read):
   ```sql
   SELECT COALESCE(SUM(operation_count), 0) FROM instance_sessions
     WHERE session_id = '$SESSION_ID' AND status = 'active';
   ```

3. **Save Checkpoint** (write, high priority = 3):
   ```sql
   UPDATE sessions SET
     checkpoint_data = json_set(
       COALESCE(checkpoint_data, '{}'),
       '$.lastAutoCheckpoint', datetime('now', 'localtime'),
       '$.savedBy', 'instance:<INSTANCE_ID>',
       '$.operationCount', <COUNT>,
       '$.checkpointType', 'auto'
     ),
     updated_at = datetime('now', 'localtime')
   WHERE id = '$SESSION_ID';
   ```

4. **Update Instance Tracking** (write, priority = 5):
   ```sql
   UPDATE instance_sessions SET
     checkpoint_count = checkpoint_count + 1,
     operation_count = operation_count + 1,
     last_seen = datetime('now', 'localtime')
   WHERE instance_id = '$INSTANCE_ID';
   ```

5. **Insert Log Entry** (write, priority = 7):
   ```sql
   INSERT INTO session_logs (session_id, log_level, message, data)
   SELECT '$SESSION_ID', 'debug', 'Auto-checkpoint',
     json_object('instanceId', '$INSTANCE_ID', 'operationCount', <COUNT>)
   WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='session_logs');
   ```

**Critical Requirements**:

1. Per-instance throttling prevents excessive writes (60-second intervals)
2. Cross-contamination protection: only checkpoint if session is assigned to THIS instance
3. Cleanup triggered periodically (every 10 checkpoints = ~10 minutes)
4. Multiple tables updated atomically (via queue priority ordering)
5. Silent execution unless errors occur

---

## Part 2: Hook Invocation Patterns

### 2.1 Invocation Frequency

**Task Agent Tracker**:
- Triggered: Every Task tool invocation
- Frequency: Varies by user workflow
- Estimated: 5-50 times per session
- Synchronous: Blocks Task completion until hook finishes

**Auto-Checkpoint**:
- Triggered: After every Write, Edit, Task operation
- Frequency: Very high
- Without throttling: 100+ per minute possible
- With throttling: ~1 per 60 seconds per instance
- Expected: 3-10 instances running concurrently

### 2.2 Hook Environment Variables

**Available at Invocation**:

| Variable | Source | Value | Purpose |
|----------|--------|-------|---------|
| `HIVE_DB` | Config | `.hive-mind/hive.db` | Database path |
| `USE_QUEUE` | Config | `true` | Enable queue system |
| `HIVE_SESSION_ID` | Legacy | Session ID (if set) | Session context |
| `HIVE_CLAUDE_PID` | Legacy | Claude process ID | Process tracking |
| `HIVE_INSTANCE_ID` | Optional | Instance identifier | Instance tracking |
| `PPID` | System | Parent process ID | Fallback for agent ID |
| `$$` | System | Current shell PID | Agent ID component |

**Not Available** (must be queried or derived):
- Session ID (must query or read from files)
- Swarm ID (must query database)
- Instance session mapping (must query table)

### 2.3 Timing & Latency Requirements

**Hook Execution Constraints**:

1. Task-agent-tracker:
   - Must complete before Task tool completes
   - Target: < 50ms total execution
   - Overhead per hook: ~5-10ms
   - Queue enqueue time: < 1ms (fast path requirement)

2. Auto-checkpoint:
   - Non-blocking (uses background queue)
   - Throttled per-instance (60 second intervals)
   - Must not delay next operation
   - Allows silent failure (checkpoint is best-effort)

---

## Part 3: Database Schema Analysis

### 3.1 Relevant Tables

**agents** (written to by task-agent-tracker):
```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  role TEXT,
  capabilities TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active',
  performance_score REAL DEFAULT 0.5,
  task_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 1.0,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT DEFAULT '{}',
  FOREIGN KEY (swarm_id) REFERENCES swarms (id)
);
```

**sessions** (written to by auto-checkpoint):
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  swarm_id TEXT NOT NULL,
  swarm_name TEXT NOT NULL,
  objective TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paused_at DATETIME,
  resumed_at DATETIME,
  completion_percentage REAL DEFAULT 0,
  checkpoint_data TEXT,
  metadata TEXT,
  parent_pid INTEGER,
  child_pids TEXT,
  FOREIGN KEY (swarm_id) REFERENCES swarms (id)
);
```

**instance_sessions** (written to by auto-checkpoint):
```sql
CREATE TABLE instance_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  pid INTEGER,
  tty TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  checkpoint_count INTEGER DEFAULT 0,
  operation_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
);
```

**session_logs** (written to by auto-checkpoint):
```sql
CREATE TABLE session_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  log_level TEXT DEFAULT 'info',
  message TEXT,
  agent_id TEXT,
  data TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### 3.2 Foreign Key Relationships

```
tasks:agent_id → agents:id
tasks:swarm_id → swarms:id
agents:swarm_id → swarms:id
session_logs:session_id → sessions:id
instance_sessions:session_id → sessions:id
```

**Critical**: Agent insert must use existing SWARM_ID (FK constraint enforced)

---

## Part 4: Queue Message Format Specification

### 4.1 Queue Entry Structure

**File Location**: `.hive-mind/queue/pending/<priority>_<sequence>.json`

**JSON Schema**:

```json
{
  "seq": "1767327599N_11718",
  "priority": 5,
  "operation": "insert_agent",
  "sql": "INSERT INTO agents (id, swarm_id, ...) VALUES (...)",
  "metadata": {
    "source": "task-agent-tracker",
    "session_id": "...",
    "instance_id": "..."
  },
  "created_at": "2026-01-02T04:27:23Z",
  "retries": 0
}
```

**Field Specifications**:

| Field | Type | Format | Constraints | Notes |
|-------|------|--------|-------------|-------|
| `seq` | string | `<timestamp><counter>` | Unique per instance | Ensures FIFO for same priority |
| `priority` | integer | 1-10 | 1=highest, 10=lowest | Task tracker: 5, Checkpoints: 3/5/7 |
| `operation` | string | Operation name | e.g., "insert_agent", "update_checkpoint" | For logging/auditing |
| `sql` | string | Valid SQL | Must be escaped JSON string | **CRITICAL**: Must be present and non-empty |
| `metadata` | object | JSON object | Optional | Context for error handling |
| `created_at` | string | ISO 8601 UTC | `YYYY-MM-DDTHH:MM:SSZ` | For age calculation/timeout |
| `retries` | integer | 0-3 | Max retries before fail | Incremented on retry |

### 4.2 Priority Levels

**Current Usage**:

```
Priority 3: update_checkpoint (high - session checkpoint)
Priority 5: insert_agent, update_instance (medium)
Priority 7: insert_log (low - optional logging)
```

**Recommended Mapping**:

```
1-2: Critical system operations (rare)
3-4: Session checkpoint, agent lifecycle
5-6: Regular operations (most hooks)
7-9: Logging, non-critical updates
10: Background cleanup operations
```

### 4.3 SQL Encoding Requirements

**JSON String Escaping**:

1. Backslashes: `\` → `\\`
2. Double quotes: `"` → `\"`
3. Tabs: `\t` (literal)
4. Newlines: `\n` (literal)
5. Carriage returns: `\r` (literal)

**Example**:

Raw SQL:
```sql
INSERT INTO agents (id, swarm_id, name, metadata)
VALUES ('task-agent-123', 'swarm-456', 'My Agent', '{"model":"claude-opus"}');
```

JSON Encoded:
```json
{
  "sql": "INSERT INTO agents (id, swarm_id, name, metadata)\nVALUES ('task-agent-123', 'swarm-456', 'My Agent', '{\"model\":\"claude-opus\"}');"
}
```

### 4.4 Message Size Estimates

**Task Agent Tracker Insert**:
- SQL statement: ~300-500 bytes (variable DESC length)
- Metadata JSON: ~500-800 bytes (lifecycle info)
- Full entry: ~1-2 KB
- Typical batch: 50 entries = 50-100 KB

**Auto-Checkpoint Update**:
- SQL statement: ~200-300 bytes
- Metadata: ~100-200 bytes
- Full entry: ~500 bytes
- Typical batch: 100 entries = 50 KB

**Memory Implications**:
- 1000 pending entries: ~1-2 MB
- Directory listing: O(n) but typically fast on modern filesystems
- Worker batch processing: 10 entries at a time = 10-20 KB RAM per batch

---

## Part 5: Critical Edge Cases & Error Handling

### 5.1 Data Completeness Edge Cases

**Case 1: No Active Session Found**

```bash
SESSION_ID=$(db_read "SELECT id FROM sessions WHERE status = 'active' ...")
if [ -z "$SESSION_ID" ]; then
    exit 0  # SILENT EXIT - no queue entry created
fi
```

**Requirement**: Hooks must exit gracefully if:
- No active session exists
- Session has no associated swarm
- Instance has no session assignment

**Queue Implication**: These edge cases should NOT produce queue messages.

**Case 2: JSON Extraction Fallback**

The hook has jq-based and grep-based extraction. Grep fallback can fail to extract data.

```bash
if command -v jq >/dev/null 2>&1; then
    MODEL=$(echo "$INPUT" | jq -r '.tool_input.model // "default"' 2>/dev/null)
else
    # Fallback - may fail to extract
    MODEL=$(echo "$INPUT" | grep -o '"model"[[:space:]]*:[[:space:]]*"[^"]*"' | ...)
fi
```

**Requirement**: Queue messages with empty SQL must be rejected/detected.

**Current Problem**: Queue has entries with empty SQL:
```json
{"seq":"1767327599N_11718","priority":3,"operation":"update_checkpoint","sql":"","metadata":{}}
```

### 5.2 Concurrency & Race Conditions

**Case 1: Multiple Instances Checkpointing Same Session**

Scenario:
- Session 1 is open in 2 terminal instances
- Both instances hit 60-second checkpoint interval
- Both try to UPDATE sessions simultaneously

```
Instance A: UPDATE sessions SET checkpoint_data = json_set(...) WHERE id = 'sess-1'
Instance B: UPDATE sessions SET checkpoint_data = json_set(...) WHERE id = 'sess-1'
```

**Current Mitigation**:
- Per-instance throttle files prevent same instance from checkpointing too frequently
- Different instances can checkpoint same session (SQLite WAL handles this)

**Queue Requirement**:
- Don't deduplicate updates (both are valid)
- Use priority ordering to ensure checkpoint updates process before logs

**Case 2: Session Deleted While Checkpoint in Queue**

Scenario:
- Session is in queue as "update_checkpoint"
- User deletes session from database
- Worker tries to execute UPDATE on non-existent session

```sql
UPDATE sessions SET checkpoint_data = ... WHERE id = 'deleted-session-id'
-- Result: 0 rows affected (but no error)
```

**Current Behavior**: SQLite silently succeeds (0 rows changed).

**Requirement**: Queue worker must accept 0-row updates as success.

**Case 3: Concurrent Agent Inserts for Same Task**

Scenario:
- Task spawned quickly twice
- Two INSERT events queued
- Both have same SESSION_ID but different AGENT_IDs

```sql
INSERT INTO agents (id, swarm_id, ...) VALUES ('task-agent-123', 'swarm-456', ...);
INSERT INTO agents (id, swarm_id, ...) VALUES ('task-agent-124', 'swarm-456', ...);
```

**Current Behavior**: Both inserts succeed (PK is agent ID, not composite).

**Requirement**: Queue must allow concurrent inserts (use INSERT, not INSERT OR REPLACE).

### 5.3 Database Locking Scenarios

**Scenario**: SQLite database locked

```
Queue Worker executing INSERT agents while:
- Main session doing SELECT on sessions
- Another instance doing UPDATE instance_sessions
```

**Current Handling** (in queue-lib.sh):

```bash
if echo "$output" | grep -qiE "database is locked|busy|SQLITE_BUSY"; then
    # Recoverable - retry with exponential backoff
    queue_retry_entry "$processing_file"
else
    # Non-recoverable - fail
    queue_fail_entry "$processing_file" "$output"
fi
```

**Requirements**:
1. Max 3 retries before permanent failure
2. Exponential backoff: 0.1s, 0.2s, 0.4s
3. Log all lock timeouts for monitoring
4. Move to failed/ directory after max retries

### 5.4 Data Consistency Issues

**Issue 1: Stale Session ID in .session File**

`.hive-mind/sessions/.session_<pid>` file contains expired session ID.

**Fix**: Hooks should validate session exists in DB before using file value.

**Issue 2: Instance ID Collision**

Two different instances generate same instance ID if:
- Same TTY name (rare but possible in Docker)
- Both have same hostname + PID (impossible if using $$)

**Current Implementation**: Stores instance ID in `.hive-mind/instances/.instance_<tty_id>` for persistence.

**Requirement**: Instance IDs must be stable across hook invocations in same instance.

### 5.5 Resource Exhaustion

**Scenario 1: Unlimited Queue Growth**

If worker crashes and doesn't recover, queue grows indefinitely.

```
.hive-mind/queue/pending/
  ├── 3_1767327599N_11718.json
  ├── 3_1767327609N_16032.json
  ├── ... (thousands of entries)
```

**Current Safeguard**: Worker has idle-exit timeout (300 seconds).

**Requirement**: Implement queue cleanup:
- Orphan recovery after 30 seconds (move from processing/ back to pending/)
- Old entry cleanup after 24 hours (archive/delete completed/)

**Scenario 2: Large SQL Statements**

If DESC is very long (future enhancement), SQL can exceed 64KB.

Current constraint: DESC truncated to 100 chars.

**Requirement**: Enforce max SQL size limits:
- Reject messages > 1 MB
- Warn if > 100 KB

---

## Part 6: Hook to Queue Integration Checklist

### 6.1 Task Agent Tracker Requirements

**Pre-Queue Requirements**:
- [ ] Validate SESSION_ID exists (query DB)
- [ ] Validate SWARM_ID exists (query DB)
- [ ] Exit silently if either missing

**Queue Entry Requirements**:
- [ ] Generate valid SQL (INSERT INTO agents ...)
- [ ] Properly escape single quotes in DESC
- [ ] Properly escape JSON in metadata
- [ ] Set operation = "insert_agent"
- [ ] Set priority = 5 (medium)
- [ ] Include metadata with session_id, instance_id

**Fallback Requirements**:
- [ ] If queue unavailable: execute SQL directly
- [ ] If direct execution fails: exit silently (don't break Task tool)
- [ ] Log to queue worker log if queue available

### 6.2 Auto-Checkpoint Requirements

**Pre-Queue Requirements**:
- [ ] Generate stable instance ID (from TTY or file)
- [ ] Find session_id (from file, DB, or env)
- [ ] Validate session_id exists in DB
- [ ] Check throttle timing (60s minimum)
- [ ] Exit silently if throttle not elapsed

**Queue Entry Requirements** (three separate entries):
1. **Checkpoint Update** (priority 3):
   - [ ] SQL: UPDATE sessions SET checkpoint_data = json_set(...)
   - [ ] Operation: "update_checkpoint"
   - [ ] Include timestamp in metadata

2. **Instance Update** (priority 5):
   - [ ] SQL: UPDATE instance_sessions SET checkpoint_count++, ...
   - [ ] Operation: "update_instance"

3. **Log Insert** (priority 7):
   - [ ] SQL: INSERT INTO session_logs (...)
   - [ ] Operation: "insert_log"
   - [ ] Conditional: only if session_logs table exists

**Periodic Cleanup** (every 10 checkpoints):
- [ ] Background: spawn agent-lifecycle-cleanup.sh
- [ ] Non-blocking: use & to background process
- [ ] Suppress errors: redirect stderr to /dev/null

### 6.3 Queue System Requirements

**Enqueue Fast Path** (< 1ms):
- [ ] Create temp file in .hive-mind/queue/.tmp/
- [ ] Write JSON to temp file
- [ ] Atomic move to .hive-mind/queue/pending/<priority>_<seq>.json
- [ ] Return immediately (don't wait for worker)

**Worker Processing**:
- [ ] Poll pending/ directory for entries
- [ ] Process in priority order (1=highest)
- [ ] Within same priority, FIFO (by sequence)
- [ ] Batch size: 10 entries per iteration
- [ ] Poll interval: 0.1 seconds (event-driven if available)

**Error Handling**:
- [ ] Database locked: retry with exponential backoff
- [ ] Non-SQL errors: move to failed/
- [ ] Max 3 retries, then permanent failure
- [ ] Log all errors with timestamp

**Worker Lifecycle**:
- [ ] Single instance: use PID lock file
- [ ] Auto-start: queue_ensure_worker() when enqueuing
- [ ] Graceful shutdown: drain queue before exit
- [ ] Idle timeout: exit after 300s with no queue activity

---

## Part 7: Integration Checklist

### 7.1 Backward Compatibility

**Fallback to Direct Writes**:
- [ ] If queue library unavailable: use sqlite3 directly
- [ ] If queue unavailable: use direct write (non-blocking)
- [ ] If USE_QUEUE=false: bypass queue entirely

**Hook Compatibility**:
- [ ] Task agent tracker: no behavior change visible to user
- [ ] Auto-checkpoint: no behavior change visible to user
- [ ] Both hooks: silent operation (no output unless errors)

### 7.2 Monitoring & Observability

**Queue Statistics File** (`.hive-mind/queue/stats.json`):
```json
{
  "enqueued": 1234,
  "processed": 1200,
  "failed": 5,
  "retried": 34,
  "direct": 100
}
```

**Worker Log** (`.hive-mind/queue/worker.log`):
```
[2026-01-02 04:27:23] [info] Worker started (PID: 12345)
[2026-01-02 04:27:24] [debug] Processing: op=insert_agent, priority=5, retries=0
[2026-01-02 04:27:25] [debug] Completed: insert_agent
...
```

**Metrics to Track**:
- [ ] Queue depth (pending count)
- [ ] Processing rate (entries/second)
- [ ] Error rate (failures/1000 entries)
- [ ] Average latency (time from enqueue to complete)
- [ ] Worker uptime (time since last restart)

### 7.3 Testing Requirements

**Unit Tests**:
- [ ] JSON escaping: special characters in SQL
- [ ] Sequence generation: uniqueness under concurrency
- [ ] Session lookup: all three fallback methods
- [ ] Throttling: 60s interval enforcement
- [ ] Priority ordering: lower numbers process first

**Integration Tests**:
- [ ] Task spawn + agent insert + checkpoint atomicity
- [ ] Multiple instances concurrent checkpointing
- [ ] Queue worker crash recovery
- [ ] Database lock retry logic
- [ ] Cleanup triggering (every 10 checkpoints)

**Load Tests**:
- [ ] 1000 agents inserted in rapid succession
- [ ] 100 concurrent checkpoints (10 instances x 10 ops)
- [ ] Queue worker can keep up with enqueue rate
- [ ] No data loss under sustained load

### 7.4 Deployment Checklist

**Pre-Deployment**:
- [ ] Verify queue-lib.sh is in .claude/hooks/lib/
- [ ] Verify queue-worker.sh is in .claude/hooks/lib/
- [ ] Verify agent-lifecycle-cleanup.sh is present
- [ ] Initialize queue directories: mkdir -p .hive-mind/queue/{pending,processing,completed,failed,.tmp}
- [ ] Set permissions: chmod 755 on all scripts

**Rollout Strategy**:
- [ ] Day 1: USE_QUEUE=false (fallback to direct writes)
- [ ] Day 2: USE_QUEUE=true (monitor queue stats)
- [ ] Day 3+: Scale worker if needed

**Rollback Procedure**:
- [ ] Set USE_QUEUE=false environment variable
- [ ] Stop queue worker: kill $(cat .hive-mind/queue/worker.pid)
- [ ] Verify hooks use direct writes
- [ ] Archive queue directory for debugging

---

## Part 8: Known Issues & Current State

### 8.1 Empty SQL Statements in Queue

**Problem**: Queue contains entries with empty `"sql":""`:

```
.hive-mind/queue/pending/3_1767327599N_11718.json:
{"seq":"1767327599N_11718","priority":3,"operation":"update_checkpoint","sql":""}

.hive-mind/queue/pending/5_1767327823N_5846.json:
{"seq":"1767327823N_5846","priority":5,"operation":"insert_agent","sql":""}
```

**Root Cause**: Hooks may have incomplete SQL generation or test artifacts.

**Impact**: Worker will fail these entries (no SQL to execute).

**Recommendation**:
1. Clean up existing queue: `rm -rf .hive-mind/queue/pending/*`
2. Verify SQL generation in hooks
3. Add validation: reject empty SQL in hooks before enqueuing

### 8.2 Partial Implementation

**Status**: Hooks call `queue_db_write()` but queue worker (`queue-worker.sh`) may not be fully deployed.

**Evidence**: Queue entries accumulate without being processed.

**Requirements**:
1. Verify worker is running: `ps aux | grep queue-worker.sh`
2. Check worker log: `.hive-mind/queue/worker.log`
3. Restart worker if needed: `nohup .claude/hooks/lib/queue-worker.sh &`

### 8.3 Missing schema columns

The hook references `checkpoint_data` as TEXT in sessions table, supporting `json_set()` for updates.

**Requirements**:
- [ ] Verify SQLite version supports JSON1 extension
- [ ] Test `SELECT json_set('{}', '$.test', 'value')` works

---

## Part 9: Message Flow Diagrams

### 9.1 Task Agent Tracker Message Flow

```
Task Tool Invoked
  ↓
PostToolUse:Task Hook triggered
  ↓
task-agent-tracker.sh:
  1. Read stdin JSON
  2. Extract: model, agent_type, description
  3. Find session_id (file/DB fallback)
  4. Query swarm_id
  5. Generate metadata JSON
  6. Build INSERT SQL
  ↓
If USE_QUEUE=true:
  7. Call queue_db_write(sql, "insert_agent", 5)
     → Creates .hive-mind/queue/pending/5_<seq>.json
     → Returns immediately (< 1ms)
  8. Start worker if not running
  ↓
Else (fallback):
  7. Execute SQL directly: sqlite3 hive.db INSERT...
  ↓
Task Tool Completes
```

### 9.2 Auto-Checkpoint Message Flow

```
Write/Edit/Task Tool Completes
  ↓
PostToolUse Hook triggered (Write|Edit|Task)
  ↓
auto-checkpoint.sh:
  1. Get instance_id (from TTY or file)
  2. Find session_id (file/DB/env fallback)
  3. Check throttle: < 60s elapsed? → exit
  4. Update throttle file
  ↓
Queue 3 messages with priorities 3, 5, 7:
  ↓
Priority 3 (High):
  queue_db_write(UPDATE sessions SET checkpoint_data..., "update_checkpoint", 3)
  → .hive-mind/queue/pending/3_<seq>.json
  ↓
Priority 5 (Medium):
  queue_db_write(UPDATE instance_sessions..., "update_instance", 5)
  → .hive-mind/queue/pending/5_<seq>.json
  ↓
Priority 7 (Low):
  queue_db_write(INSERT session_logs..., "insert_log", 7)
  → .hive-mind/queue/pending/7_<seq>.json
  ↓
Periodic Cleanup (every 10 checkpoints):
  spawn .claude/hooks/agent-lifecycle-cleanup.sh periodic &
  (runs in background, non-blocking)
  ↓
Next Operation Continues (no blocking)
```

### 9.3 Queue Worker Message Processing

```
Queue Worker (queue-worker.sh)
  ↓
Loop while running:
  1. List pending files: ls -1 .hive-mind/queue/pending/*.json
  2. Sort by name (priority_seq order)
  3. Take first 10 files (batch)
  ↓
For each file:
  1. Claim: mv pending/file.json → processing/file.json
  2. Read & parse JSON
  3. Extract SQL, operation, retries
  4. Execute: sqlite3 -cmd ".timeout 10000" hive.db SQL
  ✓ If success:
     → Move to completed/
     → Update stats: processed++
  ✗ If DB locked:
     → Move back to pending/ (retry)
     → Increment retries, lower priority
  ✗ If non-recoverable error:
     → Move to failed/
     → Append error message to JSON
     → Update stats: failed++
  ↓
If no queue activity for 300s:
  → Worker exits (idle timeout)
  ↓
If parent process dies:
  → Signal handler drains queue
  → Move remaining to processing/
  → Graceful shutdown
```

---

## Part 10: Future Enhancements

### 10.1 Immediate Priorities (Week 1)

1. **Validate Queue Deployment**:
   - Verify worker is running
   - Clean up empty SQL entries
   - Test end-to-end flow

2. **Add SQL Validation**:
   - Reject empty SQL at enqueue time
   - Validate INSERT/UPDATE statements
   - Log schema mismatches

3. **Implement Metrics Dashboard**:
   - Real-time queue depth
   - Processing rate (entries/sec)
   - Error distribution

### 10.2 Medium Term (Week 2-4)

1. **Distributed Queue**:
   - Support multiple worker processes
   - Load balance across workers
   - Atomic claiming with CAS (compare-and-swap)

2. **Enhanced Monitoring**:
   - Prometheus metrics export
   - Alert on queue depth > 1000
   - Worker health checks

3. **Performance Optimization**:
   - Use SQLite WAL (Write-Ahead Logging)
   - Batch 100 entries per SQL multi-row INSERT
   - Parallel worker execution

### 10.3 Long Term (Month 2+)

1. **Persistent Queue**:
   - Migrate from file-based to SQLite-backed queue
   - Distributed transaction support
   - Queue recovery after crashes

2. **Advanced Scheduling**:
   - Time-based triggers (delay execution)
   - Dependent tasks (wait for upstream)
   - Conditional branching based on results

---

## Appendix A: Sample Queue Message

### Complete Task Agent Insert Message

```json
{
  "seq": "1767328043N_71601",
  "priority": 5,
  "operation": "insert_agent",
  "sql": "INSERT OR REPLACE INTO agents (id, swarm_id, name, type, role, metadata, status, created_at)\nVALUES (\n    'task-agent-1767328043-85421',\n    'swarm-1767259985801-jl7bdyvmz',\n    'Fix failing E2E tests - truncated description',\n    'coder',\n    'task-agent',\n    '{\"model\":\"claude-opus\",\"spawnedAt\":\"2026-01-02 04:27:23\",\"source\":\"claude-code-task\",\"sessionId\":\"session-1767259985802-o7bqr170y\",\"lifecycle\":{\"type\":\"ephemeral\",\"ttl\":3600,\"expires_at\":\"2026-01-02T05:27:23Z\",\"cleanup_trigger\":\"task_complete\",\"protected\":false},\"spawn_context\":{\"spawned_by\":\"claude-code-task\",\"session_id\":\"session-1767259985802-o7bqr170y\",\"instance_id\":\"hostname-85421\"}}',\n    'spawned',\n    '2026-01-02 04:27:23'\n);",
  "metadata": {
    "source": "task-agent-tracker",
    "session_id": "session-1767259985802-o7bqr170y",
    "instance_id": "hostname-85421"
  },
  "created_at": "2026-01-02T04:27:23Z",
  "retries": 0
}
```

### Complete Auto-Checkpoint Messages

**Message 1 - Update Checkpoint (Priority 3)**:
```json
{
  "seq": "1767328043N_71602",
  "priority": 3,
  "operation": "update_checkpoint",
  "sql": "UPDATE sessions SET\n    checkpoint_data = json_set(\n        COALESCE(checkpoint_data, '{}'),\n        '$.lastAutoCheckpoint', datetime('now', 'localtime'),\n        '$.savedBy', 'instance:instance-1767326021-5d91ad6e',\n        '$.operationCount', 131,\n        '$.checkpointType', 'auto'\n    ),\n    updated_at = datetime('now', 'localtime')\n    WHERE id = 'session-1767259985802-o7bqr170y';",
  "metadata": {
    "source": "auto-checkpoint",
    "instance_id": "instance-1767326021-5d91ad6e",
    "session_id": "session-1767259985802-o7bqr170y"
  },
  "created_at": "2026-01-02T04:27:23Z",
  "retries": 0
}
```

**Message 2 - Update Instance (Priority 5)**:
```json
{
  "seq": "1767328043N_71603",
  "priority": 5,
  "operation": "update_instance",
  "sql": "UPDATE instance_sessions SET\n    checkpoint_count = checkpoint_count + 1,\n    operation_count = operation_count + 1,\n    last_seen = datetime('now', 'localtime')\n    WHERE instance_id = 'instance-1767326021-5d91ad6e';",
  "metadata": {
    "source": "auto-checkpoint",
    "instance_id": "instance-1767326021-5d91ad6e",
    "session_id": "session-1767259985802-o7bqr170y"
  },
  "created_at": "2026-01-02T04:27:23Z",
  "retries": 0
}
```

**Message 3 - Insert Log (Priority 7)**:
```json
{
  "seq": "1767328043N_71604",
  "priority": 7,
  "operation": "insert_log",
  "sql": "INSERT INTO session_logs (session_id, log_level, message, data)\n    SELECT 'session-1767259985802-o7bqr170y', 'debug', 'Auto-checkpoint',\n    json_object('instanceId', 'instance-1767326021-5d91ad6e', 'operationCount', 131)\n    WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='session_logs');",
  "metadata": {
    "source": "auto-checkpoint",
    "instance_id": "instance-1767326021-5d91ad6e",
    "session_id": "session-1767259985802-o7bqr170y"
  },
  "created_at": "2026-01-02T04:27:23Z",
  "retries": 0
}
```

---

## Appendix B: Test Scenarios

### B1: Unit Test - JSON Escaping

**Input SQL**:
```sql
UPDATE agents SET metadata = '{"test":"it\"s a test"}' WHERE id = 'agent-1';
```

**Expected JSON Encoding**:
```json
{
  "sql": "UPDATE agents SET metadata = '{\"test\":\"it\\\"s a test\"}' WHERE id = 'agent-1';"
}
```

**Test Cases**:
- Single quote in DESC: `It's broken` → `'It''s broken'`
- Double quote in metadata: `"test"` → `\"`
- Newlines in SQL: split across lines with `\n`
- Backslashes: `\` → `\\`

### B2: Integration Test - Concurrent Checkpoints

**Setup**: 3 instances, same session
- Instance A: checkpoint cycle at T=0, T=60, T=120
- Instance B: checkpoint cycle at T=30, T=90, T=150
- Instance C: checkpoint cycle at T=15, T=75, T=135

**Expected Behavior**:
- No conflicts (different instances, per-instance throttling)
- All 9 updates succeed
- No data corruption in sessions table
- session_logs has exactly 9 entries

**Verification**:
```sql
SELECT COUNT(*) FROM session_logs WHERE session_id = 'session-X';  -- Should be 9
SELECT MAX(updated_at) FROM sessions WHERE id = 'session-X';       -- Should be T=150
```

### B3: Failure Recovery - Database Lock

**Setup**: Worker processing queue while main session runs:

1. Enqueue UPDATE statement at T=0
2. At T=0.5s: Start main session heavy query (holds lock)
3. At T=1s: Worker tries to process (gets SQLITE_BUSY)

**Expected Behavior**:
1. First retry: wait 0.1s, retry
2. Second retry: wait 0.2s, retry
3. Third retry: wait 0.4s, retry
4. All 3 retries exhaust within 1 second
5. Entry moved to failed/
6. Main query completes at T=2s (too late)

**Verification**:
```bash
ls .hive-mind/queue/failed/          # Should contain 1 entry
cat .hive-mind/queue/worker.log      # Should show 3 retries + final failure
```

---

## Summary

This document provides comprehensive analysis of the current hook behavior and queue system requirements. Key takeaways:

1. **Two hooks are queue-enabled**: task-agent-tracker and auto-checkpoint
2. **Hooks use three priority levels**: 3 (checkpoint), 5 (agents/instances), 7 (logs)
3. **Critical requirements**: Per-instance throttling, session validation, atomic file ops
4. **Current issue**: Queue has empty SQL entries (needs investigation)
5. **Deployment strategy**: Gradual rollout from fallback to queue-enabled mode

The queue system is designed for non-blocking operation with < 1ms enqueue latency and graceful fallback to direct writes if unavailable.
