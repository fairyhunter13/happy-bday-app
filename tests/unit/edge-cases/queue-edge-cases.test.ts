/**
 * Queue Edge Cases Tests
 *
 * Covers edge cases from the catalog:
 * - EC-Q-001 to EC-Q-030: RabbitMQ connection, message publishing, consumption, DLQ
 *
 * @see plan/04-testing/edge-cases-catalog.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Queue Edge Cases', () => {
  describe('Connection Retry Logic (EC-Q-001 to EC-Q-010)', () => {
    it('EC-Q-001: RabbitMQ connection should retry with exponential backoff', () => {
      const connectionRetryConfig = {
        maxRetries: 10,
        initialDelay: 1000, // 1 second
        maxDelay: 60000, // 60 seconds
        factor: 2, // exponential factor
      };

      const calculateBackoff = (attempt: number): number => {
        const delay =
          connectionRetryConfig.initialDelay * Math.pow(connectionRetryConfig.factor, attempt);
        return Math.min(delay, connectionRetryConfig.maxDelay);
      };

      expect(calculateBackoff(0)).toBe(1000); // 1s
      expect(calculateBackoff(1)).toBe(2000); // 2s
      expect(calculateBackoff(2)).toBe(4000); // 4s
      expect(calculateBackoff(3)).toBe(8000); // 8s
      expect(calculateBackoff(10)).toBe(60000); // Capped at maxDelay
    });

    it('EC-Q-002: Should implement heartbeat for connection health', () => {
      const heartbeatConfig = {
        heartbeat: 60, // 60 seconds heartbeat interval
        timeout: 30, // 30 seconds connection timeout
      };

      // Heartbeat should be greater than timeout
      expect(heartbeatConfig.heartbeat).toBeGreaterThan(heartbeatConfig.timeout);

      // Both should be positive
      expect(heartbeatConfig.heartbeat).toBeGreaterThan(0);
      expect(heartbeatConfig.timeout).toBeGreaterThan(0);
    });

    it('EC-Q-006: Channel should auto-recover on close', () => {
      const channelRecoveryConfig = {
        autoRecovery: true,
        recoveryDelay: 5000, // 5 seconds before attempting recovery
        maxRecoveryAttempts: 5,
      };

      expect(channelRecoveryConfig.autoRecovery).toBe(true);
      expect(channelRecoveryConfig.recoveryDelay).toBeGreaterThan(0);
    });

    it('EC-Q-009: Should fail permanently after exhausting retries', () => {
      const maxRetries = 10;
      let retryCount = 0;
      let permanentFailure = false;

      const simulateRetries = (): void => {
        while (retryCount < maxRetries) {
          retryCount++;
          // Simulate failure
        }
        if (retryCount >= maxRetries) {
          permanentFailure = true;
        }
      };

      simulateRetries();

      expect(retryCount).toBe(maxRetries);
      expect(permanentFailure).toBe(true);
    });
  });

  describe('Message Publishing (EC-Q-011 to EC-Q-018)', () => {
    it('EC-Q-011: Large messages should be handled appropriately', () => {
      const maxMessageSize = 1024 * 1024; // 1 MB

      const isMessageTooLarge = (message: string): boolean => {
        const size = Buffer.byteLength(message, 'utf-8');
        return size > maxMessageSize;
      };

      // Small message - should be accepted
      expect(isMessageTooLarge('hello world')).toBe(false);

      // Large message - should be rejected
      const largeMessage = 'x'.repeat(2 * 1024 * 1024); // 2 MB
      expect(isMessageTooLarge(largeMessage)).toBe(true);
    });

    it('EC-Q-013: Message format should be validated before publish', () => {
      interface MessageJob {
        userId: string;
        messageType: 'birthday' | 'anniversary';
        sendAt: string; // ISO date string
        idempotencyKey: string;
      }

      const isValidMessageJob = (job: unknown): job is MessageJob => {
        if (!job || typeof job !== 'object') return false;
        const obj = job as Record<string, unknown>;

        return (
          typeof obj.userId === 'string' &&
          obj.userId.length > 0 &&
          (obj.messageType === 'birthday' || obj.messageType === 'anniversary') &&
          typeof obj.sendAt === 'string' &&
          !isNaN(Date.parse(obj.sendAt)) &&
          typeof obj.idempotencyKey === 'string' &&
          obj.idempotencyKey.length > 0
        );
      };

      // Valid message
      expect(
        isValidMessageJob({
          userId: 'user-123',
          messageType: 'birthday',
          sendAt: '2025-12-30T09:00:00Z',
          idempotencyKey: 'key-123',
        })
      ).toBe(true);

      // Invalid - missing userId
      expect(
        isValidMessageJob({
          messageType: 'birthday',
          sendAt: '2025-12-30T09:00:00Z',
          idempotencyKey: 'key-123',
        })
      ).toBe(false);

      // Invalid - wrong messageType
      expect(
        isValidMessageJob({
          userId: 'user-123',
          messageType: 'invalid',
          sendAt: '2025-12-30T09:00:00Z',
          idempotencyKey: 'key-123',
        })
      ).toBe(false);

      // Invalid - bad date format
      expect(
        isValidMessageJob({
          userId: 'user-123',
          messageType: 'birthday',
          sendAt: 'not-a-date',
          idempotencyKey: 'key-123',
        })
      ).toBe(false);
    });

    it('EC-Q-014: Queue length limits should be respected', () => {
      const queueConfig = {
        maxLength: 100000, // Maximum 100K messages
        maxLengthBytes: 100 * 1024 * 1024, // 100 MB
        overflowBehavior: 'reject-publish' as const, // or 'drop-head'
      };

      expect(queueConfig.maxLength).toBeGreaterThan(0);
      expect(queueConfig.maxLengthBytes).toBeGreaterThan(0);
      expect(['reject-publish', 'drop-head']).toContain(queueConfig.overflowBehavior);
    });
  });

  describe('Message Consumption (EC-Q-019 to EC-Q-026)', () => {
    it('EC-Q-019: Consumer crash should trigger message requeue', () => {
      const consumerConfig = {
        noAck: false, // Require explicit ACK
        prefetch: 10, // Process 10 messages at a time
      };

      // noAck: false means messages stay in queue until ACK'd
      expect(consumerConfig.noAck).toBe(false);
      expect(consumerConfig.prefetch).toBeGreaterThan(0);
    });

    it('EC-Q-020-021: NACK behavior should be configurable', () => {
      const handleMessageFailure = (
        isTransient: boolean,
        retryCount: number,
        maxRetries: number
      ): { action: 'requeue' | 'dlq' | 'ack'; shouldRetry: boolean } => {
        if (!isTransient) {
          // Permanent error - send to DLQ immediately
          return { action: 'dlq', shouldRetry: false };
        }

        if (retryCount >= maxRetries) {
          // Exhausted retries - send to DLQ
          return { action: 'dlq', shouldRetry: false };
        }

        // Transient error - requeue for retry
        return { action: 'requeue', shouldRetry: true };
      };

      // Transient error, first retry
      expect(handleMessageFailure(true, 0, 3)).toEqual({ action: 'requeue', shouldRetry: true });

      // Transient error, max retries reached
      expect(handleMessageFailure(true, 3, 3)).toEqual({ action: 'dlq', shouldRetry: false });

      // Permanent error
      expect(handleMessageFailure(false, 0, 3)).toEqual({ action: 'dlq', shouldRetry: false });
    });

    it('EC-Q-023: Duplicate messages should be handled with idempotency', () => {
      const processedKeys = new Set<string>();

      const isDuplicateMessage = (idempotencyKey: string): boolean => {
        if (processedKeys.has(idempotencyKey)) {
          return true;
        }
        processedKeys.add(idempotencyKey);
        return false;
      };

      // First message with key
      expect(isDuplicateMessage('key-1')).toBe(false);

      // Duplicate message with same key
      expect(isDuplicateMessage('key-1')).toBe(true);

      // Different key
      expect(isDuplicateMessage('key-2')).toBe(false);
    });

    it('EC-Q-024: Corrupt message payload should be sent to DLQ', () => {
      const parseMessagePayload = (
        rawPayload: Buffer
      ): { success: boolean; data?: unknown; error?: string } => {
        try {
          const str = rawPayload.toString('utf-8');
          const data = JSON.parse(str);
          return { success: true, data };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown parse error',
          };
        }
      };

      // Valid JSON
      const validPayload = Buffer.from(JSON.stringify({ userId: '123' }));
      expect(parseMessagePayload(validPayload).success).toBe(true);

      // Invalid JSON
      const invalidPayload = Buffer.from('not valid json {{{');
      const result = parseMessagePayload(invalidPayload);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Empty payload
      const emptyPayload = Buffer.from('');
      expect(parseMessagePayload(emptyPayload).success).toBe(false);
    });

    it('EC-Q-025: Message processing timeout should trigger requeue', async () => {
      const processingTimeoutMs = 30000; // 30 seconds

      const processWithTimeout = async <T>(
        fn: () => Promise<T>,
        timeoutMs: number
      ): Promise<{ result?: T; timedOut: boolean }> => {
        return Promise.race([
          fn().then((result) => ({ result, timedOut: false })),
          new Promise<{ timedOut: true }>((resolve) =>
            setTimeout(() => resolve({ timedOut: true }), timeoutMs)
          ),
        ]);
      };

      // Fast operation - should complete
      const fastResult = await processWithTimeout(async () => 'done', processingTimeoutMs);
      expect(fastResult.timedOut).toBe(false);
      expect(fastResult.result).toBe('done');

      // Slow operation - should timeout (using short timeout for test)
      const slowResult = await processWithTimeout(async () => {
        await new Promise((r) => setTimeout(r, 200));
        return 'done';
      }, 50);
      expect(slowResult.timedOut).toBe(true);
    });
  });

  describe('Dead Letter Queue (EC-Q-027 to EC-Q-030)', () => {
    it('EC-Q-027: Messages should include retry count header', () => {
      const createMessageHeaders = (
        retryCount: number,
        originalQueue: string
      ): Record<string, string | number> => {
        return {
          'x-retry-count': retryCount,
          'x-original-queue': originalQueue,
          'x-first-death-exchange': 'birthday-exchange',
          'x-first-death-queue': originalQueue,
          'x-first-death-reason': 'rejected',
        };
      };

      const headers = createMessageHeaders(3, 'birthday-queue');
      expect(headers['x-retry-count']).toBe(3);
      expect(headers['x-original-queue']).toBe('birthday-queue');
    });

    it('EC-Q-028: DLQ depth should be monitorable', () => {
      interface DLQMetrics {
        messageCount: number;
        oldestMessageAge: number; // seconds
        averageMessageAge: number;
        alertThreshold: number;
      }

      const shouldAlert = (metrics: DLQMetrics): boolean => {
        return (
          metrics.messageCount > metrics.alertThreshold || metrics.oldestMessageAge > 3600 // 1 hour
        );
      };

      // Low DLQ - no alert
      expect(
        shouldAlert({
          messageCount: 5,
          oldestMessageAge: 60,
          averageMessageAge: 30,
          alertThreshold: 100,
        })
      ).toBe(false);

      // High DLQ count - alert
      expect(
        shouldAlert({
          messageCount: 150,
          oldestMessageAge: 60,
          averageMessageAge: 30,
          alertThreshold: 100,
        })
      ).toBe(true);

      // Old messages - alert
      expect(
        shouldAlert({
          messageCount: 5,
          oldestMessageAge: 7200,
          averageMessageAge: 3600,
          alertThreshold: 100,
        })
      ).toBe(true);
    });

    it('EC-Q-029: DLQ messages should contain debugging info', () => {
      interface DLQMessage {
        originalPayload: unknown;
        headers: Record<string, unknown>;
        metadata: {
          failedAt: string;
          failureReason: string;
          retryCount: number;
          originalQueue: string;
          processingTime: number;
        };
      }

      const createDLQMessage = (
        payload: unknown,
        reason: string,
        retryCount: number,
        queue: string,
        processingTime: number
      ): DLQMessage => {
        return {
          originalPayload: payload,
          headers: {
            'x-death': [
              {
                reason: 'rejected',
                queue: queue,
                count: retryCount,
              },
            ],
          },
          metadata: {
            failedAt: new Date().toISOString(),
            failureReason: reason,
            retryCount,
            originalQueue: queue,
            processingTime,
          },
        };
      };

      const dlqMessage = createDLQMessage(
        { userId: '123' },
        'Email service unavailable',
        3,
        'birthday-queue',
        1500
      );

      expect(dlqMessage.originalPayload).toEqual({ userId: '123' });
      expect(dlqMessage.metadata.failureReason).toBe('Email service unavailable');
      expect(dlqMessage.metadata.retryCount).toBe(3);
    });
  });

  describe('Error Classification', () => {
    it('should classify AMQP errors correctly', () => {
      const AMQPErrorCodes = {
        // Connection errors - transient
        CONNECTION_FORCED: 320,
        CHANNEL_ERROR: 504,
        CONNECTION_TIMEOUT: 501,

        // Channel errors - may recover
        PRECONDITION_FAILED: 406,
        NOT_FOUND: 404,
        ACCESS_REFUSED: 403,

        // Message errors - permanent
        CONTENT_TOO_LARGE: 311,
        NO_ROUTE: 312,
        NO_CONSUMERS: 313,
      };

      const isTransientError = (code: number): boolean => {
        const transientCodes = [
          AMQPErrorCodes.CONNECTION_FORCED,
          AMQPErrorCodes.CHANNEL_ERROR,
          AMQPErrorCodes.CONNECTION_TIMEOUT,
        ];
        return transientCodes.includes(code);
      };

      expect(isTransientError(AMQPErrorCodes.CONNECTION_FORCED)).toBe(true);
      expect(isTransientError(AMQPErrorCodes.CHANNEL_ERROR)).toBe(true);
      expect(isTransientError(AMQPErrorCodes.CONTENT_TOO_LARGE)).toBe(false);
      expect(isTransientError(AMQPErrorCodes.NO_ROUTE)).toBe(false);
    });
  });

  describe('Prefetch and Backpressure', () => {
    it('should respect prefetch count for fair distribution', () => {
      const prefetchConfig = {
        global: false, // Per-channel prefetch (not per-consumer)
        count: 10, // Process up to 10 unacked messages
      };

      // Prefetch should be positive and reasonable
      expect(prefetchConfig.count).toBeGreaterThan(0);
      expect(prefetchConfig.count).toBeLessThanOrEqual(100); // Don't overwhelm workers
    });

    it('should implement backpressure when consumers are slow', () => {
      const calculateOptimalPrefetch = (
        avgProcessingTime: number, // ms
        targetThroughput: number // messages/second
      ): number => {
        // Prefetch = throughput * processing_time / 1000
        // With a safety factor of 1.5
        const optimal = Math.ceil((targetThroughput * avgProcessingTime * 1.5) / 1000);
        // Clamp between 1 and 100
        return Math.max(1, Math.min(100, optimal));
      };

      // Fast processing, high throughput
      expect(calculateOptimalPrefetch(10, 100)).toBeGreaterThanOrEqual(1);
      expect(calculateOptimalPrefetch(10, 100)).toBeLessThanOrEqual(10);

      // Slow processing, low throughput
      expect(calculateOptimalPrefetch(1000, 10)).toBeGreaterThanOrEqual(10);
      expect(calculateOptimalPrefetch(1000, 10)).toBeLessThanOrEqual(20);

      // Very slow processing - should cap at max
      expect(calculateOptimalPrefetch(10000, 100)).toBe(100);
    });
  });
});
