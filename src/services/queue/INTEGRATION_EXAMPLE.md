/**
 * Queue Metrics Integration Example
 *
 * This file demonstrates how to integrate the QueueMetricsInstrumentation
 * with the existing RabbitMQ infrastructure. This is a reference implementation
 * showing the recommended integration patterns.
 *
 * DO NOT import this file directly in production code. Instead, apply these
 * patterns to the actual queue service files (connection.ts, publisher.ts, consumer.ts).
 */

import type { Channel, ConsumeMessage } from 'amqplib';
import { queueMetricsInstrumentation } from './queue-metrics.js';
import {
  RabbitMQConnection,
  MessagePublisher,
  MessageConsumer,
  type MessageJob,
  type ConsumerOptions,
  QUEUES,
  EXCHANGES,
  RETRY_CONFIG,
} from '../../queue/index.js';
import { logger } from '../../utils/logger.js';

// ============================================
// EXAMPLE 1: Enhanced RabbitMQ Connection
// ============================================

/**
 * Example: Enhancing RabbitMQConnection with metrics instrumentation
 *
 * This shows how to integrate connection and channel event tracking.
 * Apply this pattern to src/queue/connection.ts
 */
export class MetricsEnabledRabbitMQConnection extends RabbitMQConnection {
  public async connect(): Promise<void> {
    // Call parent connect
    await super.connect();

    // Get instrumentation handlers
    const handlers = queueMetricsInstrumentation.instrumentConnection('rabbitmq');

    // Get the connection instance (you'll need to expose this in RabbitMQConnection)
    const connection = (this as any).connection;

    // Add metrics handlers to connection events
    connection.on('connect', () => {
      handlers.onConnect();
    });

    connection.on('disconnect', () => {
      handlers.onDisconnect();
    });

    connection.on('connectFailed', () => {
      handlers.onConnectFailed();
    });

    // Instrument channels
    const publisherChannel = this.getPublisherChannel();
    const consumerChannel = this.getConsumerChannel();

    queueMetricsInstrumentation.instrumentChannel(publisherChannel, 'publisher');
    queueMetricsInstrumentation.instrumentChannel(consumerChannel, 'consumer');

    logger.info('RabbitMQ connection instrumented with metrics');
  }
}

// ============================================
// EXAMPLE 2: Enhanced Message Publisher
// ============================================

/**
 * Example: Enhancing MessagePublisher with metrics instrumentation
 *
 * This shows how to wrap publish operations with metrics.
 * Apply this pattern to src/queue/publisher.ts
 */
export class MetricsEnabledMessagePublisher extends MessagePublisher {
  /**
   * Publish message with metrics instrumentation
   */
  public async publishMessage(job: MessageJob, routingKey?: string): Promise<void> {
    // Determine actual routing key
    const actualRoutingKey =
      routingKey || (job.messageType === 'BIRTHDAY' ? 'birthday' : 'anniversary');

    // Wrap the parent publish method with instrumentation
    await queueMetricsInstrumentation.instrumentPublish(
      async () => {
        // Call parent publish method
        await super.publishMessage(job, routingKey);
      },
      EXCHANGES.BIRTHDAY_MESSAGES,
      actualRoutingKey,
      job.messageId
    );
  }

  /**
   * Get queue stats with metrics updates
   */
  public async getQueueStats(queueName: string): Promise<{
    messages: number;
    messagesReady: number;
    messagesUnacknowledged: number;
    consumers: number;
  }> {
    const stats = await super.getQueueStats(queueName);

    // Update metrics via instrumentation
    queueMetricsInstrumentation.updateQueueDepth(queueName, stats.messages);
    queueMetricsInstrumentation.updateConsumerCount(queueName, stats.consumers);

    return stats;
  }

  /**
   * Initialize with instrumented channel operations
   */
  public async initialize(): Promise<void> {
    // Wrap initialization channel operations with instrumentation
    await queueMetricsInstrumentation.instrumentChannelOperation('publisher_init', async () => {
      await super.initialize();
    });
  }
}

// ============================================
// EXAMPLE 3: Enhanced Message Consumer
// ============================================

/**
 * Example: Enhancing MessageConsumer with metrics instrumentation
 *
 * This shows how to instrument message consumption and acknowledgments.
 * Apply this pattern to src/queue/consumer.ts
 */
export class MetricsEnabledMessageConsumer extends MessageConsumer {
  private consumerTag: string | null = null;

