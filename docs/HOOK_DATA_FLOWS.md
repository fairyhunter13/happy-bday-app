# Hook Data Flow Diagrams & Architectural Patterns

## 1. Task Agent Tracker Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Claude Code: Task Tool Invoked                                   │
│ Input: Task definition with optional parameters                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ .claude/settings.json PostToolUse:Task Hook Triggered           │
│ - Matcher: "Task"                                               │
│ - Command: ".claude/hooks/task-agent-tracker.sh"               │
│ - Stdin: JSON tool invocation data                              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ task-agent-tracker.sh: Parse Input                              │
│                                                                  │
│ JSON Parsing (jq or grep fallback):                            │
│   ├─ model ─────────► $MODEL (default: "default")             │
│   ├─ subagent_type ─► $AGENT_TYPE (default: "general-purpose")│
│   └─ description ───► $DESC (truncate 100 chars)              │
│                                                                  │
│ Generate timestamp: YYYY-MM-DD HH:MM:SS ────► $TIMESTAMP       │
│ Generate agent ID: task-agent-$(date +%s)-$$ ► $AGENT_ID       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Find Active Session (3-tier fallback)                           │
│                                                                  │
│ Priority 1: Check file                                         │
│   └─► .hive-mind/sessions/.session_$CLAUDE_PID               │
│       └─ Contains: SESSION_ID (if PID matches)               │
│       └─ Result: $SESSION_ID or empty                         │
│                                                                  │
│ Priority 2: Check global session marker                        │
│   └─► .hive-mind/.active_session                              │
│       └─ Contains: last active SESSION_ID                     │
│       └─ Result: $SESSION_ID or empty                         │
│                                                                  │
│ Priority 3: Query database (most recent active)                │
│   └─► SELECT id FROM sessions                                 │
│       WHERE status = 'active'                                 │
│       ORDER BY created_at DESC LIMIT 1                        │
│       └─ Result: $SESSION_ID or empty                         │
│                                                                  │
│ Exit if empty: [SILENT EXIT - no tracking for this spawn]     │
└────────────────┬────────────────────────────────────────────────┘
                 │ SESSION_ID found
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Query Swarm Association                                         │
│                                                                  │
│ SQL: SELECT swarm_id FROM sessions                            │
│      WHERE id = '$SESSION_ID'                                 │
│                                                                  │
│ Retrieve: $SWARM_ID                                            │
│                                                                  │
│ Exit if empty: [SILENT EXIT - orphaned session]               │
└────────────────┬────────────────────────────────────────────────┘
                 │ SWARM_ID found
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Build Metadata JSON                                             │
│                                                                  │
│ Using jq (preferred) or echo/sed (fallback):                  │
│ {                                                              │
│   "model": "$MODEL",                                          │
│   "spawnedAt": "$TIMESTAMP",                                 │
│   "source": "claude-code-task",                              │
│   "sessionId": "$SESSION_ID",                                │
│   "lifecycle": {                                             │
│     "type": "ephemeral",                                     │
│     "ttl": 3600,                                             │
│     "expires_at": "ISO8601 (+1 hour)",                      │
│     "cleanup_trigger": "task_complete",                      │
│     "protected": false                                        │
│   },                                                          │
│   "spawn_context": {                                         │
│     "spawned_by": "claude-code-task",                       │
│     "session_id": "$SESSION_ID",                            │
│     "instance_id": "$INSTANCE_ID"                           │
│   }                                                           │
│ }                                                              │
│                                                                │
│ Escape single quotes in $DESC: 's/\x27/'\''\x27'\''/g'     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Build SQL INSERT Statement                                      │
│                                                                  │
│ SQL="INSERT OR REPLACE INTO agents                            │
│   (id, swarm_id, name, type, role, metadata, status, created_at)│
│ VALUES (                                                        │
│   '$AGENT_ID',                                                 │
│   '$SWARM_ID',                                                 │
│   '$DESC_ESCAPED',    ← Single quotes doubled                 │
│   '$AGENT_TYPE',                                               │
│   'task-agent',                                                │
│   '$METADATA',        ← JSON string (properly escaped)        │
│   'spawned',                                                   │
│   '$TIMESTAMP'                                                 │
│ );"                                                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
        ┌────────┴────────┐
        │ USE_QUEUE=true? │
        └────────┬────────┘
              YES│NO
               │ │
   ┌───────────┘ └──────────────┐
   ▼                            ▼
