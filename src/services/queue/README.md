# Queue Metrics Instrumentation

Comprehensive Prometheus metrics instrumentation for RabbitMQ queue operations.

## Overview

The `QueueMetricsInstrumentation` class provides detailed monitoring and observability for RabbitMQ operations by wrapping existing queue infrastructure with metrics collection.

## Features

### Message Publishing Metrics
- **Publish Duration**: Histogram tracking time to publish messages
- **Publisher Confirms**: Counter for successful/failed publishes
- **Message Metadata Tracking**: In-memory tracking for latency calculations

### Message Consumption Metrics
- **Consume Duration**: Histogram tracking message processing time
- **Queue Wait Time**: Time messages spend in queue before processing
- **Processing Latency**: End-to-end message latency

### Acknowledgment Tracking
- **ACK Counter**: Successful message acknowledgments
- **NACK Counter**: Negative acknowledgments (requeue/reject)
- **Redelivery Tracking**: Messages redelivered after nack

### Queue Depth and Consumers
- **Queue Depth**: Current number of messages in queue
- **Consumer Count**: Number of active consumers
- **Unacknowledged Messages**: Messages being processed

### Connection and Channel Events
- **Connection Status**: Connected (1) or disconnected (0)
- **Channel Opens/Closes**: Channel lifecycle events
- **Connection Recoveries**: Automatic reconnection tracking

## Metrics Exposed

All metrics follow the naming convention: `birthday_scheduler_<metric_name>`

### Histograms
- `queue_message_publish_duration_seconds{exchange, routing_key}`
- `queue_message_consume_duration_seconds{queue_name, status}`
- `queue_message_processing_latency_seconds{message_type, status}`
- `queue_wait_time_seconds{queue_name}`
- `channel_operation_duration_seconds{operation}`

### Counters
- `publisher_confirms_total{exchange, status}`
- `message_acks_total{queue_name, consumer_tag}`
- `message_nacks_total{queue_name, reason}`
- `message_redeliveries_total{queue_name, reason}`
- `channel_opens_total{connection_name}`
- `channel_closes_total{connection_name, reason}`
- `connection_recoveries_total{connection_name, recovery_type}`

### Gauges
- `queue_depth{queue_name}` - Current queue depth
- `consumer_count{queue_name}` - Active consumers
- `unacked_messages_count{queue_name}` - Messages being processed

## Usage

### 1. Initialize Instrumentation

```typescript
import { queueMetricsInstrumentation } from './services/queue/queue-metrics.js';

// Initialize with default config
await queueMetricsInstrumentation.initialize();

// Or with custom config
const instrumentation = new QueueMetricsInstrumentation({
  queueDepthInterval: 30000, // 30s monitoring interval
  trackConsumerCount: true,
  trackConnectionStatus: true,
  trackMessageDetails: true,
});
await instrumentation.initialize();
```

### 2. Instrument Connection Events

Update `src/queue/connection.ts`:

```typescript
import { queueMetricsInstrumentation } from '../services/queue/queue-metrics.js';

export class RabbitMQConnection {
  public async connect(): Promise<void> {
    // ... existing code ...

    // Add instrumentation handlers
    const handlers = queueMetricsInstrumentation.instrumentConnection('rabbitmq');

    this.connection.on('connect', ({ url }) => {
      // ... existing code ...
      handlers.onConnect();
    });

    this.connection.on('disconnect', ({ err }) => {
      // ... existing code ...
      handlers.onDisconnect();
    });

    this.connection.on('connectFailed', ({ err }) => {
      // ... existing code ...
      handlers.onConnectFailed();
    });

    // Instrument channels
    queueMetricsInstrumentation.instrumentChannel(this.publisherChannel, 'publisher');
    queueMetricsInstrumentation.instrumentChannel(this.consumerChannel, 'consumer');
  }
}
```

### 3. Instrument Message Publishing

Update `src/queue/publisher.ts`:

