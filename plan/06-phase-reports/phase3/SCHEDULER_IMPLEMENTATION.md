# CRON Scheduler Implementation - Phase 3 Complete

## Overview

This document describes the complete implementation of Phase 3: CRON Schedulers for the Birthday Message Scheduler system.

## Architecture

The scheduler system consists of three main CRON jobs orchestrated by a central SchedulerManager:

```
┌─────────────────────────────────────────────────────────────┐
│                   Scheduler Manager                          │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │ Daily Birthday   │  │ Minute Enqueue   │  │ Recovery  │ │
│  │ 00:00 UTC        │  │ Every minute     │  │ Every 10m │ │
│  └──────────────────┘  └──────────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Daily Birthday Scheduler
**File:** `src/schedulers/daily-birthday.scheduler.ts`

**Schedule:** `0 0 * * *` (Midnight UTC daily)

**Responsibilities:**
- Pre-calculate all birthdays and anniversaries for the current day
- Convert local 9am times to UTC
- Create message log entries with SCHEDULED status
- Prevent duplicates using idempotency keys

**Key Features:**
- Comprehensive statistics logging
- Error handling and recovery
- Health monitoring (25-hour window)
- Concurrent execution prevention

**Usage:**
```typescript
import { dailyBirthdayScheduler } from './schedulers/daily-birthday.scheduler.js';

// Start the scheduler
dailyBirthdayScheduler.start();

// Manually trigger (for testing)
await dailyBirthdayScheduler.triggerManually();

// Get status
const status = dailyBirthdayScheduler.getStatus();
console.log(status.lastRunStats);

// Health check
const isHealthy = dailyBirthdayScheduler.isHealthy();
```

### 2. Minute Enqueue Scheduler
**File:** `src/schedulers/minute-enqueue.scheduler.ts`

**Schedule:** `* * * * *` (Every minute)

**Responsibilities:**
- Find messages scheduled in the next hour
- Update status from SCHEDULED to QUEUED
- Publish messages to RabbitMQ queue
- Track consecutive failures

**Key Features:**
- High-frequency execution optimized for performance
- Minimal logging to reduce noise
- RabbitMQ integration with error handling
- Statistics tracking (total enqueued, average per run)

**Usage:**
```typescript
import { minuteEnqueueScheduler } from './schedulers/minute-enqueue.scheduler.js';

// Start the scheduler (async - initializes RabbitMQ)
await minuteEnqueueScheduler.start();

// Get statistics
const status = minuteEnqueueScheduler.getStatus();
console.log(`Total enqueued: ${status.totalEnqueued}`);
console.log(`Average per run: ${status.averageEnqueuedPerRun}`);

// Reset statistics
minuteEnqueueScheduler.resetStats();
```

### 3. Recovery Scheduler
**File:** `src/schedulers/recovery.scheduler.ts`

**Schedule:** `*/10 * * * *` (Every 10 minutes)

**Responsibilities:**
- Find messages that should have been sent but weren't
- Retry failed messages (up to max retries)
- Mark permanently failed messages as FAILED
- Provide recovery metrics

**Key Features:**
- Automatic recovery from system downtime
- Retry count tracking
- Success rate calculations
- Detailed recovery metrics

**Usage:**
```typescript
import { recoveryScheduler } from './schedulers/recovery.scheduler.js';

// Start the scheduler
recoveryScheduler.start();

// Get metrics
const metrics = recoveryScheduler.getMetrics();
console.log(`Success rate: ${metrics.successRate}%`);
console.log(`Last run recovery rate: ${metrics.lastRunRecoveryRate}%`);

// Reset statistics
recoveryScheduler.resetStats();
```

### 4. Scheduler Manager
**File:** `src/schedulers/index.ts`

**Responsibilities:**
- Initialize and start all schedulers
- Graceful shutdown with job completion wait
- Health check aggregation
- Manual trigger capabilities

**Key Features:**
- Production-ready lifecycle management
- Health monitoring for all schedulers
- Detailed statistics aggregation
- Graceful shutdown with timeout

**Usage:**
```typescript
import { schedulerManager } from './schedulers/index.js';

// Start all schedulers
await schedulerManager.start();

// Get health status
const health = schedulerManager.getHealthStatus();
console.log(`All healthy: ${health.allHealthy}`);
console.log(`Uptime: ${health.uptime}ms`);

// Get detailed statistics
const stats = schedulerManager.getDetailedStats();

// Trigger specific scheduler
await schedulerManager.triggerScheduler('daily');

// Graceful shutdown (30 second timeout)
await schedulerManager.gracefulShutdown(30000);
```

## Integration

### Main Application Integration
**File:** `src/index.ts`

The schedulers are integrated into the main application startup:

```typescript
// Start schedulers
logger.info('Initializing CRON schedulers...');
await schedulerManager.start();

// Graceful shutdown
signals.forEach((signal) => {
  process.on(signal, async () => {
    await schedulerManager.gracefulShutdown(30000);
    await shutdownServer(app);
    process.exit(0);
  });
});
```

### Health Check Integration
**File:** `src/controllers/health.controller.ts`

New endpoints added:
- `GET /health` - Includes scheduler health status
- `GET /health/schedulers` - Detailed scheduler health and statistics

```bash
# Check basic health
curl http://localhost:3000/health