┌──────────────────────┐   ┌──────────────────────────┐
│ Queue Path:          │   │ Direct Path (Fallback):  │
│ queue_db_write()     │   │ sqlite3 $HIVE_DB "$SQL"  │
└────┬─────────────────┘   └────────┬─────────────────┘
     │                              │
     ▼                              ▼
┌──────────────────────┐   ┌──────────────────────────┐
│ Enqueue Operation:   │   │ Execute Immediately      │
│ 1. Get sequence      │   │ 2. Return 0 on success   │
│ 2. Create JSON       │   │ 3. Exit 1 on error       │
│ 3. Atomic move:      │   │ 4. Silent failure        │
│    .tmp/ → pending/  │   │                          │
│ 4. Start worker      │   └────────┬─────────────────┘
│ 5. Return (< 1ms)    │            │
└────┬─────────────────┘            │
     │                              │
     └──────────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Task Tool Continues  │
         │ (Hook is non-blocking)
         └──────────────────────┘
```

---

## 2. Auto-Checkpoint Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Claude Code: Write/Edit/Task Tool Completes                     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ .claude/settings.json PostToolUse Hook Triggered                │
│ Matchers: Write|Edit|MultiEdit (lines 73-83)                   │
│           Task (lines 86-96)                                    │
│ Command: ".claude/hooks/auto-checkpoint.sh"                    │
│ Stdin: JSON tool data (file path or task info)                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ auto-checkpoint.sh: Identify Instance                            │
│                                                                  │
│ Instance ID Generation:                                        │
│   1. Get TTY: tty=$(tty 2>/dev/null)                          │
│   2. Clean: tty_id=$(echo $tty | sed 's|^/dev/||' | tr '/'...)│
│   3. Create file: .hive-mind/instances/.instance_<tty_id>     │
│   4. Check if exists:                                          │
│      YES ─► Read content ──► $INSTANCE_ID                      │
│      NO  ─► Create: echo "instance-$(date +%s)-$$" > file    │
│            ├─ Use timestamp for stability                      │
│            └─ Use $$ for uniqueness                            │
│                                                                  │
│ Result: $INSTANCE_ID = "instance-1767326021-5d91ad6e"          │
│ (persisted for all hooks in this instance)                     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Find Session Assigned to This Instance                          │
│                                                                  │
│ Priority 1: Instance-specific session file                     │
│   └─► .hive-mind/instances/.session_$INSTANCE_ID              │
│       └─ Created by session-start.sh                           │
│       └─ Contains SESSION_ID assigned to THIS instance        │
│       └─ Prevents cross-contamination between instances       │
│                                                                  │
│ Priority 2: Query instance_sessions table                      │
│   └─► SELECT session_id FROM instance_sessions               │
│       WHERE instance_id = '$INSTANCE_ID'                      │
│       AND status = 'active' LIMIT 1                           │
│       └─ Authoritative database source                        │
│                                                                  │
│ Priority 3: Environment variable (legacy)                      │
│   └─► $HIVE_SESSION_ID                                        │
│       └─ Fallback for compatibility                           │
│                                                                  │
│ NO Priority 4: .active_session or recent active session        │
│   └─ BLOCKED to prevent cross-instance contamination          │
│   └─ If no session found for THIS instance, exit              │
│                                                                  │
│ Exit if empty: [SILENT EXIT - no checkpoint for this instance] │
└────────────────┬────────────────────────────────────────────────┘
                 │ SESSION_ID found
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Check Throttling (Per-Instance)                                │
│                                                                  │
│ Throttle file: .hive-mind/instances/.last_checkpoint_$INSTANCE  │
│                                                                  │
│ Read last checkpoint time:                                     │
│   if [ -f "$LAST_CHECKPOINT_FILE" ]; then                      │
│     LAST_CHECKPOINT=$(cat $LAST_CHECKPOINT_FILE)              │
│   else                                                          │
│     LAST_CHECKPOINT=0  # First time                            │
│   fi                                                            │
│                                                                  │
│ Calculate elapsed:                                             │
│   CURRENT_TIME=$(date +%s)                                     │
│   TIME_SINCE_LAST=$((CURRENT_TIME - LAST_CHECKPOINT))         │
│                                                                  │
│ Check interval (default 60 seconds):                           │
│   if [ $TIME_SINCE_LAST -lt 60 ]; then                        │
│     exit 0  ← SKIP THIS CHECKPOINT                            │
│   fi                                                            │
│                                                                  │
│ Purpose: Prevent database thrashing                            │
│          Each instance independently throttled                 │
│          Different instances can checkpoint same session       │
└────────────────┬────────────────────────────────────────────────┘
                 │ Throttle check passed
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Update Throttle Marker                                          │
│                                                                  │
│ Write current timestamp:                                       │
│   echo $CURRENT_TIME > .last_checkpoint_$INSTANCE_ID           │
│                                                                  │
│ This marks when THIS instance last checkpointed               │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Get Operation Count for This Instance                           │
│                                                                  │
│ From helper function:                                          │
│   get_instance_stats "$INSTANCE_ID"                            │
│   ► Returns: "0|0|now|now"                                     │
│              (unavailable|ops|started|last_seen)               │
│                                                                  │
│ Parse: INSTANCE_OP_COUNT=$(echo $STATS | cut -d'|' -f2)       │
│                                                                  │
│ Query total across all instances:                              │
│   SELECT SUM(operation_count) FROM instance_sessions           │
│   WHERE session_id = '$SESSION_ID' AND status = 'active'      │
│   ► Gives TOTAL_OP_COUNT across all instances                 │
│                                                                  │
│ Increment for this operation:                                  │
│   TOTAL_OP_COUNT=$((TOTAL_OP_COUNT + 1))                      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
         ┌───────┴────────────────┬────────────┬────────┐
         │                        │            │        │
    Priority 3               Priority 5    Priority 7   │
    (High)                   (Medium)      (Low)        │
         │                        │            │        │
         ▼                        ▼            ▼        │
    ┌────────────┐         ┌────────────┐  ┌──────┐   │
    │ UPDATE     │         │ UPDATE     │  │INSERT│   │
    │ sessions   │         │ instance_  │  │sess- │   │
    │ SET        │         │ sessions   │  │ion_  │   │
    │ checkpoint │         │ SET        │  │logs  │   │
    │ _data=...  │         │ checkpoint │  │(if   │   │
    └────────────┘         │ _count++   │  │table │   │
         │                  │ ...        │  │exist)│   │
         │                  └────────────┘  └──────┘   │
         │                        │            │        │
         └─────────┬──────────────┴────────────┘        │
                   │                                     │
                   ▼                                     │
        ┌──────────────────────┐                        │
        │ Queue 3 Messages:    │                        │
        │ (All with metadata)  │                        │
        │                      │                        │
        │ All use:             │                        │
        │ queue_db_write()     │                        │
        └──────────────────────┘                        │
                   │                                     │
                   ▼                                     │
      ┌────────────────────────────┐                    │
      │ Enqueue Message 1:         │                    │
      │ - SQL: UPDATE sessions...  │                    │
      │ - Op: update_checkpoint    │                    │
      │ - Priority: 3              │                    │
      │ - File: 3_<seq>.json       │                    │
      └────────────────────────────┘                    │
                   │                                     │
                   ▼                                     │
      ┌────────────────────────────┐                    │
      │ Enqueue Message 2:         │                    │
      │ - SQL: UPDATE instance_... │                    │
      │ - Op: update_instance      │                    │
      │ - Priority: 5              │                    │
      │ - File: 5_<seq>.json       │                    │
      └────────────────────────────┘                    │
                   │                                     │
                   ▼                                     │
      ┌────────────────────────────┐                    │
      │ Enqueue Message 3:         │                    │
      │ - SQL: INSERT session_logs │                    │
      │ - Op: insert_log           │                    │
      │ - Priority: 7              │                    │
      │ - File: 7_<seq>.json       │                    │
      └────────────────────────────┘                    │
                   │                                     │
                   ▼                                     │
      ┌────────────────────────────────┐                │
      │ Periodic Cleanup Check:        │                │
      │                                │                │
      │ Read .cleanup_checkpoint_      │                │
      │ Increment counter             │                │
      │                                │                │
      │ Every 10 checkpoints:          │                │
      │   spawn agent-lifecycle-       │                │
      │   cleanup.sh periodic &        │                │
      │   (background, non-blocking)   │                │
      └────────────────────────────────┘                │
                   │                                     │
                   ▼                                     │
         ┌──────────────────────┐                        │
         │ Next Operation       │                        │
         │ Continues Immediately│                        │
         │ (No blocking)        │                        │
         └──────────────────────┘                        │
                                                         │
                                                    (Async)
                                                         │
                                                         ▼
                                    ┌────────────────────────────┐
                                    │ Queue Worker Processing:   │
                                    │ 1. Read pending/3_*.json   │
                                    │ 2. Execute UPDATE sessions │
                                    │ 3. Move to completed/      │
                                    │ 4. Read pending/5_*.json   │
                                    │ 5. Execute UPDATE instance │
                                    │ 6. Move to completed/      │
                                    │ 7. Read pending/7_*.json   │
                                    │ 8. Execute INSERT logs     │
                                    │ 9. Move to completed/      │
                                    └────────────────────────────┘
```