```typescript
import { queueMetricsInstrumentation } from '../services/queue/queue-metrics.js';

export class MessagePublisher {
  public async publishMessage(job: MessageJob, routingKey?: string): Promise<void> {
    // ... validation code ...

    // Wrap publish with instrumentation
    await queueMetricsInstrumentation.instrumentPublish(
      async () => {
        const messageBuffer = Buffer.from(JSON.stringify(validatedJob));
        await channel.publish(EXCHANGES.BIRTHDAY_MESSAGES, actualRoutingKey, messageBuffer, {
          ...PUBLISHER_OPTIONS,
          timestamp: validatedJob.timestamp,
          messageId: validatedJob.messageId,
          headers: {
            'x-retry-count': validatedJob.retryCount || 0,
            'x-message-type': validatedJob.messageType,
            'x-user-id': validatedJob.userId,
          },
        });
      },
      EXCHANGES.BIRTHDAY_MESSAGES,
      actualRoutingKey,
      validatedJob.messageId
    );

    logger.info({
      msg: 'Message published successfully',
      messageId: validatedJob.messageId,
      exchange: EXCHANGES.BIRTHDAY_MESSAGES,
      routingKey: actualRoutingKey,
    });
  }

  public async getQueueStats(queueName: string): Promise<QueueStats> {
    const result = await channel.checkQueue(queueName);

    // Update metrics via instrumentation
    queueMetricsInstrumentation.updateQueueDepth(queueName, result.messageCount);
    queueMetricsInstrumentation.updateConsumerCount(queueName, result.consumerCount);

    return {
      messages: result.messageCount,
      messagesReady: result.messageCount,
      messagesUnacknowledged: 0,
      consumers: result.consumerCount,
    };
  }
}
```

### 4. Instrument Message Consumption

Update `src/queue/consumer.ts`:

```typescript
import { queueMetricsInstrumentation } from '../services/queue/queue-metrics.js';

export class MessageConsumer {
  private async handleMessage(msg: ConsumeMessage | null, channel: Channel): Promise<void> {
    if (!msg) {
      // ... existing code ...
      return;
    }

    // ... existing code for parsing and validation ...

    try {
      // Wrap handler with instrumentation
      await queueMetricsInstrumentation.instrumentConsume(
        async () => {
          await this.onMessage(job);
        },
        msg,
        QUEUES.BIRTHDAY_MESSAGES
      );

      // Instrumented acknowledgment
      queueMetricsInstrumentation.instrumentAck(
        channel,
        msg,
        QUEUES.BIRTHDAY_MESSAGES,
        this.consumerTag || 'default'
      );

      logger.info({ msg: 'Message processed successfully', messageId: job.messageId });
    } catch (error) {
      // ... error handling ...

      // Instrumented nack/reject
      if (retryCount >= RETRY_CONFIG.MAX_RETRIES) {
        queueMetricsInstrumentation.instrumentReject(
          channel,
          msg,
          QUEUES.BIRTHDAY_MESSAGES,
          'max_retries_exceeded'
        );
      } else if (isTransientError) {
        queueMetricsInstrumentation.instrumentNack(
          channel,
          msg,
          QUEUES.BIRTHDAY_MESSAGES,
          true, // requeue
          'transient_error'
        );
      } else {
        queueMetricsInstrumentation.instrumentReject(
          channel,
          msg,
          QUEUES.BIRTHDAY_MESSAGES,
          'permanent_error'
        );
      }
    }
  }
}
```

### 5. Instrument Channel Operations

For advanced use cases, instrument specific channel operations:

```typescript
import { queueMetricsInstrumentation } from '../services/queue/queue-metrics.js';

// Instrument queue declaration
await queueMetricsInstrumentation.instrumentChannelOperation('assertQueue', async () => {
  await channel.assertQueue(queueName, options);
});

// Instrument exchange declaration
await queueMetricsInstrumentation.instrumentChannelOperation('assertExchange', async () => {
  await channel.assertExchange(exchangeName, type, options);
});

// Instrument queue binding
await queueMetricsInstrumentation.instrumentChannelOperation('bindQueue', async () => {
  await channel.bindQueue(queueName, exchangeName, routingKey);
});
```

### 6. Monitor Queue Metrics

The instrumentation automatically starts monitoring queue depth at the configured interval. You can also manually trigger updates:

```typescript
// Manually update queue metrics
await queueMetricsInstrumentation.updateQueueMetrics();

// Update specific queue depth
queueMetricsInstrumentation.updateQueueDepth('birthday.messages.queue', 150);

// Update consumer count
queueMetricsInstrumentation.updateConsumerCount('birthday.messages.queue', 5);
```

### 7. Graceful Shutdown

```typescript
// Shutdown instrumentation on application exit
process.on('SIGTERM', async () => {
  await queueMetricsInstrumentation.shutdown();
  // ... other cleanup ...
});
```

## Configuration

### Environment Variables

You can configure the instrumentation via environment variables:

```bash
# Queue depth monitoring interval (milliseconds)
QUEUE_METRICS_DEPTH_INTERVAL=30000

# Enable consumer count tracking
QUEUE_METRICS_TRACK_CONSUMERS=true

# Enable connection status tracking
QUEUE_METRICS_TRACK_CONNECTION=true

# Enable detailed message tracking
QUEUE_METRICS_TRACK_DETAILS=true
```

### Programmatic Configuration

