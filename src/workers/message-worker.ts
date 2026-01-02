/**
 * Message Worker
 *
 * Processes messages from RabbitMQ queue:
 * 1. Consume message from queue
 * 2. Fetch message details from database
 * 3. Send message via MessageSenderService
 * 4. Update message status in database
 * 5. Handle idempotency (skip if already sent)
 * 6. Retry logic with exponential backoff
 *
 * Features:
 * - Idempotency handling
 * - Database transaction support
 * - Comprehensive error handling
 * - Logging and monitoring
 */

import { MessageConsumer, type MessageJob, RETRY_CONFIG } from '../queue/index.js';
import { messageLogRepository } from '../repositories/message-log.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { messageSenderService } from '../services/message-sender.service.js';
import { MessageStatus } from '../db/schema/message-logs.js';
import { logger } from '../utils/logger.js';
import { metricsService } from '../services/metrics.service.js';

export class MessageWorker {
  private consumer: MessageConsumer | null = null;

  /**
   * Initialize and start the worker
   */
  public async start(): Promise<void> {
    logger.info('Starting message worker...');

    // Create consumer with message handler
    this.consumer = new MessageConsumer({
      prefetch: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
      onMessage: this.processMessage.bind(this),
      onError: this.handleError.bind(this),
    });

    // Setup graceful shutdown
    this.consumer.setupGracefulShutdown();

    // Start consuming
    await this.consumer.startConsuming();

    logger.info('Message worker started successfully');
  }

  /**
   * Process individual message
   */
  private async processMessage(job: MessageJob): Promise<void> {
    const startTime = Date.now();
    const strategyName = job.messageType; // BIRTHDAY or ANNIVERSARY

    logger.info({
      msg: 'Processing message job',
      messageId: job.messageId,
      userId: job.userId,
      messageType: job.messageType,
      retryCount: job.retryCount,
    });

    try {
      // 1. Fetch message from database
      const message = await messageLogRepository.findById(job.messageId);

      if (!message) {
        logger.error({
          msg: 'Message not found in database',
          messageId: job.messageId,
        });
        throw new Error(`Message ${job.messageId} not found in database`);
      }

      // 2. Check idempotency - skip if already sent
      if (message.status === MessageStatus.SENT) {
        logger.info({
          msg: 'Message already sent, skipping',
          messageId: job.messageId,
          status: message.status,
        });
        return; // ACK message without reprocessing
      }

      // 3. Update status to SENDING
      await messageLogRepository.updateStatus(job.messageId, MessageStatus.SENDING);

      // 4. Extract user email (assuming it's stored in message content or we need to join with users table)
      // For now, we'll parse it from the message content or get from user repository
      const userEmail = await this.extractUserEmail(job.userId);

      // 5. Send message via external API
      logger.debug({
        msg: 'Sending message via API',
        messageId: job.messageId,
        email: userEmail,
      });

      // Get full user object for sending
      const user = await userRepository.findById(job.userId);
      if (!user) {
        throw new Error(`User not found: ${job.userId}`);
      }

      // Send message based on type
      const sendResult =
        job.messageType === 'BIRTHDAY'
          ? await messageSenderService.sendBirthdayMessage(user)
          : await messageSenderService.sendAnniversaryMessage(user);

      // 6. Update message status based on result
      if (sendResult.success) {
        // Success - mark as sent
        await messageLogRepository.markAsSent(job.messageId, {
          apiResponseCode: 200,
          apiResponseBody: JSON.stringify({ messageId: sendResult.messageId }),
        });

        const duration = Date.now() - startTime;
        const durationSeconds = duration / 1000;

        logger.info({
          msg: 'Message sent successfully',
          messageId: job.messageId,
          userId: job.userId,
          duration,
          statusCode: 200,
        });

        // Record metrics
        metricsService.recordMessageSent(job.messageType, 200);
        metricsService.recordMessageDeliveryDuration(job.messageType, 'success', durationSeconds);
        metricsService.recordMessageProcessing(job.messageType, durationSeconds);
        metricsService.recordMessageProcessingLatency(job.messageType, 'success', durationSeconds);
        metricsService.recordBirthdayProcessingDuration('success', strategyName, durationSeconds);
        metricsService.recordBirthdayMessageByStrategy(strategyName, 'success');

        // Record message delivery by hour
        const sendHour = new Date().getHours();
        metricsService.recordMessageDeliveryByHour(sendHour, job.messageType);

        // Record birthday greeting type
        metricsService.recordBirthdayGreetingType(job.messageType.toLowerCase(), 'email');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;
      const durationSeconds = duration / 1000;

      logger.error({
        msg: 'Failed to process message',
        messageId: job.messageId,
        userId: job.userId,
        error: errorMessage,
        retryCount: job.retryCount,
        duration,
      });

      // Mark as failed (will increment retry count)
      await messageLogRepository.markAsFailed(
        job.messageId,
        {
          errorMessage,
          apiResponseCode: undefined,
          apiResponseBody: undefined,
        },
        RETRY_CONFIG.MAX_RETRIES
      );

      // Determine error type for metrics
      const errorType = this.categorizeError(error);

      // Record metrics
      metricsService.recordMessageFailed(job.messageType, errorType, job.retryCount);
      metricsService.recordMessageDeliveryDuration(job.messageType, 'failure', durationSeconds);
      metricsService.recordMessageProcessingLatency(job.messageType, 'failure', durationSeconds);
      metricsService.recordBirthdayProcessingDuration('failure', strategyName, durationSeconds);
      metricsService.recordBirthdayMessageByStrategy(strategyName, 'failure');

      // Re-throw to let consumer handle retry/reject logic
      throw error;
    }
  }

  /**
   * Extract user email from user ID
   */
  private async extractUserEmail(userId: string): Promise<string> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    return user.email;
  }

  /**
   * Categorize error for metrics
   */
  private categorizeError(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'unknown';
    }

    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('etimedout')) {
      return 'timeout';
    }
    if (message.includes('network') || message.includes('econnrefused')) {
      return 'network';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    if (message.includes('404') || message.includes('not found')) {
      return 'not_found';
    }
    if (message.includes('429') || message.includes('rate limit')) {
      return 'rate_limit';
    }
    if (message.includes('500') || message.includes('503')) {
      return 'server_error';
    }

    return 'other';
  }

  /**
   * Handle processing errors
   */
  private handleError(error: Error, job?: MessageJob): void {
    logger.error({
      msg: 'Message processing error',
      messageId: job?.messageId,
      userId: job?.userId,
      error: error.message,
      retryCount: job?.retryCount,
    });

    // Additional error handling logic can go here
    // e.g., send alerts, update metrics, etc.
  }

  /**
   * Stop the worker
   */
  public async stop(): Promise<void> {
    logger.info('Stopping message worker...');

    if (this.consumer) {
      await this.consumer.stopConsuming();
      this.consumer = null;
    }

    logger.info('Message worker stopped');
  }

  /**
   * Check if worker is running
   */
  public isRunning(): boolean {
    return this.consumer?.isRunning() || false;
  }
}

// Export singleton instance
export const messageWorker = new MessageWorker();
