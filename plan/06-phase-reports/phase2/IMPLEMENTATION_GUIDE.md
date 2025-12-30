# RabbitMQ Implementation Guide

## Overview

This document describes the RabbitMQ message queue infrastructure implemented for the Birthday Message Scheduler application. The implementation ensures **zero data loss** using Quorum Queues and provides reliable message processing with automatic retries and dead letter queue handling.

## Architecture

```
┌─────────────────┐
│   Application   │
│   (Fastify)     │
└────────┬────────┘
         │
         │ publishes
         ▼
┌─────────────────────────────────────────────────────┐
│              RabbitMQ Message Queue                 │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  birthday.messages (Topic Exchange)          │  │
│  │  Routing: birthday, anniversary              │  │
│  └─────────────────┬────────────────────────────┘  │
│                    │                                │
│                    ▼                                │
│  ┌──────────────────────────────────────────────┐  │
│  │  birthday.messages.queue (Quorum Queue)      │  │
│  │  - Zero data loss (3-node replication)       │  │
│  │  - Persistent messages                       │  │
│  │  - Dead letter exchange configured           │  │
│  └─────────────────┬────────────────────────────┘  │
│                    │                                │
│                    │ on failure (max retries)       │
│                    ▼                                │
│  ┌──────────────────────────────────────────────┐  │
│  │  birthday.messages.dlx (DLX)                 │  │
│  └─────────────────┬────────────────────────────┘  │
│                    │                                │
│                    ▼                                │
│  ┌──────────────────────────────────────────────┐  │
│  │  birthday.messages.dlq (Dead Letter Queue)   │  │
│  │  - Stores permanently failed messages        │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │
         │ consumes
         ▼
┌─────────────────┐
│  Message Worker │
│   (Consumer)    │
│                 │
│  1. Fetch msg   │
│  2. Send email  │
│  3. Update DB   │
│  4. ACK/NACK    │
└─────────────────┘
```

## Implementation Details

### 1. Connection Management (`src/queue/connection.ts`)

**Features:**
- Singleton pattern for connection management
- Automatic reconnection on failures using `amqp-connection-manager`
- Separate channels for publisher and consumer
- Health check support
- Graceful shutdown

**Usage:**
```typescript
import { initializeRabbitMQ, getRabbitMQ } from './queue';

// Initialize connection
await initializeRabbitMQ();

// Get connection instance
const rabbitMQ = getRabbitMQ();
```

### 2. Queue Configuration (`src/queue/config.ts`)

**Exchanges:**
- `birthday.messages` - Topic exchange for routing messages
- `birthday.messages.dlx` - Dead letter exchange for failed messages

**Queues:**
- `birthday.messages.queue` - Main quorum queue (zero data loss)
- `birthday.messages.dlq` - Dead letter queue for permanently failed messages

**Quorum Queue Configuration:**
```typescript
{
  durable: true,
  arguments: {
    'x-queue-type': 'quorum',        // Zero data loss
    'x-dead-letter-exchange': 'birthday.messages.dlx',
    'x-dead-letter-routing-key': 'dlq',
  }
}
```

**Routing Keys:**
- `birthday` - Birthday messages
- `anniversary` - Anniversary messages
- `dlq` - Dead letter queue routing

### 3. Message Publisher (`src/queue/publisher.ts`)

**Features:**
- Message validation using Zod schemas
- Publisher confirms for reliability
- Persistent messages (deliveryMode: 2)
- Batch publishing support
- Retry logic with exponential backoff
- Queue statistics monitoring

**Usage:**
```typescript
import { MessagePublisher } from './queue';

const publisher = new MessagePublisher();
await publisher.initialize();

// Publish single message
await publisher.publishMessage({
  messageId: 'uuid',
  userId: 'uuid',
  messageType: 'BIRTHDAY',
  scheduledSendTime: new Date().toISOString(),
  retryCount: 0,
  timestamp: Date.now(),
});

// Publish batch
await publisher.publishBatch(jobs);

// Publish with retry
await publisher.publishWithRetry(job, maxRetries, retryDelay);
```

### 4. Message Consumer (`src/queue/consumer.ts`)

**Features:**
- Manual message acknowledgment
- Prefetch limit for fair distribution (default: 5)
- Error handling with retry/reject logic
- Transient vs permanent error detection
- Graceful shutdown support

**Error Handling:**
- **Transient errors** (network, timeout, 503, 429): NACK with requeue
- **Permanent errors** (validation, 404, 401, 403): NACK without requeue (→ DLQ)
- **Max retries reached**: Send to DLQ

**Usage:**
```typescript
import { MessageConsumer } from './queue';

const consumer = new MessageConsumer({
  prefetch: 5,
  onMessage: async (job) => {
    // Process message
    console.log('Processing:', job);
  },
  onError: async (error, job) => {
    // Handle error
    console.error('Error:', error, job);
  },
});

await consumer.startConsuming();
consumer.setupGracefulShutdown();
```

### 5. Message Worker (`src/workers/message-worker.ts`)

**Features:**
- Database integration for message logs and users
- Idempotency handling (skip already sent messages)
- Circuit breaker pattern for external API calls
- Status tracking (SCHEDULED → QUEUED → SENDING → SENT/FAILED)
- Comprehensive logging

**Processing Flow:**
1. Consume message from queue
2. Fetch message details from database
3. Check idempotency (skip if already sent)
4. Update status to SENDING
5. Fetch user email
6. Send message via external API
7. Update status to SENT/FAILED
8. ACK/NACK message

