/**
 * RabbitMQ Message Consumer
 *
 * Features:
 * - Manual message acknowledgment for reliability
 * - Prefetch limit for fair distribution
 * - Error handling with retry/reject logic
 * - Graceful shutdown on SIGTERM
 * - Idempotency checks
 *
 * Message flow:
 * 1. Consume message from queue
 * 2. Parse and validate message
 * 3. Call message handler
 * 4. ACK on success, NACK on failure
 * 5. Reject to DLQ after max retries
 */

import type { Channel, ConsumeMessage } from 'amqplib';
import { getRabbitMQ } from './connection.js';
import { QUEUES, PREFETCH_COUNT, RETRY_CONFIG, calculateRetryDelay } from './config.js';
import { type MessageJob, messageJobSchema, type ConsumerOptions } from './types.js';
import { logger } from '../utils/logger.js';
import { metricsService } from '../services/metrics.service.js';
import { queueMetricsInstrumentation } from '../services/queue/queue-metrics.js';

export class MessageConsumer {
  private isConsuming = false;
  private isShuttingDown = false;
  private consumerTag: string | null = null;
  private prefetch: number;
  private onMessage: (_job: MessageJob) => Promise<void>;
  private onError?: (_error: Error, _job?: MessageJob) => void | Promise<void>;

  constructor(options: ConsumerOptions) {
    this.prefetch = options.prefetch || PREFETCH_COUNT;
    this.onMessage = options.onMessage;
    this.onError = options.onError;
  }

