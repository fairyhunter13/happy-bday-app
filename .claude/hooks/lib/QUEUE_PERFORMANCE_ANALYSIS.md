# Queue System Performance Analysis & Optimization Report

## Executive Summary

**Target**: <10ms total overhead, <1ms queue write
**Current Estimated**: 15-50ms per hook invocation
**Optimized Projected**: 0.3-2ms per hook invocation

---

## 1. Current Implementation Bottleneck Analysis

### 1.1 Queue Write Critical Path (queue_enqueue)

```
Operation                    | Time (ms) | Syscalls | Notes
-----------------------------|-----------|----------|---------------------------
queue_init()                 | 1-3       | 2-3      | mkdir -p, touch x2
get_instance_id()            | 2-5       | 3-6      | tty, sed, cat/echo
queue_format_entry()         | 3-8       | 4-6      | date, base64, echo, tr
queue_lock_acquire()         | 1-10      | 2-20     | mkdir loop, touch, sleep
echo >> $QUEUE_FILE          | 0.3-0.5   | 1        | Single append
queue_stats_increment()      | 2-5       | 1-2      | jq/sed + mv
queue_lock_release()         | 0.3-0.5   | 1        | rm -rf
queue_ensure_worker()        | 2-8       | 3-5      | ps check, nohup start
-----------------------------|-----------|----------|---------------------------
TOTAL                        | 12-40     | 17-44    | Per queue write operation
```

### 1.2 Direct SQLite Write Critical Path (current hooks)

```
Operation                    | Time (ms) | Notes
-----------------------------|-----------|---------------------------
sqlite3 spawn                | 2-5       | New process creation
SQLite open                  | 1-2       | File open, journal check
Lock acquisition             | 0-5000+   | BUSY retries if contention
Query execution              | 0.5-2     | Actual SQL work
Sync to disk                 | 2-20      | fsync depending on mode
Process cleanup              | 0.5-1     | Exit + kernel cleanup
-----------------------------|-----------|---------------------------
TOTAL                        | 6-5030+   | Huge variance from locking
```

### 1.3 Process Spawn Overhead Analysis

Each external command spawns a process. On macOS/Linux:
- `fork()`: ~0.3-1ms
- `exec()`: ~0.5-2ms
- Kernel scheduling: ~0.1-0.5ms
- Total per process: **~1-3ms minimum**

Current implementation spawns:
- `date` (timestamp)
- `base64` (encoding)
- `tr` (newline removal)
- `cut` (parsing)
- `mkdir/rm` (locking)
- `cat/echo` (file I/O)
- `ps` (worker check)
- `jq/sed` (stats update)

**Total process spawns: 8-12 per queue_enqueue call**

---

## 2. Optimization Strategy: "Zero-Fork Queue"

### 2.1 Design Philosophy

The fastest queue write is one that:
1. **Never spawns external processes** (use bash builtins only)
2. **Never blocks on locks** (use atomic operations)
3. **Minimizes file operations** (single append)
4. **Defers all non-critical work** (background worker)

### 2.2 Ultra-Fast Queue Entry Format

**Current format (requires base64):**
```
TIMESTAMP|OPERATION_TYPE|PRIORITY|SQL_BASE64|METADATA_JSON
```

**Optimized format (no encoding needed):**
```
FILENAME: {timestamp_ns}.{priority}.{pid}.{seq}.msg
CONTENT: SQL statement (raw, one line per statement)
```

**Key insight**: Use filename as metadata, file content as payload.
- No parsing needed during write
- Worker can sort by filename (natural alphanumeric order)
- Atomic file creation (no locking needed)

### 2.3 Atomic File Operations

Instead of:
```bash
flock ... echo >> queue_file  # Requires lock
```

Use:
```bash
echo "$sql" > "$QUEUE_DIR/$timestamp.$priority.$$.msg"  # Atomic create
```

File creation with unique name is atomic on POSIX systems.
No lock contention possible.

---

## 3. Optimized Implementation Details

### 3.1 Fast Timestamp Generation (No `date` command)

```bash
# Bash 5+ has $EPOCHSECONDS and $EPOCHREALTIME
# For older bash, use /proc or cached value

# Option 1: Bash 5+ (0.001ms)
timestamp=$EPOCHSECONDS

# Option 2: /proc/uptime (0.1ms, Linux only)
read uptime _ < /proc/uptime
timestamp=${uptime%.*}${uptime#*.}

# Option 3: Cached second (0.001ms)
# Pre-cache in worker, refresh every 100ms
```

### 3.2 Sequence Number Generation (No external process)

```bash
# Use PID + nanosecond counter
# Format: SECONDS.NANOSECONDS.PID
# Guaranteed unique per process

_queue_seq=0
queue_next_seq() {
    ((_queue_seq++))
    printf '%d.%06d.%d' "$EPOCHSECONDS" "$_queue_seq" "$$"
}
```

### 3.3 Zero-Lock Directory Queue

```bash
# Write: Single atomic file creation
queue_write_fast() {
    local sql="$1"
    local priority="${2:-5}"

    # Generate unique filename (no external commands)
    local ts=$EPOCHSECONDS
    local seq=$((_queue_seq++))
    local fname="$ts.$priority.$$.$seq.msg"

    # Atomic write (single syscall)
    printf '%s\n' "$sql" > "$QUEUE_DIR/$fname"
}
```

### 3.4 Worker Detection (Cached)