**Usage:**
```typescript
import { messageWorker } from './workers/message-worker';

// Start worker
await messageWorker.start();

// Stop worker
await messageWorker.stop();
```

### 6. Message Sender Service (`src/services/message-sender.service.ts`)

**Features:**
- Circuit breaker pattern using Opossum
- HTTP client with timeout support
- Automatic error categorization
- Response tracking

**Circuit Breaker Configuration:**
- Error threshold: 50%
- Reset timeout: 30s
- Volume threshold: 10 requests

## Configuration

### Environment Variables

```env
# RabbitMQ Connection
RABBITMQ_URL=amqp://rabbitmq:rabbitmq_dev_password@localhost:5672
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=rabbitmq
RABBITMQ_PASSWORD=rabbitmq_dev_password
RABBITMQ_VHOST=/

# Queue Names
RABBITMQ_QUEUE_NAME=birthday.messages.queue
RABBITMQ_EXCHANGE_NAME=birthday.messages
RABBITMQ_DLX_NAME=birthday.messages.dlx
RABBITMQ_DLQ_NAME=birthday.messages.dlq

# Queue Settings
QUEUE_CONCURRENCY=5          # Messages per worker
QUEUE_MAX_RETRIES=5          # Max retry attempts
QUEUE_RETRY_DELAY=2000       # Base retry delay (ms)
QUEUE_RETRY_BACKOFF=exponential  # exponential or linear

# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=10000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000
CIRCUIT_BREAKER_VOLUME_THRESHOLD=10
```

## Running the System

### 1. Start RabbitMQ (Docker)

```bash
docker run -d \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=rabbitmq \
  -e RABBITMQ_DEFAULT_PASS=rabbitmq_dev_password \
  rabbitmq:3.13-management-alpine
```

### 2. Start Worker Process

```bash
npm run worker
# or
tsx src/worker.ts
```

### 3. Publish Messages

```typescript
import { MessagePublisher } from './queue';

const publisher = new MessagePublisher();
await publisher.initialize();

await publisher.publishMessage({
  messageId: 'uuid',
  userId: 'uuid',
  messageType: 'BIRTHDAY',
  scheduledSendTime: new Date().toISOString(),
  retryCount: 0,
  timestamp: Date.now(),
});
```

## Testing

### Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run queue-specific tests
npm run test -- tests/integration/queue/
```

### Test Coverage

The implementation includes comprehensive integration tests:

1. **Connection Management Tests**
   - Connection establishment
   - Health checks
   - Channel access

2. **Publisher Tests**
   - Single message publishing
   - Batch publishing
   - Message validation
   - Queue statistics

3. **Consumer Tests**
   - Message consumption
   - Error handling with retry
   - Graceful shutdown

4. **Dead Letter Queue Tests**
   - Failed message routing to DLQ
   - Max retry handling

5. **End-to-End Tests**
   - Complete publish-consume-ack cycle
   - Multiple message processing

## Monitoring

### Queue Statistics

```typescript
const stats = await publisher.getQueueStats(QUEUES.BIRTHDAY_MESSAGES);
console.log({
  messages: stats.messages,
  messagesReady: stats.messagesReady,
  messagesUnacknowledged: stats.messagesUnacknowledged,
  consumers: stats.consumers,
});
```

### Circuit Breaker Stats

```typescript
import { messageSenderService } from './services/message-sender.service';

const stats = messageSenderService.getStats();
console.log({
  isOpen: stats.isOpen,
  stats: stats.stats,
});
```

### Management UI

Access RabbitMQ Management UI at: http://localhost:15672
- Username: `rabbitmq`
- Password: `rabbitmq_dev_password`

## Production Considerations

### 1. Quorum Queue Requirements

- **Minimum 3 nodes** required for quorum consensus
- Configure cluster in production environment
- Use `x-quorum-initial-group-size: 3` for new queues

### 2. Monitoring and Alerts

Set up alerts for:
- Queue depth > 10,000 messages
- No active consumers
- Memory usage > 80%
- Disk free < 5 GB
- High DLQ message count

### 3. Scaling

**Horizontal Scaling:**
```bash
# Run multiple worker instances
docker-compose up -d --scale birthday-worker=5
```

**Vertical Scaling:**
- Increase `QUEUE_CONCURRENCY` for more messages per worker
- Adjust `RABBITMQ_VM_MEMORY_HIGH_WATERMARK`

### 4. Disaster Recovery

- Regular definition backups: `rabbitmqctl export_definitions`
- Database backups for message logs
- Monitor DLQ for permanently failed messages

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if RabbitMQ is running
   docker ps | grep rabbitmq

   # Check logs
   docker logs rabbitmq
   ```

2. **Messages Not Being Consumed**
   ```bash
   # Check consumer count
   rabbitmqctl list_queues name consumers
   ```

3. **High Memory Usage**
   ```bash
   # Check memory breakdown
   rabbitmqctl status | grep memory
   ```

4. **DLQ Filling Up**
   - Review error patterns in logs
   - Fix underlying issues
   - Reprocess or purge DLQ messages

## References

- [RabbitMQ Documentation](https://www.rabbitmq.com/docs)
- [Quorum Queues Guide](https://www.rabbitmq.com/quorum-queues.html)
- [Publisher Confirms](https://www.rabbitmq.com/confirms.html)
- [Dead Letter Exchanges](https://www.rabbitmq.com/dlx.html)
- [amqp-connection-manager](https://github.com/jwalton/node-amqp-connection-manager)
