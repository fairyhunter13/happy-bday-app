# Queue System Operations & Maintenance Guide

## Monitoring

### Daily Health Check

```bash
#!/bin/bash

echo "=== Queue System Health Check ==="

source ./.claude/hooks/lib/queue-lib.sh

# Check worker
if queue_worker_is_running; then
    echo "✓ Worker: Running"
    pid=$(cat .hive-mind/queue/worker.pid)
    echo "  PID: $pid"
else
    echo "✗ Worker: Not running"
    ./.claude/hooks/queue-worker-start.sh start
fi

# Check queue depth
pending=$(queue_size)
processing=$(queue_processing_count)
echo ""
echo "Queue Depth:"
echo "  Pending: $pending"
echo "  Processing: $processing"

# Check failures
failed=$(ls -1 .hive-mind/queue/failed/*.json 2>/dev/null | wc -l)
if [ "$failed" -gt 0 ]; then
    echo "  Failed: $failed (NEEDS ATTENTION)"
else
    echo "  Failed: 0"
fi

# Check stats
stats=$(queue_stats_get | jq '.failed // 0')
echo ""
echo "Stats:"
queue_stats_get | jq .

# Check disk space
disk_used=$(du -sh .hive-mind/queue | cut -f1)
echo ""
echo "Disk Usage: $disk_used"

echo ""
echo "=== Health check complete ==="
```

### Real-Time Monitoring

```bash
# Watch queue status continuously (updates every 2 seconds)
watch -n 2 "./.claude/hooks/queue-status.sh"

# Or with more detail
watch -n 2 "./.claude/hooks/queue-status.sh --stats"
```

### Automated Monitoring Script

```bash
#!/bin/bash
# Monitor with alerts

source ./.claude/hooks/lib/queue-lib.sh

while true; do
    pending=$(queue_size)
    failed=$(ls -1 .hive-mind/queue/failed/*.json 2>/dev/null | wc -l)
    
    # Alert on high backlog
    if [ "$pending" -gt 100 ]; then
        echo "[ALERT] Queue backlog: $pending entries"
        ./.claude/hooks/queue-status.sh
    fi
    
    # Alert on failures
    if [ "$failed" -gt 10 ]; then
        echo "[ALERT] $failed failed entries"
    fi
    
    # Check worker alive
    if ! queue_worker_is_running; then
        echo "[ERROR] Worker died, restarting..."
        ./.claude/hooks/queue-worker-start.sh start
    fi
    
    sleep 30  # Check every 30 seconds
done
```

## Maintenance Tasks

### Daily Cleanup (Low Priority Entries)

```bash
# Remove completed entries older than 24 hours
./.claude/hooks/queue-cleanup.sh

# Or manually:
find .hive-mind/queue/completed -mtime +1 -delete
find .hive-mind/queue/failed -mtime +1 -delete
```

### Manual Cleanup (Immediate)

```bash
# Empty old entries (retention in hours)
source ./.claude/hooks/lib/queue-lib.sh
queue_cleanup_old 24  # Keep entries from last 24 hours
```

### Log Rotation

The queue system automatically rotates logs when they exceed 1MB. Manual rotation:

```bash
# Archive current log
mv .hive-mind/queue/worker.log .hive-mind/queue/worker.log.$(date +%Y%m%d_%H%M%S)

# Compress old logs
gzip .hive-mind/queue/worker.log.*

# Keep 30 days of logs
find .hive-mind/queue -name "worker.log*.gz" -mtime +30 -delete
```

### Disk Space Management

```bash
# Check disk usage
du -sh .hive-mind/queue/
du -sh .hive-mind/queue/*/

# If running low on space:
# 1. Aggressive cleanup
find .hive-mind/queue/completed -delete
find .hive-mind/queue/failed -delete

# 2. Reduce retention
queue_cleanup_old 6  # Keep 6 hours instead of 24

# 3. Archive logs
gzip .hive-mind/queue/worker.log
```

## Worker Management

### Starting the Worker

