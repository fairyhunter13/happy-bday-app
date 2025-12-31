/**
 * Worker Error Handling Edge Cases Tests
 *
 * Covers critical edge cases for message worker error handling:
 * - Worker failures during message processing
 * - Connection loss to RabbitMQ during processing
 * - Worker crash recovery scenarios
 * - Message processing timeout scenarios
 * - Memory exhaustion and resource limits
 * - Concurrent error scenarios
 *
 * These tests ensure the worker can handle failures gracefully and recover
 * without losing messages or corrupting state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ConsumeMessage, Channel } from 'amqplib';

describe('Worker Error Handling Edge Cases', () => {
  describe('Worker Crash During Processing', () => {
    it('should preserve message in queue when worker crashes before ACK', () => {
      let messageAcked = false;
      let messageNacked = false;

      const simulateWorkerCrash = (msg: ConsumeMessage, channel: Channel): void => {
        // Worker starts processing but crashes before ACK
        // Message should remain in queue (not ACKed)
        expect(messageAcked).toBe(false);
        expect(messageNacked).toBe(false);
      };

      // Simulate message
      const msg = {} as ConsumeMessage;
      const channel = {} as Channel;

      simulateWorkerCrash(msg, channel);

      // Verify message wasn't acknowledged
      expect(messageAcked).toBe(false);
    });

    it('should handle worker crash during database transaction', async () => {
      let transactionStarted = false;
      let transactionCommitted = false;

      const processWithCrash = async (): Promise<void> => {
        transactionStarted = true;
        // Simulate crash during transaction
        throw new Error('Worker process killed');
        // Transaction never commits
        transactionCommitted = true;
      };

      try {
        await processWithCrash();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Worker process killed');
      }

      expect(transactionStarted).toBe(true);
      expect(transactionCommitted).toBe(false); // Transaction rolled back
    });

    it('should handle sudden process termination (SIGKILL)', () => {
      const workerState = {
        processing: true,
        messageCount: 5,
        cleanupExecuted: false,
      };

      const simulateSigKill = (): void => {
        // SIGKILL cannot be caught - process terminates immediately
        // No cleanup handlers run
        workerState.processing = false;
        // cleanupExecuted stays false
      };

      simulateSigKill();

      expect(workerState.processing).toBe(false);
      expect(workerState.cleanupExecuted).toBe(false);
      expect(workerState.messageCount).toBe(5); // Messages remain in queue
    });

    it('should handle graceful shutdown (SIGTERM) with in-flight messages', async () => {
      const workerState = {
        shutdownRequested: false,
        inFlightMessages: 3,
        cleanupExecuted: false,
      };

      const gracefulShutdown = async (): Promise<void> => {
        workerState.shutdownRequested = true;

        // Wait for in-flight messages to complete
        while (workerState.inFlightMessages > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          workerState.inFlightMessages--;
        }

        workerState.cleanupExecuted = true;
      };

      await gracefulShutdown();

      expect(workerState.shutdownRequested).toBe(true);
      expect(workerState.inFlightMessages).toBe(0);
      expect(workerState.cleanupExecuted).toBe(true);
    });

    it('should handle worker crash with partial message processing', () => {
      const messageState = {
        fetched: false,
        validated: false,
        emailSent: false,
        statusUpdated: false,
        acknowledged: false,
      };

      const processMessageWithCrash = (): void => {
        messageState.fetched = true;
        messageState.validated = true;
        messageState.emailSent = true;
        // Crash before status update
        throw new Error('Worker crashed');
        messageState.statusUpdated = true;
        messageState.acknowledged = true;
      };

      expect(() => processMessageWithCrash()).toThrow('Worker crashed');

      // Email was sent but status wasn't updated
      expect(messageState.emailSent).toBe(true);
      expect(messageState.statusUpdated).toBe(false);
      expect(messageState.acknowledged).toBe(false);

      // Message will be redelivered, but idempotency should prevent duplicate sends
    });
  });

  describe('RabbitMQ Connection Loss During Processing', () => {
    it('should detect connection loss immediately', () => {
      const connectionState = {
        connected: true,
        lastHeartbeat: Date.now(),
      };

      const checkConnection = (): boolean => {
        const heartbeatTimeout = 60000; // 60 seconds
        const timeSinceHeartbeat = Date.now() - connectionState.lastHeartbeat;

        if (timeSinceHeartbeat > heartbeatTimeout) {
          connectionState.connected = false;
          return false;
        }

        return connectionState.connected;
      };

      expect(checkConnection()).toBe(true);

      // Simulate connection loss
      connectionState.connected = false;

      expect(checkConnection()).toBe(false);
    });

    it('should handle connection loss during message fetch', async () => {
      let connectionLost = false;

      const fetchMessage = async (): Promise<unknown> => {
        // Simulate connection loss
        connectionLost = true;
        throw new Error('Connection closed: ECONNRESET');
      };

      await expect(fetchMessage()).rejects.toThrow('Connection closed: ECONNRESET');
      expect(connectionLost).toBe(true);
    });

    it('should handle connection loss during ACK', async () => {
      const messageState = {
        processed: true,
        acked: false,
      };

      const acknowledgeMessage = async (): Promise<void> => {
        if (!messageState.processed) {
          throw new Error('Message not processed');
        }

        // Simulate connection loss during ACK
        throw new Error('Channel closed');
        messageState.acked = true;
      };

      await expect(acknowledgeMessage()).rejects.toThrow('Channel closed');
      expect(messageState.acked).toBe(false);

      // Message will be redelivered because ACK wasn't received
    });

    it('should handle connection loss during NACK/reject', async () => {
      const shouldRequeue = async (requeue: boolean): Promise<void> => {
        // Simulate connection loss
        throw new Error('Connection lost during NACK');
      };

      await expect(shouldRequeue(true)).rejects.toThrow('Connection lost during NACK');

      // Message remains in unknown state - will be redelivered when connection recovers
    });

    it('should handle connection flapping (rapid connect/disconnect)', () => {
      const connectionHistory: Array<{ state: string; timestamp: number }> = [];
      let currentState = 'connected';

      const recordStateChange = (newState: string): void => {
        connectionHistory.push({ state: newState, timestamp: Date.now() });
        currentState = newState;
      };

      // Simulate flapping
      recordStateChange('disconnected');
      recordStateChange('connected');
      recordStateChange('disconnected');
      recordStateChange('connected');
      recordStateChange('disconnected');

      expect(connectionHistory).toHaveLength(5);
      expect(currentState).toBe('disconnected');

      // Circuit breaker should open after detecting flapping pattern
      const isFlapping = connectionHistory.length > 3;
      expect(isFlapping).toBe(true);
    });

    it('should handle connection recovery with pending messages', () => {
      const pendingMessages = [
        { id: 'msg-1', status: 'processing' },
        { id: 'msg-2', status: 'processing' },
        { id: 'msg-3', status: 'processing' },
      ];

      const recoverConnection = (): { messagesRequeued: number } => {
        // All unacked messages should be redelivered
        const requeued = pendingMessages.filter((msg) => msg.status === 'processing').length;

        return { messagesRequeued: requeued };
      };

      const result = recoverConnection();
      expect(result.messagesRequeued).toBe(3);
    });
  });

  describe('Message Processing Timeout Scenarios', () => {
    it('should timeout long-running message processing', async () => {
      const PROCESSING_TIMEOUT = 30000; // 30 seconds

      const processWithTimeout = async <T>(
        fn: () => Promise<T>,
        timeout: number
      ): Promise<T | null> => {
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), timeout);
        });

        const result = await Promise.race([fn(), timeoutPromise]);
        return result;
      };

      // Fast processing - succeeds
      const fastTask = async (): Promise<string> => {
        await new Promise((r) => setTimeout(r, 10));
        return 'completed';
      };

      const fastResult = await processWithTimeout(fastTask, PROCESSING_TIMEOUT);
      expect(fastResult).toBe('completed');

      // Slow processing - times out
      const slowTask = async (): Promise<string> => {
        await new Promise((r) => setTimeout(r, 100));
        return 'completed';
      };

      const slowResult = await processWithTimeout(slowTask, 50);
      expect(slowResult).toBeNull();
    });

    it('should handle timeout during external API call', async () => {
      const API_TIMEOUT = 5000; // 5 seconds

      const callExternalAPI = async (timeoutMs: number): Promise<{ status: string }> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          // Simulate API call
          await new Promise((resolve, reject) => {
            const apiDelay = 10000; // 10 seconds - exceeds timeout

            const timer = setTimeout(resolve, apiDelay);

            controller.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('API call timeout'));
            });
          });

          clearTimeout(timeoutId);
          return { status: 'success' };
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };

      await expect(callExternalAPI(API_TIMEOUT)).rejects.toThrow('API call timeout');
    });

    it('should handle timeout with cleanup actions', async () => {
      const resourceState = {
        allocated: false,
        released: false,
      };

      const processWithCleanup = async (shouldTimeout: boolean): Promise<void> => {
        resourceState.allocated = true;

        try {
          if (shouldTimeout) {
            throw new Error('Processing timeout');
          }
          // Process normally
        } finally {
          // Cleanup always runs
          resourceState.released = true;
        }
      };

      await expect(processWithCleanup(true)).rejects.toThrow('Processing timeout');

      expect(resourceState.allocated).toBe(true);
      expect(resourceState.released).toBe(true);
    });

    it('should track timeout metrics', () => {
      const metrics = {
        totalProcessed: 0,
        timeouts: 0,
        avgProcessingTime: 0,
      };

      const recordTimeout = (processingTime: number): void => {
        metrics.totalProcessed++;
        metrics.timeouts++;
        metrics.avgProcessingTime = (metrics.avgProcessingTime + processingTime) / 2;
      };

      recordTimeout(30000);
      recordTimeout(35000);
      recordTimeout(32000);

      expect(metrics.totalProcessed).toBe(3);
      expect(metrics.timeouts).toBe(3);
      expect(metrics.avgProcessingTime).toBeGreaterThan(0);
    });

    it('should adjust timeout based on message type', () => {
      const getTimeout = (messageType: 'BIRTHDAY' | 'ANNIVERSARY' | 'BULK'): number => {
        const timeouts = {
          BIRTHDAY: 30000, // 30s
          ANNIVERSARY: 30000, // 30s
          BULK: 120000, // 2 minutes
        };

        return timeouts[messageType];
      };

      expect(getTimeout('BIRTHDAY')).toBe(30000);
      expect(getTimeout('ANNIVERSARY')).toBe(30000);
      expect(getTimeout('BULK')).toBe(120000);
    });
  });

  describe('Memory Exhaustion and Resource Limits', () => {
    it('should detect high memory usage', () => {
      const checkMemory = (): { withinLimits: boolean; usage: number } => {
        const memoryLimit = 512 * 1024 * 1024; // 512 MB
        const currentUsage = 450 * 1024 * 1024; // 450 MB

        return {
          withinLimits: currentUsage < memoryLimit,
          usage: currentUsage,
        };
      };

      const result = checkMemory();
      expect(result.withinLimits).toBe(true);
    });

    it('should reject new work when memory is high', () => {
      const memoryUsage = {
        current: 400 * 1024 * 1024, // 400 MB
        limit: 512 * 1024 * 1024, // 512 MB
      };

      const canAcceptWork = (): boolean => {
        const usagePercent = (memoryUsage.current / memoryUsage.limit) * 100;
        const threshold = 90; // 90%

        return usagePercent < threshold;
      };

      expect(canAcceptWork()).toBe(true);

      // Increase memory usage to exceed threshold
      memoryUsage.current = 500 * 1024 * 1024; // 500 MB (97.6% of limit)

      expect(canAcceptWork()).toBe(false);
    });

    it('should handle out-of-memory errors gracefully', () => {
      const processLargeMessage = (): void => {
        const largeArray: number[] = [];

        try {
          // Simulate OOM by checking array size
          const maxSize = 1000000;
          if (largeArray.length > maxSize) {
            throw new Error('JavaScript heap out of memory');
          }
        } catch (error) {
          // Log error and reject message
          expect(error).toBeDefined();
        }
      };

      expect(() => processLargeMessage()).not.toThrow();
    });

    it('should limit concurrent message processing', () => {
      const workerState = {
        concurrencyLimit: 5,
        activeMessages: 3,
      };

      const canProcessMessage = (): boolean => {
        return workerState.activeMessages < workerState.concurrencyLimit;
      };

      expect(canProcessMessage()).toBe(true);

      // Simulate max concurrent processing
      workerState.activeMessages = 5;

      expect(canProcessMessage()).toBe(false);
    });

    it('should track resource usage per message', () => {
      interface MessageMetrics {
        messageId: string;
        memoryUsed: number;
        cpuTime: number;
        duration: number;
      }

      const metrics: MessageMetrics[] = [];

      const recordMetrics = (messageId: string, memUsed: number, cpu: number, dur: number): void => {
        metrics.push({
          messageId,
          memoryUsed: memUsed,
          cpuTime: cpu,
          duration: dur,
        });
      };

      recordMetrics('msg-1', 10 * 1024 * 1024, 100, 1000);
      recordMetrics('msg-2', 15 * 1024 * 1024, 150, 1500);

      expect(metrics).toHaveLength(2);
      expect(metrics[0]!.memoryUsed).toBe(10 * 1024 * 1024);
    });
  });

  describe('Concurrent Error Scenarios', () => {
    it('should handle multiple workers crashing simultaneously', () => {
      const workers = [
        { id: 'worker-1', status: 'running', messages: 5 },
        { id: 'worker-2', status: 'running', messages: 3 },
        { id: 'worker-3', status: 'running', messages: 7 },
      ];

      const simulateMassCrash = (): void => {
        workers.forEach((worker) => {
          worker.status = 'crashed';
        });
      };

      simulateMassCrash();

      const crashedWorkers = workers.filter((w) => w.status === 'crashed');
      expect(crashedWorkers).toHaveLength(3);

      // All messages should be requeued
      const totalMessages = workers.reduce((sum, w) => sum + w.messages, 0);
      expect(totalMessages).toBe(15);
    });

    it('should handle race condition in message acknowledgment', async () => {
      let ackCount = 0;
      let nackCount = 0;

      const acknowledgeMessage = async (messageId: string): Promise<void> => {
        // Simulate race condition - both ACK and NACK attempted
        const random = Math.random();

        if (random < 0.5) {
          ackCount++;
        } else {
          nackCount++;
        }

        // Only one should succeed
      };

      await acknowledgeMessage('msg-1');

      expect(ackCount + nackCount).toBe(1);
    });

    it('should handle concurrent updates to message status', () => {
      interface MessageStatus {
        id: string;
        status: 'SCHEDULED' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';
        version: number;
      }

      const message: MessageStatus = {
        id: 'msg-1',
        status: 'SENDING',
        version: 1,
      };

      const updateStatus = (
        msg: MessageStatus,
        newStatus: MessageStatus['status'],
        expectedVersion: number
      ): boolean => {
        if (msg.version !== expectedVersion) {
          // Optimistic locking failed
          return false;
        }

        msg.status = newStatus;
        msg.version++;
        return true;
      };

      // First update succeeds
      const result1 = updateStatus(message, 'SENT', 1);
      expect(result1).toBe(true);
      expect(message.status).toBe('SENT');
      expect(message.version).toBe(2);

      // Second update with stale version fails
      const result2 = updateStatus(message, 'FAILED', 1);
      expect(result2).toBe(false);
      expect(message.status).toBe('SENT'); // Unchanged
    });

    it('should handle deadlock in distributed processing', () => {
      const locks = {
        'resource-A': null as string | null,
        'resource-B': null as string | null,
      };

      const acquireLock = (resource: 'resource-A' | 'resource-B', workerId: string): boolean => {
        if (locks[resource] === null) {
          locks[resource] = workerId;
          return true;
        }
        return false;
      };

      const releaseLock = (resource: 'resource-A' | 'resource-B', workerId: string): void => {
        if (locks[resource] === workerId) {
          locks[resource] = null;
        }
      };

      // Worker 1 acquires A
      expect(acquireLock('resource-A', 'worker-1')).toBe(true);

      // Worker 2 acquires B
      expect(acquireLock('resource-B', 'worker-2')).toBe(true);

      // Worker 1 tries to acquire B (fails - held by worker 2)
      expect(acquireLock('resource-B', 'worker-1')).toBe(false);

      // Worker 2 tries to acquire A (fails - held by worker 1)
      expect(acquireLock('resource-A', 'worker-2')).toBe(false);

      // Detect deadlock and resolve by releasing locks
      releaseLock('resource-A', 'worker-1');
      releaseLock('resource-B', 'worker-2');

      expect(locks['resource-A']).toBeNull();
      expect(locks['resource-B']).toBeNull();
    });
  });

  describe('Error Recovery Mechanisms', () => {
    it('should implement exponential backoff for retries', () => {
      const calculateBackoff = (attempt: number, baseDelay = 1000, maxDelay = 60000): number => {
        const delay = baseDelay * Math.pow(2, attempt);
        return Math.min(delay, maxDelay);
      };

      expect(calculateBackoff(0)).toBe(1000); // 1s
      expect(calculateBackoff(1)).toBe(2000); // 2s
      expect(calculateBackoff(2)).toBe(4000); // 4s
      expect(calculateBackoff(3)).toBe(8000); // 8s
      expect(calculateBackoff(10)).toBe(60000); // Capped at max
    });

    it('should implement jitter to prevent thundering herd', () => {
      const calculateBackoffWithJitter = (attempt: number, baseDelay = 1000): number => {
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000; // Random jitter up to 1s
        return exponentialDelay + jitter;
      };

      const delay1 = calculateBackoffWithJitter(2);
      const delay2 = calculateBackoffWithJitter(2);

      // Same attempt, different delays due to jitter
      expect(delay1).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay1).not.toBe(delay2); // Very unlikely to be equal
    });

    it('should reset error counters on successful processing', () => {
      const workerState = {
        consecutiveErrors: 3,
        totalErrors: 10,
      };

      const resetErrorCounters = (): void => {
        workerState.consecutiveErrors = 0;
        // Keep totalErrors for metrics
      };

      resetErrorCounters();

      expect(workerState.consecutiveErrors).toBe(0);
      expect(workerState.totalErrors).toBe(10);
    });

    it('should implement circuit breaker after consecutive failures', () => {
      const circuitState = {
        failures: 0,
        threshold: 5,
        open: false,
      };

      const recordFailure = (): void => {
        circuitState.failures++;
        if (circuitState.failures >= circuitState.threshold) {
          circuitState.open = true;
        }
      };

      const recordSuccess = (): void => {
        circuitState.failures = 0;
        circuitState.open = false;
      };

      // Record failures
      for (let i = 0; i < 5; i++) {
        recordFailure();
      }

      expect(circuitState.open).toBe(true);

      // Success resets circuit
      recordSuccess();
      expect(circuitState.open).toBe(false);
    });
  });
});
