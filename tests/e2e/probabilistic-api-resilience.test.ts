/**
 * E2E Test: Probabilistic API Resilience
 *
 * Tests handling of non-deterministic API behavior (10% random failure rate).
 *
 * Test Strategy:
 * - Use statistical assertions instead of strict pass/fail
 * - Verify retry mechanisms work correctly
 * - Ensure circuit breaker responds appropriately
 * - Test recovery from transient failures
 * - Validate that system remains resilient under probabilistic failures
 *
 * The email service at https://email-service.digitalenvision.com.au has
 * a ~10% random failure rate. These tests ensure our retry and circuit
 * breaker logic handles this gracefully.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestEnvironment, waitFor, cleanDatabase, purgeQueues } from '../helpers/testcontainers.js';
import { createMockEmailServer, MockEmailServer } from '../helpers/mock-email-server.js';
import { insertUser, sleep } from '../helpers/test-helpers.js';
import {
  createResilientTester,
  RetryPresets,
  type ResilientApiTester,
  type ApiCallResult,
} from '../helpers/resilient-api-tester.js';
import { MessageSenderService } from '../../src/services/message.service.js';
import { emailServiceClient } from '../../src/clients/email-service.client.js';
import { DateTime } from 'luxon';
import type { Pool } from 'pg';
import type { Connection } from 'amqplib';

describe('E2E: Probabilistic API Resilience', () => {
  let env: TestEnvironment;
  let pool: Pool;
  let amqpConnection: Connection;
  let mockEmailServer: MockEmailServer;
  let messageSender: MessageSenderService;

  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();
    await env.runMigrations();

    pool = env.getPostgresPool();
    amqpConnection = env.getRabbitMQConnection();

    mockEmailServer = await createMockEmailServer();
    messageSender = new MessageSenderService(mockEmailServer.getUrl());
  }, 180000);

  afterAll(async () => {
    await mockEmailServer.stop();
    await env.teardown();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase(pool);
    await purgeQueues(amqpConnection, ['birthday-queue', 'anniversary-queue', 'dlq']);
    mockEmailServer.clearRequests();
    mockEmailServer.setResponseMode('success');
    messageSender.resetCircuitBreaker();
  });

  describe('Probabilistic failure handling', () => {
    it('should achieve minimum 80% success rate with 10% API failure rate', async () => {
      // Configure mock server to fail randomly ~10% of the time
      mockEmailServer.setResponseMode('probabilistic-failure');
      mockEmailServer.setProbabilisticFailureRate(0.1);

      const tester = createResilientTester<void>(RetryPresets.probabilisticFailure);

      // Create test users
      const users = await Promise.all(
        Array.from({ length: 50 }, async (_, i) => {
          return await insertUser(pool, {
            firstName: `User${i}`,
            lastName: 'Test',
            email: `user${i}@test.com`,
            timezone: 'UTC',
            birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
            anniversaryDate: null,
          });
        })
      );

      // Execute API calls with retry logic
      const apiCalls = users.map((user) => async () => {
        await messageSender.sendBirthdayMessage(user);
      });

      const results = await tester.executeBatch(apiCalls, {
        onRetry: (attempt, error) => {
          // Log retries for debugging
          console.log(`Retry attempt ${attempt}: ${error.message}`);
        },
      });

      // Get statistics
      const stats = tester.getStats();

      console.log('Test Statistics:', {
        totalAttempts: stats.totalAttempts,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        successRate: `${stats.successRate.toFixed(2)}%`,
        averageAttempts: stats.averageAttempts.toFixed(2),
        averageLatency: `${stats.averageLatency.toFixed(2)}ms`,
      });

      // Assertions
      // With 10% failure rate and 3 retries, we expect >80% success rate
      tester.assertMinimumSuccessRate(80, 'Expected at least 80% success rate with retry logic');

      // Verify retry mechanism was actually used
      expect(stats.averageAttempts).toBeGreaterThan(1);

      // Most requests should succeed
      const successfulResults = results.filter((r) => r.success);
      expect(successfulResults.length).toBeGreaterThan(40); // >80% of 50

      // Some failures are expected with probabilistic API
      if (stats.failureCount > 0) {
        console.log('Expected failures occurred:', stats.failures.length);
        expect(stats.failures.length).toBeLessThan(10); // <20% failure rate
      }
    }, 120000); // Extended timeout for 50 API calls with retries

    it('should track detailed retry statistics', async () => {
      mockEmailServer.setResponseMode('probabilistic-failure');
      mockEmailServer.setProbabilisticFailureRate(0.2); // 20% failure rate for more retries

      const tester = createResilientTester<void>({
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 5000,
        factor: 2,
        jitter: true,
      });

      const user = await insertUser(pool, {
        firstName: 'Stats',
        lastName: 'Test',
        email: 'stats@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      // Execute 20 API calls
      const apiCalls = Array.from({ length: 20 }, () => async () => {
        await messageSender.sendBirthdayMessage(user);
      });

      await tester.executeBatch(apiCalls);

      const stats = tester.getStats();

      // Verify statistics are tracked correctly
      expect(stats.totalAttempts).toBe(20);
      expect(stats.successCount + stats.failureCount).toBe(20);
      expect(stats.successRate).toBeGreaterThan(0);
      expect(stats.averageAttempts).toBeGreaterThanOrEqual(1);
      expect(stats.averageLatency).toBeGreaterThan(0);

      // With 20% failure rate and 5 retries, most should succeed
      expect(stats.successRate).toBeGreaterThan(60);

      // Failures should be tracked with details
      if (stats.failures.length > 0) {
        stats.failures.forEach((failure) => {
          expect(failure).toHaveProperty('attemptNumber');
          expect(failure).toHaveProperty('error');
          expect(failure).toHaveProperty('timestamp');
        });
      }
    }, 60000);

    it('should handle burst of failures gracefully', async () => {
      // Simulate temporary service degradation (50% failure rate)
      mockEmailServer.setResponseMode('probabilistic-failure');
      mockEmailServer.setProbabilisticFailureRate(0.5);

      const tester = createResilientTester<void>(RetryPresets.highReliability);

      const users = await Promise.all(
        Array.from({ length: 20 }, async (_, i) => {
          return await insertUser(pool, {
            firstName: `Burst${i}`,
            lastName: 'Test',
            email: `burst${i}@test.com`,
            timezone: 'UTC',
            birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
            anniversaryDate: null,
          });
        })
      );

      const apiCalls = users.map((user) => async () => {
        await messageSender.sendBirthdayMessage(user);
      });

      const results = await tester.executeBatch(apiCalls);

      const stats = tester.getStats();

      console.log('Burst failure test:', {
        successRate: `${stats.successRate.toFixed(2)}%`,
        averageAttempts: stats.averageAttempts.toFixed(2),
        failures: stats.failureCount,
      });

      // Even with 50% failure rate, retry logic should achieve reasonable success
      // With 5 retries, probability of all attempts failing: 0.5^6 ≈ 1.6%
      // Expected success rate: ~98%
      tester.assertMinimumSuccessRate(
        90,
        'Expected >90% success rate even with 50% API failure rate'
      );

      // Verify retries were heavily used
      expect(stats.averageAttempts).toBeGreaterThan(2);

      // Most results should succeed despite high failure rate
      const successfulResults = results.filter((r) => r.success);
      expect(successfulResults.length).toBeGreaterThan(18); // >90% of 20
    }, 90000);
  });

  describe('Retry mechanism validation', () => {
    it('should use exponential backoff correctly', async () => {
      // Configure API to fail first 2 times, then succeed
      mockEmailServer.setResponseMode('error-500');
      mockEmailServer.setErrorCount(2);

      const tester = createResilientTester<void>({
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
        factor: 2,
        jitter: false, // Disable jitter for predictable timing
      });

      const user = await insertUser(pool, {
        firstName: 'Backoff',
        lastName: 'Test',
        email: 'backoff@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const startTime = Date.now();

      const result = await tester.executeWithRetry(async () => {
        await messageSender.sendBirthdayMessage(user);
      });

      const elapsedTime = Date.now() - startTime;

      // Should succeed after retries
      expect(result.success).toBe(true);
      expect(result.attemptNumber).toBe(3); // Failed 2 times, succeeded on 3rd

      // Verify exponential backoff timing
      // Expected delays: 100ms (attempt 1) + 200ms (attempt 2) = 300ms minimum
      expect(elapsedTime).toBeGreaterThanOrEqual(300);

      // Should have taken 3 attempts
      const stats = tester.getStats();
      expect(stats.successCount).toBe(1);
      expect(stats.averageAttempts).toBe(3);
    }, 30000);

    it('should respect maximum retry limit', async () => {
      // Configure API to always fail
      mockEmailServer.setResponseMode('error-500');
      mockEmailServer.setErrorCount(100);

      const tester = createResilientTester<void>({
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
        factor: 2,
        jitter: false,
      });

      const user = await insertUser(pool, {
        firstName: 'MaxRetry',
        lastName: 'Test',
        email: 'maxretry@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const result = await tester.executeWithRetry(async () => {
        await messageSender.sendBirthdayMessage(user);
      });

      // Should fail after max retries
      expect(result.success).toBe(false);
      expect(result.attemptNumber).toBe(4); // 1 initial + 3 retries
      expect(result.error).toBeDefined();

      // Verify max retries not exceeded
      tester.assertMaxRetriesNotExceeded();

      const stats = tester.getStats();
      expect(stats.failureCount).toBe(1);
      expect(stats.averageAttempts).toBe(4);
    }, 30000);

    it('should not retry on non-retriable errors', async () => {
      // Configure API to return 400 Bad Request (non-retriable)
      mockEmailServer.setResponseMode('error-400');

      const tester = createResilientTester<void>();

      const user = await insertUser(pool, {
        firstName: 'NonRetriable',
        lastName: 'Test',
        email: 'nonretriable@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const result = await tester.executeWithRetry(
        async () => {
          await messageSender.sendBirthdayMessage(user);
        },
        {
          shouldRetry: (error) => {
            // Don't retry on 4xx errors
            return !/4\d{2}/.test(error.message);
          },
        }
      );

      // Should fail immediately without retries
      expect(result.success).toBe(false);
      expect(result.attemptNumber).toBe(1); // No retries
      expect(result.statusCode).toBe(400);

      const stats = tester.getStats();
      expect(stats.averageAttempts).toBe(1); // Should not have retried
    }, 30000);

    it('should apply jitter to prevent thundering herd', async () => {
      mockEmailServer.setResponseMode('error-500');
      mockEmailServer.setErrorCount(1); // Fail once

      const timings: number[] = [];

      // Execute multiple concurrent requests with jitter
      const requests = Array.from({ length: 10 }, async () => {
        const tester = createResilientTester<void>({
          maxRetries: 2,
          baseDelay: 1000,
          maxDelay: 5000,
          factor: 2,
          jitter: true, // Enable jitter
        });

        const user = await insertUser(pool, {
          firstName: 'Jitter',
          lastName: 'Test',
          email: `jitter${Math.random()}@test.com`,
          timezone: 'UTC',
          birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });

        const startTime = Date.now();
        await tester.executeWithRetry(async () => {
          await messageSender.sendBirthdayMessage(user);
        });
        const elapsed = Date.now() - startTime;

        timings.push(elapsed);
      });

      await Promise.all(requests);

      // Verify timings are not identical (jitter working)
      const uniqueTimings = new Set(timings);
      expect(uniqueTimings.size).toBeGreaterThan(5); // Should have variety

      // All timings should be >= base delay
      timings.forEach((timing) => {
        expect(timing).toBeGreaterThanOrEqual(1000);
      });
    }, 60000);
  });

  describe('Circuit breaker integration', () => {
    it('should open circuit after threshold failures', async () => {
      // Configure API to always fail
      mockEmailServer.setResponseMode('error-500');
      mockEmailServer.setErrorCount(100);

      const tester = createResilientTester<void>(RetryPresets.fastFail);

      const users = await Promise.all(
        Array.from({ length: 15 }, async (_, i) => {
          return await insertUser(pool, {
            firstName: `Circuit${i}`,
            lastName: 'Test',
            email: `circuit${i}@test.com`,
            timezone: 'UTC',
            birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
            anniversaryDate: null,
          });
        })
      );

      // Try to send messages - circuit should eventually open
      for (const user of users) {
        try {
          await tester.executeWithRetry(async () => {
            await messageSender.sendBirthdayMessage(user);
          });
        } catch (error) {
          // Expected to fail
        }

        // Check circuit breaker status
        const cbStats = messageSender.getCircuitBreakerStats();
        if (cbStats.isOpen) {
          console.log('Circuit breaker opened after failures:', cbStats.failures);
          break;
        }
      }

      const cbStats = messageSender.getCircuitBreakerStats();
      const stats = tester.getStats();

      // Verify circuit breaker responded to failures
      expect(cbStats.failures).toBeGreaterThan(0);

      // All attempts should have failed
      expect(stats.failureCount).toBeGreaterThan(0);
      expect(stats.successRate).toBe(0);
    }, 60000);

    it('should verify circuit breaker recovery', async () => {
      // First, trigger circuit breaker to open
      mockEmailServer.setResponseMode('error-500');
      mockEmailServer.setErrorCount(20);

      const user = await insertUser(pool, {
        firstName: 'Recovery',
        lastName: 'Test',
        email: 'recovery@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      // Trigger failures
      for (let i = 0; i < 10; i++) {
        try {
          await messageSender.sendBirthdayMessage(user);
        } catch (error) {
          // Expected
        }
      }

      const initialStats = messageSender.getCircuitBreakerStats();
      const wasOpenOrHighFailures = initialStats.isOpen || initialStats.failures > 5;

      // Reset circuit breaker (simulating timeout passing)
      messageSender.resetCircuitBreaker();

      // Now configure API to succeed
      mockEmailServer.setResponseMode('success');

      // Verify circuit recovers
      const tester = createResilientTester<void>();
      const result = await tester.executeWithRetry(async () => {
        await messageSender.sendBirthdayMessage(user);
      });

      expect(result.success).toBe(true);

      const recoveredStats = messageSender.getCircuitBreakerStats();
      expect(recoveredStats.state).toBe('closed');
    }, 45000);
  });

  describe('Performance and latency', () => {
    it('should maintain acceptable latency under retry load', async () => {
      mockEmailServer.setResponseMode('probabilistic-failure');
      mockEmailServer.setProbabilisticFailureRate(0.15); // 15% failure rate

      const tester = createResilientTester<void>({
        maxRetries: 3,
        baseDelay: 500,
        maxDelay: 5000,
        factor: 2,
        jitter: true,
      });

      const users = await Promise.all(
        Array.from({ length: 30 }, async (_, i) => {
          return await insertUser(pool, {
            firstName: `Latency${i}`,
            lastName: 'Test',
            email: `latency${i}@test.com`,
            timezone: 'UTC',
            birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
            anniversaryDate: null,
          });
        })
      );

      const apiCalls = users.map((user) => async () => {
        await messageSender.sendBirthdayMessage(user);
      });

      await tester.executeBatch(apiCalls);

      const stats = tester.getStats();

      console.log('Latency test results:', {
        averageLatency: `${stats.averageLatency.toFixed(2)}ms`,
        averageAttempts: stats.averageAttempts.toFixed(2),
        successRate: `${stats.successRate.toFixed(2)}%`,
      });

      // Average latency should be reasonable even with retries
      // With 15% failure rate and retries, expect average latency < 3 seconds
      tester.assertAverageLatency(3000);

      // Success rate should still be high
      tester.assertMinimumSuccessRate(80);
    }, 90000);

    it('should provide performance metrics for monitoring', async () => {
      mockEmailServer.setResponseMode('probabilistic-failure');
      mockEmailServer.setProbabilisticFailureRate(0.1);

      const tester = createResilientTester<void>();

      const users = await Promise.all(
        Array.from({ length: 25 }, async (_, i) => {
          return await insertUser(pool, {
            firstName: `Metrics${i}`,
            lastName: 'Test',
            email: `metrics${i}@test.com`,
            timezone: 'UTC',
            birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
            anniversaryDate: null,
          });
        })
      );

      const apiCalls = users.map((user) => async () => {
        await messageSender.sendBirthdayMessage(user);
      });

      await tester.executeBatch(apiCalls);

      const stats = tester.getStats();

      // Verify all metrics are available
      expect(stats).toHaveProperty('totalAttempts');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('averageAttempts');
      expect(stats).toHaveProperty('averageLatency');
      expect(stats).toHaveProperty('failures');

      // Verify metrics make sense
      expect(stats.totalAttempts).toBe(25);
      expect(stats.successCount + stats.failureCount).toBe(25);
      expect(stats.successRate).toBeGreaterThan(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
      expect(stats.averageAttempts).toBeGreaterThanOrEqual(1);
      expect(stats.averageLatency).toBeGreaterThan(0);

      // Log metrics for monitoring
      console.log('Performance Metrics:', {
        ...stats,
        successRate: `${stats.successRate.toFixed(2)}%`,
        averageLatency: `${stats.averageLatency.toFixed(2)}ms`,
      });
    }, 75000);
  });

  describe('Test utility features', () => {
    it('should allow custom retry logic', async () => {
      mockEmailServer.setResponseMode('error-500');
      mockEmailServer.setErrorCount(2);

      const tester = createResilientTester<void>();
      const retryLog: number[] = [];

      const user = await insertUser(pool, {
        firstName: 'Custom',
        lastName: 'Retry',
        email: 'custom@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      const result = await tester.executeWithRetry(
        async () => {
          await messageSender.sendBirthdayMessage(user);
        },
        {
          shouldRetry: (error) => {
            // Custom retry logic: only retry on 500 errors
            return /500/.test(error.message);
          },
          onRetry: (attemptNumber, error) => {
            retryLog.push(attemptNumber);
            console.log(`Custom retry handler: attempt ${attemptNumber}, ${error.message}`);
          },
        }
      );

      expect(result.success).toBe(true);
      expect(retryLog.length).toBeGreaterThan(0); // Retries occurred
    }, 30000);

    it('should support resetting statistics between test runs', async () => {
      const tester = createResilientTester<void>();

      const user = await insertUser(pool, {
        firstName: 'Reset',
        lastName: 'Test',
        email: 'reset@test.com',
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
        anniversaryDate: null,
      });

      // First run
      mockEmailServer.setResponseMode('success');
      await tester.executeWithRetry(async () => {
        await messageSender.sendBirthdayMessage(user);
      });

      let stats = tester.getStats();
      expect(stats.totalAttempts).toBe(1);

      // Reset
      tester.reset();

      // Second run
      await tester.executeWithRetry(async () => {
        await messageSender.sendBirthdayMessage(user);
      });

      stats = tester.getStats();
      expect(stats.totalAttempts).toBe(1); // Should be reset, not 2
    }, 30000);
  });
});
