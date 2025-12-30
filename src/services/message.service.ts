import got, { Got, Options as GotOptions } from 'got';
import CircuitBreaker from 'opossum';
import { User } from '../db/schema/users.js';
import { ExternalServiceError, ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { env } from '../config/environment.js';

/**
 * Message sending response from external API
 */
export interface MessageResponse {
  success: boolean;
  statusCode: number;
  body?: string;
  error?: string;
}

/**
 * Retry configuration for HTTP requests
 */
interface RetryConfig {
  limit: number;
  methods: string[];
  statusCodes: number[];
  calculateDelay: (retryCount: number) => number;
}

/**
 * Circuit breaker options
 */
interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  rollingCountTimeout: number;
  rollingCountBuckets: number;
}

/**
 * MessageSenderService
 *
 * Sends birthday/anniversary messages to external HTTP API with:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern for fault tolerance
 * - Comprehensive error handling
 *
 * Configuration:
 * - Retry: 3 attempts with exponential backoff (1s, 2s, 4s)
 * - Circuit breaker: Opens at 50% error rate, resets after 30s
 *
 * @example
 * const service = new MessageSenderService(apiUrl);
 * const response = await service.sendBirthdayMessage(user);
 */
export class MessageSenderService {
  private readonly httpClient: Got;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly apiUrl: string;

