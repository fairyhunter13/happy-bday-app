# RabbitMQ Implementation Guide for Birthday Scheduler

**Quick Start Guide for Production Deployment**

---

## Table of Contents

1. [Docker Compose Setup](#1-docker-compose-setup)
2. [Node.js Publisher Implementation](#2-nodejs-publisher-implementation)
3. [Node.js Consumer Implementation](#3-nodejs-consumer-implementation)
4. [Error Handling & Retry Logic](#4-error-handling--retry-logic)
5. [Monitoring & Health Checks](#5-monitoring--health-checks)
6. [Production Checklist](#6-production-checklist)

---

## 1. Docker Compose Setup

### docker-compose.yml

```yaml
version: '3.8'

services:
  # RabbitMQ with Management Plugin
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: birthday-rabbitmq
    hostname: rabbitmq-prod

    ports:
      - "5672:5672"    # AMQP protocol
      - "15672:15672"  # Management UI

    environment:
      # Authentication
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-admin}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-changeme}

      # Virtual host
      RABBITMQ_DEFAULT_VHOST: birthday-app

      # Memory management
      RABBITMQ_VM_MEMORY_HIGH_WATERMARK: 0.6
      RABBITMQ_VM_MEMORY_HIGH_WATERMARK_PAGING_RATIO: 0.75

      # Disk free limit (2GB minimum)
      RABBITMQ_DISK_FREE_LIMIT: 2147483648

    volumes:
      # Persistent data
      - rabbitmq_data:/var/lib/rabbitmq
      - rabbitmq_logs:/var/log/rabbitmq

      # Custom configuration
      - ./config/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
      - ./config/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro

    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 40s

    restart: unless-stopped

    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'

    networks:
      - birthday-network

  # Your Node.js application (example)
  birthday-publisher:
    build: .
    container_name: birthday-publisher
    depends_on:
      rabbitmq:
        condition: service_healthy
    environment:
      RABBITMQ_URL: amqp://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD:-changeme}@rabbitmq:5672/birthday-app
      NODE_ENV: production
    volumes:
      - ./src:/app/src
    networks:
      - birthday-network

  # Worker service
  birthday-worker:
    build: .
    container_name: birthday-worker
    depends_on:
      rabbitmq:
        condition: service_healthy
    environment:
      RABBITMQ_URL: amqp://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD:-changeme}@rabbitmq:5672/birthday-app
      NODE_ENV: production
      WORKER_CONCURRENCY: 10
    command: npm run worker
    volumes:
      - ./src:/app/src
    networks:
      - birthday-network
    deploy:
      replicas: 2  # Run 2 workers for redundancy

volumes:
  rabbitmq_data:
    driver: local
  rabbitmq_logs:
    driver: local

networks:
  birthday-network:
    driver: bridge
```

### config/rabbitmq.conf

```conf

## RabbitMQ Configuration for Birthday Scheduler

## Networking

listeners.tcp.default = 5672
management.tcp.port = 15672

## Clustering (for multi-node setup)

cluster_formation.peer_discovery_backend = rabbit_peer_discovery_classic_config

## Memory Management

vm_memory_high_watermark.relative = 0.6
vm_memory_high_watermark_paging_ratio = 0.75

## Disk Space

disk_free_limit.absolute = 2GB

## Performance

channel_max = 2048
heartbeat = 60
frame_max = 131072

## Logging

log.console = true
log.console.level = info
log.file.level = info

## Management Plugin

management.load_definitions = /etc/rabbitmq/definitions.json
```

### config/enabled_plugins

```json
[rabbitmq_management,rabbitmq_prometheus].
```

### config/definitions.json

```json
{
  "rabbit_version": "3.13.0",
  "users": [],
  "vhosts": [
    {
      "name": "birthday-app"
    }
  ],
  "permissions": [
    {
      "user": "admin",
      "vhost": "birthday-app",
      "configure": ".*",
      "write": ".*",
      "read": ".*"
    }
  ],
  "queues": [
    {
      "name": "birthday-messages",
      "vhost": "birthday-app",
      "durable": true,
      "auto_delete": false,
      "arguments": {
        "x-queue-type": "quorum",
        "x-quorum-initial-group-size": 3,
        "x-dead-letter-exchange": "birthday-dlx"
      }
    },
    {
      "name": "birthday-dlq",
      "vhost": "birthday-app",
      "durable": true,
      "auto_delete": false,
      "arguments": {
        "x-queue-type": "quorum"
      }
    }
  ],
  "exchanges": [
    {
      "name": "birthday-dlx",
      "vhost": "birthday-app",
      "type": "direct",
      "durable": true,
      "auto_delete": false
    }
  ],
  "bindings": [
    {
      "source": "birthday-dlx",
      "vhost": "birthday-app",
      "destination": "birthday-dlq",
      "destination_type": "queue",
      "routing_key": "birthday-messages"
    }
  ]
}
```

### .env

```env
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=your-super-secret-password-here
```

---

## 2. Node.js Publisher Implementation

### package.json

```json
{
  "name": "birthday-scheduler",
  "version": "1.0.0",
  "dependencies": {
    "amqplib": "^0.10.3",
    "dotenv": "^16.3.1"
  },
  "scripts": {
    "publisher": "node src/publisher.js",
    "worker": "node src/worker.js"
  }
}
```

### src/rabbitmq/connection.js

```javascript
const amqp = require('amqplib');

class RabbitMQConnection {
  constructor(url) {
    this.url = url;
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      // Create connection with retry logic
      this.connection = await amqp.connect(this.url, {
        heartbeat: 60,
        // Connection recovery
        connectionTimeout: 10000,
      });

      // Handle connection events
      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
      });

      this.connection.on('close', () => {
        console.log('RabbitMQ connection closed');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connect(), 5000);
      });

      // Create channel
      this.channel = await this.connection.createChannel();

      // Enable publisher confirms
      await this.channel.confirmSelect();

      // Handle channel events
      this.channel.on('error', (err) => {
        console.error('RabbitMQ channel error:', err);
      });

      this.channel.on('close', () => {
        console.log('RabbitMQ channel closed');
      });

      console.log('Connected to RabbitMQ successfully');
      return this.channel;
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      // Retry after 5 seconds
      setTimeout(() => this.connect(), 5000);
      throw error;
    }
  }

  async close() {
    try {
      await this.channel?.close();
      await this.connection?.close();
      console.log('RabbitMQ connection closed gracefully');
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }

  getChannel() {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }
    return this.channel;
  }
}

module.exports = RabbitMQConnection;
```

### src/publisher.js

```javascript
require('dotenv').config();
const RabbitMQConnection = require('./rabbitmq/connection');

const QUEUE_NAME = 'birthday-messages';

class BirthdayPublisher {
  constructor(rabbitmqUrl) {
    this.rabbitmq = new RabbitMQConnection(rabbitmqUrl);
  }

  async initialize() {
    await this.rabbitmq.connect();
    const channel = this.rabbitmq.getChannel();

    // Assert queue (idempotent operation)
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-quorum-initial-group-size': 3,
        // Dead letter exchange for failed messages
        'x-dead-letter-exchange': 'birthday-dlx',
      },
    });

    console.log(`Queue "${QUEUE_NAME}" is ready`);
  }

  async scheduleBirthdayMessage(userId, birthday) {
    const channel = this.rabbitmq.getChannel();

    const message = {
      userId,
      birthday,
      scheduledAt: new Date().toISOString(),
      messageId: `${userId}-${Date.now()}`,
    };

    const messageBuffer = Buffer.from(JSON.stringify(message));

    try {
      // Send persistent message with confirmation
      channel.sendToQueue(QUEUE_NAME, messageBuffer, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        messageId: message.messageId,
        headers: {
          'x-retry-count': 0,
        },
      });

      // Wait for broker confirmation
      await channel.waitForConfirms();

      console.log(`Birthday message published for user ${userId}:`, message.messageId);
      return message.messageId;
    } catch (error) {
      console.error('Failed to publish message:', error);
      throw error;
    }
  }

  async publishBatch(users) {
    const results = [];

    for (const user of users) {
      try {
        const messageId = await this.scheduleBirthdayMessage(
          user.id,
          user.birthday
        );
        results.push({ userId: user.id, messageId, success: true });
      } catch (error) {
        results.push({ userId: user.id, error: error.message, success: false });
      }
    }

    return results;
  }

  async close() {
    await this.rabbitmq.close();
  }
}

// Example usage
async function main() {
  const publisher = new BirthdayPublisher(process.env.RABBITMQ_URL);

  try {
    await publisher.initialize();

    // Example: Schedule birthday messages
    const users = [
      { id: 1, birthday: '1990-12-30' },
      { id: 2, birthday: '1985-01-15' },
      { id: 3, birthday: '1992-03-22' },
    ];

    const results = await publisher.publishBatch(users);
    console.log('Batch publish results:', results);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down publisher...');
      await publisher.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Shutting down publisher...');
      await publisher.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('Publisher error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = BirthdayPublisher;
```

---

## 3. Node.js Consumer Implementation

### src/worker.js

```javascript
require('dotenv').config();
const RabbitMQConnection = require('./rabbitmq/connection');

const QUEUE_NAME = 'birthday-messages';
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '10', 10);
const MAX_RETRIES = 3;

class BirthdayWorker {
  constructor(rabbitmqUrl) {
    this.rabbitmq = new RabbitMQConnection(rabbitmqUrl);
    this.isShuttingDown = false;
  }

  async initialize() {
    await this.rabbitmq.connect();
    const channel = this.rabbitmq.getChannel();

    // Assert queue
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-quorum-initial-group-size': 3,
        'x-dead-letter-exchange': 'birthday-dlx',
      },
    });

    // Set prefetch count for fair distribution
    await channel.prefetch(CONCURRENCY);

    console.log(`Worker initialized. Concurrency: ${CONCURRENCY}`);
  }

  async startConsuming() {
    const channel = this.rabbitmq.getChannel();

    await channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) {
          console.log('Consumer cancelled by server');
          return;
        }

        try {
          await this.processMessage(msg);
        } catch (error) {
          console.error('Error in message processing:', error);
        }
      },
      {
        noAck: false, // Manual acknowledgment
      }
    );

    console.log(`Worker started. Waiting for messages in "${QUEUE_NAME}"...`);
  }

  async processMessage(msg) {
    const channel = this.rabbitmq.getChannel();

    try {
      // Parse message
      const message = JSON.parse(msg.content.toString());
      console.log('Processing message:', message.messageId);

      // Simulate birthday email sending
      await this.sendBirthdayEmail(message);

      // Acknowledge successful processing
      channel.ack(msg);
      console.log(`Message ${message.messageId} processed successfully`);
    } catch (error) {
      console.error('Failed to process message:', error);

      // Get retry count
      const retryCount = msg.properties.headers['x-retry-count'] || 0;

      if (retryCount < MAX_RETRIES) {
        // Requeue with incremented retry count
        console.log(`Retrying message (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        // Reject and requeue
        channel.nack(msg, false, true);

        // Update retry count (this requires republishing)
        // For simplicity, we rely on the dead letter queue after max retries
      } else {
        // Max retries reached - send to dead letter queue
        console.error(`Max retries reached for message. Sending to DLQ.`);
        channel.nack(msg, false, false); // Don't requeue - goes to DLX
      }
    }
  }

  async sendBirthdayEmail(message) {
    // Simulate email sending
    console.log(`Sending birthday email to user ${message.userId}`);

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate random failures for testing
    if (Math.random() < 0.1) {
      throw new Error('Email service temporarily unavailable');
    }

    console.log(`Birthday email sent to user ${message.userId}`);
  }

  async close() {
    this.isShuttingDown = true;
    console.log('Stopping worker...');
    await this.rabbitmq.close();
  }
}

// Main
async function main() {
  const worker = new BirthdayWorker(process.env.RABBITMQ_URL);

  try {
    await worker.initialize();
    await worker.startConsuming();

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Received shutdown signal');
      await worker.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Worker error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = BirthdayWorker;
```

---

## 4. Error Handling & Retry Logic

### src/rabbitmq/retry-publisher.js

```javascript
const amqp = require('amqplib');

class RetryPublisher {
  constructor(channel) {
    this.channel = channel;
  }

  async publishWithRetry(queue, message, options = {}, maxRetries = 3) {
    const messageBuffer = Buffer.from(JSON.stringify(message));
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.channel.sendToQueue(queue, messageBuffer, {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
          headers: {
            'x-retry-count': attempt,
          },
          ...options,
        });

        await this.channel.waitForConfirms();
        console.log(`Message published successfully on attempt ${attempt + 1}`);
        return true;
      } catch (error) {
        lastError = error;
        console.error(`Publish attempt ${attempt + 1} failed:`, error.message);

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to publish message after ${maxRetries} attempts: ${lastError.message}`
    );
  }
}

module.exports = RetryPublisher;
```

### src/rabbitmq/delayed-retry.js

```javascript
// Advanced retry with delayed requeue
class DelayedRetryConsumer {
  constructor(channel, queueName) {
    this.channel = channel;
    this.queueName = queueName;
  }

  async setupDelayedRetry() {
    // Create a delayed retry exchange and queue
    const delayedExchange = `${this.queueName}-delayed`;
    const delayedQueue = `${this.queueName}-delayed-queue`;

    await this.channel.assertExchange(delayedExchange, 'x-delayed-message', {
      durable: true,
      arguments: {
        'x-delayed-type': 'direct',
      },
    });

    await this.channel.assertQueue(delayedQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': this.queueName,
      },
    });

    await this.channel.bindQueue(delayedQueue, delayedExchange, 'delayed');
  }

  async requeueWithDelay(msg, delay = 5000) {
    const retryCount = msg.properties.headers['x-retry-count'] || 0;

    if (retryCount >= 3) {
      // Send to DLQ
      this.channel.nack(msg, false, false);
      return;
    }

    // Publish to delayed exchange
    this.channel.publish(
      `${this.queueName}-delayed`,
      'delayed',
      msg.content,
      {
        persistent: true,
        headers: {
          'x-delay': delay,
          'x-retry-count': retryCount + 1,
        },
      }
    );

    // Ack original message
    this.channel.ack(msg);
  }
}

module.exports = DelayedRetryConsumer;
```

---

## 5. Monitoring & Health Checks

### src/monitoring/health-check.js

```javascript
const amqp = require('amqplib');

async function checkRabbitMQHealth(url) {
  try {
    const connection = await amqp.connect(url, {
      connectionTimeout: 5000,
    });

    const channel = await connection.createChannel();

    // Try to assert a test queue
    await channel.assertQueue('health-check', {
      durable: false,
      autoDelete: true,
    });

    // Clean up
    await channel.deleteQueue('health-check');
    await channel.close();
    await connection.close();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// Express health endpoint example
function setupHealthEndpoint(app, rabbitmqUrl) {
  app.get('/health', async (req, res) => {
    const health = await checkRabbitMQHealth(rabbitmqUrl);

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });
}

module.exports = { checkRabbitMQHealth, setupHealthEndpoint };
```

### src/monitoring/metrics.js

```javascript
const axios = require('axios');

class RabbitMQMetrics {
  constructor(managementUrl, username, password) {
    this.baseUrl = managementUrl;
    this.auth = {
      username,
      password,
    };
  }

  async getQueueMetrics(queueName, vhost = 'birthday-app') {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/queues/${encodeURIComponent(vhost)}/${queueName}`,
        { auth: this.auth }
      );

      return {
        messages: response.data.messages,
        messagesReady: response.data.messages_ready,
        messagesUnacknowledged: response.data.messages_unacknowledged,
        consumers: response.data.consumers,
        messageStats: response.data.message_stats,
      };
    } catch (error) {
      console.error('Failed to fetch queue metrics:', error.message);
      return null;
    }
  }

  async getNodeMetrics() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/nodes`, {
        auth: this.auth,
      });

      return response.data.map((node) => ({
        name: node.name,
        running: node.running,
        memUsed: node.mem_used,
        memLimit: node.mem_limit,
        diskFree: node.disk_free,
        diskFreeLimit: node.disk_free_limit,
        fdUsed: node.fd_used,
        fdTotal: node.fd_total,
      }));
    } catch (error) {
      console.error('Failed to fetch node metrics:', error.message);
      return null;
    }
  }

  async logMetrics() {
    console.log('\n--- RabbitMQ Metrics ---');

    const queueMetrics = await this.getQueueMetrics('birthday-messages');
    if (queueMetrics) {
      console.log('Queue "birthday-messages":');
      console.log(`  Total messages: ${queueMetrics.messages}`);
      console.log(`  Ready: ${queueMetrics.messagesReady}`);
      console.log(`  Unacknowledged: ${queueMetrics.messagesUnacknowledged}`);
      console.log(`  Consumers: ${queueMetrics.consumers}`);
    }

    const nodeMetrics = await this.getNodeMetrics();
    if (nodeMetrics) {
      nodeMetrics.forEach((node) => {
        console.log(`\nNode: ${node.name}`);
        console.log(`  Running: ${node.running}`);
        console.log(
          `  Memory: ${(node.memUsed / 1024 / 1024).toFixed(2)} MB / ${(node.memLimit / 1024 / 1024).toFixed(2)} MB`
        );
        console.log(
          `  Disk Free: ${(node.diskFree / 1024 / 1024 / 1024).toFixed(2)} GB`
        );
      });
    }

    console.log('------------------------\n');
  }
}

// Example usage
async function main() {
  const metrics = new RabbitMQMetrics(
    'http://localhost:15672',
    process.env.RABBITMQ_USER || 'admin',
    process.env.RABBITMQ_PASSWORD || 'changeme'
  );

  // Log metrics every 30 seconds
  setInterval(() => metrics.logMetrics(), 30000);
}

module.exports = RabbitMQMetrics;
```

---

## 6. Production Checklist

### Pre-Deployment

- [ ] Set strong passwords in `.env` (never commit to git)
- [ ] Configure TLS/SSL for RabbitMQ connections
- [ ] Set up monitoring (Prometheus + Grafana or CloudWatch)
- [ ] Configure log aggregation (e.g., ELK stack, CloudWatch Logs)
- [ ] Test connection recovery and reconnection logic
- [ ] Load test with 10x expected peak load
- [ ] Document disaster recovery procedures

### Deployment

- [ ] Deploy RabbitMQ cluster (3 nodes minimum for quorum queues)
- [ ] Verify quorum queue replication
- [ ] Test publisher confirms functionality
- [ ] Test dead letter queue routing
- [ ] Deploy multiple worker instances
- [ ] Verify health check endpoints
- [ ] Set up alerting for:
  - Queue depth > 10,000 messages
  - Memory usage > 80%
  - Disk free < 5 GB
  - Consumer count = 0 (no workers)

### Post-Deployment

- [ ] Monitor message processing rate
- [ ] Review dead letter queue for failures
- [ ] Check memory and disk usage trends
- [ ] Verify message persistence (test broker restart)
- [ ] Document runbooks for common issues
- [ ] Schedule regular backups of definitions

### Monitoring Queries

```bash

# Check queue depth

rabbitmqctl list_queues name messages messages_ready messages_unacknowledged

# Check consumers

rabbitmqctl list_queues name consumers

# Check node status

rabbitmqctl cluster_status

# Check memory

rabbitmqctl status | grep memory

# Export definitions (backup)

rabbitmqctl export_definitions /backup/definitions-$(date +%Y%m%d).json
```

---

## Quick Start Commands

```bash

# Start RabbitMQ

docker-compose up -d rabbitmq

# Check logs

docker-compose logs -f rabbitmq

# Access management UI

open http://localhost:15672

# Login: admin / changeme

# Run publisher

npm run publisher

# Run worker

npm run worker

# Scale workers

docker-compose up -d --scale birthday-worker=5

# Stop all services

docker-compose down

# Stop and remove volumes (CAUTION: deletes data)

docker-compose down -v
```

---

## Troubleshooting

### Connection Refused

```bash

# Check if RabbitMQ is running

docker-compose ps

# Check RabbitMQ logs

docker-compose logs rabbitmq

# Test connection

telnet localhost 5672
```

### Messages Not Being Consumed

```bash

# Check consumers

rabbitmqctl list_queues name consumers

# Check if queue is paused

rabbitmqctl list_queues name state
```

### High Memory Usage

```bash

# Check memory breakdown

rabbitmqctl status | grep memory

# Force garbage collection

rabbitmqctl eval 'garbage_collect().'
```

### Dead Letter Queue Filling Up

```bash

# Check DLQ

rabbitmqctl list_queues name messages | grep dlq

# Inspect messages (via Management UI)
# Navigate to Queues > birthday-dlq > Get Messages

```

---

## Additional Resources

- [RabbitMQ Official Docs](https://www.rabbitmq.com/docs)
- [amqplib Documentation](https://amqp-node.github.io/amqplib/)
- [RabbitMQ Production Checklist](https://www.rabbitmq.com/docs/production-checklist)
- [RabbitMQ Monitoring Guide](https://www.rabbitmq.com/docs/monitoring)

---

**Last Updated:** December 30, 2025
