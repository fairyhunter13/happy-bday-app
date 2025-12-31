/**
 * Resilient API Testing Utility
 *
 * Handles non-deterministic API behavior (e.g., 10% random failure rate)
 * with graceful retry logic and probabilistic assertions.
 *
 * Design Principles:
 * - Retries with exponential backoff for transient failures
 * - Statistical assertions (minimum success rate) instead of strict pass/fail
 * - Detailed failure tracking for debugging
 * - Verification of circuit breaker and retry mechanisms
 * - Configurable thresholds for different reliability requirements
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  factor: number; // exponential backoff factor
  jitter: boolean; // add randomness to prevent thundering herd
}

export interface ApiCallResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  attemptNumber: number;
  elapsedTime: number;
  statusCode?: number;
}

export interface TestRunStats {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageAttempts: number;
  averageLatency: number;
  failures: Array<{
    attemptNumber: number;
    error: string;
    statusCode?: number;
    timestamp: number;
  }>;
}

/**
 * Resilient API Tester
 *
 * Provides utilities for testing APIs with non-deterministic behavior.
 */
export class ResilientApiTester<T = any> {
  private stats: TestRunStats = {
    totalAttempts: 0,
    successCount: 0,
    failureCount: 0,
    successRate: 0,
    averageAttempts: 0,
    averageLatency: 0,
    failures: [],
  };

  private attemptCounts: number[] = [];
  private latencies: number[] = [];

  constructor(private readonly config: RetryConfig) {}