  constructor(options: ConsumerOptions) {
    // Wrap the original onMessage handler with instrumentation
    const originalOnMessage = options.onMessage;
    const instrumentedOnMessage = async (job: MessageJob) => {
      // The actual instrumentation happens in handleMessage
      // This is just the business logic handler
      return originalOnMessage(job);
    };

    super({
      ...options,
      onMessage: instrumentedOnMessage,
    });
  }

  /**
   * Handle message with full instrumentation
   *
   * This method shows the complete pattern for instrumenting consumption,
   * including ack/nack/reject tracking.
   */
  private async handleMessageWithMetrics(msg: ConsumeMessage, channel: Channel): Promise<void> {
    if (!msg) {
      logger.warn('Consumer cancelled by server');
      return;
    }

    const messageId = msg.properties.messageId as string;
    const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;

    try {
      // Parse and validate message
      const messageContent = msg.content.toString();
      const parsedContent = JSON.parse(messageContent);

      // Instrument the consumption
      await queueMetricsInstrumentation.instrumentConsume(
        async () => {
          // Call the original message handler
          // In actual implementation, this would call this.onMessage
          await this.processMessageJob(parsedContent);
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

      logger.info({ messageId, retryCount }, 'Message processed and acknowledged');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ messageId, error: errorMessage }, 'Message processing failed');

      // Determine if error is transient or permanent
      const isTransientError = this.isTransientError(error);

      // Handle retry logic with instrumented ack/nack
      if (retryCount >= RETRY_CONFIG.MAX_RETRIES) {
        // Max retries exceeded - reject to DLQ
        queueMetricsInstrumentation.instrumentReject(
          channel,
          msg,
          QUEUES.BIRTHDAY_MESSAGES,
          'max_retries_exceeded'
        );
        logger.error({ messageId, retryCount }, 'Max retries exceeded, sent to DLQ');
      } else if (isTransientError) {
        // Transient error - requeue for retry
        queueMetricsInstrumentation.instrumentNack(
          channel,
          msg,
          QUEUES.BIRTHDAY_MESSAGES,
          true, // requeue
          'transient_error'
        );
        logger.warn({ messageId, retryCount }, 'Transient error, requeuing message');
      } else {
        // Permanent error - reject to DLQ
        queueMetricsInstrumentation.instrumentReject(
          channel,
          msg,
          QUEUES.BIRTHDAY_MESSAGES,
          'permanent_error'
        );
        logger.error({ messageId }, 'Permanent error, sent to DLQ');
      }
    }
  }

  /**
   * Helper to process message job
   */
  private async processMessageJob(job: MessageJob): Promise<void> {
    // Actual message processing logic
    // In real implementation, this calls the user-provided onMessage handler
    logger.debug({ messageId: job.messageId }, 'Processing message job');
  }

  /**
   * Determine if error is transient
   */
  private isTransientError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const transientPatterns = [
      /network/i,
      /timeout/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /rate limit/i,
      /503/,
      /429/,
    ];

    return transientPatterns.some((pattern) => pattern.test(error.message));
  }
}

// ============================================
// EXAMPLE 4: Application Initialization
// ============================================

/**
 * Example: Complete application initialization with metrics
 *
 * This shows how to initialize everything in the correct order.
 * Apply this pattern to your application startup (e.g., src/app.ts or src/worker.ts)
 */
export async function initializeQueueWithMetrics(): Promise<{
  connection: MetricsEnabledRabbitMQConnection;
  publisher: MetricsEnabledMessagePublisher;
  consumer: MetricsEnabledMessageConsumer;
}> {
  logger.info('Initializing queue infrastructure with metrics...');

  // 1. Initialize metrics instrumentation first
  await queueMetricsInstrumentation.initialize();
  logger.info('Queue metrics instrumentation initialized');

  // 2. Initialize and connect to RabbitMQ
  const connection = new MetricsEnabledRabbitMQConnection({
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    heartbeat: 60,
    reconnectTimeout: 5000,
  });

  await connection.connect();
  logger.info('RabbitMQ connection established with metrics');

  // 3. Initialize publisher
  const publisher = new MetricsEnabledMessagePublisher();
  await publisher.initialize();
  logger.info('Message publisher initialized with metrics');

  // 4. Initialize consumer (if this is a worker process)
  const consumer = new MetricsEnabledMessageConsumer({
    prefetch: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    onMessage: async (job: MessageJob) => {
      // Your message processing logic here
      logger.info({ messageId: job.messageId }, 'Processing message');
      // ... actual processing ...
    },
    onError: async (error: Error, job?: MessageJob) => {
      logger.error(
        {
          messageId: job?.messageId,
          error: error.message,
        },
        'Message processing error'
      );
    },
  });

  await consumer.startConsuming();
  logger.info('Message consumer started with metrics');

  // 5. Start periodic queue stats monitoring
  startQueueMonitoring(publisher);

  // 6. Setup graceful shutdown
  setupGracefulShutdown(connection, publisher, consumer);

  return { connection, publisher, consumer };
}