```typescript
const instrumentation = new QueueMetricsInstrumentation({
  queueDepthInterval: 30000, // Monitor every 30 seconds
  trackConsumerCount: true,   // Track active consumers
  trackConnectionStatus: true, // Track connection status
  trackMessageDetails: true,   // Track individual message metadata
});
```

## Performance Considerations

### Memory Usage
- Message metadata is stored in-memory until message is acked/rejected
- Metadata map is automatically cleaned up after message processing
- For high-throughput systems, consider disabling `trackMessageDetails`

### CPU Overhead
- Minimal overhead (~1-2ms per message)
- Uses `performance.now()` for high-precision timing
- Queue depth monitoring runs in separate interval (configurable)

### Network Overhead
- No additional RabbitMQ API calls
- Metrics are collected during normal operation
- Queue stats are only fetched when explicitly requested

## Grafana Dashboard

Example queries for visualizing queue metrics:

### Message Processing Rate
```promql
rate(birthday_scheduler_message_acks_total[5m])
```

### Average Publish Duration
```promql
histogram_quantile(0.95,
  rate(birthday_scheduler_message_publish_duration_seconds_bucket[5m])
)
```

### Queue Depth Over Time
```promql
birthday_scheduler_queue_depth{queue_name="birthday.messages.queue"}
```

### Redelivery Rate
```promql
rate(birthday_scheduler_message_redeliveries_total[5m])
```

### Processing Latency (P95)
```promql
histogram_quantile(0.95,
  rate(birthday_scheduler_message_processing_latency_seconds_bucket[5m])
)
```

## Testing

### Unit Tests

```typescript
import { QueueMetricsInstrumentation } from './queue-metrics.js';

describe('QueueMetricsInstrumentation', () => {
  let instrumentation: QueueMetricsInstrumentation;

  beforeEach(async () => {
    instrumentation = new QueueMetricsInstrumentation({
      queueDepthInterval: 0, // Disable auto-monitoring in tests
    });
    await instrumentation.initialize();
  });

  afterEach(async () => {
    await instrumentation.shutdown();
  });

  it('should track publish metrics', async () => {
    // Test implementation
  });

  it('should track consume metrics', async () => {
    // Test implementation
  });
});
```

## Troubleshooting

### Metrics Not Appearing

1. Check if instrumentation is initialized:
   ```typescript
   if (!queueMetricsInstrumentation.isReady()) {
     await queueMetricsInstrumentation.initialize();
   }
   ```

2. Verify MetricsService is properly configured
3. Check Prometheus scraping endpoint: `GET /metrics`

### High Memory Usage

If you notice high memory usage:

1. Disable message metadata tracking:
   ```typescript
   const instrumentation = new QueueMetricsInstrumentation({
     trackMessageDetails: false,
   });
   ```

2. Reduce queue depth monitoring frequency:
   ```typescript
   const instrumentation = new QueueMetricsInstrumentation({
     queueDepthInterval: 60000, // 60 seconds
   });
   ```

### Missing Queue Depth Metrics

Ensure the publisher periodically calls `getQueueStats()`:

```typescript
// In publisher initialization or scheduler
setInterval(async () => {
  await publisher.getQueueStats(QUEUES.BIRTHDAY_MESSAGES);
}, 30000);
```

## Migration Guide

### From Manual Metrics Calls

**Before:**
```typescript
await channel.publish(exchange, routingKey, buffer, options);
metricsService.recordMessagePublishDuration(exchange, routingKey, duration);
```

**After:**
```typescript
await queueMetricsInstrumentation.instrumentPublish(
  () => channel.publish(exchange, routingKey, buffer, options),
  exchange,
  routingKey,
  messageId
);
```

### Gradual Migration

You can gradually migrate by using instrumentation alongside existing metrics calls. The instrumentation is designed to be non-invasive and can coexist with manual metric recording.

## Best Practices

1. **Initialize Early**: Initialize instrumentation during application startup
2. **Use Singleton**: Use the exported `queueMetricsInstrumentation` instance
3. **Handle Errors**: Wrap instrumentation calls in try-catch for resilience
4. **Monitor Memory**: Watch memory usage in production, disable `trackMessageDetails` if needed
5. **Tune Intervals**: Adjust monitoring intervals based on your traffic patterns
6. **Clean Shutdown**: Always call `shutdown()` during graceful shutdown

## Related Documentation

- [MetricsService Documentation](../metrics.service.ts)
- [RabbitMQ Queue Configuration](../../queue/config.ts)
- [Message Publisher](../../queue/publisher.ts)
- [Message Consumer](../../queue/consumer.ts)
- [Prometheus Client Documentation](https://github.com/siimon/prom-client)
