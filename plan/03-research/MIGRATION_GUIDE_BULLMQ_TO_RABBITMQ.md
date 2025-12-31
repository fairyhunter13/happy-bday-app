# Migration Guide: BullMQ to RabbitMQ

**For Birthday Message Scheduler**

---

## Table of Contents

1. [Migration Strategy](#1-migration-strategy)
2. [Side-by-Side Code Comparison](#2-side-by-side-code-comparison)
3. [Feature Mapping](#3-feature-mapping)
4. [Migration Steps](#4-migration-steps)
5. [Dual-Run Strategy](#5-dual-run-strategy)
6. [Rollback Plan](#6-rollback-plan)

---

## 1. Migration Strategy

### Recommended Approach: Gradual Migration with Dual-Run

This approach minimizes risk and allows for validation before full cutover.

**Timeline:** 2-4 weeks

**Phases:**
1. Week 1: Setup RabbitMQ infrastructure and testing
2. Week 2: Deploy dual-publishing (write to both BullMQ and RabbitMQ)
3. Week 3: Validate RabbitMQ, monitor metrics
4. Week 4: Cutover to RabbitMQ-only, decommission BullMQ

---

## 2. Side-by-Side Code Comparison

### 2.1 Queue Connection

**BullMQ:**
```javascript
const { Queue } = require('bullmq');

const queue = new Queue('birthday-messages', {
  connection: {
    host: 'localhost',
    port: 6379,
  }
});
```

**RabbitMQ:**
```javascript
const amqp = require('amqplib');

const connection = await amqp.connect('amqp://localhost:5672');
const channel = await connection.createChannel();

await channel.assertQueue('birthday-messages', {
  durable: true,
  arguments: {
    'x-queue-type': 'quorum',
  },
});
```

---

### 2.2 Publishing Messages

**BullMQ:**
```javascript
await queue.add('send-birthday', {
  userId: 123,
  email: 'user@example.com',
  name: 'John Doe',
}, {
  delay: 3600000, // 1 hour delay
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: true,
  removeOnFail: false,
});
```

**RabbitMQ:**
```javascript
const message = {
  userId: 123,
  email: 'user@example.com',
  name: 'John Doe',
};

await channel.confirmSelect();

channel.sendToQueue('birthday-messages',
  Buffer.from(JSON.stringify(message)),
  {
    persistent: true,
    timestamp: Date.now(),
    headers: {
      'x-delay': 3600000, // Requires rabbitmq_delayed_message_exchange plugin
      'x-retry-count': 0,
    },
  }
);

await channel.waitForConfirms();
```

**Note:** For delayed messages, you need the RabbitMQ Delayed Message Plugin or implement a custom delay using TTL + DLX.

---

### 2.3 Consuming Messages

**BullMQ:**
```javascript
const { Worker } = require('bullmq');

const worker = new Worker('birthday-messages', async (job) => {
  console.log('Processing job:', job.id);

  await sendBirthdayEmail(job.data);

  return { sent: true };
}, {
  connection: {
    host: 'localhost',
    port: 6379,
  },
  limiter: {
    max: 100,
    duration: 1000,
  },
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
```

**RabbitMQ:**
```javascript
await channel.prefetch(10); // Concurrency

channel.consume('birthday-messages', async (msg) => {
  if (!msg) return;

  try {
    const data = JSON.parse(msg.content.toString());
    console.log('Processing message:', data);

    await sendBirthdayEmail(data);

    channel.ack(msg); // Success
  } catch (error) {
    console.error('Failed to process:', error);

    const retryCount = msg.properties.headers['x-retry-count'] || 0;

    if (retryCount < 3) {
      // Retry
      channel.nack(msg, false, true);
    } else {
      // Send to DLQ
      channel.nack(msg, false, false);
    }
  }
}, {
  noAck: false,
});
```

---

### 2.4 Scheduled/Delayed Jobs

**BullMQ:**
```javascript
await queue.add('send-birthday', data, {
  delay: calculateDelayUntilBirthday(birthday), // Milliseconds
});
```

**RabbitMQ (Option 1: Delayed Message Plugin):**

Install plugin:
```bash
docker exec birthday-rabbitmq rabbitmq-plugins enable rabbitmq_delayed_message_exchange
```

Code:
```javascript
// Declare delayed exchange
await channel.assertExchange('birthday-delayed', 'x-delayed-message', {
  durable: true,
  arguments: {
    'x-delayed-type': 'direct',
  },
});

await channel.bindQueue('birthday-messages', 'birthday-delayed', 'birthday');

// Publish with delay
channel.publish('birthday-delayed', 'birthday',
  Buffer.from(JSON.stringify(data)),
  {
    persistent: true,
    headers: {
      'x-delay': calculateDelayUntilBirthday(birthday),
    },
  }
);
```

**RabbitMQ (Option 2: TTL + Dead Letter Exchange):**

```javascript
// Create delay queue with TTL
await channel.assertQueue('birthday-delay-queue', {
  durable: true,
  arguments: {
    'x-message-ttl': delayMs,
    'x-dead-letter-exchange': '',
    'x-dead-letter-routing-key': 'birthday-messages',
  },
});

// Publish to delay queue
channel.sendToQueue('birthday-delay-queue',
  Buffer.from(JSON.stringify(data)),
  { persistent: true }
);
```

---

### 2.5 Retry Logic

**BullMQ:**
```javascript
// Automatic retry with exponential backoff
await queue.add('job', data, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
});
```

**RabbitMQ (Manual Implementation):**

```javascript
channel.consume('birthday-messages', async (msg) => {
  try {
    await processMessage(msg);
    channel.ack(msg);
  } catch (error) {
    const retryCount = msg.properties.headers['x-retry-count'] || 0;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      // Calculate exponential backoff delay
      const delay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s

      // Publish to delay queue with updated retry count
      channel.sendToQueue('birthday-retry-queue',
        msg.content,
        {
          persistent: true,
          headers: {
            'x-retry-count': retryCount + 1,
          },
          arguments: {
            'x-message-ttl': delay,
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': 'birthday-messages',
          },
        }
      );

      channel.ack(msg);
    } else {
      // Send to DLQ
      channel.nack(msg, false, false);
    }
  }
});
```

---

### 2.6 Job Progress & Status

**BullMQ:**
```javascript
// Update progress
await job.updateProgress(50);

// Get job by ID
const job = await queue.getJob(jobId);
console.log(job.progress, job.returnvalue);

// Get job counts
const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
```

**RabbitMQ:**

RabbitMQ doesn't have built-in job progress tracking. You need to implement this separately:

```javascript
// Option 1: Store in database
await db.jobs.update(jobId, { progress: 50, status: 'processing' });

// Option 2: Publish progress to separate queue
channel.sendToQueue('job-progress',
  Buffer.from(JSON.stringify({ jobId, progress: 50 }))
);

// Get queue stats via Management API
const axios = require('axios');
const response = await axios.get(
  'http://localhost:15672/api/queues/%2F/birthday-messages',
  { auth: { username: 'admin', password: 'password' } }
);

console.log({
  messagesReady: response.data.messages_ready,
  messagesUnacknowledged: response.data.messages_unacknowledged,
});
```

---

### 2.7 Rate Limiting

**BullMQ:**
```javascript
const worker = new Worker('queue', processJob, {
  limiter: {
    max: 100, // Max 100 jobs
    duration: 1000, // Per 1 second
  },
});
```

**RabbitMQ:**

Rate limiting requires additional setup:

```javascript
// Option 1: Manual rate limiting with prefetch
await channel.prefetch(10); // Max 10 concurrent messages

// Option 2: Use external rate limiter
const RateLimiter = require('limiter').RateLimiter;
const limiter = new RateLimiter(100, 'second');

channel.consume('queue', async (msg) => {
  await limiter.removeTokens(1);
  await processMessage(msg);
  channel.ack(msg);
});

// Option 3: RabbitMQ Sharding Plugin (for advanced scenarios)
```

---

## 3. Feature Mapping

| BullMQ Feature | RabbitMQ Equivalent | Implementation Difficulty |
|----------------|---------------------|--------------------------|
| **Basic Queuing** | Standard queues | Easy |
| **Delayed Jobs** | Delayed Message Plugin or TTL+DLX | Medium |
| **Job Retries** | Manual with DLX + retry count headers | Medium |
| **Job Progress** | External system (DB, separate queue) | Hard |
| **Job Prioritization** | Priority queues | Easy |
| **Rate Limiting** | Manual with prefetch or external limiter | Medium |
| **Job Events** | Consumer acknowledgments | Easy |
| **Job Removal** | Auto-ack or TTL | Easy |
| **Repeatable Jobs** | External scheduler (cron) + publisher | Hard |
| **Job Concurrency** | `channel.prefetch(N)` | Easy |
| **Job Groups/Batches** | Routing keys + exchanges | Medium |
| **Job Dependencies** | Manual orchestration | Hard |

---

## 4. Migration Steps

### Step 1: Infrastructure Setup (Week 1)

**1.1 Deploy RabbitMQ**

```bash

# Create Docker Compose file (see RABBITMQ_IMPLEMENTATION_GUIDE.md)

docker-compose up -d rabbitmq

# Verify RabbitMQ is running

docker-compose logs rabbitmq

# Access management UI

open http://localhost:15672
```

**1.2 Install Dependencies**

```bash
npm install amqplib
```

**1.3 Create Abstraction Layer**

```javascript
// src/queue/adapter.js
class QueueAdapter {
  constructor(type) {
    this.type = type; // 'bullmq' or 'rabbitmq'
  }

  async publish(queue, data, options = {}) {
    if (this.type === 'bullmq') {
      return this.bullmqPublish(queue, data, options);
    } else {
      return this.rabbitmqPublish(queue, data, options);
    }
  }

  async consume(queue, handler) {
    if (this.type === 'bullmq') {
      return this.bullmqConsume(queue, handler);
    } else {
      return this.rabbitmqConsume(queue, handler);
    }
  }
}
```

---

### Step 2: Dual Publishing (Week 2)

**2.1 Publish to Both Systems**

```javascript
const adapter = new QueueAdapter(process.env.QUEUE_TYPE || 'both');

async function scheduleBirthdayMessage(user) {
  const message = {
    userId: user.id,
    email: user.email,
    birthday: user.birthday,
  };

  if (adapter.type === 'both') {
    // Publish to both BullMQ and RabbitMQ
    await Promise.all([
      adapter.bullmqPublish('birthday-messages', message),
      adapter.rabbitmqPublish('birthday-messages', message),
    ]);
  } else {
    await adapter.publish('birthday-messages', message);
  }
}
```

**2.2 Run Separate Consumers**

```bash

# Terminal 1: BullMQ worker (existing)

QUEUE_TYPE=bullmq npm run worker

# Terminal 2: RabbitMQ worker (new)

QUEUE_TYPE=rabbitmq npm run worker
```

**2.3 Monitor Both Systems**

```javascript
// Compare processing rates
setInterval(async () => {
  const bullmqMetrics = await getBullMQMetrics();
  const rabbitmqMetrics = await getRabbitMQMetrics();

  console.log('BullMQ:', bullmqMetrics);
  console.log('RabbitMQ:', rabbitmqMetrics);
}, 30000);
```

---

### Step 3: Validation (Week 3)

**3.1 Verify Message Delivery**

```javascript
// Track message IDs in both systems
const messageTracker = new Map();

// Publisher
const messageId = uuid();
messageTracker.set(messageId, {
  published: Date.now(),
  bullmqProcessed: false,
  rabbitmqProcessed: false,
});

// Consumers
// BullMQ worker
worker.on('completed', (job) => {
  const tracker = messageTracker.get(job.data.messageId);
  if (tracker) tracker.bullmqProcessed = true;
});

// RabbitMQ consumer
channel.consume('queue', (msg) => {
  const data = JSON.parse(msg.content.toString());
  const tracker = messageTracker.get(data.messageId);
  if (tracker) tracker.rabbitmqProcessed = true;
});

// Validation
setInterval(() => {
  for (const [id, tracker] of messageTracker.entries()) {
    if (tracker.bullmqProcessed !== tracker.rabbitmqProcessed) {
      console.error(`Mismatch for message ${id}:`, tracker);
    }
  }
}, 60000);
```

**3.2 Performance Testing**

```bash

# Load test RabbitMQ

npm run load-test -- --queue rabbitmq --messages 100000

# Compare latency

npm run benchmark -- --compare
```

**3.3 Failure Scenarios**

```bash

# Test RabbitMQ restart

docker-compose restart rabbitmq

# Verify messages are not lost

npm run verify-persistence
```

---

### Step 4: Cutover (Week 4)

**4.1 Stop Dual Publishing**

```javascript
// Change environment variable
process.env.QUEUE_TYPE = 'rabbitmq';

// Verify publishers are using RabbitMQ only
console.log('Queue type:', process.env.QUEUE_TYPE);
```

**4.2 Drain BullMQ Queue**

```javascript
// Stop accepting new jobs in BullMQ
await bullmqQueue.pause();

// Wait for all pending jobs to complete
while (await bullmqQueue.getWaitingCount() > 0) {
  console.log('Waiting for BullMQ queue to drain...');
  await new Promise(resolve => setTimeout(resolve, 10000));
}

// Verify queue is empty
const counts = await bullmqQueue.getJobCounts('waiting', 'active', 'delayed');
console.log('BullMQ job counts:', counts);
```

**4.3 Shutdown BullMQ Workers**

```bash

# Stop BullMQ workers

pkill -f "worker-bullmq"

# Or via Docker

docker-compose stop birthday-worker-bullmq
```

**4.4 Decommission Redis (Optional)**

```bash

# Backup Redis data (just in case)

docker exec redis redis-cli BGSAVE

# Stop Redis

docker-compose stop redis

# Remove Redis after 1 week of successful RabbitMQ operation

docker-compose rm redis
```

---

## 5. Dual-Run Strategy

### Architecture During Migration

```
                    ┌─────────────┐
                    │  Publisher  │
                    └──────┬──────┘
                           │
                ┌──────────┴──────────┐
                │                     │
         ┌──────▼──────┐      ┌──────▼──────┐
         │   BullMQ    │      │  RabbitMQ   │
         │   (Redis)   │      │   (AMQP)    │
         └──────┬──────┘      └──────┬──────┘
                │                     │
         ┌──────▼──────┐      ┌──────▼──────┐
         │  BullMQ     │      │  RabbitMQ   │
         │  Worker     │      │  Worker     │
         └─────────────┘      └─────────────┘
```

### Configuration

```javascript
// config/queue.js
module.exports = {
  mode: process.env.QUEUE_MODE || 'dual', // 'bullmq', 'rabbitmq', 'dual'

  bullmq: {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    },
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },
};
```

---

## 6. Rollback Plan

### If Issues Arise with RabbitMQ

**Immediate Rollback (< 5 minutes):**

```bash

# 1. Stop RabbitMQ publishers

export QUEUE_TYPE=bullmq

# 2. Restart BullMQ workers

docker-compose up -d birthday-worker-bullmq

# 3. Verify BullMQ is processing

npm run check-bullmq-health
```

**Data Recovery:**

```javascript
// If messages were published to RabbitMQ only during the issue:

// 1. Export messages from RabbitMQ
const messages = [];
channel.consume('birthday-messages', (msg) => {
  if (msg) {
    messages.push(JSON.parse(msg.content.toString()));
    channel.ack(msg);
  }
}, { noAck: false });

// 2. Re-publish to BullMQ
for (const message of messages) {
  await bullmqQueue.add('send-birthday', message);
}
```

---

## Migration Checklist

### Pre-Migration

- [ ] Document current BullMQ configuration
- [ ] Identify all queue names and job types
- [ ] Audit retry logic and delayed job patterns
- [ ] Set up RabbitMQ infrastructure
- [ ] Create abstraction layer for dual operation
- [ ] Write integration tests for RabbitMQ

### During Migration

- [ ] Enable dual publishing (write to both systems)
- [ ] Run parallel consumers (BullMQ + RabbitMQ)
- [ ] Monitor message delivery in both systems
- [ ] Compare performance metrics
- [ ] Test failure scenarios (restart, network issues)
- [ ] Validate data consistency

### Post-Migration

- [ ] Switch to RabbitMQ-only publishing
- [ ] Drain BullMQ queue
- [ ] Stop BullMQ workers
- [ ] Monitor RabbitMQ for 1 week
- [ ] Document RabbitMQ runbooks
- [ ] Decommission Redis/BullMQ infrastructure

---

## Key Differences to Remember

| Aspect | BullMQ | RabbitMQ |
|--------|--------|----------|
| **Message Format** | JavaScript object (auto-serialized) | Buffer (manual JSON.stringify/parse) |
| **Acknowledgment** | Automatic on success | Manual with `channel.ack(msg)` |
| **Retries** | Built-in with `attempts` | Manual implementation |
| **Delayed Jobs** | Built-in with `delay` | Plugin or TTL+DLX |
| **Job Progress** | Built-in `job.updateProgress()` | Must implement separately |
| **Persistence** | Depends on Redis config | Native with `durable: true` + `persistent: true` |
| **Monitoring** | Taskforce.sh or Bull Board | Management UI (built-in) |

---

## Support & Resources

- [RabbitMQ Official Tutorials](https://www.rabbitmq.com/getstarted.html)
- [amqplib Documentation](https://amqp-node.github.io/amqplib/)
- [BullMQ to RabbitMQ Migration Best Practices](https://medium.com/@vetonkaso/bullmq-vs-rabbitmq-choosing-the-right-queue-system-for-your-backend-cbe4d4f6f7a5)

---

**Migration Timeline Estimate:** 2-4 weeks
**Risk Level:** Medium (with dual-run strategy)
**Recommended Team Size:** 2-3 engineers

---

**Last Updated:** December 30, 2025
