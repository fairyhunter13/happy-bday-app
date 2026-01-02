# PostToolUse:Task Hook Implementation Guide

## Current Implementation Status

### Green Lights ✓

1. **Hook Files Exist & Are Executable**:
   - `.claude/hooks/task-agent-tracker.sh` - fully implemented
   - `.claude/hooks/auto-checkpoint.sh` - fully implemented
   - `.claude/hooks/lib/queue-lib.sh` - production-ready queue library
   - `.claude/hooks/lib/queue-worker.sh` - worker daemon implemented

2. **Hook Configuration**:
   - `.claude/settings.json` properly configured
   - PostToolUse:Task hooks registered
   - PostToolUse:Write|Edit|Task hooks registered
   - Stop and SessionStart hooks registered

3. **Database Schema**:
   - agents table exists with all required fields
   - sessions table exists with checkpoint_data column
   - instance_sessions table exists
   - session_logs table exists
   - All foreign keys properly defined

4. **Queue Infrastructure**:
   - Directory structure created: `.hive-mind/queue/{pending,processing,completed,failed,.tmp}`
   - Sequence file: `.hive-mind/queue/.seq`
   - Stats file: `.hive-mind/queue/stats.json`
   - Worker PID management in place

### Red Lights ✗

1. **Empty SQL in Queue Messages**:
   - Multiple queue entries have `"sql":""` (empty)
   - Examples: priority-3 (checkpoint), priority-5 (agent insert)
   - Root cause: Unknown (likely test artifacts or incomplete implementation)

2. **Queue Worker Status Unclear**:
   - No confirmation that worker is actively running
   - Check: `ps aux | grep queue-worker`
   - Check: `.hive-mind/queue/worker.pid` exists and points to running process

3. **Metrics/Monitoring**:
   - Stats file exists but unclear if being updated
   - No monitoring dashboard or alerts configured
   - No visibility into queue depth or processing rate

### Yellow Lights ⚠

1. **Instance Session Tracking**:
   - Relies on `.hive-mind/instances/.session_<INSTANCE_ID>` files
   - May not be created automatically (depends on session-start.sh)
   - Verify: `ls .hive-mind/instances/`

2. **Cleanup Triggering**:
   - agent-lifecycle-cleanup.sh spawned every 10 checkpoints
   - May accumulate orphan agents if not working properly
   - Verify: `cat .hive-mind/logs/cleanup.log`

3. **Cross-Instance Validation**:
   - Hooks check session assignment to prevent cross-contamination
   - If session marker files not created, all instances see same session (BUG)
   - Verify: `.hive-mind/instances/.session_*` files exist for each instance

---

## Immediate Actions Required

### Action 1: Verify Worker is Running

```bash
# Check if worker process exists
ps aux | grep 'queue-worker.sh' | grep -v grep

# Expected output:
# user  12345  0.0  0.1 ... queue-worker.sh

# If NOT running:
nohup .claude/hooks/lib/queue-worker.sh </dev/null >/dev/null 2>&1 &
echo $! > .hive-mind/queue/worker.pid
```

### Action 2: Clean Up Empty SQL Queue Entries

```bash
# Find and remove entries with empty SQL
find .hive-mind/queue/pending -name "*.json" -exec grep -l '"sql":""' {} \;

# Remove them (or move to backup)
find .hive-mind/queue/pending -name "*.json" -exec grep -l '"sql":""' {} \; \
  | xargs -I {} mv {} {}.invalid

# Verify they're gone
ls .hive-mind/queue/pending/*.json | wc -l
```

### Action 3: Verify Session-to-Instance Mapping

```bash
# Check if instance session files exist
ls .hive-mind/instances/.session_*

# Expected: at least one file per active instance

# If none found, manually create for current instance:
INSTANCE_ID="instance-$(date +%s)-$$"
SESSION_ID="$(cat .hive-mind/.active_session)"
echo "$SESSION_ID" > ".hive-mind/instances/.session_$INSTANCE_ID"

# Verify
cat ".hive-mind/instances/.session_$INSTANCE_ID"
```

### Action 4: Test Hook Execution

```bash
# Simulate Task tool invocation
cat << 'EOF' | .claude/hooks/task-agent-tracker.sh
{
  "tool_input": {
    "model": "claude-opus",
    "subagent_type": "coder",
    "description": "Test task for hook validation"
  }
}
EOF

# Expected: No error, silent success
# Check queue for new entries:
ls -lt .hive-mind/queue/pending/ | head -5
```