```bash
# Start as daemon
./.claude/hooks/queue-worker-start.sh start

# Verify it started
./.claude/hooks/queue-worker-start.sh status

# Run in foreground (for debugging)
./.claude/hooks/queue-worker-start.sh start --foreground
```

### Stopping the Worker

```bash
# Graceful shutdown (processes remaining entries)
./.claude/hooks/queue-worker-start.sh stop

# Takes up to 5 seconds for graceful shutdown
# Then force kills if necessary
```

### Restarting the Worker

```bash
# Stop and restart (useful after config changes)
./.claude/hooks/queue-worker-start.sh restart
```

### Worker Logs

```bash
# View last 50 lines
./.claude/hooks/queue-worker-start.sh logs

# View last N lines
./.claude/hooks/queue-worker-start.sh logs 200

# Follow live (like tail -f)
./.claude/hooks/queue-worker-start.sh follow

# Parse logs
grep ERROR .hive-mind/queue/worker.log
grep WARN .hive-mind/queue/worker.log
```

## Troubleshooting

### Issue: Worker Not Processing Entries

**Diagnosis:**
```bash
# Check if worker is running
./.claude/hooks/queue-worker-start.sh status

# Check logs
./.claude/hooks/queue-worker-start.sh logs 100 | tail -20
```

**Solution:**
```bash
# Restart worker
./.claude/hooks/queue-worker-start.sh restart

# Or force restart
./.claude/hooks/queue-worker-start.sh stop
sleep 2
./.claude/hooks/queue-worker-start.sh start
```

### Issue: Queue Keeps Growing

**Diagnosis:**
```bash
# Check pending count
./.claude/hooks/queue-status.sh

# Verify worker is processing
./.claude/hooks/queue-worker-start.sh logs 50 | grep "Processed"
```

**Solution:**
```bash
# Check if worker is hung
ps aux | grep queue-worker.sh

# Kill stuck worker
pkill -9 -f queue-worker.sh

# Restart
./.claude/hooks/queue-worker-start.sh start
```

### Issue: Database Locked Errors

**Diagnosis:**
```bash
# Check if database is locked
lsof .hive-mind/hive.db

# Check queue logs
./.claude/hooks/queue-worker-start.sh logs | grep "locked"
```

**Solution:**
1. This is normal - queue handles retries automatically
2. Monitor and increase queue batch size if happening frequently:
```bash
export QUEUE_BATCH_SIZE="20"  # Process more at once
./.claude/hooks/queue-worker-start.sh restart
```

### Issue: High Memory Usage

**Diagnosis:**
```bash
# Check worker process
ps aux | grep queue-worker.sh

# Check pending queue
ls -1 .hive-mind/queue/pending/ | wc -l
```

**Solution:**
1. Check if entries are being processed
2. If stuck, manually move entries to process them:
```bash
# Process one batch manually
./.claude/hooks/queue-worker-start.sh once

# Or restart
./.claude/hooks/queue-worker-start.sh restart
```

### Issue: Entries Stuck in Processing

**Diagnosis:**
```bash
# Check processing directory
ls -la .hive-mind/queue/processing/

# Check timestamps
stat .hive-mind/queue/processing/*.json
```

**Solution:**
```bash
# The queue has orphan recovery (30s timeout)
# If stuck beyond that, manually recover:

source ./.claude/hooks/lib/queue-lib.sh

# Move all processing entries back to pending
for file in .hive-mind/queue/processing/*.json; do
    [ -f "$file" ] && mv "$file" .hive-mind/queue/pending/
done

# Restart worker to reprocess
./.claude/hooks/queue-worker-start.sh restart
```

## Performance Tuning

### Increase Processing Speed

```bash
# Increase batch size (more entries per batch)
export QUEUE_BATCH_SIZE="50"

# Decrease poll interval (check more often)
export QUEUE_POLL_INTERVAL="0.05"

# Restart worker
./.claude/hooks/queue-worker-start.sh restart
```

### Configuration for High Load

