# Queue System Architecture

## Overview

The Birthday Message Scheduler uses a **message queue-based architecture** to reliably deliver birthday and anniversary messages to users.

### System Diagram

```
┌──────────────────────────────────────────────┐
│   MinuteEnqueueScheduler (CRON, Every Min)   │
│  - Finds messages due in next hour           │
│  - Updates status to QUEUED                  │
│  - Publishes to RabbitMQ                     │
└─────────────────┬────────────────────────────┘
                  │
                  │ publishMessage()
                  ▼
        ┌──────────────────────┐
        │  MessagePublisher    │
        │  - Validates schema  │
        │  - Confirms enabled  │
        │  - Metrics recording │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   RabbitMQ Broker    │
        │  Topic Exchange      │
        │  Main Queue          │
        │  Dead Letter Queue   │
        └──────────┬───────────┘
                   │
                   │ consume()
                   ▼
        ┌──────────────────────────────────┐
        │   Worker Process                 │
        │  ┌────────────────────────────┐  │
        │  │ MessageConsumer            │  │
        │  │ - Prefetch: 5              │  │
        │  │ - Manual ACK/NACK          │  │
        │  │ - Exponential backoff      │  │
        │  └────────┬───────────────────┘  │
        │           ▼                       │
        │  ┌────────────────────────────┐  │
        │  │ MessageWorker.process()    │  │
        │  │ 1. Fetch from DB           │  │
        │  │ 2. Check idempotency       │  │
        │  │ 3. Send message            │  │
        │  │ 4. Update status           │  │
        │  │ 5. Record metrics          │  │
        │  └────────────────────────────┘  │
        └────────────────────────────────────┘
```

## Components

### 1. RabbitMQ Connection (src/queue/connection.ts)
- **Singleton Pattern**: Single connection for entire app
- **Automatic Reconnection**: Uses amqp-connection-manager
- **Separate Channels**: Publisher and consumer channels
- **Heartbeat**: 60-second heartbeat for dead connection detection

### 2. Message Publisher (src/queue/publisher.ts)
- Initialize queue topology (exchanges, queues, bindings)
- Validate messages before publishing
- Persistent delivery (deliveryMode: 2)
- Publisher confirms for reliability
- Batch publishing and retry logic

### 3. Message Consumer (src/queue/consumer.ts)
- Manual acknowledgment for reliability
- Prefetch limit (5) for fair distribution
- Error categorization and retry logic
- Dead letter queue routing
- Graceful shutdown handling

### 4. Message Worker (src/workers/message-worker.ts)
- Fetch message from database
- Check idempotency (skip if already sent)
- Send via external API
- Update status with response
- Record metrics

### 5. Minute Scheduler (src/schedulers/minute-enqueue.scheduler.ts)
- Runs every minute (UTC)
- Finds messages due in next hour
- Updates status to QUEUED
- Publishes to RabbitMQ
- Health monitoring

## Queue Configuration

### Exchanges
- **birthday.messages** (Topic): Routes birthday/anniversary messages
- **birthday.messages.dlx** (Direct): Routes failed messages to DLQ

### Queues
- **birthday.messages.queue** (Quorum): Main queue, durable, 3-node replication
- **birthday.messages.dlq** (Quorum): Dead letter queue for failures

### Routing Keys
- **birthday**: Birthday messages
- **anniversary**: Anniversary messages
- **dlq**: Dead letter routing

## Data Flow

### Publishing
```
MinuteEnqueueScheduler (every 1 minute)
  → Find CREATED messages due in next hour
  → Update status to QUEUED
  → MessagePublisher.publishMessage(job)
    → Validate schema
    → Serialize to JSON
    → Publish to topic exchange
    → Record metrics
```

### Consuming
```
Worker startup
  → MessageConsumer.startConsuming()
    → Prefetch = 5
    → Listen for messages
      → Parse and validate JSON
      → Extract retry count
      → messageWorker.processMessage()
        → Fetch from database
        → Check if already sent (idempotency)
        → Update status to SENDING
        → Send via API
        → Update final status
        → Record metrics
      → ACK on success
      → NACK + requeue on transient error
      → Reject to DLQ on permanent error
```

