import { type User } from '../db/schema/users.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { emailServiceClient } from '../clients/email-service.client.js';

/**
 * Message sending response from external API
 * Matches Digital Envision email service response format
 */
export interface MessageResponse {
  success: boolean;
  messageId: string;
}

/**
 * MessageSenderService
 *
 * Sends birthday/anniversary messages using Digital Envision email service.
 * Uses auto-generated type-safe client with built-in resilience patterns:
 * - Circuit breaker (50% error threshold, 30s reset)
 * - Exponential backoff retry (3 attempts: 1s, 2s, 4s+)
 * - Comprehensive error handling and metrics
 *
 * DRY Principle: Delegates to EmailServiceClient (100 lines vs 400+ manual code)
 *
 * @example
 * const service = new MessageSenderService();
 * const response = await service.sendBirthdayMessage(user);
 */
export class MessageSenderService {
  constructor() {
    logger.info('MessageSenderService initialized with auto-generated email client');
  }

  /**
   * Send birthday message to a user
   *
   * @param user - User object with recipient information
   * @returns Message response with status and message ID
   *
   * @example
   * const response = await sendBirthdayMessage(user);
   * if (response.success) {
   *   console.log('Message sent:', response.messageId);
   * }
   */
  async sendBirthdayMessage(user: User): Promise<MessageResponse> {
    if (!user || !user.id) {
      throw new ValidationError('User object is required with valid ID');
    }

    if (!user.email) {
      throw new ValidationError('User email is required');
    }

    const message = this.composeBirthdayMessage(user);

    logger.info(
      { userId: user.id, email: user.email },
      'Sending birthday message via Digital Envision email service'
    );

    try {
      // Use auto-generated email client (circuit breaker + retry built-in)
      const response = await emailServiceClient.sendEmail({
        email: user.email,
        message,
      });

      logger.info(
        { userId: user.id, messageId: response.messageId },
        'Birthday message sent successfully'
      );

      return response;
    } catch (error) {
      logger.error(
        { userId: user.id, error: error instanceof Error ? error.message : String(error) },
        'Failed to send birthday message'
      );
      throw error;
    }
  }

  /**
   * Send anniversary message to a user
   *
   * @param user - User object with recipient information
   * @returns Message response with status and message ID
   */
  async sendAnniversaryMessage(user: User): Promise<MessageResponse> {
    if (!user || !user.id) {
      throw new ValidationError('User object is required with valid ID');
    }

    if (!user.email) {
      throw new ValidationError('User email is required');
    }

    const message = this.composeAnniversaryMessage(user);

    logger.info(
      { userId: user.id, email: user.email },
      'Sending anniversary message via Digital Envision email service'
    );

    try {
      // Use auto-generated email client (circuit breaker + retry built-in)
      const response = await emailServiceClient.sendEmail({
        email: user.email,
        message,
      });

      logger.info(
        { userId: user.id, messageId: response.messageId },
        'Anniversary message sent successfully'
      );

      return response;
    } catch (error) {
      logger.error(
        { userId: user.id, error: error instanceof Error ? error.message : String(error) },
        'Failed to send anniversary message'
      );
      throw error;
    }
  }

  /**
   * Compose birthday message content
   *
   * @private
   */
  private composeBirthdayMessage(user: User): string {
    return `Hey ${user.firstName}, happy birthday!`;
  }

  /**
   * Compose anniversary message content
   *
   * @private
   */
  private composeAnniversaryMessage(user: User): string {
    return `Hey ${user.firstName}, happy work anniversary!`;
  }

  /**
   * Get email service health status
   *
   * @returns Health status from underlying email service client
   */
  getHealthStatus(): {
    sendEmail: { state: string; stats: unknown };
  } {
    return emailServiceClient.getHealthStatus();
  }

  /**
   * Check if service is healthy
   *
   * @returns true if email service circuit is closed
   */
  isHealthy(): boolean {
    const health = emailServiceClient.getHealthStatus();
    return health.sendEmail.state === 'closed';
  }

  /**
   * Get circuit breaker statistics
   *
   * @returns Circuit breaker stats for health monitoring
   */
  getCircuitBreakerStats(): {
    state: string;
    isOpen: boolean;
    failures: number;
    successes: number;
  } {
    const health = emailServiceClient.getHealthStatus();
    const stats = health.sendEmail.stats as any;

    return {
      state: health.sendEmail.state,
      isOpen: health.sendEmail.state !== 'closed',
      failures: stats?.failures || 0,
      successes: stats?.successes || 0,
    };
  }
}

// Export singleton instance (can be overridden in tests)
export const messageSenderService = new MessageSenderService();
