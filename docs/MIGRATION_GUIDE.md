# Queue System Migration Guide

## Overview

This guide explains how to integrate the queue system with existing hooks and schedulers. The queue system enables asynchronous, reliable message delivery with automatic retry logic and monitoring.

## Architecture Summary

Before migration:
```
Scheduler → Database Update → External API Call
```

After migration:
```
Scheduler → Database Update → Queue → Worker → External API Call
```

Benefits:
- Decoupled publishing and processing
- Automatic retry with exponential backoff
- Resilience to temporary failures
- Better observability and monitoring
- Horizontal scaling capability

## Step 1: Environment Setup

### 1.1 Install Dependencies

```bash
# Already included in package.json
npm install amqp-connection-manager amqplib
```

### 1.2 Configure Environment

```bash
# .env.local or .env.production
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Optional tuning
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=5
QUEUE_RETRY_DELAY=2000
QUEUE_RETRY_BACKOFF=exponential

# Cron schedule for enqueueing (every minute)
CRON_MINUTE_SCHEDULE="* * * * *"
```

### 1.3 Set up RabbitMQ

#### Local Development

```bash
# Using Docker
docker run -d \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  rabbitmq:3-management

# Access management UI
# http://localhost:15672 (guest/guest)
```

#### Production

```bash
# Using Kubernetes
kubectl apply -f k8s/rabbitmq-statefulset.yaml

# Or managed service
# AWS SQS, Google Cloud Pub/Sub, Azure Service Bus
# (Requires adapter layer)
```

## Step 2: Identify Integration Points

Locate where messages are currently being sent:

```typescript
// BEFORE: Direct API call in hook/scheduler
async function sendBirthdayNotification(userId: string) {
  const user = await userRepository.findById(userId);
  const result = await messageSenderService.sendBirthdayMessage(user);

  if (result.success) {
    await messageLogRepository.updateStatus(messageId, MessageStatus.SENT);
  }
}
```

Integration points to migrate:
1. **Schedulers**: MinuteEnqueueScheduler (already using queue)
2. **Hooks**: Pre/post-operation hooks that trigger messages
3. **Event Listeners**: Event-driven message publishing
4. **Direct API Calls**: Replace with queue publishing

## Step 3: Data Model Changes

### 3.1 Add QUEUED Status

The message status already supports `QUEUED`:

```typescript
// In MessageStatus enum
export enum MessageStatus {
  PENDING = 'PENDING',      // Created, not yet queued
  QUEUED = 'QUEUED',        // In RabbitMQ queue
  SENDING = 'SENDING',      // Worker processing
  SENT = 'SENT',            // Successfully sent
  FAILED = 'FAILED',        // Permanent failure
}
```

### 3.2 Database Schema

The message schema already supports queue metadata:

```typescript
interface Message {
  id: string;
  userId: string;
  messageType: 'BIRTHDAY' | 'ANNIVERSARY';
  status: MessageStatus;
  scheduledSendTime: Date;
  retryCount: number;
  // Additional fields for tracking:
  queuedAt?: Date;
  sentAt?: Date;
  failedAt?: Date;
  lastError?: string;
}
```

No schema changes required - the existing schema is sufficient.

## Step 4: Scheduler Integration

### Current State

The `MinuteEnqueueScheduler` already:
1. Finds messages scheduled in the next hour
2. Updates status to QUEUED
3. Publishes to RabbitMQ
4. Tracks publishing results

```typescript
// src/schedulers/minute-enqueue.scheduler.ts
private async executeJob(): Promise<void> {
  // 1. Enqueue messages (update status to QUEUED)
  const count = await schedulerService.enqueueUpcomingMessages();

  // 2. Fetch enqueued messages
  const messages = await messageLogRepository.findAll({
    status: MessageStatus.QUEUED,
    scheduledAfter: now,
    scheduledBefore: oneHourFromNow,
  });

  // 3. Publish to RabbitMQ
  for (const message of messages) {
    await publisher.publishMessage({
      messageId: message.id,
      userId: message.userId,
      messageType: message.messageType as 'BIRTHDAY' | 'ANNIVERSARY',
      scheduledSendTime: message.scheduledSendTime.toISOString(),
      timestamp: Date.now(),
      retryCount: message.retryCount,
    });
  }
}
```