### Action 5: Monitor Queue Depth

```bash
# Check pending queue size
ls -1 .hive-mind/queue/pending/*.json 2>/dev/null | wc -l

# If > 100: Queue is backed up
# If > 1000: Critical condition (worker not processing)

# Check completion rate
ls -1 .hive-mind/queue/completed/*.json 2>/dev/null | wc -l

# Check failure rate
ls -1 .hive-mind/queue/failed/*.json 2>/dev/null | wc -l

# View worker log
tail -50 .hive-mind/queue/worker.log

# View cleanup log
tail -50 .hive-mind/logs/cleanup.log
```

---

## Implementation Validation Checklist

### Pre-Deployment Verification

- [ ] **Queue Library Available**:
  ```bash
  [ -f .claude/hooks/lib/queue-lib.sh ] && echo "✓" || echo "✗"
  ```

- [ ] **Worker Script Available**:
  ```bash
  [ -f .claude/hooks/lib/queue-worker.sh ] && \
  [ -x .claude/hooks/lib/queue-worker.sh ] && echo "✓" || echo "✗"
  ```

- [ ] **Database Exists**:
  ```bash
  [ -f .hive-mind/hive.db ] && echo "✓" || echo "✗"
  ```

- [ ] **Required Tables Exist**:
  ```bash
  sqlite3 .hive-mind/hive.db \
    "SELECT name FROM sqlite_master WHERE type='table'" | \
    grep -E '^(agents|sessions|instance_sessions|session_logs)$'
  ```

- [ ] **Queue Directories Writable**:
  ```bash
  touch .hive-mind/queue/pending/test.json && \
  rm .hive-mind/queue/pending/test.json && echo "✓" || echo "✗"
  ```

- [ ] **Hooks Executable**:
  ```bash
  [ -x .claude/hooks/task-agent-tracker.sh ] && \
  [ -x .claude/hooks/auto-checkpoint.sh ] && echo "✓" || echo "✗"
  ```

### Hook Function Verification

- [ ] **Task Agent Tracker - Session Lookup**:
  ```bash
  # Should find active session or exit silently
  source .claude/hooks/task-agent-tracker.sh 2>/dev/null
  ```

- [ ] **Auto-Checkpoint - Instance ID Generation**:
  ```bash
  # Should create/read instance marker file
  ls .hive-mind/instances/.instance_* | wc -l
  [ $(ls .hive-mind/instances/.instance_* | wc -l) -gt 0 ] && echo "✓"
  ```

- [ ] **Queue Library - Enqueue Function**:
  ```bash
  source .claude/hooks/lib/queue-lib.sh
  queue_db_write "SELECT 1;" "test" 5
  [ -n "$(ls .hive-mind/queue/pending/*.json 2>/dev/null | head -1)" ] && echo "✓"
  ```

- [ ] **Worker - Process Entry**:
  ```bash
  # Check if worker can execute SQL
  # (manual inspection of worker log)
  grep -c "Completed:" .hive-mind/queue/worker.log | grep -v '^0$' && echo "✓"
  ```

### Data Integrity Verification

- [ ] **Agents Inserted Correctly**:
  ```bash
  sqlite3 .hive-mind/hive.db \
    "SELECT COUNT(*), COUNT(DISTINCT swarm_id) FROM agents;" | \
    awk -F'|' '$1 > 0 && $2 > 0 { print "✓" }'
  ```

- [ ] **Session Checkpoints Saved**:
  ```bash
  sqlite3 .hive-mind/hive.db \
    "SELECT COUNT(*) FROM sessions WHERE checkpoint_data IS NOT NULL;" | \
    grep -v '^0$' && echo "✓"
  ```

- [ ] **Instance Tracking Active**:
  ```bash
  sqlite3 .hive-mind/hive.db \
    "SELECT COUNT(*) FROM instance_sessions WHERE status='active';" | \
    grep -v '^0$' && echo "✓"
  ```

- [ ] **Logs Being Recorded**:
  ```bash
  sqlite3 .hive-mind/hive.db \
    "SELECT COUNT(*) FROM session_logs;" | \
    grep -v '^0$' && echo "✓"
  ```