---

## 3. Queue Worker Processing Loop

```
┌──────────────────────────────────────────┐
│ Queue Worker Daemon Started              │
│ (queue-worker.sh)                        │
│                                          │
│ Mode: Background service                │
│ Startup: Auto-triggered by queue_db_write() or manual
│ Lifecycle: Runs until idle timeout (300s)
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│ Initialize Worker                        │
│                                          │
│ 1. Source queue-lib.sh                   │
│ 2. Register signal handlers:             │
│    - SIGTERM ► graceful shutdown        │
│    - SIGINT  ► graceful shutdown        │
│    - SIGHUP  ► graceful shutdown        │
│ 3. Create PID lock file:                 │
│    .hive-mind/queue/worker.pid           │
│ 4. Initialize event watcher (if avail): │
│    - inotifywait (Linux)                │
│    - fswatch (macOS)                    │
│    - fallback: polling                  │
│ 5. Start idle timer (300s timeout)       │
└────────────────┬─────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │ Loop: While    │
        │ RUNNING=true   │
        └────────┬───────┘
                 │
         ┌───────┴──────────┐
         │ Event Available? │
         │ (file watcher)   │
         └───────┬──────────┘
              YES│NO
               │ │
         ┌─────┘ └────────┐
         ▼                ▼
      ┌────────┐      ┌──────────┐
      │ Wait   │      │ Poll every
      │ (event-│      │ 0.1 sec  │
      │ driven)│      └──────────┘
      └────────┘
         │
         └──────┬──────┘
                ▼
    ┌─────────────────────────────┐
    │ Get Pending Entries:        │
    │                             │
    │ ls -1 queue/pending/*.json  │
    │ | sort | head -10           │
    │                             │
    │ Sort order: priority_seq    │
    │ Batch size: 10 entries      │
    │ (lower priority # = higher priority)
    └─────────────────────────────┘
                ▼
    ┌─────────────────────────────┐
    │ For Each File in Batch:     │
    └─────────────────────────────┘
                │
         ┌──────┴──────┐
         ▼             │
    ┌────────────┐     │
    │ Claim File:│     │
    │ mv pending/│     │
    │ → processing/
    │            │     │
    │ Returns:   │     │
    │ processing_│     │
    │ file path  │     │
    └────┬───────┘     │
         │             │
         ├─success─► ┌─┴──────────────┐
         │           │ Process Entry  │
         │           └────────────────┘
         │                │
         │                ▼
         │           ┌──────────────────┐
         │           │ Read & Parse JSON│
         │           │                  │
         │           │ Extract fields:  │
         │           │ - sql            │
         │           │ - operation      │
         │           │ - priority       │
         │           │ - retries        │
         │           │ - created_at     │
         │           └────┬─────────────┘
         │                │
         │                ▼
         │           ┌──────────────────┐
         │           │ Validate SQL     │
         │           │                  │
         │           │ if [ -z "$sql" ] │
         │           │   ► FAIL ENTRY   │
         │           │     (empty SQL)  │
         │           └────┬─────────────┘
         │                │
         │                ▼
         │           ┌──────────────────────┐
         │           │ Unescape SQL String  │
         │           │                      │
         │           │ Reverse JSON         │
         │           │ escaping:            │
         │           │ - \" ► "             │
         │           │ - \n ► newline      │
         │           │ - \t ► tab          │
         │           │ - \\ ► \            │
         │           └────┬─────────────────┘
         │                │
         │                ▼
         │           ┌──────────────────────┐
         │           │ Execute SQL          │
         │           │                      │
         │           │ sqlite3 \            │
         │           │  -cmd ".timeout 10000"
         │           │  $HIVE_DB "$sql"     │
         │           │                      │
         │           │ Capture output       │
         │           │ Capture exit code    │
         │           └────┬──────┬──────────┘
         │                │      │
         │           ┌────┘      └─────┐
         │           │                 │
         │        Success          Error
         │           │                 │
         │           ▼                 ▼
         │    ┌─────────────┐   ┌──────────────┐
         │    │ Complete    │   │ Error Type?  │
         │    │ Entry:      │   └──────┬───────┘
         │    │ mv process/ │          │
         │    │ → completed │     ┌────┴────┐
         │    │             │     │          │
         │    │ Update      │ Locked    Non-
         │    │ stats:      │ (BUSY)    recoverable
         │    │ processed++ │  │         │
         │    └─────────────┘  │         │
         │                     ▼         ▼
         │              ┌─────────┐  ┌──────────┐
         │              │ Retry   │  │ Fail     │
         │              │ Entry   │  │ Entry    │
         │              │         │  │          │
         │              │ mv      │  │ mv       │
         │              │ process │  │ process/ │
         │              │ → pending   │ → failed/
         │              │         │  │          │
         │              │ Increment   │ Append  │
         │              │ retries     │ error   │
         │              │ Lower       │ message │
         │              │ priority    │ Update  │
         │              │ Max 3       │ stats:  │
         │              │ retries     │ failed++│
         │              │ then fail   └──────────┘
         │              └─────────┘
         │
         └─failure (already claimed)
               ► skip to next file
                   │
         ┌─────────┴──────────┐
         │                    │
         │                    ▼
    ┌────┴─────────────────────────────┐
    │ Check Worker State:              │
    │                                  │
    │ if [ ! $WORKER_RUNNING ]; then   │
    │   break  ← stop batch processing │
    │ fi                               │
    └────┬──────────────────────────────┘
         │
    ┌────┴────────────────┐
    │ Batch Complete      │
    │ (all 10 processed)  │
    └────┬────────────────┘
         │
    ┌────┴────────────────────┐
    │ Update Idle Timer:      │
    │                         │
    │ IDLE_SECONDS = 0        │
    │ LAST_PROCESS_TIME = now │
    │                         │
    │ (Reset timeout on      │
    │ successful processing) │
    └────┬────────────────────┘
         │
    ┌────┴──────────────────────┐
    │ Check Idle Timeout:       │
    │                           │
    │ if (current_time -        │
    │     last_process_time) >  │
    │     300 seconds           │
    │                           │
    │   ► Worker exits          │
    │     (graceful shutdown)   │
    └────┬──────────────────────┘
         │
         │ Continue loop
         │
         └─► Back to "Get Pending Entries"
             (or wait for event)

┌────────────────────────────────────────────┐
│ Graceful Shutdown (SIGTERM/SIGINT)         │
│                                            │
│ 1. Set WORKER_RUNNING=false               │
│ 2. Kill file watcher process              │
│ 3. Drain remaining queue:                 │
│    - Process up to 100 entries            │
│ 4. Close logs                             │
│ 5. Remove PID lock file                   │
│ 6. Exit(0)                                │
└────────────────────────────────────────────┘
```