```bash
# Cache worker PID check for 1 second
_worker_check_time=0
_worker_running=0

queue_worker_running_fast() {
    local now=$EPOCHSECONDS
    if ((now - _worker_check_time < 1)); then
        return $_worker_running
    fi
    _worker_check_time=$now

    if [[ -f "$WORKER_PID_FILE" ]]; then
        local pid=$(<"$WORKER_PID_FILE")
        if [[ -d "/proc/$pid" ]] || kill -0 "$pid" 2>/dev/null; then
            _worker_running=0
            return 0
        fi
    fi
    _worker_running=1
    return 1
}
```

---

## 4. SQLite Worker Optimizations

### 4.1 Optimal PRAGMA Settings

```sql
-- Set on worker startup (not per-query)
PRAGMA journal_mode = WAL;           -- Write-Ahead Logging (faster concurrent reads)
PRAGMA synchronous = NORMAL;         -- Safe for WAL, faster than FULL
PRAGMA cache_size = -16000;          -- 16MB cache (negative = KB)
PRAGMA temp_store = MEMORY;          -- Temp tables in RAM
PRAGMA mmap_size = 268435456;        -- 256MB memory-mapped I/O
PRAGMA busy_timeout = 30000;         -- 30 second timeout
PRAGMA wal_autocheckpoint = 1000;    -- Checkpoint every 1000 pages
```

### 4.2 Batch Processing

```bash
# Process multiple entries in single transaction
process_batch() {
    local batch_sql="BEGIN IMMEDIATE;"

    for file in "$QUEUE_DIR"/*.msg; do
        [[ -f "$file" ]] || continue
        batch_sql+=$'\n'"$(<"$file")"
        rm -f "$file"  # Remove after reading
    done

    batch_sql+=$'\n'"COMMIT;"

    # Single sqlite3 invocation for entire batch
    sqlite3 "$HIVE_DB" "$batch_sql"
}
```

### 4.3 Connection Pooling (Worker maintains open connection)

```bash
# Use coproc to keep sqlite3 running
coproc SQLITE { sqlite3 -cmd ".timeout 30000" "$HIVE_DB"; }

# Send commands through coprocess
sqlite_exec() {
    echo "$1" >&"${SQLITE[1]}"
    read -r result <&"${SQLITE[0]}"
}
```

---

## 5. Benchmark Projections

### 5.1 Current vs Optimized

```
Operation                    | Current (ms) | Optimized (ms) | Improvement
-----------------------------|--------------|----------------|------------
Queue write (fast path)      | 15-40        | 0.2-0.5        | 30-80x
Worker batch (10 ops)        | 50-200       | 10-30          | 5-7x
Total hook overhead          | 15-50        | 0.3-2          | 15-50x
```

### 5.2 Worst Case Analysis

**Current worst case**: Lock contention + SQLite BUSY
- Queue lock wait: up to 5 seconds
- SQLite lock wait: up to 10 seconds
- Total: **15+ seconds**

**Optimized worst case**: Directory full + slow disk
- Atomic file create: ~10ms
- Worker busy: queue grows (no block)
- Total: **~10ms** (no blocking)

---

## 6. Trade-off Analysis

### 6.1 Reliability vs Speed

| Approach | Durability | Speed | Complexity |
|----------|------------|-------|------------|
| Current (queue + worker) | High | Medium | Medium |
| Optimized (atomic files) | High | Very High | Low |
| In-memory only | Low | Highest | Low |
| Skip hooks entirely | N/A | Zero | N/A |

### 6.2 Recommendations

1. **For maximum speed (<1ms)**: Use optimized atomic file queue
2. **For maximum reliability**: Keep current approach with optimizations
3. **For balanced approach**: Optimized queue + async fsync

---

## 7. System-Level Tuning

### 7.1 Filesystem Optimizations

```bash
# Mount tmpfs for queue directory (RAM-based)
mount -t tmpfs -o size=100M,mode=700 tmpfs /path/to/.hive-mind/queue

# Or use noatime on existing filesystem
mount -o remount,noatime /path/to/repo
```

### 7.2 SQLite Database Location

```bash
# Move WAL files to tmpfs for faster writes
# Keep main DB on disk for durability
ln -s /dev/shm/hive-mind-wal .hive-mind/hive.db-wal
```

### 7.3 Process Priority

```bash
# Run worker with elevated I/O priority
ionice -c 2 -n 0 ./queue-worker.sh

# Pin to specific CPU core
taskset -c 0 ./queue-worker.sh
```

---

## 8. Implementation Checklist

- [ ] Replace `date` with `$EPOCHSECONDS` (Bash 4.2+)
- [ ] Replace file-based locking with atomic file creation
- [ ] Remove base64 encoding (use file-per-entry)
- [ ] Cache worker PID check result
- [ ] Add SQLite PRAGMA optimizations to worker
- [ ] Implement batch processing in worker
- [ ] Add benchmarking script
- [ ] Consider tmpfs for queue directory

---

## 9. Conclusion

The current implementation prioritizes reliability over speed, resulting in 15-50ms overhead per hook. By eliminating process spawns and using atomic file operations, we can achieve <1ms queue writes while maintaining reliability through the background worker approach.

The key insight is that **file creation with unique names is inherently atomic** - no locking needed. Combined with bash builtins for timestamps and sequence numbers, we can eliminate all external process spawns from the critical path.

**Recommended approach**: Implement the "Zero-Fork Queue" design with atomic file entries, combined with an optimized batch-processing worker using SQLite PRAGMA tuning.