---

## Performance Validation

### Latency Benchmarks

**Hook Execution Time**:

```bash
# Measure task-agent-tracker execution
time ( echo '{"tool_input":{"model":"opus"}}' | \
       .claude/hooks/task-agent-tracker.sh )

# Expected: < 50ms total
# - JSON parsing: 5-10ms
# - Session lookup: 10-20ms
# - DB query: 10-15ms
# - Enqueue: < 1ms
```

**Queue Enqueue Time**:

```bash
# Measure just the queue_db_write call
source .claude/hooks/lib/queue-lib.sh
time queue_db_write "SELECT 1;" "test" 5

# Expected: < 1ms
# - Create JSON: < 0.1ms
# - Write to temp: < 0.2ms
# - Atomic move: < 0.5ms
# - Return: < 0.1ms
```

**Worker Processing Rate**:

```bash
# Create 100 test queue entries
for i in {1..100}; do
  echo '{"seq":"'$i'","priority":5,"operation":"test","sql":"SELECT 1;"}' \
    > .hive-mind/queue/pending/5_${i}.json
done

# Measure processing time
time .claude/hooks/lib/queue-worker.sh --once

# Expected:
# - 100 entries: < 10 seconds
# - Rate: > 10 entries/second
# - Throughput: > 100 KB/sec
```

### Queue Metrics Analysis

```bash
# Parse stats file
cat .hive-mind/queue/stats.json | jq .

# Expected output:
# {
#   "enqueued": 1234,   # Total enqueued
#   "processed": 1200,  # Successfully processed
#   "failed": 5,        # Failed after retries
#   "retried": 34,      # Retry attempts
#   "direct": 100       # Direct write fallbacks
# }

# Calculate success rate
echo "scale=2; (1200 / 1234) * 100" | bc

# Expected: > 97%
```

---

## Debugging Guide

### Issue 1: Queue Messages with Empty SQL

**Symptoms**:
- `"sql":""` in pending queue entries
- Worker moves entries to failed/ with "no SQL statement" error
- Stats show high failure count

**Diagnosis**:
```bash
# Find empty SQL entries
grep -l '"sql":""' .hive-mind/queue/pending/*.json | head -5

# Check which operations have this issue
grep -l '"sql":""' .hive-mind/queue/pending/*.json | \
  xargs -I {} bash -c 'echo "=== {} ===" && cat {}'

# Look for pattern (operation type)
grep '"operation"' .hive-mind/queue/pending/*.json | \
  grep -B1 '"sql":""' | grep operation | cut -d'"' -f4 | sort | uniq -c
```

**Root Cause Analysis**:
1. SQL generation failed in hook (jq or sed error)
2. DB query returned empty result (malformed SQL)
3. Variable expansion failed (quote escaping)
4. Test/incomplete implementation

**Fix**:
1. Check hook stderr output:
   ```bash
   echo '{"tool_input":{}}' | .claude/hooks/task-agent-tracker.sh 2>&1
   ```

2. Trace SQL generation:
   ```bash
   bash -x .claude/hooks/task-agent-tracker.sh 2>&1 | grep SQL
   ```

3. Verify variable expansion:
   ```bash
   DESC="Test's description"
   DESC_ESCAPED=$(echo "$DESC" | sed "s/'/''/g")
   echo "Result: $DESC_ESCAPED"
   ```

### Issue 2: Worker Not Processing Queue

**Symptoms**:
- Queue depth constantly increasing
- No entries moving to completed/
- Worker process not found

**Diagnosis**:
```bash
# Check if worker is running
ps aux | grep queue-worker | grep -v grep

# Check PID file
cat .hive-mind/queue/worker.pid 2>/dev/null
ps -p $(cat .hive-mind/queue/worker.pid) 2>/dev/null || echo "PID dead"

# Check worker log for errors
tail -100 .hive-mind/queue/worker.log | grep -i error

# Check if queue_pending_dir is readable
ls .hive-mind/queue/pending/ 2>&1 | head -1

# Check SQLite permissions
sqlite3 .hive-mind/hive.db "SELECT 1;" 2>&1
```

**Root Cause**:
1. Worker crashed (check logs)
2. SQLite database locked (check main session)
3. Permission denied (check file ownership)
4. Orphan recovery stuck (entries in processing/)