---

## 4. Multi-Instance Concurrency Patterns

```
Timeline: Three instances concurrent checkpointing
(All to same session)

Instance A (TTY=/dev/pts/1):
  Instance ID: instance-1767326021-5d91ad6e
  Last Checkpoint: T=0

Instance B (TTY=/dev/pts/2):
  Instance ID: instance-1767326021-5d91ad6e (different)
  Last Checkpoint: T=15

Instance C (TTY=/dev/pts/3):
  Instance ID: instance-1767326021-5d91ad6e (different)
  Last Checkpoint: T=30

Session ID: session-1767259985802-o7bqr170y (same for all)

─────────────────────────────────────────────────────────────

T=0:   Instance A: .last_checkpoint_A=0
       ├─ Checkpoint due (first time)
       ├─ Update throttle: .last_checkpoint_A=0
       ├─ Enqueue: priority-3 UPDATE sessions
       ├─ Enqueue: priority-5 UPDATE instance_sessions
       ├─ Enqueue: priority-7 INSERT session_logs
       ├─ Sessions.checkpoint_data = {...timestamp: T=0...}
       └─ Throttle set: next checkpoint at T≥60

T=15:  Instance B: .last_checkpoint_B=0
       ├─ Checkpoint due (first time)
       ├─ Update throttle: .last_checkpoint_B=15
       ├─ Enqueue: priority-3 UPDATE sessions (same row!)
       ├─ Enqueue: priority-5 UPDATE instance_sessions
       ├─ Enqueue: priority-7 INSERT session_logs
       ├─ Sessions.checkpoint_data = {...timestamp: T=15...}
       │  (overwrites A's update with B's value)
       └─ Throttle set: next checkpoint at T≥75

T=30:  Instance C: .last_checkpoint_C=0
       ├─ Checkpoint due (first time)
       ├─ Update throttle: .last_checkpoint_C=30
       ├─ Enqueue: priority-3 UPDATE sessions
       ├─ Enqueue: priority-5 UPDATE instance_sessions
       ├─ Enqueue: priority-7 INSERT session_logs
       ├─ Sessions.checkpoint_data = {...timestamp: T=30...}
       │  (overwrites B's update with C's value)
       └─ Throttle set: next checkpoint at T≥90

T=45:  Instance A: .last_checkpoint_A=0
       ├─ TIME_SINCE_LAST = 45 (< 60)
       ├─ SKIP CHECKPOINT
       └─ No queue entries

T=60:  Instance A: .last_checkpoint_A=0
       ├─ TIME_SINCE_LAST = 60 (≥ 60)
       ├─ Checkpoint due
       ├─ Enqueue 3 messages (priority 3/5/7)
       ├─ Throttle set: .last_checkpoint_A=60
       └─ Sessions.checkpoint_data = {...timestamp: T=60...}

T=75:  Instance B: .last_checkpoint_B=15
       ├─ TIME_SINCE_LAST = 60 (≥ 60)
       ├─ Checkpoint due
       ├─ Enqueue 3 messages
       ├─ Throttle set: .last_checkpoint_B=75
       └─ Sessions.checkpoint_data = {...timestamp: T=75...}

T=90:  Instance C: .last_checkpoint_C=30
       ├─ TIME_SINCE_LAST = 60 (≥ 60)
       ├─ Checkpoint due
       ├─ Enqueue 3 messages
       ├─ Throttle set: .last_checkpoint_C=90
       └─ Sessions.checkpoint_data = {...timestamp: T=90...}

─────────────────────────────────────────────────────────────

Key Properties:

1. NO CROSS-CONTAMINATION:
   - Each instance has its own throttle file
   - Each instance only checkpoints if assigned to this session
   - File: .instances/.session_<INSTANCE_ID>
   - If file missing or session doesn't match → SKIP

2. CONCURRENT UPDATES TO SAME ROW:
   - All instances update sessions.id = 'session-X'
   - SQLite WAL (Write-Ahead Logging) handles concurrency
   - Last write wins (timestamp overwritten)
   - NO CONFLICTS or locks (assuming WAL mode)

3. INDEPENDENT INSTANCE TRACKING:
   - instance_sessions table has separate rows per instance
   - UPDATE instance_sessions WHERE instance_id = 'inst-A'
   - UPDATE instance_sessions WHERE instance_id = 'inst-B'
   - UPDATE instance_sessions WHERE instance_id = 'inst-C'
   - NO ROW CONFLICTS (different primary keys)

4. SESSION_LOGS ENTRIES:
   - Each instance creates separate log entry
   - INSERT session_logs (session_id, data)
   - No conflict (separate primary keys)
   - May see interleaved entries in log

5. QUEUE ORDERING:
   - Priority-3 updates process first (checkpoints)
   - Priority-5 updates process second (instance tracking)
   - Priority-7 inserts process last (logging)
   - Ensures checkpoint finishes before instance updates
```