### Error Handling
```
Error during processing
  ├─ Transient (network, timeout, rate limit)
  │   → Check retry count < MAX_RETRIES (5)
  │   ├─ Yes: NACK + requeue with delay
  │   │   Delay = 2s × 2^retryCount (2s, 4s, 8s, 16s, 32s)
  │   └─ No: Send to DLQ
  │
  └─ Permanent (validation, not found, auth)
      → Send to DLQ immediately
```

## Metrics & Observability

**Message Operations**:
- queue_message_publish_duration_seconds (histogram)
- queue_message_consume_duration_seconds (histogram)
- queue_message_ack_total (counter)
- queue_message_nack_total (counter)
- queue_message_redelivery_total (counter)

**Queue Health**:
- queue_depth_messages (gauge) - Current queue length
- queue_consumers_active (gauge) - Active consumer count
- queue_wait_time_seconds (histogram) - Time in queue

**Connection**:
- queue_connection_status (gauge) - 1=connected, 0=disconnected
- queue_channel_opens_total (counter)
- queue_channel_closes_total (counter)

## Design Decisions

### Quorum Queues (Zero Data Loss)
- 3-node replication for critical birthday messages
- Automatic failover and recovery
- Trade-off: Higher latency for guaranteed delivery
- Production requirement: 3+ RabbitMQ nodes

### Prefetch Count = 5
- Prevents single worker from hoarding messages
- Fair distribution across multiple workers
- Reduces memory pressure on each worker

### Manual Acknowledgment
- Guarantees message processing reliability
- Failed messages automatically requeued
- Built-in idempotency protection

### Exponential Backoff (2s to 32s)
- Transient errors retry automatically
- Reduces load on failing services
- Permanent errors fail fast to DLQ

### Topic Exchange with Routing Keys
- Flexible routing for future message types
- Can scale to high-priority vs normal messages
- Easy to add new message categories

### Minute-Level Scheduling
- Birthday messages don't need second-level precision
- Reduces database load (vs second-level checks)
- Configurable via CRON_MINUTE_SCHEDULE environment variable

## Configuration Variables

```bash
# RabbitMQ Connection
RABBITMQ_URL=amqp://user:pass@localhost:5672

# Queue Names
RABBITMQ_QUEUE_NAME=birthday.messages.queue
RABBITMQ_DLQ_NAME=birthday.messages.dlq

# Exchange Names
RABBITMQ_EXCHANGE_NAME=birthday.messages
RABBITMQ_DLX_NAME=birthday.messages.dlx

# Consumer Settings
QUEUE_CONCURRENCY=5          # Prefetch count
QUEUE_MAX_RETRIES=5          # Max retry attempts
QUEUE_RETRY_DELAY=2000       # Initial retry delay (ms)
QUEUE_RETRY_BACKOFF=exponential  # exponential or linear

# Scheduler
CRON_MINUTE_SCHEDULE="* * * * *"  # Run every minute (UTC)
```

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Publishing throughput | 100s msgs/sec | Per publisher instance |
| Processing throughput | ~200 msgs/min | At 5 msg prefetch, 500ms processing |
| Queue latency (p99) | < 100ms | Modern RabbitMQ |
| Memory per worker | ~50MB | With connections |
| Max queue size | 100K msgs | Configurable |
| Message TTL | 24 hours | Configurable |
| Retry delay range | 2s - 32s | Exponential backoff |

## Failure Scenarios

### Worker Crashes Mid-Processing
```
Worker processing message
Worker crashes
Message NOT acknowledged
RabbitMQ nack + requeue
Another worker picks up
Idempotency check: Skip if already sent
```

### RabbitMQ Node Failure
```
Quorum queue on 3-node cluster
1 node dies
Cluster rebalances queue
New leader elected
Messages safe (replicated)
Publisher/Consumer auto-reconnect
```

### Scheduler Runs Twice
```
MinuteEnqueueScheduler fires
Publishes messages to queue
Retries and publishes again (duplicate)
Worker receives duplicate messages
Idempotency check: Message already SENT
Worker skips processing
No duplicate sends
```

## References

- [RabbitMQ Quorum Queues](https://www.rabbitmq.com/quorum-queues.html)
- [amqp-connection-manager](https://github.com/jwalton/node-amqp-connection-manager)
- [Message Acknowledgment Patterns](https://www.rabbitmq.com/reliability.html)
- [Dead Letter Exchanges](https://www.rabbitmq.com/dlx.html)
