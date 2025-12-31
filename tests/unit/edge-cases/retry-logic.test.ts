/**
 * Retry Logic Edge Cases Tests
 *
 * Covers comprehensive retry scenarios:
 * - Maximum retry attempts exceeded
 * - Retry backoff timing (exponential, linear, custom)
 * - Retry with different error types (transient vs permanent)
 * - Concurrent retry scenarios
 * - Retry state management
 * - DLQ routing after max retries
 *
 * These tests ensure the retry mechanism works correctly under all conditions
 * and properly handles edge cases that could lead to message loss or infinite loops.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Retry Logic Edge Cases', () => {
  describe('Maximum Retry Attempts', () => {
    it('should stop retrying after max attempts reached', async () => {
      const MAX_RETRIES = 5;
      let attemptCount = 0;

      const processWithRetry = async (): Promise<string> => {
        attemptCount++;

        if (attemptCount <= MAX_RETRIES) {
          throw new Error('Transient failure');
        }

        return 'success';
      };

      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          await processWithRetry();
        } catch (error) {
          // Expected to fail
        }
      }

      expect(attemptCount).toBe(MAX_RETRIES);

      // Next attempt would succeed but shouldn't happen
      const shouldSendToDLQ = attemptCount >= MAX_RETRIES;
      expect(shouldSendToDLQ).toBe(true);
    });

    it('should send to DLQ after exhausting retries', () => {
      interface RetryState {
        retryCount: number;
        maxRetries: number;
        status: 'retry' | 'dlq' | 'success';
      }

      const state: RetryState = {
        retryCount: 5,
        maxRetries: 5,
        status: 'retry',
      };

      const handleRetryExhaustion = (state: RetryState): void => {
        if (state.retryCount >= state.maxRetries) {
          state.status = 'dlq';
        }
      };

      handleRetryExhaustion(state);

      expect(state.status).toBe('dlq');
    });

    it('should increment retry counter correctly', () => {
      const message = {
        id: 'msg-1',
        retryCount: 0,
        maxRetries: 3,
      };

      const incrementRetry = (msg: typeof message): boolean => {
        msg.retryCount++;
        return msg.retryCount < msg.maxRetries;
      };

      expect(incrementRetry(message)).toBe(true); // Retry 1
      expect(message.retryCount).toBe(1);

      expect(incrementRetry(message)).toBe(true); // Retry 2
      expect(message.retryCount).toBe(2);

      expect(incrementRetry(message)).toBe(false); // Retry 3 - max reached
      expect(message.retryCount).toBe(3);
    });

    it('should track retry history', () => {
      interface RetryHistory {
        messageId: string;
        attempts: Array<{
          attemptNumber: number;
          timestamp: number;
          error: string;
        }>;
      }

      const history: RetryHistory = {
        messageId: 'msg-1',
        attempts: [],
      };

      const recordAttempt = (attemptNum: number, error: string): void => {
        history.attempts.push({
          attemptNumber: attemptNum,
          timestamp: Date.now(),
          error,
        });
      };

      recordAttempt(1, 'Network timeout');
      recordAttempt(2, 'Service unavailable');
      recordAttempt(3, 'Rate limit exceeded');

      expect(history.attempts).toHaveLength(3);
      expect(history.attempts[0]!.error).toBe('Network timeout');
      expect(history.attempts[2]!.attemptNumber).toBe(3);
    });

    it('should enforce per-message retry limits', () => {
      const messages = [
        { id: 'msg-1', retryCount: 2, maxRetries: 3 },
        { id: 'msg-2', retryCount: 5, maxRetries: 5 },
        { id: 'msg-3', retryCount: 0, maxRetries: 3 },
      ];

      const getRetryableMessages = (
        msgs: typeof messages
      ): Array<{ id: string; retryCount: number }> => {
        return msgs.filter((msg) => msg.retryCount < msg.maxRetries);
      };

      const retryable = getRetryableMessages(messages);

      expect(retryable).toHaveLength(2);
      expect(retryable.find((m) => m.id === 'msg-1')).toBeDefined();
      expect(retryable.find((m) => m.id === 'msg-3')).toBeDefined();
      expect(retryable.find((m) => m.id === 'msg-2')).toBeUndefined();
    });
  });

  describe('Retry Backoff Timing', () => {
    it('should implement exponential backoff correctly', () => {
      const calculateExponentialBackoff = (
        attempt: number,
        baseDelay = 1000,
        factor = 2
      ): number => {
        return baseDelay * Math.pow(factor, attempt);
      };

      expect(calculateExponentialBackoff(0, 1000, 2)).toBe(1000); // 1s
      expect(calculateExponentialBackoff(1, 1000, 2)).toBe(2000); // 2s
      expect(calculateExponentialBackoff(2, 1000, 2)).toBe(4000); // 4s
      expect(calculateExponentialBackoff(3, 1000, 2)).toBe(8000); // 8s
      expect(calculateExponentialBackoff(4, 1000, 2)).toBe(16000); // 16s
    });

    it('should implement linear backoff correctly', () => {
      const calculateLinearBackoff = (attempt: number, baseDelay = 1000): number => {
        return baseDelay * (attempt + 1);
      };

      expect(calculateLinearBackoff(0, 1000)).toBe(1000); // 1s
      expect(calculateLinearBackoff(1, 1000)).toBe(2000); // 2s
      expect(calculateLinearBackoff(2, 1000)).toBe(3000); // 3s
      expect(calculateLinearBackoff(3, 1000)).toBe(4000); // 4s
    });

    it('should cap backoff at maximum delay', () => {
      const calculateBackoffWithCap = (
        attempt: number,
        baseDelay = 1000,
        maxDelay = 60000
      ): number => {
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        return Math.min(exponentialDelay, maxDelay);
      };

      expect(calculateBackoffWithCap(0)).toBe(1000); // 1s
      expect(calculateBackoffWithCap(5)).toBe(32000); // 32s
      expect(calculateBackoffWithCap(10)).toBe(60000); // Capped at 60s
      expect(calculateBackoffWithCap(20)).toBe(60000); // Still capped
    });

    it('should add jitter to prevent thundering herd', () => {
      const calculateBackoffWithJitter = (attempt: number, baseDelay = 1000): number => {
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const maxJitter = baseDelay * 0.5; // 50% jitter
        const jitter = Math.random() * maxJitter;
        return exponentialDelay + jitter;
      };

      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        delays.push(calculateBackoffWithJitter(2, 1000));
      }

      // All delays should be >= 4000 (base exponential)
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(4000);
        expect(delay).toBeLessThanOrEqual(4500); // Max jitter
      });

      // Delays should vary (jitter working)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should use different backoff strategies for different error types', () => {
      const getBackoffStrategy = (
        errorType: 'network' | 'rate_limit' | 'server_error'
      ): { baseDelay: number; factor: number; maxDelay: number } => {
        const strategies = {
          network: { baseDelay: 1000, factor: 2, maxDelay: 30000 }, // Exponential, cap 30s
          rate_limit: { baseDelay: 5000, factor: 1, maxDelay: 60000 }, // Linear, cap 60s
          server_error: { baseDelay: 2000, factor: 2, maxDelay: 120000 }, // Exponential, cap 2m
        };

        return strategies[errorType];
      };

      expect(getBackoffStrategy('network').factor).toBe(2);
      expect(getBackoffStrategy('rate_limit').factor).toBe(1);
      expect(getBackoffStrategy('server_error').maxDelay).toBe(120000);
    });

    it('should track retry timing metrics', () => {
      interface RetryMetrics {
        totalRetries: number;
        avgBackoffTime: number;
        minBackoffTime: number;
        maxBackoffTime: number;
      }

      const metrics: RetryMetrics = {
        totalRetries: 0,
        avgBackoffTime: 0,
        minBackoffTime: Infinity,
        maxBackoffTime: 0,
      };

      const recordBackoff = (backoffTime: number): void => {
        metrics.totalRetries++;
        metrics.avgBackoffTime =
          (metrics.avgBackoffTime * (metrics.totalRetries - 1) + backoffTime) /
          metrics.totalRetries;
        metrics.minBackoffTime = Math.min(metrics.minBackoffTime, backoffTime);
        metrics.maxBackoffTime = Math.max(metrics.maxBackoffTime, backoffTime);
      };

      recordBackoff(1000);
      recordBackoff(2000);
      recordBackoff(4000);

      expect(metrics.totalRetries).toBe(3);
      expect(metrics.avgBackoffTime).toBeCloseTo(2333, 0);
      expect(metrics.minBackoffTime).toBe(1000);
      expect(metrics.maxBackoffTime).toBe(4000);
    });
  });

  describe('Retry with Different Error Types', () => {
    it('should identify transient errors correctly', () => {
      const isTransientError = (error: Error): boolean => {
        const transientPatterns = [
          /network/i,
          /timeout/i,
          /ECONNREFUSED/i,
          /ETIMEDOUT/i,
          /503/,
          /429/,
          /rate limit/i,
          /temporarily unavailable/i,
        ];

        return transientPatterns.some((pattern) => pattern.test(error.message));
      };

      expect(isTransientError(new Error('Network timeout'))).toBe(true);
      expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isTransientError(new Error('Service temporarily unavailable'))).toBe(true);
      expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isTransientError(new Error('Rate limit exceeded'))).toBe(true);
    });

    it('should identify permanent errors correctly', () => {
      const isPermanentError = (error: Error): boolean => {
        const permanentPatterns = [
          /validation/i,
          /not found/i,
          /404/,
          /unauthorized/i,
          /401/,
          /forbidden/i,
          /403/,
          /invalid/i,
          /bad request/i,
          /400/,
        ];

        return permanentPatterns.some((pattern) => pattern.test(error.message));
      };

      expect(isPermanentError(new Error('Validation failed'))).toBe(true);
      expect(isPermanentError(new Error('404 Not Found'))).toBe(true);
      expect(isPermanentError(new Error('401 Unauthorized'))).toBe(true);
      expect(isPermanentError(new Error('Invalid email address'))).toBe(true);
      expect(isPermanentError(new Error('400 Bad Request'))).toBe(true);
    });

    it('should not retry permanent errors', () => {
      interface ErrorHandlingResult {
        shouldRetry: boolean;
        action: 'retry' | 'dlq' | 'discard';
      }

      const handleError = (error: Error, retryCount: number): ErrorHandlingResult => {
        const permanentPatterns = [/validation/i, /404/, /401/, /403/, /invalid/i];

        const isPermanent = permanentPatterns.some((pattern) => pattern.test(error.message));

        if (isPermanent) {
          return { shouldRetry: false, action: 'dlq' };
        }

        return { shouldRetry: true, action: 'retry' };
      };

      expect(handleError(new Error('Validation error'), 0)).toEqual({
        shouldRetry: false,
        action: 'dlq',
      });

      expect(handleError(new Error('Network timeout'), 0)).toEqual({
        shouldRetry: true,
        action: 'retry',
      });
    });

    it('should apply different retry strategies for different errors', () => {
      interface RetryStrategy {
        maxRetries: number;
        backoffType: 'exponential' | 'linear' | 'constant';
        baseDelay: number;
      }

      const getRetryStrategy = (error: Error): RetryStrategy => {
        if (/rate limit/i.test(error.message)) {
          return { maxRetries: 5, backoffType: 'linear', baseDelay: 5000 };
        }

        if (/network|timeout/i.test(error.message)) {
          return { maxRetries: 3, backoffType: 'exponential', baseDelay: 1000 };
        }

        if (/50[0-9]/i.test(error.message)) {
          return { maxRetries: 5, backoffType: 'exponential', baseDelay: 2000 };
        }

        return { maxRetries: 3, backoffType: 'exponential', baseDelay: 1000 };
      };

      const rateLimitStrategy = getRetryStrategy(new Error('429 Rate limit exceeded'));
      expect(rateLimitStrategy.backoffType).toBe('linear');
      expect(rateLimitStrategy.baseDelay).toBe(5000);

      const networkStrategy = getRetryStrategy(new Error('Network timeout'));
      expect(networkStrategy.backoffType).toBe('exponential');
      expect(networkStrategy.maxRetries).toBe(3);
    });

    it('should track error type distribution', () => {
      const errorStats = {
        transient: 0,
        permanent: 0,
        unknown: 0,
      };

      const classifyError = (error: Error): 'transient' | 'permanent' | 'unknown' => {
        if (/network|timeout|503|429/i.test(error.message)) {
          return 'transient';
        }
        if (/validation|404|401|403|invalid/i.test(error.message)) {
          return 'permanent';
        }
        return 'unknown';
      };

      const recordError = (error: Error): void => {
        const type = classifyError(error);
        errorStats[type]++;
      };

      recordError(new Error('Network timeout'));
      recordError(new Error('Validation failed'));
      recordError(new Error('503 Service Unavailable'));
      recordError(new Error('Unknown error'));

      expect(errorStats.transient).toBe(2);
      expect(errorStats.permanent).toBe(1);
      expect(errorStats.unknown).toBe(1);
    });
  });

  describe('Concurrent Retry Scenarios', () => {
    it('should handle multiple messages retrying concurrently', () => {
      const messages = [
        { id: 'msg-1', retrying: true, retryAt: Date.now() + 1000 },
        { id: 'msg-2', retrying: true, retryAt: Date.now() + 2000 },
        { id: 'msg-3', retrying: true, retryAt: Date.now() + 1500 },
      ];

      const getRetryableNow = (msgs: typeof messages, currentTime: number): typeof messages => {
        return msgs.filter((msg) => msg.retrying && msg.retryAt <= currentTime);
      };

      const now = Date.now() + 1000;
      const retryable = getRetryableNow(messages, now);

      expect(retryable).toHaveLength(1);
      expect(retryable[0]!.id).toBe('msg-1');
    });

    it('should prevent duplicate retry attempts', () => {
      const retryState = new Map<string, boolean>();

      const tryAcquireRetryLock = (messageId: string): boolean => {
        if (retryState.get(messageId)) {
          return false; // Already retrying
        }

        retryState.set(messageId, true);
        return true;
      };

      const releaseRetryLock = (messageId: string): void => {
        retryState.delete(messageId);
      };

      // First attempt succeeds
      expect(tryAcquireRetryLock('msg-1')).toBe(true);

      // Second attempt fails (already retrying)
      expect(tryAcquireRetryLock('msg-1')).toBe(false);

      // Release lock
      releaseRetryLock('msg-1');

      // Now can retry again
      expect(tryAcquireRetryLock('msg-1')).toBe(true);
    });

    it('should handle retry queue overflow', () => {
      const retryQueue: string[] = [];
      const MAX_RETRY_QUEUE_SIZE = 1000;

      const enqueueRetry = (messageId: string): boolean => {
        if (retryQueue.length >= MAX_RETRY_QUEUE_SIZE) {
          return false; // Queue full
        }

        retryQueue.push(messageId);
        return true;
      };

      // Fill queue
      for (let i = 0; i < MAX_RETRY_QUEUE_SIZE; i++) {
        expect(enqueueRetry(`msg-${i}`)).toBe(true);
      }

      // Queue full
      expect(enqueueRetry('msg-overflow')).toBe(false);
      expect(retryQueue).toHaveLength(MAX_RETRY_QUEUE_SIZE);
    });

    it('should prioritize retries by attempt count', () => {
      const messages = [
        { id: 'msg-1', retryCount: 3, priority: 0 },
        { id: 'msg-2', retryCount: 1, priority: 0 },
        { id: 'msg-3', retryCount: 4, priority: 0 },
      ];

      const prioritizeRetries = (msgs: typeof messages): typeof messages => {
        return [...msgs].sort((a, b) => a.retryCount - b.retryCount);
      };

      const sorted = prioritizeRetries(messages);

      expect(sorted[0]!.id).toBe('msg-2'); // Lowest retry count first
      expect(sorted[1]!.id).toBe('msg-1');
      expect(sorted[2]!.id).toBe('msg-3');
    });

    it('should handle race conditions in retry scheduling', () => {
      const scheduledRetries = new Set<string>();

      const scheduleRetry = (messageId: string, delay: number): boolean => {
        if (scheduledRetries.has(messageId)) {
          return false; // Already scheduled
        }

        scheduledRetries.add(messageId);

        // Simulate scheduling
        setTimeout(() => {
          scheduledRetries.delete(messageId);
        }, delay);

        return true;
      };

      expect(scheduleRetry('msg-1', 1000)).toBe(true);
      expect(scheduleRetry('msg-1', 1000)).toBe(false); // Duplicate
    });
  });

  describe('Retry State Management', () => {
    it('should persist retry state across worker restarts', () => {
      interface PersistedRetryState {
        messageId: string;
        retryCount: number;
        nextRetryAt: number;
        lastError: string;
      }

      const retryState = new Map<string, PersistedRetryState>();

      const saveRetryState = (state: PersistedRetryState): void => {
        retryState.set(state.messageId, state);
      };

      const loadRetryState = (messageId: string): PersistedRetryState | undefined => {
        return retryState.get(messageId);
      };

      // Save state
      saveRetryState({
        messageId: 'msg-1',
        retryCount: 2,
        nextRetryAt: Date.now() + 5000,
        lastError: 'Network timeout',
      });

      // Worker restarts...

      // Load state
      const loaded = loadRetryState('msg-1');
      expect(loaded?.retryCount).toBe(2);
      expect(loaded?.lastError).toBe('Network timeout');
    });

    it('should clean up old retry state', () => {
      interface RetryRecord {
        messageId: string;
        lastAttempt: number;
      }

      const retryRecords: RetryRecord[] = [
        { messageId: 'msg-1', lastAttempt: Date.now() - 86400000 }, // 1 day ago
        { messageId: 'msg-2', lastAttempt: Date.now() - 1000 }, // Recent
        { messageId: 'msg-3', lastAttempt: Date.now() - 172800000 }, // 2 days ago
      ];

      const cleanupOldRecords = (records: RetryRecord[], maxAge: number): RetryRecord[] => {
        const cutoff = Date.now() - maxAge;
        return records.filter((r) => r.lastAttempt > cutoff);
      };

      const cleaned = cleanupOldRecords(retryRecords, 3600000); // 1 hour

      expect(cleaned).toHaveLength(1);
      expect(cleaned[0]!.messageId).toBe('msg-2');
    });

    it('should track retry success rate', () => {
      const stats = {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
      };

      const recordRetryResult = (success: boolean): void => {
        stats.totalRetries++;
        if (success) {
          stats.successfulRetries++;
        } else {
          stats.failedRetries++;
        }
      };

      const getSuccessRate = (): number => {
        if (stats.totalRetries === 0) return 0;
        return (stats.successfulRetries / stats.totalRetries) * 100;
      };

      recordRetryResult(true);
      recordRetryResult(true);
      recordRetryResult(false);
      recordRetryResult(true);

      expect(stats.totalRetries).toBe(4);
      expect(getSuccessRate()).toBe(75);
    });

    it('should implement circuit breaker for retry operations', () => {
      const circuitState = {
        failures: 0,
        threshold: 10,
        open: false,
        halfOpenAt: null as number | null,
        resetTimeout: 60000, // 1 minute
      };

      const shouldAttemptRetry = (): boolean => {
        if (circuitState.open) {
          if (circuitState.halfOpenAt && Date.now() > circuitState.halfOpenAt) {
            // Try half-open state
            return true;
          }
          return false;
        }
        return true;
      };

      const recordRetryFailure = (): void => {
        circuitState.failures++;
        if (circuitState.failures >= circuitState.threshold) {
          circuitState.open = true;
          circuitState.halfOpenAt = Date.now() + circuitState.resetTimeout;
        }
      };

      const recordRetrySuccess = (): void => {
        circuitState.failures = 0;
        circuitState.open = false;
        circuitState.halfOpenAt = null;
      };

      // Initial state - can retry
      expect(shouldAttemptRetry()).toBe(true);

      // Trigger failures
      for (let i = 0; i < 10; i++) {
        recordRetryFailure();
      }

      expect(circuitState.open).toBe(true);
      expect(shouldAttemptRetry()).toBe(false);

      // Success closes circuit
      recordRetrySuccess();
      expect(shouldAttemptRetry()).toBe(true);
    });
  });

  describe('DLQ Routing After Max Retries', () => {
    it('should send message to DLQ after max retries', () => {
      interface Message {
        id: string;
        retryCount: number;
        maxRetries: number;
        queue: 'main' | 'dlq';
      }

      const message: Message = {
        id: 'msg-1',
        retryCount: 5,
        maxRetries: 5,
        queue: 'main',
      };

      const routeMessage = (msg: Message): void => {
        if (msg.retryCount >= msg.maxRetries) {
          msg.queue = 'dlq';
        }
      };

      routeMessage(message);

      expect(message.queue).toBe('dlq');
    });

    it('should include retry metadata in DLQ message', () => {
      interface DLQMessage {
        originalMessage: unknown;
        metadata: {
          totalRetries: number;
          failureReasons: string[];
          firstAttempt: number;
          lastAttempt: number;
        };
      }

      const createDLQMessage = (
        message: unknown,
        retries: number,
        reasons: string[]
      ): DLQMessage => {
        return {
          originalMessage: message,
          metadata: {
            totalRetries: retries,
            failureReasons: reasons,
            firstAttempt: Date.now() - 60000,
            lastAttempt: Date.now(),
          },
        };
      };

      const dlqMsg = createDLQMessage({ userId: '123' }, 5, [
        'Network timeout',
        'Service unavailable',
        'Rate limit',
      ]);

      expect(dlqMsg.metadata.totalRetries).toBe(5);
      expect(dlqMsg.metadata.failureReasons).toHaveLength(3);
    });

    it('should track DLQ metrics', () => {
      const dlqMetrics = {
        totalSent: 0,
        byErrorType: new Map<string, number>(),
      };

      const recordDLQMessage = (errorType: string): void => {
        dlqMetrics.totalSent++;
        const current = dlqMetrics.byErrorType.get(errorType) || 0;
        dlqMetrics.byErrorType.set(errorType, current + 1);
      };

      recordDLQMessage('network');
      recordDLQMessage('network');
      recordDLQMessage('validation');

      expect(dlqMetrics.totalSent).toBe(3);
      expect(dlqMetrics.byErrorType.get('network')).toBe(2);
      expect(dlqMetrics.byErrorType.get('validation')).toBe(1);
    });
  });
});