---

## 5. Session Lifecycle with Hooks

```
┌──────────────────────────────────────────────────────────┐
│ User starts Claude Code session                          │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ SessionStart Hook Triggered  │
        │ (.claude/settings.json)      │
        │ Command: session-start.sh    │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ session-start.sh:            │
        │ 1. Create session in DB      │
        │    INSERT sessions           │
        │    id, swarm_id, status      │
        │ 2. Create session marker:    │
        │    .hive-mind/.active_session│
        │    → session-<id>            │
        │ 3. Create PID marker:        │
        │    .sessions/.session_<PID>  │
        │    → session-<id>            │
        │ 4. Create instance:          │
        │    instance-start.sh         │
        │ 5. Assign instance to session│
        │    INSERT instance_sessions  │
        │    session_id, instance_id   │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Swarm Initialized            │
        │ Agents spawned               │
        │ Ready for tasks              │
        └──────────────┬───────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
         ▼                            ▼
    ┌────────────────┐       ┌────────────────┐
    │ User Task:     │       │ Write File:    │
    │ Task tool      │       │ Edit operation │
    │ invoked        │       │                │
    └────────┬───────┘       └────────┬───────┘
             │                        │
             ▼                        ▼
    ┌────────────────────┐  ┌─────────────────┐
    │ task-agent-        │  │ auto-checkpoint │
    │ tracker.sh runs    │  │ .sh runs        │
    │ - Find session     │  │ - Find session  │
    │ - Insert agent     │  │ - Check throttle│
    │ - Queue message    │  │ - Enqueue msgs  │
    └────┬───────────────┘  └────────┬────────┘
         │                           │
         └─────────────┬─────────────┘
                       │
                       ▼
         ┌──────────────────────────┐
         │ Queue messages pending   │
         │ (async processing)       │
         └──────────────┬───────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │ Queue worker processes   │
         │ messages                 │
         │ - UPDATE sessions        │
         │ - INSERT agents          │
         │ - INSERT session_logs    │
         └──────────────┬───────────┘
                        │
         ┌──────────────┘
         │
         ▼ (Every 10 checkpoints)
    ┌─────────────────────────────┐
    │ Periodic Cleanup Triggered  │
    │ agent-lifecycle-cleanup.sh  │
    │ - Finds expired agents      │
    │ - Soft delete (status=deleted)
    │ - Logs to cleanup.log       │
    └────────────────┬────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
    (Every 10 mins)         (Ongoing)
         │                        │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ Session continues...   │
         │ - More tasks spawned   │
         │ - More files edited    │
         │ - More checkpoints     │
         └────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │ User stops (Ctrl+C)     │
        └──────────────┬──────────┘
                       │
                       ▼
        ┌─────────────────────────┐
        │ Stop Hook Triggered     │
        │ session-checkpoint.sh   │
        │ - Save final checkpoint │
        │ - Set status='paused'   │
        │ - Close PID marker      │
        └──────────────┬──────────┘
                       │
                       ▼
        ┌─────────────────────────┐
        │ Session Paused          │
        │ Data persisted to DB    │
        │ Can resume later        │
        └─────────────────────────┘
```

