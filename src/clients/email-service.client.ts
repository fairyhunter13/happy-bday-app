/**
 * Email Service Client
 * DRY Principle: Auto-generated client wrapper with resilience patterns
 *
 * This 100-line wrapper replaces 400+ lines of manual HTTP client code.
 * Features:
 * - Type-safe auto-generated client from OpenAPI spec
 * - Circuit breaker pattern (Opossum)
 * - Exponential backoff retry logic
 * - Error mapping (vendor errors → application errors)
 * - Metrics and logging integration
 */

import CircuitBreaker from 'opossum';
import { Email } from './generated/sdk.gen.js';
import type { SendEmailRequest, SendEmailSuccessResponse } from './generated/types.gen.js';
import { logger } from '../config/logger.js';
import { metricsService } from '../services/metrics.service.js';
import { env } from '../config/environment.js';

// Circuit breaker configuration
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 30000, // 30 seconds
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 30000, // Try again after 30 seconds
  rollingCountTimeout: 10000, // 10-second rolling window
  rollingCountBuckets: 10,
  name: 'EmailServiceCircuit',
};

// Retry configuration
const RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  factor: 2, // Exponential backoff factor
};

/**
 * Email Service Client with resilience patterns
 */
export class EmailServiceClient {
  private sendEmailCircuit: CircuitBreaker<[SendEmailRequest], SendEmailSuccessResponse>;

  constructor() {
    // Initialize circuit breaker
    this.sendEmailCircuit = new CircuitBreaker(
      this.sendEmailInternal.bind(this),
      CIRCUIT_BREAKER_OPTIONS
    );

    // Circuit breaker event handlers
    this.setupCircuitBreakerEvents(this.sendEmailCircuit, 'sendEmail');

    logger.info({ baseUrl: env.EMAIL_SERVICE_URL }, 'EmailServiceClient initialized');
  }

  /**
   * Send email (with circuit breaker and retry)
   */
  async sendEmail(data: SendEmailRequest): Promise<SendEmailSuccessResponse> {
    const startTime = Date.now();

    try {
      const result = await this.retryWithBackoff(
        () => this.sendEmailCircuit.fire(data),
        RETRY_OPTIONS
      );

      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      metricsService.recordApiResponseTime('POST', '/send-email', 200, duration);
      metricsService.recordExternalApiCall('email_service', '/send-email', 200, duration);
      metricsService.recordHttpRequestDuration('email_service', 'POST', 200, duration);

      logger.info({ messageId: result.messageId, duration }, 'Email sent successfully');
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      metricsService.recordApiResponseTime('POST', '/send-email', 500, duration);
      metricsService.recordExternalApiCall('email_service', '/send-email', 500, duration);
      metricsService.recordHttpRequestDuration('email_service', 'POST', 500, duration);

      logger.error({ error, data, duration }, 'Failed to send email');
      throw this.mapError(error);
    }
  }

  /**
   * Internal send email method (used by circuit breaker)
   */
  private async sendEmailInternal(data: SendEmailRequest): Promise<SendEmailSuccessResponse> {
    // Use auto-generated SDK Email.sendEmail()
    const response = await Email.sendEmail({
      body: data,
    });

    if (response.error) {
      throw new Error(`Email service error: ${JSON.stringify(response.error)}`);
    }

    return response.data;
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: typeof RETRY_OPTIONS
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === options.maxRetries) {
          logger.warn({ attempt, error }, 'Max retries reached');
          // Record timeout metric if timeout error
          if (lastError.message.includes('timeout')) {
            metricsService.recordHttpClientTimeout('email_service', 'POST', 'request');
          }
          break;
        }

        // Record retry metric
        metricsService.recordHttpClientRetry('email_service', 'POST', 0);
        metricsService.recordMessageRetry('email', lastError.message.slice(0, 50));

        const delay = Math.min(
          options.baseDelay * Math.pow(options.factor, attempt),
          options.maxDelay
        );

        logger.warn({ attempt, delay, error }, 'Retrying after error');
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('Retry failed without error');
  }

  /**
   * Map vendor errors to application errors
   */
  private mapError(error: unknown): Error {
    if (error instanceof Error) {
      // Map specific vendor error codes to application errors
      if (error.message.includes('rate limit')) {
        metricsService.recordRateLimitHit('/send-email', 'email_service');
        return new Error('Email service rate limit exceeded');
      }
      if (error.message.includes('invalid email')) {
        metricsService.recordApiValidationError('/send-email', 'invalid_email');
        return new Error('Invalid email address');
      }
      if (error.message.includes('timeout')) {
        metricsService.recordHttpClientTimeout('email_service', 'POST', 'request_timeout');
        return new Error('Email service timeout');
      }

      // Record generic vendor error
      metricsService.recordExternalApiError('email_service', 'POST', 'vendor_error');
      return error;
    }

    // Record unknown error
    metricsService.recordExternalApiError('email_service', 'POST', 'unknown_error');
    return new Error('Unknown email service error');
  }

  /**
   * Setup circuit breaker event monitoring
   */
  private setupCircuitBreakerEvents(
    circuit: CircuitBreaker<[SendEmailRequest], SendEmailSuccessResponse>,
    operation: string
  ): void {
    circuit.on('open', () => {
      logger.error({ operation }, 'Circuit breaker opened');
      metricsService.setCircuitBreakerStatus('email_service', true);
    });

    circuit.on('halfOpen', () => {
      logger.warn({ operation }, 'Circuit breaker half-open');
      metricsService.setCircuitBreakerStatus('email_service', true);
    });

    circuit.on('close', () => {
      logger.info({ operation }, 'Circuit breaker closed');
      metricsService.setCircuitBreakerStatus('email_service', false);
    });

    circuit.on('fallback', () => {
      logger.warn({ operation }, 'Circuit breaker fallback triggered');
      // Record circuit breaker fallback metric
      metricsService.recordCircuitBreakerTrip('email_service', operation);
    });
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker health status
   */
  getHealthStatus(): {
    sendEmail: { state: string; stats: unknown };
  } {
    return {
      sendEmail: {
        state: this.sendEmailCircuit.opened
          ? 'open'
          : this.sendEmailCircuit.halfOpen
            ? 'half-open'
            : 'closed',
        stats: this.sendEmailCircuit.stats,
      },
    };
  }

  /**
   * Reset circuit breaker to closed state
   * Useful for testing to reset state between tests
   */
  resetCircuitBreaker(): void {
    this.sendEmailCircuit.close();
    logger.info('Circuit breaker manually reset to closed state');
  }
}

// Export singleton instance
export const emailServiceClient = new EmailServiceClient();