  /**
   * Execute API call with retry logic and exponential backoff
   */
  async executeWithRetry(
    apiCall: () => Promise<T>,
    options?: {
      shouldRetry?: (error: Error) => boolean;
      onRetry?: (attemptNumber: number, error: Error) => void;
    }
  ): Promise<ApiCallResult<T>> {
    let lastError: Error | undefined;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const data = await apiCall();
        const elapsedTime = Date.now() - startTime;

        this.recordSuccess(attempt + 1, elapsedTime);

        return {
          success: true,
          data,
          attemptNumber: attempt + 1,
          elapsedTime,
        };
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry this error
        const shouldRetry = options?.shouldRetry
          ? options.shouldRetry(lastError)
          : this.isRetriableError(lastError);

        if (!shouldRetry || attempt === this.config.maxRetries) {
          const elapsedTime = Date.now() - startTime;
          this.recordFailure(attempt + 1, lastError, elapsedTime);

          return {
            success: false,
            error: lastError,
            attemptNumber: attempt + 1,
            elapsedTime,
            statusCode: this.extractStatusCode(lastError),
          };
        }

        // Calculate backoff delay
        const delay = this.calculateBackoff(attempt);

        // Notify retry callback
        if (options?.onRetry) {
          options.onRetry(attempt + 1, lastError);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // Should never reach here, but TypeScript needs it
    const elapsedTime = Date.now() - startTime;
    this.recordFailure(this.config.maxRetries + 1, lastError!, elapsedTime);

    return {
      success: false,
      error: lastError,
      attemptNumber: this.config.maxRetries + 1,
      elapsedTime,
    };
  }

  /**
   * Execute multiple API calls and track statistics
   */
  async executeBatch(
    apiCalls: Array<() => Promise<T>>,
    options?: {
      shouldRetry?: (error: Error) => boolean;
      onRetry?: (attemptNumber: number, error: Error) => void;
      parallel?: boolean;
    }
  ): Promise<ApiCallResult<T>[]> {
    if (options?.parallel) {
      return await Promise.all(apiCalls.map((call) => this.executeWithRetry(call, options)));
    } else {
      const results: ApiCallResult<T>[] = [];
      for (const call of apiCalls) {
        results.push(await this.executeWithRetry(call, options));
      }
      return results;
    }
  }

  /**
   * Assert minimum success rate
   *
   * For a 10% failure rate API, a 80% minimum success rate allows
   * for the expected failures while catching systemic issues.
   */
  assertMinimumSuccessRate(minimumRate: number, message?: string): void {
    if (this.stats.successRate < minimumRate) {
      throw new Error(
        message ||
          `Success rate ${this.stats.successRate.toFixed(2)}% is below minimum ${minimumRate}%. ` +
            `Successes: ${this.stats.successCount}, Failures: ${this.stats.failureCount}, ` +
            `Total: ${this.stats.totalAttempts}`
      );
    }
  }

  /**
   * Assert that retry mechanism was used
   */
  assertRetryMechanismUsed(): void {
    const multipleAttempts = this.attemptCounts.filter((count) => count > 1);
    if (multipleAttempts.length === 0) {
      throw new Error(
        'Retry mechanism was not triggered. All requests succeeded on first attempt. ' +
          'This may indicate the API is not failing as expected for this test.'
      );
    }
  }

  /**
   * Assert maximum retry count not exceeded
   */
  assertMaxRetriesNotExceeded(): void {
    const exceededMax = this.attemptCounts.filter((count) => count > this.config.maxRetries + 1);
    if (exceededMax.length > 0) {
      throw new Error(
        `Some requests exceeded max retries (${this.config.maxRetries}). ` +
          `Max attempts observed: ${Math.max(...exceededMax)}`
      );
    }
  }

  /**
   * Assert average latency is within acceptable range
   */
  assertAverageLatency(maxLatencyMs: number): void {
    if (this.stats.averageLatency > maxLatencyMs) {
      throw new Error(
        `Average latency ${this.stats.averageLatency.toFixed(2)}ms exceeds maximum ${maxLatencyMs}ms`
      );
    }
  }

  /**
   * Get detailed statistics
   */
  getStats(): TestRunStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      averageAttempts: 0,
      averageLatency: 0,
      failures: [],
    };
    this.attemptCounts = [];
    this.latencies = [];
  }

  /**
   * Calculate exponential backoff with optional jitter
   */
  private calculateBackoff(attempt: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.factor, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    if (this.config.jitter) {
      // Add up to 25% jitter to prevent thundering herd
      const jitterAmount = cappedDelay * 0.25 * Math.random();
      return cappedDelay + jitterAmount;
    }

    return cappedDelay;
  }

  /**
   * Determine if error is retriable
   */
  private isRetriableError(error: Error): boolean {
    const retriablePatterns = [
      /network/i,
      /timeout/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /503/,
      /500/,
      /502/,
      /504/,
      /429/,
      /rate limit/i,
      /temporarily unavailable/i,
      /connection reset/i,
      /ECONNRESET/i,
    ];

    return retriablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Extract HTTP status code from error if available
   */
  private extractStatusCode(error: Error): number | undefined {
    // Try to extract status code from common error patterns
    const statusMatch = error.message.match(/\b(4\d{2}|5\d{2})\b/);
    if (statusMatch) {
      return parseInt(statusMatch[1], 10);
    }

    // Check if error has a status property (common in HTTP libraries)
    if ('status' in error) {
      return (error as any).status;
    }

    if ('statusCode' in error) {
      return (error as any).statusCode;
    }

    return undefined;
  }

  /**
   * Record successful call
   */
  private recordSuccess(attempts: number, latency: number): void {
    this.stats.totalAttempts++;
    this.stats.successCount++;
    this.attemptCounts.push(attempts);
    this.latencies.push(latency);
    this.updateAverages();
  }

  /**
   * Record failed call
   */
  private recordFailure(attempts: number, error: Error, latency: number): void {
    this.stats.totalAttempts++;
    this.stats.failureCount++;
    this.attemptCounts.push(attempts);
    this.latencies.push(latency);

    this.stats.failures.push({
      attemptNumber: attempts,
      error: error.message,
      statusCode: this.extractStatusCode(error),
      timestamp: Date.now(),
    });

    this.updateAverages();
  }

  /**
   * Update calculated averages
   */
  private updateAverages(): void {
    this.stats.successRate =
      this.stats.totalAttempts > 0 ? (this.stats.successCount / this.stats.totalAttempts) * 100 : 0;

    this.stats.averageAttempts =
      this.attemptCounts.length > 0
        ? this.attemptCounts.reduce((sum, count) => sum + count, 0) / this.attemptCounts.length
        : 0;

    this.stats.averageLatency =
      this.latencies.length > 0
        ? this.latencies.reduce((sum, latency) => sum + latency, 0) / this.latencies.length
        : 0;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a resilient API tester with default configuration
 */
export function createResilientTester<T = any>(
  overrides?: Partial<RetryConfig>
): ResilientApiTester<T> {
  const defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    factor: 2,
    jitter: true,
  };

  return new ResilientApiTester<T>({ ...defaultConfig, ...overrides });
}

/**
 * Default configuration presets for common scenarios
 */
export const RetryPresets = {
  /**
   * For APIs with ~10% failure rate (like the email service)
   * Allows 3 retries with moderate backoff
   */
  probabilisticFailure: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    factor: 2,
    jitter: true,
  } as RetryConfig,

  /**
   * For high-reliability requirements
   * More retries with longer backoff
   */
  highReliability: {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    factor: 2,
    jitter: true,
  } as RetryConfig,

  /**
   * For fast-failing tests
   * Fewer retries with short delays
   */
  fastFail: {
    maxRetries: 2,
    baseDelay: 500,
    maxDelay: 2000,
    factor: 2,
    jitter: false,
  } as RetryConfig,

  /**
   * For rate-limited APIs
   * Longer delays to respect rate limits
   */
  rateLimited: {
    maxRetries: 5,
    baseDelay: 5000,
    maxDelay: 60000,
    factor: 1.5,
    jitter: true,
  } as RetryConfig,
};
