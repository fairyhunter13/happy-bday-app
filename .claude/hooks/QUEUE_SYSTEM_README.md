# Queue System - Production Documentation

## Overview

The Queue System is a production-ready, lock-free directory-based SQLite write queue designed to solve database contention issues in the Happy Birthday App. It provides atomic, guaranteed-delivery database writes without requiring external infrastructure like Redis or RabbitMQ.

### Problem Solved

The original implementation executed SQL statements directly against SQLite, causing:
- Database lock contention under concurrent writes
- Failed transactions when database was busy
- Lost writes during peak activity (birthday notifications)
- Manual retry logic scattered throughout the codebase

The Queue System eliminates these issues by:
- Decoupling writes from database availability
- Guaranteeing eventual delivery of all writes
- Handling retries automatically with exponential backoff
- Providing crash recovery for reliability

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────┐
│  Application Code (Hooks, Scripts)                      │
│  queue_db_write("UPDATE sessions SET ...")              │
└──────────────────┬──────────────────────────────────────┘
                   │ (Atomic write to disk)
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Queue Directory Structure (.hive-mind/queue/)           │
│  ├── pending/      (Entries waiting for processing)      │
│  ├── processing/   (Currently being executed)            │
│  ├── completed/    (Successfully processed)              │
│  ├── failed/       (Failed after max retries)            │
│  └── .tmp/         (Temporary files for atomicity)       │
└──────────────────┬──────────────────────────────────────┘
                   │ (Async background processing)
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Queue Worker Daemon                                    │
│  - Monitors pending directory                            │
│  - Processes by priority and sequence                    │
│  - Handles retries with backoff                          │
│  - Recovers from crashes                                 │
└──────────────────┬──────────────────────────────────────┘
                   │ (Execute SQL)
                   ▼
┌─────────────────────────────────────────────────────────┐
│  SQLite Database (.hive-mind/hive.db)                    │
│  - Guaranteed write delivery                             │
│  - No contention bottleneck                              │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **ZERO Data Loss**: All writes are atomic (write to `.tmp/`, then `mv`)
2. **Lock-Free Enqueue**: Uses atomic file operations, no flock for writes
3. **Sequential Processing**: flock only for generating sequence numbers
4. **Fast Path**: `queue_db_write()` completes in <1ms
5. **Crash-Safe**: Orphaned entries automatically recovered

### Queue Entry Lifecycle

```
pending/ ─────┬────> processing/ ────┬────> completed/ (Success)
              │                      │
              │                      └────> failed/ (Max retries exceeded)
              │
              └────> retry (bump priority, return to pending/)
```

## Components

### Core Files

| File | Purpose |
|------|---------|
| `.claude/hooks/lib/queue-lib.sh` | Core queue API library (all functions) |
| `.claude/hooks/lib/queue-worker.sh` | Background daemon (processes entries) |
| `.claude/hooks/queue-init.sh` | Initialize queue directories |
| `.claude/hooks/queue-worker-start.sh` | Control worker lifecycle |
| `.claude/hooks/queue-status.sh` | Monitor queue status |
| `.claude/hooks/queue-cleanup.sh` | Maintenance and cleanup |

### Directory Structure

```
.hive-mind/queue/
├── pending/              # Entries waiting (named: {priority}_{seq}.json)
├── processing/           # Currently being processed
├── completed/            # Successfully processed (archived)
├── failed/               # Failed entries (for inspection)
├── .tmp/                 # Temporary files (atomic writes)
├── .seq                  # Sequence number counter (flock protected)
├── .lock                 # Worker lock file
├── worker.pid            # Worker process ID
├── worker.log            # Detailed worker logs
└── stats.json            # Queue statistics
```

### Queue Entry Format

Each entry is a JSON file in the pending directory:

```json
{
  "seq": "1704067200000000000_1",
  "priority": 5,
  "operation": "update_session",
  "sql": "UPDATE sessions SET last_activity = '2024-01-01T12:00:00Z' WHERE id = 'abc123';",
  "metadata": {
    "session_id": "abc123",
    "source": "post_greeting"
  },
  "created_at": "2024-01-01T12:00:00Z",
  "retries": 0
}
```

