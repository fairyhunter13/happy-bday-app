# Queue Metrics Instrumentation - Quick Start Guide

Get up and running with RabbitMQ queue metrics in 5 minutes.

## TL;DR

```typescript
// 1. Initialize (once at startup)
import { queueMetricsInstrumentation } from './services/queue/queue-metrics.js';
await queueMetricsInstrumentation.initialize();

// 2. Wrap publish
await queueMetricsInstrumentation.instrumentPublish(
  () => channel.publish(exchange, key, buffer, opts),
  exchange,
  routingKey,
  messageId
);

// 3. Wrap consume
await queueMetricsInstrumentation.instrumentConsume(
  () => handler(job),
  msg,
  queueName
);

// 4. Ack/Nack with metrics
queueMetricsInstrumentation.instrumentAck(channel, msg, queueName, consumerTag);
// or
queueMetricsInstrumentation.instrumentNack(channel, msg, queueName, requeue, reason);
```

## Step-by-Step Integration

### Step 1: Initialize at Startup

In `src/worker.ts` or wherever you initialize RabbitMQ:

```typescript
import { queueMetricsInstrumentation } from './services/queue/queue-metrics.js';

async function main() {
  // Initialize metrics instrumentation
  await queueMetricsInstrumentation.initialize();

  // ... rest of your initialization
}
```

### Step 2: Instrument Connection Events

In `src/queue/connection.ts`, add to the `connect()` method:

```typescript
import { queueMetricsInstrumentation } from '../services/queue/queue-metrics.js';

public async connect(): Promise<void> {
  // ... existing connection setup ...

  // Get instrumentation handlers
  const handlers = queueMetricsInstrumentation.instrumentConnection('rabbitmq');

  // Add to existing event listeners
  this.connection.on('connect', ({ url }) => {
    logger.info({ msg: 'Connected to RabbitMQ', url });
    this.isConnected = true;
    handlers.onConnect(); // ADD THIS
  });

  this.connection.on('disconnect', ({ err }) => {
    logger.warn({ msg: 'Disconnected from RabbitMQ', error: err?.message });
    this.isConnected = false;
    handlers.onDisconnect(); // ADD THIS
  });

  this.connection.on('connectFailed', ({ err }) => {
    logger.error({ msg: 'Failed to connect to RabbitMQ', error: err?.message });
    this.isConnected = false;
    handlers.onConnectFailed(); // ADD THIS
  });

  // Instrument channels
  queueMetricsInstrumentation.instrumentChannel(this.publisherChannel, 'publisher');
  queueMetricsInstrumentation.instrumentChannel(this.consumerChannel, 'consumer');
}
```

### Step 3: Instrument Message Publishing

In `src/queue/publisher.ts`, modify the `publishMessage` method:

```typescript
import { queueMetricsInstrumentation } from '../services/queue/queue-metrics.js';

public async publishMessage(job: MessageJob, routingKey?: string): Promise<void> {
  // ... validation code ...

  // WRAP the publish operation
  await queueMetricsInstrumentation.instrumentPublish(
    async () => {
      const messageBuffer = Buffer.from(JSON.stringify(validatedJob));
      await channel.publish(
        EXCHANGES.BIRTHDAY_MESSAGES,
        actualRoutingKey,
        messageBuffer,
        {
          ...PUBLISHER_OPTIONS,
          timestamp: validatedJob.timestamp,
          messageId: validatedJob.messageId,
          headers: {
            'x-retry-count': validatedJob.retryCount || 0,
            'x-message-type': validatedJob.messageType,
            'x-user-id': validatedJob.userId,
          },
        }
      );
    },
    EXCHANGES.BIRTHDAY_MESSAGES,
    actualRoutingKey,
    validatedJob.messageId
  );

  logger.info({ msg: 'Message published successfully', messageId: validatedJob.messageId });
}
```

Also update `getQueueStats`:

```typescript
public async getQueueStats(queueName: string): Promise<QueueStats> {
  const result = await channel.checkQueue(queueName);

  // Update metrics
  queueMetricsInstrumentation.updateQueueDepth(queueName, result.messageCount);
  queueMetricsInstrumentation.updateConsumerCount(queueName, result.consumerCount);

  return {
    messages: result.messageCount,
    messagesReady: result.messageCount,
    messagesUnacknowledged: 0,
    consumers: result.consumerCount,
  };
}
```

### Step 4: Instrument Message Consumption

In `src/queue/consumer.ts`, modify the `handleMessage` method:

```typescript
import { queueMetricsInstrumentation } from '../services/queue/queue-metrics.js';

private async handleMessage(msg: ConsumeMessage | null, channel: Channel): Promise<void> {
  if (!msg) {
    logger.warn('Consumer cancelled by server');
    this.isConsuming = false;
    return;
  }

  let job: MessageJob | undefined;

  try {
    // Parse message
    const messageContent = msg.content.toString();
    const parsedContent = JSON.parse(messageContent);
    job = messageJobSchema.parse(parsedContent);

    const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;
    job.retryCount = retryCount;

    // WRAP the handler call
    await queueMetricsInstrumentation.instrumentConsume(
      async () => {
        await this.onMessage(job!);
      },
      msg,
      QUEUES.BIRTHDAY_MESSAGES
    );

    // INSTRUMENTED ACK
    queueMetricsInstrumentation.instrumentAck(
      channel,
      msg,
      QUEUES.BIRTHDAY_MESSAGES,
      this.consumerTag || 'default'
    );

    logger.info({ msg: 'Message processed successfully', messageId: job.messageId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ msg: 'Failed to process message', messageId: job?.messageId, error: errorMessage });

    // Call existing error handler
    if (this.onError) {
      await this.onError(error instanceof Error ? error : new Error('Unknown error'), job);
    }

    // INSTRUMENTED NACK/REJECT
    await this.handleMessageErrorWithMetrics(msg, channel, error);
  }
}

private async handleMessageErrorWithMetrics(
  msg: ConsumeMessage,
  channel: Channel,
  error: unknown
): Promise<void> {
  const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;
  const isTransientError = this.isTransientError(error);

  if (retryCount >= RETRY_CONFIG.MAX_RETRIES) {
    // Max retries - reject to DLQ
    queueMetricsInstrumentation.instrumentReject(
      channel,
      msg,
      QUEUES.BIRTHDAY_MESSAGES,
      'max_retries_exceeded'
    );
    logger.error({ retryCount, maxRetries: RETRY_CONFIG.MAX_RETRIES }, 'Max retries reached, sending to DLQ');
  } else if (isTransientError) {
    // Transient error - requeue
    queueMetricsInstrumentation.instrumentNack(
      channel,
      msg,
      QUEUES.BIRTHDAY_MESSAGES,
      true, // requeue
      'transient_error'
    );
    logger.warn({ retryCount, error: error instanceof Error ? error.message : 'Unknown error' }, 'Transient error, will retry');
  } else {
    // Permanent error - reject to DLQ
    queueMetricsInstrumentation.instrumentReject(
      channel,
      msg,
      QUEUES.BIRTHDAY_MESSAGES,
      'permanent_error'
    );
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Permanent error detected, sending to DLQ');
  }
}
```

### Step 5: Add Graceful Shutdown

In your shutdown handler (e.g., `src/worker.ts`):

```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  try {
    // Stop consumer
    await consumer.stopConsuming();

    // Close RabbitMQ connection
    await rabbitMQ.close();

    // Shutdown metrics instrumentation
    await queueMetricsInstrumentation.shutdown();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during shutdown');
    process.exit(1);
  }
});
```

### Step 6: Optional - Monitor Queue Depth

Add periodic queue stats monitoring (optional, recommended):

```typescript
// In your startup code
setInterval(async () => {
  try {
    await publisher.getQueueStats(QUEUES.BIRTHDAY_MESSAGES);
    await publisher.getQueueStats(QUEUES.BIRTHDAY_DLQ);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to update queue stats');
  }
}, 30000); // Every 30 seconds
```

## Verify Metrics

After integration, verify metrics are being collected:

### 1. Check Metrics Endpoint

```bash
curl http://localhost:3000/metrics | grep birthday_scheduler_message
```

You should see:
```
# HELP birthday_scheduler_message_publish_duration_seconds Message publish duration in seconds
# TYPE birthday_scheduler_message_publish_duration_seconds histogram
birthday_scheduler_message_publish_duration_seconds_bucket{le="0.001",exchange="birthday.messages",routing_key="birthday"} 0
...

# HELP birthday_scheduler_message_acks_total Message acknowledgments
# TYPE birthday_scheduler_message_acks_total counter
birthday_scheduler_message_acks_total{queue_name="birthday.messages.queue",consumer_tag="default"} 42
```

### 2. Test with a Message

Send a test message and verify metrics increase:

```typescript
// Publish a test message
await publisher.publishMessage({
  messageId: '123e4567-e89b-12d3-a456-426614174000',
  userId: '123e4567-e89b-12d3-a456-426614174001',
  messageType: 'BIRTHDAY',
  scheduledSendTime: new Date().toISOString(),
  retryCount: 0,
  timestamp: Date.now(),
});

// Check metrics
// Should see: publisher_confirms_total increment
// Should see: message_publish_duration_seconds histogram update
```

### 3. Monitor in Grafana

Create a simple dashboard with these queries:

**Message Rate:**
```promql
rate(birthday_scheduler_message_acks_total[5m])
```

**P95 Latency:**
```promql
histogram_quantile(0.95, rate(birthday_scheduler_message_processing_latency_seconds_bucket[5m]))
```

**Queue Depth:**
```promql
birthday_scheduler_queue_depth{queue_name="birthday.messages.queue"}
```

## Troubleshooting

### Metrics Not Appearing

1. **Check initialization:**
   ```typescript
   console.log('Instrumentation ready:', queueMetricsInstrumentation.isReady());
   ```

2. **Check connection status:**
   ```typescript
   console.log('Connection status:', queueMetricsInstrumentation.getConnectionStatus());
   ```

3. **Enable debug logging:**
   ```bash
   LOG_LEVEL=debug npm start
   ```

### High Memory Usage

If memory usage is high, disable message metadata tracking:

```typescript
const instrumentation = new QueueMetricsInstrumentation({
  trackMessageDetails: false, // Disable latency tracking
});
```

### Metrics Delayed

Queue depth metrics update based on interval. To update immediately:

```typescript
await queueMetricsInstrumentation.updateQueueMetrics();
```

## Configuration Options

### Environment Variables

```bash
# Optional: Customize monitoring interval (default: 30000ms)
QUEUE_METRICS_DEPTH_INTERVAL=60000

# Optional: Disable features for performance
QUEUE_METRICS_TRACK_CONSUMERS=false
QUEUE_METRICS_TRACK_CONNECTION=false
QUEUE_METRICS_TRACK_DETAILS=false
```

### Code Configuration

```typescript
const instrumentation = new QueueMetricsInstrumentation({
  queueDepthInterval: 60000,      // Monitor every minute
  trackConsumerCount: true,       // Track active consumers
  trackConnectionStatus: true,    // Track connection health
  trackMessageDetails: true,      // Track message metadata for latency
});
```

## What's Next?

1. **Review Full Documentation**
   - See `src/services/queue/README.md` for detailed usage
   - See `src/services/queue/integration-example.ts` for complete examples

2. **Setup Alerts**
   - High queue depth
   - Low consumer count
   - High error rate
   - Connection failures

3. **Create Dashboards**
   - Use example Grafana queries
   - Monitor queue health
   - Track message throughput

4. **Optimize Configuration**
   - Adjust monitoring intervals
   - Tune tracking features based on needs
   - Monitor memory and CPU usage

## Help

- **Documentation**: `src/services/queue/README.md`
- **Examples**: `src/services/queue/integration-example.ts`
- **Tests**: `tests/unit/services/queue-metrics.test.ts`
- **Implementation Guide**: `docs/QUEUE_METRICS_IMPLEMENTATION.md`