---

## 6. Error Recovery Scenarios

### Scenario A: Database Locked During Insert

```
T=0:   Queue worker claims priority-5 message
       SQL: INSERT INTO agents (...)

T=0.1: Execute sqlite3 → SQLITE_BUSY (database locked)

       Main session holding lock:
       SELECT ... FROM sessions (long scan)

Decision Point:
  Error output matches: "database is locked|busy|SQLITE_BUSY"
  ↓ YES (recoverable)

Action:
  1. Move to processing/ → pending/
  2. Increment retries: 0 → 1
  3. Lower priority: 5 → 6
  4. New filename: 6_<seq>.json
  5. Log: "Database busy, will retry: insert_agent"
  6. queue_stats_increment("retried")

T=0.1-0.2: Exponential backoff (0.1 seconds)

T=0.2:   Retry attempt 1
  ├─ Claim: 6_<seq>.json from pending/
  ├─ Execute: sqlite3 INSERT agents
  ├─ Result: SUCCESS (main query completed)
  ├─ Move to completed/
  ├─ Log: "Completed: insert_agent (age: 0.1s)"
  └─ Continue

Maximum retries: 3
Backoff: 0.1s, 0.2s, 0.4s (total ~0.7s)

If all 3 retries fail:
  ├─ Move to failed/
  ├─ Append error: "max retries exceeded"
  ├─ queue_stats_increment("failed")
  └─ operator review needed
```

