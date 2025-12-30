/**
 * RabbitMQ Message Publisher
 *
 * Features:
 * - Reliable message publishing with publisher confirms
 * - Message persistence (deliveryMode: 2)
 * - Error handling and retry logic
 * - Message validation before publishing
 * - Automatic queue/exchange setup
 *
 * Usage:
 *   const publisher = new MessagePublisher();
 *   await publisher.initialize();
 *   await publisher.publishMessage(job);
 */

import type { Channel } from 'amqplib';
import { getRabbitMQ } from './connection.js';
import { EXCHANGES, ROUTING_KEYS, PUBLISHER_OPTIONS, QUEUE_TOPOLOGY } from './config.js';
import { type MessageJob, messageJobSchema } from './types.js';
import { logger } from '../utils/logger.js';
import { metricsService } from '../services/metrics.service.js';

export class MessagePublisher {
  private isInitialized = false;

  /**
   * Initialize publisher (setup exchanges, queues, bindings)
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('MessagePublisher already initialized');
      return;
    }

    logger.info('Initializing MessagePublisher...');

    const rabbitMQ = getRabbitMQ();
    const channel = rabbitMQ.getPublisherChannel();

    await channel.addSetup(async (ch: Channel) => {
      // Setup exchanges
      for (const exchange of QUEUE_TOPOLOGY.exchanges) {
        await ch.assertExchange(exchange.name, exchange.type, exchange.options);
        logger.info(`Exchange "${exchange.name}" (${exchange.type}) asserted`);
      }

      // Setup queues
      for (const queue of QUEUE_TOPOLOGY.queues) {
        await ch.assertQueue(queue.name, queue.options);
        logger.info(`Queue "${queue.name}" asserted`);
      }

      // Setup bindings
      for (const binding of QUEUE_TOPOLOGY.bindings) {
        await ch.bindQueue(binding.queue, binding.exchange, binding.routingKey);
        logger.info(
          `Binding created: ${binding.queue} <- ${binding.exchange} (${binding.routingKey})`
        );
      }
    });

    this.isInitialized = true;
    logger.info('MessagePublisher initialized successfully');
  }

  /**
   * Publish message to queue
   *
   * @param job - Message job to publish
   * @param routingKey - Optional routing key (defaults to message type)
   * @returns Promise<void>
   * @throws Error if publishing fails
   */
  public async publishMessage(job: MessageJob, routingKey?: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MessagePublisher not initialized. Call initialize() first.');
    }

    // Validate message job
    const validatedJob = messageJobSchema.parse(job);

    // Determine routing key based on message type
    const actualRoutingKey =
      routingKey ||
      (validatedJob.messageType === 'BIRTHDAY' ? ROUTING_KEYS.BIRTHDAY : ROUTING_KEYS.ANNIVERSARY);

    logger.debug('Publishing message', {
      messageId: validatedJob.messageId,
      userId: validatedJob.userId,
      messageType: validatedJob.messageType,
      routingKey: actualRoutingKey,
    });

    const rabbitMQ = getRabbitMQ();
    const channel = rabbitMQ.getPublisherChannel();

    try {
      // Serialize message
      const messageBuffer = Buffer.from(JSON.stringify(validatedJob));

      // Publish with confirmation
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

      logger.info('Message published successfully', {
        messageId: validatedJob.messageId,
        exchange: EXCHANGES.BIRTHDAY_MESSAGES,
        routingKey: actualRoutingKey,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to publish message', {
        messageId: validatedJob.messageId,
        error: errorMessage,
      });
      throw new Error(`Failed to publish message: ${errorMessage}`);
    }
  }

  /**
   * Publish batch of messages
   *
   * @param jobs - Array of message jobs
   * @returns Array of results (success/failure per message)
   */
  public async publishBatch(
    jobs: MessageJob[]
  ): Promise<Array<{ messageId: string; success: boolean; error?: string }>> {
    const results: Array<{ messageId: string; success: boolean; error?: string }> = [];

    for (const job of jobs) {
      try {
        await this.publishMessage(job);
        results.push({ messageId: job.messageId, success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          messageId: job.messageId,
          success: false,
          error: errorMessage,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    logger.info('Batch publish completed', {
      total: jobs.length,
      success: successCount,
      failed: failureCount,
    });

    return results;
  }

  /**
   * Publish message with retry logic
   *
   * @param job - Message job to publish
   * @param maxRetries - Maximum number of retry attempts
   * @param retryDelay - Delay between retries in milliseconds
   */
  public async publishWithRetry(job: MessageJob, maxRetries = 3, retryDelay = 1000): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.publishMessage(job);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn('Publish attempt failed', {
          messageId: job.messageId,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          error: lastError.message,
        });

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    throw new Error(
      `Failed to publish message after ${maxRetries + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats(queueName: string): Promise<{
    messages: number;
    messagesReady: number;
    messagesUnacknowledged: number;
    consumers: number;
  }> {
    const rabbitMQ = getRabbitMQ();
    const channel = rabbitMQ.getPublisherChannel();

    try {
      const result = await channel.checkQueue(queueName);

      // Update metrics
      metricsService.setQueueDepth(queueName, result.messageCount);

      return {
        messages: result.messageCount,
        messagesReady: result.messageCount,
        messagesUnacknowledged: 0, // Not available via checkQueue
        consumers: result.consumerCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get queue stats', { queueName, error: errorMessage });
      throw error;
    }
  }

  /**
   * Update queue metrics periodically
   */
  public async updateQueueMetrics(queueName: string): Promise<void> {
    try {
      await this.getQueueStats(queueName);
    } catch (error) {
      logger.error(
        { queueName, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to update queue metrics'
      );
    }
  }
}