### Configuration

The queue system is configured via environment variables (set in `.claude/hooks/lib/queue-lib.sh`):

```bash
# Queue directories
QUEUE_BASE_DIR=".hive-mind/queue"

# Worker behavior
QUEUE_POLL_INTERVAL="0.1"           # How often to check for new entries (seconds)
QUEUE_BATCH_SIZE="10"               # Entries per processing batch
QUEUE_MAX_RETRIES="3"               # Max retry attempts before failure
QUEUE_IDLE_EXIT="300"               # Exit if idle for 5 minutes (saves resources)
QUEUE_PROCESSING_TIMEOUT="30"       # Recover orphans after 30 seconds

# SQLite timeouts
SQLITE_TIMEOUT="10000"              # Total timeout (milliseconds)
SQLITE_BUSY_TIMEOUT="5000"          # Per-query timeout (milliseconds)

# Feature flags
USE_QUEUE="true"                    # Enable queue (can disable for direct writes)
```

## Priority Levels

Queue entries are processed by priority (lower number = higher priority):

| Priority | Use Case | Timeout |
|----------|----------|---------|
| 1 | Critical updates (auth, payment) | 5s |
| 3 | Session updates (activity tracking) | 10s |
| 5 | General operations (default) | 20s |
| 7 | Logging (session_logs insert) | 30s |
| 10 | Analytics, archival | 60s |

Higher priority entries are processed first, even if lower priority entries were queued earlier.

## Performance Characteristics

### Enqueue Performance

- **Successful enqueue**: <1ms
- **Fallback (queue unavailable)**: Direct SQL execution
- **Worker startup**: <100ms (if not already running)

### Processing Performance

- **Batch processing**: 10 entries per batch (configurable)
- **Poll interval**: 100ms (configurable)
- **Per-entry overhead**: ~5ms (file I/O + JSON parsing)
- **Throughput**: ~200 entries/sec (on modern hardware)

### Memory Impact

- **Queue worker process**: ~5-10 MB
- **Per pending entry**: ~1-2 KB (filename + metadata)
- **Total overhead**: Negligible for typical workloads

## When to Use

### Use the Queue For:
- Database writes that can be delayed 1-5 seconds
- High-concurrency operations (birthday notifications)
- Updates that don't need immediate confirmation
- Audit logging, analytics, session tracking

### Use Direct SQLite For:
- Immediate reads (data fetches)
- Reads with side effects requiring response
- Administrative operations (direct schema changes)
- Testing/debugging where queue is disabled

## Next Steps

- **Installation**: See [QUEUE_INSTALLATION.md](./docs/QUEUE_INSTALLATION.md)
- **Usage Guide**: See [QUEUE_USAGE.md](./docs/QUEUE_USAGE.md)
- **Integration**: See [QUEUE_DEVELOPER.md](./docs/QUEUE_DEVELOPER.md)
- **Operations**: See [QUEUE_OPS.md](./docs/QUEUE_OPS.md)
- **Troubleshooting**: See [QUEUE_README.md](./docs/QUEUE_README.md)

## API Quick Reference

### Main Entry Point
```bash
queue_db_write "UPDATE sessions SET ..." "update_session" 3 '{}'
```

### Other Common Operations
```bash
queue_size                              # Count pending entries
queue_processing_count                  # Count entries being processed
queue_worker_is_running                 # Check if worker is alive
queue_stats_get                         # Get statistics JSON
queue_cleanup_old 24                    # Clean entries older than 24 hours
```

## Support

For detailed information, see:
- **Installation Guide**: `.claude/hooks/docs/QUEUE_INSTALLATION.md`
- **Usage Guide**: `.claude/hooks/docs/QUEUE_USAGE.md`
- **Developer Guide**: `.claude/hooks/docs/QUEUE_DEVELOPER.md`
- **Operations Manual**: `.claude/hooks/docs/QUEUE_OPS.md`
- **API Reference**: `.claude/hooks/docs/QUEUE_README.md`

---

**Version**: 1.0.0
**Status**: Production-Ready
**Last Updated**: 2024-01-01