### Scenario B: Agent Insert with Missing Swarm

```
Precondition:
  - Session exists in DB
  - Swarm deleted from DB (unusual)
  - Trying to insert agent with FK swarm_id

Hook execution (task-agent-tracker.sh):
  1. Find SESSION_ID ✓
  2. Query: SELECT swarm_id FROM sessions
     ├─ Result: 'swarm-123' (returned value)
     └─ Continue with $SWARM_ID = 'swarm-123'
  3. Build SQL: INSERT ... swarm_id='swarm-123' ...
  4. Queue message

Worker processing:
  1. Execute: INSERT INTO agents (swarm_id='swarm-123', ...)
  2. SQLite check: FK constraint violated
     └─ Foreign key: agents.swarm_id → swarms.id
     └─ swarm-123 NOT IN (SELECT id FROM swarms)
  3. Error: "FOREIGN KEY constraint failed"
  4. Move to failed/
  5. Append error message
  6. queue_stats_increment("failed")

Recovery:
  Operator must:
  1. Check why swarm was deleted
  2. Restore swarm or fix session reference
  3. Manually re-insert agent if needed
  4. Or clean up failed queue entry
```

### Scenario C: Session Deleted While Checkpoint in Queue

```
Timeline:

T=0:   Instance A checkpoints
       ├─ Find SESSION_ID='session-X'
       ├─ Enqueue: UPDATE sessions SET ... WHERE id='session-X'
       └─ Message queued

T=5:   Operator deletes session:
       ├─ Manual: DELETE FROM sessions WHERE id='session-X'
       └─ Row deleted

T=10:  Queue worker processes message:
       └─ Execute: UPDATE sessions SET checkpoint_data=...
                   WHERE id='session-X'

       Result: 0 rows matched

SQLite Behavior:
  ├─ No error (UPDATE succeeds)
  ├─ 0 rows updated (no error)
  ├─ Exit code: 0 (success)
  ├─ Move to completed/
  └─ queue_stats_increment("processed")

Implication:
  ├─ Queue processing sees this as SUCCESS
  ├─ Stats show as "processed" not "failed"
  ├─ May be confusing for monitoring
  └─ But safe (no data corruption)

Recommendation:
  ├─ Log 0-row updates as warning
  ├─ Monitor failed checkpoints separately
  └─ Alert operator if X% of updates affect 0 rows
```