/**
 * Start periodic queue stats monitoring
 */
function startQueueMonitoring(publisher: MetricsEnabledMessagePublisher): void {
  const interval = parseInt(process.env.QUEUE_STATS_INTERVAL || '30000', 10);

  setInterval(async () => {
    try {
      await publisher.getQueueStats(QUEUES.BIRTHDAY_MESSAGES);
      await publisher.getQueueStats(QUEUES.BIRTHDAY_DLQ);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to update queue stats'
      );
    }
  }, interval);

  logger.info({ intervalMs: interval }, 'Queue stats monitoring started');
}

/**
 * Setup graceful shutdown for all components
 */
function setupGracefulShutdown(
  connection: MetricsEnabledRabbitMQConnection,
  publisher: MetricsEnabledMessagePublisher,
  consumer: MetricsEnabledMessageConsumer
): void {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown initiated');

    try {
      // 1. Stop consuming new messages
      logger.info('Stopping message consumer...');
      await consumer.stopConsuming();

      // 2. Wait for in-flight messages to complete (optional)
      logger.info('Waiting for in-flight messages...');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 3. Close RabbitMQ connection
      logger.info('Closing RabbitMQ connection...');
      await connection.close();

      // 4. Shutdown metrics instrumentation
      logger.info('Shutting down metrics instrumentation...');
      await queueMetricsInstrumentation.shutdown();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Error during shutdown'
      );
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ============================================
// EXAMPLE 5: Minimal Integration (Drop-in)
// ============================================

/**
 * Minimal integration example without extending classes
 *
 * This shows how to add metrics to existing queue operations with minimal code changes.
 * Useful if you can't or don't want to extend the queue classes.
 */
export async function publishMessageWithMetrics(
  publisher: MessagePublisher,
  job: MessageJob
): Promise<void> {
  const routingKey = job.messageType === 'BIRTHDAY' ? 'birthday' : 'anniversary';

  await queueMetricsInstrumentation.instrumentPublish(
    () => publisher.publishMessage(job, routingKey),
    EXCHANGES.BIRTHDAY_MESSAGES,
    routingKey,
    job.messageId
  );
}

/**
 * Minimal integration for message handling
 */
export async function handleMessageWithMetrics(
  handler: (job: MessageJob) => Promise<void>,
  msg: ConsumeMessage,
  channel: Channel
): Promise<void> {
  const messageId = msg.properties.messageId as string;

  try {
    await queueMetricsInstrumentation.instrumentConsume(
      async () => {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
      },
      msg,
      QUEUES.BIRTHDAY_MESSAGES
    );

    queueMetricsInstrumentation.instrumentAck(channel, msg, QUEUES.BIRTHDAY_MESSAGES);
  } catch (error) {
    const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;

    if (retryCount >= RETRY_CONFIG.MAX_RETRIES) {
      queueMetricsInstrumentation.instrumentReject(
        channel,
        msg,
        QUEUES.BIRTHDAY_MESSAGES,
        'max_retries'
      );
    } else {
      queueMetricsInstrumentation.instrumentNack(
        channel,
        msg,
        QUEUES.BIRTHDAY_MESSAGES,
        true,
        'retry'
      );
    }

    throw error;
  }
}

// ============================================
// EXAMPLE 6: Testing with Metrics
// ============================================

/**
 * Example test showing how to verify metrics instrumentation
 */
export async function exampleTest(): Promise<void> {
  // Initialize instrumentation (disable auto-monitoring in tests)
  const testInstrumentation = new (await import('./queue-metrics.js')).QueueMetricsInstrumentation(
    {
      queueDepthInterval: 0,
      trackConsumerCount: true,
      trackConnectionStatus: true,
      trackMessageDetails: true,
    }
  );

  await testInstrumentation.initialize();

  try {
    // Test publish instrumentation
    let publishCalled = false;
    await testInstrumentation.instrumentPublish(
      async () => {
        publishCalled = true;
      },
      'test-exchange',
      'test-key',
      'test-msg-id'
    );

    if (!publishCalled) {
      throw new Error('Publish function not called');
    }

    logger.info('Metrics instrumentation test passed');
  } finally {
    await testInstrumentation.shutdown();
  }
}
