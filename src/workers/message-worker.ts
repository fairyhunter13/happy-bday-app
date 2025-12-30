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

import { MessageConsumer, MessageJob, RETRY_CONFIG } from '../queue/index.js';
import { messageLogRepository } from '../repositories/message-log.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { messageSenderService } from '../services/message-sender.service.js';
import { MessageStatus } from '../db/schema/message-logs.js';
import { logger } from '../utils/logger.js';

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

    logger.info('Processing message job', {
      messageId: job.messageId,
      userId: job.userId,
      messageType: job.messageType,
      retryCount: job.retryCount,
    });

    try {
      // 1. Fetch message from database
      const message = await messageLogRepository.findById(job.messageId);

      if (!message) {
        logger.error('Message not found in database', {
          messageId: job.messageId,
        });
        throw new Error(`Message ${job.messageId} not found in database`);
      }

      // 2. Check idempotency - skip if already sent
      if (message.status === MessageStatus.SENT) {
        logger.info('Message already sent, skipping', {
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
      logger.debug('Sending message via API', {
        messageId: job.messageId,
        email: userEmail,
      });

      const sendResult = await messageSenderService.sendMessage({
        email: userEmail,
        message: message.messageContent,
      });

      // 6. Update message status based on result
      if (sendResult.success && sendResult.statusCode >= 200 && sendResult.statusCode < 300) {
        // Success - mark as sent
        await messageLogRepository.markAsSent(job.messageId, {
          apiResponseCode: sendResult.statusCode,
          apiResponseBody: sendResult.body,
        });

        const duration = Date.now() - startTime;
        logger.info('Message sent successfully', {
          messageId: job.messageId,
          userId: job.userId,
          duration,
          statusCode: sendResult.statusCode,
        });
      } else {
        // Failure - mark as failed
        throw new Error(
          `Failed to send message: HTTP ${sendResult.statusCode} - ${sendResult.body}`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      logger.error('Failed to process message', {
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
   * Handle processing errors
   */
  private async handleError(error: Error, job?: MessageJob): Promise<void> {
    logger.error('Message processing error', {
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