  /**
   * Default retry configuration
   * - 3 retry attempts
   * - Exponential backoff: 1s, 2s, 4s
   * - Retry on 5xx and network errors
   */
  private readonly retryConfig: RetryConfig = {
    limit: 3,
    methods: ['POST'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
    calculateDelay: (retryCount: number): number => {
      // Exponential backoff: 1s, 2s, 4s
      return Math.pow(2, retryCount) * 1000;
    },
  };

  /**
   * Circuit breaker configuration
   * - Opens at 50% error threshold
   * - Resets after 30 seconds
   * - 10 second rolling window
   */
  private readonly circuitBreakerOptions: CircuitBreakerOptions = {
    timeout: 10000, // 10 seconds
    errorThresholdPercentage: 50, // Open circuit at 50% error rate
    resetTimeout: 30000, // Try again after 30 seconds
    rollingCountTimeout: 10000, // 10 second rolling window
    rollingCountBuckets: 10, // 10 buckets in rolling window
  };

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || env.MESSAGE_API_URL || 'http://localhost:3001/api/messages';

    // Initialize Got HTTP client with retry configuration
    this.httpClient = got.extend({
      retry: {
        limit: this.retryConfig.limit,
        methods: this.retryConfig.methods as Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'>,
        statusCodes: this.retryConfig.statusCodes,
        calculateDelay: ({ attemptCount }): number => {
          const delay = this.retryConfig.calculateDelay(attemptCount);
          logger.debug(
            { attemptCount, delay },
            'HTTP retry attempt with exponential backoff'
          );
          return delay;
        },
      },
      timeout: {
        request: 10000, // 10 second timeout
      },
      hooks: {
        beforeRequest: [
          (options) => {
            logger.debug(
              { url: options.url?.toString(), method: options.method },
              'Sending HTTP request'
            );
          },
        ],
        afterResponse: [
          (response) => {
            logger.debug(
              { statusCode: response.statusCode, url: response.url },
              'HTTP response received'
            );
            return response;
          },
        ],
      },
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      this.sendMessageRequest.bind(this),
      this.circuitBreakerOptions
    );

    // Circuit breaker event handlers
    this.circuitBreaker.on('open', () => {
      logger.warn('Circuit breaker opened - too many failures');
    });

    this.circuitBreaker.on('halfOpen', () => {
      logger.info('Circuit breaker half-open - testing service');
    });

    this.circuitBreaker.on('close', () => {
      logger.info('Circuit breaker closed - service recovered');
    });

    this.circuitBreaker.on('fallback', (result) => {
      logger.warn({ result }, 'Circuit breaker fallback triggered');
    });

    logger.info(
      { apiUrl: this.apiUrl, retryConfig: this.retryConfig },
      'MessageSenderService initialized'
    );
  }

  /**
   * Send birthday message to a user
   *
   * @param user - User object with recipient information
   * @returns Message response with status and details
   *
   * @example
   * const response = await sendBirthdayMessage(user);
   * if (response.success) {
   *   console.log('Message sent successfully');
   * }
   */
  async sendBirthdayMessage(user: User): Promise<MessageResponse> {
    if (!user || !user.id) {
      throw new ValidationError('User object is required with valid ID');
    }

    if (!user.email) {
      throw new ValidationError('User email is required');
    }

    const messageContent = this.composeBirthdayMessage(user);

    logger.info(
      { userId: user.id, email: user.email },
      'Sending birthday message'
    );

    try {
      // Use circuit breaker to send message
      const response = await this.circuitBreaker.fire({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        messageType: 'BIRTHDAY',
        messageContent,
      });

      logger.info(
        { userId: user.id, statusCode: response.statusCode },
        'Birthday message sent successfully'
      );

      return response;
    } catch (error) {
      logger.error(
        { userId: user.id, error: error instanceof Error ? error.message : String(error) },
        'Failed to send birthday message'
      );

      // Check if circuit is open
      if (this.circuitBreaker.opened) {
        throw new ExternalServiceError(
          'Message service is currently unavailable (circuit breaker open)',
          { userId: user.id, circuitState: 'open' }
        );
      }

      throw error;
    }
  }

  /**
   * Send anniversary message to a user
   *
   * @param user - User object with recipient information
   * @returns Message response with status and details
   */
  async sendAnniversaryMessage(user: User): Promise<MessageResponse> {
    if (!user || !user.id) {
      throw new ValidationError('User object is required with valid ID');
    }

    if (!user.email) {
      throw new ValidationError('User email is required');
    }

    const messageContent = this.composeAnniversaryMessage(user);

    logger.info(
      { userId: user.id, email: user.email },
      'Sending anniversary message'
    );

    try {
      const response = await this.circuitBreaker.fire({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        messageType: 'ANNIVERSARY',
        messageContent,
      });

      logger.info(
        { userId: user.id, statusCode: response.statusCode },
        'Anniversary message sent successfully'
      );

      return response;
    } catch (error) {
      logger.error(
        { userId: user.id, error: error instanceof Error ? error.message : String(error) },
        'Failed to send anniversary message'
      );

      if (this.circuitBreaker.opened) {
        throw new ExternalServiceError(
          'Message service is currently unavailable (circuit breaker open)',
          { userId: user.id, circuitState: 'open' }
        );
      }

      throw error;
    }
  }

  /**
   * Actual HTTP request to send message
   * Called by circuit breaker
   *
   * @private
   */
  private async sendMessageRequest(payload: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    messageType: string;
    messageContent: string;
  }): Promise<MessageResponse> {
    try {
      const response = await this.httpClient.post(this.apiUrl, {
        json: payload,
        responseType: 'json',
      });

      return {
        success: true,
        statusCode: response.statusCode,
        body: JSON.stringify(response.body),
      };
    } catch (error: unknown) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId: payload.userId,
        },
        'HTTP request failed'
      );

      // Handle Got errors
      if (error && typeof error === 'object' && 'response' in error) {
        const gotError = error as { response?: { statusCode: number; body: unknown } };
        if (gotError.response) {
          return {
            success: false,
            statusCode: gotError.response.statusCode,
            body: JSON.stringify(gotError.response.body),
            error: `HTTP ${gotError.response.statusCode}`,
          };
        }
      }

      // Network or other errors
      throw new ExternalServiceError(
        'Failed to send message to external API',
        {
          userId: payload.userId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
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
   * Get circuit breaker statistics
   *
   * @returns Circuit breaker stats
   */
  getCircuitBreakerStats(): {
    state: string;
    failures: number;
    successes: number;
    isOpen: boolean;
  } {
    return {
      state: this.circuitBreaker.opened ? 'open' : this.circuitBreaker.halfOpen ? 'half-open' : 'closed',
      failures: this.circuitBreaker.stats.failures,
      successes: this.circuitBreaker.stats.successes,
      isOpen: this.circuitBreaker.opened,
    };
  }

  /**
   * Reset circuit breaker (useful for testing)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.close();
    logger.info('Circuit breaker manually reset');
  }

  /**
   * Check if service is healthy
   *
   * @returns true if circuit is closed, false if open
   */
  isHealthy(): boolean {
    return !this.circuitBreaker.opened;
  }
}

// Export singleton instance (can be overridden in tests)
export const messageSenderService = new MessageSenderService();