**No changes needed** - already integrated!

## Step 5: Migrate Existing Hooks

If you have pre/post hooks that send messages, migrate them:

### Before: Direct API Call

```typescript
// src/hooks/on-birthday.hook.ts (BEFORE)
export async function onBirthdayHook(userId: string) {
  const user = await userRepository.findById(userId);

  // Direct API call - blocks the request
  const result = await messageSenderService.sendBirthdayMessage(user);

  if (!result.success) {
    throw new Error('Failed to send birthday message');
  }
}
```

### After: Queue Publishing

```typescript
// src/hooks/on-birthday.hook.ts (AFTER)
import { MessagePublisher, type MessageJob, QUEUES } from '../queue/index.js';

let publisher: MessagePublisher | null = null;

// Initialize publisher once
async function getPublisher(): Promise<MessagePublisher> {
  if (!publisher) {
    publisher = new MessagePublisher();
    await publisher.initialize();
  }
  return publisher;
}

export async function onBirthdayHook(userId: string): Promise<void> {
  // 1. Check if user exists
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  // 2. Create message record in database
  const message = await messageLogRepository.create({
    userId,
    messageType: 'BIRTHDAY',
    status: MessageStatus.PENDING,
    scheduledSendTime: new Date(),  // Or calculate based on user timezone
    retryCount: 0,
  });

  // 3. Publish to queue (non-blocking)
  const publisher = await getPublisher();
  await publisher.publishMessage({
    messageId: message.id,
    userId: message.userId,
    messageType: 'BIRTHDAY',
    scheduledSendTime: message.scheduledSendTime.toISOString(),
    timestamp: Date.now(),
    retryCount: 0,
  });

  // 4. Update status to QUEUED
  await messageLogRepository.updateStatus(message.id, MessageStatus.QUEUED);

  // Note: Message will be processed asynchronously by worker
  // No need to handle success/failure in the hook
}
```

### Migration Checklist