**Fix**:
1. Restart worker:
   ```bash
   kill $(cat .hive-mind/queue/worker.pid) 2>/dev/null
   nohup .claude/hooks/lib/queue-worker.sh </dev/null >/dev/null 2>&1 &
   ```

2. Check for stuck entries:
   ```bash
   ls .hive-mind/queue/processing/
   # If any files: they're orphaned
   # Solution: move back to pending/ for retry
   mv .hive-mind/queue/processing/*.json .hive-mind/queue/pending/ 2>/dev/null
   ```

3. Fix database lock:
   ```bash
   # Close main session and wait a few seconds
   # Then manually trigger recovery:
   queue_recover_orphans 60
   ```

### Issue 3: Session Cross-Contamination

**Symptoms**:
- Instance A's checkpoints appear in Instance B's data
- session_logs mixed between instances
- Wrong session_id in checkpoint_data

**Diagnosis**:
```bash
# Check instance session assignments
for f in .hive-mind/instances/.session_*; do
  echo "Instance: $(basename $f)"
  echo "Session: $(cat $f)"
done

# Check if session_id files match actual sessions in DB
sqlite3 .hive-mind/hive.db \
  "SELECT id, status FROM sessions LIMIT 5;"

# Verify instance_sessions table
sqlite3 .hive-mind/hive.db \
  "SELECT instance_id, session_id FROM instance_sessions;"
```

**Root Cause**:
1. Session start didn't create instance marker
2. Auto-checkpoint falling back to .active_session (WRONG)
3. Environment variable $HIVE_SESSION_ID set to wrong value

**Fix**:
1. Verify session-start.sh is creating instance markers:
   ```bash
   grep -n "instance_sessions" .claude/hooks/session-start.sh
   ```

2. Ensure instance_sessions table has rows:
   ```bash
   sqlite3 .hive-mind/hive.db \
     "INSERT INTO instance_sessions (session_id, instance_id, status)
      VALUES ('session-X', 'instance-Y', 'active');"
   ```

3. Re-create instance marker:
   ```bash
   mkdir -p .hive-mind/instances
   echo "session-ID" > .hive-mind/instances/.session_instance-ID
   ```

---

## Testing Strategy

### Unit Tests for Hook Functions

**Test 1: JSON Parsing**
```bash
# Test with various JSON structures
TEST_INPUT='{
  "tool_input": {
    "model": "claude-opus",
    "subagent_type": "coder",
    "description": "Test with special chars: \"quotes\" and '\''apostrophes'\''"
  }
}'

echo "$TEST_INPUT" | .claude/hooks/task-agent-tracker.sh

# Expected: No errors, agent inserted
```

**Test 2: SQL Escaping**
```bash
# Test with problematic characters
TEST_CASES=(
  "It's broken"
  'Quoted "value"'
  "Multiple\nlines"
  "Tab\there"
)

for desc in "${TEST_CASES[@]}"; do
  DESC_ESCAPED=$(echo "$desc" | sed "s/'/''/g")
  SQL="SELECT '$DESC_ESCAPED';"
  sqlite3 .hive-mind/hive.db "$SQL" && echo "✓ $desc" || echo "✗ $desc"
done
```

**Test 3: Session Lookup Fallback**
```bash
# Simulate missing session file
rm -f .hive-mind/sessions/.session_$$

# Try to track task (should fall back to DB)
echo '{"tool_input":{"model":"opus"}}' | \
  .claude/hooks/task-agent-tracker.sh

# Expected: Falls back to DB query successfully
```

### Integration Tests

**Test 1: End-to-End Task Spawn**
```bash
# Trigger task (actual task tool preferred)
# Or simulate with hook invocation

# Verify:
# 1. Agent appears in agents table
sqlite3 .hive-mind/hive.db "SELECT COUNT(*) FROM agents WHERE type='coder';"

# 2. Queue message exists
ls .hive-mind/queue/pending/*.json | wc -l

# 3. Worker processes it
sleep 5
ls .hive-mind/queue/completed/*.json | wc -l
```

