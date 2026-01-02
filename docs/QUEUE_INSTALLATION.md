# Queue System Installation Guide

## Prerequisites

### System Requirements
- Bash 4.0+ (most Linux/macOS systems)
- Standard Unix utilities: `mkdir`, `mv`, `cat`, `date`, `flock`
- SQLite3 (command-line tool)
- For monitoring: `jq` (optional, but recommended)

### Check Prerequisites
```bash
# Verify Bash version
bash --version  # Should be 4.0 or higher

# Verify SQLite is installed
sqlite3 --version

# Optional: Verify jq
jq --version  # Not required, but improves output formatting
```

## Installation Steps

### 1. Verify File Structure

First, ensure you have the queue files in place:

```bash
ls -la .claude/hooks/lib/queue-*.sh
```

You should see:
- `queue-lib.sh` (core library)
- `queue-worker.sh` (background daemon)

### 2. Make Scripts Executable

```bash
chmod +x .claude/hooks/queue-init.sh
chmod +x .claude/hooks/queue-worker-start.sh
chmod +x .claude/hooks/queue-status.sh
chmod +x .claude/hooks/lib/queue-lib.sh
chmod +x .claude/hooks/lib/queue-worker.sh
```

### 3. Initialize Queue System

Run the initialization script:

```bash
./.claude/hooks/queue-init.sh
```

### 4. Verify Installation

```bash
./.claude/hooks/queue-init.sh --verify
```

### 5. Check Queue Status

```bash
./.claude/hooks/queue-status.sh
```

## Configuration

Environment variables to customize queue behavior:

```bash
export QUEUE_POLL_INTERVAL="0.1"        # How often worker checks
export QUEUE_BATCH_SIZE="10"            # Entries per batch
export QUEUE_MAX_RETRIES="3"            # Retry attempts
export QUEUE_IDLE_EXIT="300"            # Auto-exit after idle
export SQLITE_TIMEOUT="10000"           # SQLite timeout (ms)
```

## Troubleshooting

### "queue-lib.sh not found"
```bash
test -f ./.claude/hooks/lib/queue-lib.sh && echo "Found" || echo "Not found"
```

### "Permission denied"
```bash
chmod +x .claude/hooks/queue-*.sh
chmod +x .claude/hooks/lib/queue-*.sh
```

### Cannot create directories
```bash
mkdir -p -m 755 .hive-mind/queue/{pending,processing,completed,failed,.tmp}
```

## Testing Installation

```bash
# Source the queue library
source ./.claude/hooks/lib/queue-lib.sh

# Queue a test write
queue_db_write "SELECT 1;" "test_operation" 5 '{"test": true}'

# Check status
./.claude/hooks/queue-status.sh
```

## Next Steps

1. **Usage Guide**: See [QUEUE_USAGE.md](./QUEUE_USAGE.md)
2. **Developer Guide**: See [QUEUE_DEVELOPER.md](./QUEUE_DEVELOPER.md)
3. **Operations Manual**: See [QUEUE_OPS.md](./QUEUE_OPS.md)
4. **API Reference**: See [QUEUE_README.md](./QUEUE_README.md)

---

**Installation Time**: ~2 minutes
**Last Updated**: 2024-01-01