- [ ] Create message record in database
- [ ] Publish to queue with MessageJob
- [ ] Update message status to QUEUED
- [ ] Remove direct API calls from hook
- [ ] Handle errors gracefully (don't block request)
- [ ] Update tests

## Step 6: Event-Driven Publishing

If you have event listeners, integrate with queue:

### Before: Event Handler

```typescript
// BEFORE: Send message directly from event
eventEmitter.on('user:birthday', async (userId: string) => {
  await messageSenderService.sendBirthdayMessage(user);
});
```

### After: Queue Publishing

```typescript
// AFTER: Queue message from event
import { MessagePublisher, type MessageJob } from '../queue/index.js';

const messagePublisher = new MessagePublisher();
await messagePublisher.initialize();

eventEmitter.on('user:birthday', async (userId: string) => {
  // Create message record
  const message = await messageLogRepository.create({
    userId,
    messageType: 'BIRTHDAY',
    status: MessageStatus.PENDING,
    scheduledSendTime: new Date(),
    retryCount: 0,
  });

  // Publish to queue
  await messagePublisher.publishMessage({
    messageId: message.id,
    userId: message.userId,
    messageType: 'BIRTHDAY',
    scheduledSendTime: message.scheduledSendTime.toISOString(),
    timestamp: Date.now(),
    retryCount: 0,
  });

  // Update status
  await messageLogRepository.updateStatus(message.id, MessageStatus.QUEUED);
});
```

## Step 7: Start the Worker

### Development

```bash
# Terminal 1: Start main application
npm run dev

# Terminal 2: Start worker
npm run worker
```

### Production

```bash
# Using PM2
pm2 start src/worker.ts --name "message-worker"

# Using Docker
docker run -e RABBITMQ_URL=... my-app npm run worker

# Using Kubernetes
kubectl apply -f k8s/message-worker-deployment.yaml
```

## Step 8: Verification

### 8.1 Check Worker is Running

```bash
# Verify worker process
ps aux | grep worker

# Or with PM2
pm2 list
```

### 8.2 Check Queue Connectivity

```typescript
// Run health check
import { initializeRabbitMQ, getRabbitMQ } from './queue';

await initializeRabbitMQ();
const rabbitmq = getRabbitMQ();
const health = await rabbitmq.healthCheck();
console.log('RabbitMQ health:', health);
```

### 8.3 Test Message Flow

```typescript
// Publish a test message
const publisher = new MessagePublisher();
await publisher.initialize();

const job: MessageJob = {
  messageId: crypto.randomUUID(),
  userId: 'test-user-id',
  messageType: 'BIRTHDAY',
  scheduledSendTime: new Date().toISOString(),
  timestamp: Date.now(),
  retryCount: 0,
};

await publisher.publishMessage(job);
console.log('Published test message:', job.messageId);

// Check RabbitMQ UI
// http://localhost:15672 → Queues tab
// Look for birthday.messages.queue with 1 message
```

### 8.4 Monitor Processing

```bash
# Watch logs
pm2 logs message-worker

# Or directly
tail -f logs/application.log | grep -E "Processing message|published|error"
```

## Step 9: Database Migration

### Update Message Records

For existing pending messages, update status:

```sql
-- Enqueue any pending messages scheduled in the past
UPDATE messages
SET status = 'QUEUED'
WHERE status = 'PENDING'
  AND scheduled_send_time <= NOW()
  AND message_type IN ('BIRTHDAY', 'ANNIVERSARY');

-- Verify update
SELECT status, COUNT(*) as count
FROM messages
GROUP BY status;
```

### Optional: Backfill

For historical messages, you might want to replay:

```typescript
// Script to replay failed messages
import { messageLogRepository } from './repositories/message-log.repository';
import { MessagePublisher, type MessageJob } from './queue';

const publisher = new MessagePublisher();
await publisher.initialize();

// Find recently failed messages
const failedMessages = await messageLogRepository.findAll({
  status: MessageStatus.FAILED,
  failedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000),  // Last 24 hours
  limit: 100,
});

// Re-queue them
for (const message of failedMessages) {
  await publisher.publishMessage({
    messageId: message.id,
    userId: message.userId,
    messageType: message.messageType as 'BIRTHDAY' | 'ANNIVERSARY',
    scheduledSendTime: message.scheduledSendTime.toISOString(),
    timestamp: Date.now(),
    retryCount: 0,  // Reset retry count
  });

  // Update status
  await messageLogRepository.updateStatus(message.id, MessageStatus.QUEUED);
}

console.log(`Re-queued ${failedMessages.length} messages`);
```

## Step 10: Monitoring & Alerts

### 1. Set up Prometheus Metrics

Add these to your Prometheus config:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'happy-bday-app'
    static_configs:
      - targets: ['localhost:3000']
```

### 2. Create Grafana Dashboard

Key panels:
- Queue depth (messages waiting)
- Processing latency (p95, p99)
- Error rate (% of failed messages)
- DLQ growth (messages in dead letter queue)
- Consumer count (active workers)

### 3. Configure Alerts

```yaml
# alert-rules.yml
groups:
  - name: queue
    rules:
      - alert: QueueDepthHigh
        expr: queue_depth > 1000
        for: 5m
        annotations:
          summary: "Queue depth is high: {{ $value }}"

      - alert: DLQGrowing
        expr: rate(dlq_messages_total[1m]) > 0.1
        for: 1m
        annotations:
          summary: "DLQ growing: {{ $value }} messages/min"

      - alert: ConsumerDown
        expr: consumer_count == 0
        for: 1m
        annotations:
          summary: "Message consumer is down"
```

## Step 11: Rollback Plan

If you need to rollback to direct API calls:

```typescript
// Graceful fallback
async function sendMessage(job: MessageJob, fallbackDirect = false) {
  try {
    // Try to queue first
    const publisher = await getPublisher();
    await publisher.publishMessage(job);
  } catch (error) {
    if (fallbackDirect) {
      // Fallback to direct API call
      const user = await userRepository.findById(job.userId);
      return await messageSenderService.sendBirthdayMessage(user);
    }
    throw error;
  }
}
```

Rollback procedure:
1. Stop the worker: `pm2 stop message-worker`
2. Update code to use fallback
3. Redeploy application
4. Monitor for failures
5. Replay any unprocessed messages if needed

## Common Migration Issues

### Issue 1: Publisher Not Initialized

**Error**: "MessagePublisher not initialized"

**Solution**:
```typescript
// Ensure publisher is initialized before use
const publisher = new MessagePublisher();
await publisher.initialize();  // Must await this
```

### Issue 2: RabbitMQ Connection Timeout

**Error**: "Failed to connect to RabbitMQ within Xs timeout"

**Solution**:
```bash
# Check RabbitMQ is running
docker ps | grep rabbitmq

# Check connection string
echo $RABBITMQ_URL

# Test connectivity
nc -zv localhost 5672
```

### Issue 3: Messages Not Processing

**Error**: Messages in queue but not being consumed

**Solution**:
1. Verify worker is running: `ps aux | grep worker`
2. Check worker logs: `pm2 logs message-worker`
3. Verify RabbitMQ connection: `rabbitmqctl status`
4. Check consumer count: `rabbitmqctl list_consumers`

### Issue 4: High Memory Usage

**Error**: Worker memory growing

**Solution**:
1. Check for message metadata cleanup in logs
2. Look for unbounded collections
3. Restart worker periodically
4. Enable memory monitoring: `pm2 monit message-worker`

## Testing Migration

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { onBirthdayHook } from './hooks/on-birthday.hook';

describe('Migrated Birthday Hook', () => {
  it('should publish message to queue', async () => {
    // Mock publisher
    const publishedJobs: MessageJob[] = [];
    const mockPublisher = {
      publishMessage: vi.fn((job) => {
        publishedJobs.push(job);
        return Promise.resolve();
      }),
    };

    // Run hook
    await onBirthdayHook('test-user-id');

    // Verify message was published
    expect(publishedJobs).toHaveLength(1);
    expect(publishedJobs[0].messageType).toBe('BIRTHDAY');
  });
});
```

### Integration Tests

```typescript
// Full flow test with real RabbitMQ
describe('Birthday Message Flow', () => {
  it('should send message end-to-end', async () => {
    // 1. Call hook (publishes to queue)
    await onBirthdayHook('test-user-id');

    // 2. Consumer processes message
    const receivedMessages: MessageJob[] = [];
    const consumer = new MessageConsumer({
      onMessage: async (job) => {
        receivedMessages.push(job);
      },
    });
    await consumer.startConsuming();

    // 3. Wait for processing
    await new Promise(r => setTimeout(r, 2000));

    // 4. Verify message was processed
    expect(receivedMessages).toHaveLength(1);

    await consumer.stopConsuming();
  });
});
```

## Success Criteria

Migration is complete when:

- [ ] All hooks publish to queue instead of calling API directly
- [ ] Worker successfully processes messages from queue
- [ ] Queue depth stays low (< 100 messages)
- [ ] Processing latency is acceptable (< 5s typical)
- [ ] No messages lost (check DLQ is empty)
- [ ] All tests pass
- [ ] Monitoring dashboard shows healthy metrics
- [ ] Team is trained on operations

## Next Steps

- Read [QUEUE_USAGE.md](./QUEUE_USAGE.md) for advanced patterns
- Read [QUEUE_OPS.md](./QUEUE_OPS.md) for operational procedures
- Read [QUEUE_ARCHITECTURE.md](./QUEUE_ARCHITECTURE.md) for system design