**Test 2: Concurrent Checkpoints**
```bash
# Open 3 terminals

# Terminal 1:
.claude/hooks/auto-checkpoint.sh

# Terminal 2 (wait 30 sec):
.claude/hooks/auto-checkpoint.sh

# Terminal 3 (wait 60 sec):
.claude/hooks/auto-checkpoint.sh

# Verify:
# 1. All checkpoints processed
ls .hive-mind/queue/completed/*.json | wc -l

# 2. No conflicts in sessions table
sqlite3 .hive-mind/hive.db \
  "SELECT id, checkpoint_data FROM sessions LIMIT 1;"
```

---

## Rollout Plan

### Phase 1: Validation (Day 1)

1. **Verify Deployment**:
   - Run all checklist items above
   - Confirm no red lights

2. **Clean Up Issues**:
   - Remove empty SQL queue entries
   - Fix any permission issues
   - Start worker if needed

3. **Document Current State**:
   - Save baseline metrics
   - Note any anomalies
   - Brief team on findings

### Phase 2: Enable Monitoring (Day 2)

1. **Metrics Dashboard**:
   - Set up periodic stat capture
   - Graph: queue depth, processing rate, error rate
   - Alert: queue depth > 500 or error rate > 5%

2. **Logging**:
   - Monitor worker log for errors
   - Monitor cleanup log for issues
   - Rotate logs when > 10MB

3. **Team Training**:
   - Show how to check queue status
   - How to interpret metrics
   - When to restart worker

### Phase 3: Performance Optimization (Day 3+)

1. **Tune Parameters**:
   - Adjust checkpoint interval (currently 60s)
   - Adjust batch size (currently 10)
   - Adjust cleanup trigger (currently every 10 checkpoints)

2. **Optimize SQL**:
   - Add indexes if needed
   - Use EXPLAIN QUERY PLAN
   - Benchmark before/after

3. **Scale if Needed**:
   - Monitor per-instance performance
   - Consider distributed queue if needed
   - Profile hot paths

---

## Maintenance Procedures

### Daily

```bash
# Check queue health
echo "=== Queue Status ==="
echo "Pending: $(ls .hive-mind/queue/pending/*.json 2>/dev/null | wc -l)"
echo "Processing: $(ls .hive-mind/queue/processing/*.json 2>/dev/null | wc -l)"
echo "Completed: $(ls .hive-mind/queue/completed/*.json 2>/dev/null | wc -l)"
echo "Failed: $(ls .hive-mind/queue/failed/*.json 2>/dev/null | wc -l)"

# Check stats
echo "=== Stats ==="
cat .hive-mind/queue/stats.json | jq .

# Check worker
echo "=== Worker ==="
ps aux | grep queue-worker | grep -v grep || echo "Not running"
```

### Weekly

```bash
# Archive old logs
gzip .hive-mind/queue/worker.log.*
mv .hive-mind/queue/worker.log.*.gz logs/archive/

# Clean up old completed entries (> 7 days)
find .hive-mind/queue/completed -mtime +7 -delete

# Review failed entries
echo "Failed entries:"
ls .hive-mind/queue/failed/*.json | wc -l

# Analyze failure patterns
grep '"error"' .hive-mind/queue/failed/*.json | \
  jq -r '.error' | sort | uniq -c | sort -rn
```

### Monthly

```bash
# Database maintenance
sqlite3 .hive-mind/hive.db "VACUUM;"
sqlite3 .hive-mind/hive.db "ANALYZE;"

# Generate performance report
echo "Queue Performance Summary"
cat .hive-mind/queue/stats.json | jq .
echo ""
echo "Database Size: $(du -h .hive-mind/hive.db | cut -f1)"
echo "Queue Size: $(du -h .hive-mind/queue | cut -f1)"

# Archive queue entries
tar czf .hive-mind/queue-backup-$(date +%Y%m%d).tar.gz \
  .hive-mind/queue/completed \
  .hive-mind/queue/failed
find . -name "queue-backup-*.tar.gz" -mtime +30 -delete
```

---

## Expected Outcomes

After successful implementation:

1. **Latency**: Hook execution < 50ms, queue enqueue < 1ms
2. **Throughput**: Process > 100 entries/second per worker
3. **Reliability**: > 99% success rate (< 0.1% failures)
4. **Monitoring**: Real-time visibility into queue depth and processing rate
5. **Scalability**: Can handle 1000s of agents and checkpoints
6. **Observability**: Complete audit trail of all operations

---

**This guide provides step-by-step procedures for validating, testing, and maintaining the PostToolUse:Task hook queue system in production.**