# Check scheduler health
curl http://localhost:3000/health/schedulers
```

## Configuration

All CRON schedules are configurable via environment variables:

```env
# CRON Schedules (cron format)
CRON_DAILY_SCHEDULE=0 0 * * *          # Daily at midnight UTC
CRON_MINUTE_SCHEDULE=* * * * *         # Every minute
CRON_RECOVERY_SCHEDULE=*/10 * * * *    # Every 10 minutes
```

## Testing

### Unit Tests
**Location:** `tests/unit/schedulers/`

Coverage includes:
- Start/stop lifecycle
- Job execution
- Error handling
- Concurrent execution prevention
- Health checks
- Statistics tracking

Run unit tests:
```bash
npm run test:unit -- schedulers
```

### Integration Tests
**Location:** `tests/integration/schedulers/`

Coverage includes:
- Complete scheduler flow
- Database integration
- RabbitMQ integration
- Graceful shutdown
- Statistics and monitoring

Run integration tests:
```bash
npm run test:integration -- schedulers
```

## Production Features

### 1. Error Handling
- All schedulers have comprehensive error handling
- Errors are logged with structured data
- Failed jobs don't crash the scheduler
- Recovery mechanisms for transient failures

### 2. Logging
- Structured logging with Pino
- Different log levels for different scenarios
- Performance metrics logged
- Error details with stack traces

### 3. Health Monitoring
- Each scheduler provides health status
- Aggregated health check via SchedulerManager
- Health endpoints for Kubernetes probes
- Automatic unhealthy detection

### 4. Graceful Shutdown
- Waits for running jobs to complete
- Configurable timeout
- Force shutdown after timeout
- Clean resource cleanup

### 5. Concurrency Control
- Prevents concurrent job execution
- Job execution flags
- Race condition prevention

### 6. Statistics and Metrics
- Total runs tracked
- Success/failure rates
- Execution time tracking
- Average calculations

## Monitoring

### Metrics Exposed

**Daily Birthday Scheduler:**
- `totalBirthdays` - Birthdays found today
- `totalAnniversaries` - Anniversaries found today
- `messagesScheduled` - Messages created
- `duplicatesSkipped` - Duplicates prevented
- `errorCount` - Errors encountered

**Minute Enqueue Scheduler:**
- `totalEnqueued` - Total messages enqueued
- `totalRuns` - Total executions
- `consecutiveFailures` - Consecutive failures
- `averageEnqueuedPerRun` - Average per execution

**Recovery Scheduler:**
- `totalRecovered` - Total messages recovered
- `totalFailed` - Total failures
- `successRate` - Recovery success rate
- `lastRunMissedCount` - Messages found in last run
- `lastRunRecoveryRate` - Last run success rate

### Health Check Response

```json
{
  "status": "ok",
  "timestamp": "2025-12-30T12:00:00.000Z",
  "uptime": 3600000,
  "startTime": "2025-12-30T11:00:00.000Z",
  "schedulers": [
    {
      "name": "DailyBirthdayScheduler",
      "healthy": true,
      "status": {
        "isRunning": false,
        "isScheduled": true,
        "schedule": "0 0 * * *",
        "lastRunTime": "2025-12-30T00:00:00.000Z"
      }
    },
    {
      "name": "MinuteEnqueueScheduler",
      "healthy": true,
      "status": {
        "isRunning": false,
        "isScheduled": true,
        "schedule": "* * * * *",
        "lastRunTime": "2025-12-30T11:59:00.000Z"
      }
    },
    {
      "name": "RecoveryScheduler",
      "healthy": true,
      "status": {
        "isRunning": false,
        "isScheduled": true,
        "schedule": "*/10 * * * *",
        "lastRunTime": "2025-12-30T11:50:00.000Z"
      }
    }
  ],
  "statistics": { ... }
}
```

## Troubleshooting

### Scheduler Not Running
```bash
# Check scheduler status
curl http://localhost:3000/health/schedulers

# Check logs
tail -f logs/app.log | grep -i scheduler
```

### Jobs Not Executing
1. Verify CRON schedule format
2. Check timezone configuration (UTC)
3. Review logs for errors
4. Check database connectivity

### High Consecutive Failures
1. Check RabbitMQ connectivity
2. Verify database performance
3. Review error logs
4. Check resource limits

### Recovery Not Working
1. Verify messages are in SCHEDULED status
2. Check scheduled time is in the past
3. Review retry count limits
4. Check database queries

## Best Practices

1. **Monitor Health Endpoints**
   - Set up alerts for unhealthy schedulers
   - Monitor consecutive failures
   - Track success rates

2. **Resource Management**
   - Use graceful shutdown in production
   - Monitor memory usage
   - Track job execution times

3. **Error Handling**
   - Review error logs regularly
   - Set up alerting for critical errors
   - Monitor recovery statistics

4. **Performance**
   - Keep minute scheduler fast (<1 second)
   - Optimize database queries
   - Use connection pooling

5. **Testing**
   - Test graceful shutdown
   - Test recovery scenarios
   - Test concurrent execution prevention

## Future Enhancements

1. **Dynamic Scheduling**
   - Adjust frequency based on load
   - Peak/off-peak schedules

2. **Advanced Metrics**
   - Prometheus integration
   - Grafana dashboards
   - Custom metrics

3. **Distributed Locking**
   - Redis-based distributed locks
   - Multi-instance coordination

4. **Enhanced Recovery**
   - Priority-based recovery
   - Smart retry strategies
   - Dead letter analysis

## Dependencies

- `node-cron` (^3.0.3) - CRON job scheduling
- `@types/node-cron` (^3.0.11) - TypeScript types

## Summary

Phase 3: CRON Schedulers implementation is complete with:

✅ Daily Birthday Scheduler (midnight UTC)
✅ Minute Enqueue Scheduler (every minute)
✅ Recovery Scheduler (every 10 minutes)
✅ Scheduler Manager with lifecycle management
✅ Integration with main application
✅ Health check endpoints
✅ Comprehensive unit tests
✅ Integration tests
✅ Production-ready error handling
✅ Graceful shutdown support
✅ Statistics and monitoring
✅ Complete documentation

The system is production-ready with robust error handling, monitoring, and recovery capabilities.