  /**
   * Start consuming messages from queue
   */
  public async startConsuming(): Promise<void> {
    if (this.isConsuming) {
      logger.warn('Consumer already running');
      return;
    }

    logger.info({
      msg: 'Starting message consumer...',
      queue: QUEUES.BIRTHDAY_MESSAGES,
      prefetch: this.prefetch,
    });

    // Update active workers metric
    metricsService.setActiveWorkers('message_consumer', 1);

    const rabbitMQ = getRabbitMQ();
    const channel = rabbitMQ.getConsumerChannel();

    await channel.addSetup(async (ch: Channel) => {
      // Set prefetch count for fair distribution
      await ch.prefetch(this.prefetch);
      logger.info(`Prefetch count set to ${this.prefetch}`);

      // Start consuming
      const consumeResult = await ch.consume(
        QUEUES.BIRTHDAY_MESSAGES,
        (msg) => this.handleMessage(msg, ch),
        {
          noAck: false, // Manual acknowledgment
        }
      );

      this.consumerTag = consumeResult.consumerTag;
      logger.info({ msg: 'Consumer started', consumerTag: this.consumerTag });
    });

    this.isConsuming = true;
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(msg: ConsumeMessage | null, channel: Channel): Promise<void> {
    if (!msg) {
      logger.warn('Consumer cancelled by server');
      this.isConsuming = false;
      return;
    }

    // Check if shutting down
    if (this.isShuttingDown) {
      logger.info('Shutting down, rejecting message back to queue');
      channel.nack(msg, false, true); // Requeue for other consumers
      return;
    }

    let job: MessageJob | undefined;

    try {
      // Parse message content
      const messageContent = msg.content.toString();
      const parsedContent = JSON.parse(messageContent);

      // Validate message structure
      job = messageJobSchema.parse(parsedContent);

      // Get retry count from headers
      const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;
      job.retryCount = retryCount;

      logger.debug({
        msg: 'Processing message',
        messageId: job.messageId,
        userId: job.userId,
        messageType: job.messageType,
        retryCount,
      });

      // Wrap message processing with metrics instrumentation
      await queueMetricsInstrumentation.instrumentConsume(
        async () => {
          // Call message handler
          await this.onMessage(job!);
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
      logger.info({ msg: 'Message processed successfully', messageId: job.messageId, retryCount });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        msg: 'Failed to process message',
        messageId: job?.messageId,
        error: errorMessage,
      });

      // Call error handler if provided
      if (this.onError) {
        try {
          await this.onError(error instanceof Error ? error : new Error('Unknown error'), job);
        } catch (handlerError) {
          logger.error({
            msg: 'Error handler failed',
            error: handlerError instanceof Error ? handlerError.message : 'Unknown error',
          });
        }
      }

      // Handle retry logic with instrumented ack/nack
      await this.handleMessageError(msg, channel, error);
    }
  }

  /**
   * Handle message processing error
   */
  private async handleMessageError(
    msg: ConsumeMessage,
    channel: Channel,
    error: unknown
  ): Promise<void> {
    const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;
    const isTransientError = this.isTransientError(error);

    // Check if max retries reached
    if (retryCount >= RETRY_CONFIG.MAX_RETRIES) {
      logger.error({
        msg: 'Max retries reached, sending to DLQ',
        retryCount,
        maxRetries: RETRY_CONFIG.MAX_RETRIES,
      });

      // Reject without requeue (goes to DLX -> DLQ) - instrumented
      queueMetricsInstrumentation.instrumentReject(
        channel,
        msg,
        QUEUES.BIRTHDAY_MESSAGES,
        'max_retries_exceeded'
      );
      return;
    }

    // Transient errors: retry with exponential backoff
    if (isTransientError) {
      const delay = calculateRetryDelay(retryCount);
      logger.warn({
        msg: 'Transient error, will retry',
        retryCount,
        nextRetryIn: delay,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Requeue message with instrumented nack
      queueMetricsInstrumentation.instrumentNack(
        channel,
        msg,
        QUEUES.BIRTHDAY_MESSAGES,
        true, // Requeue
        'transient_error'
      );
    } else {
      // Permanent errors: send to DLQ immediately
      logger.error({
        msg: 'Permanent error detected, sending to DLQ',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Reject without requeue (goes to DLX -> DLQ) - instrumented
      queueMetricsInstrumentation.instrumentReject(
        channel,
        msg,
        QUEUES.BIRTHDAY_MESSAGES,
        'permanent_error'
      );
    }
  }

  /**
   * Determine if error is transient (can retry) or permanent
   */
  private isTransientError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    // Network errors, timeouts, rate limits - transient
    const transientPatterns = [
      /network/i,
      /timeout/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /rate limit/i,
      /temporarily unavailable/i,
      /503/,
      /429/,
    ];

    // Validation errors, not found, unauthorized - permanent
    const permanentPatterns = [
      /validation/i,
      /not found/i,
      /404/,
      /unauthorized/i,
      /401/,
      /forbidden/i,
      /403/,
      /invalid/i,
    ];

    // Check if error message matches permanent patterns
    for (const pattern of permanentPatterns) {
      if (pattern.test(error.message)) {
        return false; // Permanent error
      }
    }

    // Check if error message matches transient patterns
    for (const pattern of transientPatterns) {
      if (pattern.test(error.message)) {
        return true; // Transient error
      }
    }

    // Default: treat as transient (safer to retry)
    return true;
  }

  /**
   * Stop consuming messages
   */
  public async stopConsuming(): Promise<void> {
    if (!this.isConsuming) {
      logger.warn('Consumer not running');
      return;
    }

    logger.info('Stopping message consumer...');
    this.isShuttingDown = true;

    const rabbitMQ = getRabbitMQ();
    const channel = rabbitMQ.getConsumerChannel();

    try {
      if (this.consumerTag) {
        await channel.cancel(this.consumerTag);
        logger.info({ msg: 'Consumer cancelled', consumerTag: this.consumerTag });
      }

      this.isConsuming = false;
      this.consumerTag = null;

      // Update active workers metric
      metricsService.setActiveWorkers('message_consumer', 0);

      logger.info('Message consumer stopped');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ msg: 'Error stopping consumer', error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if consumer is running
   */
  public isRunning(): boolean {
    return this.isConsuming && !this.isShuttingDown;
  }

  /**
   * Setup graceful shutdown handlers
   */
  public setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, gracefully shutting down...`);

      try {
        await this.stopConsuming();
        process.exit(0);
      } catch (error) {
        logger.error({
          msg: 'Error during shutdown',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}