```bash
#!/bin/bash
# High-performance queue settings

export QUEUE_BATCH_SIZE="100"           # Process 100 entries per batch
export QUEUE_POLL_INTERVAL="0.05"       # Poll every 50ms
export QUEUE_IDLE_EXIT="600"            # Keep running longer
export SQLITE_TIMEOUT="20000"           # More timeout for busy DB

source ./.claude/hooks/lib/queue-lib.sh
./.claude/hooks/queue-worker-start.sh restart
```

### Configuration for Low Resources

```bash
#!/bin/bash
# Low-resource queue settings

export QUEUE_BATCH_SIZE="5"             # Process fewer entries
export QUEUE_POLL_INTERVAL="0.5"        # Poll less often
export QUEUE_IDLE_EXIT="60"             # Exit sooner
export SQLITE_TIMEOUT="5000"            # Less timeout

source ./.claude/hooks/lib/queue-lib.sh
./.claude/hooks/queue-worker-start.sh restart
```

## Scaling

### When Queue Grows Rapidly

```bash
# 1. Check what's being queued
ls -lt .hive-mind/queue/pending/ | head -20

# 2. Increase processing power
export QUEUE_BATCH_SIZE="200"
export QUEUE_POLL_INTERVAL="0.01"
./.claude/hooks/queue-worker-start.sh restart

# 3. Monitor progress
watch -n 1 "./.claude/hooks/queue-status.sh --json" | jq .queue

# 4. Consider spreading load (time-shift operations)
```

## Backup & Recovery

### Backing Up Queue Data

```bash
# Backup pending queue
tar czf queue_backup_$(date +%Y%m%d_%H%M%S).tar.gz .hive-mind/queue/

# Backup just critical data
cp .hive-mind/queue/.seq .hive-mind/queue/.seq.backup
cp .hive-mind/queue/stats.json .hive-mind/queue/stats.json.backup
```

### Recovering from Backup

```bash
# Stop worker
./.claude/hooks/queue-worker-start.sh stop

# Restore from backup
tar xzf queue_backup_*.tar.gz

# Restart worker
./.claude/hooks/queue-worker-start.sh start
```

## Cron Jobs

### Recommended Maintenance Schedule

```bash
# Run daily health check at 3 AM
0 3 * * * /path/to/happy-bday-app/scripts/queue_health_check.sh >> /var/log/queue_health.log 2>&1

# Run cleanup daily at 4 AM
0 4 * * * cd /path/to/happy-bday-app && ./.claude/hooks/queue-cleanup.sh

# Check health every 30 minutes
*/30 * * * * /path/to/happy-bday-app/scripts/queue_monitor.sh

# Restart worker if dead (every 15 minutes)
*/15 * * * * source ./.claude/hooks/lib/queue-lib.sh && \
    queue_worker_is_running || \
    ./.claude/hooks/queue-worker-start.sh start >> /var/log/queue_restarts.log 2>&1
```

## Metrics & Reports

### Generate Daily Report

```bash
#!/bin/bash
source ./.claude/hooks/lib/queue-lib.sh

echo "Queue Report - $(date)"
echo ""

# Statistics
echo "=== Statistics ==="
queue_stats_get | jq .

# Queue sizes
echo ""
echo "=== Queue Depths ==="
echo "Pending:    $(queue_size)"
echo "Processing: $(queue_processing_count)"
echo "Completed:  $(ls -1 .hive-mind/queue/completed/*.json 2>/dev/null | wc -l)"
echo "Failed:     $(ls -1 .hive-mind/queue/failed/*.json 2>/dev/null | wc -l)"

# Worker info
echo ""
echo "=== Worker ==="
if queue_worker_is_running; then
    echo "Status: Running"
    echo "PID: $(cat .hive-mind/queue/worker.pid)"
else
    echo "Status: Not running"
fi

# Recent errors
echo ""
echo "=== Recent Errors ==="
grep ERROR .hive-mind/queue/worker.log | tail -5 || echo "No errors"
```

---

**Last Updated**: 2024-01-01
**Difficulty**: Intermediate to Advanced