---

## Appendix: Key Data Structures

### Task Agent Tracker Variables

```bash
INPUT           # JSON from stdin (raw)
MODEL           # Tool model parameter
AGENT_TYPE      # Agent type being spawned
DESC            # Task description (100 char max)
AGENT_ID        # Generated: task-agent-<epoch>-<pid>
CLAUDE_PID      # Parent process PID
SESSION_ID      # Found via 3-tier lookup
SWARM_ID        # Queried from sessions table
TIMESTAMP       # YYYY-MM-DD HH:MM:SS
DESC_ESCAPED    # Single quotes doubled
METADATA        # JSON with lifecycle info
SQL             # INSERT statement
```

### Auto-Checkpoint Variables

```bash
INSTANCE_ID                  # TTY-based instance identifier
SESSION_ID                   # Assigned to this instance
CURRENT_TIME                 # Unix timestamp (seconds)
LAST_CHECKPOINT             # Previous checkpoint time
TIME_SINCE_LAST             # Delta in seconds
INSTANCE_OP_COUNT           # Operations in this instance
TOTAL_OP_COUNT              # Sum across all instances
CHECKPOINT_SQL              # UPDATE sessions statement
INSTANCE_SQL                # UPDATE instance_sessions statement
LOG_SQL                      # INSERT session_logs statement
CLEANUP_CHECKPOINT_COUNT    # Counter for periodic cleanup
```

### Queue Entry Fields

```json
{
  "seq": "string",          // TIMESTAMP_COUNTER
  "priority": "integer",    // 1-10 (lower = higher)
  "operation": "string",    // insert_agent, update_checkpoint, etc.
  "sql": "string",          // JSON-escaped SQL (CRITICAL)
  "metadata": "object",     // Context object
  "created_at": "string",   // ISO8601 timestamp
  "retries": "integer"      // 0-3 (incremented on retry)
}
```

### Filename Convention

```
.hive-mind/queue/pending/<priority>_<sequence>.json
  ├─ priority: 1-10 (lower = higher)
  ├─ sequence: TIMESTAMP_COUNTER (ensures FIFO per priority)
  └─ Sorting: ls -1 | sort → processes by priority then sequence

Example:
  3_1767327599N_11718.json   # Priority 3 (high)
  5_1767327794N_85421.json   # Priority 5 (medium)
  7_1767328043N_71601.json   # Priority 7 (low)

After claiming:
  .hive-mind/queue/processing/3_1767327599N_11718.json

After completion:
  .hive-mind/queue/completed/3_1767327599N_11718.json

After failure:
  .hive-mind/queue/failed/3_1767327599N_11718.json
  (with appended error field)
```

---

**This document serves as a visual reference for the complete data flows in the PostToolUse:Task hook system and its associated queue infrastructure.**
